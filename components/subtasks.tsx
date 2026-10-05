"use client";

import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { GripVertical, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addSubtask, setSubtasks, shortId, toggleSubtask } from "@/lib/actions";
import { POINTS } from "@/lib/points";
import { useStore } from "@/lib/store";
import type { Item, Subtask } from "@/lib/types";
import { celebrate } from "./celebrate";
import { Check, cn, useAutoHeight } from "./ui";
import { useUI } from "./ui-state";

export function useToggleSubtask() {
  const { uid } = useStore();
  const { toast } = useUI();
  return (item: Item, s: Subtask, e?: { clientX: number; clientY: number }) => {
    const next = !s.done;
    if (next) celebrate({ points: POINTS.subtask, x: e?.clientX, y: e?.clientY });
    toggleSubtask(uid, item, s.id, next).catch(() => toast("Couldn't save that — try again"));
  };
}

export function SubtaskList({ item, placeholder = "Add a step" }: { item: Item; placeholder?: string }) {
  const { uid } = useStore();
  const ui = useUI();
  // Latest item for handlers that finish after an await (the delete confirmation).
  const itemRef = useRef(item);
  useEffect(() => {
    itemRef.current = item;
  });
  const toggle = useToggleSubtask();
  const [order, setOrder] = useState<string[]>(() => item.subtasks.map((s) => s.id));
  const [focusId, setFocusId] = useState<string | null>(null);
  const dragging = useRef(false);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(draftRef, draft);

  useEffect(() => {
    if (!dragging.current) setOrder(item.subtasks.map((s) => s.id));
  }, [item.subtasks]);

  const byId = new Map(item.subtasks.map((s) => [s.id, s]));
  const list = order.map((id) => byId.get(id)).filter(Boolean) as Subtask[];

  const commitTitle = (id: string, title: string) => {
    const cur = item;
    const s = cur.subtasks.find((x) => x.id === id);
    if (!s || s.title === title) return;
    setSubtasks(uid, cur, cur.subtasks.map((x) => (x.id === id ? { ...x, title } : x)));
  };

  const insertAfter = async (id: string) => {
    const cur = item;
    const idx = cur.subtasks.findIndex((x) => x.id === id);
    const s = await addSubtask(uid, cur, "", idx + 1);
    setFocusId(s.id);
  };

  /** Blank steps go straight away (Backspace on an empty line); a step with words in it asks first. */
  const remove = async (id: string, text: string) => {
    if (text.trim()) {
      const ok = await ui.confirm({ title: `Delete the step “${text.trim()}”?`, confirmLabel: "Delete step" });
      if (!ok) return;
    }
    const cur = itemRef.current;
    const idx = cur.subtasks.findIndex((x) => x.id === id);
    const prev = cur.subtasks[idx - 1];
    setSubtasks(uid, cur, cur.subtasks.filter((x) => x.id !== id));
    if (prev) setFocusId(prev.id);
  };

  const addDraft = () => {
    const t = draft.trim();
    if (!t) return;
    const s: Subtask = { id: shortId(), title: t, done: false };
    setSubtasks(uid, item, [...item.subtasks, s]);
    setDraft("");
  };

  return (
    <div>
      <Reorder.Group
        axis="y"
        values={order}
        onReorder={(o) => {
          dragging.current = true;
          setOrder(o);
        }}
        className="flex flex-col"
      >
        <AnimatePresence initial={false}>
          {list.map((s) => (
            <SubtaskRow
              key={s.id}
              s={s}
              autoFocus={focusId === s.id}
              onFocused={() => setFocusId(null)}
              onToggle={(e) => toggle(item, s, e)}
              onCommit={(t) => commitTitle(s.id, t)}
              onEnter={() => insertAfter(s.id)}
              onRemove={(text) => remove(s.id, text)}
              onDragEnd={() => {
                dragging.current = false;
                const cur = item;
                const m = new Map(cur.subtasks.map((x) => [x.id, x]));
                const next = order.map((id) => m.get(id)).filter(Boolean) as Subtask[];
                if (next.map((x) => x.id).join() !== cur.subtasks.map((x) => x.id).join()) setSubtasks(uid, cur, next);
              }}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <div className="flex items-start gap-3 rounded-md px-1 py-1.5 text-ink-3 focus-within:text-ink">
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
          <Plus className="h-4 w-4" />
        </span>
        <textarea
          ref={draftRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          onBlur={addDraft}
          placeholder={placeholder}
          enterKeyHint="done"
          className="ghost-input min-w-0 flex-1 resize-none overflow-hidden break-words text-[15px] leading-[22px] text-ink"
        />
      </div>
    </div>
  );
}

function SubtaskRow({
  s,
  autoFocus,
  onFocused,
  onToggle,
  onCommit,
  onEnter,
  onRemove,
  onDragEnd,
}: {
  s: Subtask;
  autoFocus: boolean;
  onFocused: () => void;
  onToggle: (e: React.MouseEvent) => void;
  onCommit: (t: string) => void;
  onEnter: () => void;
  /** called with the row's current text */
  onRemove: (text: string) => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const [text, setText] = useState(s.title);
  const editing = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(ref, text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing.current) setText(s.title);
  }, [s.title]);

  useEffect(() => {
    if (autoFocus) {
      ref.current?.focus();
      onFocused();
    }
  }, [autoFocus, onFocused]);

  const schedule = (t: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(t), 600);
  };

  return (
    <Reorder.Item
      value={s.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      className="group relative"
      whileDrag={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8, zIndex: 5 }}
    >
      <div className="flex items-start gap-3 rounded-md px-1 py-1.5">
        <button
          onPointerDown={(e) => controls.start(e)}
          className="absolute -left-5 top-[9px] hidden h-6 w-4 cursor-grab touch-none items-center justify-center text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 md:flex"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="flex h-[22px] shrink-0 items-center">
          <Check checked={s.done} onChange={(_, e) => onToggle(e)} round={false} size={20} label={s.title || "step"} />
        </span>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onFocus={() => (editing.current = true)}
          onBlur={() => {
            editing.current = false;
            if (timer.current) clearTimeout(timer.current);
            onCommit(text);
          }}
          onChange={(e) => {
            const v = e.target.value.replace(/\n/g, " ");
            setText(v);
            schedule(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit(text);
              onEnter();
            } else if (e.key === "Backspace" && !text) {
              e.preventDefault();
              onRemove("");
            }
          }}
          placeholder="Untitled step"
          enterKeyHint="next"
          className={cn(
            "ghost-input min-w-0 flex-1 resize-none overflow-hidden break-words text-[15px] leading-[22px] transition-colors duration-300",
            s.done ? "text-ink-3 line-through decoration-ink-3" : "text-ink",
          )}
        />
        <span
          onPointerDown={(e) => controls.start(e)}
          className="-my-0.5 flex h-[26px] w-5 shrink-0 cursor-grab touch-none items-center justify-center text-ink-3 md:hidden"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button
          onClick={() => onRemove(text)}
          aria-label="Remove step"
          className="-my-0.5 flex h-[26px] w-7 shrink-0 items-center justify-center rounded text-ink-3 opacity-60 hover:bg-hover hover:text-ink md:opacity-0 md:group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </Reorder.Item>
  );
}

export function SuggestionChips({ item, suggestions }: { item: Item; suggestions: string[] }) {
  const { uid } = useStore();
  const existing = new Set(item.subtasks.map((s) => s.title.toLowerCase()));
  const left = suggestions.filter((s) => !existing.has(s.toLowerCase()));
  if (!left.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {left.map((s) => (
        <motion.button
          key={s}
          whileTap={{ scale: 0.94 }}
          onClick={() => addSubtask(uid, item, s)}
          className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12.5px] text-ink-2 hover:bg-hover hover:text-ink"
        >
          <Plus className="h-3 w-3" />
          {s}
        </motion.button>
      ))}
    </div>
  );
}
