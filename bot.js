const {
  Client,
  GatewayIntentBits,
  Partials,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionType
} = require('discord.js');

require('dotenv').config();

const YOUR_ADMIN_ID = '1433073407075024981';
const MAIN_CHANNEL_ID = '1529910322184454296';
const FAQ_CHANNEL_ID = '1517285523042078730';

const ALLOWED_ROLES = ['Admin', 'Lifetime', 'Monthly', 'Free Trial'];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const requests = new Map();
const pendingPlatforms = new Map();
let lastRequesterId = null;

// ─══════════════════════════════════════════─
// 🎨 GREEN TEXT PROGRESS BAR — SIMPLE & CLEAN
// ─══════════════════════════════════════════─
const BAR_CONFIG = {
  filled: '🟩',      // Green box = completed
  empty: '⬜',       // White box = remaining
  length: 10,        // How many boxes wide
  showPercent: true
};

function makeBar(percent) {
  const filled = Math.round((percent / 100) * BAR_CONFIG.length);
  const empty = BAR_CONFIG.length - filled;
  
  let bar = BAR_CONFIG.filled.repeat(filled) + BAR_CONFIG.empty.repeat(empty);
  if (BAR_CONFIG.showPercent) bar += `  **${percent}%**`;
  return bar;
}

function makeTaskBreakdown(percent) {
  const tasks = ['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5', 'Task 6', 'Flashcards'];
  const done = Math.round((percent / 100) * tasks.length);
  return tasks.map((task, i) =>
    percent === 100 ? `✅ ${task}` : (i < done ? `🟩 ${task}` : `⬜ ${task}`)
  ).join('\n');
}

function progressEmbed(request, percent) {
  return new EmbedBuilder()
    .setTitle(percent === 100 ? '✅ Request Complete!' : '📊 Progress Update')
    .setColor(percent === 100 ? '#57F287' : '#5865F2')
    .setDescription(
      `**Platform:** ${request.platform}\n` +
      `**Homework Due Date:** ${request.dueDate}\n\n` +
      `${makeBar(percent)}\n\n` +
      `**Task Breakdown**\n${makeTaskBreakdown(percent)}\n\n` +
      '_Progress is manually updated._'
    )
    .setFooter({ text: 'JordanAI' })
    .setTimestamp();
}

// ─── REST OF BOT ───

function hasAccess(member) {
  if (!member) return false;
  if (member.id === YOUR_ADMIN_ID) return true;
  return member?.roles?.cache?.some(role => ALLOWED_ROLES.includes(role.name)) ?? false;
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    const channel = await client.channels.fetch(MAIN_CHANNEL_ID);
    if (!channel?.isTextBased() || !channel.guild) return console.log('⚠️ Channel not found');
    
    const recent = await channel.messages.fetch({ limit: 20 });
    const exists = recent.some(msg => 
      msg.author.id === client.user.id && msg.embeds[0]?.title === '✨ Welcome to JordanAI'
    );
    if (exists) return console.log('ℹ️ Panel exists');

    const panel = new EmbedBuilder()
      .setTitle('✨ Welcome to JordanAI')
      .setColor('#5865F2')
      .setDescription(
        `**Your gateway to personalised AI tutoring assistance.**\n` +
        `**Our verified helpers are available to support you.**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📚 **Platforms**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📐 Sparx Maths    📖 Sparx Reader\n` +
        `🔬 Sparx Science  🧠 Seneca\n` +
        `🎓 Educake        📊 Century Tech\n` +
        `🧪 Tassomai       🪨 Bedrock\n` +
        `🔬 Dr Frost       🎸 Times Table Rockstars\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ Enable DMs in Privacy & Safety to receive updates!\n` +
        `Press below to get started 🚀`
      )
      .setFooter({ text: 'JordanAI' });

    await channel.send({
      embeds: [panel],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('startRequest').setLabel('📩 Submit Request').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setLabel('📋 FAQ').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${channel.guild.id}/${FAQ_CHANNEL_ID}`)
        )
      ]
    });
    console.log('✅ Panel posted');
  } catch (e) { console.error('❌ Panel error:', e); }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isButton() && interaction.customId === 'startRequest') {
      if (!interaction.guild || !hasAccess(interaction.member)) {
        return interaction.reply({ content: '🚫 No permission.', ephemeral: true });
      }
      const menu = new StringSelectMenuBuilder()
        .setCustomId('selectPlatform')
        .setPlaceholder('Choose platform')
        .addOptions(
          { label: 'Sparx Maths', value: 'Sparx Maths', emoji: '📐' },
          { label: 'Sparx Reader', value: 'Sparx Reader', emoji: '📖' },
          { label: 'Sparx Science', value: 'Sparx Science', emoji: '🔬' },
          { label: 'Seneca', value: 'Seneca', emoji: '🧠' },
          { label: 'Educake', value: 'Educake', emoji: '🎓' },
          { label: 'Century Tech', value: 'Century Tech', emoji: '📊' },
          { label: 'Tassomai', value: 'Tassomai', emoji: '🧪' },
          { label: 'Bedrock', value: 'Bedrock', emoji: '🪨' },
          { label: 'Dr Frost', value: 'Dr Frost', emoji: '🔬' },
          { label: 'Times Table Rockstars', value: 'Times Table Rockstars', emoji: '🎸' }
        );
      return interaction.reply({ content: '👋 Pick your platform:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'selectPlatform') {
      if (!interaction.guild || !hasAccess(interaction.member)) {
        return interaction.reply({ content: '🚫 Denied.', ephemeral: true });
      }
      const platform = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`request_${interaction.user.id}`)
        .setTitle(`Request: ${platform}`)
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('school').setLabel('🏫 School').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('username').setLabel('👤 Username').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('password').setLabel('🔑 Password').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('due_date').setLabel('Due date').setStyle(TextInputStyle.Short).setMaxLength(50).setRequired(true)
          )
        );
      pendingPlatforms.set(interaction.user.id, platform);
      return interaction.showModal(modal);
    }

    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('request_')) {
      if (!interaction.guild || !hasAccess(interaction.member)) {
        return interaction.reply({ content: '🚫 Denied.', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });

      const platform = pendingPlatforms.get(interaction.user.id);
      if (!platform) return interaction.editReply('❌ Form expired. Start again.');
      pendingPlatforms.delete(interaction.user.id);

      const school = interaction.fields.getTextInputValue('school').trim();
      const username = interaction.fields.getTextInputValue('username').trim();
      const password = interaction.fields.getTextInputValue('password').trim();
      const dueDate = interaction.fields.getTextInputValue('due_date').trim();

      if (!school || !username || !password || !dueDate) {
        return interaction.editReply('❌ Fill all fields.');
      }

      const request = {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        platform, school, username, password, dueDate,
        percent: 0
      };

      requests.set(request.userId, request);
      lastRequesterId = request.userId;

      const embed = new EmbedBuilder()
        .setTitle('📥 New Homework Request')
        .setColor('#5865F2')
        .addFields(
          { name: 'Requester', value: `${request.userTag}\nID: ${request.userId}` },
          { name: 'Platform', value: request.platform },
          { name: '🏫 School', value: request.school },
          { name: '👤 Username', value: request.username },
          { name: '🔑 Password', value: request.password },
          { name: '📅 Due Date', value: request.dueDate }
        )
        .setTimestamp();

      try {
        const admin = await client.users.fetch(YOUR_ADMIN_ID);
        await admin.send({ embeds: [embed] });
      } catch (e) {
        console.error('❌ Admin DM failed:', e);
      }

      return interaction.editReply(
        '✅ Request sent!\n\n⚠️ Enable DMs: User Settings → Privacy & Safety → Allow DMs from server members'
      );
    }
  } catch (e) {
    console.error('❌ Error:', e);
    if (interaction.isRepliable()) {
      const msg = { content: '❌ Something went wrong.', ephemeral: true };
      interaction.deferred || interaction.replied 
        ? await interaction.followUp(msg).catch(() => {})
        : await interaction.reply(msg).catch(() => {});
    }
  }
});

// ─── ADMIN COMMANDS ───
client.on('messageCreate', async message => {
  if (message.author.bot || message.author.id !== YOUR_ADMIN_ID) return;
  
  const content = message.content.trim();
  if (!/^(done|status|say|time)(\s|$)/i.test(content)) return;

  const request = lastRequesterId ? requests.get(lastRequesterId) : null;
  if (!request) return message.reply('⚠️ No active requester.');

  try {
    const user = await client.users.fetch(request.userId);

    if (content.toLowerCase() === 'done') {
      await user.send({ embeds: [progressEmbed(request, 100)] });
      requests.delete(request.userId);
      lastRequesterId = null;
      return message.reply(`✅ ✅ COMPLETE sent to ${user.tag}!`);
    }

    if (/^done\s/i.test(content)) {
      const num = content.slice(5).trim();
      if (!/^\d{1,3}$/.test(num)) return message.reply('❌ Use: `done 25` `done 50`');
      const pct = Number(num);
      if (pct < 0 || pct > 100) return message.reply('❌ 0–100 only');
      await user.send({ embeds: [progressEmbed(request, pct)] });
      return message.reply(`✅ ${pct}% sent to ${user.tag}`);
    }

    let title, text;
    if (/^status\s/i.test(content)) {
      title = '📝 Status Update';
      text = content.slice(7).trim();
    } else if (/^say\s/i.test(content)) {
      title = '💬 Message from Tutor';
      text = content.slice(4).trim();
    } else if (/^time\s/i.test(content)) {
      title = '⏱️ Time Estimate';
      text = content.slice(5).trim();
    }

    if (!text) return message.reply('❌ Example: `say Hi!`');
    
    await user.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(text).setColor('#5865F2').setTimestamp()] });
    return message.reply(`✅ Sent to ${user.tag}!`);
  } catch (e) {
    console.error('❌ Send failed:', e);
    return message.reply('❌ Could not send — they may have DMs off.');
  }
});

// ─── RENDER HEALTH SERVER ───
const http = require('http');
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('JordanAI bot is running ✅');
}).listen(PORT, '0.0.0.0', () => console.log(`✅ Health server on port ${PORT}`));

// ─── LOGIN ───
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN missing');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error('❌ Login failed:', e);
  process.exit(1);
});
