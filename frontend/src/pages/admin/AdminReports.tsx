import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { http } from "../../lib/api";
import { Button, Card, Input } from "../../components/ui";

export default function AdminReports() {
  const [from, setFrom] = useState(new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<{ day: string; revenue: number }[]>([]);
  const [hours, setHours] = useState<{ hour: number; count: number }[]>([]);

  async function load() {
    const r = await http.get<{ byDay: Record<string, number>; byHour: Record<string, number> }>(
      `/api/admin/revenue?from=${from}&to=${to}`
    );
    setData(Object.entries(r.byDay).map(([day, revenue]) => ({ day, revenue })));
    setHours(Object.entries(r.byHour).map(([hour, count]) => ({ hour: Number(hour), count })));
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="flex flex-wrap gap-3">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button className="self-end" onClick={load}>
          Refresh
        </Button>
        <a className="self-end" href={`/api/admin/reports/export?from=${from}&to=${to}`}>
          <Button type="button" variant="secondary">
            Export CSV
          </Button>
        </a>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Revenue</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={data}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line dataKey="revenue" stroke="#1a56db" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Peak hours heatmap</h2>
        <div className="grid grid-cols-6 gap-2 md:grid-cols-12">
          {Array.from({ length: 24 }).map((_, h) => {
            const count = hours.find((x) => x.hour === h)?.count || 0;
            const max = Math.max(...hours.map((x) => x.count), 1);
            const bg = `rgba(26,86,219,${0.15 + (count / max) * 0.85})`;
            return (
              <div key={h} className="rounded-md p-2 text-center text-xs text-white" style={{ background: bg }}>
                {h}:00
                <div>{count}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
