import type { Page } from 'puppeteer';

export async function joinZoom(page: Page, meetingUrl: string, botName: string): Promise<void> {
  // Zoom web client URL format
  const webUrl = meetingUrl.replace('zoom.us/j/', 'app.zoom.us/wc/join/');
  await page.goto(webUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Enter name
  try {
    const nameInput = await page.$('#inputname') || await page.$('input[placeholder*="name" i]');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type(botName, { delay: 50 });
    }
  } catch {}

  // Click Join
  try {
    const joinBtn = await page.$('#joinBtn') || await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.find(b => /join/i.test(b.textContent || ''));
    });
    if (joinBtn) await (joinBtn as any).click();
  } catch {}

  await new Promise(r => setTimeout(r, 5000));
  console.log('[Zoom] Bot attempted to join meeting');
}
