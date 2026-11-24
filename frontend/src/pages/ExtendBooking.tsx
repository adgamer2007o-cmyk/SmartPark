import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { http } from "../lib/api";
import type { Booking, PriceBreakdown } from "../lib/types";
import { Button, Card } from "../components/ui";

export default function ExtendBooking() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const id = params.get("id");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [hours, setHours] = useState(1);
  const [price, setPrice] = useState<PriceBreakdown | null>(null);

  useEffect(() => {
    if (!id) return;
    http.get<{ booking: Booking }>(`/api/bookings/${id}`).then((r) => setBooking(r.booking));
  }, [id]);

  useEffect(() => {
    if (!booking) return;
    http
      .post<{ breakdown: PriceBreakdown }>("/api/price-preview", {
        parkingGroundId: booking.parkingGroundId || booking.parkingGround.id,
        spotType: booking.spot.spotType,
        hours,
      })
      .then((r) => setPrice(r.breakdown));
  }, [hours, booking]);

  async function pay() {
    if (!id) return;
    await http.post(`/api/bookings/${id}/extend`, { extraHours: hours, mockPaid: true });
    nav(`/booking-confirmation?id=${id}`);
  }

  if (!booking) return <p>Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Extend session</h1>
      <p className="text-muted">
        Current expiry {new Date(booking.endTime).toLocaleString()} at {booking.spot.spotNumber}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 4].map((h) => (
          <Button key={h} variant={hours === h ? "primary" : "secondary"} onClick={() => setHours(h)}>
            +{h}h
          </Button>
        ))}
      </div>
      {price ? <p className="text-lg font-semibold">Additional ${price.total.toFixed(2)}</p> : null}
      <Button className="w-full" onClick={pay}>
        Pay & extend
      </Button>
    </div>
  );
}
