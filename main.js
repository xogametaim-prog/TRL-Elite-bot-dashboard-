// ==================== main.js ====================
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');

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

// ==================== Gemini AI Setup ====================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const aiModel = genAI ? genAI.getGenerativeModel({ model: 'gemini-pro' }) : null;

const aiChatHistory = new Map();

async function getAIResponse(userMessage, userId, userName) {
  if (!aiModel) return null;
  try {
    if (!aiChatHistory.has(userId)) {
      aiChatHistory.set(userId, []);
    }
    const history = aiChatHistory.get(userId);
    history.push({ role: 'user', parts: [{ text: `[${userName}]: ${userMessage}` }] });
    if (history.length > 20) history.shift();

    const chat = aiModel.startChat({
      history: history.slice(0, -1),
      generationConfig: { maxOutputTokens: 500, temperature: 0.8 }
    });

    const result = await chat.sendMessage(userMessage);
    const response = result.response.text();
    history.push({ role: 'model', parts: [{ text: response }] });
    aiChatHistory.set(userId, history);
    return response;
  } catch (error) {
    console.error('❌ Gemini API Error:', error);
    return null;
  }
}

// ==================== Giveaway System ====================
const giveawayTimers = new Map();

async function endGiveaway(guildId, channelId, messageId, prize, language, emoji) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    let msg;
    try {
      msg = await channel.messages.fetch(messageId);
    } catch (e) {
      console.error('Failed to fetch giveaway message:', e);
      return;
    }

    const reaction = msg.reactions.cache.get(emoji);
    if (!reaction) {
      const embed = new EmbedBuilder()
        .setTitle(language === 'en' ? '🎉 Giveaway Ended' : '🎉 انتهى السحب')
        .setDescription(language === 'en' ? `No reactions found for: **${prize}**` : `لم يتم العثور على تفاعلات لـ: **${prize}**`)
        .setColor(0xFF0000);
      await msg.reply({ embeds: [embed] });
      giveawayTimers.delete(`${guildId}-${messageId}`);
      return;
    }

    const users = await reaction.users.fetch();
    const candidates = users.filter(u => !u.bot);

    if (candidates.size === 0) {
      const embed = new EmbedBuilder()
        .setTitle(language === 'en' ? '🎉 Giveaway Ended' : '🎉 انتهى السحب')
        .setDescription(language === 'en' ? `No participants for: **${prize}**` : `لا يوجد مشاركين في: **${prize}**`)
        .setColor(0xFF0000);
      await msg.reply({ embeds: [embed] });
      giveawayTimers.delete(`${guildId}-${messageId}`);
      return;
    }

    const candidatesArray = Array.from(candidates.values());
    const winner = candidatesArray[Math.floor(Math.random() * candidatesArray.length)];

    let title, desc;
    if (language === 'en') {
      title = `🎉 Giveaway Ended: ${prize}`;
      desc = `**Congratulations!** ${winner}\nYou won: **${prize}**!`;
    } else {
      title = `🎉 انتهى السحب: ${prize}`;
      desc = `**مبروك!** ${winner}\nلقد فزت في سحب: **${prize}**!`;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(desc)
      .setColor(0xFFD700)
      .setTimestamp();

    await msg.reply({ embeds: [embed] });
    giveawayTimers.delete(`${guildId}-${messageId}`);
  } catch (error) {
    console.error('❌ endGiveaway:', error);
  }
}

// ==================== Guess Game System ====================
const activeGames = new Map();
const fakePlayers = [
  { name: 'Gamer_Bot', id: 'fake_1' },
  { name: 'AI_Player', id: 'fake_2' },
  { name: 'Lucky_Bot', id: 'fake_3' }
];

async function startGuessGame(channel, language) {
  const secretNumber = Math.floor(Math.random() * 100) + 1;
  const gameData = {
    secretNumber,
    language,
    channel,
    participants: new Set(),
    fakeIntervals: [],
    ended: false
  };

  activeGames.set(channel.id, gameData);

  const title = language === 'en' ? '🎯 Guess the Number!' : '🎯 خمن الرقم!';
  const desc = language === 'en'
    ? `I picked a number between **1 and 100**!\nType your guesses in chat.\nYou have **60 seconds**!`
    : `اخترت رقم بين **1 و 100**!\nاكتب تخمينك في الشات.\nأمامك **60 ثانية**!`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x00FF00)
    .setFooter({ text: language === 'en' ? 'Good luck!' : 'بالتوفيق!' });

  await channel.send({ embeds: [embed] });

  // Fake AI players
  fakePlayers.forEach(player => {
    const interval = setInterval(() => {
      if (gameData.ended) {
        clearInterval(interval);
        return;
      }
      const fakeGuess = Math.floor(Math.random() * 100) + 1;
      channel.send(`🤖 **${player.name}**: ${language === 'en' ? 'I guess' : 'أخمن'} **${fakeGuess}**!`);
      if (fakeGuess === secretNumber) {
        gameData.ended = true;
        activeGames.delete(channel.id);
        gameData.fakeIntervals.forEach(i => clearInterval(i));
        const winTitle = language === 'en' ? '🤖 AI Wins!' : '🤖 الذكاء الاصطناعي يفوز!';
        const winDesc = language === 'en'
          ? `**${player.name}** guessed the number **${secretNumber}** correctly!\nBetter luck next time humans!`
          : `**${player.name}** خمن الرقم **${secretNumber}** بشكل صحيح!\nحظ أوفر للبشر المرة القادمة!`;
        const winEmbed = new EmbedBuilder()
          .setTitle(winTitle)
          .setDescription(winDesc)
          .setColor(0xFF0000);
        channel.send({ embeds: [winEmbed] });
      }
    }, 10000);
    gameData.fakeIntervals.push(interval);
  });

  setTimeout(() => {
    if (!gameData.ended) {
      gameData.ended = true;
      gameData.fakeIntervals.forEach(i => clearInterval(i));
      activeGames.delete(channel.id);
      const endTitle = language === 'en' ? '⏰ Time\'s Up!' : '⏰ انتهى الوقت!';
      const endDesc = language === 'en'
        ? `No one guessed the number **${secretNumber}**!\nBetter luck next time!`
        : `لم يخمن أحد الرقم **${secretNumber}**!\nحظ أوفر المرة القادمة!`;
      const endEmbed = new EmbedBuilder()
        .setTitle(endTitle)
        .setDescription(endDesc)
        .setColor(0xFFA500);
      channel.send({ embeds: [endEmbed] });
    }
  }, 60000);
}

// ==================== Slash Commands ====================
const commands = [
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
    .addStringOption(option =>
      option.setName('emoji')
        .setDescription('إيموجي التفاعل | Emoji (default 🎉)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('guess_game')
    .setDescription('لعبة تخمين الرقم | Guess the Number Game')
    .addStringOption(option =>
      option.setName('language')
        .setDescription('اللغة | Language')
        .addChoices(
          { name: 'العربية', value: 'ar' },
          { name: 'English', value: 'en' }
        )),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('المساعدة | Help')
];

// ==================== Events ====================
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(c => c.toJSON()) });
    console.log('📡 Slash commands registered');
  } catch (error) {
    console.error('❌ Command registration:', error);
  }

  console.log('✅ Bot is ready!');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Guess game listener
  const game = activeGames.get(message.channel.id);
  if (game && !game.ended) {
    const guess = parseInt(message.content.trim());
    if (!isNaN(guess) && guess >= 1 && guess <= 100) {
      game.participants.add(message.author.id);
      if (guess === game.secretNumber) {
        game.ended = true;
        game.fakeIntervals.forEach(i => clearInterval(i));
        activeGames.delete(message.channel.id);
        const title = game.language === 'en' ? '🎉 Winner!' : '🎉 فائز!';
        const desc = game.language === 'en'
          ? `**${message.author}** guessed the number **${game.secretNumber}** correctly!\nCongratulations!`
          : `**${message.author}** خمن الرقم **${game.secretNumber}** بشكل صحيح!\nمبروك!`;
        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(desc)
          .setColor(0xFFD700);
        await message.channel.send({ embeds: [embed] });
      }
    }
    return;
  }

  // AI Chat: mention or ai-chat channel
  const isMentioned = message.mentions.has(client.user);
  const isAiChannel = message.channel.name === 'ai-chat';

  if (isMentioned || isAiChannel) {
    if (!aiModel) {
      await message.reply('❌ AI is not configured. Please set GEMINI_API_KEY.');
      return;
    }

    await message.channel.sendTyping();
    const aiResponse = await getAIResponse(message.content, message.author.id, message.author.displayName);
    if (aiResponse) {
      const chunks = aiResponse.match(/[\s\S]{1,2000}/g) || [];
      for (const chunk of chunks) {
        await message.reply({ content: chunk, allowedMentions: { repliedUser: false } });
      }
    } else {
      await message.reply('❌ Sorry, I could not generate a response. Please try again.');
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'giveaway') {
    await interaction.deferReply();
    try {
      const prize = interaction.options.getString('prize');
      const duration = interaction.options.getInteger('duration');
      const language = interaction.options.getString('language') || 'ar';
      const emoji = interaction.options.getString('emoji') || '🎉';
      const endTime = Math.floor(Date.now() / 1000) + (duration * 60);

      const title = language === 'en' ? `🎉 Giveaway: ${prize}` : `🎉 سحب: ${prize}`;
      const desc = language === 'en'
        ? `**Prize:** ${prize}\n**Duration:** ${duration} min\n**React with:** ${emoji}`
        : `**الجائزة:** ${prize}\n**المدة:** ${duration} دقيقة\n**تفاعل بـ:** ${emoji}`;
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

      const timer = setTimeout(() => {
        endGiveaway(interaction.guildId, interaction.channelId, msg.id, prize, language, emoji);
      }, duration * 60 * 1000);
      giveawayTimers.set(`${interaction.guildId}-${msg.id}`, timer);
    } catch (error) {
      console.error('❌ giveaway:', error);
      await interaction.editReply({ embeds: [new EmbedBuilder().setDescription('❌ Internal error!').setColor(0xFF0000)] });
    }
  }

  else if (interaction.commandName === 'guess_game') {
    const language = interaction.options.getString('language') || 'ar';
    const channel = interaction.channel;

    if (activeGames.has(channel.id)) {
      const msg = language === 'en' ? '❌ A game is already active in this channel!' : '❌ هناك لعبة نشطة بالفعل في هذه القناة!';
      await interaction.reply({ content: msg, ephemeral: true });
      return;
    }

    const confirmMsg = language === 'en' ? '🎯 Starting Guess the Number game!' : '🎯 بدء لعبة تخمين الرقم!';
    await interaction.reply({ content: confirmMsg });
    await startGuessGame(channel, language);
  }

  else if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('📚 المساعدة | Help')
      .setDescription('بوت متكامل مع AI، قيف أوي، وألعاب')
      .setColor(0x3498db)
      .addFields(
        { name: '🤖 AI Chat', value: 'منشن البوت أو اكتب في روم `ai-chat`', inline: false },
        { name: '🎉 سحب', value: '`/giveaway` - إنشاء قيف أوي', inline: false },
        { name: '🎯 لعبة', value: '`/guess_game` - لعبة تخمين الرقم', inline: false }
      )
      .setFooter({ text: 'Bot • شغال 24 ساعة' })
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