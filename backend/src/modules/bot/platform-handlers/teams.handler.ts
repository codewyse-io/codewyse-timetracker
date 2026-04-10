import type { Page } from 'playwright';

export async function joinTeams(page: Page, meetingUrl: string, botName: string): Promise<void> {
  await page.goto(meetingUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Click "Continue on this browser"
  try {
    const continueBtn = page.locator('a:has-text("Continue on this browser"), button:has-text("Continue on this browser")').first();
    await continueBtn.click({ timeout: 5000 });
    await page.waitForTimeout(2000);
  } catch {}

  // Enter name
  try {
    const nameInput = page.locator('input[placeholder*="name" i], #username').first();
    await nameInput.waitFor({ timeout: 5000 });
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(botName);
  } catch {}

  // Click Join now
  try {
    const joinBtn = page.locator('button:has-text("Join now")').first();
    await joinBtn.click({ timeout: 5000 });
  } catch {}

  await page.waitForTimeout(5000);
  console.log('[Teams] Bot attempted to join meeting');
}
