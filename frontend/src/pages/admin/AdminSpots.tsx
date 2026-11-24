import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { http } from "../../lib/api";
import type { ParkingSpot, SpotStatus, SpotType } from "../../lib/types";
import { Button, Card, FieldSelect } from "../../components/ui";

const COLORS: Record<SpotStatus, string> = {
  AVAILABLE: "bg-green-500",
  OCCUPIED: "bg-red-500",
  RESERVED: "bg-amber-400",
  MAINTENANCE: "bg-gray-400",
};

export default function AdminSpots() {
  const { id } = useParams();
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<SpotStatus>("MAINTENANCE");
  const [type, setType] = useState<SpotType>("STANDARD");

  async function load() {
    const r = await http.get<{ spots: ParkingSpot[] }>(`/api/grounds/${id}/spots`);
    setSpots(r.spots);
  }
  useEffect(() => {
    load();
  }, [id]);

  function toggle(sid: string) {
    setSelected((s) => (s.includes(sid) ? s.filter((x) => x !== sid) : [...s, sid]));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Spot layout</h1>
      <div className="flex flex-wrap gap-3 text-sm">
        {Object.entries(COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-2">
            <i className={`inline-block h-3 w-3 rounded-sm ${c}`} /> {k}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <FieldSelect label="Bulk status" value={status} onChange={(e) => setStatus(e.target.value as SpotStatus)}>
          <option>AVAILABLE</option>
          <option>OCCUPIED</option>
          <option>RESERVED</option>
          <option>MAINTENANCE</option>
        </FieldSelect>
        <FieldSelect label="Bulk type" value={type} onChange={(e) => setType(e.target.value as SpotType)}>
          <option>STANDARD</option>
          <option>COMPACT</option>
          <option>MOTORCYCLE</option>
          <option>EV_CHARGING</option>
          <option>ACCESSIBLE</option>
          <option>PREMIUM</option>
        </FieldSelect>
        <Button
          className="self-end"
          onClick={async () => {
            await http.post("/api/spots/bulk-update", { ids: selected, status });
            setSelected([]);
            load();
          }}
          disabled={!selected.length}
        >
          Apply status
        </Button>
        <Button
          className="self-end"
          variant="secondary"
          onClick={async () => {
            await http.post("/api/spots/bulk-update", { ids: selected, spotType: type });
            setSelected([]);
            load();
          }}
          disabled={!selected.length}
        >
          Apply type
        </Button>
      </div>
      <div className="grid grid-cols-6 gap-2 md:grid-cols-10">
        {spots.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={`min-h-11 rounded-md text-xs font-semibold text-white ${COLORS[s.status]} ${selected.includes(s.id) ? "ring-2 ring-ink" : ""}`}
            title={`${s.spotNumber} ${s.spotType}`}
          >
            {s.spotNumber}
          </button>
        ))}
      </div>
      <Card>
        <p className="text-sm text-muted">{selected.length} selected. Click a cell to select.</p>
      </Card>
    </div>
  );
}
