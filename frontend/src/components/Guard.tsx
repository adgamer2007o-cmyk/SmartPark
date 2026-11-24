import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../store/auth";

export function Guard({ role }: { role?: "USER" | "ADMIN" }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === "ADMIN" && user.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  if (role === "USER" && user.role === "ADMIN") return <Navigate to="/admin" replace />;
  return <Outlet />;
}
