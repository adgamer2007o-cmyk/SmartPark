import { useEffect, useState } from "react";
import { http } from "../../lib/api";
import type { Booking } from "../../lib/types";
import { Badge, Button, Card } from "../../components/ui";

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  async function load() {
    const r = await http.get<{ bookings: Booking[] }>("/api/admin/bookings");
    setBookings(r.bookings);
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">All bookings</h1>
      <div className="space-y-2">
        {bookings.map((b) => (
          <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {b.user?.name} · {b.parkingGround.name} {b.spot.spotNumber}
              </p>
              <p className="text-sm text-muted">{new Date(b.startTime).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{b.bookingStatus}</Badge>
              {["ACTIVE", "EXTENDED"].includes(b.bookingStatus) ? (
                <Button
                  variant="danger"
                  onClick={async () => {
                    await http.post(`/api/bookings/${b.id}/cancel`);
                    load();
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
