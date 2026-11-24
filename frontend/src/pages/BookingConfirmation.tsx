import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { http } from "../lib/api";
import type { Booking } from "../lib/types";
import { Badge, Button, Card } from "../components/ui";
import { Countdown } from "../components/Countdown";

export default function BookingConfirmation() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const id = params.get("id");
  const exit = params.get("exit");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [qr, setQr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    http.get<{ booking: Booking; qr: string }>(`/api/bookings/${id}/ticket`).then((r) => {
      setBooking(r.booking);
      setQr(r.qr);
    });
  }, [id]);

  async function endSession() {
    if (!id) return;
    await http.post(`/api/bookings/${id}/complete`);
    setMsg("Session ended. Spot released.");
  }

  function calendar() {
    if (!booking) return;
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:SmartPark ${booking.parkingGround.name} ${booking.spot.spotNumber}
DTSTART:${booking.startTime.replace(/[-:]/g, "").split(".")[0]}Z
DTEND:${booking.endTime.replace(/[-:]/g, "").split(".")[0]}Z
END:VEVENT
END:VCALENDAR`;
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "smartpark.ics";
    a.click();
  }

  if (!booking) return <p>Loading ticket…</p>;

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <Badge tone="green">Booking confirmed</Badge>
        <h1 className="mt-3 text-2xl font-bold">Spot {booking.spot.spotNumber}</h1>
        <p className="text-muted">{booking.parkingGround.name}</p>
        <div className="my-4 flex justify-center">{qr ? <img src={qr} alt="Booking verification QR code" className="h-48 w-48" /> : null}</div>
        <Countdown end={booking.endTime} />
        <p className="mt-2 text-sm">Expires {new Date(booking.endTime).toLocaleString()}</p>
      </Card>
      {msg ? <p className="text-success">{msg}</p> : null}
      <div className="grid gap-2">
        <Button onClick={calendar}>Add to calendar</Button>
        {exit ? (
          <Button onClick={endSession}>End session & release spot</Button>
        ) : (
          <Button variant="secondary" onClick={() => nav(`/extend-booking?id=${booking.id}`)}>
            Need more time?
          </Button>
        )}
        <Link to="/dashboard">
          <Button variant="ghost" className="w-full">
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
