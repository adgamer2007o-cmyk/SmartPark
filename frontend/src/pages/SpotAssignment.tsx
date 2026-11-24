import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../lib/api";
import { useParkFlow } from "../store/flow";
import { Button, Card, FieldSelect } from "../components/ui";
import type { PriceBreakdown } from "../lib/types";

const DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "2 hours", hours: 2 },
  { label: "4 hours", hours: 4 },
  { label: "Full day", hours: 8 },
];

export default function SpotAssignment() {
  const flow = useParkFlow();
  const nav = useNavigate();
  const spot = flow.selectedSpot;
  const [hours, setHours] = useState(flow.hours);
  const [custom, setCustom] = useState("");
  const [price, setPrice] = useState<PriceBreakdown | null>(null);

  useEffect(() => {
    if (!spot || !flow.ground) return;
    http
      .post<{ breakdown: PriceBreakdown }>("/api/price-preview", {
        parkingGroundId: flow.ground.id,
        spotType: spot.spotType,
        hours,
      })
      .then((r) => setPrice(r.breakdown));
  }, [hours, spot, flow.ground]);

  if (!spot || !flow.ground) {
    return (
      <Card>
        <p>No assignment yet.</p>
        <Button className="mt-3" onClick={() => nav("/scan")}>
          Scan again
        </Button>
      </Card>
    );
  }

  if (flow.assignment?.lotFull) {
    return (
      <Card>
        <h1 className="text-xl font-bold">Lot full</h1>
        <p className="text-muted">Try a nearby lot:</p>
        <ul className="mt-3 space-y-2">
          {flow.assignment.alternativesNearby?.map((g) => (
            <li key={g.id}>
              {g.name} — {g.available} open
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-muted">{flow.ground.name}</p>
        <h1 className="text-3xl font-bold">Your spot: {spot.spotNumber}</h1>
        <p className="text-muted">
          {spot.level} · {spot.row} · {spot.spotType.replace("_", " ")}
        </p>
        {flow.assignment?.estimatedWalkTime ? (
          <p className="mt-2 text-sm">About {flow.assignment.estimatedWalkTime} min walk from the entrance</p>
        ) : null}
        {flow.assignment?.warning ? <p className="mt-2 text-sm text-amber-700">{flow.assignment.warning}</p> : null}
        <ul className="mt-3 list-disc pl-5 text-sm text-muted">
          {(flow.assignment?.reasoning || ["Available compatible spot"]).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>
      {flow.assignment?.alternativeSpots?.length ? (
        <FieldSelect
          label="Request a different spot"
          value={spot.id}
          onChange={(e) => {
            const alt = flow.assignment?.alternativeSpots?.find((s) => s.id === e.target.value);
            if (alt) flow.set({ selectedSpot: alt });
          }}
        >
          <option value={spot.id}>{spot.spotNumber} (assigned)</option>
          {flow.assignment.alternativeSpots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.spotNumber} · {s.spotType}
            </option>
          ))}
        </FieldSelect>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {DURATIONS.map((d) => (
          <Button key={d.hours} variant={hours === d.hours ? "primary" : "secondary"} onClick={() => setHours(d.hours)}>
            {d.label}
          </Button>
        ))}
      </div>
      <label className="block text-sm">
        Custom hours
        <input
          className="mt-1 min-h-11 w-full rounded-md border px-3"
          type="number"
          min={0.5}
          step={0.5}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            if (Number(e.target.value) > 0) setHours(Number(e.target.value));
          }}
        />
      </label>
      {price ? (
        <Card>
          <p className="font-semibold">Price breakdown</p>
          <ul className="mt-2 text-sm">
            {price.lines.map((l) => (
              <li key={l.label} className="flex justify-between">
                <span>{l.label}</span>
                <span>${l.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${price.total.toFixed(2)}</span>
          </p>
        </Card>
      ) : null}
      <Button
        className="w-full"
        onClick={() => {
          flow.set({ hours, selectedSpot: spot });
          nav("/payment");
        }}
      >
        Confirm & Pay
      </Button>
    </div>
  );
}
