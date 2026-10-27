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

// ✅ YOUR CONFIG — ALREADY FILLED
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
  return member.roles?.cache?.some(role => ALLOWED_ROLES.includes(role.name));
}

// ─── POST PANEL ONCE ONLY ───
client.on('ready', async () => {
  await client.user.setUsername('JordanAI').catch(() => {});
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const mainChannel = await client.channels.fetch(MAIN_CHANNEL_ID);
    if (!mainChannel?.send) return console.log('⚠️ Main channel not found');

    // Don't post duplicates
    const recent = await mainChannel.messages.fetch({ limit: 15 });
    if (recent.some(m => m.embeds[0]?.title?.includes('Welcome to JordanAI'))) {
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
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('startRequest').setLabel('🔐 Login & Start').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setLabel('📋 FAQ').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${mainChannel.guild.id}/${FAQ_CHANNEL_ID}`)
      )]
    });
    console.log('✅ Panel posted');
  } catch (e) { console.error('Panel error:', e.message); }
});

// ─── START BUTTON — DEFER FIRST THING ───
client.on('interactionCreate', async i => {
  if (!i.isButton() || i.customId !== 'startRequest') return;

  // ✅ DEFER IMMEDIATELY — FIRST LINE, NO WAITING
  await i.deferReply({ ephemeral: true });

  if (!i.guild || !hasAccess(i.member)) {
    return i.editReply({
      embeds: [new EmbedBuilder().setTitle('🚫 Access Denied').setColor('#ED4245')
        .setDescription('You need: Admin / Lifetime / Monthly / Free Trial\nPurchase access to use JordanAI.')]
    });
  }

  const menu = new StringSelectMenuBuilder().setCustomId('selectPlatform').setPlaceholder('Choose platform...')
    .addOptions(
      { label: 'Sparx Maths', value: 'sparx_maths', emoji: '📐' },
      { label: 'Sparx Reader', value: 'sparx_reader', emoji: '📖' },
      { label: 'Sparx Science', value: 'sparx_science', emoji: '🔬' },
      { label: 'Seneca', value: 'seneca', emoji: '🧠' },
      { label: 'Times Table Rockstars', value: 'ttrockstars', emoji: '🎸' }
    );

  await i.editReply({ content: '👋 Choose your platform:', components: [new ActionRowBuilder().addComponents(menu)] });
});

// ─── PLATFORM SELECT ───
client.on('interactionCreate', async i => {
  if (!i.isStringSelectMenu() || i.customId !== 'selectPlatform') return;
  await i.deferReply({ ephemeral: true }); // ✅ Always defer first

  if (!i.guild || !hasAccess(i.member)) return i.editReply('🚫 Access denied.');

  const platform = i.values[0];
  const titles = {
    sparx_maths: '📐 Sparx Maths', sparx_reader: '📖 Sparx Reader',
    sparx_science: '🔬 Sparx Science', seneca: '🧠 Seneca', ttrockstars: '🎸 TTRockstars'
  };

  const modal = new ModalBuilder().setCustomId(`form_${platform}`).setTitle(titles[platform]);
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('school').setLabel('🏫 School Name').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('👤 Username').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('password').setLabel('🔑 Password').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('deadline').setLabel('📅 When complete?').setStyle(TextInputStyle.Short).setPlaceholder('Tomorrow / Next week...').setRequired(true))
  );

  if (platform === 'sparx_maths') {
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('minT').setLabel('⏱️ Min sec/question').setStyle(TextInputStyle.Short).setValue('30').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('maxT').setLabel('⏱️ Max sec/question').setStyle(TextInputStyle.Short).setValue('55').setRequired(true))
    );
  }

  await i.showModal(modal);
});

// ─── FORM SUBMIT ───
client.on('interactionCreate', async i => {
  if (i.type !== InteractionType.ModalSubmit) return;
  await i.deferReply({ ephemeral: true }); // ✅ Defer immediately

  if (!i.guild || !hasAccess(i.member)) return i.editReply('🚫 Access denied.');

  const platform = i.customId.replace('form_', '');
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

      const hwMenu = new StringSelectMenuBuilder().setCustomId('pickHW').setPlaceholder('Choose homework...');
      list.forEach((hw, idx) => hwMenu.addOptions({ label: `${hw.due} (${hw.percent}%)`, value: `${idx}` }));

      await i.editReply({
        content: `✅ Found ${list.length} homeworks\n📅 Deadline: ${deadline}`,
        components: [new ActionRowBuilder().addComponents(hwMenu)]
      });
    } catch (e) {
      await i.editReply(`❌ ${e.message}`);
    }
  } else {
    const emb = new EmbedBuilder().setTitle(`✅ New Request — ${platform}`).setColor('#5865F2')
      .addFields(
        { name: 'User', value: `${i.user.tag}\n\`${i.user.id}\``, inline: false },
        { name: 'School', value: school, inline: false },
        { name: 'Username', value: `\`${username}\``, inline: true },
        { name: 'Password', value: `\`${password}\``, inline: true },
        { name: 'Deadline', value: deadline, inline: false }
      ).setTimestamp();

    await i.editReply(`✅ Submitted! Deadline: ${deadline}`);
    try { await (await client.users.fetch(YOUR_ADMIN_ID)).send({ embeds: [emb] }); } catch {}
  }
});

// ─── HOMEWORK PICKED ───
client.on('interactionCreate', async i => {
  if (!i.isStringSelectMenu() || i.customId !== 'pickHW') return;
  await i.deferReply({ ephemeral: true }); // ✅ Defer first

  if (!i.guild || !hasAccess(i.member)) return i.editReply('🚫 Access denied.');

  const ses = sessions.get(i.user.id);
  if (!ses) return i.editReply('❌ Session expired.');

  lastRequester = i.user;
  const hw = ses.homeworkList[parseInt(i.values[0])];

  const emb = new EmbedBuilder().setTitle('📥 Homework Selected').setColor('#5865F2')
    .addFields(
      { name: 'User', value: `${i.user.tag}\n\`${i.user.id}\``, inline: false },
      { name: 'School', value: ses.school, inline: false },
      { name: 'Login', value: `User: \`${ses.username}\`\nPass: \`${ses.password}\``, inline: false },
      { name: 'Homework', value: `${hw.due} — ${hw.percent}%`, inline: false },
      { name: 'Deadline', value: ses.deadline, inline: false },
      { name: 'Timing', value: `${ses.minT}–${ses.maxT}s/q`, inline: false }
    ).setTimestamp();

  await i.editReply({ embeds: [emb] });
  try { await (await client.users.fetch(YOUR_ADMIN_ID)).send({ embeds: [emb] }); } catch {}

  try {
    await ses.runSolver(parseInt(i.values[0]), async text => {
      await i.followUp({ content: text, ephemeral: true });
    });
  } catch (e) { console.error('Solver error:', e.message); }
});

// ─── ADMIN COMMANDS ───
client.on('messageCreate', async msg => {
  if (msg.author.bot || msg.author.id !== YOUR_ADMIN_ID) return;
  const user = lastRequester;
  if (!user) {
    const r = await msg.reply({ content: '⚠️ No active request.', ephemeral: true });
    return setTimeout(() => { msg.delete().catch(()=>{}); r.delete().catch(()=>{}); }, 120000);
  }

  let confirmMsg, userMsg;
  try {
    if (msg.content.toLowerCase().startsWith('done ')) {
      const t = msg.content.slice(5).trim();
      userMsg = await user.send(`🔄 Progress Update\n\n${t} complete`);
      confirmMsg = await msg.reply({ content: `✅ Sent: ${t}`, ephemeral: true });
    } else if (msg.content.toLowerCase().startsWith('say ')) {
      const t = msg.content.slice(4).trim();
      userMsg = await user.send(`💬 Message\n\n${t}`);
      confirmMsg = await msg.reply({ content: `✅ Sent`, ephemeral: true });
    } else if (msg.content.toLowerCase().startsWith('time ')) {
      const t = msg.content.slice(5).trim();
      userMsg = await user.send(`⏱️ Time Estimate\n\n${t}`);
      confirmMsg = await msg.reply({ content: `✅ Sent`, ephemeral: true });
    } else if (msg.content.toLowerCase().startsWith('status ')) {
      const t = msg.content.slice(7).trim();
      userMsg = await user.send(`📝 Status\n\n${t}`);
      confirmMsg = await msg.reply({ content: `✅ Sent`, ephemeral: true });
    } else if (msg.content.toLowerCase() === 'done') {
      userMsg = await user.send(`✅ Complete!\n\nAll finished. Thank you! 🎉`);
      confirmMsg = await msg.reply({ content: `✅ Sent completion`, ephemeral: true });
    }

    if (confirmMsg) {
      setTimeout(() => {
        msg.delete().catch(()=>{});
        confirmMsg.delete().catch(()=>{});
        if (userMsg) userMsg.delete().catch(()=>{});
      }, 120000);
    }
  } catch (e) {
    const err = await msg.reply({ content: `❌ Error: ${e.message}`, ephemeral: true });
    setTimeout(() => { msg.delete().catch(()=>{}); err.delete().catch(()=>{}); }, 120000);
  }
});

client.login(process.env.DISCORD_TOKEN);
