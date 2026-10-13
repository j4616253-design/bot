const { chromium } = require('playwright');
const { solveSelectedHomework } = require('./solver.js');
require('dotenv').config();
const TARGET_URL = 'https://sparxmaths.uk';

async function loginAndGetHomeworks(schoolName, username, password, subject = 'maths', minTime = 30, maxTime = 55, customDate = '') {
  console.log('='.repeat(60));
  console.log(`🚀 Portal Launcher: Sparx ${subject.toUpperCase()}`);
  if (subject === 'maths') {
    console.log(`⏱️ Flow parameters: ${minTime}s – ${maxTime}s/question`);
    console.log(`🔒 Running in INVISIBLE mode`);
  } else {
    console.log(`📅 Manual Entry Mode: Forwarding date context "${customDate}" straight to solver...`);
  }
  console.log('='.repeat(60));

  const list = [];

  if (subject !== 'maths') {
    console.log(`ℹ️ Reader/Science requested. Bypassing browser launch and using manual label data configuration...`);
    list.push({
      due: customDate || 'Custom Assigned Date Task',
      percent: 0
    });
    return {
      list,
      runSolver: async (index, updateDiscord) => {
        await solveSelectedHomework(null, list[index], 0, 0, updateDiscord, subject);
      }
    };
  }

  const browser = await chromium.launch({
    headless: true,
    slowMo: 120,
    args: ['--no-sandbox']
  });

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    viewport: { width: 1280, height: 800 }
  });

  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  const acceptCookies = async () => {
    for (const t of [/Accept all/i, /Accept cookies/i, /I accept/i, /Allow all/i, /OK/i]) {
      try {
        const b = page.getByRole('button', { name: t });
        if (await b.isVisible({ timeout: 2000 })) {
          await b.click({ force: true });
          await page.waitForTimeout(800);
          break;
        }
      } catch {}
    }
  };

  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(15
