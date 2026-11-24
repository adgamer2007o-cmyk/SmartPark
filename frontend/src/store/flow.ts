import { create } from "zustand";
import type { Assignment, ParkingGround, ParkingSpot, Vehicle } from "../lib/types";

type Flow = {
  ground: ParkingGround | null;
  vehicle: Vehicle | null;
  assignment: Assignment | null;
  selectedSpot: ParkingSpot | null;
  hours: number;
  bookingId: string | null;
  set: (p: Partial<Flow>) => void;
  reset: () => void;
};

export const useParkFlow = create<Flow>((set) => ({
  ground: null,
  vehicle: null,
  assignment: null,
  selectedSpot: null,
  hours: 2,
  bookingId: null,
  set: (p) => set(p),
  reset: () =>
    set({ ground: null, vehicle: null, assignment: null, selectedSpot: null, hours: 2, bookingId: null }),
}));
