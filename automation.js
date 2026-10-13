const { chromium } = require('playwright');
const { solveSelectedHomework } = require('./solver.js');
require('dotenv').config();

const TARGET_URL = 'https://sparxmaths.uk';
const DEFAULT_TIMEOUT = 15_000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function visible(locator, timeout = 800) {
  return locator.first().isVisible({ timeout }).catch(() => false);
}

async function firstVisible(locators, timeout = DEFAULT_TIMEOUT) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const locator of locators) {
      if (await visible(locator, 250)) return locator.first();
    }
    await sleep(100);
  }
  throw new Error('Expected form control did not become visible.');
}

async function readPageMessage(page) {
  return page.locator('[role="alert"], [aria-live="assertive"], .error, .alert-error')
    .allTextContents()
    .then(messages => messages.map(message => message.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '))
    .catch(() => '');
}

async function loginAndGetHomeworks(
  schoolName,
  username,
  password,
  subject = 'maths',
  minTime = 30,
  maxTime = 55,
  customDate = ''
) {
  console.log(`🚀 Portal Launcher: Sparx ${subject.toUpperCase()}`);
  const list = [];

  // Keep the established manual-entry contract unchanged.
  if (subject !== 'maths') {
    list.push({ due: customDate || 'Custom Assigned Date Task', percent: 0 });
    return {
      list,
      runSolver: async (index, updateDiscord) => {
        await solveSelectedHomework(null, list[index], 0, 0, updateDiscord, subject);
      }
    };
  }

  let browser;
  let context;
  let page;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await browser?.close().catch(() => {});
  };

  try {
    browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-GB', timezoneId: 'Europe/London', viewport: { width: 1280, height: 800 }
    });
    page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT);

    const acceptCookies = async () => {
      const button = await firstVisible([
        page.getByRole('button', { name: /accept all|accept cookies|i accept|allow all/i })
      ], 1_500).catch(() => null);
      if (button) await button.click({ timeout: 2_000 }).catch(() => {});
    };

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await acceptCookies();

    const school = schoolName.trim();
    if (!school) throw new Error('A school name is required.');
    const schoolInput = await firstVisible([
      page.locator('input[placeholder*="school" i]'),
      page.locator('input[name*="school" i]')
    ]);
    await schoolInput.fill(school);

    const option = page.getByText(new RegExp(`^${escapeRegExp(school)}$`, 'i')).first();
    await option.waitFor({ state: 'visible', timeout: 10_000 }).catch(async () => {
      throw new Error(`No exact school match was offered for "${school}".`);
    });
    await option.click();
    await page.getByRole('button', { name: /continue/i }).first().click();

    const usernameInput = await firstVisible([
      page.locator('#username'), page.locator('input[name="username"]'), page.locator('input[autocomplete="username"]')
    ], 20_000);
    await usernameInput.fill(username.trim().toLowerCase());
    await usernameInput.press('Enter');

    const passwordInput = await firstVisible([
      page.locator('#password'), page.locator('input[type="password"]')
    ]);
    await passwordInput.fill(password.trim());
    const submit = page.getByRole('button', { name: /^(log in|sign in|continue)$/i }).first();
    if (await visible(submit, 800)) await submit.click();
    else await passwordInput.press('Enter');

    // Either authentication moves us away from the password form or the page exposes an error.
    await Promise.race([
      passwordInput.waitFor({ state: 'hidden', timeout: 20_000 }),
      page.locator('[role="alert"], [aria-live="assertive"], .error, .alert-error').first().waitFor({ state: 'visible', timeout: 20_000 })
    ]).catch(() => {});
    if (await visible(passwordInput, 300)) {
      const message = await readPageMessage(page);
      throw new Error(`Login did not complete.${message ? ` Portal message: ${message}` : ' Check the selected school and credentials.'}`);
    }

    await acceptCookies();
    console.log('⏳ Waiting for the homework dashboard...');
    await page.waitForFunction(() => /homework|due|completed/i.test(document.body?.innerText || ''), null, { timeout: 30_000 }).catch(() => {});

    const scrapeHomework = () => page.evaluate(() => {
      const normalise = value => (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      const due = value => /\bdue\b.*(?:\d|today|tomorrow|mon|tues|wednes|thurs|fri|satur|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(value);
      const selectors = '[data-testid*="homework" i], [class*="homework" i], [class*="package" i], article, [role="article"]';
      const cards = [...document.querySelectorAll(selectors)].filter(element => {
        const text = normalise(element.innerText);
        return text.length > 0 && text.length <= 900 && due(text);
      });
      const results = cards.map(card => {
        const text = normalise(card.innerText);
        const dueText = (text.match(/[^.\n]*\bdue\b[^.\n]*/i)?.[0] || text).slice(0, 180);
        const match = text.match(/\b(\d{1,3})\s*%/);
        return {
          due: dueText,
          percent: match ? Math.min(100, Number(match[1])) : (/completed/i.test(text) ? 100 : 0),
          hasProgress: Boolean(match) || /completed/i.test(text),
          textLength: text.length
        };
      });
      // Several selectors can match one card. For each due line, retain the
      // smallest matching container that actually carries its progress state.
      const byDue = new Map();
      for (const item of results) {
        const key = item.due.toLowerCase();
        const current = byDue.get(key);
        if (!current || (item.hasProgress && !current.hasProgress) ||
          (item.hasProgress === current.hasProgress && item.textLength < current.textLength)) {
          byDue.set(key, item);
        }
      }
      return [...byDue.values()].map(({ due, percent }) => ({ due, percent }));
    });

    let results = [];
    let previous = '';
    for (let attempt = 1; attempt <= 5; attempt++) {
      results = await scrapeHomework();
      const snapshot = JSON.stringify(results);
      console.log(`   Scan ${attempt}/5: ${results.length} homework item(s) found`);
      if (results.length && snapshot === previous) break;
      previous = snapshot;
      if (attempt < 5) await sleep(400);
    }
    list.push(...results);
    if (!list.length) {
      console.log(`⚠️ No homework found (page: ${await page.title()}, ${page.url()}).`);
      list.push({ due: 'No Tasks Found', percent: 0 });
    }

    return {
      list,
      close,
      runSolver: async (index, updateDiscord) => {
        const homework = list[index];
        if (!homework) { await updateDiscord?.('❌ Invalid homework selection.'); return; }
        if (homework.due === 'No Tasks Found') {
          await updateDiscord?.('❌ No homework was detected. Check the browser dashboard and logs.');
          await close();
          return;
        }
        try {
          await solveSelectedHomework(page, homework, Number.parseInt(minTime, 10), Number.parseInt(maxTime, 10), updateDiscord, subject);
        } finally {
          await close();
        }
      }
    };
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    await close();
    throw error;
  }
}

module.exports = { loginAndGetHomeworks };
