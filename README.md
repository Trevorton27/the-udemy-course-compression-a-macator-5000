# The Udemy Course Compress-a-macator 5000

> *"Folks, have I got a deal for YOU!"*

Step right up, step right UP, ladies and gentlemen, and feast your eyes on the MARVEL of the modern age — **The Udemy Course Compress-a-macator 5000!** That's right, friend, while your neighbors are sitting through FORTY hours of video content, YOU could be blazing through a surgically compressed learning path in a FRACTION of the time!

She scrapes! She scans! She OPTIMIZES! And if you call in the next ten minutes, she'll even generate you an AI-powered study plan courtesy of Claude himself!

But wait — **THERE'S MORE.**

---

## ⚠️ Now Hold Your Horses, Partner — Read This First

*[Salesman lowers voice to a conspiratorial whisper]*

Listen here. This machine works exclusively on courses **you have purchased and are fully authorized to access**. We're talking logged-in, paid-up, card-on-file Udemy access. This beauty reads only what a logged-in user can already see in their own browser — visible text, nothing more.

Do NOT use this to access content you haven't purchased. Do NOT redistribute course content. This is a **personal study tool**, built for the sole purpose of helping YOU — yes, YOU, the busy go-getter — make the most of courses you've already paid good money for.

Violate that, and frankly, you deserve whatever comes next. *We don't make the rules, we just live by them.*

---

## 🎰 RESULTS MAY VARY, FRIEND — AND HERE'S WHY

*[Host gestures dramatically at fine print]*

Now I want to be straight with you, because that's the kind of honest, trustworthy operation we run here at Compress-a-macator Industries. Udemy — bless their hearts — has a DOM structure that changes with the seasons. The sidebar, the transcript panel, the curriculum items... they can and DO shift around like furniture in a haunted house.

**If this machine starts acting up — clicking on things that ain't there, missing lectures, coming back empty-handed — you're going to want a coding LLM on speed dial.** Your Claude Code, your Cursor, your Copilot — whichever digital assistant you keep in your back pocket. Because when Udemy updates their front-end and suddenly `[data-purpose="curriculum-item-6-0"]` doesn't exist anymore, you're going to need to pop open Chrome DevTools and update a selector or two in `src/types.ts`.

It ain't a bug. It's just the nature of the beast. All selectors live right there in the `SELECTORS` object — they're fallback arrays, so you just add your new one at the front and you're back in business, slick as a whistle.

*Works best locally. Has absolutely no business being anywhere near a server, a Docker container, or your company's CI pipeline.*

---

## Requirements

- Node.js 20+
- A Udemy account with **legitimate, purchased access** to the course you want to extract
- A coding LLM on standby for when Udemy inevitably redecorates their DOM *(see above)*

---

## Setup

```bash
# Install dependencies
npm install

# Install Playwright's Chromium browser
npx playwright install chromium

# Copy and edit env file
cp .env.example .env
```

`.env` settings:

| Variable | Default | Description |
|---|---|---|
| `UDEMY_PROFILE_DIR` | `./browser-profile` | Chromium persistent profile path (keeps you logged in between runs) |
| `DELAY_MIN_MS` | `1500` | Minimum polite delay between lectures (ms) |
| `DELAY_MAX_MS` | `3500` | Maximum polite delay between lectures (ms) |
| `PORT` | `3001` | Express API server port |
| `ANTHROPIC_API_KEY` | *(none)* | Required for AI-powered optimization mode only |

---

## Web UI — The Star of the Show!

*"She's a BEAUT, Clark."*

```bash
npm run dev:ui
```

Point your browser at **http://localhost:5173** and behold the full Compress-a-macator experience:

- **UI:** http://localhost:5173
- **API:** http://localhost:3001

### Extraction Modes

| Mode | What She Does |
|---|---|
| `scrape` | Raw transcript extraction — pure, uncut knowledge |
| `scan` | Extraction + course inventory with topic classification |
| `optimize-all` | The full monty — extract, scan, and generate an optimized study plan |
| `optimize-selected` | Two-pass: extract and scan, then YOU pick which sections matter |
| `optimize-build-first` | Build-first ordering — all hands-on lectures before the theory |
| `optimize-ai` | **THE GRAND FINALE** — Claude analyzes every lecture and synthesizes a compressed learning path *(requires `ANTHROPIC_API_KEY`)* |

### Login Flow

First run opens a Chromium window. Log in manually, then hit **"Confirm Login"** in the UI. Subsequent runs remember your session automatically. *Like a good neighbor, Chromium is there.*

---

## CLI Usage

### Scrape a course

```bash
npm run scrape -- "https://www.udemy.com/course/your-course-slug/"
```

### Scan (inventory from existing transcripts)

```bash
npm run scan -- output/Course-Title/transcripts.json
```

### Optimize (generate study plan)

```bash
npm run optimize -- output/Course-Title/transcripts.json
```

---

## Output Structure

```
output/
  Course-Title/
    course-map.json              <- Full lecture list with URLs and sections
    transcripts.json             <- Structured JSON of all lecture results
    combined-transcript.md       <- Every transcript in one glorious file
    skipped.json                 <- Lectures without a transcript panel
    errors.json                  <- Lectures that gave us trouble
    course-inventory.json        <- Structured inventory (scan/optimize modes)
    course-inventory.md          <- Human-readable inventory table
    optimized-learning-plan.md   <- Full course study plan
    selected-learning-plan.md    <- Targeted plan (selected mode)
    build-first-plan.md          <- Build-first ordered plan
    ai-learning-plan.json        <- AI-generated compressed learning path
    01-Section-Title/
      001-Lecture-Title.md
      002-Lecture-Title.md
```

---

## When Things Go Sideways (And They Will, Friend)

*[Salesman puts hand on your shoulder]*

### Transcripts coming back empty

Udemy moved the furniture again. Open Chrome DevTools on a lecture page, find the transcript toggle button and cue rows, and update the relevant selectors in the `SELECTORS` object in `src/types.ts`. Each key is an array of fallbacks — put your new one first.

**This is the #1 reason to have a coding LLM nearby.** Paste the DevTools HTML snippet, ask it to give you the updated selector, drop it in the array. Two minutes. Done.

### "Login verification failed"

The logged-in indicator selector went stale. Find the current logged-in element (avatar, account menu, whatever Udemy is calling it this week) and update `SELECTORS.loggedInIndicator` in `src/types.ts`.

### Missing lectures / incomplete course map

Delete `course-map.json` and re-run. The click-through discovery will re-crawl the entire sidebar from scratch.

### Lectures from a certain point onwards all fail to click

Udemy's virtual-scrolling sidebar may not be scrolling items into view properly. Again — DevTools, coding LLM, `src/course-map.ts`. *We believe in you.*

---

## Development

```bash
npm run typecheck    # TypeScript check (no build)
npm run build:ui     # Build UI to dist-ui/
npm test             # Run unit tests
npm run dev:ui       # Dev server (UI + API together)
```

### Project Structure

```
src/
  index.ts                    <- CLI entry (scrape)
  scan.ts                     <- CLI entry (scan/inventory)
  optimize.ts                 <- CLI entry (optimize/study plan)
  auth.ts                     <- Playwright login detection
  browser.ts                  <- Chromium launcher
  course-map.ts               <- Lecture discovery (anchor scan + click-through)
  transcript-extractor.ts     <- Transcript panel interaction
  formatter.ts                <- Lecture result → Markdown
  storage.ts                  <- File write helpers
  types.ts                    <- Shared types + SELECTORS registry ← UPDATE THIS WHEN DOM BREAKS
  optimizer/
    courseInventory.ts        <- Build CourseInventory from transcripts
    contentClassifier.ts      <- Classify lectures (build/watch/skim/skip)
    studyPlanGenerator.ts     <- Generate StudyPlan
    markdownWriter.ts         <- Write inventory + plan markdown
    buildFirstPlanGenerator.ts <- Build-first ordering logic
    aiAnalyzer.ts             <- Two-pass Claude analysis (Haiku + Sonnet)
    aiClient.ts               <- Anthropic SDK wrapper
  server/
    index.ts                  <- Express app (port 3001)
    jobs/
      jobStore.ts             <- In-memory job store + SSE fan-out
      jobRunner.ts            <- All job runners
    routes/                   <- API route handlers
  ui/                         <- React/Vite frontend
```

---

*The Udemy Course Compress-a-macator 5000 is not affiliated with, endorsed by, or in any way connected to Udemy, Inc. It is a personal productivity tool for use by authorized course owners only. The management assumes no responsibility for broken selectors, Udemy front-end updates, existential crises triggered by how much content you've been skipping, or any general feelings of having paid too much for a course you could have finished in four hours. Results may vary. Batteries not included.*
