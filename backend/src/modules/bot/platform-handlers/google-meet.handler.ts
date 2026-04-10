import type { Page } from 'playwright';
import { tmpdir } from 'os';
import { join } from 'path';

const log = (msg: string) => console.log(`[GoogleMeet] ${msg}`);

async function snapshot(page: Page, label: string): Promise<void> {
  try {
    const path = join(tmpdir(), `meet-${label}-${Date.now()}.png`);
    await page.screenshot({ path, fullPage: true });
    log(`Screenshot saved: ${path}`);
  } catch (err: any) {
    log(`Screenshot failed: ${err.message}`);
  }
}

export async function joinGoogleMeet(page: Page, meetingUrl: string, botName: string): Promise<void> {
  log(`Navigating to ${meetingUrl}`);
  try {
    await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    log('Page loaded (domcontentloaded)');
  } catch (err: any) {
    log(`Navigation error: ${err.message}`);
    await snapshot(page, 'nav-error');
    throw err;
  }

  // Let the JS bundle finish initializing
  await page.waitForTimeout(5000);
  log(`Current URL after wait: ${page.url()}`);
  log(`Page title: ${await page.title()}`);
  await snapshot(page, 'after-load');

  // Try to dismiss any popups
  try {
    await page.click('button[aria-label="Dismiss"]', { timeout: 1500 });
    log('Dismissed a popup');
  } catch {}

  // Find the name input. Google Meet uses several variants.
  log('Looking for name input...');
  let nameInputFound = false;
  const nameSelectors = [
    'input[aria-label="Your name"]',
    'input[placeholder="Your name"]',
    'input[jsname][type="text"]',
    'input[type="text"]',
  ];

  for (const sel of nameSelectors) {
    try {
      const input = page.locator(sel).first();
      await input.waitFor({ state: 'visible', timeout: 3000 });
      await input.click({ clickCount: 3 });
      await input.fill(botName);
      log(`Entered name "${botName}" via selector: ${sel}`);
      nameInputFound = true;
      break;
    } catch {}
  }

  if (!nameInputFound) {
    log('WARNING: name input not found — may already be on the join screen');
    await snapshot(page, 'no-name-input');
  }

  await page.waitForTimeout(1000);

  // Find and click the join button. Try multiple variants.
  log('Looking for join button...');
  const joinSelectors = [
    'button[jsname="Qx7uuf"]',                       // current Meet "Ask to join"
    'button:has-text("Ask to join")',
    'button:has-text("Join now")',
    'button[aria-label*="Ask to join" i]',
    'button[aria-label*="Join now" i]',
    'div[role="button"]:has-text("Ask to join")',
    'div[role="button"]:has-text("Join now")',
  ];

  let joined = false;
  for (const sel of joinSelectors) {
    try {
      const btn = page.locator(sel).first();
      await btn.waitFor({ state: 'visible', timeout: 3000 });
      await btn.click();
      log(`Clicked join button via selector: ${sel}`);
      joined = true;
      break;
    } catch {}
  }

  if (!joined) {
    log('ERROR: could not find join button');
    await snapshot(page, 'no-join-button');
    // Dump button text for debugging
    try {
      const buttons = await page.locator('button').allTextContents();
      log(`Visible buttons: ${JSON.stringify(buttons.slice(0, 20))}`);
    } catch {}
    throw new Error('Could not find join button on Google Meet page');
  }

  // Wait briefly for the join request to register
  await page.waitForTimeout(3000);
  await snapshot(page, 'after-join-click');
  log('Join button clicked, waiting for admission...');
}
