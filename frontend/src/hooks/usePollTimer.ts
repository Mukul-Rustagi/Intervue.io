import { useEffect, useMemo, useState } from "react";

interface UsePollTimerOptions {
  expiresAt: string | null;
  durationSeconds: number;
  serverTime: string;
  active: boolean;
}

export const usePollTimer = ({
  expiresAt,
  durationSeconds,
  serverTime,
  active
}: UsePollTimerOptions): { remainingSeconds: number; progressPercent: number } => {
  const offsetFromServer = useMemo(() => {
    const serverNow = new Date(serverTime).getTime();
    return Number.isNaN(serverNow) ? 0 : serverNow - Date.now();
  }, [serverTime]);

  const computeRemaining = (): number => {
    if (!expiresAt || !active) {
      return 0;
    }

    const expiresAtMs = new Date(expiresAt).getTime();
    const now = Date.now() + offsetFromServer;
    const diffSeconds = Math.ceil((expiresAtMs - now) / 1000);

    return diffSeconds > 0 ? diffSeconds : 0;
  };

  const [remainingSeconds, setRemainingSeconds] = useState<number>(computeRemaining);

  useEffect(() => {
    setRemainingSeconds(computeRemaining());

    if (!active || !expiresAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds(computeRemaining());
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [expiresAt, active, offsetFromServer]);

  const progressPercent = durationSeconds > 0 ? (remainingSeconds / durationSeconds) * 100 : 0;

  return {
    remainingSeconds,
    progressPercent: Math.min(100, Math.max(0, progressPercent))
  };
};
