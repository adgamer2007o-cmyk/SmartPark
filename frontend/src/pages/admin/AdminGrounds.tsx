import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api";
import type { ParkingGround } from "../../lib/types";
import { Button, Card, Input } from "../../components/ui";

export default function AdminGrounds() {
  const [grounds, setGrounds] = useState<ParkingGround[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await http.get<{ grounds: ParkingGround[] }>("/api/grounds");
    setGrounds(r.grounds);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rows = Number(fd.get("layoutRows") || 5);
    const cols = Number(fd.get("layoutCols") || 8);
    const ground = await http.post<{ ground: ParkingGround }>("/api/grounds", {
      name: fd.get("name"),
      location: fd.get("location"),
      description: fd.get("description"),
      totalCapacity: rows * cols,
      operatingHours: JSON.stringify({ open: fd.get("open"), close: fd.get("close") }),
      layoutRows: rows,
      layoutCols: cols,
    });
    await http.post(`/api/grounds/${ground.ground.id}/spots/generate`, { rows, cols, level: "Ground Floor" });
    setOpen(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Parking grounds</h1>
        <Button onClick={() => setOpen(true)}>Add ground</Button>
      </div>
      {open ? (
        <Card>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={create}>
            <Input label="Name" name="name" required />
            <Input label="Location" name="location" required />
            <Input label="Description" name="description" />
            <Input label="Opens" name="open" defaultValue="06:00" />
            <Input label="Closes" name="close" defaultValue="23:00" />
            <Input label="Rows" name="layoutRows" type="number" defaultValue={5} />
            <Input label="Columns" name="layoutCols" type="number" defaultValue={8} />
            <div className="md:col-span-2 flex gap-2">
              <Button>Create & generate spots</Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      <div className="grid gap-3">
        {grounds.map((g) => (
          <Card key={g.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{g.name}</p>
                <p className="text-sm text-muted">{g.location}</p>
                <p className="text-sm">{g.occupancy?.available} available / {g.occupancy?.total}</p>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/grounds/${g.id}/spots`}>
                  <Button variant="secondary">Spots</Button>
                </Link>
                <Button
                  variant="danger"
                  onClick={async () => {
                    await http.del(`/api/grounds/${g.id}`);
                    load();
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
