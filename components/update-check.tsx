"use client";

import { useEffect } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

/**
 * Home-screen apps can stay open for days. When the app returns to the
 * foreground and a newer build is live, reload — all state lives in Firestore,
 * so nothing is lost.
 */
export function UpdateCheck() {
  useEffect(() => {
    if (BUILD === "dev") return;
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 60_000) return;
      last = Date.now();
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { build } = (await r.json()) as { build: string };
        if (build && build !== "dev" && build !== BUILD) window.location.reload();
      } catch {
        // offline — try again next time
      }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  return null;
}
