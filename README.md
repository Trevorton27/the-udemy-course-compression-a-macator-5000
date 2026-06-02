# Udemy Transcript Extractor

A personal-study CLI that uses Playwright to open Udemy in a **headed browser**, lets you log in manually, then walks every lecture in a course extracting the visible transcript text and timestamps.

**Output:** Local Markdown + JSON files. No video, no audio, no API interception.

---

## Legal / Ethical Notice

This tool is intended for **personal study use only** on courses you are authorized to access. It reads only what a logged-in user can see in the browser — the same text shown in Udemy's transcript panel. Do not use it to redistribute course content or to access content you have not purchased.

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
| `UDEMY_PROFILE_DIR` | `./browser-profile` | Path to store Chromium persistent profile (keeps login) |
| `DELAY_MIN_MS` | `1500` | Minimum delay between lectures (ms) |
| `DELAY_MAX_MS` | `3500` | Maximum delay between lectures (ms) |

---

## Usage

```bash
npm run scrape -- "https://www.udemy.com/course/your-course-slug/"
```

### First run — manual login

1. A headed Chromium window opens and navigates to `udemy.com`.
2. The terminal prompts you to log in. Complete login in the browser.
3. Press **ENTER** in the terminal to continue.
4. On subsequent runs the persistent profile keeps you logged in automatically.

### Flags

| Flag | Description |
|---|---|
| `--overwrite` | Re-extract lectures that already have output files |
| `--force` | Alias for `--overwrite` |

### Resume

If extraction is interrupted, re-run the same command. Already-extracted lecture files are skipped automatically. Use `--force` to re-extract everything.

---

## Output Structure

```
output/
  Course-Title/
    course-map.json          ← Full lecture list with URLs
    combined-transcript.md   ← All transcripts in one file
    transcripts.json         ← Structured JSON of all results
    skipped.json             ← Lectures with no transcript
    errors.json              ← Lectures that errored
    01-Section-Title/
      001-Lecture-Title.md
      002-Lecture-Title.md
    02-Section-Title/
      003-Lecture-Title.md
```

Each per-lecture `.md` file contains the section name, URL, and the full timestamped transcript.

---

## Troubleshooting

### "Login verification failed"

Udemy may have updated their DOM. Open DevTools (`F12`) on `udemy.com` while logged in and find the element that indicates a logged-in user (avatar, account menu, etc.). Update `SELECTORS.loggedInIndicator` in `src/types.ts`.

### Transcripts are empty / no cues extracted

The transcript panel selectors may be stale. In DevTools on a lecture page:
1. Open the transcript panel manually.
2. Inspect the toggle button — find its `data-purpose`, class, or `aria-label`.
3. Inspect a transcript cue row — find its class or `data-purpose`.
4. Update the relevant entries in `src/types.ts` under `SELECTORS`.

### Selector Update Guide

All CSS selectors are centralized in `src/types.ts` in the `SELECTORS` object. Each key has an array of fallback selectors tried in order. To update:

1. Open Udemy in Chrome DevTools.
2. Use the element picker to find the current selector.
3. Add or replace the first entry in the relevant array in `SELECTORS`.
4. Run `npm run typecheck` to confirm no TypeScript errors.

---

## Development

```bash
# Type-check without building
npm run typecheck

# Compile to dist/
npm run build

# Run directly with tsx (no build needed)
npm run scrape -- "<url>"
```
