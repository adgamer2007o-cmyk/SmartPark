import { useEffect, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { http } from "../lib/api";
import { useAuth } from "../store/auth";
import { useParkFlow } from "../store/flow";
import { Button, Card, FieldSelect, Input } from "../components/ui";
import type { Assignment, ParkingGround, ParkingSpot } from "../lib/types";

export default function Scan() {
  const { user } = useAuth();
  const flow = useParkFlow();
  const nav = useNavigate();
  const [vehicleId, setVehicleId] = useState(user?.vehicles.find((v) => v.isDefault)?.id || user?.vehicles[0]?.id || "");
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [grounds, setGrounds] = useState<ParkingGround[]>([]);

  useEffect(() => {
    http.get<{ grounds: ParkingGround[] }>("/api/grounds").then((r) => setGrounds(r.grounds));
  }, []);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    let stopped = false;
    Html5Qrcode.getCameras()
      .then((cams) => {
        if (!cams.length) throw new Error("No camera");
        return scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          async (text) => {
            if (stopped) return;
            stopped = true;
            await scanner.stop().catch(() => undefined);
            await handlePayload(text);
          },
          () => undefined
        );
      })
      .catch(() => setError("Camera access denied. Enter the code manually or pick a lot below."));
    return () => {
      stopped = true;
      scanner.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  async function handlePayload(payload: string) {
    setError("");
    try {
      const data = await http.post<{
        kind: string;
        ground?: ParkingGround;
        assignment?: Assignment;
        booking?: { id: string };
        expired?: boolean;
        spot?: ParkingSpot & { parkingGround: ParkingGround };
        bookable?: boolean;
      }>("/api/scan", { payload, vehicleId });
      const vehicle = user?.vehicles.find((v) => v.id === vehicleId) || null;
      if (data.kind === "ENTRANCE") {
        flow.set({
          ground: data.ground || null,
          vehicle,
          assignment: data.assignment || null,
          selectedSpot: data.assignment?.assignedSpot || null,
        });
        nav("/spot-assignment");
      } else if (data.kind === "EXIT" && data.booking) {
        nav(data.expired ? `/extend-booking?id=${data.booking.id}` : `/booking-confirmation?id=${data.booking.id}&exit=1`);
      } else if (data.kind === "SPOT" && data.spot) {
        flow.set({ ground: data.spot.parkingGround, vehicle, selectedSpot: data.spot, assignment: null });
        nav("/spot-assignment");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scan to park</h1>
      <FieldSelect label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
        {user?.vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.licensePlate} · {v.vehicleType}
          </option>
        ))}
      </FieldSelect>
      <div id="qr-reader" className="overflow-hidden rounded-lg bg-black" />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Card>
        <p className="font-medium">Manual code</p>
        <Input label="QR payload" value={manual} onChange={(e) => setManual(e.target.value)} />
        <Button className="mt-3" onClick={() => handlePayload(manual)} disabled={!manual}>
          Submit code
        </Button>
      </Card>
      <div>
        <p className="mb-2 text-sm font-medium">Or choose a lot (demo)</p>
        <div className="grid gap-2">
          {grounds.map((g) => (
            <button
              key={g.id}
              className="rounded-lg border border-gray-200 bg-white p-3 text-left"
              onClick={() => handlePayload(JSON.stringify({ v: 1, kind: "ENTRANCE", id: g.id }))}
            >
              <div className="font-medium">{g.name}</div>
              <div className="text-sm text-muted">
                {g.occupancy?.available} open spots · {g.location}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
