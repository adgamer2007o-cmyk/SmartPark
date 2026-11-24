import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { qrPayload, toDataUrl } from "../lib/qr.js";
import { param } from "../lib/params.js";

export const groundsRouter = Router();

groundsRouter.get("/", async (_req, res, next) => {
  try {
    const grounds = await prisma.parkingGround.findMany({
      where: { isActive: true },
      include: { spots: { select: { status: true } }, pricingConfigs: true },
      orderBy: { name: "asc" },
    });
    res.json({
      grounds: grounds.map((g) => ({
        ...stripSpots(g),
        occupancy: occupancy(g.spots),
      })),
    });
  } catch (e) {
    next(e);
  }
});

groundsRouter.get("/:id", async (req, res, next) => {
  try {
    const ground = await prisma.parkingGround.findUnique({
      where: { id: param(req) },
      include: { spots: true, pricingConfigs: true },
    });
    if (!ground) return res.status(404).json({ error: "Parking ground not found" });
    res.json({ ground: { ...ground, occupancy: occupancy(ground.spots) } });
  } catch (e) {
    next(e);
  }
});

groundsRouter.get("/:id/occupancy", async (req, res, next) => {
  try {
    const spots = await prisma.parkingSpot.findMany({
      where: { parkingGroundId: param(req) },
      select: { status: true, spotType: true },
    });
    res.json({ occupancy: occupancy(spots), byType: group(spots) });
  } catch (e) {
    next(e);
  }
});

const upsertSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  description: z.string().optional(),
  totalCapacity: z.number().int().positive(),
  operatingHours: z.string(),
  isActive: z.boolean().optional(),
  layoutRows: z.number().int().positive().optional(),
  layoutCols: z.number().int().positive().optional(),
});

groundsRouter.post("/", requireAuth, requireRole("ADMIN"), validate(upsertSchema), async (req: AuthedRequest, res, next) => {
  try {
    const ground = await prisma.parkingGround.create({ data: req.body });
    const entrance = qrPayload("ENTRANCE", ground.id);
    const exit = qrPayload("EXIT", ground.id);
    const updated = await prisma.parkingGround.update({
      where: { id: ground.id },
      data: { entranceQRCode: entrance, exitQRCode: exit },
    });
    res.status(201).json({ ground: updated });
  } catch (e) {
    next(e);
  }
});

groundsRouter.put("/:id", requireAuth, requireRole("ADMIN"), validate(upsertSchema), async (req, res, next) => {
  try {
    const ground = await prisma.parkingGround.update({ where: { id: param(req) }, data: req.body });
    res.json({ ground });
  } catch (e) {
    next(e);
  }
});

groundsRouter.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    await prisma.parkingGround.delete({ where: { id: param(req) } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

groundsRouter.get("/:id/qrcode", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const ground = await prisma.parkingGround.findUnique({ where: { id: param(req) } });
    if (!ground) return res.status(404).json({ error: "Not found" });
    const entrance = ground.entranceQRCode || qrPayload("ENTRANCE", ground.id);
    const exit = ground.exitQRCode || qrPayload("EXIT", ground.id);
    res.json({
      entrance: { data: entrance, image: await toDataUrl(entrance) },
      exit: { data: exit, image: await toDataUrl(exit) },
    });
  } catch (e) {
    next(e);
  }
});

function occupancy(spots: { status: string }[]) {
  const total = spots.length;
  const available = spots.filter((s) => s.status === "AVAILABLE").length;
  const occupied = spots.filter((s) => s.status === "OCCUPIED").length;
  const reserved = spots.filter((s) => s.status === "RESERVED").length;
  const maintenance = spots.filter((s) => s.status === "MAINTENANCE").length;
  return {
    total,
    available,
    occupied,
    reserved,
    maintenance,
    rate: total ? occupied / total : 0,
  };
}

function group(spots: { status: string; spotType: string }[]) {
  const out: Record<string, number> = {};
  for (const s of spots) {
    if (s.status === "AVAILABLE") out[s.spotType] = (out[s.spotType] || 0) + 1;
  }
  return out;
}

function stripSpots<T extends { spots: unknown }>(g: T) {
  const { spots: _s, ...rest } = g;
  return rest;
}
