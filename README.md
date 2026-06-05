# The Udemy Course Compression-a-macator 5000

A personal-study tool that uses Playwright to extract transcript text from Udemy courses, then generates structured learning plans from the extracted content. Available as both a CLI and a React/Express web UI.

**Output:** Local Markdown + JSON files. No video, no audio, no API interception — only reads visible text shown to logged-in users.

---

## Legal / Ethical Notice

Intended for **personal study use only** on courses you are authorized to access. It reads only what a logged-in user can see in the browser. Do not use it to redistribute course content or to access content you have not purchased.

---

## Requirements

- Node.js 20+
- A Udemy account with access to the course you want to extract

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
| `UDEMY_PROFILE_DIR` | `./browser-profile` | Path to store Chromium persistent profile (keeps login between runs) |
| `DELAY_MIN_MS` | `1500` | Minimum polite delay between lectures (ms) |
| `DELAY_MAX_MS` | `3500` | Maximum polite delay between lectures (ms) |
| `PORT` | `3001` | Express API server port |

---

## CLI Usage

### Scrape a course

```bash
npm run scrape -- "https://www.udemy.com/course/your-course-slug/"
```

On first run a headed Chromium window opens. Log in manually in the browser, then press **Enter** in the terminal. Subsequent runs use the stored browser profile and log in automatically.

Use `--overwrite` / `--force` to re-extract lectures that already have output files.

### Scan (inventory only — no scraping)

Builds a course inventory from an existing `transcripts.json` without re-scraping:

```bash
npm run scan -- output/Course-Title/transcripts.json
```

Outputs `course-inventory.json` and `course-inventory.md`.

### Optimize (generate study plan)

Generates an optimized learning plan from an existing `transcripts.json`:

```bash
npm run optimize -- output/Course-Title/transcripts.json
```

Outputs `optimized-learning-plan.md` with lectures classified as **build**, **watch**, **skim**, or **skip** based on content signals.

---

## Web UI

Start the Express API and Vite dev server together:

```bash
npm run dev:ui
```

- **UI:** http://localhost:5173
- **API:** http://localhost:3001

Or run them separately:

```bash
npm run server   # Express API only (port 3001)
npm run ui       # Vite dev server only (port 5173)
```

Build the UI for production:

```bash
npm run build:ui   # outputs to dist-ui/
```

### Scrape modes (via UI)

| Mode | Description |
|---|---|
| `scrape` | Extract transcripts only |
| `scan` | Extract transcripts + build course inventory |
| `optimize-all` | Extract + inventory + full optimized learning plan |
| `optimize-selected` | Two-step: extract + inventory, then user selects sections/topics for a targeted plan |

### Login flow (UI)

When the browser needs login the job pauses with status `waiting-for-login`. The UI displays a **"Confirm Login"** button. Log in inside the Chromium window, then click the button — the job resumes automatically.

### Real-time log streaming

All job output streams to the UI in real time via **Server-Sent Events** (SSE). Logs are also buffered server-side, so reconnecting replays the full history.

---

## Backend API Reference

Base URL: `http://localhost:3001`

### Jobs

#### `POST /api/jobs/scrape`

Start a scrape job.

**Body:**
```json
{
  "url": "https://www.udemy.com/course/your-course-slug/",
  "mode": "scrape" | "scan" | "optimize-all" | "optimize-selected"
}
```

**Response:** `{ "jobId": "<uuid>" }`

---

#### `POST /api/jobs/optimize`

Run the optimizer against an already-extracted `transcripts.json`.

**Body:**
```json
{
  "transcriptsPath": "output/Course-Title/transcripts.json",
  "mode": "all" | "selected",
  "criteria": {
    "sections": [1, 3],
    "technologies": ["python", "langchain"],
    "keyword": "rag"
  }
}
```

`criteria` is only used when `mode` is `"selected"`. All criteria fields are optional and combinable.

**Response:** `{ "jobId": "<uuid>" }`

---

#### `GET /api/jobs/:jobId`

Get job status and metadata.

**Response:**
```json
{
  "id": "<uuid>",
  "status": "pending" | "running" | "waiting-for-login" | "complete" | "failed",
  "params": { ... },
  "logCount": 42,
  "outputFiles": ["Course-Title/combined-transcript.md", ...],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

#### `GET /api/jobs/:jobId/events`

Subscribe to real-time job log stream (Server-Sent Events).

- Replays all buffered log events on connect
- Emits `data` events with `{ level, message, timestamp }` as each log line is produced
- Emits a final `event: done` with `{ status }` when the job finishes
- If the job is already complete when you connect, replays logs and sends `done` immediately

---

#### `POST /api/jobs/:jobId/login-confirmed`

Signal that the user has completed login in the browser window. Only valid when job status is `waiting-for-login`.

**Response:** `{ "ok": true }`

---

#### `GET /api/jobs/:jobId/files`

List output files produced by a job (paths relative to `output/`).

**Response:** `{ "files": ["Course-Title/transcripts.json", ...] }`

---

### Files

#### `GET /api/files/download?path=<relative-path>`

Download an output file. Path must be relative to the `output/` directory — path traversal attempts return `403`.

**Example:**
```
GET /api/files/download?path=Course-Title/combined-transcript.md
```

---

## Output Structure

```
output/
  Course-Title/
    course-map.json              <- Full lecture list with URLs and section metadata
    transcripts.json             <- Structured JSON of all lecture results
    combined-transcript.md       <- All transcripts concatenated into one file
    skipped.json                 <- Lectures with no transcript panel
    errors.json                  <- Lectures that failed extraction
    course-inventory.json        <- Structured inventory (scan/optimize modes)
    course-inventory.md          <- Human-readable inventory table
    optimized-learning-plan.md   <- Full course study plan (optimize-all mode)
    selected-learning-plan.md    <- Filtered study plan (optimize-selected mode)
    01-Section-Title/
      001-Lecture-Title.md
      002-Lecture-Title.md
    02-Section-Title/
      003-Lecture-Title.md
```

Each per-lecture `.md` contains the section name, lecture URL, and the full timestamped transcript.

---

## Optimizer

The optimizer pipeline runs on top of extracted transcripts and does not require re-scraping.

### Course Inventory

Parses `transcripts.json` and produces a structured inventory including:

- **Technologies detected** — from a keyword list covering languages, frameworks, cloud, ML/AI, and more
- **Hands-on tasks and projects** — signals like "build", "deploy", "implement", "from scratch"
- **Per-section lecture table** — title, classification, and detected tech items

### Content Classifier

Classifies each lecture into one of four categories based on title and transcript signals:

| Classification | Signals |
|---|---|
| `build` | "build", "implement", "deploy", "hands-on", "from scratch", "code along" |
| `watch` | Standard instructional content |
| `skim` | "overview", "introduction", "recap", "what is", "comparison" |
| `skip` | "welcome", "congratulations", "bonus", "discount", "certificate" |

### Study Plan Generator

Generates a `StudyPlan` from the classified inventory. In `selected` mode, filters by any combination of:

- **Sections** — include only specific section numbers
- **Technologies** — match lectures by detected tech keyword
- **Keywords** — match lectures by title keyword
- **Projects** — match lectures by project name

---

## Course Discovery

Lecture URLs are discovered using two strategies, always run in combination:

1. **Anchor scan** — fast DOM scan of `<a href>` links on the course overview page
2. **Click-through discovery** — scroll-reveal loop on the player page that clicks each sidebar item and captures the resulting URL

Click-through discovery handles Udemy's virtual-scrolling sidebar (only items in the viewport are in the DOM). Non-lecture items (role-play, coding exercises, etc.) are detected by inspecting inner anchor `href` before clicking and are skipped automatically. Whichever strategy finds more lectures wins; the anchor scan is a fallback only.

---

## Resume / Incremental Extraction

If a run is interrupted, re-run the same command. Lectures that already have output files are skipped automatically. To force re-extraction, delete the target files or use `--overwrite`.

To force a full re-discovery (e.g. after the course is updated), delete `course-map.json` before running.

---

## Troubleshooting

### Transcripts are empty / no cues extracted

Udemy may have updated their DOM. In Chrome DevTools on a lecture page:

1. Open the transcript panel manually.
2. Inspect the toggle button — find its `data-purpose`, `aria-label`, or class.
3. Inspect a transcript cue row — find its selector.
4. Update the relevant entries in `src/types.ts` under the `SELECTORS` object.

All selectors live in `SELECTORS` in `src/types.ts`. Each key holds an array of fallbacks tried in order. Add new selectors at the front of the array.

### "Login verification failed"

The logged-in indicator selector is stale. Find the current element (avatar, account menu, etc.) while logged in and update `SELECTORS.loggedInIndicator` in `src/types.ts`.

### Lectures missing from course map

If a course has more lectures than discovered, delete `course-map.json` and re-run. The click-through discovery will re-crawl the full sidebar.

---

## Development

```bash
# Type-check without building
npm run typecheck

# Compile to dist/
npm run build

# Run directly with tsx (no build step)
npm run scrape -- "<url>"
```

### Project Structure

```
src/
  index.ts                    <- CLI entry (scrape)
  scan.ts                     <- CLI entry (scan/inventory)
  optimize.ts                 <- CLI entry (optimize/study plan)
  auth.ts                     <- Playwright login detection and flow
  browser.ts                  <- Chromium launch with persistent profile
  course-map.ts               <- Lecture discovery (anchor scan + click-through)
  transcript-extractor.ts     <- Transcript panel interaction and row extraction
  formatter.ts                <- Lecture result -> Markdown formatting
  storage.ts                  <- File write helpers and path conventions
  types.ts                    <- Shared types and CSS selector registry (SELECTORS)
  utils/
    logger.ts                 <- AppLogger interface, consoleLogger, createJobLogger
  optimizer/
    courseInventory.ts        <- Build CourseInventory from LectureResult[]
    contentClassifier.ts      <- Classify lectures (build/watch/skim/skip)
    studyPlanGenerator.ts     <- Generate StudyPlan with optional selection criteria
    markdownWriter.ts         <- Write inventory + plan markdown (protects core files)
    selectionPrompt.ts        <- CLI interactive selection prompt
  server/
    index.ts                  <- Express app setup (port 3001)
    jobs/
      jobStore.ts             <- In-memory job store with SSE fan-out
      jobRunner.ts            <- startScrapeJob, startOptimizeJob
    routes/
      jobRoutes.ts            <- /api/jobs/* endpoints
      fileRoutes.ts           <- /api/files/download (path-traversal guarded)
  ui/                         <- React/Vite frontend (excluded from root tsconfig)
    tsconfig.json             <- Extends root, adds DOM lib + react-jsx
```
