import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { Role } from "@prisma/client";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh";

export type JwtPayload = { sub: string; role: Role };

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: JwtPayload & { jti: string }) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload & { jti: string };
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newJti() {
  return crypto.randomUUID();
}

export const cookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
};
