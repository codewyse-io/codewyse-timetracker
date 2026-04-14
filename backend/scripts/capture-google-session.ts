/**
 * Capture a signed-in Google session for the meeting bot.
 *
 * Run this LOCALLY (on your dev machine, not on the server). It opens a real
 * Chromium window pointed at Google sign-in. You log in with the bot's Gmail
 * account by hand, complete any 2FA challenges, then press Enter in the terminal.
 * The script saves the cookies + localStorage to ./bot-google-session.json.
 *
 * Then upload that JSON to S3 at the key referenced by BOT_GOOGLE_SESSION_S3_KEY,
 * or copy it to the server at the path referenced by BOT_GOOGLE_SESSION_PATH.
 *
 * Usage:
 *   cd backend
 *   npx ts-node scripts/capture-google-session.ts
 *
 * Notes:
 *   - Use a DEDICATED Gmail account for the bot, not your personal one
 *   - Cookies expire after ~2-4 weeks; re-run this script when the bot starts
 *     getting silently rejected again
 *   - Keep the resulting JSON file SECRET — it's equivalent to the bot's password
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

const OUTPUT_PATH = path.resolve(__dirname, '..', 'bot-google-session.json');

async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => { rl.close(); resolve(); }));
}

async function main() {
  console.log('========================================');
  console.log('Bot Google Session Capture');
  console.log('========================================');
  console.log('');
  console.log('Launching Chromium...');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  // Mask webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  await page.goto('https://accounts.google.com/signin', { waitUntil: 'domcontentloaded' });

  console.log('');
  console.log('A Chromium window is now open at Google sign-in.');
  console.log('1. Log in with the dedicated bot Gmail account');
  console.log('2. Complete 2FA / device verification if prompted');
  console.log('3. Wait until you reach the Google account home page (myaccount.google.com)');
  console.log('4. Optionally visit https://meet.google.com once to warm up Meet cookies');
  console.log('5. Then return here and press Enter');
  console.log('');

  await waitForEnter('Press Enter when you are signed in and ready to save the session...');

  console.log('Saving storage state...');
  const state = await context.storageState();
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(state, null, 2));

  console.log('');
  console.log(`Session saved to: ${OUTPUT_PATH}`);
  console.log(`File size: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`);
  console.log(`Cookies: ${state.cookies.length}`);
  console.log(`Origins with localStorage: ${state.origins.length}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Upload this JSON to S3 (or copy to the server)');
  console.log('     aws s3 cp bot-google-session.json s3://<your-bucket>/bot/google-session.json');
  console.log('  2. Set the env var on Elastic Beanstalk:');
  console.log('     BOT_GOOGLE_SESSION_S3_KEY=bot/google-session.json');
  console.log('  3. Restart the EB app');
  console.log('  4. Test the bot — it should now appear as a signed-in Google user');
  console.log('');

  await browser.close();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
