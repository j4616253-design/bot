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

  // ==============================================
  // ✅ READER / SCIENCE PATH — FULLY PRESERVED
  // ==============================================
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

  // ==============================================
  // 🚨 MATHS PATH — Cleaned scraper below
  // ==============================================
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
    await page.waitForTimeout(1500);
    await acceptCookies();

    const schIn = page.locator('input[placeholder*="school"]').first();
    await schIn.waitFor({ state: 'visible' });
    await schIn.click({ force: true });
    await schIn.fill('');
    await schIn.pressSequentially(schoolName.trim(), { delay: 100 });
    await page.waitForTimeout(2500);
    await page.locator(`text=/^${schoolName.trim()}/i`).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /continue/i }).click({ force: true });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);

    const usr = page.locator('#username, input[name="username"]').first();
    await usr.waitFor({ state: 'visible', timeout: 10000 });
    await usr.fill(username.trim().toLowerCase());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);

    const pwd = page.locator('#password, input[type="password"]').first();
    await pwd.waitFor({ state: 'visible', timeout: 5000 });
    await pwd.fill(password.trim());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);

    const loginBtn = page.getByRole('button', { name: /^Log in/i }).or(page.locator('button[type="submit"]'));
    for (let i = 0; i < 3; i++) {
      if (await loginBtn.isVisible({ timeout: 1500 })) {
        await loginBtn.click({ force: true });
        await page.waitForTimeout(2500);
      }
    }
    if (await loginBtn.isVisible({ timeout: 1000 })) {
      throw new Error('❌ Authentication Failed — check login details');
    }

    await page.waitForTimeout(5000);
    await acceptCookies();

    console.log('\n⏳ Waiting for dashboard to load...');
    await page.waitForTimeout(5000);

    console.log('🖱️ Clicking homework cards...');
    const cards = page.locator('a, button, [role="button"]');
    const cardCount = await cards.count();

    for (let i = 0; i < cardCount; i++) {
      try {
        const text = await cards.nth(i).innerText();
        if ((text.includes('%') || /due|homework/i.test(text)) && text.length > 5 && text.length < 300) {
          await cards.nth(i).click({ timeout: 2000 });
          await page.waitForTimeout(700);
        }
      } catch {}
    }

    await page.waitForTimeout(2000);

    console.log('🔍 Scraping homework list...');
    const results = await page.evaluate(() => {
      const found = [];
      document.querySelectorAll('*').forEach(el => {
        const text = (el.innerText || '').trim();
        if (!text || !text.includes('%')) return;

        const pctMatch = text.match(/(\d{1,3})%/);
        const percent = pctMatch ? parseInt(pctMatch[1]) : 0;

        let title = '';
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        
        for (const line of lines) {
          if (
            line.includes('XP') || 
            line.includes('box-shadow') || 
            line.includes('rgba') ||
            /^\d+$/.test(line) ||
            line.length < 8
          ) continue;

          if (/due\s+/i.test(line) && /\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(line)) {
            title = line;
            break;
          }
        }

        if (title && !found.some(f => f.due === title)) {
          found.push({ due: title, percent });
        }
      });
      return found;
    });

    list.push(...results);

    if (list.length === 0) {
      console.log('⚠️ No homework found — dumping page content to debug:');
      const pageText = await page.innerText('body');
      console.log(pageText.slice(0, 2000));
      list.push({ due: 'No Tasks Found', percent: 0 });
    }

    console.log(`\n📋 Found ${list.length} homework(s):`);
    console.log('-'.repeat(40));
    list.forEach(h => console.log(`🔹 ${h.due} — ${h.percent}%`));
    console.log('-'.repeat(40) + '\n');

    return {
      list,
      runSolver: async (index, updateDiscord) => {
        if (list[index].due.includes('No Tasks Found')) {
          await updateDiscord('❌ No homework found. Check your login details.');
          await browser.close();
          return;
        }
        await solveSelectedHomework(page, list[index], parseInt(minTime), parseInt(maxTime), updateDiscord, subject);
        await browser.close();
      }
    };

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    await browser.close();
    throw err;
  }
}

module.exports = { loginAndGetHomeworks };