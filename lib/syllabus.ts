"use client";

import { format } from "date-fns";

/**
 * Reads a syllabus (PDFs, screenshots, pasted text) with OpenAI and pulls out
 * the class details, exams and assignments. Runs in the browser with the
 * user's own API key, which goes straight to OpenAI and nowhere else.
 */

export const DEFAULT_AI_MODEL = "gpt-5-mini";

export interface SyllabusMeeting {
  label: string | null;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  start: string;
  end: string;
  location: string | null;
}

export interface SyllabusExam {
  title: string;
  date: string | null;
  time: string | null;
  location: string | null;
  during_class: boolean;
  notes: string | null;
}

export interface SyllabusAssignment {
  title: string;
  due_date: string | null;
  due_time: string | null;
  notes: string | null;
}

export interface SyllabusWeekly {
  title: string;
  days: number[];
  time: string | null;
}

export interface SyllabusResult {
  course: {
    name: string | null;
    code: string | null;
    location: string | null;
    term_start: string | null;
    term_end: string | null;
    meetings: SyllabusMeeting[];
    textbook_title: string | null;
    textbook_url: string | null;
    links: { title: string | null; url: string }[];
  };
  exams: SyllabusExam[];
  assignments: SyllabusAssignment[];
  weekly_assignments: SyllabusWeekly[];
}

const str = { type: "string" } as const;
const nstr = { type: ["string", "null"] } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const days = { type: "array", items: { type: "integer", description: "0 = Sunday … 6 = Saturday" } };

const SCHEMA = obj({
  course: obj({
    name: { ...nstr, description: "Course title, e.g. 'Discrete Mathematics'" },
    code: { ...nstr, description: "Course code, e.g. 'CS 270'" },
    location: { ...nstr, description: "Usual room / building" },
    term_start: { ...nstr, description: "First day of classes, YYYY-MM-DD" },
    term_end: { ...nstr, description: "Last day of classes, YYYY-MM-DD" },
    meetings: {
      type: "array",
      description: "Weekly class meetings (lecture, lab, recitation…)",
      items: obj({ label: nstr, days, start: { ...str, description: "HH:mm, 24h" }, end: { ...str, description: "HH:mm, 24h" }, location: nstr }),
    },
    textbook_title: nstr,
    textbook_url: { ...nstr, description: "Only an http(s) link given in the syllabus" },
    links: { type: "array", description: "Useful course links given in the syllabus (course site, LMS, notes, office hours booking)", items: obj({ title: nstr, url: str }) },
  }),
  exams: {
    type: "array",
    description: "Midterms, finals, quizzes and tests",
    items: obj({
      title: str,
      date: { ...nstr, description: "YYYY-MM-DD" },
      time: { ...nstr, description: "Start time HH:mm (24h) if stated" },
      location: nstr,
      during_class: { type: "boolean", description: "true if it takes place in a regular class meeting" },
      notes: { ...nstr, description: "What it covers, if stated — one short line" },
    }),
  },
  assignments: {
    type: "array",
    description: "One-off graded deliverables with a due date: homework, problem sets, projects, papers, presentations",
    items: obj({
      title: str,
      due_date: { ...nstr, description: "YYYY-MM-DD" },
      due_time: { ...nstr, description: "HH:mm (24h) if stated" },
      notes: { ...nstr, description: "One short line, if useful" },
    }),
  },
  weekly_assignments: {
    type: "array",
    description: "Work that repeats every week on the same day (e.g. 'reading responses due every Friday'). Don't also list each week in assignments.",
    items: obj({ title: str, days, time: { ...nstr, description: "HH:mm (24h) if stated" } }),
  },
});

function instructions(today: Date, className?: string) {
  return [
    "You read college course syllabi and extract what a student needs in their planner.",
    `Today is ${format(today, "EEEE, MMMM d, yyyy")}.`,
    className ? `This syllabus is for the student's class "${className}".` : "",
    "Rules:",
    "- Only use what the documents say. Never invent dates, times, rooms or links. Use null when something isn't stated.",
    "- Write every date as YYYY-MM-DD. If a year is missing, use the term the syllabus covers (the one nearest today).",
    "- Times are 24h HH:mm. Days of the week are numbers: 0 = Sunday, 1 = Monday … 6 = Saturday.",
    "- Quizzes, tests, midterms and finals go in exams. Graded deliverables with a single due date go in assignments.",
    "- If the same kind of work is due every week, put it once in weekly_assignments instead of listing every week.",
    "- Skip readings, lecture topics and anything with no deliverable.",
    "- Keep titles short and specific, like 'Midterm 1', 'Problem Set 3', 'Final project proposal'.",
  ]
    .filter(Boolean)
    .join("\n");
}

function readAs(file: Blob, how: "dataURL" | "text") {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    if (how === "dataURL") r.readAsDataURL(file);
    else r.readAsText(file);
  });
}

const isTextFile = (f: File) => f.type.startsWith("text/") || /\.(txt|md|csv|html?)$/i.test(f.name);

export class SyllabusError extends Error {}

export async function readSyllabus({
  apiKey,
  model,
  files,
  text,
  className,
  signal,
}: {
  apiKey: string;
  model?: string;
  files: File[];
  text: string;
  className?: string;
  signal?: AbortSignal;
}): Promise<SyllabusResult> {
  const content: Record<string, unknown>[] = [{ type: "input_text", text: "Here is the syllabus. Extract everything for my planner." }];
  for (const f of files) {
    if (f.type.startsWith("image/")) content.push({ type: "input_image", image_url: await readAs(f, "dataURL"), detail: "high" });
    else if (isTextFile(f)) content.push({ type: "input_text", text: `--- ${f.name} ---\n${await readAs(f, "text")}` });
    else content.push({ type: "input_file", filename: f.name || "syllabus.pdf", file_data: await readAs(f, "dataURL") });
  }
  if (text.trim()) content.push({ type: "input_text", text: text.trim() });

  const m = (model || DEFAULT_AI_MODEL).trim();
  const body: Record<string, unknown> = {
    model: m,
    instructions: instructions(new Date(), className),
    input: [{ role: "user", content }],
    text: { format: { type: "json_schema", name: "syllabus", strict: true, schema: SCHEMA } },
    store: false,
  };
  // Reasoning models think faster with low effort, and it's plenty for extraction.
  if (/^(gpt-5|gpt-6|o\d)/i.test(m)) body.reasoning = { effort: "low" };

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") throw e;
    throw new SyllabusError("Couldn't reach OpenAI — check your connection.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg: string = json?.error?.message || `OpenAI returned an error (${res.status}).`;
    if (res.status === 401) throw new SyllabusError("OpenAI didn't accept that API key. Check it in Settings.");
    if (res.status === 429) throw new SyllabusError(`OpenAI says: ${msg}`);
    throw new SyllabusError(msg);
  }
  const out = (json?.output || []) as { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
  const parts = out.filter((o) => o.type === "message").flatMap((o) => o.content || []);
  const refusal = parts.find((p) => p.type === "refusal");
  if (refusal) throw new SyllabusError(refusal.refusal || "The model declined to read that.");
  const raw = json?.output_text || parts.filter((p) => p.type === "output_text").map((p) => p.text).join("");
  try {
    return JSON.parse(raw) as SyllabusResult;
  } catch {
    throw new SyllabusError(json?.status === "incomplete" ? "That was too long to read in one go — try fewer pages." : "Couldn't make sense of the reply — try again.");
  }
}
