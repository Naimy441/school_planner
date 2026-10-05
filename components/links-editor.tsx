"use client";

import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { shortId } from "@/lib/actions";
import type { CourseLink } from "@/lib/types";
import { Button, cn, IconButton, inputCls } from "./ui";
import { useUI } from "./ui-state";

/** Accepts "canvas.school.edu/…" as well as full URLs; only web links are kept. */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinksEditor({ links, onChange }: { links: CourseLink[]; onChange: (links: CourseLink[]) => void }) {
  const ui = useUI();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  // The confirm dialog is async, so removal reads the latest list rather than the one it was opened with.
  const linksRef = useRef(links);
  useEffect(() => {
    linksRef.current = links;
  });

  const add = () => {
    const href = normalizeUrl(url);
    if (!href)
      return ui.toast(
        /^file:/i.test(url.trim())
          ? "Browsers can't open files on your computer from a link — use a Drive/Dropbox/iCloud link instead"
          : url.trim()
            ? "That doesn't look like a web link"
            : "Paste a link first",
      );
    const name = title.trim();
    onChange([...links, { id: shortId(), url: href, ...(name ? { title: name } : {}) }]);
    setTitle("");
    setUrl("");
  };
  const onEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {links.length > 0 && (
        <div className="rounded-xl border border-line bg-app/50 p-1">
          <AnimatePresence initial={false}>
            {links.map((l) => (
              <motion.div
                key={l.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1 rounded-lg hover:bg-hover">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0 text-ink-3" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] text-ink">{l.title || hostOf(l.url)}</div>
                      <div className="truncate text-[12px] text-ink-3">{l.title ? hostOf(l.url) : l.url}</div>
                    </div>
                  </a>
                  <IconButton
                    label={`Remove ${l.title || hostOf(l.url)}`}
                    onClick={async () => {
                      const ok = await ui.confirm({ title: `Remove “${l.title || hostOf(l.url)}”?`, body: l.url, confirmLabel: "Remove link" });
                      if (ok) onChange(linksRef.current.filter((x) => x.id !== l.id));
                    }}
                    className="mr-1 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={onEnter} placeholder="Name (optional)" className={cn(inputCls, "sm:w-[38%]")} />
        <div className="flex min-w-0 flex-1 gap-2">
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={onEnter}
            placeholder="https://"
            className={cn(inputCls, "min-w-0 flex-1")}
          />
          <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={add} disabled={!url.trim()}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
