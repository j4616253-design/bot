const {
  Client, GatewayIntentBits, ModalBuilder, TextInputBuilder,
  TextInputStyle, ActionRowBuilder, InteractionType,
  EmbedBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
require('dotenv').config();

const YOUR_ADMIN_ID = '1433073407075024981';
const MAIN_CHANNEL_ID = '1529910322184454296';
const FAQ_CHANNEL_ID = '1517285523042078730';
const ALLOWED_ROLES = ['Admin', 'Lifetime', 'Monthly', 'Free Trial'];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent]
});

// Keep-alive for Render
require('http').createServer((_, res) => res.end('ok')).listen(process.env.PORT||3000);

function hasAccess(member) {
  if (member.id === YOUR_ADMIN_ID) return true;
  return member.roles.cache.some(r => ALLOWED_ROLES.includes(r.name));
}

// Post panel once
client.on('ready', async () => {
  console.log(`✅ Logged in: ${client.user.tag}`);
  const ch = await client.channels.fetch(MAIN_CHANNEL_ID);
  if (!ch) return;
  const msgs = await ch.messages.fetch({limit:10});
  if (msgs.some(m => m.embeds[0]?.title?.includes('JordanAI'))) return;

  await ch.send({
    embeds: [new EmbedBuilder()
      .setTitle('✨ JordanAI')
      .setColor('#5865F2')
      .setDescription('Click below to submit your request')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('openForm').setLabel('📝 Submit Request').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setLabel('📋 FAQ').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${ch.guild.id}/${FAQ_CHANNEL_ID}`)
    )]
  });
});

// Open form — DEFER FIRST
client.on('interactionCreate', async i => {
  if (!i.isButton() || i.customId !== 'openForm') return;
  await i.deferReply({ephemeral:true}); // ⬅️ FIRST THING — stops timeout

  if (!hasAccess(i.member)) {
    return i.editReply({embeds: [new EmbedBuilder()
      .setTitle('🚫 No Access')
      .setColor('#ED4245')
      .setDescription('Need: Admin / Lifetime / Monthly / Free Trial')]});
  }

  const form = new ModalBuilder().setCustomId('mainForm').setTitle('📝 Submit Request');
  form.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('school').setLabel('🏫 School').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('👤 Username').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('password').setLabel('🔑 Password').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('platform').setLabel('📐 Platform').setStyle(TextInputStyle.Short).setPlaceholder('Sparx Maths / Sparx Reader / Seneca / etc').setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('deadline').setLabel('📅 Deadline').setStyle(TextInputStyle.Short).setPlaceholder('e.g. Tomorrow / Friday').setRequired(true))
  );
  await i.showModal(form);
});

// Handle submission
client.on('interactionCreate', async i => {
  if (i.type !== InteractionType.ModalSubmit || i.customId !== 'mainForm') return;
  await i.deferReply({ephemeral:true}); // ⬅️ FIRST THING — stops timeout

  if (!hasAccess(i.member)) return i.editReply('🚫 No access');

  const data = {
    user: i.user.tag,
    id: i.user.id,
    school: i.fields.getTextInputValue('school'),
    username: i.fields.getTextInputValue('username'),
    password: i.fields.getTextInputValue('password'),
    platform: i.fields.getTextInputValue('platform'),
    deadline: i.fields.getTextInputValue('deadline')
  };

  const embed = new EmbedBuilder()
    .setTitle('✅ New Request')
    .setColor('#5865F2')
    .addFields(
      {name:'User', value:`${data.user}\n\`${data.id}\``, inline:false},
      {name:'Platform', value:data.platform, inline:true},
      {name:'School', value:data.school, inline:true},
      {name:'Username', value:`\`${data.username}\``, inline:true},
      {name:'Password', value:`\`${data.password}\``, inline:true},
      {name:'Deadline', value:data.deadline, inline:false}
    )
    .setTimestamp();

  await i.editReply('✅ Submitted! We\'ll get back to you.');
  try { await (await client.users.fetch(YOUR_ADMIN_ID)).send({embeds:[embed]}); } catch {}
});

client.login(process.env.DISCORD_TOKEN);
