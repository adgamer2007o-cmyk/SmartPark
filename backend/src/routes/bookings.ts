import { Router } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { qrPayload, toDataUrl } from "../lib/qr.js";
import { bookingConfirmationEmail, receiptEmail } from "../lib/mailer.js";
import { calculatePrice, getPricingForGround } from "../services/pricing.js";
import { param } from "../lib/params.js";

export const bookingsRouter = Router();

const createSchema = z.object({
  parkingGroundId: z.string(),
  spotId: z.string(),
  vehicleId: z.string(),
  durationHours: z.number().positive(),
  startTime: z.string().datetime().optional(),
  stripePaymentId: z.string().optional(),
  mockPaid: z.boolean().optional(),
});

bookingsRouter.post("/", requireAuth, validate(createSchema), async (req: AuthedRequest, res, next) => {
  try {
    const { parkingGroundId, spotId, vehicleId, durationHours, stripePaymentId, mockPaid } = req.body;
    const startTime = req.body.startTime ? new Date(req.body.startTime) : new Date();
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, userId: req.user!.id } });
    if (!vehicle) return res.status(400).json({ error: "Vehicle not found" });

    const isFuture = startTime.getTime() - Date.now() > 5 * 60 * 1000;

    const booking = await prisma.$transaction(async (tx) => {
      const spot = await tx.parkingSpot.findUnique({ where: { id: spotId } });
      if (!spot) throw Object.assign(new Error("Spot not found"), { status: 404 });
      const canUse =
        spot.reservedByUserId === req.user!.id ||
        spot.status === "AVAILABLE" ||
        (isFuture && spot.status !== "MAINTENANCE");
      if (!canUse && !isFuture) throw Object.assign(new Error("Spot is no longer available"), { status: 409 });

      const overlap = await tx.booking.findFirst({
        where: {
          spotId,
          bookingStatus: { in: ["ACTIVE", "EXTENDED"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (overlap) throw Object.assign(new Error("Spot already booked for that time"), { status: 409 });

      const config = await getPricingForGround(parkingGroundId);
      const price = calculatePrice({
        hours: durationHours,
        config,
        spotType: spot.spotType,
        isStudent: true,
        at: startTime,
      });

      const created = await tx.booking.create({
        data: {
          userId: req.user!.id,
          vehicleId,
          parkingGroundId,
          spotId,
          startTime,
          endTime,
          durationHours,
          basePrice: price.basePrice,
          totalPrice: price.total,
          discountApplied: price.discountApplied,
          paymentStatus: mockPaid || stripePaymentId ? "PAID" : "PENDING",
          bookingStatus: "ACTIVE",
          stripePaymentId,
          qrCodeData: "pending",
        },
      });
      const ticket = qrPayload("TICKET", created.id);
      const updated = await tx.booking.update({
        where: { id: created.id },
        data: { qrCodeData: ticket },
        include: { spot: true, parkingGround: true, vehicle: true },
      });
      if (!isFuture) {
        await tx.parkingSpot.update({
          where: { id: spotId },
          data: { status: "OCCUPIED", reservedUntil: null, reservedByUserId: null },
        });
      }
      await tx.spotPreference.upsert({
        where: { userId_spotId: { userId: req.user!.id, spotId } },
        create: { userId: req.user!.id, spotId, useCount: 1 },
        update: { useCount: { increment: 1 } },
      });
      return { booking: updated, price };
    });

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (user?.notifyEmail) {
      await bookingConfirmationEmail(user.email, {
        ground: booking.booking.parkingGround.name,
        spot: booking.booking.spot.spotNumber,
        start: booking.booking.startTime,
        end: booking.booking.endTime,
        total: booking.booking.totalPrice,
      });
      if (booking.booking.paymentStatus === "PAID") {
        await receiptEmail(user.email, booking.booking.totalPrice, booking.booking.parkingGround.name);
      }
    }
    res.status(201).json(booking);
  } catch (e) {
    next(e);
  }
});

bookingsRouter.get("/active", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { userId: req.user!.id, bookingStatus: { in: ["ACTIVE", "EXTENDED"] }, startTime: { lte: new Date() }, endTime: { gte: new Date() } },
      include: { spot: true, parkingGround: true, vehicle: true },
      orderBy: { startTime: "desc" },
    });
    res.json({ booking });
  } catch (e) {
    next(e);
  }
});

bookingsRouter.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const take = 20;
    const status = req.query.status as string | undefined;
    const where = {
      userId: req.user!.id,
      ...(status ? { bookingStatus: status as never } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { spot: true, parkingGround: true, vehicle: true },
        orderBy: { startTime: "desc" },
        skip: (page - 1) * take,
        take,
      }),
      prisma.booking.count({ where }),
    ]);
    res.json({ items, total, page });
  } catch (e) {
    next(e);
  }
});

bookingsRouter.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: param(req) },
      include: { spot: true, parkingGround: true, vehicle: true },
    });
    if (!booking) return res.status(404).json({ error: "Not found" });
    if (booking.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({ booking });
  } catch (e) {
    next(e);
  }
});

bookingsRouter.get("/:id/ticket", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: param(req) },
      include: { spot: true, parkingGround: true, vehicle: true },
    });
    if (!booking) return res.status(404).json({ error: "Not found" });
    if (booking.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({ booking, qr: await toDataUrl(booking.qrCodeData) });
  } catch (e) {
    next(e);
  }
});

bookingsRouter.post(
  "/:id/extend",
  requireAuth,
  validate(z.object({ extraHours: z.number().positive(), stripePaymentId: z.string().optional(), mockPaid: z.boolean().optional() })),
  async (req: AuthedRequest, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: param(req) },
        include: { spot: true },
      });
      if (!booking || booking.userId !== req.user!.id) return res.status(404).json({ error: "Not found" });
      const extra = req.body.extraHours as number;
      const config = await getPricingForGround(booking.parkingGroundId);
      const price = calculatePrice({
        hours: extra,
        config,
        spotType: booking.spot.spotType,
        isStudent: true,
      });
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          endTime: new Date(booking.endTime.getTime() + extra * 60 * 60 * 1000),
          durationHours: booking.durationHours + extra,
          totalPrice: booking.totalPrice + price.total,
          bookingStatus: "EXTENDED",
          paymentStatus: req.body.mockPaid || req.body.stripePaymentId ? "PAID" : booking.paymentStatus,
        },
        include: { spot: true, parkingGround: true, vehicle: true },
      });
      res.json({ booking: updated, extra: price });
    } catch (e) {
      next(e);
    }
  }
);

bookingsRouter.post("/:id/cancel", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: param(req) } });
    if (!booking) return res.status(404).json({ error: "Not found" });
    if (booking.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { bookingStatus: "CANCELLED", paymentStatus: "CANCELLED" },
    });
    await prisma.parkingSpot.update({
      where: { id: booking.spotId },
      data: { status: "AVAILABLE", reservedUntil: null, reservedByUserId: null },
    });
    res.json({ booking: updated });
  } catch (e) {
    next(e);
  }
});

bookingsRouter.post("/:id/complete", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: param(req) } });
    if (!booking) return res.status(404).json({ error: "Not found" });
    if (booking.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (booking.endTime < new Date() && booking.paymentStatus !== "PAID") {
      return res.status(402).json({ error: "Session expired. Please pay the extension first." });
    }
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        bookingStatus: "COMPLETED",
        actualEndTime: new Date(),
      },
      include: { spot: true, parkingGround: true },
    });
    await prisma.parkingSpot.update({
      where: { id: booking.spotId },
      data: { status: "AVAILABLE", reservedUntil: null, reservedByUserId: null },
    });
    res.json({ booking: updated });
  } catch (e) {
    next(e);
  }
});

export const paymentsRouter = Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

paymentsRouter.post(
  "/create-intent",
  requireAuth,
  validate(z.object({ amount: z.number().positive(), currency: z.string().default("usd"), metadata: z.record(z.string()).optional() })),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!stripe) {
        return res.json({ mock: true, clientSecret: null, amount: req.body.amount });
      }
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(req.body.amount * 100),
        currency: req.body.currency || "usd",
        metadata: { userId: req.user!.id, ...(req.body.metadata || {}) },
        customer: user?.stripeCustomerId || undefined,
        automatic_payment_methods: { enabled: true },
      });
      res.json({ clientSecret: intent.client_secret, mock: false });
    } catch (e) {
      next(e);
    }
  }
);

paymentsRouter.post("/confirm", requireAuth, async (req, res) => {
  res.json({ ok: true });
});

paymentsRouter.post(
  "/refund",
  requireAuth,
  requireRole("ADMIN"),
  validate(z.object({ bookingId: z.string() })),
  async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.body.bookingId } });
      if (!booking) return res.status(404).json({ error: "Not found" });
      if (stripe && booking.stripePaymentId) {
        await stripe.refunds.create({ payment_intent: booking.stripePaymentId });
      }
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: "REFUNDED" },
      });
      res.json({ booking: updated });
    } catch (e) {
      next(e);
    }
  }
);

export async function stripeWebhookHandler(req: import("express").Request, res: import("express").Response) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.json({ received: true, skipped: true });
  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") return res.status(400).send("No signature");
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      await prisma.booking.updateMany({
        where: { stripePaymentId: pi.id },
        data: { paymentStatus: "PAID" },
      });
    }
    res.json({ received: true });
  } catch {
    res.status(400).send("Invalid signature");
  }
}
