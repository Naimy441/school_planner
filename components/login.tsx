"use client";

import { getRedirectResult, GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { motion } from "motion/react";
import { CalendarCheck, Sparkles, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { Logo } from "./logo";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function Login() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getRedirectResult(auth()).catch((e) => setErr(friendly(e)));
  }, []);

  const go = async () => {
    setBusy(true);
    setErr("");
    try {
      // Home-screen apps on iOS can't reliably talk back to a popup.
      if (isStandalone()) await signInWithRedirect(auth(), googleProvider());
      else await signInWithPopup(auth(), googleProvider());
    } catch (e) {
      const code = (e as { code?: string }).code || "";
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth(), googleProvider()).catch((e2) => setErr(friendly(e2)));
      } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setErr(friendly(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const features = [
    { icon: CalendarCheck, text: "Every class, exam and assignment in one view" },
    { icon: Timer, text: "Focus timers that follow you across devices" },
    { icon: Sparkles, text: "Small steps, real progress, points that feel good" },
  ];

  return (
    <div className="pt-safe pb-safe relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <motion.div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(35,131,226,0.22),transparent_65%)]"
        animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[380px]"
      >
        <Logo size={56} />
        <h1 className="mt-6 text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
          Your semester,
          <br />
          one calm page.
        </h1>
        <div className="mt-6 flex flex-col gap-3">
          {features.map((f, i) => (
            <motion.div
              key={f.text}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.08 }}
              className="flex items-center gap-3 text-[14.5px] text-ink-2"
            >
              <f.icon className="h-4 w-4 shrink-0 text-ink-3" />
              {f.text}
            </motion.div>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={go}
          disabled={busy}
          className="mt-10 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-[15px] font-medium text-[#1f1f1f] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-opacity disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {busy ? "Opening Google…" : "Continue with Google"}
        </motion.button>
        {process.env.NEXT_PUBLIC_USE_EMULATOR === "1" && (
          <button
            onClick={() =>
              // Emulator only: it accepts unsigned fake Google tokens.
              signInWithCredential(
                auth(),
                GoogleAuthProvider.credential(JSON.stringify({ sub: "emulator-tester", email: "tester@example.com", name: "Sam Tester", email_verified: true })),
              ).catch((e) => setErr(friendly(e)))
            }
            className="mt-3 w-full text-center text-[12.5px] text-ink-3 underline"
          >
            Use emulator test account
          </button>
        )}
        {err && <p className="mt-3 text-center text-[13px] text-danger">{err}</p>}
        <p className="mt-6 text-center text-[12px] text-ink-3">Your data is private to your account.</p>
      </motion.div>
    </div>
  );
}

function friendly(e: unknown) {
  const code = (e as { code?: string }).code || "";
  if (code === "auth/unauthorized-domain") return "This domain isn't authorised for sign-in yet (Firebase → Authentication → Settings → Authorized domains).";
  if (code === "auth/operation-not-allowed") return "Google sign-in isn't enabled for this project yet.";
  if (code === "auth/network-request-failed") return "You seem to be offline.";
  return "Sign-in didn't go through. Please try again.";
}
