// ETHICAL CONSTRAINT: Only reads visible curriculum DOM — no API interception.
import { type Page } from 'playwright';
import type { Lecture, CourseMap } from './types.js';
import { SELECTORS } from './types.js';
import { ensureLoggedIn } from './auth.js';
import { type AppLogger, consoleLogger } from './utils/logger.js';

function isLoginPage(page: Page): boolean {
  const url = page.url();
  return url.includes('/login') || url.includes('/join/');
}

/** Strip any /learn/... suffix so we always land on the course overview page */
function toCourseOverviewUrl(url: string): string {
  const match = url.match(/(https?:\/\/(?:www\.)?udemy\.com\/course\/[^/?#]+)/);
  return match ? match[1] + '/' : url;
}

/**
 * Expand all collapsed accordion sections in the player sidebar.
 * Retries until no more collapsed buttons are found (handles nested reveals).
 */
async function expandPlayerSidebarSections(page: Page, logger: AppLogger): Promise<void> {
  // Selectors tried in order — most specific first, broadest last
  const COLLAPSED_SELECTORS = [
    '[data-purpose^="section-panel-"] button[aria-expanded="false"]',
    'button.js-panel-toggler[aria-expanded="false"]',
    '[class*="accordion"] button[aria-expanded="false"]',
    '[class*="section"] button[aria-expanded="false"]',
    // Broadest fallback: any aria-expanded=false button in the sidebar region
    'button[aria-expanded="false"]',
  ];

  const MAX_ROUNDS = 10;
  let prevCollapsedCount = Infinity;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let collapsed: Awaited<ReturnType<Page['$$']>> = [];
    let usedSel = '';

    for (const sel of COLLAPSED_SELECTORS) {
      collapsed = await page.$$(sel);
      if (collapsed.length > 0) {
        usedSel = sel;
        logger.info(`  [expand round ${round}] ${collapsed.length} collapsed via "${sel}"`);
        break;
      }
    }

    if (collapsed.length === 0) {
      logger.info(`  All sidebar sections expanded after ${round - 1} round(s).`);
      return;
    }

    // If the count hasn't decreased since the last round, the buttons are stuck and
    // clicking them isn't working (e.g. off-screen, covered by overlay, or decorative).
    // Break early rather than wasting 10 rounds.
    if (collapsed.length >= prevCollapsedCount) {
      logger.info(`  Expand loop stuck at ${collapsed.length} buttons (${usedSel}) — proceeding.`);
      return;
    }
    prevCollapsedCount = collapsed.length;

    for (const btn of collapsed) {
      try {
        const visible = await btn.isVisible().catch(() => false);
        if (visible) {
          await btn.click();
          await page.waitForTimeout(200);
        }
      } catch { /* ignore stale handles */ }
    }
    await page.waitForTimeout(600);
  }
  logger.info('  Reached max expand rounds — proceeding.');
}

/**
 * Scroll the sidebar's virtual-scroll container down by one viewport-height chunk.
 * Returns true if the scroll position actually moved (more content below), false if at bottom.
 */
async function scrollSidebarDown(page: Page): Promise<boolean> {
  return page.evaluate((): boolean => {
    // Walk up from any curriculum item to find its nearest scrollable ancestor
    const item = document.querySelector('[data-purpose^="curriculum-item-"]');
    if (!item) return false;
    let node: Element | null = item.parentElement;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      if (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight
      ) {
        const before = node.scrollTop;
        node.scrollTop += 600;
        return node.scrollTop > before;
      }
      node = node.parentElement;
    }
    // Fallback: scroll the window
    const before = window.scrollY;
    window.scrollBy(0, 600);
    return window.scrollY > before;
  });
}

/**
 * Udemy no longer uses <a href> for curriculum items — they are <div data-purpose="curriculum-item-X-X">
 * driven by client-side React Router. This function uses a scroll-reveal loop to handle Udemy's
 * virtual-scrolling sidebar: only items in the viewport are in the DOM, so we repeatedly scroll
 * and collect newly rendered items rather than relying on a fixed upfront count.
 */
async function discoverLecturesByClicking(page: Page, logger: AppLogger, playerUrl: string): Promise<RawLectureLink[]> {
  // Expand all visible collapsed sections first
  await expandPlayerSidebarSections(page, logger);

  // Quick diagnostic if nothing is visible at all
  const initialCount = await page.$$eval('[data-purpose^="curriculum-item-"]', (els) => els.length);
  if (initialCount === 0) {
    logger.info(`  DIAG: current URL = ${page.url()}`);
    logger.info(`  DIAG: page title = ${await page.title()}`);
    const bodySnip = await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '');
    logger.info(`  DIAG: body preview: ${bodySnip}`);
    const sectionPanels = await page.$$eval('[data-purpose^="section-panel-"]', (els) => els.length);
    logger.info(`  DIAG: section-panel-* elements = ${sectionPanels}`);
    return [];
  }

  logger.info('  Click-through discovery: using scroll-reveal loop (handles virtual scrolling)...');

  const results: RawLectureLink[] = [];
  const seenUrls = new Set<string>();
  const processedPurposes = new Set<string>();

  // Allow up to MAX_STALLS consecutive scroll attempts with no new items before giving up
  const MAX_STALLS = 5;
  let stallCount = 0;

  while (stallCount < MAX_STALLS) {
    // Expand any newly revealed collapsed sections (they appear as we scroll)
    await expandPlayerSidebarSections(page, logger);

    // Snapshot data-purpose values of all currently rendered curriculum items
    const purposes = await page.$$eval(
      '[data-purpose^="curriculum-item-"]',
      (els) => els.map((e) => e.getAttribute('data-purpose') ?? '').filter(Boolean),
    );
    const newPurposes = purposes.filter((p) => !processedPurposes.has(p));

    if (newPurposes.length === 0) {
      const scrolled = await scrollSidebarDown(page);
      if (!scrolled) {
        logger.info('  Sidebar scroll exhausted — discovery complete.');
        break;
      }
      stallCount++;
      await page.waitForTimeout(500);
      continue;
    }

    stallCount = 0;
    logger.info(`  ${newPurposes.length} new item(s) visible (${processedPurposes.size} processed so far).`);

    for (const purpose of newPurposes) {
      processedPurposes.add(purpose);

      // Re-query by data-purpose after each navigation (avoids stale handles)
      const item = page.locator(`[data-purpose="${purpose}"]`).first();

      const purposeMatch = purpose.match(/curriculum-item-(\d+)-/);
      const sectionIdx = purposeMatch ? parseInt(purposeMatch[1], 10) : 0;

      const title = await item.locator('[data-purpose="item-title"]').innerText()
        .catch(() => `Lecture ${processedPurposes.size}`);

      const sectionText = await item.evaluate((el: Element) => {
        let node: Element | null = el;
        while (node) {
          if (node.getAttribute?.('data-purpose')?.startsWith('section-panel-')) {
            const btn = node.querySelector('button[id^="accordion-panel-title"] .ud-accordion-panel-title span');
            return (btn?.textContent ?? '').trim().split('\n')[0].trim();
          }
          node = node.parentElement;
        }
        return '';
      }).catch(() => '');

      // Pre-flight: read href from any inner anchor to detect non-lecture items before clicking.
      // Role-play, coding exercises, etc. typically have a different URL pattern.
      const itemHref = await item.evaluate((el: Element): string | null => {
        const a = el.querySelector('a[href]');
        return a ? (a as HTMLAnchorElement).href : null;
      }).catch(() => null);

      if (itemHref !== null) {
        const isLectureHref = itemHref.includes('/learn/lecture/')
          || itemHref.includes('/learn/quiz/')
          || itemHref.includes('/learn/practice/');
        if (!isLectureHref) {
          logger.info(`  SKIP (non-lecture type): ${title.trim()} → ${itemHref}`);
          continue;
        }
      }

      const prevUrl = page.url().split('#')[0];
      try {
        // Scroll the item into view before clicking — items deep in a virtual-scroll
        // sidebar may be in the DOM but outside the visible scrollport.
        await item.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(150);
        try {
          await item.click({ timeout: 5000 });
        } catch {
          // Fallback: force-click bypasses interactability checks (overlays, clipping, etc.)
          await item.click({ timeout: 5000, force: true });
        }
        await page.waitForFunction(
          (prev: string) => location.href.split('#')[0] !== prev,
          prevUrl,
          { timeout: 4000 },
        ).catch(() => { /* same-lecture click — URL won't change */ });
        await page.waitForTimeout(400);
      } catch (e) {
        logger.warn(`  WARN: "${title.trim()}" click failed: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      const url = page.url().split('#')[0];
      const isLectureUrl = url.includes('/learn/lecture/') || url.includes('/learn/quiz/') || url.includes('/learn/practice/');
      if (isLectureUrl && !seenUrls.has(url)) {
        seenUrls.add(url);
        logger.info(`  [${String(results.length + 1).padStart(3, '0')}] ${title.trim()} → ${url}`);
        results.push({
          href: url,
          text: title.trim() || url,
          sectionText: sectionText || 'Section 1',
          sectionOrder: sectionIdx + 1,
        });
      } else if (!isLectureUrl) {
        // Anchor href check missed this item (no inner anchor) — recover by returning to player base
        logger.info(`  SKIP: navigated to non-lecture URL: ${url}`);
        await page.goto(playerUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
        await page.waitForSelector('[data-purpose^="curriculum-item-"]', { timeout: 8000 }).catch(() => {});
        await expandPlayerSidebarSections(page, logger);
        await page.waitForTimeout(500);
      }
    }
  }

  logger.info(`  Scroll-reveal discovery: ${results.length} lecture URLs found (${processedPurposes.size} items processed).`);
  return results;
}

// SELECTOR ASSUMPTION — verify in DevTools if this breaks
async function tryClickExpandAll(page: Page, logger: AppLogger): Promise<void> {
  for (const selector of SELECTORS.expandAll) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        logger.info(`  Clicked "Expand all" via selector: ${selector}`);
        await page.waitForTimeout(2000);
        return;
      }
    } catch {
      // try next
    }
  }
  try {
    const expandBtn = page.getByRole('button', { name: /expand all/i });
    if (await expandBtn.count() > 0) {
      await expandBtn.first().click();
      logger.info('  Clicked "Expand all" via text match');
      await page.waitForTimeout(2000);
      return;
    }
  } catch { /* ignore */ }
  logger.info('  No "Expand all" button found — sections may already be expanded.');
}

async function getCourseTitle(page: Page): Promise<string> {
  for (const selector of SELECTORS.courseTitle) {
    try {
      const el = await page.$(selector);
      if (el) {
        const text = await el.innerText();
        if (text.trim()) return text.trim();
      }
    } catch { /* try next */ }
  }
  const docTitle = await page.title();
  return docTitle.replace(/\s*[|\-–—].*$/, '').trim() || 'Unknown Course';
}

interface RawLectureLink {
  href: string;
  text: string;
  sectionText: string;
  sectionOrder: number;
}

/**
 * DOM scan run inside the page context — passed as a string to avoid
 * tsx/esbuild injecting __name() helpers that don't exist in the browser.
 */
async function scanLectureLinks(page: Page): Promise<RawLectureLink[]> {
  // language=javascript
  const script = `(() => {
    const results = [];
    const seen = new Set();
    const sectionHeadingMap = new Map();
    let sectionCounter = 0;

    function findSectionHeading(el) {
      let node = el;
      while (node) {
        let sib = node.previousElementSibling;
        while (sib) {
          const tag = sib.tagName.toLowerCase();
          const cls = typeof sib.className === 'string' ? sib.className : '';
          const role = sib.getAttribute('role') || '';
          const dataPurpose = sib.getAttribute('data-purpose') || '';
          const isHeading =
            /^h[1-6]$/.test(tag) ||
            role === 'heading' ||
            cls.includes('section') ||
            cls.includes('chapter') ||
            dataPurpose.includes('section');
          if (isHeading) {
            const text = (sib.textContent || '').trim();
            if (text.length > 0 && text.length < 200) {
              if (!sectionHeadingMap.has(sib)) {
                sectionHeadingMap.set(sib, ++sectionCounter);
              }
              return { text, order: sectionHeadingMap.get(sib) };
            }
          }
          sib = sib.previousElementSibling;
        }
        node = node.parentElement;
      }
      return { text: 'Section 1', order: 1 };
    }

    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const lectureAnchors = anchors.filter(a => {
      const h = a.getAttribute('href') || '';
      return h.includes('/learn/lecture/') || h.includes('/learn/quiz/') || h.includes('/learn/practice/');
    });

    for (const anchor of lectureAnchors) {
      const href = anchor.getAttribute('href') || '';
      const absHref = href.startsWith('http') ? href : 'https://www.udemy.com' + href;
      if (seen.has(absHref)) continue;
      seen.add(absHref);

      let text = '';
      const children = anchor.querySelectorAll('span, div, p');
      for (const child of Array.from(children)) {
        const t = (child.textContent || '').trim();
        if (t.length > 3 && !/^\\d+:\\d+$/.test(t)) { text = t; break; }
      }
      if (!text) text = ((anchor.textContent || '').trim().split('\\n')[0] || '').trim();
      if (!text) text = href;

      const section = findSectionHeading(anchor);
      results.push({ href: absHref, text, sectionText: section.text, sectionOrder: section.order });
    }

    return results;
  })()`;

  return page.evaluate(script) as Promise<RawLectureLink[]>;
}

export async function buildCourseMap(page: Page, courseUrl: string, logger?: AppLogger): Promise<CourseMap> {
  const log = logger ?? consoleLogger;
  const overviewUrl = toCourseOverviewUrl(courseUrl);
  log.info(`Navigating to course overview: ${overviewUrl}`);
  await page.goto(overviewUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2500);

  if (isLoginPage(page)) {
    log.info('Session expired — redirected to login page. Re-authenticating...');
    await ensureLoggedIn(page, log);
    await page.goto(overviewUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2500);
  }

  // Scroll to trigger lazy-loaded curriculum sections
  await page.evaluate('window.scrollTo(0, document.body.scrollHeight / 2)');
  await page.waitForTimeout(1000);
  await tryClickExpandAll(page, log);
  await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await page.waitForTimeout(1000);
  await page.evaluate('window.scrollTo(0, 0)');
  await page.waitForTimeout(500);

  const courseTitle = await getCourseTitle(page);
  log.info(`Course title: ${courseTitle}`);

  // Anchor scan: fast DOM scan of <a href> lecture links on the overview page.
  // Some courses render all lecture links as anchors (complete); others only render
  // a partial set (e.g. only the first few sections that are expanded by default).
  // Always follow up with click-through discovery on the player page so we never miss sections.
  const raw = await scanLectureLinks(page);
  log.info(`Anchor scan found ${raw.length} lecture links.`);

  // Click-through discovery on the player page is authoritative — it handles virtual-scrolling
  // sidebars and finds all sections regardless of what the overview page renders.
  log.info('Running click-through discovery on player page to ensure completeness...');

  // Determine player page URL (use original if it has /learn/, else append learn/)
  const playerUrl = courseUrl.includes('/learn/') ? courseUrl : overviewUrl + 'learn/';
  if (page.url().split('#')[0] !== playerUrl.split('#')[0]) {
    log.info(`Navigating to player page: ${playerUrl}`);
    await page.goto(playerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3000);
  }

  if (isLoginPage(page)) {
    log.info('Session expired — redirected to login page. Re-authenticating...');
    await ensureLoggedIn(page, log);
    await page.goto(playerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3000);
  }

  const clickedRaw = await discoverLecturesByClicking(page, log, playerUrl);
  log.info(`Click-through discovery found ${clickedRaw.length} lecture URLs.`);

  // Use whichever source found more lectures; fall back to anchor scan if click-through fails.
  if (clickedRaw.length >= raw.length) {
    if (raw.length > 0 && clickedRaw.length > raw.length) {
      log.info(`Click-through found ${clickedRaw.length - raw.length} more lecture(s) than anchor scan — anchor scan was incomplete.`);
    }
    if (clickedRaw.length === 0) {
      log.error('ERROR: Could not discover any lecture URLs. Check the diagnostics above.');
      log.error(`  Is the user logged in? Current URL: ${page.url()}`);
      log.error(`  Page title: ${await page.title()}`);
    }
    return buildCourseMapResult(courseTitle, courseUrl, clickedRaw, log);
  }

  log.info(`Click-through found fewer results (${clickedRaw.length}) than anchor scan (${raw.length}) — using anchor scan.`);
  return buildCourseMapResult(courseTitle, courseUrl, raw, log);
}

function buildCourseMapResult(courseTitle: string, courseUrl: string, raw: RawLectureLink[], logger: AppLogger): CourseMap {
  const lectures: Lecture[] = raw.map((r, i) => ({
    index: i + 1,
    sectionIndex: r.sectionOrder,
    sectionTitle: r.sectionText,
    title: r.text,
    url: r.href,
  }));
  const uniqueSections = new Set(lectures.map((l) => l.sectionIndex)).size;
  logger.info(`Found ${lectures.length} lectures across ${uniqueSections} sections.`);
  return { courseTitle, courseUrl, extractedAt: new Date().toISOString(), lectures };
}
