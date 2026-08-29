import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export default function useDeadlineCountdown(initialSeconds = 0) {
  const initial = Math.max(0, Number(initialSeconds) || 0);
  const deadlineRef = useRef(initial > 0 ? Date.now() + initial * 1000 : 0);
  const [remaining, setRemaining] = useState(initial);

  const syncRemaining = useCallback(() => {
    const next = deadlineRef.current
      ? Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
      : 0;
    setRemaining((current) => (current === next ? current : next));
    if (next === 0) deadlineRef.current = 0;
  }, []);

  const setCountdown = useCallback((seconds) => {
    const next = Math.max(0, Number(seconds) || 0);
    deadlineRef.current = next > 0 ? Date.now() + next * 1000 : 0;
    setRemaining(next);
  }, []);

  useEffect(() => {
    const timer = setInterval(syncRemaining, 500);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncRemaining();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [syncRemaining]);

  return [remaining, setCountdown];
}
