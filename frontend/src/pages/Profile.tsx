import { FormEvent, useState } from "react";
import { http } from "../lib/api";
import { useAuth } from "../store/auth";
import { Button, Card, FieldSelect, Input } from "../components/ui";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [msg, setMsg] = useState("");

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { user: updated } = await http.put<{ user: typeof user }>("/api/auth/me", {
      name: fd.get("name"),
      phone: fd.get("phone"),
      accessibility: fd.get("accessibility") === "on",
      notifyEmail: fd.get("notifyEmail") === "on",
      notifyInApp: fd.get("notifyInApp") === "on",
    });
    setUser(updated!);
    setMsg("Profile saved");
  }

  async function addVehicle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await http.post("/api/vehicles", {
      licensePlate: fd.get("licensePlate"),
      vehicleType: fd.get("vehicleType"),
      isDefault: true,
    });
    const { user: me } = await http.get<{ user: NonNullable<typeof user> }>("/api/auth/me");
    setUser(me);
    setMsg("Vehicle added");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      {msg ? <p className="text-success">{msg}</p> : null}
      <Card>
        <form className="space-y-3" onSubmit={saveProfile}>
          <Input label="Name" name="name" defaultValue={user?.name} />
          <Input label="Phone" name="phone" defaultValue={user?.phone || ""} />
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="accessibility" defaultChecked={user?.accessibility} /> Accessible parking
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="notifyEmail" defaultValue="on" defaultChecked={user?.notifyEmail} /> Email notifications
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="notifyInApp" defaultChecked={user?.notifyInApp} /> In-app toasts
          </label>
          <Button>Save</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Vehicles</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {user?.vehicles.map((v) => (
            <li key={v.id} className="flex justify-between">
              <span>
                {v.licensePlate} · {v.vehicleType}
              </span>
              <button
                className="text-danger"
                onClick={async () => {
                  await http.del(`/api/vehicles/${v.id}`);
                  const { user: me } = await http.get<{ user: NonNullable<typeof user> }>("/api/auth/me");
                  setUser(me);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={addVehicle}>
          <Input label="License plate" name="licensePlate" required />
          <FieldSelect label="Type" name="vehicleType">
            <option>CAR</option>
            <option>MOTORCYCLE</option>
            <option>EV</option>
            <option>TRUCK</option>
          </FieldSelect>
          <Button className="self-end">Add</Button>
        </form>
      </Card>
      <Button
        variant="secondary"
        onClick={async () => {
          await logout();
          window.location.href = "/login";
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
