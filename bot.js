const {
  Client,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  InteractionType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder
} = require('discord.js');

const { loginAndGetHomeworks } = require('./automation.js');
require('dotenv').config();

// === CONFIGURATION ===
const YOUR_ADMIN_ID = '1433073407075024981';
const ALLOWED_ROLES = ['Monthly', 'Free Trial', 'Lifetime', 'Admin'];
// =====================

const token = process.env.DISCORD_TOKEN || process.env.DISCORD__TOKEN;
if (!token) {
  console.error('❌ CRITICAL ERROR: No Discord token found in your .env file!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: ['CHANNEL']
});

const sessions = new Map();
let lastRequester = null;

client.on('ready', async () => {
  await client.user.setUsername('JordanAI').catch(() => {});
  console.log(`✅ Ready as ${client.user.tag}`);
});

// 1. PHASE ONE: User triggers launcher → Send Subject Selection Dropdown
client.on('interactionCreate', async i => {
  if (!i.isButton()) return;
  if (i.customId === 'triggerHomeworkForm') {
    if (!i.guild) {
      return i.reply({
        content: '❌ This bot can only be used inside the official server.',
        ephemeral: true
      });
    }

    const member = i.member;
    const hasRole = member.roles.cache.some(role =>
      ALLOWED_ROLES.includes(role.name) || ALLOWED_ROLES.includes(role.id)
    );

    if (!hasRole) {
      return i.reply({
        content: '❌ Access Denied. You must have an active subscription to use JordanAI.',
        ephemeral: true
      });
    }

    const subjectMenu = new StringSelectMenuBuilder()
      .setCustomId('selectSubjectPlatform')
      .setPlaceholder('Select the Sparx platform subject:')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Sparx Maths ➗')
          .setDescription('Automated scraping & processing engine')
          .setValue('maths'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Sparx Reader 📚')
          .setDescription('Custom tracking for specific book reading sets')
          .setValue('reader'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Sparx Science 🧪')
          .setDescription('Custom automated tracking for science sets')
          .setValue('science')
      );

    const menuRow = new ActionRowBuilder().addComponents(subjectMenu);
    await i.reply({
      content: '⚙️ **JordanAI Platform Launcher**\nPlease select your current assignment subject from the dropdown menu below:',
      components: [menuRow],
      ephemeral: true
    });
  }
});

// 2. PHASE TWO: User picks Subject → Show Modal Form
client.on('interactionCreate', async i => {
  if (!i.isStringSelectMenu() || i.customId !== 'selectSubjectPlatform') return;
  const chosenSubject = i.values[0];

  const modal = new ModalBuilder()
    .setCustomId(`hwForm_${chosenSubject}`)
    .setTitle(`JordanAI — Sparx ${chosenSubject.toUpperCase()}`);

  const schoolInput = new TextInputBuilder()
    .setCustomId('school')
    .setLabel('School Name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const userInput = new TextInputBuilder()
    .setCustomId('user')
    .setLabel('Username')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const passInput = new TextInputBuilder()
    .setCustomId('pass')
    .setLabel('Password')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const timingOrDateInput = new TextInputBuilder()
    .setCustomId('timingOrDate')
    .setRequired(true);

  if (chosenSubject === 'maths') {
    timingOrDateInput
      .setLabel('Min-Max Sec/Question delays')
      .setStyle(TextInputStyle.Short)
      .setValue('30-55');
  } else {
    timingOrDateInput
      .setLabel('Homework Date / Selection Label')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Example: Last week homework, 24th Oct, etc.');
  }

  const row1 = new ActionRowBuilder().addComponents(schoolInput);
  const row2 = new ActionRowBuilder().addComponents(userInput);
  const row3 = new ActionRowBuilder().addComponents(passInput);
  const row4 = new ActionRowBuilder().addComponents(timingOrDateInput);
  modal.addComponents(row1, row2, row3, row4);
  await i.showModal(modal);
});

// 3. PHASE THREE: Process Modal Submission
client.on('interactionCreate', async i => {
  if (i.type !== InteractionType.ModalSubmit || !i.customId.startsWith('hwForm_')) return;

  const subject = i.customId.replace('hwForm_', '');
  const school = i.fields.getTextInputValue('school');
  const username = i.fields.getTextInputValue('user');
  const password = i.fields.getTextInputValue('pass');
  const inputVal = i.fields.getTextInputValue('timingOrDate');

  let minT = '30', maxT = '55', customDate = '';
  if (subject === 'maths') {
    const parts = inputVal.includes('-') ? inputVal.split('-') : ['30', '55'];
    minT = parts[0];
    maxT = parts[1];
  } else {
    customDate = inputVal.trim();
  }

  // ✅ INSTANT PATH FOR READER / SCIENCE
  if (subject !== 'maths') {
    await i.reply({
      content: `🚀 **Task Initialized Successfully**\nYour request for **Sparx ${subject.toUpperCase()}** (${customDate}) has been queued. Direct messaging channels will remain active to stream execution progress updates.`,
      ephemeral: true
    });

    lastRequester = i.user;

    // Log to Admin
    try {
      const adminUser = await client.users.fetch(YOUR_ADMIN_ID);
      await adminUser.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('📥 NEW MULTI-SUBJECT REQUEST — RECEIVED')
            .setColor('#5865F2')
            .addFields(
              { name: '👤 Submitted By', value: `${i.user.tag}\nID: \`${i.user.id}\``, inline: false },
              { name: '📚 Platform Subject', value: subject.toUpperCase(), inline: false },
              { name: '🏫 School', value: school, inline: false },
              { name: '🔐 Login Details', value: `Username: \`${username}\`\nPassword: \`${password}\``, inline: false },
              { name: '⏱️ Timing Settings', value: `Custom Label/Date: \`${customDate}\``, inline: false }
            )
            .setTimestamp()
        ]
      });
    } catch (dmErr) {
      console.log('\n⚠️ Could not DM admin.');
    }

    // Run in background
    (async () => {
      try {
        const updateMsg = async text => {
          await i.user.send(`🤖 Automation Status: ${text}`).catch(() => {});
        };
        const { runSolver } = await loginAndGetHomeworks(
          school, username, password, subject, minT, maxT, customDate
        );
        await runSolver(0, updateMsg);
      } catch (e) {
        console.error('Reader/Science worker loop catch:', e.message);
      }
    })();
    return;
  }

  // 🚨 MATHS ONLY PATH
  await i.deferReply({ ephemeral: true });
  await i.editReply({
    content: '⏳ Connecting to Sparx platform and launching browser... This may take a moment.'
  });

  (async () => {
    try {
      const { list, runSolver } = await loginAndGetHomeworks(
        school, username, password, subject, minT, maxT, customDate
      );

      sessions.set(i.user.id, {
        runSolver,
        school,
        username,
        password,
        subject,
        minT,
        maxT,
        customDate,
        homeworkList: list
      });

      if (!list || list.length === 0) {
        return await i.followUp({
          content: `⚠️ No tasks found on your Sparx ${subject.toUpperCase()} dashboard.`,
          ephemeral: true
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('pickHW')
        .setPlaceholder(`Choose ${subject} task to complete:`);

      list.forEach((hw, idx) => {
        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${hw.due} (${hw.percent}%)`)
            .setValue(`${idx}`)
        );
      });

      const selectionRow = new ActionRowBuilder().addComponents(menu);
      await i.followUp({
        content: `✅ Logged into Sparx ${subject.toUpperCase()}! — **${list.length}** tasks found. Pick one below:`,
        components: [selectionRow],
        ephemeral: true
      });
    } catch (e) {
      await i.followUp({
        content: `❌ Initialization failed: ${e.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  })();
});

// 4. PHASE FOUR: User Selects Homework (Maths Only)
client.on('interactionCreate', async i => {
  if (!i.isStringSelectMenu() || i.customId !== 'pickHW') return;
  await i.deferUpdate();

  const ses = sessions.get(i.user.id);
  if (!ses) {
    return i.editReply({
      content: '❌ Session expired — run again.',
      components: []
    });
  }

  lastRequester = i.user;
  const selectedIndex = parseInt(i.values[0]);
  const selectedHW = ses.homeworkList[selectedIndex];
  ses.selectedHW = selectedHW;

  // Log to Admin
  try {
    const adminUser = await client.users.fetch(YOUR_ADMIN_ID);
    await adminUser.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('📥 NEW MULTI-SUBJECT REQUEST — RECEIVED')
          .setColor('#5865F2')
          .addFields(
            { name: '👤 Submitted By', value: `${i.user.tag}\nID: \`${i.user.id}\``, inline: false },
            { name: '📚 Platform Subject', value: ses.subject.toUpperCase(), inline: false },
            { name: '🏫 School', value: ses.school, inline: false },
            { name: '🔐 Login Details', value: `Username: \`${ses.username}\`\nPassword: \`${ses.password}\``, inline: false },
            { name: '📝 Selected Task', value: `${selectedHW.due} — ${selectedHW.percent}%`, inline: false },
            { name: '⏱️ Timing Settings', value: `Min: ${ses.minT}s\nMax: ${ses.maxT}s`, inline: false }
          )
          .setTimestamp()
      ]
    });
  } catch (dmErr) {
    console.log('\n⚠️ Could not DM admin.');
  }

  // Start Execution
  try {
    const updateMsg = async text => {
      await i.user.send(`🤖 Automation Status: ${text}`).catch(() => {});
    };
    await i.editReply({
      content: `🚀 Starting execution for **${selectedHW.due}**. I will DM you with progress!`,
      components: []
    });
    await ses.runSolver(selectedIndex, updateMsg);
    sessions.delete(i.user.id);
  } catch (e) {
    console.error('Maths solving catch trigger:', e.message);
    await i.user.send('❌ Execution error handled: Manual intervention required or task state shifted.').catch(() => {});
  }
});

// 5. Admin Management Commands via DMs
client.on('messageCreate', async msg => {
  if (msg.author.bot || msg.author.id !== YOUR_ADMIN_ID) return;

  const user = lastRequester;
  if (!user) {
    return msg.reply({
      content: '⚠️ No active request — user needs to pick homework first.'
    });
  }

  try {
    const lowerMsg = msg.content.toLowerCase();

    if (lowerMsg === 'start') {
      const ses = sessions.get(user.id);
      const taskInfo = (ses && ses.selectedHW)
        ? `\n🎯 Working on: **${ses.selectedHW.due}**`
        : '';
      const speedInfo = ses
        ? (ses.subject === 'maths'
            ? `Using human-like delays (${ses.minT}s–${ses.maxT}s per problem).`
            : `Processing user date: "${ses.customDate}"`)
        : 'Processing tasks now.';

      await user.send([
        '**🔄 JordanAI — Task Started**',
        '',
        '⏳ I have successfully connected to your Sparx account.',
        taskInfo,
        `⚡ Your homework execution has officially begun!`,
        `⚙️ Flow rate: ${speedInfo}`,
        '💬 I will message you here with updates as sections complete!'
      ].join('\n'));

      return msg.reply({ content: `✅ Sent starting notification to ${user.tag}` });
    }

    if (lowerMsg.startsWith('done ')) {
      const text = msg.content.slice(5).trim();
      await user.send([
        '🔄 **JordanAI — Progress Update**',
        `📈 **${text}** complete`,
        '⏳ Still working on your homework — I’ll keep you posted!'
      ].join('\n'));

      return msg.reply({ content: `✅ Sent progress: **${text}** to ${user.tag}` });
    }

    if (lowerMsg.startsWith('say ')) {
      const text = msg.content.slice(4).trim();
      await user.send(`💬 **JordanAI Update**\n${text}`);
      return msg.reply({ content: `✅ Sent message to ${user.tag}` });
    }

    // ✅ NEW: COMPLETE COMMAND — Professional completion message
    if (lowerMsg === 'complete') {
      await user.send([
        '✅ **Task Completed Successfully**',
        '',
        'Your homework has been fully completed and submitted.',
        'All answers have been processed and verified.',
        '',
        '🙏 **Thank you for using JordanAI today!**',
        'If you enjoyed our service, please consider leaving a review — your support helps us grow and serve you better.',
        '',
        'We look forward to assisting you again soon! 💙'
      ].join('\n'));

      return msg.reply({ content: `✅ Sent completion message to ${user.tag}` });
    }

  } catch (err) {
    console.error('Error handling admin command:', err);
  }
});

client.login(token);