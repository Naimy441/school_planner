"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus, FileUp, Link2, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { createItem, saveCourse } from "@/lib/actions";
import { COLOR_KEYS, colorOf } from "@/lib/colors";
import { dayKey } from "@/lib/dates";
import { draftsFromIcs, type CourseDraft } from "@/lib/ics";
import { meetingSummary } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import type { ColorKey } from "@/lib/types";
import { Button, Check, cn, inputCls, Sheet } from "./ui";
import { useUI } from "./ui-state";

export function ImportSheet() {
  const ui = useUI();
  return (
    <Sheet open={ui.importOpen} onClose={() => ui.setImportOpen(false)} mode="center" label="Import calendar">
      {ui.importOpen && <ImportFlow />}
    </Sheet>
  );
}

interface Row extends CourseDraft {
  on: boolean;
  color: ColorKey;
  matchId?: string;
}

function ImportFlow() {
  const ui = useUI();
  const { uid, courses } = useStore();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ingest = (text: string) => {
    const drafts = draftsFromIcs(text);
    if (!drafts.length) {
      setErr("No classes found in that calendar. Make sure it's a timetable export (.ics).");
      return;
    }
    setErr("");
    const used = new Set(courses.map((c) => c.color));
    let ci = 0;
    setRows(
      drafts.map((d) => {
        const match = courses.find(
          (c) => (d.code && c.code?.toLowerCase() === d.code.toLowerCase()) || c.name.toLowerCase() === d.name.toLowerCase(),
        );
        let color = match?.color as ColorKey | undefined;
        if (!color) {
          const free = COLOR_KEYS.filter((k) => k !== "gray" && !used.has(k));
          color = (free[ci++ % Math.max(1, free.length)] || COLOR_KEYS[ci++ % COLOR_KEYS.length]) as ColorKey;
          used.add(color);
        }
        return { ...d, on: d.meetings.length > 0, color, matchId: match?.id };
      }),
    );
  };

  const readFile = async (f: File) => {
    if (f.size > 5_000_000) return setErr("That file is too big for a timetable.");
    ingest(await f.text());
  };

  const fetchUrl = async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/ics?url=${encodeURIComponent(url.trim())}`);
      if (!r.ok) throw new Error(await r.text());
      ingest(await r.text());
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Couldn't fetch that calendar.");
    } finally {
      setLoading(false);
    }
  };

  const doImport = async () => {
    if (!rows) return;
    setLoading(true);
    try {
      const chosen = rows.filter((r) => r.on);
      for (const r of chosen) {
        const existing = r.matchId ? courses.find((c) => c.id === r.matchId) : undefined;
        const id = await saveCourse(uid, {
          ...(existing || {
            textbook: { kind: "none" as const },
            createdAt: Date.now(),
          }),
          id: existing?.id,
          name: existing?.name || r.name,
          code: existing?.code || r.code || "",
          color: r.color,
          location: existing?.location || r.location || "",
          meetings: r.meetings,
          source: "ics",
        });
        for (const ex of r.exams) if (ex.due > Date.now()) createItem(uid, { kind: "exam", title: ex.title, due: ex.due, where: ex.where, courseId: id });
      }
      ui.toast(`Imported ${chosen.length} class${chosen.length === 1 ? "" : "es"} ✨`);
      ui.setImportOpen(false);
    } catch {
      setErr("Something went wrong saving — try again.");
    } finally {
      setLoading(false);
    }
  };

  if (rows) {
    const n = rows.filter((r) => r.on).length;
    return (
      <div className="flex max-h-[80dvh] flex-col">
        <div className="p-6 pb-3">
          <h3 className="text-[18px] font-semibold text-ink">Found {rows.length} class{rows.length === 1 ? "" : "es"}</h3>
          <p className="mt-1 text-[13px] text-ink-3">Pick what to bring in. You can add textbooks, exams and assignments after.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {rows.map((r, idx) => (
            <motion.div
              key={r.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-hover"
            >
              <div className="pt-1">
                <Check checked={r.on} round={false} size={20} onChange={(v) => setRows(rows.map((x, i) => (i === idx ? { ...x, on: v } : x)))} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: colorOf(r.color).dot }}
                    onClick={() =>
                      setRows(rows.map((x, i) => (i === idx ? { ...x, color: COLOR_KEYS[(COLOR_KEYS.indexOf(x.color) + 1) % COLOR_KEYS.length] } : x)))
                    }
                    aria-label="Change color"
                  />
                  <input
                    value={r.name}
                    onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                    className="ghost-input truncate text-[14.5px] font-medium text-ink"
                  />
                </div>
                <div className="mt-1 flex flex-col gap-0.5 text-[12px] text-ink-3">
                  {r.meetings.slice(0, 4).map((m) => (
                    <span key={m.id}>
                      {m.label ? `${m.label} · ` : ""}
                      {meetingSummary(m)}
                      {m.location ? ` · ${m.location}` : ""}
                    </span>
                  ))}
                  {r.meetings.length > 4 && <span>+{r.meetings.length - 4} more</span>}
                  {r.exams.length > 0 && <span className="text-accent">{r.exams.length} exam{r.exams.length > 1 ? "s" : ""} detected</span>}
                  {r.matchId && <span className="text-gold">Updates your existing class</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        {err && <p className="px-6 pt-2 text-[13px] text-danger">{err}</p>}
        <div className="flex justify-end gap-2 border-t border-line p-4">
          <Button variant="ghost" onClick={() => setRows(null)}>
            Back
          </Button>
          <Button variant="primary" disabled={!n || loading} onClick={doImport} icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
            Import {n}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <CalendarPlus className="h-5 w-5" />
      </div>
      <h3 className="text-[18px] font-semibold text-ink">Import your timetable</h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">
        Export your class schedule as an <b className="text-ink-2">.ics</b> file from your school portal, Google Calendar or Outlook.
      </p>
      <motion.button
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) readFile(f);
        }}
        animate={{ scale: drag ? 1.02 : 1 }}
        className={cn(
          "mt-5 flex w-full flex-col items-center rounded-xl border border-dashed px-4 py-8 transition-colors",
          drag ? "border-accent bg-accent-soft" : "border-line-2 hover:bg-hover",
        )}
      >
        <FileUp className="h-6 w-6 text-ink-2" />
        <span className="mt-2 text-[14px] font-medium text-ink">Choose .ics file</span>
        <span className="text-[12px] text-ink-3">or drop it here</span>
      </motion.button>
      <input
        ref={fileRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f);
          e.target.value = "";
        }}
      />
      <div className="my-5 flex items-center gap-3 text-[12px] text-ink-3">
        <div className="h-px flex-1 bg-line" /> or subscribe link <div className="h-px flex-1 bg-line" />
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https:// or webcal://…" className={cn(inputCls, "pl-8")} />
        </div>
        <Button variant="secondary" disabled={!url.trim() || loading} onClick={fetchUrl}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
        </Button>
      </div>
      <AnimatePresence>
        {err && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 text-[13px] text-danger">
            {err}
          </motion.p>
        )}
      </AnimatePresence>
      <p className="mt-5 text-[12px] text-ink-3">Times are read in your current time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Today is {dayKey()}.</p>
    </div>
  );
}
