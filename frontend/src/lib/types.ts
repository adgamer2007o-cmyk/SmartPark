export type Role = "USER" | "ADMIN";
export type VehicleType = "CAR" | "MOTORCYCLE" | "EV" | "TRUCK";
export type SpotType = "STANDARD" | "COMPACT" | "MOTORCYCLE" | "EV_CHARGING" | "ACCESSIBLE" | "PREMIUM";
export type SpotStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";

export type Vehicle = {
  id: string;
  licensePlate: string;
  vehicleType: VehicleType;
  isDefault: boolean;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  accessibility: boolean;
  isActive: boolean;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
  vehicles: Vehicle[];
  favorites?: { parkingGroundId: string }[];
};

export type ParkingSpot = {
  id: string;
  parkingGroundId: string;
  spotNumber: string;
  level?: string | null;
  row?: string | null;
  col?: number;
  spotType: SpotType;
  status: SpotStatus;
  distanceToEntrance: number;
  isAccessible: boolean;
};

export type ParkingGround = {
  id: string;
  name: string;
  location: string;
  description?: string | null;
  totalCapacity: number;
  operatingHours: string;
  isActive: boolean;
  layoutRows: number;
  layoutCols: number;
  occupancy?: { total: number; available: number; occupied: number; reserved: number; maintenance: number; rate: number };
  spots?: ParkingSpot[];
};

export type Booking = {
  id: string;
  parkingGroundId: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  totalPrice: number;
  discountApplied: number;
  paymentStatus: string;
  bookingStatus: string;
  qrCodeData: string;
  spot: ParkingSpot;
  parkingGround: ParkingGround;
  vehicle?: Vehicle;
  user?: { name: string; email: string };
};

export type Assignment = {
  assignedSpot: ParkingSpot | null;
  score?: number;
  reasoning?: string[];
  alternativeSpots?: ParkingSpot[];
  estimatedWalkTime?: number;
  warning?: string;
  lotFull?: boolean;
  alternativesNearby?: { id: string; name: string; location: string; available: number }[];
};

export type PriceBreakdown = {
  hours: number;
  basePrice: number;
  total: number;
  discountApplied: number;
  lines: { label: string; amount: number }[];
};
