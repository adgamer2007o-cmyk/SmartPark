import { useEffect, useState } from "react";
import { http } from "../../lib/api";
import { Button, Card, Input } from "../../components/ui";

type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  _count: { bookings: number };
};

export default function AdminUsers() {
  const [users, setUsers] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  async function load() {
    const r = await http.get<{ users: Row[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`);
    setUsers(r.users);
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="flex gap-2">
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button className="self-end" onClick={load}>
          Search
        </Button>
      </div>
      {users.map((u) => (
        <Card key={u.id} className="flex items-center justify-between">
          <div>
            <p className="font-medium">{u.name}</p>
            <p className="text-sm text-muted">
              {u.email} · {u.role} · {u._count.bookings} bookings
            </p>
          </div>
          <Button
            variant={u.isActive ? "danger" : "primary"}
            onClick={async () => {
              await http.patch(`/api/admin/users/${u.id}/status`, { isActive: !u.isActive });
              load();
            }}
          >
            {u.isActive ? "Suspend" : "Activate"}
          </Button>
        </Card>
      ))}
    </div>
  );
}
