import { useEffect, useState } from "react";
import { http } from "../../lib/api";
import { Button, Card, Input } from "../../components/ui";
import type { PriceBreakdown } from "../../lib/types";

type Config = {
  id: string;
  baseHourlyRate: number;
  firstHourFree: boolean;
  dailyMaxCap: number;
  studentDiscount: number;
  premiumMultiplier: number;
  evMultiplier: number;
  weekendRateMultiplier: number;
  eveningRateMultiplier: number;
  eveningStartHour: number;
  tieredPricing: { maxHours: number; rate: number }[];
};

export default function AdminPricing() {
  const [config, setConfig] = useState<Config | null>(null);
  const [hours, setHours] = useState(3);
  const [preview, setPreview] = useState<PriceBreakdown | null>(null);

  useEffect(() => {
    http.get<{ configs: Config[] }>("/api/admin/pricing").then((r) => setConfig(r.configs[0]));
  }, []);

  async function save() {
    if (!config) return;
    await http.put("/api/admin/pricing", config);
  }

  async function test() {
    if (!config) return;
    const r = await http.post<{ breakdown: PriceBreakdown }>("/api/admin/pricing/preview", {
      config,
      hours,
      spotType: "STANDARD",
    });
    setPreview(r.breakdown);
  }

  if (!config) return <p>Loading…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pricing</h1>
      <Card className="grid gap-3 md:grid-cols-2">
        <Input label="Base hourly rate" type="number" step="0.1" value={config.baseHourlyRate} onChange={(e) => setConfig({ ...config, baseHourlyRate: Number(e.target.value) })} />
        <Input label="Daily max" type="number" value={config.dailyMaxCap} onChange={(e) => setConfig({ ...config, dailyMaxCap: Number(e.target.value) })} />
        <Input label="Student discount (0-1)" type="number" step="0.01" value={config.studentDiscount} onChange={(e) => setConfig({ ...config, studentDiscount: Number(e.target.value) })} />
        <Input label="Premium multiplier" type="number" step="0.1" value={config.premiumMultiplier} onChange={(e) => setConfig({ ...config, premiumMultiplier: Number(e.target.value) })} />
        <Input label="EV multiplier" type="number" step="0.1" value={config.evMultiplier} onChange={(e) => setConfig({ ...config, evMultiplier: Number(e.target.value) })} />
        <Input label="Weekend multiplier" type="number" step="0.1" value={config.weekendRateMultiplier} onChange={(e) => setConfig({ ...config, weekendRateMultiplier: Number(e.target.value) })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.firstHourFree} onChange={(e) => setConfig({ ...config, firstHourFree: e.target.checked })} />
          First hour free
        </label>
      </Card>
      <Button onClick={save}>Save pricing</Button>
      <Card>
        <p className="font-semibold">Live calculator</p>
        <Input label="Hours" type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
        <Button className="mt-3" onClick={test}>
          Test price
        </Button>
        {preview ? <p className="mt-3 text-xl font-bold">${preview.total.toFixed(2)}</p> : null}
      </Card>
    </div>
  );
}
