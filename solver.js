async function solveSelectedHomework(page, homeworkItem, minTime, maxTime, updateDiscord) {
    console.log(`\n📋 Homework loaded: ${homeworkItem.due}`);
    console.log(`⏱️ Timing set: ${minTime}–${maxTime}s/question`);
    console.log(`ℹ️ Auto-solving disabled — use admin commands`);

    // Open the selected homework card
    const hwCard = page.locator('[class*="Package_"]').filter({ hasText: homeworkItem.due }).first();
    await hwCard.waitFor({ state: 'visible' });
    await hwCard.scrollIntoViewIfNeeded();
    await hwCard.click({ force: true });
    await page.waitForTimeout(3000);

    // List tasks in console only
    const taskLinks = page.locator('a[class*="_Task_1p2y5_"]');
    const total = await taskLinks.count();
    console.log(`📝 Tasks found: ${total}`);

    for (let i = 0; i < total; i++) {
        const name = await taskLinks.nth(i).locator('[class*="_TaskTitle_"]').innerText().catch(() => `Task ${i+1}`);
        console.log(`- Task ${i+1}: ${name.trim()}`);
    }

    console.log(`✅ Ready — use commands in channel to update user`);
}

module.exports = { solveSelectedHomework };
