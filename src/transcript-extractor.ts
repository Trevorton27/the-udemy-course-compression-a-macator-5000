// ETHICAL CONSTRAINT: Only reads visible transcript text shown to logged-in users.
// No video/audio download, no API interception via page.route().
import { type Page } from 'playwright';
import type { Lecture, LectureResult, TranscriptRow } from './types.js';
import { SELECTORS } from './types.js';

const MAX_RETRIES = 2;

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// SELECTOR ASSUMPTION — verify in DevTools if this breaks
async function clickTranscriptToggle(page: Page): Promise<boolean> {
  console.log(`    [toggle] Trying ${SELECTORS.transcriptToggle.length} CSS selectors...`);
  for (const selector of SELECTORS.transcriptToggle) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        const isVisible = await btn.isVisible().catch(() => false);
        console.log(`    [toggle] Found "${selector}" (visible=${isVisible})`);
        if (isVisible) {
          await btn.click();
          console.log(`    [toggle] Clicked via: ${selector}`);
          return true;
        }
      } else {
        console.log(`    [toggle] Not found: ${selector}`);
      }
    } catch (e) {
      console.log(`    [toggle] Error on "${selector}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Fallback 1: aria-label match
  try {
    const ariaBtn = page.getByLabel(/transcript/i);
    const count = await ariaBtn.count();
    console.log(`    [toggle] aria-label=/transcript/i found ${count} element(s)`);
    if (count > 0) {
      await ariaBtn.first().click();
      console.log('    [toggle] Clicked via aria-label');
      return true;
    }
  } catch (e) {
    console.log(`    [toggle] aria-label fallback error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback 2: role=button with text match
  try {
    const textBtn = page.getByRole('button', { name: /transcript/i });
    const count = await textBtn.count();
    console.log(`    [toggle] role=button name=/transcript/i found ${count} element(s)`);
    if (count > 0) {
      await textBtn.first().click();
      console.log('    [toggle] Clicked via getByRole text');
      return true;
    }
  } catch (e) {
    console.log(`    [toggle] role=button fallback error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback 3: role=tab with transcript name (Udemy uses tabs in sidebar)
  try {
    const tabBtn = page.getByRole('tab', { name: /transcript/i });
    const count = await tabBtn.count();
    console.log(`    [toggle] role=tab name=/transcript/i found ${count} element(s)`);
    if (count > 0) {
      await tabBtn.first().click();
      console.log('    [toggle] Clicked via getByRole tab');
      return true;
    }
  } catch (e) {
    console.log(`    [toggle] role=tab fallback error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback 4: any visible element with text "Transcript" (links, divs, spans)
  try {
    const anyEl = page.getByText(/^transcript$/i);
    const count = await anyEl.count();
    console.log(`    [toggle] getByText(/^transcript$/i) found ${count} element(s)`);
    if (count > 0) {
      const first = anyEl.first();
      if (await first.isVisible().catch(() => false)) {
        await first.click();
        console.log('    [toggle] Clicked via getByText');
        return true;
      }
    }
  } catch (e) {
    console.log(`    [toggle] getByText fallback error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback 5: hover over video to reveal hidden player controls, then retry
  try {
    const video = page.locator('video').first();
    if (await video.count() > 0) {
      console.log('    [toggle] Hovering over video to reveal player controls...');
      await video.hover({ timeout: 3000 });
      await page.waitForTimeout(800);

      // Retry CSS selectors after hover
      for (const selector of SELECTORS.transcriptToggle) {
        const btn = await page.$(selector).catch(() => null);
        if (btn && await btn.isVisible().catch(() => false)) {
          await btn.click();
          console.log(`    [toggle] Clicked after hover via: ${selector}`);
          return true;
        }
      }
      // Retry aria-label after hover
      const ariaBtn = page.getByLabel(/transcript/i);
      if (await ariaBtn.count() > 0 && await ariaBtn.first().isVisible().catch(() => false)) {
        await ariaBtn.first().click();
        console.log('    [toggle] Clicked after hover via aria-label');
        return true;
      }
    }
  } catch (e) {
    console.log(`    [toggle] hover fallback error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Final diagnostic: log buttons (data-purpose + aria-label) and any transcript elements
  try {
    const purposes = await page.$$eval('button[data-purpose]', (btns) =>
      btns.map((b) => b.getAttribute('data-purpose')).filter(Boolean),
    );
    console.log(`    [toggle] All button[data-purpose] on page: ${purposes.join(', ') || '(none)'}`);
  } catch { /* ignore */ }
  try {
    const ariaLabels = await page.$$eval('button[aria-label]', (btns) =>
      btns.map((b) => b.getAttribute('aria-label')).filter(Boolean),
    );
    console.log(`    [toggle] All button[aria-label] on page: ${ariaLabels.join(', ') || '(none)'}`);
  } catch { /* ignore */ }
  try {
    const transcriptEls = await page.$$eval('[class*="transcript" i], [data-purpose*="transcript" i], [aria-label*="transcript" i]', (els) =>
      els.map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute('data-purpose') || e.getAttribute('class') || e.getAttribute('aria-label')}]`),
    );
    console.log(`    [toggle] Elements mentioning "transcript": ${transcriptEls.join(', ') || '(none)'}`);
  } catch { /* ignore */ }

  return false;
}

// SELECTOR ASSUMPTION — verify in DevTools if this breaks
async function waitForTranscriptPanel(page: Page): Promise<boolean> {
  console.log(`    [panel] Waiting for panel using ${SELECTORS.transcriptPanel.length} selectors...`);
  for (const selector of SELECTORS.transcriptPanel) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      console.log(`    [panel] Found: ${selector}`);
      return true;
    } catch {
      console.log(`    [panel] Timeout/not found: ${selector}`);
    }
  }

  // Diagnostic: log all data-purpose attributes visible on page
  try {
    const purposes = await page.$$eval('[data-purpose]', (els) =>
      [...new Set(els.map((e) => e.getAttribute('data-purpose')).filter(Boolean))].sort(),
    );
    console.log(`    [panel] All data-purpose values on page: ${purposes.join(', ') || '(none)'}`);
  } catch { /* ignore */ }

  return false;
}

// SELECTOR ASSUMPTION — verify in DevTools if this breaks
async function extractRows(page: Page): Promise<TranscriptRow[]> {
  console.log(`    [cues] Trying ${SELECTORS.transcriptCue.length} cue selectors...`);
  for (const cueSelector of SELECTORS.transcriptCue) {
    try {
      const cues = await page.$$(cueSelector);
      console.log(`    [cues] "${cueSelector}" → ${cues.length} elements`);
      if (cues.length === 0) continue;

      const rows: TranscriptRow[] = [];
      for (const cue of cues) {
        let timestamp = '';
        let text = '';

        // Try timestamp selectors
        for (const tsSelector of SELECTORS.transcriptTimestamp) {
          try {
            const tsEl = await cue.$(tsSelector);
            if (tsEl) {
              timestamp = (await tsEl.innerText()).trim();
              break;
            }
          } catch { /* try next */ }
        }

        // Try text selectors
        for (const txtSelector of SELECTORS.transcriptText) {
          try {
            const txtEl = await cue.$(txtSelector);
            if (txtEl) {
              text = (await txtEl.innerText()).trim();
              break;
            }
          } catch { /* try next */ }
        }

        // Fallback: innerText of whole cue, split on first whitespace group after timestamp-like token
        if (!text) {
          try {
            const raw = (await cue.innerText()).trim();
            const match = raw.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/s);
            if (match) {
              timestamp = timestamp || match[1];
              text = match[2].trim();
            } else {
              text = raw;
            }
          } catch { /* skip */ }
        }

        if (text) rows.push({ timestamp, text });
      }

      if (rows.length > 0) return rows;
    } catch {
      // try next cue selector
    }
  }

  return [];
}

async function isTranscriptAlreadyOpen(page: Page): Promise<boolean> {
  for (const cueSelector of SELECTORS.transcriptCue) {
    try {
      const cues = await page.$$(cueSelector);
      if (cues.length > 0) {
        console.log(`    [toggle] Transcript panel already open (found cues via "${cueSelector}")`);
        return true;
      }
    } catch { /* try next */ }
  }
  return false;
}

async function attemptExtract(page: Page, lecture: Lecture): Promise<LectureResult> {
  console.log(`    [nav] Navigating to: ${lecture.url}`);
  await page.goto(lecture.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3000); // let player settle
  console.log(`    [nav] Landed on: ${page.url()} — title: ${await page.title()}`);

  // If transcript cues are already visible (carried over from SPA navigation), skip toggle
  const alreadyOpen = await isTranscriptAlreadyOpen(page);
  if (!alreadyOpen) {
    const toggled = await clickTranscriptToggle(page);
    if (!toggled) {
      console.log('    [toggle] FAILED — no transcript toggle found. Skipping lecture.');
      return {
        lecture,
        rows: [],
        skipped: true,
        skipReason: 'Transcript toggle button not found in DOM.',
      };
    }
  }

  await page.waitForTimeout(1500); // wait for panel to open

  const panelFound = await waitForTranscriptPanel(page);
  if (!panelFound) {
    console.log('    [panel] Not found — attempting direct cue extraction anyway.');
  }

  const rows = await extractRows(page);

  if (rows.length === 0) {
    console.log('    [cues] No cue rows extracted.');
    return {
      lecture,
      rows: [],
      skipped: true,
      skipReason: 'Transcript panel found but no cue rows extracted.',
    };
  }

  console.log(`    [cues] Extracted ${rows.length} rows.`);
  return { lecture, rows, skipped: false };
}

export async function extractTranscript(
  page: Page,
  lecture: Lecture,
  delayMinMs: number,
  delayMaxMs: number,
): Promise<LectureResult> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await attemptExtract(page, lecture);

      // Polite delay between lectures
      const delay = randomDelay(delayMinMs, delayMaxMs);
      await sleep(delay);

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`    Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`);
      if (attempt < MAX_RETRIES) await sleep(2000);
    }
  }

  return {
    lecture,
    rows: [],
    skipped: false,
    error: lastError?.message ?? 'Unknown extraction error after retries.',
  };
}
