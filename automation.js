
const { chromium } = require('playwright');
const { solveSelectedHomework } = require('./solver.js');
require('dotenv').config();

const TARGET_URL = 'https://sparxmaths.uk';

async function loginAndGetHomeworks(
  schoolName,
  username,
  password,
  subject = 'maths',
  minTime = 30,
  maxTime = 55,
  customDate = ''
) {
  console.log('='.repeat(60));
  console.log(`🚀 Portal Launcher: Sparx ${subject.toUpperCase()}`);

  if (subject === 'maths') {
    console.log(`⏱️ Flow parameters: ${minTime}s – ${maxTime}s/question`);
    console.log('👁️ RUNNING IN VISIBLE MODE');
  } else {
    console.log(`📅 Manual Entry Mode: "${customDate}"`);
  }

  console.log('='.repeat(60));

  const list = [];

  // Non-maths tasks use the existing manual-entry flow.
  if (subject !== 'maths') {
    list.push({
      due: customDate || 'Custom Assigned Date Task',
      percent: 0
    });

    return {
      list,
      runSolver: async (index, updateDiscord) => {
        await solveSelectedHomework(
          null,
          list[index],
          0,
          0,
          updateDiscord,
          subject
        );
      }
    };
  }

  let browser;

  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 100,
      args: ['--no-sandbox']
    });

    const ctx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      viewport: { width: 1280, height: 800 }
    });

    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);

    // Accept a cookie banner if one appears.
    const acceptCookies = async () => {
      const names = [
        /accept all/i,
        /accept cookies/i,
        /i accept/i,
        /allow all/i
      ];

      for (const name of names) {
        try {
          const button = page.getByRole('button', { name });

          if (await button.first().isVisible({ timeout: 1000 })) {
            await button.first().click();
            await page.waitForTimeout(500);
            return;
          }
        } catch {
          // Banner not present or button not available.
        }
      }
    };

    // Open Sparx.
    await page.goto(TARGET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    await acceptCookies();

    // Select school.
    const schoolInput = page.locator(
      'input[placeholder*="school" i]'
    ).first();

    await schoolInput.waitFor({ state: 'visible' });
    await schoolInput.fill(schoolName.trim());
    await page.waitForTimeout(1500);

    // Prefer an exact school-name match.
    const schoolOption = page
      .getByText(new RegExp(
        '^' + schoolName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$',
        'i'
      ))
      .first();

    await schoolOption.click();

    const continueButton = page.getByRole('button', {
      name: /continue/i
    });

    await continueButton.click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    // Enter username.
    const usernameInput = page
      .locator('#username, input[name="username"]')
      .first();

    await usernameInput.waitFor({ state: 'visible', timeout: 20000 });
    await usernameInput.fill(username.trim().toLowerCase());

    await page.keyboard.press('Enter');

    // Enter password.
    const passwordInput = page
      .locator('#password, input[type="password"]')
      .first();

    await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
    await passwordInput.fill(password.trim());

    await page.keyboard.press('Enter');

    // If a login button remains visible, try clicking it.
    const loginButton = page
      .getByRole('button', { name: /^log in/i })
      .or(page.locator('button[type="submit"]'))
      .first();

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (await loginButton.isVisible({ timeout: 1000 })) {
          await loginButton.click();
          await page.waitForTimeout(1500);
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    // Wait for login to finish or report a likely login problem.
    await page.waitForTimeout(2000);

    if (await passwordInput.isVisible().catch(() => false)) {
      throw new Error(
        'Login may have failed. Check the credentials and any messages shown in the browser.'
      );
    }

    await acceptCookies();

    console.log('\n⏳ Waiting for the homework dashboard...');

    // Wait for relevant content; do not click homework cards.
    await page.waitForFunction(() => {
      const text = document.body?.innerText || '';
      return /homework|due|completed/i.test(text);
    }, null, { timeout: 30000 }).catch(() => {});

    // Scrape each card locally so a percentage on another card
    // cannot accidentally be assigned to this homework.
    const scrapeHomework = async () => {
      return page.evaluate(() => {
        const cleanLines = text =>
          (text || '')
            .replace(/\u00a0/g, ' ')
            .split('\n')
            .map(line => line.replace(/\s+/g, ' ').trim())
            .filter(Boolean);

        const isDueLine = line =>
          /\bdue\b/i.test(line) &&
          /\d|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(line);

        const selectors = [
          '[class*="Package_"]',
          '[class*="package" i]',
          '[class*="homework" i]',
          '[data-testid*="homework" i]',
          'article',
          '[role="article"]'
        ];

        const candidates = [
          ...new Set(
            selectors.flatMap(selector =>
              [...document.querySelectorAll(selector)]
            )
          )
        ];

        const extractCard = element => {
          const text = (element.innerText || '').trim();

          if (!text || text.length > 700) return null;

          const lines = cleanLines(text);
          const dueLine = lines.find(isDueLine);

          if (!dueLine) return null;

          const match = text.match(/\b(\d{1,3})\s*%/);

          const percent = /completed/i.test(text) && !match
            ? 100
            : match
              ? Math.min(100, Number(match[1]))
              : 0;

          return {
            due: dueLine.slice(0, 180),
            percent
          };
        };

        let results = candidates
          .map(extractCard)
          .filter(Boolean);

        // Fallback if the site's card class names have changed.
        if (results.length === 0) {
          const elements = [
            ...document.querySelectorAll(
              'main div, main section, main li, body div, body section, body li'
            )
          ];

          results = elements
            .filter(element => {
              const text = (element.innerText || '').trim();
              return text.length > 0 && text.length <= 700;
            })
            .filter(element =>
              ![...element.children].some(child => extractCard(child))
            )
            .map(extractCard)
            .filter(Boolean);
        }

        // Remove repeated wrappers for the same due line.
        const seen = new Set();

        return results.filter(item => {
          const key = item.due.toLowerCase().replace(/\s+/g, ' ');

          if (seen.has(key)) return false;

          seen.add(key);
          return true;
        });
      });
    };

    console.log('🔍 Scanning homework cards...');

    let results = [];
    let previousResults = '';
    let stableCount = 0;

    // Retry because the dashboard may render asynchronously.
    for (let attempt = 1; attempt <= 8; attempt++) {
      results = await scrapeHomework();

      const currentResults = JSON.stringify(results);

      console.log(
        `   Scan ${attempt}/8: ${results.length} homework item(s) found`
      );

      if (results.length > 0 && currentResults === previousResults) {
        stableCount++;

        if (stableCount >= 1) break;
      } else {
        stableCount = 0;
      }

      previousResults = currentResults;

      if (attempt < 8) {
        await page.waitForTimeout(1000);
      }
    }

    list.push(...results);

    if (list.length === 0) {
      console.log('⚠️ No homework found after retrying.');
      console.log('Page title:', await page.title());
      console.log('Current URL:', page.url());

      list.push({
        due: 'No Tasks Found',
        percent: 0
      });
    }

    console.log(`\n📋 Found ${list.length} homework item(s):`);
    console.log('-'.repeat(40));

    list.forEach(homework => {
      console.log(`🔹 ${homework.due} — ${homework.percent}%`);
    });

    console.log('-'.repeat(40) + '\n');

    return {
      list,

      runSolver: async (index, updateDiscord) => {
        const homework = list[index];

        if (!homework) {
          await updateDiscord('❌ Invalid homework selection.');
          return;
        }

        if (homework.due === 'No Tasks Found') {
          await updateDiscord(
            '❌ No homework was detected. Check the browser dashboard and logs.'
          );

          await browser?.close();
          return;
        }

        try {
          await solveSelectedHomework(
            page,
            homework,
            parseInt(minTime, 10),
            parseInt(maxTime, 10),
            updateDiscord,
            subject
          );
        } finally {
          await browser?.close();
        }
      }
    };
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.log('Check the browser window to see where it stopped.');

    await browser?.close().catch(() => {});
    throw err;
  }
}

module.exports = { loginAndGetHomeworks };
