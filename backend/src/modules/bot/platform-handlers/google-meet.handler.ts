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

  // Dismiss the "Do you want people to see and hear you?" modal that Meet
  // shows on the very first guest visit. The bot is a notetaker — no mic/cam needed.
  log('Looking for "Continue without microphone and camera" link...');
  const continueWithoutMediaSelectors = [
    'text=/continue without microphone and camera/i',
    'a:has-text("Continue without microphone and camera")',
    'button:has-text("Continue without microphone and camera")',
    'div[role="button"]:has-text("Continue without microphone and camera")',
  ];
  for (const sel of continueWithoutMediaSelectors) {
    try {
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'visible', timeout: 4000 });
      await el.click();
      log(`Dismissed media modal via: ${sel}`);
      await page.waitForTimeout(2000);
      break;
    } catch {}
  }

  // Try to dismiss any other popups
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
    log('WARNING: name input not found — dumping page state');
    await snapshot(page, 'no-name-input');
    try {
      const bodyText = await page.locator('body').innerText({ timeout: 2000 });
      log(`Page body text (first 500 chars): ${bodyText.substring(0, 500).replace(/\n/g, ' | ')}`);
    } catch {}
    try {
      const allInputs = await page.locator('input').count();
      log(`Total <input> elements on page: ${allInputs}`);
      for (let i = 0; i < Math.min(allInputs, 5); i++) {
        const inp = page.locator('input').nth(i);
        const aria = await inp.getAttribute('aria-label').catch(() => null);
        const placeholder = await inp.getAttribute('placeholder').catch(() => null);
        const type = await inp.getAttribute('type').catch(() => null);
        log(`  input[${i}] type=${type} aria-label=${aria} placeholder=${placeholder}`);
      }
    } catch {}
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
    log('ERROR: could not find join button — dumping page state');
    await snapshot(page, 'no-join-button');
    try {
      const buttons = await page.locator('button').allTextContents();
      log(`Visible buttons: ${JSON.stringify(buttons.slice(0, 20))}`);
    } catch {}
    try {
      const bodyText = await page.locator('body').innerText({ timeout: 2000 });
      log(`Page body text (first 500 chars): ${bodyText.substring(0, 500).replace(/\n/g, ' | ')}`);
    } catch {}
    try {
      const links = await page.locator('a').allTextContents();
      log(`Visible links: ${JSON.stringify(links.slice(0, 20))}`);
    } catch {}
    throw new Error('Could not find join button on Google Meet page');
  }

  // Wait briefly for the join request to register
  await page.waitForTimeout(3000);
  await snapshot(page, 'after-join-click');
  log('Join button clicked, waiting for admission...');
}
