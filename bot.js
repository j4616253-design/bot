
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

// ─── CONFIG ───
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

// Requests waiting for admin updates.
const requests = new Map();
const pendingPlatforms = new Map();
let lastRequesterId = null;

// ─── KEEP-ALIVE FOR HOSTING ───
const PORT = process.env.PORT || 3000;

require('http').createServer((req, res) => {
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
  if (member.id === YOUR_ADMIN_ID) return true;

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

// Illustrative categories, not verified task completion.
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
  const complete = percent === 100;

  return new EmbedBuilder()
    .setTitle(
      complete
        ? '✅ Request Complete!'
        : '📊 Progress Update'
    )
    .setColor(
      complete ? '#57F287' : '#5865F2'
    )
    .setDescription(
      `**Platform:** ${request.platform}\n` +
      `**Progress:** ${percent}%\n\n` +
      `${makeBar(percent)}\n\n` +
      `**Illustrative task breakdown**\n` +
      `${makeTaskBreakdown(percent)}\n\n` +
      '_Task categories are illustrative and do not ' +
      'verify completed work._'
    )
    .setFooter({
      text: 'JordanAI'
    })
    .setTimestamp();
}

// ─── MAIN PANEL ───
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
      console.log('Panel already exists.');
      return;
    }

    const panel = new EmbedBuilder()
      .setTitle('Welcome to JordanAI')
      .setColor('#5865F2')
      .setDescription(
        'Submit a request using the button below.\n\n' +
        '📐 Sparx Maths\n' +
        '📖 Sparx Reader\n' +
        '🔬 Sparx Science\n' +
        '🧠 Seneca\n' +
        '🎸 Times Table Rockstars\n\n' +
        'Choose a platform to get started.'
      )
      .setFooter({
        text: 'JordanAI'
      });

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

    console.log('Request panel posted.');
  } catch (error) {
    console.error('Panel error:', error.message);
  }
});

// ─── INTERACTIONS ───
client.on('interactionCreate', async interaction => {
  try {

    // Open the platform selector.
    if (
      interaction.isButton() &&
      interaction.customId === 'startRequest'
    ) {
      await interaction.deferReply({
        ephemeral: true
      });

      if (
        !interaction.guild ||
        !hasAccess(interaction.member)
      ) {
        return interaction.editReply(
          '🚫 You do not have permission to submit requests.'
        );
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

      return interaction.editReply({
        content: '👋 Choose your platform:',
        components: [
          new ActionRowBuilder().addComponents(menu)
        ]
      });
    }

    // Display the request form.
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
        .setCustomId(
          `request_${interaction.user.id}`
        )
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
            .setCustomId('deadline')
            .setLabel('Deadline')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Tomorrow / next week')
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('details')
            .setLabel('Request details')
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

    // Process a submitted form.
    if (
      interaction.type === InteractionType.ModalSubmit &&
      interaction.customId.startsWith('request_')
    ) {
      await interaction.deferReply({
        ephemeral: true
      });

      if (
        !interaction.guild ||
        !hasAccess(interaction.member)
      ) {
        return interaction.editReply(
          '🚫 Access denied.'
        );
      }

      const platform = pendingPlatforms.get(
        interaction.user.id
      );

      if (!platform) {
        return interaction.editReply(
          '❌ Your form expired. Please start again.'
        );
      }

      pendingPlatforms.delete(interaction.user.id);

      const request = {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        platform,
        school: interaction.fields.getTextInputValue(
          'school'
        ),
        username:
          interaction.fields.getTextInputValue('username') ||
          'Not provided',
        deadline: interaction.fields.getTextInputValue(
          'deadline'
        ),
        details:
          interaction.fields.getTextInputValue('details') ||
          'No additional details',
        percent: 0
      };

      // Save the request for subsequent progress commands.
      requests.set(interaction.user.id, request);
      lastRequesterId = interaction.user.id;

      const adminEmbed = new EmbedBuilder()
        .setTitle('📥 New Request')
        .setColor('#5865F2')
        .addFields(
          {
            name: 'Requester',
            value:
              `${request.userTag}\n` +
              `ID: ${request.userId}`
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
            name: 'Deadline',
            value: request.deadline
          },
          {
            name: 'Details',
            value: request.details
          }
        )
        .setTimestamp();

      try {
        const admin = await client.users.fetch(
          YOUR_ADMIN_ID
        );

        await admin.send({
          embeds: [adminEmbed]
        });
      } catch (error) {
        console.error(
          'Admin notification failed:',
          error.message
        );

        return interaction.editReply(
          '⚠️ The request was saved, but I could not DM the admin. ' +
          'Please contact them directly.'
        );
      }

      return interaction.editReply(
        '✅ Your request was sent successfully!'
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

 
// ─── ADMIN PROGRESS COMMANDS ───
//
// done 10
// done 20
// done 50
// done 90
// done
// status Waiting for review
// say Your message here
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

  const lower = content.toLowerCase();

  // The latest request is the default target.
  const userId = lastRequesterId;
  const request = userId
    ? requests.get(userId)
    : null;

  if (!request) {
    return message.reply(
      '⚠️ No active request. Ask someone to submit a form first.'
    );
  }

  try {
    // Mark the request complete.
    if (lower === 'done') {
      request.percent = 100;

      const user = await client.users.fetch(userId);

      await user.send({
        embeds: [
          progressEmbed(request, 100)
        ]
      });

      requests.delete(userId);

      if (lastRequesterId === userId) {
        lastRequesterId = null;
      }

      return message.reply(
        '✅ Completion update sent.'
      );
    }

    // Send a numeric progress update.
    if (lower.startsWith('done ')) {
      const value = content.slice(5).trim();

      if (!/^\d{1,3}$/.test(value)) {
        return message.reply(
          'Usage: `done 10`, `done 50`, etc. Use `done` for completion.'
        );
      }

      const percent = Number(value);

      if (percent < 0 || percent > 100) {
        return message.reply(
          '❌ Enter a percentage between 0 and 100.'
        );
      }

      request.percent = percent;

      const user = await client.users.fetch(userId);

      await user.send({
        embeds: [
          progressEmbed(request, percent)
        ]
      });

      return message.reply(
        `✅ Sent ${percent}% progress to ${request.userTag}.`
      );
    }

    // Text updates.
    let title;
    let text;

    if (lower.startsWith('status ')) {
      title = '📝 Status Update';
      text = content.slice(7).trim();
    } else if (lower.startsWith('say ')) {
      title = '💬 Message from the Admin';
      text = content.slice(4).trim();
    } else if (lower.startsWith('time ')) {
      title = '⏱️ Time Estimate';
      text = content.slice(5).trim();
    }

    if (!text) {
      return message.reply(
        'Please enter a message after the command.'
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
    console.error(
      'Admin command error:',
      error.message
    );

    return message.reply(
      '❌ Could not send the update. The requester may have DMs disabled.'
    );
  }
});

// ─── BOT LOGIN ───
if (!process.env.DISCORD_TOKEN) {
  console.error(
    '❌ Missing DISCORD_TOKEN in your .env file.'
  );

  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error(
    '❌ Discord login failed:',
    error.message
  );

  process.exit(1);
});
