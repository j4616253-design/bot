const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
require('dotenv').config();

// === CONFIGURATION ===
const TARGET_CHANNEL = '1517274360790913096'            
// =====================

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`✅ Rules bot logged in as ${client.user.tag}`);
    try {
        const channel = await client.channels.fetch(TARGET_CHANNEL);
        if (!channel) return console.error('❌ Channel not found');

        const rulesEmbed = new EmbedBuilder()
            .setTitle('<:jordanai:1524850740244513051> JordanAI Learning Platform — Official Rules')
            .setDescription(
                'To maintain a secure, high-performance ecosystem for all subscribers, you must adhere to our platform guidelines. Violation of these terms will result in immediate suspension.'
            )
            .setColor('#5865F2')
            .addFields(
                {
                    name: '⚖️ 1. Account Integrity & Sharing',
                    value: 'Your subscription access profile is linked uniquely to your Discord ID. Account sharing, access reselling, or using the bot to process homework for non-subscribers is strictly banned.'
                },
                {
                    name: '🔒 2. Credentials Security',
                    value: 'Ensure your login entries are valid before executing the assistant. Intentionally spamming false credentials or attempting to corrupt the modal payload processing pipeline will trigger an automatic security lock.'
                },
                {
                    name: '⚠️ 3. System Abuse & Rate Limits',
                    value: 'Do not attempt to bypass input parameters, run rapid concurrent sessions on a single account, or exploit automation hooks. The system features deep protection algorithms to detect artificial load generation.'
                },
                {
                    name: '🛑 4. Refund & Chargeback Policy',
                    value: 'Opening formal merchant payment disputes or chargebacks without contacting support directly will lead to an instant, permanent ban of your Discord identity and blacklist your school profiles from our engine database.'
                },
                {
                    name: '💬 5. Support Etiquette',
                    value: 'If an execution session returns an automated engine fault code, open a ticket calmly. High-tier administrators manually oversee the operational queues and handle issues systematically.'
                },
                {
                    name: '🛡️ 6. Account Safety Notice',
                    value: 'By activating this automation service, you accept that your account carries a small, though highly unlikely, risk of detection if flagged for artificial completion speeds. While our human-like timing delay parameters minimize exposure, ultimate usage responsibility resides with the user.'
                }
            )
            .setFooter({ text: 'JordanAI Systems • Terms of Service & Enforcement' })
            .setTimestamp();

        // Create the green Accept button
        const acceptBtn = new ButtonBuilder()
            .setCustomId('acceptRules')
            .setLabel('I Accept')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(acceptBtn);

        // Send the panel message
        await channel.send({ embeds: [rulesEmbed], components: [row] });
        console.log('✅ Rules panel with button sent successfully! Listening for interactions...');
    } catch (err) {
        console.error('❌ Rules panel deployment error:', err);
    }
});

// Handle the button click event
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'acceptRules') return;

    try {
        // Simply reply to the user to confirm they accepted
        await interaction.reply({ 
            content: '✅ **Thank you!** You have accepted the platform guidelines and the account safety notice.', 
            ephemeral: true 
        });
    } catch (err) {
        console.error('❌ Failed to process acceptance:', err);
    }
});

client.login(process.env.DISCORD__TOKEN);
