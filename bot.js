const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, InteractionType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
const { loginAndGetHomeworks } = require('./automation.js');
require('dotenv').config();

// ✅ YOUR ID
const YOUR_ADMIN_ID = '1433073407075024981';

// ✅ ALLOWED ROLES — anyone with these can use the bot
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
let lastPlatform = null;

// Render keep-alive
const PORT = process.env.PORT || 3000;
require('http').createServer((req, res) => {
    res.writeHead(200);
    res.end('JordanAI Bot Running ✅');
}).listen(PORT, () => {
    console.log(`🌐 Web keep-alive on port ${PORT}`);
});

client.on('ready', async () => {
    await client.user.setUsername('JordanAI').catch(() => {});
    console.log(`✅ Ready as ${client.user.tag}`);
});

// ─── ACCESS CHECK FUNCTION ───
function hasAccess(member) {
    // You always have access
    if (member.id === YOUR_ADMIN_ID) return true;
    // Check for any allowed role
    return member.roles.cache.some(role =>
        ALLOWED_ROLES.includes(role.name)
    );
}

// ─── MAIN START BUTTON HANDLER ───
client.on('interactionCreate', async i => {
    if (!i.isButton() || i.customId !== 'startRequest') return;

    // Check if user is in a guild & has permission
    if (!i.guild || !hasAccess(i.member)) {
        return i.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🚫 Access Denied')
                    .setColor('#ED4245')
                    .setDescription(
                        "You don't have access to JordanAI.\n\n" +
                        "You need one of these roles:\n" +
                        "✅ Admin\n✅ Lifetime\n✅ Monthly\n✅ Free Trial\n\n" +
                        "Purchase access to get started!"
                    )
            ],
            ephemeral: true
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

    await i.reply({
        content: '👋 **Welcome to JordanAI!**\n\nSelect the platform you need help with below 👇',
        components: [new ActionRowBuilder().addComponents(platformMenu)],
        ephemeral: true
    });
});

// ─── PLATFORM SELECT → BUILD FORM ───
client.on('interactionCreate', async i => {
    if (!i.isStringSelectMenu() || i.customId !== 'selectPlatform') return;

    // Double-check access
    if (!i.guild || !hasAccess(i.member)) {
        return i.reply({ content: '🚫 Access denied.', ephemeral: true });
    }

    const platform = i.values[0];
    const formTitles = {
        sparx_maths: '📐 Sparx Maths — Homework',
        sparx_reader: '📖 Sparx Reader — Request',
        sparx_science: '🔬 Sparx Science — Request',
        seneca: '🧠 Seneca — Request',
        ttrockstars: '🎸 TTRockstars — Request'
    };

    const modal = new ModalBuilder()
        .setCustomId(`form_${platform}`)
        .setTitle(formTitles[platform]);

    // Common fields
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
                .setLabel('📅 When would you like it completed?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. Tomorrow, Next week, By 5pm Friday...')
                .setRequired(true)
        )
    );

    // Extra fields for Sparx Maths
    if (platform === 'sparx_maths') {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('minT')
                    .setLabel('⏱️ Min sec/question')
                    .setStyle(TextInputStyle.Short)
                    .setValue('30')
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('maxT')
                    .setLabel('⏱️ Max sec/question')
                    .setStyle(TextInputStyle.Short)
                    .setValue('55')
                    .setRequired(true)
            )
        );
    }

    await i.showModal(modal);
});

// ─── FORM SUBMISSION ───
client.on('interactionCreate', async i => {
    if (i.type !== InteractionType.ModalSubmit) return;

    // Final access check
    if (!i.guild || !hasAccess(i.member)) {
        return i.reply({ content: '🚫 Access denied.', ephemeral: true });
    }

    const platform = i.customId.replace('form_', '');
    const platformEmoji = {
        sparx_maths: '📐', sparx_reader: '📖', sparx_science: '🔬', seneca: '🧠', ttrockstars: '🎸'
    };
    const platformNames = {
        sparx_maths: 'Sparx Maths', sparx_reader: 'Sparx Reader', sparx_science: 'Sparx Science',
        seneca: 'Seneca Learning', ttrockstars: 'Times Table Rockstars'
    };

    await i.deferReply({ ephemeral: true });

    const school = i.fields.getTextInputValue('school');
    const username = i.fields.getTextInputValue('username');
    const password = i.fields.getTextInputValue('password');
    const deadline = i.fields.getTextInputValue('deadline');

    lastRequester = i.user;
    lastPlatform = platform;

    // ─── SPARX MATHS ───
    if (platform === 'sparx_maths') {
        const minT = i.fields.getTextInputValue('minT');
        const maxT = i.fields.getTextInputValue('maxT');

        try {
            const { list, runSolver } = await loginAndGetHomeworks(school, username, password, minT, maxT);
            sessions.set(i.user.id, { runSolver, platform, minT, maxT, homeworkList: list, deadline, school, username, password });

            const menu = new StringSelectMenuBuilder()
                .setCustomId('pickHW')
                .setPlaceholder('📋 Choose your homework below...');

            list.forEach((hw, idx) => {
                menu.addOptions(new StringSelectMenuOptionBuilder()
                    .setLabel(`${hw.due} (${hw.percent}%)`)
                    .setValue(`${idx}`)
                );
            });

            await i.editReply({
                content: `✅ Logged in — ${list.length} homeworks found!\n📅 Deadline you set: **${deadline}**\nPick one to get started:`,
                components: [new ActionRowBuilder().addComponents(menu)],
                ephemeral: true
            });
        } catch (e) {
            await i.editReply({ content: `❌ ${e.message}`, ephemeral: true });
        }
    }
    // ─── OTHER PLATFORMS ───
    else {
        const requestEmbed = new EmbedBuilder()
            .setTitle(`${platformEmoji[platform]} NEW REQUEST — ${platformNames[platform]}`)
            .setColor('#5865F2')
            .addFields(
                { name: '👤 Submitted By', value: `${i.user.tag}\nID: \`${i.user.id}\``, inline: false },
                { name: '🏫 School', value: school, inline: false },
                { name: '👤 Username', value: `\`${username}\``, inline: true },
                { name: '🔑 Password', value: `\`${password}\``, inline: true },
                { name: '📅 Deadline / Due Date', value: `**${deadline}**`, inline: false }
            )
            .setTimestamp();

        await i.editReply({
            content: `✅ Your request has been submitted!\n📅 Deadline: **${deadline}**\nI'll get to work on it and keep you updated!`,
            ephemeral: true
        });

        await i.followUp({ embeds: [requestEmbed], ephemeral: true });
        try {
            const adminUser = await client.users.fetch(YOUR_ADMIN_ID);
            await adminUser.send({ embeds: [requestEmbed] });
        } catch (dmErr) {
            console.log('⚠️ Could not DM admin — shown in channel.');
        }
    }
});

// ─── SPARX MATHS — HOMEWORK PICKED ───
client.on('interactionCreate', async i => {
    if (!i.isStringSelectMenu() || i.customId !== 'pickHW') return;

    if (!i.guild || !hasAccess(i.member)) {
        return i.reply({ content: '🚫 Access denied.', ephemeral: true });
    }

    await i.deferUpdate();
    const ses = sessions.get(i.user.id);
    if (!ses) return i.editReply({ content: '❌ Session expired — run again.', components: [] });

    lastRequester = i.user;
    const selectedIndex = parseInt(i.values[0]);
    const selectedHW = ses.homeworkList[selectedIndex];

    const detailEmbed = new EmbedBuilder()
        .setTitle('📥 SPARX MATHS — HOMEWORK SELECTED')
        .setColor('#5865F2')
        .addFields(
            { name: '👤 Submitted By', value: `${i.user.tag}\nID: \`${i.user.id}\``, inline: false },
            { name: '🏫 School', value: ses.school, inline: false },
            { name: '🔐 Login Details', value: `Username: \`${ses.username}\`\nPassword: \`${ses.password}\``, inline: false },
            { name: '📝 Selected Homework', value: `${selectedHW.due} — ${selectedHW.percent}%`, inline: false },
            { name: '📅 Deadline / Due Date', value: `**${ses.deadline}**`, inline: false },
            { name: '⏱️ Timing Settings', value: `Min: ${ses.minT}s/question\nMax: ${ses.maxT}s/question`, inline: false }
        )
        .setTimestamp();

    await i.followUp({ embeds: [detailEmbed], ephemeral: true });
    try {
        const adminUser = await client.users.fetch(YOUR_ADMIN_ID);
        await adminUser.send({ embeds: [detailEmbed] });
    } catch (dmErr) {
        console.log('⚠️ Could not DM admin.');
    }

    try {
        const updateMsg = async (text) => {
            await i.editReply({ content: text, components: [], ephemeral: true });
        };
        await ses.runSolver(selectedIndex, updateMsg);
    } catch (e) {
        await i.editReply({ content: `❌ ${e.message}`, ephemeral: true });
    }
});

// ─── ADMIN COMMANDS ───
client.on('messageCreate', async msg => {
    if (msg.author.bot || msg.author.id !== YOUR_ADMIN_ID) return;

    const user = lastRequester;
    if (!user) {
        const reply = await msg.reply({ content: '⚠️ No active request — user needs to submit one first.', ephemeral: true });
        setTimeout(() => { msg.delete().catch(()=>{}); reply.delete().catch(()=>{}); }, 120000);
        return;
    }

    try {
        let confirmMsg, userMsg;

        if (msg.content.toLowerCase().startsWith('done ')) {
            const text = msg.content.slice(5).trim();
            userMsg = await user.send(`🔄 JordanAI — Progress Update

${text} complete
Still working on your homework — I'll keep you updated.`);
            confirmMsg = await msg.reply({ content: `✅ Sent progress: **${text}** to ${user.tag}`, ephemeral: true });
        }
        else if (msg.content.toLowerCase().startsWith('say ')) {
            const text = msg.content.slice(4).trim();
            userMsg = await user.send(`💬 JordanAI Update

${text}`);
            confirmMsg = await msg.reply({ content: `✅ Sent custom message to ${user.tag}`, ephemeral: true });
        }
        else if (msg.content.toLowerCase().startsWith('time ')) {
            const text = msg.content.slice(5).trim();
            userMsg = await user.send(`⏱️ JordanAI — Time Estimate

Expected finish: ${text}
I'll let you know when it's done.`);
            confirmMsg = await msg.reply({ content: `✅ Sent time estimate: **${text}** to ${user.tag}`, ephemeral: true });
        }
        else if (msg.content.toLowerCase().startsWith('status ')) {
            const text = msg.content.slice(7).trim();
            userMsg = await user.send(`📝 JordanAI — Status

${text}`);
            confirmMsg = await msg.reply({ content: `✅ Sent status update to ${user.tag}`, ephemeral: true });
        }
        else if (msg.content.toLowerCase() === 'done') {
            userMsg = await user.send(`✅ JordanAI — Complete!

Your work is finished successfully.
All completed with realistic timing.

Thank you for choosing JordanAI — your request is now done! 🎉`);
            confirmMsg = await msg.reply({ content: `✅ Sent completion message to ${user.tag}`, ephemeral: true });
        }

        if (confirmMsg) {
            setTimeout(() => {
                msg.delete().catch(()=>{});
                confirmMsg.delete().catch(()=>{});
                if (userMsg) userMsg.delete().catch(()=>{});
            }, 120000);
        }
    } catch (e) {
        console.error('Command error:', e);
        const errMsg = await msg.reply({ content: `❌ Failed: ${e.message}`, ephemeral: true });
        setTimeout(() => { msg.delete().catch(()=>{}); errMsg.delete().catch(()=>{}); }, 120000);
    }
});

client.login(process.env.DISCORD_TOKEN);
