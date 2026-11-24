import type { ParkingSpot, VehicleType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { compatibleTypes, typeMatchScore } from "./pricing.js";

export type AssignInput = {
  parkingGroundId: string;
  userId: string;
  vehicleId: string;
  vehicleType: VehicleType;
  accessibilityRequired: boolean;
  scanType: "ENTRANCE" | "SPOT" | "MANUAL";
  preferredSpotId?: string;
};

export type ScoredSpot = {
  spot: ParkingSpot;
  score: number;
  reasoning: string[];
  estimatedWalkTime: number;
};

export async function assignSpot(input: AssignInput) {
  const now = new Date();
  await prisma.parkingSpot.updateMany({
    where: { status: "RESERVED", reservedUntil: { lt: now } },
    data: { status: "AVAILABLE", reservedUntil: null, reservedByUserId: null },
  });

  const [config, spots, preferences] = await Promise.all([
    prisma.algorithmConfig.findFirst(),
    prisma.parkingSpot.findMany({
      where: {
        parkingGroundId: input.parkingGroundId,
        status: { in: ["AVAILABLE", "RESERVED"] },
        OR: [{ reservedUntil: null }, { reservedUntil: { lt: now } }, { reservedByUserId: input.userId }],
      },
    }),
    prisma.spotPreference.findMany({ where: { userId: input.userId } }),
  ]);

  const weights = config ?? {
    distanceWeight: 0.4,
    typeMatchWeight: 0.25,
    preferenceWeight: 0.15,
    accessibilityWeight: 0.2,
    congestionWeight: 0.1,
  };

  const available = spots.filter((s) => s.status === "AVAILABLE" || s.reservedByUserId === input.userId);
  const allowedTypes = compatibleTypes(input.vehicleType);
  const compatible = available.filter((s) => allowedTypes.includes(s.spotType));

  if (!compatible.length) {
    const nearby = await nearbyGrounds(input.parkingGroundId);
    return { assignedSpot: null, alternativesNearby: nearby, lotFull: true as const };
  }

  const occByRow = occupancyByRow(available, spots);
  const prefMap = new Map(preferences.map((p) => [p.spotId, p.useCount]));
  const maxDist = Math.max(...compatible.map((s) => s.distanceToEntrance), 1);
  const maxPref = Math.max(...[...prefMap.values(), 1]);

  const scored: ScoredSpot[] = compatible
    .map((spot) => {
      const typeScore = typeMatchScore(input.vehicleType, spot);
      if (!Number.isFinite(typeScore)) return null;
      const normDist = spot.distanceToEntrance / maxDist;
      const prefRaw = input.preferredSpotId === spot.id ? 5 : prefMap.get(spot.id) || 0;
      const preferenceScore = 1 - prefRaw / (maxPref + 5);
      const accessScore =
        input.accessibilityRequired && !spot.isAccessible && spot.spotType !== "ACCESSIBLE" ? 1 : 0;
      const congestion = occByRow.get(spot.row || "") || 0;

      const score =
        weights.distanceWeight * normDist +
        weights.typeMatchWeight * (typeScore / 4) +
        weights.preferenceWeight * preferenceScore +
        weights.accessibilityWeight * accessScore +
        weights.congestionWeight * congestion;

      const reasoning: string[] = [];
      if (normDist <= 0.25) reasoning.push(`Closest available spot to the entrance (${spot.distanceToEntrance}m)`);
      else reasoning.push(`${spot.distanceToEntrance}m from the nearest entrance`);
      if (typeScore === 0) reasoning.push(`Best match for your ${input.vehicleType.toLowerCase()}`);
      else if (input.vehicleType === "EV" && spot.spotType !== "EV_CHARGING") {
        reasoning.push("No EV charging spots free — assigned a compatible standard spot");
      }
      if (input.preferredSpotId === spot.id) reasoning.push("Matches your preferred spot");
      else if (prefRaw > 0) reasoning.push("You've used this area before");
      if (input.accessibilityRequired && (spot.isAccessible || spot.spotType === "ACCESSIBLE")) {
        reasoning.push("Accessible parking");
      }
      if (congestion > 0.7) reasoning.push("This row is busy; still the best overall score");

      const estimatedWalkTime = Math.max(1, Math.round(spot.distanceToEntrance / 80));
      return { spot, score, reasoning, estimatedWalkTime };
    })
    .filter((x): x is ScoredSpot => Boolean(x))
    .sort((a, b) => a.score - b.score);

  const best = scored[0];
  const alternatives = scored.slice(1, 4).map((s) => s.spot);

  const reserved = await prisma.$transaction(async (tx) => {
    const updated = await tx.parkingSpot.updateMany({
      where: {
        id: best.spot.id,
        OR: [{ status: "AVAILABLE" }, { reservedByUserId: input.userId }],
      },
      data: {
        status: "RESERVED",
        reservedByUserId: input.userId,
        reservedUntil: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    if (updated.count === 0) return null;
    return tx.parkingSpot.findUnique({ where: { id: best.spot.id } });
  });

  if (!reserved) {
    const err = new Error("That spot was just taken. Please try again.");
    (err as { status?: number }).status = 409;
    throw err;
  }

  return {
    assignedSpot: reserved,
    score: Number(best.score.toFixed(4)),
    reasoning: best.reasoning,
    alternativeSpots: alternatives,
    estimatedWalkTime: best.estimatedWalkTime,
    warning:
      input.vehicleType === "EV" && reserved.spotType !== "EV_CHARGING"
        ? "No EV charging spots are free. A standard spot was assigned."
        : undefined,
    lotFull: false as const,
  };
}

function occupancyByRow(available: ParkingSpot[], all: ParkingSpot[]) {
  const map = new Map<string, number>();
  const grouped = new Map<string, ParkingSpot[]>();
  for (const s of all) {
    const key = s.row || "?";
    grouped.set(key, [...(grouped.get(key) || []), s]);
  }
  for (const [row, list] of grouped) {
    const free = available.filter((s) => (s.row || "?") === row).length;
    map.set(row, 1 - free / list.length);
  }
  return map;
}

async function nearbyGrounds(excludeId: string) {
  const grounds = await prisma.parkingGround.findMany({
    where: { isActive: true, id: { not: excludeId } },
    include: { spots: { select: { status: true } } },
  });
  return grounds
    .map((g) => ({
      id: g.id,
      name: g.name,
      location: g.location,
      available: g.spots.filter((s) => s.status === "AVAILABLE").length,
    }))
    .filter((g) => g.available > 0)
    .slice(0, 3);
}
