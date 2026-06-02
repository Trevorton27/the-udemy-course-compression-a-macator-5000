// ETHICAL CONSTRAINT: This module launches a headed browser using a persistent
// profile for session continuity only. No headless bypass of Udemy's login.
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function launchBrowser(profileDir: string): Promise<BrowserSession> {
  const resolvedProfileDir = path.resolve(profileDir);

  // Ensure profile directory exists
  if (!fs.existsSync(resolvedProfileDir)) {
    fs.mkdirSync(resolvedProfileDir, { recursive: true });
  }

  console.log(`Launching browser with persistent profile at: ${resolvedProfileDir}`);

  const context = await chromium.launchPersistentContext(resolvedProfileDir, {
    headless: false,
    slowMo: 50,
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: [
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  // Use existing first page or open a new one
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // browser reference is not directly available from launchPersistentContext,
  // but we expose a compatible object. Context close handles cleanup.
  const browser = context.browser()!;

  return { browser, context, page };
}
