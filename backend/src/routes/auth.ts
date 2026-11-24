import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma.js";
import {
  cookieOptions,
  hashToken,
  newJti,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

export const authRouter = Router();
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  accessibility: z.boolean().optional(),
  vehicle: z
    .object({
      licensePlate: z.string().min(3),
      vehicleType: z.enum(["CAR", "MOTORCYCLE", "EV", "TRUCK"]),
    })
    .optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, phone, accessibility, vehicle } = req.body;
    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hash,
        phone,
        accessibility: accessibility ?? false,
        vehicles: vehicle
          ? {
              create: {
                licensePlate: vehicle.licensePlate.toUpperCase(),
                vehicleType: vehicle.vehicleType,
                isDefault: true,
              },
            }
          : undefined,
      },
      include: { vehicles: true },
    });
    await setAuthCookies(res, user.id, user.role);
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { vehicles: true },
    });
    if (!user || !user.password) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.isActive) return res.status(403).json({ error: "Account is suspended" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    await setAuthCookies(res, user.id, user.role);
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/google", async (req, res, next) => {
  try {
    if (!googleClient || !process.env.GOOGLE_CLIENT_ID) {
      return res.status(501).json({ error: "Google OAuth is not configured" });
    }
    const { credential } = z.object({ credential: z.string() }).parse(req.body);
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(400).json({ error: "Invalid Google token" });
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: payload.sub }, { email: payload.email.toLowerCase() }] },
      include: { vehicles: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email.toLowerCase(),
          name: payload.name || "Google User",
          googleId: payload.sub,
          avatarUrl: payload.picture,
        },
        include: { vehicles: true },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, avatarUrl: payload.picture },
        include: { vehicles: true },
      });
    }
    if (!user.isActive) return res.status(403).json({ error: "Account is suspended" });
    await setAuthCookies(res, user.id, user.role);
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const payload = verifyRefreshToken(token);
    const hash = hashToken(token);
    const stored = await prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash: hash, expiresAt: { gt: new Date() } },
    });
    if (!stored) return res.status(401).json({ error: "Unauthorized" });
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return res.status(401).json({ error: "Unauthorized" });
    await setAuthCookies(res, user.id, user.role);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { vehicles: true, favorites: true },
    });
    res.json({ user: publicUser(user!) });
  } catch (e) {
    next(e);
  }
});

const updateMeSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  accessibility: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
  avatarUrl: z.string().url().optional(),
});

authRouter.put("/me", requireAuth, validate(updateMeSchema), async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: req.body,
      include: { vehicles: true, favorites: true },
    });
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

async function setAuthCookies(res: import("express").Response, userId: string, role: "USER" | "ADMIN") {
  const access = signAccessToken({ sub: userId, role });
  const jti = newJti();
  const refresh = signRefreshToken({ sub: userId, role, jti });
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refresh),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  res.cookie("accessToken", access, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refresh, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  avatarUrl: string | null;
  accessibility: boolean;
  isActive: boolean;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
  vehicles?: unknown;
  favorites?: unknown;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    accessibility: user.accessibility,
    isActive: user.isActive,
    notifyEmail: user.notifyEmail,
    notifyInApp: user.notifyInApp,
    vehicles: user.vehicles,
    favorites: user.favorites,
  };
}
