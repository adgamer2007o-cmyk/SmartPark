import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { assignSpot } from "../services/assignment.js";
import { calculatePrice, getPricingForGround } from "../services/pricing.js";

export const assignRouter = Router();

const assignSchema = z.object({
  parkingGroundId: z.string(),
  vehicleId: z.string(),
  accessibilityRequired: z.boolean().optional(),
  scanType: z.enum(["ENTRANCE", "SPOT", "MANUAL"]).default("ENTRANCE"),
  preferredSpotId: z.string().optional(),
});

assignRouter.post("/assign-spot", requireAuth, validate(assignSchema), async (req: AuthedRequest, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.body.vehicleId, userId: req.user!.id },
    });
    if (!vehicle) return res.status(400).json({ error: "Vehicle not found" });
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const result = await assignSpot({
      parkingGroundId: req.body.parkingGroundId,
      userId: req.user!.id,
      vehicleId: vehicle.id,
      vehicleType: vehicle.vehicleType,
      accessibilityRequired: req.body.accessibilityRequired ?? user?.accessibility ?? false,
      scanType: req.body.scanType,
      preferredSpotId: req.body.preferredSpotId,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

const scanSchema = z.object({
  payload: z.string().min(1),
  vehicleId: z.string().optional(),
});

assignRouter.post("/scan", requireAuth, validate(scanSchema), async (req: AuthedRequest, res, next) => {
  try {
    let parsed: { kind?: string; id?: string };
    try {
      parsed = JSON.parse(req.body.payload);
    } catch {
      return res.status(400).json({ error: "Unrecognized QR code. Try manual entry." });
    }
    const { kind, id } = parsed;
    if (!kind || !id) return res.status(400).json({ error: "Invalid QR payload" });

    if (kind === "ENTRANCE") {
      const ground = await prisma.parkingGround.findUnique({ where: { id } });
      if (!ground || !ground.isActive) return res.status(404).json({ error: "Unknown parking ground" });
      if (!req.body.vehicleId) {
        return res.json({ kind, ground, needsVehicle: true });
      }
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: req.body.vehicleId, userId: req.user!.id },
      });
      if (!vehicle) return res.status(400).json({ error: "Vehicle not found" });
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      const assignment = await assignSpot({
        parkingGroundId: ground.id,
        userId: req.user!.id,
        vehicleId: vehicle.id,
        vehicleType: vehicle.vehicleType,
        accessibilityRequired: user?.accessibility ?? false,
        scanType: "ENTRANCE",
      });
      return res.json({ kind, ground, assignment });
    }

    if (kind === "EXIT") {
      const active = await prisma.booking.findFirst({
        where: {
          userId: req.user!.id,
          parkingGroundId: id,
          bookingStatus: { in: ["ACTIVE", "EXTENDED"] },
        },
        include: { spot: true, parkingGround: true },
      });
      if (!active) return res.status(404).json({ error: "No active booking at this exit" });
      return res.json({ kind, booking: active, expired: active.endTime < new Date() });
    }

    if (kind === "SPOT") {
      const spot = await prisma.parkingSpot.findUnique({
        where: { id },
        include: { parkingGround: true },
      });
      if (!spot) return res.status(404).json({ error: "Unknown spot" });
      const bookable = spot.status === "AVAILABLE" || spot.reservedByUserId === req.user!.id;
      return res.json({ kind, spot, bookable });
    }

    if (kind === "TICKET") {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { spot: true, parkingGround: true, user: true, vehicle: true },
      });
      if (!booking) return res.status(404).json({ error: "Unknown ticket" });
      return res.json({ kind, booking });
    }

    res.status(400).json({ error: "Unsupported QR type" });
  } catch (e) {
    next(e);
  }
});

assignRouter.post(
  "/price-preview",
  requireAuth,
  validate(
    z.object({
      parkingGroundId: z.string(),
      spotType: z.enum(["STANDARD", "COMPACT", "MOTORCYCLE", "EV_CHARGING", "ACCESSIBLE", "PREMIUM"]),
      hours: z.number().positive(),
    })
  ),
  async (req: AuthedRequest, res, next) => {
    try {
      const config = await getPricingForGround(req.body.parkingGroundId);
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      const breakdown = calculatePrice({
        hours: req.body.hours,
        config,
        spotType: req.body.spotType,
        isStudent: user?.role === "USER",
      });
      res.json({ breakdown });
    } catch (e) {
      next(e);
    }
  }
);
