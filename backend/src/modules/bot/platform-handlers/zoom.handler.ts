import type { Page } from 'playwright';

export async function joinZoom(page: Page, meetingUrl: string, botName: string): Promise<void> {
  // Zoom web client URL format
  const webUrl = meetingUrl.replace('zoom.us/j/', 'app.zoom.us/wc/join/');
  await page.goto(webUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Enter name
  try {
    const nameInput = page.locator('#inputname, input[placeholder*="name" i]').first();
    await nameInput.waitFor({ timeout: 5000 });
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(botName);
  } catch {}

  // Click Join
  try {
    const joinBtn = page.locator('#joinBtn, button:has-text("Join")').first();
    await joinBtn.click({ timeout: 5000 });
  } catch {}

  await page.waitForTimeout(5000);
  console.log('[Zoom] Bot attempted to join meeting');
}
