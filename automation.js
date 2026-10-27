const { chromium } = require('playwright');

async function loginAndGetHomeworks(school, username, password, minTime, maxTime) {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();

    try {
        console.log('🌐 Loading Sparx Maths...');
        await page.goto('https://app.sparxmaths.uk/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Step 1 — School
        await page.getByLabel(/School name/i).fill(school);
        await page.getByRole('button', { name: /Continue/i }).click();
        await page.waitForTimeout(2000);

        // Step 2 — Username & Password
        await page.getByLabel(/Username/i, { exact: false }).first().fill(username);
        await page.getByLabel(/Password/i, { exact: false }).first().fill(password);
        await page.getByRole('button', { name: /Log in/i }).click();
        await page.waitForTimeout(4000);

        // Skip tour/intro if it appears
        const skip = page.getByRole('button', { name: /Skip|Close|Got it|Dismiss/i });
        if (await skip.isVisible({ timeout: 3000 })) await skip.click();
        await page.waitForTimeout(2000);

        // Go to Homework tab
        await page.getByRole('link', { name: /Homework/i }).click();
        await page.waitForTimeout(4000);

        // Fetch homework list
        const items = await page.locator('[class*="Package_"]').filter({ hasText: /%/ }).all();
        const list = [];

        for (const item of items) {
            const text = await item.innerText();
            const dueMatch = text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d+(?:st|nd|rd|th)?\s+\w+/i);
            const pctMatch = text.match(/(\d+)%/);
            if (dueMatch) {
                list.push({
                    due: `Homework due ${dueMatch[0]}`,
                    percent: pctMatch ? pctMatch[1] : '0'
                });
            }
        }

        if (!list.length) throw new Error('No homework found — check login details');
        console.log(`✅ Found ${list.length} homework(s)`);

        // Pass to solver
        const runSolver = async (index, updateDiscord) => {
            const { solveSelectedHomework } = require('./solver.js');
            await solveSelectedHomework(page, list[index], minTime, maxTime, updateDiscord);
            await browser.close();
        };

        return { list, runSolver };

    } catch (err) {
        await browser.close();
        throw err;
    }
}

module.exports = { loginAndGetHomeworks };
