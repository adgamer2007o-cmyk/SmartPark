import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { CalendarDays, Home, QrCode, UserRound } from "lucide-react";
import { useAuth } from "../store/auth";
import { OfflineBanner, useOnline } from "./Feedback";

export function PublicLayout() {
  const online = useOnline();
  return (
    <div className="min-h-screen">
      <OfflineBanner online={online} />
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="text-lg font-bold text-primary">
            SmartPark
          </NavLink>
          <nav className="flex gap-4 text-sm font-medium">
            <NavLink to="/pricing">Pricing</NavLink>
            <NavLink to="/login">Log in</NavLink>
            <NavLink to="/register" className="text-primary">
              Register
            </NavLink>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

export function UserLayout() {
  const online = useOnline();
  const { user } = useAuth();
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <OfflineBanner online={online} />
      <header className="hidden border-b border-gray-200 bg-white md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <NavLink to="/dashboard" className="font-bold text-primary">
            SmartPark
          </NavLink>
          <nav className="flex gap-4 text-sm font-medium">
            <NavLink to="/dashboard">Home</NavLink>
            <NavLink to="/scan">Scan</NavLink>
            <NavLink to="/my-bookings">Bookings</NavLink>
            <NavLink to="/profile">Profile</NavLink>
          </nav>
          <p className="text-sm text-muted">Hi, {user?.name}</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white md:hidden" aria-label="Primary">
        <div className="grid grid-cols-4">
          <Tab to="/dashboard" icon={<Home size={20} />} label="Home" />
          <Tab to="/scan" icon={<QrCode size={20} />} label="Scan" />
          <Tab to="/my-bookings" icon={<CalendarDays size={20} />} label="Bookings" />
          <Tab to="/profile" icon={<UserRound size={20} />} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function Tab({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-14 flex-col items-center justify-center text-xs ${isActive ? "text-primary" : "text-muted"}`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export function AdminLayout() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const online = useOnline();
  const links = [
    ["/admin", "Overview"],
    ["/admin/grounds", "Grounds"],
    ["/admin/pricing", "Pricing"],
    ["/admin/bookings", "Bookings"],
    ["/admin/users", "Users"],
    ["/admin/qrcodes", "QR Codes"],
    ["/admin/reports", "Reports"],
    ["/admin/settings", "Settings"],
  ];
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-gray-200 bg-white md:border-b-0 md:border-r">
        <div className="px-4 py-4 font-bold text-primary">SmartPark Admin</div>
        <nav className="flex flex-wrap gap-1 px-2 pb-3 md:flex-col">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-blue-50 text-primary" : "text-ink hover:bg-gray-50"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 pb-4 text-xs text-muted">
          {user?.email}
          <button
            className="mt-2 block text-primary"
            onClick={async () => {
              await logout();
              nav("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div>
        <OfflineBanner online={online} />
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
