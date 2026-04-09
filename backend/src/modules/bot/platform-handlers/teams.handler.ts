import type { Page } from 'puppeteer';

export async function joinTeams(page: Page, meetingUrl: string, botName: string): Promise<void> {
  await page.goto(meetingUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Click "Continue on this browser"
  try {
    const continueBtn = await page.evaluateHandle(() => {
      const links = [...document.querySelectorAll('a, button')];
      return links.find(el => /continue on this browser/i.test(el.textContent || ''));
    });
    if (continueBtn) await (continueBtn as any).click();
    await new Promise(r => setTimeout(r, 2000));
  } catch {}

  // Enter name
  try {
    const nameInput = await page.$('input[placeholder*="name" i]') || await page.$('#username');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type(botName, { delay: 50 });
    }
  } catch {}

  // Click Join now
  try {
    const joinBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.find(b => /join now/i.test(b.textContent || ''));
    });
    if (joinBtn) await (joinBtn as any).click();
  } catch {}

  await new Promise(r => setTimeout(r, 5000));
  console.log('[Teams] Bot attempted to join meeting');
}
