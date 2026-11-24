import { useEffect, useState } from "react";

export function Countdown({ end }: { end: string }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const ms = new Date(end).getTime() - Date.now();
      if (ms <= 0) {
        setLeft("Expired");
        return;
      }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [end]);
  return <p className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-primary">{left}</p>;
}
