import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { authRouter } from "./routes/auth.js";
import { groundsRouter } from "./routes/grounds.js";
import { spotsRouter } from "./routes/spots.js";
import { assignRouter } from "./routes/assign.js";
import { bookingsRouter, paymentsRouter, stripeWebhookHandler } from "./routes/bookings.js";
import { adminRouter } from "./routes/admin.js";
import { vehiclesRouter, favoritesRouter } from "./routes/vehicles.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { blockIfMaintenance, csrfGuard } from "./middleware/security.js";
import { openApiSpec } from "./lib/openapi.js";
import { prisma } from "./lib/prisma.js";

const app = express();
const client = process.env.CLIENT_URL || "http://localhost:5173";

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: client, credentials: true }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.post("/api/payments/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
app.use(express.json({ limit: "1mb" }));
app.use(csrfGuard);

const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a minute." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api", blockIfMaintenance);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/grounds", groundsRouter);
app.use("/api", spotsRouter);
app.use("/api", assignRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/favorites", favoritesRouter);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 4000);

async function expireStale() {
  const now = new Date();
  const expired = await prisma.booking.findMany({
    where: { bookingStatus: { in: ["ACTIVE", "EXTENDED"] }, endTime: { lt: now } },
  });
  for (const b of expired) {
    await prisma.booking.update({ where: { id: b.id }, data: { bookingStatus: "EXPIRED" } });
    await prisma.parkingSpot.update({
      where: { id: b.spotId },
      data: { status: "AVAILABLE", reservedUntil: null, reservedByUserId: null },
    });
  }
  await prisma.parkingSpot.updateMany({
    where: { status: "RESERVED", reservedUntil: { lt: now } },
    data: { status: "AVAILABLE", reservedUntil: null, reservedByUserId: null },
  });
}

setInterval(() => {
  expireStale().catch((e) => console.warn("expire job", e));
}, 60_000);

app.listen(port, () => {
  console.log(`SmartPark API listening on http://localhost:${port}`);
  console.log(`API docs: http://localhost:${port}/api/docs`);
});
