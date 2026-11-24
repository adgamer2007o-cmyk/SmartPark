import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../lib/api";
import type { Booking } from "../lib/types";
import { useAuth } from "../store/auth";
import { Badge, Button, Card } from "../components/ui";
import { Countdown } from "../components/Countdown";

export default function Dashboard() {
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  useEffect(() => {
    http.get<{ booking: Booking | null }>("/api/bookings/active").then((r) => setBooking(r.booking));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hello, {user?.name.split(" ")[0]}</h1>
        <p className="text-muted">Scan at the entrance to get a spot in seconds.</p>
      </div>
      {!user?.vehicles?.length ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="font-semibold">Add a vehicle to start parking</p>
          <p className="text-sm text-muted">License plate and type help us assign a compatible spot.</p>
          <Link to="/profile">
            <Button className="mt-3">Add vehicle</Button>
          </Link>
        </Card>
      ) : null}
      {booking ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge tone="green">Active session</Badge>
              <p className="mt-2 text-xl font-bold">Spot {booking.spot.spotNumber}</p>
              <p className="text-sm text-muted">
                {booking.parkingGround.name} · {booking.spot.level} · {booking.spot.row}
              </p>
            </div>
            <Countdown end={booking.endTime} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/extend-booking?id=${booking.id}`}>
              <Button>Extend</Button>
            </Link>
            <Link to={`/booking-confirmation?id=${booking.id}`}>
              <Button variant="secondary">Ticket</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="font-semibold">No active parking session</p>
          <p className="text-sm text-muted">When you arrive, scan the entrance QR at the gate.</p>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/scan">
          <Button className="h-16 w-full text-base">Scan to Park</Button>
        </Link>
        <Link to="/my-bookings">
          <Button variant="secondary" className="h-16 w-full text-base">
            Book in advance
          </Button>
        </Link>
      </div>
    </div>
  );
}
