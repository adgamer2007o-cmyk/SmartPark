import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, type SpotType, type SpotStatus, type BookingStatus, type PaymentStatus } from "@prisma/client";
import { qrPayload } from "../src/lib/qr.js";

const prisma = new PrismaClient();

type GroundSeed = {
  name: string;
  location: string;
  description: string;
  hours: { open: string; close: string };
  rows: number;
  cols: number;
  level: string;
};

const GROUNDS: GroundSeed[] = [
  {
    name: "North Campus Lot",
    location: "100 University Ave, North Campus",
    description: "Primary student lot with EV charging near Entrance A.",
    hours: { open: "06:00", close: "23:00" },
    rows: 8,
    cols: 10,
    level: "Ground Floor",
  },
  {
    name: "Engineering Building Garage",
    location: "240 Engineering Way",
    description: "Covered garage attached to the Engineering complex.",
    hours: { open: "05:30", close: "22:00" },
    rows: 6,
    cols: 10,
    level: "Level 1",
  },
  {
    name: "Library Lot",
    location: "50 Scholars Lane",
    description: "Visitor-friendly lot beside the main library.",
    hours: { open: "07:00", close: "21:00" },
    rows: 5,
    cols: 10,
    level: "Ground Floor",
  },
];

function spotTypeFor(r: number, c: number, rows: number, cols: number): SpotType {
  if (c === 1 && r < 2) return "ACCESSIBLE";
  if (r === 0 && c <= 3) return "EV_CHARGING";
  if (r === rows - 1) return "MOTORCYCLE";
  if (c <= 2) return "PREMIUM";
  if (c > cols - 2) return "COMPACT";
  return "STANDARD";
}

async function main() {
  await prisma.booking.deleteMany();
  await prisma.spotPreference.deleteMany();
  await prisma.favoriteGround.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.parkingSpot.deleteMany();
  await prisma.pricingConfig.deleteMany();
  await prisma.parkingGround.deleteMany();
  await prisma.algorithmConfig.deleteMany();
  await prisma.systemSettings.deleteMany();
  await prisma.user.deleteMany();

  const adminHash = await bcrypt.hash("admin123", 12);
  const studentHash = await bcrypt.hash("student123", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@smartpark.com",
      password: adminHash,
      name: "SmartPark Admin",
      role: "ADMIN",
      phone: "555-0100",
    },
  });

  const student = await prisma.user.create({
    data: {
      email: "student@smartpark.com",
      password: studentHash,
      name: "Alex Rivera",
      role: "USER",
      phone: "555-0101",
      accessibility: false,
      vehicles: {
        create: [
          { licensePlate: "CAMP-442", vehicleType: "CAR", isDefault: true },
          { licensePlate: "EV-991", vehicleType: "EV", isDefault: false },
        ],
      },
    },
    include: { vehicles: true },
  });

  const student2 = await prisma.user.create({
    data: {
      email: "faculty@smartpark.com",
      password: studentHash,
      name: "Jordan Lee",
      role: "USER",
      phone: "555-0102",
      vehicles: {
        create: [{ licensePlate: "FAC-118", vehicleType: "CAR", isDefault: true }],
      },
    },
    include: { vehicles: true },
  });

  await prisma.algorithmConfig.create({ data: {} });
  await prisma.systemSettings.create({ data: {} });

  const defaultPricing = await prisma.pricingConfig.create({
    data: {
      isDefault: true,
      baseHourlyRate: 1.5,
      firstHourFree: true,
      tieredPricing: [
        { maxHours: 2, rate: 1.5 },
        { maxHours: 4, rate: 1.25 },
        { maxHours: 8, rate: 1.0 },
      ],
      dailyMaxCap: 15,
      studentDiscount: 0.1,
      premiumMultiplier: 1.5,
      evMultiplier: 1.25,
      weekendRateMultiplier: 0.8,
    },
  });

  const createdGrounds = [];
  for (const g of GROUNDS) {
    const ground = await prisma.parkingGround.create({
      data: {
        name: g.name,
        location: g.location,
        description: g.description,
        totalCapacity: g.rows * g.cols,
        operatingHours: JSON.stringify(g.hours),
        layoutRows: g.rows,
        layoutCols: g.cols,
      },
    });
    await prisma.parkingGround.update({
      where: { id: ground.id },
      data: {
        entranceQRCode: qrPayload("ENTRANCE", ground.id),
        exitQRCode: qrPayload("EXIT", ground.id),
      },
    });
    const spots = [];
    for (let r = 0; r < g.rows; r++) {
      const letter = String.fromCharCode(65 + r);
      for (let c = 1; c <= g.cols; c++) {
        const type = spotTypeFor(r, c, g.rows, g.cols);
        const distance = Number((Math.sqrt(r * r + (c - 1) * (c - 1)) * 4.5).toFixed(1));
        spots.push({
          parkingGroundId: ground.id,
          spotNumber: `${letter}-${c}`,
          level: g.level,
          row: `Row ${letter}`,
          col: c,
          spotType: type,
          isAccessible: type === "ACCESSIBLE",
          distanceToEntrance: distance,
          status: "AVAILABLE" as SpotStatus,
        });
      }
    }
    await prisma.parkingSpot.createMany({ data: spots });
    const createdSpots = await prisma.parkingSpot.findMany({ where: { parkingGroundId: ground.id } });
    for (const s of createdSpots) {
      await prisma.parkingSpot.update({ where: { id: s.id }, data: { qrCode: qrPayload("SPOT", s.id) } });
    }
    createdGrounds.push(ground);
    if (g.name === "Engineering Building Garage") {
      await prisma.pricingConfig.create({
        data: {
          parkingGroundId: ground.id,
          isDefault: false,
          baseHourlyRate: 2.0,
          firstHourFree: false,
          tieredPricing: [
            { maxHours: 2, rate: 2.0 },
            { maxHours: 4, rate: 1.75 },
          ],
          dailyMaxCap: 18,
          studentDiscount: 0.15,
          premiumMultiplier: 1.6,
          evMultiplier: 1.3,
          weekendRateMultiplier: 0.85,
        },
      });
    }
  }

  await prisma.favoriteGround.create({
    data: { userId: student.id, parkingGroundId: createdGrounds[0].id },
  });

  const allSpots = await prisma.parkingSpot.findMany();
  const car = student.vehicles.find((v) => v.vehicleType === "CAR")!;
  const ev = student.vehicles.find((v) => v.vehicleType === "EV")!;
  const facCar = student2.vehicles[0];

  const now = Date.now();
  const samples: {
    userId: string;
    vehicleId: string;
    hoursAgo: number;
    duration: number;
    status: BookingStatus;
    payment: PaymentStatus;
    occupy: boolean;
  }[] = [
    { userId: student.id, vehicleId: car.id, hoursAgo: 1, duration: 3, status: "ACTIVE", payment: "PAID", occupy: true },
    { userId: student2.id, vehicleId: facCar.id, hoursAgo: 26, duration: 2, status: "COMPLETED", payment: "PAID", occupy: false },
    { userId: student.id, vehicleId: ev.id, hoursAgo: 50, duration: 4, status: "COMPLETED", payment: "PAID", occupy: false },
    { userId: student.id, vehicleId: car.id, hoursAgo: 80, duration: 1, status: "COMPLETED", payment: "PAID", occupy: false },
    { userId: student2.id, vehicleId: facCar.id, hoursAgo: 120, duration: 8, status: "COMPLETED", payment: "PAID", occupy: false },
    { userId: student.id, vehicleId: car.id, hoursAgo: -24, duration: 2, status: "ACTIVE", payment: "PAID", occupy: false },
  ];

  for (let i = 0; i < 18; i++) {
    samples.push({
      userId: i % 2 === 0 ? student.id : student2.id,
      vehicleId: i % 2 === 0 ? car.id : facCar.id,
      hoursAgo: 8 + i * 11,
      duration: 1 + (i % 5),
      status: "COMPLETED",
      payment: "PAID",
      occupy: false,
    });
  }

  for (const [i, s] of samples.entries()) {
    const spot = allSpots[(i * 7) % allSpots.length];
    const start = new Date(now - s.hoursAgo * 3600_000);
    const end = new Date(start.getTime() + s.duration * 3600_000);
    const created = await prisma.booking.create({
      data: {
        userId: s.userId,
        vehicleId: s.vehicleId,
        parkingGroundId: spot.parkingGroundId,
        spotId: spot.id,
        startTime: start,
        endTime: end,
        actualEndTime: s.status === "COMPLETED" ? end : null,
        durationHours: s.duration,
        basePrice: 1.5 * s.duration,
        totalPrice: Number((Math.min(15, 1.5 * s.duration * 0.9)).toFixed(2)),
        discountApplied: 0.15 * s.duration,
        paymentStatus: s.payment,
        bookingStatus: s.status,
        qrCodeData: "pending",
      },
    });
    await prisma.booking.update({
      where: { id: created.id },
      data: { qrCodeData: qrPayload("TICKET", created.id) },
    });
    if (s.occupy) {
      await prisma.parkingSpot.update({ where: { id: spot.id }, data: { status: "OCCUPIED" } });
    }
  }

  const some = allSpots.filter((_, i) => i % 17 === 0).slice(0, 6);
  for (const s of some) {
    await prisma.parkingSpot.update({ where: { id: s.id }, data: { status: "MAINTENANCE" } });
  }

  console.log("Seed complete");
  console.log("Admin: admin@smartpark.com / admin123");
  console.log("Student: student@smartpark.com / student123");
  console.log("Faculty: faculty@smartpark.com / student123");
  console.log("Default pricing id:", defaultPricing.id);
  console.log("Admin user:", admin.email);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
