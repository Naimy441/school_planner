"use client";

import { Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { FocusView } from "@/components/focus-view";
import { Button, Empty, Page } from "@/components/ui";
import { useStore } from "@/lib/store";

/** The live session screen. Sessions are started from Home, and it hands back to Home when they end. */
export default function FocusPage() {
  const { timer, itemMap } = useStore();
  const router = useRouter();
  const item = timer?.active && timer.itemId ? itemMap.get(timer.itemId) : undefined;
  const running = !!(timer?.active && item);

  // Only leave once a session we were showing has ended, so a cold load doesn't bounce before the timer syncs.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) wasRunning.current = true;
    else if (wasRunning.current) router.replace("/");
  }, [running, router]);

  if (timer?.active && item) return <FocusView timer={timer} item={item} />;

  return (
    <Page>
      <div className="mt-8">
        <Empty
          icon={<Timer />}
          title="No session running"
          body="Pick something on Home and press Start."
          action={
            <Button variant="secondary" onClick={() => router.push("/")}>
              Back to Home
            </Button>
          }
        />
      </div>
    </Page>
  );
}
