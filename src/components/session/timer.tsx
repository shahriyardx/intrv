"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Display only. `expiresAt` in the database is the authority and is re-checked
 * on submit — a client clock is a suggestion, not a fact. Reaching zero here
 * triggers a submit for the user's benefit; it is not what enforces the limit.
 */
export function Timer({
  expiresAt,
  onExpire,
}: {
  expiresAt: Date;
  onExpire: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, expiresAt.getTime() - Date.now()),
  );

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, expiresAt.getTime() - Date.now());
      setRemainingMs(next);
      if (next === 0) onExpire();
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const urgent = remainingMs <= 60_000;

  return (
    <span
      // Announce politely at intervals rather than every second, which would
      // make a screen reader unusable.
      role="timer"
      aria-live={urgent ? "assertive" : "off"}
      className={cn(
        "font-mono text-sm tabular transition-colors",
        urgent ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
