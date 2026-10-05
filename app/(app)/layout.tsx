"use client";

import { AnimatePresence, motion } from "motion/react";
import { AttendancePrompt, ClassGate } from "@/components/class-gate";
import { CelebrationLayer } from "@/components/celebrate";
import { CourseSheetHost } from "@/components/course-sheet";
import { ImportSheet } from "@/components/import-ics";
import { ItemSheetHost } from "@/components/item-sheet";
import { Login, Private } from "@/components/login";
import { Logo } from "@/components/logo";
import { NewItemSheet } from "@/components/new-item";
import { SettingsSheet } from "@/components/settings-sheet";
import { AppShell } from "@/components/shell";
import { StartFlow } from "@/components/start-flow";
import { TimerEngine } from "@/components/timer-engine";
import { UIProvider } from "@/components/ui-state";
import { UpdateCheck } from "@/components/update-check";
import { StoreProvider, useStore } from "@/lib/store";

function Gate({ children }: { children: React.ReactNode }) {
  const { authReady, user, denied } = useStore();
  return (
    <AnimatePresence mode="wait">
      {!authReady ? (
        <motion.div key="splash" exit={{ opacity: 0 }} className="flex min-h-dvh items-center justify-center">
          <Logo size={52} />
        </motion.div>
      ) : !user ? (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Login />
        </motion.div>
      ) : denied ? (
        <motion.div key="denied" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Private email={user.email} />
        </motion.div>
      ) : (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <AppShell>{children}</AppShell>
          <TimerEngine />
          <ItemSheetHost />
          <CourseSheetHost />
          <NewItemSheet />
          <ImportSheet />
          <SettingsSheet />
          <StartFlow />
          <AttendancePrompt />
          <ClassGate />
          <CelebrationLayer />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <UpdateCheck />
      <UIProvider>
        <Gate>{children}</Gate>
      </UIProvider>
    </StoreProvider>
  );
}
