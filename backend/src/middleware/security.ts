import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "./auth.js";

export async function blockIfMaintenance(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.path.startsWith("/api/admin") || req.path.startsWith("/api/auth")) return next();
  const settings = await prisma.systemSettings.findFirst();
  if (settings?.maintenanceMode && req.user?.role !== "ADMIN") {
    return res.status(503).json({ error: "SmartPark is in maintenance mode. Please try again shortly." });
  }
  next();
}

export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  const allowed = process.env.CLIENT_URL || "http://localhost:5173";
  if (origin && origin !== allowed && process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Invalid origin" });
  }
  next();
}
