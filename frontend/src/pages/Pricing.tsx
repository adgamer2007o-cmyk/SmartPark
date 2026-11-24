import { useEffect, useState } from "react";
import { http } from "../lib/api";
import type { ParkingGround } from "../lib/types";
import { Card } from "../components/ui";

export default function Pricing() {
  const [grounds, setGrounds] = useState<ParkingGround[]>([]);
  useEffect(() => {
    http.get<{ grounds: ParkingGround[] }>("/api/grounds").then((r) => setGrounds(r.grounds));
  }, []);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Campus parking rates</h1>
      <p className="mt-2 text-muted">Students receive 10% off. First hour is free at most lots. Daily cap applies.</p>
      <div className="mt-8 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg">
            <tr>
              <th className="px-4 py-3">Lot</th>
              <th>Hours</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {grounds.map((g) => {
              const hours = (() => {
                try {
                  return JSON.parse(g.operatingHours || "{}");
                } catch {
                  return { open: "—", close: "—" };
                }
              })();
              return (
                <tr key={g.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{g.name}</div>
                    <div className="text-muted">{g.location}</div>
                  </td>
                  <td>
                    {hours.open} – {hours.close}
                  </td>
                  <td>{g.occupancy?.available} open / {g.occupancy?.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ["First hour", "Free at default lots"],
          ["Hours 1–2", "$1.50 / hour"],
          ["Daily max", "$15.00"],
        ].map(([t, d]) => (
          <Card key={t}>
            <p className="text-sm text-muted">{t}</p>
            <p className="text-xl font-semibold">{d}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
