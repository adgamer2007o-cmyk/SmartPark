import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { Button, Card, FieldSelect, Input } from "../components/ui";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const plate = String(fd.get("licensePlate") || "");
    setLoading(true);
    setError("");
    try {
      await register({
        name: fd.get("name"),
        email: fd.get("email"),
        password: fd.get("password"),
        accessibility: fd.get("accessibility") === "on",
        vehicle: plate
          ? { licensePlate: plate, vehicleType: fd.get("vehicleType") }
          : undefined,
      });
      nav("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <h1 className="text-2xl font-bold">Create your account</h1>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input label="Full name" name="name" required />
          <Input label="Email" type="email" name="email" required />
          <Input label="Password" type="password" name="password" minLength={8} required />
          <Input label="License plate (optional)" name="licensePlate" />
          <FieldSelect label="Vehicle type" name="vehicleType" defaultValue="CAR">
            <option value="CAR">Car</option>
            <option value="MOTORCYCLE">Motorcycle</option>
            <option value="EV">Electric vehicle</option>
            <option value="TRUCK">Truck</option>
          </FieldSelect>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="accessibility" /> I need accessible parking
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Register"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          Already registered? <Link to="/login" className="text-primary">Log in</Link>
        </p>
      </Card>
    </div>
  );
}
