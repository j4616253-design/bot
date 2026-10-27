const {
  Client,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  InteractionType,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { loginAndGetHomeworks } = require('./automation.js');
require('dotenv').config();

const YOUR_ADMIN_ID = '1433073407075024981';
const MAIN_CHANNEL_ID = '1529910322184454296';
const FAQ_CHANNEL_ID = '1517285523042078730';

const ALLOWED_ROLES = ['Admin', 'Lifetime', 'Monthly', 'Free Trial'];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

const sessions = new Map();
let lastRequester = null;

// Keep-alive for Render
const PORT = process.env.PORT || 3000;

require('http').createServer((req, res) => {
  res.writeHead(200);
  res.end('JordanAI Running ✅');
}).listen(PORT, () => console.log(`🌐 Port ${PORT}`));

function hasAccess(member) {
  if (member.id === YOUR_ADMIN_ID) return true;
  return member.roles?.cache?.some(role =>
    ALLOWED_ROLES.includes(role.name)
  );
}

// ─── POST PANEL ONCE ONLY ───
client.on('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const mainChannel = await client.channels.fetch(MAIN_CHANNEL_ID);

    if (!mainChannel?.send) {
      return console.log('⚠️ Main channel not found');
    }

    const recent = await mainChannel.messages.fetch({ limit: 15 });

    if (recent.some(m =>
      m.embeds[0]?.title?.includes('Welcome to JordanAI')
    )) {
      return console.log('✅ Panel already exists — skipping');
    }

    const panel = new EmbedBuilder()
      .setTitle('✨ Welcome to JordanAI')
      .setColor('#5865F2')
      .setDescription(
        'Your all-in-one homework support bot!\n\n' +
        '📐 Sparx Maths • 📖 Sparx Reader • 🔬 Sparx Science\n' +
        '🧠 Seneca • 🎸 Times Table Rockstars\n\n' +
        '👇 Click below to get started'
      )
      .setFooter({ text: 'JordanAI' });

    await mainChannel.send({
      embeds: [panel],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('startRequest')
            .setLabel('🔐 Login & Start')
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setLabel('📋 FAQ')
            .setStyle(ButtonStyle.Link)
            .setURL(
              `https://discord.com/channels/${mainChannel.guild.id}/${FAQ_CHANNEL_ID}`
            )
        )
      ]
    });

    console.log('✅ Panel posted');
  } catch (e) {
    console.error('Panel error:', e.message);
  }
});

// ─── START BUTTON ───
client.on('interactionCreate', async i => {
  if (!i.isButton() || i.customId !== 'startRequest') return;

  await i.deferReply({ ephemeral: true });

  if (!i.guild || !hasAccess(i.member)) {
    return i.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🚫 Access Denied')
          .setColor('#ED4245')
          .setDescription(
            'You need: Admin / Lifetime / Monthly / Free Trial\n' +
            'Purchase access to use JordanAI.'
          )
      ]
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId('selectPlatform')
    .setPlaceholder('Choose platform...')
    .addOptions(
      { label: 'Sparx Maths', value: 'sparx_maths', emoji: '📐' },
      { label: 'Sparx Reader', value: 'sparx_reader', emoji: '📖' },
      { label: 'Sparx Science', value: 'sparx_science', emoji: '🔬' },
      { label: 'Seneca', value: 'seneca', emoji: '🧠' },
      { label: 'Times Table Rockstars', value: 'ttrockstars', emoji: '🎸' }
    );

  await i.editReply({
    content: '👋 Choose your platform:',
    components: [
      new ActionRowBuilder().addComponents(menu)
    ]
  });
});

// ─── PLATFORM SELECT ───
client.on('interactionCreate', async i => {
  if (!i.isStringSelectMenu() || i.customId !== 'selectPlatform') return;

  // Show the modal as the initial response to this interaction.
  if (!i.guild || !hasAccess(i.member)) {
    return i.reply({
      content: '🚫 Access denied.',
      ephemeral: true
    });
  }

  const platform = i.values[0];

  const titles = {
    sparx_maths: '📐 Sparx Maths',
    sparx_reader: '📖 Sparx Reader',
    sparx_science: '🔬 Sparx Science',
    seneca: '🧠 Seneca',
    ttrockstars: '🎸 TTRockstars'
  };

  const modal = new ModalBuilder()
    .setCustomId(`form_${platform}`)
    .setTitle(titles[platform]);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('school')
        .setLabel('🏫 School Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('username')
        .setLabel('👤 Username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('password')
        .setLabel('🔑 Password')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('deadline')
        .setLabel('📅 When complete?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Tomorrow / Next week...')
        .setRequired(true)
    )
  );

  if (platform === 'sparx_maths') {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('timingRange')
          .setLabel('⏱️ Seconds per question (min-max)')
          .setStyle(TextInputStyle.Short)
          .setValue('30-55')
          .setPlaceholder('30-55')
          .setRequired(true)
      )
    );
  }

  await i.showModal(modal);
});// ─── FORM SUBMIT ───
client.on('interactionCreate', async i => {
  if (i.type !== InteractionType.ModalSubmit) return;
  if (!i.customId.startsWith('form_')) return;

  await i.deferReply({ ephemeral: true });

  if (!i.guild || !hasAccess(i.member)) {
    return i.editReply('🚫 Access denied.');
  }

  const platform = i.customId.replace('form_', '');
  const school = i.fields.getTextInputValue('school');
  const username = i.fields.getTextInputValue('username');
  const password = i.fields.getTextInputValue('password');
  const deadline = i.fields.getTextInputValue('deadline');

  lastRequester = i.user;

  if (platform === 'sparx_maths') {
    const timingRange = i.fields.getTextInputValue('timingRange').trim();
    const timingMatch = timingRange.match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);

    if (!timingMatch) {
      return i.editReply(
        '❌ Enter timing as min-max, for example 30-55.'
      );
    }

    const minT = Number(timingMatch[1]);
    const maxT = Number(timingMatch[2]);

    if (minT < 1 || maxT < minT || maxT > 600) {
      return i.editReply(
        '❌ Timing must be between 1 and 600 seconds, with max ≥ min.'
      );
    }

    try {
      const result = await loginAndGetHomeworks(
        school, username, password, minT, maxT
      );

      const list = Array.isArray(result?.list) ? result.list : [];
      const runSolver = result?.runSolver;

      sessions.set(i.user.id, {
        runSolver,
        deadline,
        school,
        username,
        password,
        minT,
        maxT,
        homeworkList: list
      });

      if (list.length === 0) {
        return i.editReply(
          `ℹ️ No homework was found.\n📅 Deadline: ${deadline}`
        );
      }

      const hwMenu = new StringSelectMenuBuilder()
        .setCustomId('pickHW')
        .setPlaceholder('Choose homework...');

      list.slice(0, 25).forEach((hw, idx) => {
        const due = String(hw?.due ?? `Homework ${idx + 1}`);
        const percent = String(hw?.percent ?? '?');

        hwMenu.addOptions({
          label: `${due} (${percent}%)`.slice(0, 100),
          value: String(idx)
        });
      });

      await i.editReply({
        content:
          `✅ Found ${list.length} homework item(s)` +
          `${list.length > 25 ? ' (showing the first 25)' : ''}\n` +
          `📅 Deadline: ${deadline}`,
        components: [
          new ActionRowBuilder().addComponents(hwMenu)
        ]
      });
    } catch (e) {
      console.error('Homework login error:', e);
      await i.editReply(
        '❌ Could not log in or retrieve homework. Check the credentials and try again.'
      );
    }
  } else {
    const emb = new EmbedBuilder()
      .setTitle(`✅ New Request — ${platform}`)
      .setColor('#5865F2')
      .addFields(
        {
          name: 'User',
          value: `${i.user.tag}\n\`${i.user.id}\``
        },
        {
          name: 'School',
          value: school
        },
        {
          name: 'Username',
          value: username
        },
        {
          name: 'Deadline',
          value: deadline
        }
      )
      .setTimestamp();

    await i.editReply(`✅ Submitted! Deadline: ${deadline}`);

    try {
      await (await client.users.fetch(YOUR_ADMIN_ID))
        .send({ embeds: [emb] });
    } catch (e) {
      console.error('Could not notify admin:', e.message);
    }
  }
});

// ─── HOMEWORK PICKED ───
client.on('interactionCreate', async i => {
  if (!i.isStringSelectMenu() || i.customId !== 'pickHW') return;

  await i.deferReply({ ephemeral: true });

  if (!i.guild || !hasAccess(i.member)) {
    return i.editReply('🚫 Access denied.');
  }

  const ses = sessions.get(i.user.id);

  if (!ses) {
    return i.editReply('❌ Session expired. Please start again.');
  }

  const selectedIndex = Number.parseInt(i.values[0], 10);
  const hw = ses.homeworkList[selectedIndex];

  if (!Number.isInteger(selectedIndex) || !hw) {
    return i.editReply(
      '❌ Invalid homework selection. Please start again.'
    );
  }

  if (typeof ses.runSolver !== 'function') {
    return i.editReply(
      '❌ Solver session unavailable. Please start again.'
    );
  }

  lastRequester = i.user;

  const emb = new EmbedBuilder()
    .setTitle('📥 Homework Selected')
    .setColor('#5865F2')
    .addFields(
      {
        name: 'User',
        value: `${i.user.tag}\n\`${i.user.id}\``
      },
      {
        name: 'School',
        value: ses.school
      },
      {
        name: 'Username',
        value: ses.username
      },
      {
        name: 'Homework',
        value: `${hw.due} — ${hw.percent}%`
      },
      {
        name: 'Deadline',
        value: ses.deadline
      },
      {
        name: 'Timing',
        value: `${ses.minT}–${ses.maxT}s/q`
      }
    )
    .setTimestamp();

  await i.editReply({
    content: '✅ Homework selected. Starting solver...',
    embeds: [emb]
  });

  try {
    await (await client.users.fetch(YOUR_ADMIN_ID))
      .send({ embeds: [emb] });
  } catch (e) {
    console.error('Could not notify admin:', e.message);
  }

  try {
    await ses.runSolver(selectedIndex, async text => {
      await i.followUp({
        content: String(text).slice(0, 2000),
        ephemeral: true
      });
    });
  } catch (e) {
    console.error('Solver error:', e);
    await i.followUp({
      content: '❌ The solver encountered an error.',
      ephemeral: true
    }).catch(() => {});
  }
});

// ─── ADMIN COMMANDS ───
// Use: done, done 5 questions, say message,
//      time estimate, status message
client.on('messageCreate', async msg => {
  if (msg.author.bot || msg.author.id !== YOUR_ADMIN_ID) return;

  const content = msg.content.trim();
  const lower = content.toLowerCase();

  if (!/^(done|say|time|status)(\s|$)/i.test(content)) return;

  const user = lastRequester;

  if (!user) {
    const reply = await msg.reply('⚠️ No active request.');

    setTimeout(() => {
      msg.delete().catch(() => {});
      reply.delete().catch(() => {});
    }, 120000);

    return;
  }

  let message;

  if (lower === 'done') {
    message = '✅ Complete!\n\nAll finished. Thank you! 🎉';
  } else if (lower.startsWith('done ')) {
    message = `🔄 Progress Update\n\n${content.slice(5).trim()} complete`;
  } else if (lower.startsWith('say ')) {
    message = `💬 Message\n\n${content.slice(4).trim()}`;
  } else if (lower.startsWith('time ')) {
    message = `⏱️ Time Estimate\n\n${content.slice(5).trim()}`;
  } else if (lower.startsWith('status ')) {
    message = `📝 Status\n\n${content.slice(7).trim()}`;
  }

  if (!message || message.endsWith('\n\n')) return;

  try {
    await user.send(message);
    const reply = await msg.reply('✅ Message sent.');

    setTimeout(() => {
      msg.delete().catch(() => {});
      reply.delete().catch(() => {});
    }, 120000);
  } catch (e) {
    const reply = await msg.reply(
      '❌ Could not message the requester. They may have DMs disabled.'
    );

    setTimeout(() => {
      msg.delete().catch(() => {});
      reply.delete().catch(() => {});
    }, 120000);
  }
});

// ─── LOGIN ───
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Missing DISCORD_TOKEN in your .env file.');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Discord login failed:', err.message);
  process.exit(1);
});
