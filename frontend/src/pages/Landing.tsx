import { Link } from "react-router-dom";
import { Button } from "../components/ui";
import { QrCode, Gauge, ShieldCheck, Smartphone } from "lucide-react";

export default function Landing() {
  return (
    <div>
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal">Campus parking, simplified</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">Scan. Park. Go to class.</h1>
            <p className="mt-4 text-muted">
              SmartPark assigns the best available spot the moment you arrive — then you pay for only the time you need.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register">
                <Button>Scan to Park</Button>
              </Link>
              <Link to="/pricing">
                <Button variant="secondary">View rates</Button>
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-bg p-8">
            <div className="flex h-64 items-center justify-center rounded-lg bg-primary text-white">
              <div className="text-center">
                <QrCode className="mx-auto mb-3" size={48} />
                <p className="text-lg font-semibold">Entrance QR</p>
                <p className="text-sm text-blue-100">Point your camera at the gate</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3">
        {[
          { icon: Smartphone, title: "Mobile-first scan", body: "Camera-based QR flow with manual fallback if permissions are denied." },
          { icon: Gauge, title: "Smart assignment", body: "We score distance, vehicle type, accessibility, and your history." },
          { icon: ShieldCheck, title: "Secure checkout", body: "Stripe test-mode payments, HTTP-only sessions, and role-based admin." },
        ].map((f) => (
          <div key={f.title} className="rounded-lg border border-gray-200 bg-white p-5">
            <f.icon className="text-primary" />
            <h2 className="mt-3 font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-gray-200 bg-white py-8 text-center text-sm text-muted">
        SmartPark · University parking for students, faculty, and visitors
      </footer>
    </div>
  );
}
