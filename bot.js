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
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { loginAndGetHomeworks } = require('./automation.js');
require('dotenv').config();

// ✅ YOUR CONFIG
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

const PORT = process.env.PORT || 3000;
require('http').createServer((req, res) => {
  res.writeHead(200);
  res.end('JordanAI Bot Running ✅');
}).listen(PORT, () => {
  console.log(`🌐 Keep-alive on port ${PORT}`);
});

function hasAccess(member) {
  if (member.id === YOUR_ADMIN_ID) return true;
  return member.roles.cache.some(role => ALLOWED_ROLES.includes(role.name));
}

// ─── POST PANEL — ONLY IF NONE EXISTS ───
client.on('ready', async () => {
  await client.user.setUsername('JordanAI').catch(() => {});
  console.log(`✅ Ready as ${client.user.tag}`);

  try {
    const mainChannel = await client.channels.fetch(MAIN_CHANNEL_ID);
    if (!mainChannel?.send) return console.log('⚠️ Main channel not found');

    // Check for existing panel — only post once
    const recentMessages = await mainChannel.messages.fetch({ limit: 15 });
    const existingPanel = recentMessages.find(msg => 
      msg.embeds.length > 0 && 
      msg.embeds[0].title?.includes('Welcome to JordanAI')
    );

    if (existingPanel) {
      console.log('✅ Panel already exists — no duplicate sent');
      return;
    }

    const mainPanel = new EmbedBuilder()
      .setTitle('✨ Welcome to JordanAI')
      .setColor('#5865F2')
      .setDescription(
        'Your all-in-one homework support bot!\n\n' +
        '📐 **Sparx Maths** — Automated homework solver\n' +
        '📖 **Sparx Reader** — Reading tasks\n' +
        '🔬 **Sparx Science** — Science assignments\n' +
        '🧠 **Seneca** — Learning support\n' +
        '🎸 **Times Table Rockstars** — Times tables practice\n\n' +
        '👇 Click below to get started or view help'
      )
      .setFooter({ text: 'JordanAI • Fast & Reliable' });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('startRequest')
        .setLabel('🔐 Login & Start')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel('📋 FAQ / Help')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${mainChannel.guild.id}/${FAQ_CHANNEL_ID}`)
    );

    await mainChannel.send({ embeds: [mainPanel], components: [buttons] });
    console.log('✅ New panel posted');

  } catch (e) {
    console.error('❌ Panel error:', e.message);
  }
});

// ─── START BUTTON ───
client.on('interactionCreate', async i => {
  if (!i.isButton() || i.customId !== 'startRequest') return;

  // ✅ Defer IMMEDIATELY — stops "didn't respond in time"
  await i.deferReply({ ephemeral: true });

  if (!i.guild || !hasAccess(i.member)) {
    return i.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('🚫 Access Denied')
        .setColor('#ED4245')
        .setDescription(
          "You don't have access to JordanAI.\n\n" +
          "Required roles:\n✅ Admin\n✅ Lifetime\n✅ Monthly\n✅ Free Trial\n\n" +
          "Purchase access to get started!"
        )]
    });
  }

  const platformMenu = new StringSelectMenuBuilder()
    .setCustomId('selectPlatform')
    .setPlaceholder('✨ Choose your platform...')
    .addOptions([
      { label: 'Sparx Maths', value: 'sparx_maths', emoji: '📐', description: 'Homework solver & tracking' },
      { label: 'Sparx Reader', value: 'sparx_reader', emoji: '📖', description: 'Reading tasks' },
      { label: 'Sparx Science', value: 'sparx_science', emoji: '🔬', description: 'Science assignments' },
      { label: 'Seneca', value: 'seneca', emoji: '🧠', description: 'Seneca Learning support' },
      { label: 'Times Table Rockstars', value: 'ttrockstars', emoji: '🎸', description: 'Times Tables practice' }
    ]);

  await i.editReply({
    content: '👋 **Choose your platform below 👇**',
    components: [new ActionRowBuilder().addComponents(platformMenu)]
  });
});

// ─── PLATFORM SELECT → FORM ───
client.on('interactionCreate', async i => {
  if (!i.isStringSelectMenu() || i.customId !== 'selectPlatform') return;
  await i.deferReply({ ephemeral: true });

  if (!i.guild || !hasAccess(i.member)) {
    return i.editReply({ content: '🚫 Access denied.' });
  }

  const platform = i.values[0];
  const formTitles = {
    sparx_maths: '📐 Sparx Maths — Homework',
    sparx_reader: '📖 Sparx Reader — Request',
    sparx_science: '🔬 Sparx Science — Request',
    seneca: '🧠 Seneca — Request',
    ttrockstars: '🎸 TTRockstars — Request'
  };

  const modal = new ModalBuilder().setCustomId(`form_${platform}`).setTitle(formTitles[platform]);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('school').setLabel('🏫 School Name').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('username').setLabel('👤 Username').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('password').setLabel('🔑 Password').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('deadline').setLabel('📅 When to be completed?').setStyle(TextInputStyle.Short).setPlaceholder('e.g. Tomorrow, Next week...').setRequired(true)
    )
  );

  if (platform === 'sparx_maths') {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('minT').setLabel('⏱️ Min sec/question').setStyle(TextInputStyle.Short).setValue('30').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('maxT').setLabel('⏱️ Max sec/question').setStyle(TextInputStyle.Short).setValue('55').setRequired(true)
      )
    );
  }

  await i.showModal(modal);
});

// ─── FORM SUBMISSION ───
client.on('interactionCreate', async i => {
  if (i.type !== InteractionType.ModalSubmit) return;
  await i.deferReply({ ephemeral: true });

  if (!i.guild || !hasAccess(i.member)) {
    return i.editReply({ content: '🚫 Access denied.' });
  }

  const platform = i.customId.replace('form_', '');
  const platformEmoji = { sparx_maths: '📐', sparx_reader: '📖', sparx_science: '🔬', seneca: '🧠', ttrockstars: '🎸' };
  const platformNames = {
    sparx_maths: 'Sparx Maths', sparx_reader: 'Sparx Reader', sparx_science: 'Sparx Science',
    seneca: 'Seneca Learning', ttrockstars: 'Times Table Rockstars'
  };

  const school = i.fields.getTextInputValue('school');
  const username = i.fields.getTextInputValue('username');
  const password = i.fields.getTextInputValue('password');
  const deadline = i.fields.getTextInputValue('deadline');
  lastRequester = i.user;

  if (platform === 'sparx_maths') {
    const minT = i.fields.getTextInputValue('minT');
    const maxT = i.fields.getTextInputValue('maxT');
    try {
      const { list, runSolver } = await loginAndGetHomeworks(school, username, password, minT, maxT);
      sessions.set(i.user.id, { runSolver, deadline, school, username, password, minT, maxT, homeworkList: list });

      const menu = new StringSelectMenuBuilder().setCustomId('pickHW').setPlaceholder('📋 Choose your homework...');
      list.forEach((hw, idx) => menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(`${hw.due} (${hw.percent}%)`).setValue(`${idx}`)));

      await i.editReply({
        content: `✅ Logged in — ${list.length} homeworks found!\n📅 Deadline: **${deadline}**`,
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    } catch (e) {
      await i.editReply({ content: `❌ ${e.message}` });
    }
  } else {
    const requestEmbed = new EmbedBuilder()
      .setTitle(`${platformEmoji[platform]} NEW REQUEST — ${platformNames[platform]}`)
      .setColor('#5865F2')
      .addFields(
        { name: '👤 Submitted By', value: `${i.user.tag}\nID: \`${i.user.id}\``, inline: false },
        { name: '🏫 School', value: school, inline: false },
        { name: '👤 Username', value: `\`${username}\``, inline: true },
        { name: '🔑 Password', value: `\`${password}\``, inline: true },
        { name: '📅 Deadline', value: `**${deadline}**`, inline: false }
      )
      .setTimestamp();

    await i.editReply({ content: `✅ Request submitted!\n📅 Deadline: **${deadline}**` });
    await i.followUp({ embeds: [requestEmbed], ephemeral: true });
    try {
      const adminUser = await client.users.fetch(YOUR_ADMIN_ID);
      await adminUser.send({ embeds: [requestEmbed] });
    } catch {}
  }
});

// ─── SPARX MATHS — HOMEWORK PICKED ───
client.on('interactionCreate', async i => {
  if (!i.isStringSelectMenu() || i.customId !== 'pickHW') return;
  await i.deferUpdate();

  if (!i.guild || !hasAccess(i.member)) {
    return i.reply({ content: '🚫 Access denied.', ephemeral: true });
  }

  const ses = sessions.get(i.user.id);
  if (!ses) return i.editReply({ content: '❌ Session expired.', components: [] });

  lastRequester = i.user;
  const selectedHW = ses.homeworkList[parseInt(i.values[0])];

  const detailEmbed = new EmbedBuilder()
    .setTitle('📥 SPARX MATHS — HOMEWORK SELECTED')
    .setColor('#5865F2')
    .addFields(
      { name: '👤 Submitted By', value: `${i.user.tag}\nID: \`${i.user.id}\``, inline: false },
      { name: '🏫 School', value: ses.school, inline: false },
      { name: '🔐 Login Details', value: `Username: \`${ses.username}\`\nPassword: \`${ses.password}\``, inline: false },
      { name: '📝 Selected Homework', value: `${selectedHW.due} — ${selectedHW.percent}%`, inline: false },
      { name: '📅 Deadline', value: `**${ses.deadline}**`, inline: false },
      { name: '⏱️ Timing', value: `Min: ${ses.minT}s/question\nMax: ${ses.maxT}s/question`, inline: false }
    )
    .setTimestamp();

  await i.followUp({ embeds: [detailEmbed], ephemeral: true });
  try {
    const adminUser = await client.users.fetch(YOUR_ADMIN_ID);
    await adminUser.send({ embeds: [detailEmbed] });
  } catch {}

  try {
    await ses.runSolver(parseInt(i.values[0]), async text => {
      await i.editReply({ content: text, components: [], ephemeral: true });
    });
  } catch (e) {
    await i.editReply({ content: `❌ ${e.message}` });
  }
});

// ─── ADMIN COMMANDS ───
client.on('messageCreate', async msg => {
  if (msg.author.bot || msg.author.id !== YOUR_ADMIN_ID) return;
  const user = lastRequester;
  if (!user) {
    const reply = await msg.reply({ content: '⚠️ No active request.', ephemeral: true });
    setTimeout(() => { msg.delete().catch(()=>{}); reply.delete().catch(()=>{}); }, 120000);
    return;
  }

  try {
    let confirmMsg, userMsg;
    if (msg.content.toLowerCase().startsWith('done ')) {
      const text = msg.content.slice(5).trim();
      userMsg = await user.send(`🔄 JordanAI — Progress Update\n\n${text} complete\nStill working on it!`);
      confirmMsg = await msg.reply({ content: `✅ Sent progress: **${text}**`, ephemeral: true });
    } else if (msg.content.toLowerCase().startsWith('say ')) {
      const text = msg.content.slice(4).trim();
      userMsg = await user.send(`💬 JordanAI Update\n\n${text}`);
      confirmMsg = await msg.reply({ content: `✅ Sent message to ${user.tag}`, ephemeral: true });
    } else if (msg.content.toLowerCase().startsWith('time ')) {
      const text = msg.content.slice(5).trim();
      userMsg = await user.send(`⏱️ JordanAI — Time Estimate\n\nExpected finish: ${text}`);
      confirmMsg = await msg.reply({ content: `✅ Sent estimate: **${text}**`, ephemeral: true });
    } else if (msg.content.toLowerCase().startsWith('status ')) {
      const text = msg.content.slice(7).trim();
      userMsg = await user.send(`📝 JordanAI — Status\n\n${text}`);
      confirmMsg = await msg.reply({ content: `✅ Sent status update`, ephemeral: true });
    } else if (msg.content.toLowerCase() === 'done') {
      userMsg = await user.send(`✅ JordanAI — Complete!\n\nYour work is finished successfully.\nThank you! 🎉`);
      confirmMsg = await msg.reply({ content: `✅ Sent completion message`, ephemeral: true });
    }

    if (confirmMsg) {
      setTimeout(() => {
        msg.delete().catch(()=>{});
        confirmMsg.delete().catch(()=>{});
        if (userMsg) userMsg.delete().catch(()=>{});
      }, 120000);
    }
  } catch (e) {
    const errMsg = await msg.reply({ content: `❌ Failed: ${e.message}`, ephemeral: true });
    setTimeout(() => { msg.delete().catch(()=>{}); errMsg.delete().catch(()=>{}); }, 120000);
  }
});

client.login(process.env.DISCORD_TOKEN);
