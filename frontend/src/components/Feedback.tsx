import { useEffect, useState } from "react";

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div role="status" className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
      <span>{message}</span>
      <button className="ml-3 text-white/70" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div role="alert" className="bg-warning px-4 py-2 text-center text-sm font-medium text-ink">
      Connection lost. Some actions may not work until you are back online.
    </div>
  );
}
