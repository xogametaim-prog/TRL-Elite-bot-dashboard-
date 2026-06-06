// ==================== main.js ====================
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const { initDB, searchBots, importBotsFromJSON, initGiveawayTable, saveGiveaway, getActiveGiveaways, deactivateGiveaway } = require('./management.js');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('✅ Bot is alive!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

const giveawayTimers = new Map();

function scheduleGiveaway(guildId, channelId, messageId, prize, language, emoji, winners, endTime) {
  const delay = endTime - Math.floor(Date.now() / 1000);
  const key = `${guildId}-${messageId}`;
  
  if (giveawayTimers.has(key)) clearTimeout(giveawayTimers.get(key));
  
  const timer = setTimeout(() => endGiveaway(guildId, channelId, messageId, prize, language, emoji, winners), delay * 1000);
  giveawayTimers.set(key, timer);
}

async function endGiveaway(guildId, channelId, messageId, prize, language, emoji, winnersCount) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    let msg;
    try { msg = await channel.messages.fetch(messageId); } catch (e) { msg = null; }

    const participants = [];
    if (msg) {
      const reaction = msg.reactions.cache.get(emoji);
      if (reaction) {
        const users = await reaction.users.fetch();
        users.forEach(user => {
          if (!user.bot) participants.push(user);
        });
      }
    }

    let winners = [];
    if (participants.length > 0) {
      const shuffled = participants.sort(() => 0.5 - Math.random());
      winners = shuffled.slice(0, Math.min(winnersCount, participants.length));
    }

    let title, desc;
    if (language === 'en') {
      title = `🎉 Giveaway Ended: ${prize}`;
      desc = winners.length > 0 
        ? `**Congratulations!** ${winners.map(w => w.toString()).join(' ')}\nYou won: **${prize}**!`
        : `No one participated in: **${prize}**!`;
    } else {
      title = `🎉 انتهى السحب: ${prize}`;
      desc = winners.length > 0 
        ? `**مبروك!** ${winners.map(w => w.toString()).join(' ')}\nلقد فزت في سحب: **${prize}**!`
        : `لم يشارك أحد في سحب: **${prize}**!`;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(desc)
      .setColor(0xFFD700)
      .setTimestamp();

    if (msg) await msg.reply({ embeds: [embed] });
    else await channel.send({ embeds: [embed] });

    deactivateGiveaway(guildId, messageId);
    giveawayTimers.delete(`${guildId}-${messageId}`);
  } catch (error) {
    console.error('❌ endGiveaway:', error);
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('search_bot')
    .setDescription('البحث عن بوت | Search for a bot')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('اسم البوت أو نوعه')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('language')
        .setDescription('اللغة (اختياري)')
        .addChoices(
          { name: 'العربية', value: 'ar' },
          { name: 'English', value: 'en' }
        )),
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('إنشاء سحب | Create Giveaway')
    .addStringOption(option =>
      option.setName('prize')
        .setDescription('الجائزة | Prize')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('المدة بالدقائق | Duration (minutes)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('language')
        .setDescription('اللغة | Language')
        .addChoices(
          { name: 'العربية', value: 'ar' },
          { name: 'English', value: 'en' }
        ))
    .addIntegerOption(option =>
      option.setName('winners')
        .setDescription('عدد الفائزين | Winners (default 1)'))
    .addStringOption(option =>
      option.setName('emoji')
        .setDescription('إيموجي التفاعل | Emoji (default 🎉)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('المساعدة | Help')
];

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  initDB();
  importBotsFromJSON();
  initGiveawayTable();
  
  const activeGiveaways = getActiveGiveaways();
  activeGiveaways.forEach(gw => {
    const remaining = gw.end_time - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      endGiveaway(gw.guild_id, gw.channel_id, gw.message_id, gw.prize, gw.language, gw.emoji, gw.winners_count);
    } else {
      scheduleGiveaway(gw.guild_id, gw.channel_id, gw.message_id, gw.prize, gw.language, gw.emoji, gw.winners_count, gw.end_time);
    }
  });

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(c => c.toJSON()) });
    console.log('📡 Slash commands registered');
  } catch (error) {
    console.error('❌ Command registration:', error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const msg = message.content.trim();
  const triggers = ['أبي بوت', 'بدي بوت', 'ابغى بوت', 'اقترح بوت', 'search bot', 'find bot'];
  if (triggers.some(t => msg.includes(t))) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Bot Advisor | مستشار البوتات')
      .setDescription(`أهلاً ${message.author}!\nاستخدم **/search_bot** للبحث عن أي بوت.\n\nHello! Use **/search_bot** to find any bot.`)
      .setColor(0x9B59B6)
      .setFooter({ text: 'Bot Advisor • مستشار البوتات' })
      .setTimestamp();
    await message.reply({ embeds: [embed] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'search_bot') {
    await interaction.deferReply();
    try {
      const query = interaction.options.getString('query');
      const language = interaction.options.getString('language') || 'ar';
      const results = searchBots(query.trim());

      if (results.length === 0) {
        const title = language === 'en' ? `❌ No results: ${query}` : `❌ لا نتائج: ${query}`;
        const desc = language === 'en' ? 'No bots found. Try another search!' : 'لم أجد بوتات. جرب كلمة أخرى!';
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0xFF0000)] });
        return;
      }

      const title = language === 'en' ? `🔍 Results: ${query}` : `🔍 نتائج: ${query}`;
      const desc = language === 'en' ? `Found **${results.length}** bots:` : `تم العثور على **${results.length}** بوت:`;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(0x9B59B6)
        .setFooter({ text: 'Bot Advisor' })
        .setTimestamp();

      results.forEach((bot, i) => {
        const botDesc = language === 'en' ? (bot.description_en || bot.description_ar || '...') : (bot.description_ar || bot.description_en || '...');
        embed.addFields({
          name: `${i + 1}. ${bot.bot_name}`,
          value: `📂 ${bot.bot_category}\n${botDesc.substring(0, 150)}\n[🔗 Invite | دعوة](${bot.invite_link || '#'})`,
          inline: false
        });
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ search_bot:', error);
      await interaction.editReply({ embeds: [new EmbedBuilder().setDescription('❌ خطأ داخلي!').setColor(0xFF0000)] });
    }
  }

  else if (interaction.commandName === 'giveaway') {
    await interaction.deferReply();
    try {
      const prize = interaction.options.getString('prize');
      const duration = interaction.options.getInteger('duration');
      const language = interaction.options.getString('language') || 'ar';
      const winners = interaction.options.getInteger('winners') || 1;
      const emoji = interaction.options.getString('emoji') || '🎉';
      const endTime = Math.floor(Date.now() / 1000) + (duration * 60);

      const title = language === 'en' ? `🎉 Giveaway: ${prize}` : `🎉 سحب: ${prize}`;
      const desc = language === 'en'
        ? `**Prize:** ${prize}\n**Duration:** ${duration} min\n**Winners:** ${winners}\n**React with:** ${emoji}`
        : `**الجائزة:** ${prize}\n**المدة:** ${duration} دقيقة\n**الفائزين:** ${winners}\n**تفاعل بـ:** ${emoji}`;
      const footer = language === 'en' ? 'React to enter!' : 'تفاعل للدخول!';

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(0x9B59B6)
        .addFields(
          { name: language === 'en' ? '⏰ Ends' : '⏰ ينتهي', value: `<t:${endTime}:R>`, inline: true },
          { name: language === 'en' ? '👤 Host' : '👤 المستضيف', value: interaction.user.toString(), inline: true }
        )
        .setFooter({ text: footer })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      const msg = await interaction.fetchReply();
      await msg.react(emoji);

      saveGiveaway(interaction.guildId, interaction.channelId, msg.id, prize, language, emoji, endTime, winners);
      scheduleGiveaway(interaction.guildId, interaction.channelId, msg.id, prize, language, emoji, winners, endTime);
    } catch (error) {
      console.error('❌ giveaway:', error);
      await interaction.editReply({ embeds: [new EmbedBuilder().setDescription('❌ خطأ داخلي!').setColor(0xFF0000)] });
    }
  }

  else if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('📚 المساعدة | Help')
      .setDescription('بوت مستشار البوتات والقيف أوي')
      .setColor(0x3498db)
      .addFields(
        { name: '🔍 بحث', value: '`/search_bot` - ابحث عن أي بوت', inline: false },
        { name: '🎉 سحب', value: '`/giveaway` - إنشاء قيف أوي', inline: false },
        { name: '💬 شات', value: "اكتب 'أبي بوت' أو 'find bot'", inline: false }
      )
      .setFooter({ text: 'Bot Advisor • شغال 24 ساعة' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN not found');
  process.exit(1);
}

client.login(TOKEN);