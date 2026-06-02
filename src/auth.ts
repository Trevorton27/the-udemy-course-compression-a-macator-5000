// ETHICAL CONSTRAINT: Authentication is always manual. This module only checks
// whether the user is already logged in and pauses for them to log in if not.
import { type Page } from 'playwright';
import * as readline from 'readline';
import { SELECTORS } from './types.js';

const UDEMY_HOME = 'https://www.udemy.com';

async function isLoggedIn(page: Page): Promise<boolean> {
  // Strategy 1: positive match on known logged-in indicators
  // SELECTOR ASSUMPTION — verify in DevTools if this breaks
  for (const selector of SELECTORS.loggedInIndicator) {
    try {
      const el = await page.$(selector);
      if (el) return true;
    } catch {
      // try next selector
    }
  }

  // Strategy 2: check for auth cookies (Udemy sets these when logged in)
  try {
    const cookies = await page.context().cookies();
    const authCookies = ['access_token', 'client_id', 'ud_cache_bearer_token', 'bearer_token'];
    const found = cookies.some((c) => authCookies.some((name) => c.name.toLowerCase().includes(name)));
    if (found) return true;
  } catch {
    // ignore
  }

  // Strategy 3: absence of the "Log in" button is a reasonable signal
  try {
    const loginBtn = await page.$('a[href*="/login/"], button[class*="login"], [data-purpose*="login"]');
    if (!loginBtn) {
      // No login button and page loaded — likely logged in
      const url = page.url();
      if (!url.includes('/login') && !url.includes('/join')) return true;
    }
  } catch {
    // ignore
  }

  return false;
}

function waitForUserConfirmation(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export async function ensureLoggedIn(page: Page): Promise<void> {
  console.log('Checking Udemy login status...');
  await page.goto(UDEMY_HOME, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // Give the page a moment to render dynamic login indicators
  await page.waitForTimeout(2000);

  if (await isLoggedIn(page)) {
    console.log('Already logged in. Continuing.');
    return;
  }

  console.log('\n--- MANUAL LOGIN REQUIRED ---');
  console.log('The browser is open. Please log into Udemy now.');
  console.log('Once you are logged in, return here and press ENTER to continue.\n');

  await waitForUserConfirmation('Press ENTER after you have logged in > ');

  // Let the page settle after potential navigation from login
  await page.waitForTimeout(2000);

  // Re-check on whatever page the browser is currently on
  // (user may have been redirected after login — no need to navigate away)
  const currentUrl = page.url();
  if (!currentUrl.includes('udemy.com')) {
    await page.goto(UDEMY_HOME, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2000);
  }

  if (await isLoggedIn(page)) {
    console.log('Login verified. Continuing.\n');
    return;
  }

  // Final fallback: ask the user to confirm manually
  console.log('\nAutomatic login detection was inconclusive.');
  const answer = await waitForUserConfirmation('Are you logged into Udemy in the browser? (y/n) > ');
  if (answer === 'y' || answer === 'yes') {
    console.log('Proceeding on your confirmation.\n');
    return;
  }

  throw new Error(
    'Login not confirmed. Please log into Udemy in the browser and try again.',
  );
}
