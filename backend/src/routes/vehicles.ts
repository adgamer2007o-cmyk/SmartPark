import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { param } from "../lib/params.js";

export const vehiclesRouter = Router();
vehiclesRouter.use(requireAuth);

const schema = z.object({
  licensePlate: z.string().min(3),
  vehicleType: z.enum(["CAR", "MOTORCYCLE", "EV", "TRUCK"]),
  isDefault: z.boolean().optional(),
});

vehiclesRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const vehicles = await prisma.vehicle.findMany({ where: { userId: req.user!.id } });
    res.json({ vehicles });
  } catch (e) {
    next(e);
  }
});

vehiclesRouter.post("/", validate(schema), async (req: AuthedRequest, res, next) => {
  try {
    if (req.body.isDefault) {
      await prisma.vehicle.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    }
    const vehicle = await prisma.vehicle.create({
      data: {
        userId: req.user!.id,
        licensePlate: req.body.licensePlate.toUpperCase(),
        vehicleType: req.body.vehicleType,
        isDefault: req.body.isDefault ?? false,
      },
    });
    res.status(201).json({ vehicle });
  } catch (e) {
    next(e);
  }
});

vehiclesRouter.put("/:id", validate(schema), async (req: AuthedRequest, res, next) => {
  try {
    if (req.body.isDefault) {
      await prisma.vehicle.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    }
    const vehicle = await prisma.vehicle.update({
      where: { id: param(req) },
      data: { ...req.body, licensePlate: req.body.licensePlate.toUpperCase() },
    });
    res.json({ vehicle });
  } catch (e) {
    next(e);
  }
});

vehiclesRouter.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    await prisma.vehicle.delete({ where: { id: param(req) } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export const favoritesRouter = Router();
favoritesRouter.use(requireAuth);

favoritesRouter.post(
  "/",
  validate(z.object({ parkingGroundId: z.string() })),
  async (req: AuthedRequest, res, next) => {
    try {
      const fav = await prisma.favoriteGround.upsert({
        where: { userId_parkingGroundId: { userId: req.user!.id, parkingGroundId: req.body.parkingGroundId } },
        create: { userId: req.user!.id, parkingGroundId: req.body.parkingGroundId },
        update: {},
      });
      res.json({ favorite: fav });
    } catch (e) {
      next(e);
    }
  }
);

favoritesRouter.delete("/:groundId", async (req: AuthedRequest, res, next) => {
  try {
    await prisma.favoriteGround.deleteMany({
      where: { userId: req.user!.id, parkingGroundId: param(req, "groundId") },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
