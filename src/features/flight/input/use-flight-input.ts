"use client";

import { useEffect } from "react";

export type FlightKeyboardHandlers = {
  chooseUpper: () => void;
  chooseLower: () => void;
  skip: () => void;
  enabled: boolean;
};

export function useFlightInput({ chooseUpper, chooseLower, skip, enabled }: FlightKeyboardHandlers): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        return;
      }
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        event.preventDefault();
        chooseUpper();
      } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
        event.preventDefault();
        chooseLower();
      } else if (event.key === "Escape") {
        event.preventDefault();
        skip();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chooseLower, chooseUpper, enabled, skip]);
}
