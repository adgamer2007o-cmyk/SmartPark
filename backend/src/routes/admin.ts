import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { qrPayload, toDataUrl, toSvg } from "../lib/qr.js";
import { calculatePrice } from "../services/pricing.js";
import { param } from "../lib/params.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/stats", async (_req, res, next) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [spots, occupied, bookingsToday, users, revenueAgg] = await Promise.all([
      prisma.parkingSpot.count(),
      prisma.parkingSpot.count({ where: { status: "OCCUPIED" } }),
      prisma.booking.count({ where: { createdAt: { gte: start } } }),
      prisma.user.count(),
      prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: { paymentStatus: "PAID", createdAt: { gte: start } },
      }),
    ]);
    const grounds = await prisma.parkingGround.findMany({
      include: { spots: { select: { status: true } } },
    });
    const recent = await prisma.booking.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { user: true, spot: true, parkingGround: true },
    });
    res.json({
      totalSpots: spots,
      occupied,
      available: spots - occupied,
      revenueToday: revenueAgg._sum.totalPrice || 0,
      bookingsToday,
      users,
      occupancy: grounds.map((g) => ({
        id: g.id,
        name: g.name,
        total: g.spots.length,
        occupied: g.spots.filter((s) => s.status === "OCCUPIED").length,
        available: g.spots.filter((s) => s.status === "AVAILABLE").length,
      })),
      recent,
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/revenue", async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const bookings = await prisma.booking.findMany({
      where: { createdAt: { gte: from, lte: to }, paymentStatus: "PAID" },
      select: { createdAt: true, totalPrice: true, startTime: true, parkingGround: { select: { name: true } } },
    });
    const byDay: Record<string, number> = {};
    const byHour: Record<number, number> = {};
    for (const b of bookings) {
      const day = b.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + b.totalPrice;
      const h = b.startTime.getHours();
      byHour[h] = (byHour[h] || 0) + 1;
    }
    res.json({ byDay, byHour, total: bookings.reduce((s, b) => s + b.totalPrice, 0) });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/users", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    const users = await prisma.user.findMany({
      where: q
        ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] }
        : undefined,
      include: { _count: { select: { bookings: true } }, vehicles: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ users });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch(
  "/users/:id/status",
  validate(z.object({ isActive: z.boolean() })),
  async (req, res, next) => {
    try {
      const user = await prisma.user.update({ where: { id: param(req) }, data: { isActive: req.body.isActive } });
      res.json({ user });
    } catch (e) {
      next(e);
    }
  }
);

adminRouter.get("/users/:id/bookings", async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: param(req) },
      include: { spot: true, parkingGround: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ bookings });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/bookings", async (req, res, next) => {
  try {
    const { groundId, userId, status } = req.query;
    const bookings = await prisma.booking.findMany({
      where: {
        parkingGroundId: groundId ? String(groundId) : undefined,
        userId: userId ? String(userId) : undefined,
        bookingStatus: status ? (String(status) as never) : undefined,
      },
      include: { user: true, spot: true, parkingGround: true, vehicle: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ bookings });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/pricing", async (_req, res, next) => {
  try {
    const configs = await prisma.pricingConfig.findMany({ include: { parkingGround: true } });
    res.json({ configs });
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/pricing", async (req, res, next) => {
  try {
    const schema = z.object({
      id: z.string().optional(),
      parkingGroundId: z.string().nullable().optional(),
      baseHourlyRate: z.number().optional(),
      firstHourFree: z.boolean().optional(),
      tieredPricing: z.any().optional(),
      dailyMaxCap: z.number().optional(),
      studentDiscount: z.number().optional(),
      premiumMultiplier: z.number().optional(),
      evMultiplier: z.number().optional(),
      weekendRateMultiplier: z.number().optional(),
      eveningStartHour: z.number().optional(),
      eveningRateMultiplier: z.number().optional(),
      isDefault: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const { id, parkingGroundId, ...rest } = data;
    const config = id
      ? await prisma.pricingConfig.update({
          where: { id },
          data: rest,
        })
      : await prisma.pricingConfig.create({
          data: {
            baseHourlyRate: rest.baseHourlyRate ?? 1.5,
            firstHourFree: rest.firstHourFree ?? false,
            tieredPricing: rest.tieredPricing ?? [],
            dailyMaxCap: rest.dailyMaxCap,
            studentDiscount: rest.studentDiscount,
            premiumMultiplier: rest.premiumMultiplier,
            evMultiplier: rest.evMultiplier,
            weekendRateMultiplier: rest.weekendRateMultiplier,
            eveningStartHour: rest.eveningStartHour,
            eveningRateMultiplier: rest.eveningRateMultiplier,
            isDefault: rest.isDefault ?? false,
            parkingGround: parkingGroundId ? { connect: { id: parkingGroundId } } : undefined,
          },
        });
    res.json({ config });
  } catch (e) {
    next(e);
  }
});

adminRouter.post(
  "/pricing/preview",
  validate(
    z.object({
      config: z.any(),
      hours: z.number(),
      spotType: z.enum(["STANDARD", "COMPACT", "MOTORCYCLE", "EV_CHARGING", "ACCESSIBLE", "PREMIUM"]),
      at: z.string().optional(),
    })
  ),
  async (req, res) => {
    const breakdown = calculatePrice({
      hours: req.body.hours,
      config: req.body.config,
      spotType: req.body.spotType,
      isStudent: true,
      at: req.body.at ? new Date(req.body.at) : new Date(),
    });
    res.json({ breakdown });
  }
);

adminRouter.get("/algorithm-config", async (_req, res, next) => {
  try {
    const config = await prisma.algorithmConfig.findFirst();
    res.json({ config });
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/algorithm-config", async (req, res, next) => {
  try {
    const schema = z.object({
      id: z.string(),
      distanceWeight: z.number(),
      typeMatchWeight: z.number(),
      preferenceWeight: z.number(),
      accessibilityWeight: z.number(),
      congestionWeight: z.number(),
    });
    const data = schema.parse(req.body);
    const config = await prisma.algorithmConfig.update({ where: { id: data.id }, data });
    res.json({ config });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/settings", async (_req, res, next) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    res.json({ settings });
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/settings", async (req, res, next) => {
  try {
    const schema = z.object({
      id: z.string(),
      maintenanceMode: z.boolean().optional(),
      notificationEmailEnabled: z.boolean().optional(),
      expiryWarningMinutes: z.number().optional(),
    });
    const data = schema.parse(req.body);
    const settings = await prisma.systemSettings.update({ where: { id: data.id }, data });
    res.json({ settings });
  } catch (e) {
    next(e);
  }
});

adminRouter.post(
  "/qrcodes/generate",
  validate(z.object({ parkingGroundId: z.string(), format: z.enum(["png", "svg"]).default("png") })),
  async (req, res, next) => {
    try {
      const ground = await prisma.parkingGround.findUnique({
        where: { id: req.body.parkingGroundId },
        include: { spots: true },
      });
      if (!ground) return res.status(404).json({ error: "Not found" });
      const entranceData = ground.entranceQRCode || qrPayload("ENTRANCE", ground.id);
      const exitData = ground.exitQRCode || qrPayload("EXIT", ground.id);
      await prisma.parkingGround.update({
        where: { id: ground.id },
        data: { entranceQRCode: entranceData, exitQRCode: exitData },
      });
      const encode = req.body.format === "svg" ? toSvg : toDataUrl;
      const spots = [];
      for (const spot of ground.spots) {
        const data = spot.qrCode || qrPayload("SPOT", spot.id);
        if (!spot.qrCode) await prisma.parkingSpot.update({ where: { id: spot.id }, data: { qrCode: data } });
        spots.push({ id: spot.id, spotNumber: spot.spotNumber, data, image: await encode(data) });
      }
      res.json({
        entrance: { data: entranceData, image: await encode(entranceData) },
        exit: { data: exitData, image: await encode(exitData) },
        spots,
      });
    } catch (e) {
      next(e);
    }
  }
);

adminRouter.get("/reports/export", async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const bookings = await prisma.booking.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { user: true, parkingGround: true, spot: true },
    });
    const header = "id,user,email,ground,spot,start,end,status,payment,total\n";
    const rows = bookings
      .map((b) =>
        [
          b.id,
          csv(b.user.name),
          b.user.email,
          csv(b.parkingGround.name),
          b.spot.spotNumber,
          b.startTime.toISOString(),
          b.endTime.toISOString(),
          b.bookingStatus,
          b.paymentStatus,
          b.totalPrice,
        ].join(",")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=smartpark-report.csv");
    res.send(header + rows);
  } catch (e) {
    next(e);
  }
});

function csv(v: string) {
  return `"${v.replaceAll('"', '""')}"`;
}
