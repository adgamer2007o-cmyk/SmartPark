import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useAuth } from "./store/auth";
import { AdminLayout, PublicLayout, UserLayout } from "./components/Layouts";
import { Guard } from "./components/Guard";
import { Toast } from "./components/Feedback";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import SpotAssignment from "./pages/SpotAssignment";
import Payment from "./pages/Payment";
import BookingConfirmation from "./pages/BookingConfirmation";
import MyBookings from "./pages/MyBookings";
import Profile from "./pages/Profile";
import ExtendBooking from "./pages/ExtendBooking";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminGrounds from "./pages/admin/AdminGrounds";
import AdminSpots from "./pages/admin/AdminSpots";
import AdminPricing from "./pages/admin/AdminPricing";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminQR from "./pages/admin/AdminQR";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";

export default function App() {
  const load = useAuth((s) => s.load);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Toast message={toast} onClose={() => setToast(null)} />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />
        </Route>
        <Route element={<Guard role="USER" />}>
          <Route element={<UserLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/spot-assignment" element={<SpotAssignment />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/booking-confirmation" element={<BookingConfirmation />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/extend-booking" element={<ExtendBooking />} />
          </Route>
        </Route>
        <Route element={<Guard role="ADMIN" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/grounds" element={<AdminGrounds />} />
            <Route path="/admin/grounds/:id/spots" element={<AdminSpots />} />
            <Route path="/admin/pricing" element={<AdminPricing />} />
            <Route path="/admin/bookings" element={<AdminBookings />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/qrcodes" element={<AdminQR />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
