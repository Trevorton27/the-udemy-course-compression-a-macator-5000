// ETHICAL CONSTRAINT: Only reads visible curriculum DOM — no API interception.
import { type Page } from 'playwright';
import type { Lecture, CourseMap } from './types.js';
import { SELECTORS } from './types.js';
import { ensureLoggedIn } from './auth.js';

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
async function expandPlayerSidebarSections(page: Page): Promise<void> {
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
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let collapsed: Awaited<ReturnType<Page['$$']>> = [];

    for (const sel of COLLAPSED_SELECTORS) {
      collapsed = await page.$$(sel);
      if (collapsed.length > 0) {
        console.log(`  [expand round ${round}] ${collapsed.length} collapsed via "${sel}"`);
        break;
      }
    }

    if (collapsed.length === 0) {
      console.log(`  All sidebar sections expanded after ${round - 1} round(s).`);
      return;
    }

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
  console.log('  Reached max expand rounds — proceeding.');
}

/**
 * Udemy no longer uses <a href> for curriculum items — they are <div data-purpose="curriculum-item-X-X">
 * driven by client-side React Router. This function clicks each item and captures the resulting URL.
 */
async function discoverLecturesByClicking(page: Page): Promise<RawLectureLink[]> {
  await expandPlayerSidebarSections(page);

  const count = await page.$$eval('[data-purpose^="curriculum-item-"]', (els) => els.length);
  console.log(`  Click-through discovery: ${count} curriculum item divs found in sidebar.`);

  if (count === 0) {
    console.log(`  DIAG: current URL = ${page.url()}`);
    console.log(`  DIAG: page title = ${await page.title()}`);
    const bodySnip = await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '');
    console.log(`  DIAG: body preview: ${bodySnip}`);
    const sectionPanels = await page.$$eval('[data-purpose^="section-panel-"]', (els) => els.length);
    console.log(`  DIAG: section-panel-* elements = ${sectionPanels}`);
    return [];
  }

  const results: RawLectureLink[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    const item = page.locator('[data-purpose^="curriculum-item-"]').nth(i);

    const purpose = await item.getAttribute('data-purpose').catch(() => '');
    const purposeMatch = purpose?.match(/curriculum-item-(\d+)-/);
    const sectionIdx = purposeMatch ? parseInt(purposeMatch[1], 10) : 0;

    const title = await item.locator('[data-purpose="item-title"]').innerText()
      .catch(() => `Lecture ${i + 1}`);

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

    const prevUrl = page.url().split('#')[0];
    try {
      await item.click({ timeout: 5000 });
      await page.waitForFunction(
        (prev: string) => location.href.split('#')[0] !== prev,
        prevUrl,
        { timeout: 4000 },
      ).catch(() => { /* same-lecture click — URL won't change */ });
      await page.waitForTimeout(400);
    } catch (e) {
      console.log(`  WARN: item ${i} ("${title.trim()}") click failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const url = page.url().split('#')[0];
    const isLectureUrl = url.includes('/learn/lecture/') || url.includes('/learn/quiz/') || url.includes('/learn/practice/');
    if (isLectureUrl && !seen.has(url)) {
      seen.add(url);
      console.log(`  [${String(results.length + 1).padStart(3, '0')}] ${title.trim()} → ${url}`);
      results.push({
        href: url,
        text: title.trim() || url,
        sectionText: sectionText || 'Section 1',
        sectionOrder: sectionIdx + 1,
      });
    } else if (!isLectureUrl) {
      console.log(`  SKIP item ${i}: navigated to non-lecture URL: ${url}`);
    }
  }

  return results;
}

// SELECTOR ASSUMPTION — verify in DevTools if this breaks
async function tryClickExpandAll(page: Page): Promise<void> {
  for (const selector of SELECTORS.expandAll) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        console.log(`  Clicked "Expand all" via selector: ${selector}`);
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
      console.log('  Clicked "Expand all" via text match');
      await page.waitForTimeout(2000);
      return;
    }
  } catch { /* ignore */ }
  console.log('  No "Expand all" button found — sections may already be expanded.');
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

export async function buildCourseMap(page: Page, courseUrl: string): Promise<CourseMap> {
  const overviewUrl = toCourseOverviewUrl(courseUrl);
  console.log(`Navigating to course overview: ${overviewUrl}`);
  await page.goto(overviewUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2500);

  if (isLoginPage(page)) {
    console.log('Session expired — redirected to login page. Re-authenticating...');
    await ensureLoggedIn(page);
    await page.goto(overviewUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2500);
  }

  // Scroll to trigger lazy-loaded curriculum sections
  await page.evaluate('window.scrollTo(0, document.body.scrollHeight / 2)');
  await page.waitForTimeout(1000);
  await tryClickExpandAll(page);
  await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await page.waitForTimeout(1000);
  await page.evaluate('window.scrollTo(0, 0)');
  await page.waitForTimeout(500);

  const courseTitle = await getCourseTitle(page);
  console.log(`Course title: ${courseTitle}`);

  // Try legacy anchor scan first (fast, may work on overview page)
  const raw = await scanLectureLinks(page);
  console.log(`Anchor scan found ${raw.length} lecture links.`);

  if (raw.length > 0) {
    return buildCourseMapResult(courseTitle, courseUrl, raw);
  }

  // Udemy's player page uses React Router divs, not <a href> for curriculum items.
  // Fall back to click-through discovery on the player page.
  console.log('Anchor scan found nothing — switching to click-through discovery.');

  // Determine player page URL (use original if it has /learn/, else append learn/)
  const playerUrl = courseUrl.includes('/learn/') ? courseUrl : overviewUrl + 'learn/';
  if (page.url().split('#')[0] !== playerUrl.split('#')[0]) {
    console.log(`Navigating to player page: ${playerUrl}`);
    await page.goto(playerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3000);
  }

  if (isLoginPage(page)) {
    console.log('Session expired — redirected to login page. Re-authenticating...');
    await ensureLoggedIn(page);
    await page.goto(playerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3000);
  }

  const clickedRaw = await discoverLecturesByClicking(page);
  console.log(`Click-through discovery found ${clickedRaw.length} lecture URLs.`);

  if (clickedRaw.length === 0) {
    console.error('ERROR: Could not discover any lecture URLs. Check the diagnostics above.');
    console.error(`  Is the user logged in? Current URL: ${page.url()}`);
    console.error(`  Page title: ${await page.title()}`);
  }

  return buildCourseMapResult(courseTitle, courseUrl, clickedRaw);
}

function buildCourseMapResult(courseTitle: string, courseUrl: string, raw: RawLectureLink[]): CourseMap {
  const lectures: Lecture[] = raw.map((r, i) => ({
    index: i + 1,
    sectionIndex: r.sectionOrder,
    sectionTitle: r.sectionText,
    title: r.text,
    url: r.href,
  }));
  const uniqueSections = new Set(lectures.map((l) => l.sectionIndex)).size;
  console.log(`Found ${lectures.length} lectures across ${uniqueSections} sections.`);
  return { courseTitle, courseUrl, extractedAt: new Date().toISOString(), lectures };
}
