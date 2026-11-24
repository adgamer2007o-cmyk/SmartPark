import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { http } from "../../lib/api";
import { Card } from "../../components/ui";

type Stats = {
  totalSpots: number;
  occupied: number;
  available: number;
  revenueToday: number;
  bookingsToday: number;
  occupancy: { id: string; name: string; total: number; occupied: number; available: number }[];
  recent: { id: string; totalPrice: number; user: { name: string }; parkingGround: { name: string }; spot: { spotNumber: string } }[];
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    http.get<Stats>("/api/admin/stats").then(setStats);
  }, []);
  if (!stats) return <p>Loading dashboard…</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Operations overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total spots" value={stats.totalSpots} />
        <Kpi label="Occupied" value={stats.occupied} />
        <Kpi label="Available" value={stats.available} />
        <Kpi label="Revenue today" value={`$${stats.revenueToday.toFixed(2)}`} />
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Occupancy by lot</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={stats.occupancy}>
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="occupied" fill="#1a56db" />
              <Bar dataKey="available" fill="#0d9488" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <div className="mb-3 flex justify-between">
          <h2 className="font-semibold">Recent bookings</h2>
          <Link to="/admin/bookings" className="text-sm text-primary">
            View all
          </Link>
        </div>
        <ul className="divide-y text-sm">
          {stats.recent.map((b) => (
            <li key={b.id} className="flex justify-between py-2">
              <span>
                {b.user.name} · {b.parkingGround.name} {b.spot.spotNumber}
              </span>
              <span>${b.totalPrice.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}
