
const {
  Client,
  GatewayIntentBits,
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

const ALLOWED_ROLES = [
  'Admin',
  'Lifetime',
  'Monthly',
  'Free Trial'
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

const requests = new Map();
const pendingPlatforms = new Map();
let lastRequesterId = null;

// ─── OPTIONAL HOST KEEP-ALIVE ───
const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain'
  });
  res.end('JordanAI Running');
}).listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ─── ACCESS CHECK ───
function hasAccess(member) {
  if (!member) return false;

  if (member.id === YOUR_ADMIN_ID) {
    return true;
  }

  return member.roles?.cache?.some(role =>
    ALLOWED_ROLES.includes(role.name)
  ) ?? false;
}

// ─── PROGRESS BAR ───
function makeBar(percent) {
  const filled = Math.round(percent / 5);

  return '🟩'.repeat(filled) +
    '⬜'.repeat(20 - filled);
}

function makeTaskBreakdown(percent) {
  const tasks = [
    'Task 1',
    'Task 2',
    'Task 3',
    'Task 4',
    'Task 5',
    'Task 6',
    'Flashcards'
  ];

  const count = Math.round(
    (percent / 100) * tasks.length
  );

  return tasks.map((task, index) => {
    if (percent === 100) return `✅ ${task}`;
    if (index < count) return `🟦 ${task}`;
    return `⬜ ${task}`;
  }).join('\n');
}

function progressEmbed(request, percent) {
  return new EmbedBuilder()
    .setTitle(
      percent === 100
        ? '✅ Request Complete!'
        : '📊 Progress Update'
    )
    .setColor(
      percent === 100 ? '#57F287' : '#5865F2'
    )
    .setDescription(
      `**Platform:** ${request.platform}\n` +
      `**Homework:** ${request.homework}\n` +
      `**Progress:** ${percent}%\n\n` +
      `${makeBar(percent)}\n\n` +
      `**Illustrative task breakdown**\n` +
      `${makeTaskBreakdown(percent)}\n\n` +
      '_This is a manually updated progress display; ' +
      'task completion is not independently verified._'
    )
    .setFooter({ text: 'JordanAI' })
    .setTimestamp();
}

// ─── WELCOME PANEL ───
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(
      MAIN_CHANNEL_ID
    );

    if (!channel?.isTextBased() || !channel.guild) {
      console.log('Main channel not found.');
      return;
    }

    const recent = await channel.messages.fetch({
      limit: 20
    });

    const exists = recent.some(message =>
      message.author.id === client.user.id &&
      message.embeds[0]?.title === 'Welcome to JordanAI'
    );

    if (exists) {
      console.log('Welcome panel already exists.');
      return;
    }

    const panel = new EmbedBuilder()
      .setTitle('Welcome to JordanAI')
      .setColor('#5865F2')
      .setDescription(
        'Submit a homework request using the button below.\n\n' +
        '📐 Sparx Maths\n' +
        '📖 Sparx Reader\n' +
        '🔬 Sparx Science\n' +
        '🧠 Seneca\n' +
        '🎸 Times Table Rockstars'
      )
      .setFooter({ text: 'JordanAI' });

    await channel.send({
      embeds: [panel],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('startRequest')
            .setLabel('Submit Request')
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setLabel('FAQ')
            .setStyle(ButtonStyle.Link)
            .setURL(
              `https://discord.com/channels/` +
              `${channel.guild.id}/${FAQ_CHANNEL_ID}`
            )
        )
      ]
    });

    console.log('Welcome panel posted.');
  } catch (error) {
    console.error('Panel error:', error);
  }
});

// ─── INTERACTIONS ───
client.on('interactionCreate', async interaction => {
  try {
    // Open platform selector.
    if (
      interaction.isButton() &&
      interaction.customId === 'startRequest'
    ) {
      if (
        !interaction.guild ||
        !hasAccess(interaction.member)
      ) {
        return interaction.reply({
          content: '🚫 You do not have permission to submit requests.',
          ephemeral: true
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('selectPlatform')
        .setPlaceholder('Choose a platform')
        .addOptions(
          {
            label: 'Sparx Maths',
            value: 'Sparx Maths',
            emoji: '📐'
          },
          {
            label: 'Sparx Reader',
            value: 'Sparx Reader',
            emoji: '📖'
          },
          {
            label: 'Sparx Science',
            value: 'Sparx Science',
            emoji: '🔬'
          },
          {
            label: 'Seneca',
            value: 'Seneca',
            emoji: '🧠'
          },
          {
            label: 'Times Table Rockstars',
            value: 'Times Table Rockstars',
            emoji: '🎸'
          }
        );

      return interaction.reply({
        content: '👋 Choose your platform:',
        components: [
          new ActionRowBuilder().addComponents(menu)
        ],
        ephemeral: true
      });
    }

    // Open request form.
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === 'selectPlatform'
    ) {
      if (
        !interaction.guild ||
        !hasAccess(interaction.member)
      ) {
        return interaction.reply({
          content: '🚫 Access denied.',
          ephemeral: true
        });
      }

      const platform = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`request_${interaction.user.id}`)
        .setTitle(`Request: ${platform}`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('school')
            .setLabel('School name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('username')
            .setLabel('Username (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('homework')
            .setLabel('What homework?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe the homework')
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('details')
            .setLabel('Extra details (optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        )
      );

      pendingPlatforms.set(
        interaction.user.id,
        platform
      );

      return interaction.showModal(modal);
    }

    // Process submitted form.
    if (
      interaction.type === InteractionType.ModalSubmit &&
      interaction.customId.startsWith('request_')
    ) {
      if (
        !interaction.guild ||
        !hasAccess(interaction.member)
      ) {
        return interaction.reply({
          content: '🚫 Access denied.',
          ephemeral: true
        });
      }

      await interaction.deferReply({
        ephemeral: true
      });

      const platform = pendingPlatforms.get(
        interaction.user.id
      );

      if (!platform) {
        return interaction.editReply(
          '❌ Your form expired. Please submit it again.'
        );
      }

      pendingPlatforms.delete(interaction.user.id);

      const request = {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        platform,
        school: interaction.fields.getTextInputValue('school'),
        username:
          interaction.fields.getTextInputValue('username') ||
          'Not provided',
        homework:
          interaction.fields.getTextInputValue('homework'),
        details:
          interaction.fields.getTextInputValue('details') ||
          'None provided',
        percent: 0
      };

      requests.set(request.userId, request);
      lastRequesterId = request.userId;

      const embed = new EmbedBuilder()
        .setTitle('📥 New Homework Request')
        .setColor('#5865F2')
        .addFields(
          {
            name: 'Requester',
            value: `${request.userTag}\nID: ${request.userId}`
          },
          {
            name: 'Platform',
            value: request.platform
          },
          {
            name: 'School',
            value: request.school
          },
          {
            name: 'Username',
            value: request.username
          },
          {
            name: 'What homework?',
            value: request.homework
          },
          {
            name: 'Extra details',
            value: request.details
          }
        )
        .setTimestamp();

      try {
        const admin = await client.users.fetch(
          YOUR_ADMIN_ID
        );

        await admin.send({ embeds: [embed] });
      } catch (error) {
        console.error('Admin DM failed:', error);

        return interaction.editReply(
          '⚠️ The request could not be sent to the admin. ' +
          'Please contact them directly.'
        );
      }

      return interaction.editReply(
        '✅ Your homework request has been sent!'
      );
    }
  } catch (error) {
    console.error('Interaction error:', error);

    if (interaction.isRepliable()) {
      const response = {
        content: '❌ Something went wrong. Please try again.',
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(response).catch(() => {});
      } else {
        await interaction.reply(response).catch(() => {});
      }
    }
  }
});

// ─── ADMIN COMMANDS ───
// done 10
// done 50
// done
// status Waiting for review
// say Your message
// time About two hours

client.on('messageCreate', async message => {
  if (
    message.author.bot ||
    message.author.id !== YOUR_ADMIN_ID
  ) {
    return;
  }

  const content = message.content.trim();

  if (!/^(done|status|say|time)(\s|$)/i.test(content)) {
    return;
  }

  const userId = lastRequesterId;
  const request = userId
    ? requests.get(userId)
    : null;

  if (!request) {
    return message.reply(
      '⚠️ No active request found.'
    );
  }

  try {
    if (content.toLowerCase() === 'done') {
      request.percent = 100;

      const user = await client.users.fetch(userId);

      await user.send({
        embeds: [progressEmbed(request, 100)]
      });

      requests.delete(userId);

      if (lastRequesterId === userId) {
        lastRequesterId = null;
      }

      return message.reply('✅ Completion update sent.');
    }

    if (/^done\s/i.test(content)) {
      const value = content.slice(5).trim();

      if (!/^\d{1,3}$/.test(value)) {
        return message.reply(
          'Use `done 10`, `done 50`, etc. Or use `done` to finish.'
        );
      }

      const percent = Number(value);

      if (percent < 0 || percent > 100) {
        return message.reply(
          '❌ Percentage must be between 0 and 100.'
        );
      }

      request.percent = percent;

      const user = await client.users.fetch(userId);

      await user.send({
        embeds: [progressEmbed(request, percent)]
      });

      return message.reply(
        `✅ Sent ${percent}% progress to ${request.userTag}.`
      );
    }

    let title;
    let text;

    if (/^status\s/i.test(content)) {
      title = '📝 Status Update';
      text = content.slice(7).trim();
    } else if (/^say\s/i.test(content)) {
      title = '💬 Message from Admin';
      text = content.slice(4).trim();
    } else if (/^time\s/i.test(content)) {
      title = '⏱️ Time Estimate';
      text = content.slice(5).trim();
    }

    if (!text) {
      return message.reply(
        'Add a message after the command.'
      );
    }

    const user = await client.users.fetch(userId);

    await user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(text)
          .setColor('#5865F2')
          .setTimestamp()
      ]
    });

    return message.reply('✅ Update sent.');
  } catch (error) {
    console.error('Admin command error:', error);

    return message.reply(
      '❌ Could not DM the requester. They may have DMs disabled.'
    );
  }
});

// ─── LOGIN ───
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN is missing from .env');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ Discord login failed:', error);
  process.exit(1);
});
