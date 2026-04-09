import type { Page } from 'puppeteer';

export async function joinGoogleMeet(page: Page, meetingUrl: string, botName: string): Promise<void> {
  await page.goto(meetingUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Try to dismiss any initial dialogs/popups
  try {
    const dismissBtn = await page.$('button[aria-label="Dismiss"]');
    if (dismissBtn) await dismissBtn.click();
  } catch {}

  // Enter name (anonymous join)
  try {
    await page.waitForSelector('input[aria-label="Your name"], input[placeholder*="name" i]', { timeout: 10000 });
    const nameInput = await page.$('input[aria-label="Your name"]') || await page.$('input[placeholder*="name" i]');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type(botName, { delay: 50 });
    }
  } catch {
    // May already have a name set
  }

  // Turn off microphone
  try {
    const micBtn = await page.$('[data-is-muted="false"][aria-label*="microphone" i]') || await page.$('button[aria-label*="Turn off microphone" i]');
    if (micBtn) await micBtn.click();
  } catch {}

  // Turn off camera
  try {
    const camBtn = await page.$('[data-is-muted="false"][aria-label*="camera" i]') || await page.$('button[aria-label*="Turn off camera" i]');
    if (camBtn) await camBtn.click();
  } catch {}

  await new Promise(r => setTimeout(r, 1000));

  // Click "Ask to join" or "Join now"
  try {
    const joinBtn = await page.$('button[data-mdc-dialog-action="join"]')
      || await page.evaluateHandle(() => {
        const buttons = [...document.querySelectorAll('button')];
        return buttons.find(b => /ask to join|join now/i.test(b.textContent || ''));
      });
    if (joinBtn && typeof (joinBtn as any).click === 'function') {
      await (joinBtn as any).click();
    }
  } catch {}

  // Wait for meeting to load (admitted)
  await new Promise(r => setTimeout(r, 5000));
  console.log('[GoogleMeet] Bot attempted to join meeting');
}
