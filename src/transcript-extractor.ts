// ETHICAL CONSTRAINT: Only reads visible transcript text shown to logged-in users.
// No video/audio download, no API interception via page.route().
import { type Page } from 'playwright';
import type { Lecture, LectureResult, TranscriptRow } from './types.js';
import { SELECTORS } from './types.js';
import { type AppLogger, consoleLogger } from './utils/logger.js';

const MAX_RETRIES = 2;

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// SELECTOR ASSUMPTION — verify in DevTools if this breaks
async function clickTranscriptToggle(page: Page, logger: AppLogger): Promise<boolean> {
  logger.info(`    [toggle] Trying ${SELECTORS.transcriptToggle.length} CSS selectors...`);
  for (const selector of SELECTORS.transcriptToggle) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        const isVisible = await btn.isVisible().catch(() => false);
        logger.info(`    [toggle] Found "${selector}" (visible=${isVisible})`);
        if (isVisible) {
          await btn.click();
          logger.info(`    [toggle] Clicked via: ${selector}`);
          return true;
        }
      } else {
        logger.info(`    [toggle] Not found: ${selector}`);
      }
    } catch (e) {
      logger.info(`    [toggle] Error on "${selector}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Fallback 1: aria-label match
  try {
    const ariaBtn = page.getByLabel(/transcript/i);
    const count = await ariaBtn.count();
    logger.info(`    [toggle] aria-label=/transcript/i found ${count} element(s)`);
    if (count > 0) {
      await ariaBtn.first().click();
      logger.info('    [toggle] Clicked via aria-label');
      return true;
    }
  } catch (e) {
    logger.info(`    [toggle] aria-label fallback error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback 2: role=button with text match
  try {
    const textBtn = page.getByRole('button', { name: /transcript/i });
    const count = await textBtn.count();
    logger.info(`    [toggle] role=button name=/transcript/i found ${count} element(s)`);
    if (count > 0) {
      await textBtn.first().click();
      logger.info('    [toggle] Clicked via getByRole text');
      return true;
    }
  } catch (e) {
    logger.info(`    [toggle] role=button fallback error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback 3: role=tab with transcript name (Udemy uses tabs in sidebar)
  try {
    const tabBtn = page.getByRole('tab', { name: /transcript/i });
    const count = await tabBtn.count();
    logger.info(`    [toggle] role=tab name=/transcript/i found ${count} element(s)`);
    if (count > 0) {
      await tabBtn.first().click();
      logger.info('    [toggle] Clicked via getByRole tab');
      return true;
    }
  } catch (e) {
    logger.info(`    [toggle] role=tab fallback error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback 4: any visible element with text "Transcript" (links, divs, spans)
  try {
    const anyEl = page.getByText(/^transcript$/i);
    const count = await anyEl.count();
    logger.info(`    [toggle] getByText(/^transcript$/i) found ${count} element(s)`);
    if (count > 0) {
      const first = anyEl.first();
      if (await first.isVisible().catch(() => false)) {
        await first.click();
        logger.info('    [toggle] Clicked via getByText');
        return true;
      }
    }
  } catch (e) {
    logger.info(`    [toggle] getByText fallback error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback 5: hover over video to reveal hidden player controls, then retry
  try {
    const video = page.locator('video').first();
    if (await video.count() > 0) {
      logger.info('    [toggle] Hovering over video to reveal player controls...');
      await video.hover({ timeout: 3000 });
      await page.waitForTimeout(800);

      // Retry CSS selectors after hover
      for (const selector of SELECTORS.transcriptToggle) {
        const btn = await page.$(selector).catch(() => null);
        if (btn && await btn.isVisible().catch(() => false)) {
          await btn.click();
          logger.info(`    [toggle] Clicked after hover via: ${selector}`);
          return true;
        }
      }
      // Retry aria-label after hover
      const ariaBtn = page.getByLabel(/transcript/i);
      if (await ariaBtn.count() > 0 && await ariaBtn.first().isVisible().catch(() => false)) {
        await ariaBtn.first().click();
        logger.info('    [toggle] Clicked after hover via aria-label');
        return true;
      }
    }
  } catch (e) {
    logger.info(`    [toggle] hover fallback error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Final diagnostic: log buttons (data-purpose + aria-label) and any transcript elements
  try {
    const purposes = await page.$$eval('button[data-purpose]', (btns) =>
      btns.map((b) => b.getAttribute('data-purpose')).filter(Boolean),
    );
    logger.info(`    [toggle] All button[data-purpose] on page: ${purposes.join(', ') || '(none)'}`);
  } catch { /* ignore */ }
  try {
    const ariaLabels = await page.$$eval('button[aria-label]', (btns) =>
      btns.map((b) => b.getAttribute('aria-label')).filter(Boolean),
    );
    logger.info(`    [toggle] All button[aria-label] on page: ${ariaLabels.join(', ') || '(none)'}`);
  } catch { /* ignore */ }
  try {
    const transcriptEls = await page.$$eval('[class*="transcript" i], [data-purpose*="transcript" i], [aria-label*="transcript" i]', (els) =>
      els.map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute('data-purpose') || e.getAttribute('class') || e.getAttribute('aria-label')}]`),
    );
    logger.info(`    [toggle] Elements mentioning "transcript": ${transcriptEls.join(', ') || '(none)'}`);
  } catch { /* ignore */ }

  return false;
}

// SELECTOR ASSUMPTION — verify in DevTools if this breaks
async function waitForTranscriptPanel(page: Page, logger: AppLogger): Promise<boolean> {
  logger.info(`    [panel] Waiting for panel using ${SELECTORS.transcriptPanel.length} selectors...`);
  for (const selector of SELECTORS.transcriptPanel) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      logger.info(`    [panel] Found: ${selector}`);
      return true;
    } catch {
      logger.info(`    [panel] Timeout/not found: ${selector}`);
    }
  }

  // Diagnostic: log all data-purpose attributes visible on page
  try {
    const purposes = await page.$$eval('[data-purpose]', (els) =>
      [...new Set(els.map((e) => e.getAttribute('data-purpose')).filter(Boolean))].sort(),
    );
    logger.info(`    [panel] All data-purpose values on page: ${purposes.join(', ') || '(none)'}`);
  } catch { /* ignore */ }

  return false;
}

// SELECTOR ASSUMPTION — verify in DevTools if this breaks
async function extractRows(page: Page, logger: AppLogger): Promise<TranscriptRow[]> {
  logger.info(`    [cues] Trying ${SELECTORS.transcriptCue.length} cue selectors...`);
  for (const cueSelector of SELECTORS.transcriptCue) {
    try {
      const cues = await page.$$(cueSelector);
      logger.info(`    [cues] "${cueSelector}" → ${cues.length} elements`);
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

async function isTranscriptAlreadyOpen(page: Page, logger: AppLogger): Promise<boolean> {
  for (const cueSelector of SELECTORS.transcriptCue) {
    try {
      const cues = await page.$$(cueSelector);
      if (cues.length > 0) {
        logger.info(`    [toggle] Transcript panel already open (found cues via "${cueSelector}")`);
        return true;
      }
    } catch { /* try next */ }
  }
  return false;
}

async function attemptExtract(page: Page, lecture: Lecture, logger: AppLogger): Promise<LectureResult> {
  logger.info(`    [nav] Navigating to: ${lecture.url}`);
  await page.goto(lecture.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Wait for the transcript toggle to render (React async).
  // If it doesn't appear in 8s, try clicking the video to activate the player,
  // then wait another 5s.
  const toggleAppeared = await page.waitForSelector('[data-purpose="transcript-toggle"]', { timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  if (!toggleAppeared) {
    try {
      const video = page.locator('video').first();
      if (await video.count() > 0) {
        logger.info('    [nav] Toggle not yet visible — clicking video to activate player...');
        await video.click({ timeout: 3000 });
        await page.waitForSelector('[data-purpose="transcript-toggle"]', { timeout: 5_000 }).catch(() => {});
      }
    } catch { /* ignore */ }
  }
  await page.waitForTimeout(300);
  logger.info(`    [nav] Landed on: ${page.url()} — title: ${await page.title()}`);

  // If transcript cues are already visible (carried over from SPA navigation), skip toggle
  const alreadyOpen = await isTranscriptAlreadyOpen(page, logger);
  if (!alreadyOpen) {
    const toggled = await clickTranscriptToggle(page, logger);
    if (!toggled) {
      logger.info('    [toggle] No transcript toggle found — lecture has no transcript.');
      return { lecture, rows: [], skipped: false };
    }
  }

  await page.waitForTimeout(1500); // wait for panel to open

  const panelFound = await waitForTranscriptPanel(page, logger);
  if (!panelFound) {
    logger.info('    [panel] Not found — attempting direct cue extraction anyway.');
  }

  const rows = await extractRows(page, logger);

  if (rows.length === 0) {
    logger.info('    [cues] No cue rows extracted — transcript panel open but empty.');
    return { lecture, rows: [], skipped: false };
  }

  logger.info(`    [cues] Extracted ${rows.length} rows.`);
  return { lecture, rows, skipped: false };
}

export async function extractTranscript(
  page: Page,
  lecture: Lecture,
  delayMinMs: number,
  delayMaxMs: number,
  logger?: AppLogger,
): Promise<LectureResult> {
  const log = logger ?? consoleLogger;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await attemptExtract(page, lecture, log);

      // Polite delay between lectures
      const delay = randomDelay(delayMinMs, delayMaxMs);
      await sleep(delay);

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn(`    Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`);
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
