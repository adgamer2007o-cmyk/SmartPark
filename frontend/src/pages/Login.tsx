import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { Button, Card, Input } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("student@smartpark.com");
  const [password, setPassword] = useState("student123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
      nav(user.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Use your campus email to continue.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Log in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          New here? <Link to="/register" className="text-primary">Create an account</Link>
        </p>
        <p className="mt-4 text-xs text-muted">Demo: admin@smartpark.com / admin123</p>
      </Card>
    </div>
  );
}
