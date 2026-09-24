const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function getHumanTime(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function installTimingPatcher(page) {
    await page.addInitScript(() => {
        const origFetch = window.fetch;
        window.fetch = async function (...args) {
            const [url, opt] = args;
            const u = typeof url === 'string' ? url : url.url;

            if (/\/interaction/.test(u) && opt?.body) {
                try {
                    const j = JSON.parse(opt.body);
                    j.metrics?.forEach(m => { if (m.labels?.duration) m.labels.duration = window.__FAKE_DUR__ ?? "35"; });
                    opt.body = JSON.stringify(j);
                } catch {}
            }

            if (/ActivityAction/.test(u) && opt?.body) {
                try {
                    function rv(b,i){let s=0n,r=0n;while(true){const x=b[i++];r|=BigInt(x&0x7f)<<s;if(!(x&0x80))break;s+=7n;}return[r,i];}
                    function wv(n){const o=[];let v=BigInt(n);do{let b=Number(v&0x7fn);v>>=7n;if(v>0n)b|=0x80;o.push(b);}while(v>0n);return o;}
                    let b=Array.from(new Uint8Array(opt.body)),p=5;
                    while(p<b.length){const t=b[p],f=t>>3,w=t&7;p++;if(w===2){const[l,n]=rv(b,p);p=n;if(f===2){let q=p;while(q<p+Number(l)){const t2=b[q],f2=t2>>3,w2=t2&7;q++;if(w2===0){const vs=q;let[,nq]=rv(b,q);if(f2===1){const nb=wv(Math.floor(Date.now()/1000));for(let k=0;k<nb.length;k++)b[vs+k]=nb[k];}q=nq;}else q=p+Number(l);}}p=p+Number(l);}else break;}
                    opt.body=new Uint8Array(b);
                } catch {}
            }
            return origFetch.apply(this, args);
        };
    });
}

async function solveSelectedHomework(page, homeworkItem, minTime, maxTime, updateDiscord) {
    console.log(`\n📋 Homework loaded: ${homeworkItem.due}`);
    console.log(`⏱️ Timing set: ${minTime}–${maxTime}s/question`);
    console.log(`ℹ️ Auto-solving disabled — use admin commands to message user`);

    // Open homework card
    const hwCard = page.locator('[class*="Package_"]').filter({ hasText: homeworkItem.due }).first();
    await hwCard.waitFor({ state: 'visible' });
    await hwCard.scrollIntoViewIfNeeded();
    await hwCard.click({ force: true });
    await page.waitForTimeout(3000);

    // List tasks in console ONLY — no messages sent to user
    const taskLinks = page.locator('a[class*="_Task_1p2y5_"]');
    const total = await taskLinks.count();
    console.log(`📝 Tasks found: ${total}`);

    for (let i = 0; i < total; i++) {
        const name = await taskLinks.nth(i).locator('[class*="_TaskTitle_"]').innerText().catch(() => `Task ${i+1}`);
        console.log(`- Task ${i+1}: ${name.trim()}`);
    }

    // Auto-solving stops here — YOU control everything via commands
    console.log(`✅ Ready — use commands in channel to update the user`);
}

module.exports = { solveSelectedHomework };