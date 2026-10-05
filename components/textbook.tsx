"use client";

import { ExternalLink, FileText, Paperclip, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { patchCourse, shortId } from "@/lib/actions";
import { deleteLocalFile, getLocalFile, openLocalFile, putLocalFile, type LocalFile } from "@/lib/local-files";
import { useStore } from "@/lib/store";
import type { Course, Textbook } from "@/lib/types";
import { Field } from "./repeat-fields";
import { Button, cn, IconButton, inputCls } from "./ui";
import { useUI } from "./ui-state";

const isWebUrl = (u?: string) => !!u && /^https?:\/\//i.test(u.trim());
const isFileUrl = (u?: string) => !!u && /^file:/i.test(u.trim());

/** The copy of a textbook file kept on this device, if any. */
function useLocalFile(key?: string) {
  const [file, setFile] = useState<LocalFile | null>(null);
  const refresh = useCallback(() => {
    if (!key) return setFile(null);
    getLocalFile(key).then(setFile);
  }, [key]);
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, [refresh]);
  return { file, refresh };
}

/** Saves the picked file on this device and returns the textbook with its key/name. */
async function attach(textbook: Textbook, f: File): Promise<Textbook> {
  const fileKey = textbook.fileKey || shortId();
  await putLocalFile(fileKey, f);
  return { ...textbook, fileKey, fileName: f.name, title: textbook.title || f.name.replace(/\.[a-z0-9]+$/i, "") };
}

function FilePickButton({ label, onPick, variant = "secondary" }: { label: string; onPick: (f: File) => void; variant?: "secondary" | "ghost" | "primary" }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept="application/pdf,.pdf,.epub,.djvu,image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
      <Button type="button" variant={variant} size="sm" icon={<Paperclip className="h-3.5 w-3.5" />} onClick={() => ref.current?.click()}>
        {label}
      </Button>
    </>
  );
}

/** In the class form, for a textbook that's a file (a PDF on your computer). */
export function TextbookFileField({ textbook, onChange }: { textbook: Textbook; onChange: (t: Textbook) => void }) {
  const ui = useUI();
  const { file, refresh } = useLocalFile(textbook.fileKey);
  const pick = async (f: File) => {
    try {
      onChange(await attach(textbook, f));
      refresh();
    } catch {
      ui.toast("Couldn't save that file on this device");
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 text-[12.5px] font-medium text-ink-2">The file</div>
        {file ? (
          <div className="flex items-center gap-2 rounded-md border border-line bg-hover px-2.5 py-1.5">
            <FileText className="h-4 w-4 shrink-0 text-ink-3" />
            <button type="button" onClick={() => openLocalFile(file)} className="min-w-0 flex-1 truncate text-left text-[14px] text-accent hover:underline">
              {file.name}
            </button>
            <FilePickButton label="Replace" variant="ghost" onPick={pick} />
            <IconButton
              label="Remove the file from this device"
              onClick={async () => {
                const ok = await ui.confirm({ title: `Remove “${file.name}” from this device?`, body: "The class keeps its textbook. You can pick the file again any time.", confirmLabel: "Remove" });
                if (!ok || !textbook.fileKey) return;
                await deleteLocalFile(textbook.fileKey).catch(() => {});
                refresh();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <FilePickButton label={textbook.fileName ? `Choose “${textbook.fileName}”` : "Choose the file"} onPick={pick} />
            <span className="text-[12px] text-ink-3">
              {textbook.fileName ? "It was added on another device — pick it here too." : "Kept on this device and opened from here."}
            </span>
          </div>
        )}
      </div>
      <Field label="Or a link that opens everywhere (optional)" hint="A Drive / Dropbox / iCloud link works on your phone and laptop.">
        <input
          type="url"
          value={textbook.url || ""}
          onChange={(e) => onChange({ ...textbook, url: e.target.value })}
          placeholder="https://"
          className={inputCls}
        />
      </Field>
      {isFileUrl(textbook.url) && (
        <p className="-mt-1 text-[12.5px] leading-relaxed text-warn">
          Browsers can&apos;t open <b>file://</b> links from a website. Choose the file above instead — it&apos;ll open straight from the planner.
        </p>
      )}
    </div>
  );
}

/** On a reading task: open the class's textbook (or attach it here), with a shortcut to edit it. */
export function TextbookOpen({ course }: { course: Course }) {
  const { uid } = useStore();
  const ui = useUI();
  const tb = course.textbook;
  const { file, refresh } = useLocalFile(tb.kind === "file" ? tb.fileKey : undefined);
  const title = tb.title || (tb.kind === "physical" ? "Physical copy" : "Textbook");

  const pick = async (f: File) => {
    try {
      const textbook = await attach(tb, f);
      await patchCourse(uid, course.id, { textbook });
      refresh();
    } catch {
      ui.toast("Couldn't save that file on this device");
    }
  };

  let body: React.ReactNode;
  if (tb.kind === "physical") {
    body = <span className="px-2 text-[14px] text-ink-2">{title} · bring it along</span>;
  } else if (file) {
    body = (
      <button onClick={() => openLocalFile(file)} className="inline-flex h-[30px] min-w-0 items-center gap-1.5 rounded-md px-2 text-[14px] text-accent hover:bg-hover">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{title}</span>
      </button>
    );
  } else if (isWebUrl(tb.url)) {
    body = (
      <a href={tb.url} target="_blank" rel="noreferrer" className="inline-flex h-[30px] min-w-0 items-center gap-1.5 rounded-md px-2 text-[14px] text-accent hover:bg-hover">
        <span className="truncate">{title}</span> <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </a>
    );
  } else {
    body = (
      <div className="flex flex-col items-start gap-1 px-2 pt-[3px]">
        <span className="text-[14px] text-ink-2">{title}</span>
        {tb.kind === "file" || isFileUrl(tb.url) ? (
          <>
            {isFileUrl(tb.url) && (
              <span className="text-[12px] leading-relaxed text-ink-3">Browsers can&apos;t open file:// links — pick the file once and it opens from here.</span>
            )}
            <FilePickButton label={tb.fileName ? `Choose “${tb.fileName}”` : "Choose the file"} onPick={pick} />
          </>
        ) : (
          <span className="text-[12px] text-ink-3">No link yet</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-start justify-between gap-1")}>
      <div className="min-w-0">{body}</div>
      <IconButton label="Edit textbook" onClick={() => ui.openCourse(course.id)} className="shrink-0">
        <Pencil className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}
