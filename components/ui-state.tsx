"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ItemKind } from "@/lib/types";
import { Button, Sheet } from "./ui";

export interface ConfirmOptions {
  title: string;
  body?: string;
  /** label of the destructive button (default "Delete") */
  confirmLabel?: string;
}

export interface NewItemDraft {
  kind: ItemKind;
  courseId?: string | null;
  recurring?: boolean;
}

interface UI {
  itemId: string | null;
  openItem: (id: string | null) => void;
  newItem: NewItemDraft | null;
  openNewItem: (d: NewItemDraft | null) => void;
  courseId: string | null;
  openCourse: (id: string | null) => void;
  newCourse: boolean;
  setNewCourse: (v: boolean) => void;
  importOpen: boolean;
  setImportOpen: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  /** item the user is about to start; triggers the priority check + preset picker */
  startFor: string | null;
  /** item whose weekly repeat is being edited / created */
  repeatFor: string | null;
  openRepeat: (id: string | null) => void;
  requestStart: (id: string | null) => void;
  toast: (text: string) => void;
  /** Ask before anything is deleted. Resolves true only if the user confirms. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<UI | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [itemId, openItem] = useState<string | null>(null);
  const [newItem, openNewItem] = useState<NewItemDraft | null>(null);
  const [courseId, openCourse] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startFor, requestStart] = useState<string | null>(null);
  const [repeatFor, openRepeat] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [asking, setAsking] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) =>
        setAsking((prev) => {
          prev?.resolve(false);
          return { ...opts, resolve };
        }),
      ),
    [],
  );
  const answer = (ok: boolean) => {
    asking?.resolve(ok);
    setAsking(null);
  };

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const value = useMemo(
    () => ({
      itemId,
      openItem,
      newItem,
      openNewItem,
      courseId,
      openCourse,
      newCourse,
      setNewCourse,
      importOpen,
      setImportOpen,
      settingsOpen,
      setSettingsOpen,
      startFor,
      requestStart,
      repeatFor,
      openRepeat,
      toast,
      confirm,
    }),
    [itemId, newItem, courseId, newCourse, importOpen, settingsOpen, startFor, repeatFor, toast, confirm],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Sheet open={!!asking} onClose={() => answer(false)} mode="center" label={asking?.title || "Confirm"}>
        {asking && (
          <div className="p-6">
            <h3 className="text-[17px] font-semibold text-ink">{asking.title}</h3>
            {asking.body && <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{asking.body}</p>}
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="danger" size="lg" className="border border-[rgba(224,92,89,0.35)]" onClick={() => answer(true)}>
                {asking.confirmLabel || "Delete"}
              </Button>
              <Button variant="ghost" onClick={() => answer(false)} autoFocus>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Sheet>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(24px+var(--safe-bottom))] z-[95] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              className="rounded-lg border border-line bg-card-2 px-3.5 py-2 text-[13px] text-ink shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUI outside provider");
  return c;
}
