// Fetches a calendar subscription URL server-side (browsers can't, because of CORS).
// Guarded so it can only be used to read public .ics feeds.

const MAX_BYTES = 5_000_000;

function blockedHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (h.includes(":")) return true; // no raw IPv6 literals
  return false;
}

function normalise(raw: string) {
  let s = raw.trim();
  if (s.startsWith("webcal://")) s = "https://" + s.slice(9);
  const u = new URL(s);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http(s) and webcal links are supported.");
  if (blockedHost(u.hostname)) throw new Error("That address isn't allowed.");
  return u;
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return new Response("Missing url", { status: 400 });
  let target: URL;
  try {
    target = normalise(raw);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Invalid link", { status: 400 });
  }

  try {
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        headers: { accept: "text/calendar, text/plain;q=0.9, */*;q=0.5", "user-agent": "PlannerCalendarImport/1.0" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        target = normalise(new URL(res.headers.get("location")!, target).toString());
        continue;
      }
      break;
    }
    if (!res || !res.ok) return new Response("The calendar server didn't return the file.", { status: 502 });
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return new Response("That calendar is too large.", { status: 413 });
    const text = await res.text();
    if (text.length > MAX_BYTES) return new Response("That calendar is too large.", { status: 413 });
    if (!text.includes("BEGIN:VCALENDAR")) return new Response("That link isn't an .ics calendar.", { status: 422 });
    return new Response(text, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" } });
  } catch {
    return new Response("Couldn't reach that calendar.", { status: 502 });
  }
}
