import { Router } from "express";
import { z } from "zod";
import type { SpotType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { qrPayload, toDataUrl, toSvg } from "../lib/qr.js";
import { param } from "../lib/params.js";

export const spotsRouter = Router();

const types = ["STANDARD", "COMPACT", "MOTORCYCLE", "EV_CHARGING", "ACCESSIBLE", "PREMIUM"] as const;
const statuses = ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"] as const;

spotsRouter.get("/grounds/:id/spots", async (req, res, next) => {
  try {
    const spots = await prisma.parkingSpot.findMany({
      where: { parkingGroundId: param(req) },
      orderBy: [{ row: "asc" }, { col: "asc" }],
    });
    res.json({ spots });
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  spotNumber: z.string().min(1),
  level: z.string().optional(),
  row: z.string().optional(),
  col: z.number().int().optional(),
  spotType: z.enum(types),
  distanceToEntrance: z.number().nonnegative(),
  isAccessible: z.boolean().optional(),
});

spotsRouter.post(
  "/grounds/:id/spots",
  requireAuth,
  requireRole("ADMIN"),
  validate(createSchema),
  async (req, res, next) => {
    try {
      const spot = await prisma.parkingSpot.create({
        data: { ...req.body, parkingGroundId: param(req) },
      });
      const qr = qrPayload("SPOT", spot.id);
      const updated = await prisma.parkingSpot.update({ where: { id: spot.id }, data: { qrCode: qr } });
      await syncCapacity(param(req));
      res.status(201).json({ spot: updated });
    } catch (e) {
      next(e);
    }
  }
);

const generateSchema = z.object({
  rows: z.number().int().positive(),
  cols: z.number().int().positive(),
  level: z.string().optional(),
});

spotsRouter.post(
  "/grounds/:id/spots/generate",
  requireAuth,
  requireRole("ADMIN"),
  validate(generateSchema),
  async (req, res, next) => {
    try {
      const { rows, cols, level } = req.body as { rows: number; cols: number; level?: string };
      const groundId = param(req);
      const created = [];
      for (let r = 0; r < rows; r++) {
        const rowLetter = String.fromCharCode(65 + r);
        for (let c = 1; c <= cols; c++) {
          const spotNumber = `${rowLetter}-${c}`;
          const distance = Math.sqrt(r * r + (c - 1) * (c - 1)) * 4.5;
          let spotType: SpotType = "STANDARD";
          if (c === 1 && r < 2) spotType = "ACCESSIBLE";
          else if (r === 0 && c <= 3) spotType = "EV_CHARGING";
          else if (r === rows - 1) spotType = "MOTORCYCLE";
          else if (c <= 2) spotType = "PREMIUM";
          else if (c > cols - 2) spotType = "COMPACT";
          const spot = await prisma.parkingSpot.upsert({
            where: { parkingGroundId_spotNumber: { parkingGroundId: groundId, spotNumber } },
            update: {},
            create: {
              parkingGroundId: groundId,
              spotNumber,
              level: level || "Ground Floor",
              row: `Row ${rowLetter}`,
              col: c,
              spotType,
              isAccessible: spotType === "ACCESSIBLE",
              distanceToEntrance: Number(distance.toFixed(1)),
            },
          });
          if (!spot.qrCode) {
            await prisma.parkingSpot.update({
              where: { id: spot.id },
              data: { qrCode: qrPayload("SPOT", spot.id) },
            });
          }
          created.push(spotNumber);
        }
      }
      await prisma.parkingGround.update({
        where: { id: groundId },
        data: { layoutRows: rows, layoutCols: cols, totalCapacity: rows * cols },
      });
      res.json({ created: created.length });
    } catch (e) {
      next(e);
    }
  }
);

spotsRouter.put("/spots/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const schema = z.object({
      spotNumber: z.string().optional(),
      level: z.string().optional(),
      row: z.string().optional(),
      col: z.number().int().optional(),
      spotType: z.enum(types).optional(),
      distanceToEntrance: z.number().optional(),
      isAccessible: z.boolean().optional(),
      status: z.enum(statuses).optional(),
    });
    const data = schema.parse(req.body);
    const spot = await prisma.parkingSpot.update({ where: { id: param(req) }, data });
    res.json({ spot });
  } catch (e) {
    next(e);
  }
});

spotsRouter.delete("/spots/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const spot = await prisma.parkingSpot.delete({ where: { id: param(req) } });
    await syncCapacity(spot.parkingGroundId);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

spotsRouter.patch(
  "/spots/:id/status",
  requireAuth,
  requireRole("ADMIN"),
  validate(z.object({ status: z.enum(statuses) })),
  async (req, res, next) => {
    try {
      const spot = await prisma.parkingSpot.update({
        where: { id: param(req) },
        data: { status: req.body.status },
      });
      res.json({ spot });
    } catch (e) {
      next(e);
    }
  }
);

spotsRouter.post(
  "/spots/bulk-update",
  requireAuth,
  requireRole("ADMIN"),
  validate(
    z.object({
      ids: z.array(z.string()).min(1),
      status: z.enum(statuses).optional(),
      spotType: z.enum(types).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const { ids, status, spotType } = req.body;
      const data: { status?: (typeof statuses)[number]; spotType?: (typeof types)[number] } = {};
      if (status) data.status = status;
      if (spotType) data.spotType = spotType;
      const result = await prisma.parkingSpot.updateMany({ where: { id: { in: ids } }, data });
      res.json({ updated: result.count });
    } catch (e) {
      next(e);
    }
  }
);

spotsRouter.get("/spots/:id/qrcode", async (req, res, next) => {
  try {
    const spot = await prisma.parkingSpot.findUnique({ where: { id: param(req) } });
    if (!spot) return res.status(404).json({ error: "Spot not found" });
    const data = spot.qrCode || qrPayload("SPOT", spot.id);
    const format = (req.query.format as string) || "png";
    if (format === "svg") {
      res.type("image/svg+xml").send(await toSvg(data));
      return;
    }
    res.json({ data, image: await toDataUrl(data), spot });
  } catch (e) {
    next(e);
  }
});

async function syncCapacity(groundId: string) {
  const count = await prisma.parkingSpot.count({ where: { parkingGroundId: groundId } });
  await prisma.parkingGround.update({ where: { id: groundId }, data: { totalCapacity: count } });
}
