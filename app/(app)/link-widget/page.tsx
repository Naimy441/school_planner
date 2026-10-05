"use client";

import { motion } from "motion/react";
import { CheckCircle2, Copy, Monitor } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Page } from "@/components/ui";
import { useStore } from "@/lib/store";

function LinkWidget() {
  const { user } = useStore();
  const params = useSearchParams();
  const state = params.get("state") || "";
  const validState = /^[A-Za-z0-9_-]{16,128}$/.test(state);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  // The refresh token lets the widget mint its own short-lived ID tokens; it
  // only ever goes to the app on this Mac via its custom URL scheme.
  const payload = () => {
    if (!user) return "";
    return btoa(JSON.stringify({ uid: user.uid, token: user.refreshToken, name: user.displayName || "" }));
  };

  const connect = () => {
    const url = `plannerbar://auth?state=${encodeURIComponent(state)}&code=${encodeURIComponent(payload())}`;
    window.location.href = url;
    setDone(true);
  };

  return (
    <Page className="max-w-[560px]">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Monitor className="h-6 w-6" />
      </motion.div>
      <h1 className="text-[26px] font-bold tracking-tight text-ink">Planner Bar for Mac</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
        A tiny menu bar companion: your live focus timer, the step you&apos;re on, and what&apos;s up next — synced with this account.
      </p>

      {validState ? (
        <Card className="mt-6 p-5">
          {done ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-good" />
              <div>
                <div className="text-[15px] font-semibold text-ink">Sent to Planner Bar</div>
                <p className="mt-1 text-[13.5px] text-ink-3">
                  If your browser asked to open Planner Bar, allow it. Look for the timer in your menu bar — you can close this tab.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-[15px] font-semibold text-ink">Connect the menu bar app on this Mac?</div>
              <p className="mt-1 text-[13.5px] text-ink-3">
                It&apos;ll be able to read and update your planner as <b className="text-ink-2">{user?.email}</b>. You can disconnect from its menu at any time.
              </p>
              <Button variant="primary" size="lg" className="mt-4 w-full" onClick={connect}>
                Connect Planner Bar
              </Button>
            </>
          )}
        </Card>
      ) : (
        <Card className="mt-6 p-5 text-[13.5px] leading-relaxed text-ink-2">
          <div className="mb-2 text-[15px] font-semibold text-ink">Set it up</div>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Build it once: <code className="rounded bg-hover px-1.5 py-0.5 text-[12.5px]">./widget/build.sh</code> in the project folder (creates <b>Planner Bar.app</b>).
            </li>
            <li>Open the app — a ✓ appears in your menu bar.</li>
            <li>Click it and choose <b>Connect account</b>. This page opens and links it.</li>
          </ol>
          <p className="mt-3 text-ink-3">Or paste this connection code into the app manually:</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            icon={copied ? <CheckCircle2 className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}
            onClick={async () => {
              await navigator.clipboard.writeText(payload());
              setCopied(true);
            }}
          >
            {copied ? "Copied — keep it private" : "Copy connection code"}
          </Button>
        </Card>
      )}
    </Page>
  );
}

export default function Page_() {
  return (
    <Suspense>
      <LinkWidget />
    </Suspense>
  );
}
