import type { ParkingSpot, PricingConfig, SpotType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type PriceBreakdown = {
  hours: number;
  basePrice: number;
  multiplier: number;
  discountApplied: number;
  total: number;
  lines: { label: string; amount: number }[];
};

export type Tier = { maxHours: number; rate: number };

export async function getPricingForGround(parkingGroundId: string) {
  const specific = await prisma.pricingConfig.findUnique({ where: { parkingGroundId } });
  if (specific) return specific;
  const fallback = await prisma.pricingConfig.findFirst({ where: { isDefault: true } });
  if (!fallback) throw Object.assign(new Error("Pricing is not configured"), { status: 500 });
  return fallback;
}

export function calculatePrice(opts: {
  hours: number;
  config: PricingConfig;
  spotType: SpotType;
  isStudent?: boolean;
  at?: Date;
}): PriceBreakdown {
  const { hours, config, spotType, isStudent = true, at = new Date() } = opts;
  const tiers = (config.tieredPricing as Tier[]) || [];
  const lines: { label: string; amount: number }[] = [];
  let remaining = hours;
  let billedHours = hours;
  let startHour = 0;

  if (config.firstHourFree && hours > 0) {
    lines.push({ label: "First hour", amount: 0 });
    remaining = Math.max(0, hours - 1);
    startHour = 1;
  }

  let base = 0;
  if (tiers.length) {
    const sorted = [...tiers].sort((a, b) => a.maxHours - b.maxHours);
    let prev = startHour;
    for (const tier of sorted) {
      if (remaining <= 0) break;
      const span = Math.min(remaining, Math.max(0, tier.maxHours - prev));
      if (span > 0) {
        const amt = span * tier.rate;
        base += amt;
        lines.push({ label: `Hours ${prev}-${prev + span} @ $${tier.rate.toFixed(2)}`, amount: amt });
        remaining -= span;
        prev = tier.maxHours;
      }
    }
    if (remaining > 0) {
      const amt = remaining * config.baseHourlyRate;
      base += amt;
      lines.push({ label: `Remaining ${remaining}h @ $${config.baseHourlyRate.toFixed(2)}`, amount: amt });
    }
  } else {
    const amt = remaining * config.baseHourlyRate;
    base += amt;
    lines.push({ label: `${billedHours}h @ $${config.baseHourlyRate.toFixed(2)}/hr`, amount: amt });
  }

  let multiplier = 1;
  if (spotType === "PREMIUM") multiplier *= config.premiumMultiplier;
  if (spotType === "EV_CHARGING") multiplier *= config.evMultiplier;
  if (multiplier !== 1) lines.push({ label: "Spot type multiplier", amount: base * (multiplier - 1) });

  let subtotal = base * multiplier;

  const day = at.getDay();
  const isWeekend = day === 0 || day === 6;
  if (isWeekend && config.weekendRateMultiplier !== 1) {
    const before = subtotal;
    subtotal *= config.weekendRateMultiplier;
    lines.push({ label: "Weekend rate", amount: subtotal - before });
  }

  const hour = at.getHours();
  if (hour >= config.eveningStartHour && config.eveningRateMultiplier !== 1) {
    const before = subtotal;
    subtotal *= config.eveningRateMultiplier;
    lines.push({ label: "Evening rate", amount: subtotal - before });
  }

  let discount = 0;
  if (isStudent && config.studentDiscount > 0) {
    discount = subtotal * config.studentDiscount;
    lines.push({ label: "Student discount", amount: -discount });
  }

  let total = Math.max(0, subtotal - discount);
  if (config.dailyMaxCap > 0 && total > config.dailyMaxCap) {
    lines.push({ label: "Daily maximum cap", amount: config.dailyMaxCap - total });
    total = config.dailyMaxCap;
  }

  return {
    hours,
    basePrice: Number(base.toFixed(2)),
    multiplier,
    discountApplied: Number(discount.toFixed(2)),
    total: Number(total.toFixed(2)),
    lines,
  };
}

export function compatibleTypes(vehicleType: string): SpotType[] {
  switch (vehicleType) {
    case "MOTORCYCLE":
      return ["MOTORCYCLE", "COMPACT", "STANDARD"];
    case "EV":
      return ["EV_CHARGING", "STANDARD", "PREMIUM", "COMPACT", "ACCESSIBLE"];
    case "TRUCK":
      return ["STANDARD", "PREMIUM", "ACCESSIBLE"];
    default:
      return ["STANDARD", "COMPACT", "PREMIUM", "EV_CHARGING", "ACCESSIBLE"];
  }
}

export function typeMatchScore(vehicleType: string, spot: ParkingSpot) {
  if (vehicleType === "MOTORCYCLE") {
    if (spot.spotType === "MOTORCYCLE") return 0;
    if (spot.spotType === "COMPACT") return 2;
    return 4;
  }
  if (vehicleType === "EV") {
    if (spot.spotType === "EV_CHARGING") return 0;
    return 2;
  }
  if (spot.spotType === "MOTORCYCLE") return Number.POSITIVE_INFINITY;
  if (spot.spotType === "STANDARD" || spot.spotType === "PREMIUM") return 0;
  if (spot.spotType === "COMPACT") return 1;
  return 2;
}
