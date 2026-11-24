import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../lib/api";
import { useParkFlow } from "../store/flow";
import { Button, Card, Input } from "../components/ui";

export default function Payment() {
  const flow = useParkFlow();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  const amount = useMemo(() => (flow.hours || 2) * 1.5, [flow.hours]);

  async function pay() {
    if (!flow.ground || !flow.selectedSpot || !flow.vehicle) {
      setError("Missing booking details");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const intent = await http.post<{ mock: boolean; clientSecret: string | null }>("/api/payments/create-intent", {
        amount: Math.max(0.5, amount),
        metadata: { spotId: flow.selectedSpot.id },
      });
      const created = await http.post<{ booking: { id: string } }>("/api/bookings", {
        parkingGroundId: flow.ground.id,
        spotId: flow.selectedSpot.id,
        vehicleId: flow.vehicle.id,
        durationHours: flow.hours,
        mockPaid: intent.mock,
        stripePaymentId: intent.mock ? undefined : undefined,
      });
      flow.set({ bookingId: created.booking.id });
      nav(`/booking-confirmation?id=${created.booking.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed. You can retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <Card>
        <p className="text-sm text-muted">Order summary</p>
        <p className="mt-2 font-semibold">
          {flow.ground?.name} · Spot {flow.selectedSpot?.spotNumber}
        </p>
        <p className="text-sm">{flow.hours} hours</p>
        <p className="mt-4 text-2xl font-bold">${amount.toFixed(2)} estimated</p>
        <p className="text-xs text-muted">Final amount is calculated with student discounts and caps at booking time.</p>
      </Card>
      {stripeKey ? (
        <Card>
          <Input label="Card number (Stripe test)" placeholder="4242 4242 4242 4242" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input label="Expiry" placeholder="12/28" />
            <Input label="CVC" placeholder="123" />
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">
            Stripe keys are not set. Test-mode mock payment will confirm this booking immediately.
          </p>
        </Card>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button className="w-full" onClick={pay} disabled={loading}>
        {loading ? "Processing…" : "Pay"}
      </Button>
    </div>
  );
}
