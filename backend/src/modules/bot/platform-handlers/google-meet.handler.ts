import type { Page } from 'playwright';

export async function joinGoogleMeet(page: Page, meetingUrl: string, botName: string): Promise<void> {
  await page.goto(meetingUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Try to dismiss any initial dialogs/popups
  try {
    await page.click('button[aria-label="Dismiss"]', { timeout: 2000 });
  } catch {}

  // Enter name (anonymous join)
  try {
    const nameInput = page.locator('input[aria-label="Your name"], input[placeholder*="name" i]').first();
    await nameInput.waitFor({ timeout: 10000 });
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(botName);
  } catch {
    // May already have a name set
  }

  // Turn off microphone
  try {
    await page.click('[data-is-muted="false"][aria-label*="microphone" i], button[aria-label*="Turn off microphone" i]', { timeout: 2000 });
  } catch {}

  // Turn off camera
  try {
    await page.click('[data-is-muted="false"][aria-label*="camera" i], button[aria-label*="Turn off camera" i]', { timeout: 2000 });
  } catch {}

  await page.waitForTimeout(1000);

  // Click "Ask to join" or "Join now"
  try {
    const joinBtn = page.locator('button[data-mdc-dialog-action="join"], button:has-text("Ask to join"), button:has-text("Join now")').first();
    await joinBtn.click({ timeout: 5000 });
  } catch {}

  // Wait for meeting to load (admitted)
  await page.waitForTimeout(5000);
  console.log('[GoogleMeet] Bot attempted to join meeting');
}
