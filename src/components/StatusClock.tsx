"use client";

import { useEffect, useMemo, useState } from "react";

export function StatusClock({
  locale = "en-US",
}: {
  locale?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setNow(new Date());

    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeText = useMemo(() => {
    if (!now) return "--:--";
    return now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }, [locale, now]);

  const dateText = useMemo(() => {
    if (!now) return "Loading date";
    return now.toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [locale, now]);

  return (
    <>
      <span className="text-sm font-semibold" suppressHydrationWarning>
        {timeText}
      </span>
      <span className="text-xs text-white/70" suppressHydrationWarning>
        {isMounted ? dateText : "Loading date"}
      </span>
    </>
  );
}
