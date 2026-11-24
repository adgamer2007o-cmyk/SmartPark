import { useEffect, useState } from "react";
import { http } from "../../lib/api";
import { Button, Card, Input } from "../../components/ui";

type Algo = {
  id: string;
  distanceWeight: number;
  typeMatchWeight: number;
  preferenceWeight: number;
  accessibilityWeight: number;
  congestionWeight: number;
};
type Settings = { id: string; maintenanceMode: boolean; notificationEmailEnabled: boolean; expiryWarningMinutes: number };

export default function AdminSettings() {
  const [algo, setAlgo] = useState<Algo | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    http.get<{ config: Algo }>("/api/admin/algorithm-config").then((r) => setAlgo(r.config));
    http.get<{ settings: Settings }>("/api/admin/settings").then((r) => setSettings(r.settings));
  }, []);

  if (!algo || !settings) return <p>Loading…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">System settings</h1>
      <Card className="grid gap-3 md:grid-cols-2">
        <Input label="Distance weight" type="number" step="0.05" value={algo.distanceWeight} onChange={(e) => setAlgo({ ...algo, distanceWeight: Number(e.target.value) })} />
        <Input label="Type match weight" type="number" step="0.05" value={algo.typeMatchWeight} onChange={(e) => setAlgo({ ...algo, typeMatchWeight: Number(e.target.value) })} />
        <Input label="Preference weight" type="number" step="0.05" value={algo.preferenceWeight} onChange={(e) => setAlgo({ ...algo, preferenceWeight: Number(e.target.value) })} />
        <Input label="Accessibility weight" type="number" step="0.05" value={algo.accessibilityWeight} onChange={(e) => setAlgo({ ...algo, accessibilityWeight: Number(e.target.value) })} />
        <Input label="Congestion weight" type="number" step="0.05" value={algo.congestionWeight} onChange={(e) => setAlgo({ ...algo, congestionWeight: Number(e.target.value) })} />
      </Card>
      <Button onClick={() => http.put("/api/admin/algorithm-config", algo)}>Save algorithm weights</Button>
      <Card>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })} />
          Maintenance mode
        </label>
        <label className="mt-3 flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.notificationEmailEnabled}
            onChange={(e) => setSettings({ ...settings, notificationEmailEnabled: e.target.checked })}
          />
          Email notifications
        </label>
        <div className="mt-3">
          <Input
            label="Expiry warning (minutes)"
            type="number"
            value={settings.expiryWarningMinutes}
            onChange={(e) => setSettings({ ...settings, expiryWarningMinutes: Number(e.target.value) })}
          />
        </div>
      </Card>
      <Button onClick={() => http.put("/api/admin/settings", settings)}>Save settings</Button>
    </div>
  );
}
