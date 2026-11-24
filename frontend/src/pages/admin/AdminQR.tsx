import { useEffect, useState } from "react";
import { http } from "../../lib/api";
import type { ParkingGround } from "../../lib/types";
import { Button, Card, FieldSelect } from "../../components/ui";

export default function AdminQR() {
  const [grounds, setGrounds] = useState<ParkingGround[]>([]);
  const [id, setId] = useState("");
  const [pack, setPack] = useState<{
    entrance: { image: string; data: string };
    exit: { image: string; data: string };
    spots: { spotNumber: string; image: string }[];
  } | null>(null);

  useEffect(() => {
    http.get<{ grounds: ParkingGround[] }>("/api/grounds").then((r) => {
      setGrounds(r.grounds);
      if (r.grounds[0]) setId(r.grounds[0].id);
    });
  }, []);

  async function generate() {
    const r = await http.post("/api/admin/qrcodes/generate", { parkingGroundId: id, format: "png" });
    setPack(r as never);
  }

  function download(src: string, name: string) {
    const a = document.createElement("a");
    a.href = src;
    a.download = name;
    a.click();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">QR codes</h1>
      <FieldSelect label="Parking ground" value={id} onChange={(e) => setId(e.target.value)}>
        {grounds.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </FieldSelect>
      <Button onClick={generate}>Generate pack</Button>
      {pack ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <p className="font-semibold">Entrance</p>
            <img src={pack.entrance.image} alt="Entrance QR" className="mt-2 w-48" />
            <p className="mt-2 break-all text-xs text-muted">{pack.entrance.data}</p>
            <Button className="mt-2" onClick={() => download(pack.entrance.image, "entrance.png")}>
              Download PNG
            </Button>
          </Card>
          <Card>
            <p className="font-semibold">Exit</p>
            <img src={pack.exit.image} alt="Exit QR" className="mt-2 w-48" />
            <Button className="mt-2" onClick={() => download(pack.exit.image, "exit.png")}>
              Download PNG
            </Button>
          </Card>
          {pack.spots.slice(0, 12).map((s) => (
            <Card key={s.spotNumber}>
              <p className="font-medium">{s.spotNumber}</p>
              <img src={s.image} alt={`Spot ${s.spotNumber} QR`} className="mt-2 w-32" />
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
