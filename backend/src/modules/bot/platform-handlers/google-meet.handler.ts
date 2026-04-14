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

  // Wait for the page to settle into a definitive state. The "Getting ready..."
  // spinner can show for several seconds before either the prejoin screen
  // appears (good) or "You can't join this video call" appears (host not in meeting).
  log('Waiting for Meet to settle into prejoin or error state...');
  let state = await waitForPrejoinReady(page, 30000);
  log(`Initial detected state: ${state}`);

  // If we're in 'unknown' state, check if it's because Meet shows "can't join" — retry with reload
  const totalRetryMs = 5 * 60 * 1000;
  const retryDeadline = Date.now() + totalRetryMs;
  while (state === 'unknown' && Date.now() < retryDeadline) {
    const cantJoin = await page
      .locator("text=/can't join this video call/i")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (!cantJoin) {
      log("Page is in unknown state but not on \"can't join\" screen — checking again");
      state = await waitForPrejoinReady(page, 10000);
      log(`Re-detected state: ${state}`);
      if (state !== 'unknown') break;
      // Still unknown — capture and bail
      await snapshot(page, 'unknown-state', uploader);
      try {
        const bodyText = await page.locator('body').innerText({ timeout: 2000 });
        log(`Body text (first 500 chars): ${bodyText.substring(0, 500).replace(/\n/g, ' | ')}`);
      } catch {}
      throw new Error('Meet page in unknown state');
    }
    log("Meet says \"can't join this video call\" — host not in meeting yet, will retry in 20s");
    await page.waitForTimeout(20000);
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
      state = await waitForPrejoinReady(page, 15000);
      log(`After reload, detected state: ${state}`);
    } catch (err: any) {
      log(`Reload failed: ${err.message}`);
    }
  }

  if (Date.now() >= retryDeadline) {
    await snapshot(page, 'host-never-started', uploader);
    throw new Error('Host did not start the meeting within 5 minutes — giving up');
  }

  log(`Final detected state: ${state}`);

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

  // Dismiss the "Sign in with your Google account" coachmark if present
  try {
    await page.locator('button:has-text("Got it")').first().click({ timeout: 2000 });
    log('Dismissed "Got it" coachmark');
    await page.waitForTimeout(500);
  } catch {}

  // Try to dismiss any other popups
  try {
    await page.click('button[aria-label="Dismiss"]', { timeout: 1000 });
    log('Dismissed an extra popup');
  } catch {}

  // Find the name input. Real Meet uses placeholder="Your name" and no aria-label.
  log('Looking for name input...');
  let nameInputFound = false;
  const nameSelectors = [
    'input[placeholder="Your name"]',
    'input[aria-label="Your name"]',
    'input[type="text"]',
  ];
  for (const sel of nameSelectors) {
    try {
      const input = page.locator(sel).first();
      await input.waitFor({ state: 'visible', timeout: 5000 });
      await input.click();
      await input.fill('');
      await input.type(botName, { delay: 30 });
      const value = await input.inputValue().catch(() => '');
      log(`Entered name via selector: ${sel} (input value now: "${value}")`);
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

  // Brief pause to let the join button transition from disabled→enabled after name entry
  await page.waitForTimeout(1500);

  // Click the join button. It only becomes clickable after a name is entered.
  log('Looking for join button...');
  const joinSelectors = [
    'button:has-text("Ask to join")',
    'button:has-text("Join now")',
    'button[jsname="Qx7uuf"]',
    'button[aria-label*="Ask to join" i]',
    'button[aria-label*="Join now" i]',
    'div[role="button"]:has-text("Ask to join")',
    'div[role="button"]:has-text("Join now")',
  ];

  let joined = false;
  for (const sel of joinSelectors) {
    try {
      const btn = page.locator(sel).first();
      // Wait for it to be both visible AND enabled
      await btn.waitFor({ state: 'visible', timeout: 5000 });
      // Wait up to 5s for the button to become enabled (no longer aria-disabled)
      const enabledDeadline = Date.now() + 5000;
      while (Date.now() < enabledDeadline) {
        const disabled = await btn.getAttribute('aria-disabled').catch(() => null);
        if (disabled !== 'true') break;
        await page.waitForTimeout(300);
      }
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
  log('Join clicked, verifying result...');

  // Verify the click actually resulted in admission (or waiting-to-be-admitted).
  // Meet can silently reject anonymous/Workspace-policy join attempts by routing
  // the bot back to "You can't join this video call" within a few seconds —
  // so we need to check for that specifically and throw, otherwise the bot
  // will happily "record" an empty rejection page.
  const cantJoin = await page
    .locator("text=/can't join this video call/i")
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (cantJoin) {
    log('ERROR: Meet rejected the join request (likely Workspace anonymous-user policy)');
    await snapshot(page, 'rejected-after-join', uploader);
    throw new Error(
      'Meet rejected the bot\'s join request. The Workspace admin needs to enable ' +
        '"Let users without a Google Account join meetings" in admin.google.com, ' +
        'OR configure a signed-in bot session via BOT_GOOGLE_SESSION_S3_KEY.',
    );
  }
  log('Join result: bot is either admitted or waiting in lobby');
}
