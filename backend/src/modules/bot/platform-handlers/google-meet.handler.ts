import type { Page } from 'playwright';
import { tmpdir } from 'os';
import { join } from 'path';

/** Optional screenshot uploader. If provided, the handler uploads each
 *  screenshot buffer and logs the returned URL. */
export type ScreenshotUploader = (buffer: Buffer, label: string) => Promise<string | null>;

const log = (msg: string) => console.log(`[GoogleMeet] ${msg}`);

async function snapshot(page: Page, label: string, uploader?: ScreenshotUploader): Promise<void> {
  try {
    const buffer = await page.screenshot({ fullPage: true });
    // Always also dump to /tmp as a fallback
    const localPath = join(tmpdir(), `meet-${label}-${Date.now()}.png`);
    try {
      const fs = require('fs');
      fs.writeFileSync(localPath, buffer);
    } catch {}

    if (uploader) {
      const url = await uploader(buffer, label).catch(() => null);
      if (url) {
        log(`Screenshot [${label}]: ${url}`);
        return;
      }
    }
    log(`Screenshot [${label}] saved locally: ${localPath}`);
  } catch (err: any) {
    log(`Screenshot failed: ${err.message}`);
  }
}

/**
 * Wait until either the name input or the media-permission modal appears.
 * Whichever appears first wins; we then handle that state.
 */
async function waitForPrejoinReady(page: Page, timeoutMs = 20000): Promise<'name' | 'modal' | 'unknown'> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Check for the name input (means we're already on the prejoin screen)
    const nameVisible = await page.locator('input[type="text"]').first().isVisible().catch(() => false);
    if (nameVisible) return 'name';

    // Check for the media-permission modal
    const modalVisible = await page
      .locator('text=/continue without microphone and camera/i')
      .first()
      .isVisible()
      .catch(() => false);
    if (modalVisible) return 'modal';

    await page.waitForTimeout(500);
  }
  return 'unknown';
}

export async function joinGoogleMeet(
  page: Page,
  meetingUrl: string,
  botName: string,
  uploader?: ScreenshotUploader,
): Promise<void> {
  log(`Navigating to ${meetingUrl}`);
  try {
    await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    log('Page loaded (domcontentloaded)');
  } catch (err: any) {
    log(`Navigation error: ${err.message}`);
    await snapshot(page, 'nav-error', uploader);
    throw err;
  }

  // Initial settle
  await page.waitForTimeout(2000);
  log(`Current URL: ${page.url()}`);
  log(`Page title: ${await page.title()}`);
  await snapshot(page, 'after-load', uploader);

  // Detect "You can't join this video call" — host hasn't started the meeting yet.
  // Retry every 20s for up to 5 minutes.
  const totalRetryMs = 5 * 60 * 1000;
  const retryDeadline = Date.now() + totalRetryMs;
  while (Date.now() < retryDeadline) {
    const cantJoin = await page
      .locator("text=/can't join this video call/i")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (!cantJoin) break;
    log("Meet says \"can't join this video call\" — host not in meeting yet, will retry in 20s");
    await page.waitForTimeout(20000);
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
    } catch (err: any) {
      log(`Reload failed: ${err.message}`);
    }
  }
  if (Date.now() >= retryDeadline) {
    await snapshot(page, 'host-never-started', uploader);
    throw new Error('Host did not start the meeting within 5 minutes — giving up');
  }

  // Wait for either the prejoin screen or the media-permission modal
  log('Waiting for prejoin screen or media modal...');
  const state = await waitForPrejoinReady(page, 20000);
  log(`Detected state: ${state}`);

  if (state === 'modal') {
    log('Dismissing "Continue without microphone and camera" modal...');
    try {
      await page.locator('text=/continue without microphone and camera/i').first().click({ timeout: 3000 });
      log('Modal dismissed');
      await page.waitForTimeout(2500);
    } catch (err: any) {
      log(`Failed to click modal dismiss: ${err.message}`);
      await snapshot(page, 'modal-click-failed', uploader);
    }
  } else if (state === 'unknown') {
    log('WARNING: Neither prejoin screen nor modal detected within 20s');
    await snapshot(page, 'unknown-state', uploader);
    try {
      const bodyText = await page.locator('body').innerText({ timeout: 2000 });
      log(`Body text (first 500 chars): ${bodyText.substring(0, 500).replace(/\n/g, ' | ')}`);
    } catch {}
  }

  // Try to dismiss any other popups
  try {
    await page.click('button[aria-label="Dismiss"]', { timeout: 1000 });
    log('Dismissed an extra popup');
  } catch {}

  // Find the name input
  log('Looking for name input...');
  let nameInputFound = false;
  const nameSelectors = [
    'input[aria-label="Your name"]',
    'input[placeholder="Your name"]',
    'input[type="text"]',
  ];
  for (const sel of nameSelectors) {
    try {
      const input = page.locator(sel).first();
      await input.waitFor({ state: 'visible', timeout: 5000 });
      await input.click({ clickCount: 3 });
      await input.fill(botName);
      log(`Entered name "${botName}" via selector: ${sel}`);
      nameInputFound = true;
      break;
    } catch {}
  }

  if (!nameInputFound) {
    log('WARNING: name input not found');
    await snapshot(page, 'no-name-input', uploader);
    try {
      const allInputs = await page.locator('input').count();
      log(`Total <input> elements: ${allInputs}`);
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

  // Click join button
  log('Looking for join button...');
  const joinSelectors = [
    'button[jsname="Qx7uuf"]',
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
      log(`Clicked join button via: ${sel}`);
      joined = true;
      break;
    } catch {}
  }

  if (!joined) {
    log('ERROR: could not find join button');
    await snapshot(page, 'no-join-button', uploader);
    try {
      const buttons = await page.locator('button').allTextContents();
      log(`Visible buttons: ${JSON.stringify(buttons.slice(0, 20))}`);
    } catch {}
    throw new Error('Could not find join button on Google Meet page');
  }

  await page.waitForTimeout(3000);
  await snapshot(page, 'after-join-click', uploader);
  log('Join clicked, waiting for admission...');
}
