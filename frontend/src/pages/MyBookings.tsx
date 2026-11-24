import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../lib/api";
import type { Booking, ParkingGround } from "../lib/types";
import { Badge, Button, Card, FieldSelect, Input } from "../components/ui";
import { useAuth } from "../store/auth";
import { useParkFlow } from "../store/flow";
import { useNavigate } from "react-router-dom";

export default function MyBookings() {
  const [items, setItems] = useState<Booking[]>([]);
  const [filter, setFilter] = useState("all");
  const [grounds, setGrounds] = useState<ParkingGround[]>([]);
  const { user } = useAuth();
  const flow = useParkFlow();
  const nav = useNavigate();

  useEffect(() => {
    http.get<{ items: Booking[] }>("/api/bookings").then((r) => setItems(r.items));
    http.get<{ grounds: ParkingGround[] }>("/api/grounds").then((r) => setGrounds(r.grounds));
  }, []);

  const shown = items.filter((b) => {
    if (filter === "all") return true;
    if (filter === "active") return ["ACTIVE", "EXTENDED"].includes(b.bookingStatus);
    if (filter === "upcoming") return new Date(b.startTime) > new Date();
    return ["COMPLETED", "CANCELLED", "EXPIRED"].includes(b.bookingStatus);
  });

  async function reserve(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ground = grounds.find((g) => g.id === fd.get("groundId"));
    const details = await http.get<{ ground: ParkingGround }>(`/api/grounds/${ground?.id}`);
    const spot = details.ground.spots?.find((s) => s.status === "AVAILABLE");
    if (!ground || !spot || !user?.vehicles[0]) return;
    flow.set({
      ground,
      selectedSpot: spot,
      vehicle: user.vehicles[0],
      hours: Number(fd.get("hours")),
    });
    nav("/payment");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My bookings</h1>
      <Card>
        <h2 className="font-semibold">Book in advance</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-4" onSubmit={reserve}>
          <FieldSelect label="Lot" name="groundId">
            {grounds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </FieldSelect>
          <Input label="Start" name="start" type="datetime-local" required />
          <Input label="Hours" name="hours" type="number" defaultValue={2} min={1} />
          <Button className="self-end">Continue to pay</Button>
        </form>
      </Card>
      <div className="flex gap-2">
        {["all", "active", "upcoming", "past"].map((f) => (
          <Button key={f} variant={filter === f ? "primary" : "secondary"} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>
      <div className="space-y-3">
        {shown.map((b) => (
          <Card key={b.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">
                  {b.parkingGround.name} · {b.spot.spotNumber}
                </p>
                <p className="text-sm text-muted">
                  {new Date(b.startTime).toLocaleString()} – {new Date(b.endTime).toLocaleString()}
                </p>
                <p className="text-sm">${b.totalPrice.toFixed(2)}</p>
              </div>
              <Badge tone={b.bookingStatus === "ACTIVE" ? "green" : "gray"}>{b.bookingStatus}</Badge>
            </div>
            <Link to={`/booking-confirmation?id=${b.id}`} className="mt-2 inline-block text-sm text-primary">
              View ticket
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
