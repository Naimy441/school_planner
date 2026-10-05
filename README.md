# Planner

A calm, Notion-dark planner for school: classes, exams and assignments in one view, focus timers that sync across every device, and points/progress that make finishing things feel good. Mobile-first (install it to your iPhone home screen), fully tuned for desktop, plus a macOS menu bar companion.

**Overview → Today → Focus → Progress**, with **Classes** for setup.

## What it does

- **Classes** — import a timetable `.ics` (file or subscribe link), or add classes by hand. Lectures/labs are grouped per course, and exams in the calendar are detected.
- **Exams & assignments** — one-off or **weekly recurring** assignments, with an optional **late deadline**. Overdue work stays visible with gentle wording; an assignment drops off only once its late deadline passes. Exams leave the view after they happen.
- **Textbooks** — give a class a textbook (physical, online link, or a link to a file) and a "read & take notes" task appears automatically on each class day.
- **Break it down** — every task opens as a Notion-style page: drag-to-reorder steps you write yourself, a work spot, a reward, and notes. Exams less than a week away are spotlighted and ask for a study plan.
- **Get ready gate** — you can't start until you've picked a spot, checked in there (worth points), and put distractions away.
- **Priority nudge** — start something that isn't due first and you get a kind heads-up with a one-tap switch.
- **Focus timer** — 10/3, 20/10, 25/5, 50/10, 1h/15, 2h/30 or custom, adjustable mid-session. Shows only the current and next step, and you can add steps as you go. The timer lives in Firestore, so the phone, the laptop and the menu bar all show the same countdown. Phase changes are transactional, so several open devices never double-count.
- **Class time** — while a class is starting or in session, the app goes full-screen until you tap "I'm in class". Classes that ended while the app was closed get a quick "did you make it?" check-in. Attendance is tracked per class.
- **Progress** — points, levels, a daily goal ring, streaks, a 14-day focus chart, a 16-week activity heatmap, and attendance rates.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · Motion · Firebase Auth (Google) + Firestore with offline persistence · Vercel.

Data is only ever under `users/{uid}`. `firestore.rules` gives users access to their own tree only, shape-checks every write, and denies everything else. It's already deployed to `school-planner-8fd73`. Redeploy after changing it with `npm run deploy:rules`.

## One-time setup to go live

1. **Enable Google sign-in:** [Firebase console](https://console.firebase.google.com/project/school-planner-8fd73/authentication/providers) → Authentication → Sign-in method → Google → Enable.
2. **Deploy:** `vercel --prod` (or import the repo in Vercel). No env vars are required for desktop browsers.
3. **Authorize the domain:** Firebase → Authentication → Settings → Authorized domains → add your Vercel domain (e.g. `planner-xyz.vercel.app`).
4. **iOS home-screen sign-in** (needed because Safari partitions storage for home-screen apps):
   - In [Google Cloud → Credentials](https://console.cloud.google.com/apis/credentials?project=school-planner-8fd73), open the "Web client (auto created by Google Service)" and add `https://YOUR-DOMAIN/__/auth/handler` to **Authorized redirect URIs**.
   - In Vercel, set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR-DOMAIN` and redeploy. The app already proxies `/__/auth/*` to Firebase (see `next.config.ts`).
5. On your iPhone, open the site in Safari → Share → **Add to Home Screen**.

## Mac menu bar widget

```bash
APP_URL=https://YOUR-DOMAIN ./widget/build.sh
open "widget/build/Planner Bar.app"
```

Click the ✓ in the menu bar → **Connect account**. Your browser opens `/link-widget`, you confirm, and it hands the app a sign-in token through the `plannerbar://` URL scheme. The token is stored in your Keychain. The widget shows the live countdown in the menu bar, plus the current and next step (you can check steps off), pause/resume/skip, your next class, and what's up next. It uses the Firestore REST API as you, so the same security rules apply. Drag the app into /Applications and add it to Login Items to keep it running.

## Local development

```bash
npm install
npm run emulators       # Auth + Firestore emulators (needs Java)
npm run dev:emulator    # app against the emulators, with a "test account" sign-in button
```

`npm run dev` runs against the real project.
