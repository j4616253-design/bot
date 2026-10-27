const {
  Client,
  GatewayIntentBits,
  Partials,  // ✅ Added — critical for DMs
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
    GatewayIntentBits.GuildMessages,    // ✅ Explicit
    GatewayIntentBits.DirectMessages,   // ✅ Explicit
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]  // ✅ Lets bot see DM channels properly
});

const requests = new Map();
const pendingPlatforms = new Map();
let lastRequesterId = null;

// ─── PROGRESS BAR ───
function makeBar(percent) {
  const filled = Math.round(percent / 5);
  return '🟩'.repeat(filled) + '⬜'.repeat(20 - filled);
}

function makeTaskBreakdown(percent) {
  const tasks = ['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5', 'Task 6', 'Flashcards'];
  const count = Math.round(percent / 100 * tasks.length);
  return tasks.map((task, index) => {
    if (percent === 100) return `✅ ${task}`;
    return index < count ? `🟦 ${task}` : `⬜ ${task}`;
  }).join('\n');
}

function progressEmbed(request, percent) {
  return new EmbedBuilder()
    .setTitle(percent === 100 ? '✅ Request Complete!' : '📊 Progress Update')
    .setColor(percent === 100 ? '#57F287' : '#5865F2')
    .setDescription(
      `**Platform:** ${request.platform}\n` +
      `**Homework Due Date:** ${request.dueDate}\n` +
      `**Progress:** ${percent}%\n\n` +
      `${makeBar(percent)}\n\n` +
      `**Illustrative task breakdown**\n` +
      `${makeTaskBreakdown(percent)}\n\n` +
      '_Progress is manually updated and does not verify completed work._'
    )
    .setFooter({ text: 'JordanAI' })
    .setTimestamp();
}

function hasAccess(member) {
  if (!member) return false;
  if (member.id === YOUR_ADMIN_ID) return true;
  return member?.roles?.cache?.some(role => ALLOWED_ROLES.includes(role.name)) ?? false;
}

// ─── WELCOME PANEL ───
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    const channel = await client.channels.fetch(MAIN_CHANNEL_ID);
    if (!channel?.isTextBased() || !channel.guild) {
      console.log('⚠️ Main channel not found.');
      return;
    }
    const recent = await channel.messages.fetch({ limit: 20 });
    const exists = recent.some(msg =>
      msg.author.id === client.user.id &&
      msg.embeds[0]?.title === '✨ Welcome to JordanAI'
    );
    if (exists) {
      console.log('ℹ️ Welcome panel already exists.');
      return;
    }

    const panel = new EmbedBuilder()
      .setTitle('✨ Welcome to JordanAI')
      .setColor('#5865F2')
      .setDescription(
        `**Your gateway to personalised AI tutoring assistance.**\n` +
        `**Our verified helpers are available to support you across multiple platforms.**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📚 **Available Platforms**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📐 Sparx Maths        📖 Sparx Reader\n` +
        `🔬 Sparx Science      🧠 Seneca\n` +
        `🎓 Educake            📊 Century Tech\n` +
        `🧪 Tassomai           🪨 Bedrock\n` +
        `🔬 Dr Frost           🎸 Times Table Rockstars\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📝 **What We Offer**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ **Personalised help** for all your homework questions\n` +
        `✅ **Real-time updates** on your task progress\n` +
        `✅ **Solutions** for even the most challenging work\n` +
        `✅ **Secure & confidential** — your details stay private\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ **Enable DMs:** User Settings → Privacy & Safety → Allow DMs from server members\n` +
        `Press the button below to submit your request 🚀`
      )
      .setFooter({ text: 'JordanAI • Your study support partner' });

    await channel.send({
      embeds: [panel],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('startRequest')
            .setLabel('📩 Submit Your Request')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel('📋 FAQ')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/channels/${channel.guild.id}/${FAQ_CHANNEL_ID}`)
        )
      ]
    });
    console.log('✅ Welcome panel posted.');
  } catch (error) {
    console.error('❌ Panel error:', error);
  }
});

// ─── INTERACTION HANDLER ───
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isButton() && interaction.customId === 'startRequest') {
      if (!interaction.guild || !hasAccess(interaction.member)) {
        return interaction.reply({
          content: '🚫 You do not have permission to submit requests.',
          ephemeral: true
        });
      }
      const menu = new StringSelectMenuBuilder()
        .setCustomId('selectPlatform')
        .setPlaceholder('Choose a platform')
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
      return interaction.reply({
        content: '👋 Choose your platform:',
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'selectPlatform') {
      if (!interaction.guild || !hasAccess(interaction.member)) {
        return interaction.reply({ content: '🚫 Access denied.', ephemeral: true });
      }
      const platform = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`request_${interaction.user.id}`)
        .setTitle(`Request: ${platform}`);
      
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('school')
            .setLabel('🏫 School')
            .setPlaceholder('Your school name')
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setMaxLength(100)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('username')
            .setLabel('👤 Username')
            .setPlaceholder('your login username')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(100)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('password')
            .setLabel('🔑 Password')
            .setPlaceholder('your password')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(100)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('due_date')
            .setLabel('What date would you like it completed?')
            .setPlaceholder('e.g. 29 Oct, Monday, 30/10')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(50)
            .setRequired(true)
        )
      );
      
      pendingPlatforms.set(interaction.user.id, platform);
      return interaction.showModal(modal);
    }

    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('request_')) {
      if (!interaction.guild || !hasAccess(interaction.member)) {
        return interaction.reply({ content: '🚫 Access denied.', ephemeral: true });
      }
      
      await interaction.deferReply({ ephemeral: true });

      const platform = pendingPlatforms.get(interaction.user.id);
      if (!platform) {
        return interaction.editReply('❌ Your form expired. Please start again.');
      }
      pendingPlatforms.delete(interaction.user.id);

      const school = (interaction.fields.getTextInputValue('school') || '').trim();
      const username = (interaction.fields.getTextInputValue('username') || '').trim();
      const password = (interaction.fields.getTextInputValue('password') || '').trim();
      const dueDate = (interaction.fields.getTextInputValue('due_date') || '').trim();

      if (!school || !username || !password || !dueDate) {
        return interaction.editReply('❌ Please fill in all fields.');
      }

      const request = {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        platform,
        school,
        username,
        password,
        dueDate,
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
      } catch (dmError) {
        console.error('❌ Admin DM failed:', dmError);
      }

      return interaction.editReply(
        '✅ Your homework request has been sent!\n\n' +
        '⚠️ Make sure DMs are ON: User Settings → Privacy & Safety → ' +
        'Enable "Allow Direct Messages from Server Members"'
      );
    }
  } catch (error) {
    console.error('❌ Error:', error);
    const msg = error.message || 'Something went wrong';
    if (interaction.isRepliable()) {
      const response = { content: `❌ ${msg}. Please try again.`, ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(response).catch(() => {});
      } else {
        await interaction.reply(response).catch(() => {});
      }
    }
  }
});

// ─── ADMIN COMMANDS — GUARANTEED TO WORK ───
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (message.author.id !== YOUR_ADMIN_ID) return;

  const content = message.content.trim();
  if (!/^(done|status|say|time)(\s|$)/i.test(content)) return;

  const request = lastRequesterId ? requests.get(lastRequesterId) : null;
  
  if (!request) {
    return message.reply('⚠️ No active requester. Wait for someone to submit first.');
  }

  try {
    // ✅ Get the PERSON WHO ASKED — NOT you
    const user = await client.users.fetch(request.userId);
    console.log(`📤 Sending to: ${user.tag} (${user.id})`);

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

    if (!text) return message.reply('❌ Example: `say Hi, working on it!`');

    await user.send({
      embeds: [new EmbedBuilder().setTitle(title).setDescription(text).setColor('#5865F2').setTimestamp()]
    });
    return message.reply(`✅ Sent to ${user.tag}!`);

  } catch (err) {
    console.error('❌ Send failed:', err);
    return message.reply(
      `❌ Could not send — they likely have DMs OFF.\n` +
      `Tell them: Go to User Settings → Privacy & Safety → ` +
      `Turn ON "Allow Direct Messages from Server Members"`
    );
  }
});

// ─── RENDER HEALTH SERVER ───
const http = require('http');
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('JordanAI bot is running ✅');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Health server on port ${PORT}`);
});

// ─── LOGIN ───
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN missing');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Login failed:', err);
  process.exit(1);
});
