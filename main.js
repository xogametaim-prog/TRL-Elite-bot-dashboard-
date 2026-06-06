// ==================== main.js ====================
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const { getAIResponseWithMemory } = require('./gemini.js');

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

// ==================== Giveaway System ====================
const activeGiveaways = new Map();

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
      console.error('❌ Failed to fetch giveaway message:', e.message);
      activeGiveaways.delete(`${guildId}-${messageId}`);
      return;
    }

    const reaction = msg.reactions.cache.get(emoji);
    if (!reaction) {
      const embed = new EmbedBuilder()
        .setTitle(language === 'en' ? '🎉 Giveaway Ended' : '🎉 انتهى السحب')
        .setDescription(language === 'en' ? `No reactions found for: **${prize}**` : `لم يتم العثور على تفاعلات لـ: **${prize}**`)
        .setColor(0xFF0000);
      await msg.reply({ embeds: [embed] });
      activeGiveaways.delete(`${guildId}-${messageId}`);
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
      activeGiveaways.delete(`${guildId}-${messageId}`);
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
    activeGiveaways.delete(`${guildId}-${messageId}`);
    console.log(`✅ Giveaway ended: ${prize} - Winner: ${winner.username}`);
  } catch (error) {
    console.error('❌ endGiveaway:', error.message);
  }
}

// ==================== Guess Game System ====================
const activeGames = new Map();
const fakePlayers = [
  { name: '🎮 Gamer_Bot', guesses: [] },
  { name: '🤖 AI_Player', guesses: [] },
  { name: '🍀 Lucky_Bot', guesses: [] }
];

function getSmartGuess(previousGuesses) {
  const availableNumbers = [];
  for (let i = 1; i <= 100; i++) {
    if (!previousGuesses.includes(i)) availableNumbers.push(i);
  }
  if (availableNumbers.length === 0) return Math.floor(Math.random() * 100) + 1;
  return availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
}

async function startGuessGame(channel, language) {
  const secretNumber = Math.floor(Math.random() * 100) + 1;
  const allGuesses = [];
  
  const gameData = {
    secretNumber, language, channel,
    participants: new Set(),
    fakeIntervals: [],
    ended: false,
    allGuesses
  };

  activeGames.set(channel.id, gameData);

  const title = language === 'en' ? '🎯 Guess the Number!' : '🎯 خمن الرقم!';
  const desc = language === 'en'
    ? `I picked a number between **1 and 100**!\nType your guesses in chat.\nYou have **60 seconds**!\n\n🤖 Fake players will also join!`
    : `اخترت رقم بين **1 و 100**!\nاكتب تخمينك في الشات.\nأمامك **60 ثانية**!\n\n🤖 لاعبين وهميين راح ينافسوكم!`;

  await channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x00FF00).setFooter({ text: language === 'en' ? 'Good luck! 🍀' : 'بالتوفيق! 🍀' })] });

  fakePlayers.forEach(p => p.guesses = []);

  fakePlayers.forEach((player, index) => {
    const interval = setInterval(() => {
      if (gameData.ended) { clearInterval(interval); return; }
      
      const fakeGuess = getSmartGuess(gameData.allGuesses);
      player.guesses.push(fakeGuess);
      gameData.allGuesses.push(fakeGuess);
      
      const messages = language === 'en' 
        ? [`I think it's **${fakeGuess}**!`, `Hmm... **${fakeGuess}**?`, `Let me try **${fakeGuess}**!`]
        : [`أتوقع **${fakeGuess}**!`, `يمكن **${fakeGuess}**؟`, `خليني أجرب **${fakeGuess}**!`];
      
      channel.send(`${player.name}: ${messages[Math.floor(Math.random() * messages.length)]}`);
      
      if (fakeGuess === secretNumber) {
        gameData.ended = true;
        activeGames.delete(channel.id);
        gameData.fakeIntervals.forEach(i => clearInterval(i));
        const t = language === 'en' ? '🤖 AI Wins!' : '🤖 الذكاء الاصطناعي يفوز!';
        const d = language === 'en' ? `**${player.name}** guessed **${secretNumber}**!\nBetter luck humans!` : `**${player.name}** خمن **${secretNumber}**!\nحظ أوفر للبشر!`;
        channel.send({ embeds: [new EmbedBuilder().setTitle(t).setDescription(d).setColor(0xFF0000)] });
      }
    }, 8000 + (index * 2000));
    gameData.fakeIntervals.push(interval);
  });

  setTimeout(() => {
    if (!gameData.ended) {
      gameData.ended = true;
      gameData.fakeIntervals.forEach(i => clearInterval(i));
      activeGames.delete(channel.id);
      const t = language === 'en' ? '⏰ Time\'s Up!' : '⏰ انتهى الوقت!';
      const d = language === 'en' ? `No one guessed **${secretNumber}**!` : `لم يخمن أحد **${secretNumber}**!`;
      channel.send({ embeds: [new EmbedBuilder().setTitle(t).setDescription(d).setColor(0xFFA500)] });
    }
  }, 60000);
}

// ==================== Slash Commands ====================
const commands = [
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('إنشاء سحب | Create Giveaway')
    .addStringOption(o => o.setName('prize').setDescription('الجائزة | Prize').setRequired(true))
    .addIntegerOption(o => o.setName('duration').setDescription('المدة بالدقائق | Duration (minutes)').setRequired(true))
    .addStringOption(o => o.setName('language').setDescription('اللغة | Language').addChoices({ name: 'العربية', value: 'ar' }, { name: 'English', value: 'en' }))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي التفاعل | Emoji (default 🎉)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  new SlashCommandBuilder()
    .setName('guess_game')
    .setDescription('لعبة تخمين الرقم | Guess the Number Game')
    .addStringOption(o => o.setName('language').setDescription('اللغة | Language').addChoices({ name: 'العربية', value: 'ar' }, { name: 'English', value: 'en' })),
  
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
  } catch (e) { console.error('❌ Command registration:', e.message); }
  console.log('✅ Bot is ready!');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const game = activeGames.get(message.channel.id);
  if (game && !game.ended) {
    const guess = parseInt(message.content.trim());
    if (!isNaN(guess) && guess >= 1 && guess <= 100) {
      game.participants.add(message.author.id);
      if (!game.allGuesses.includes(guess)) game.allGuesses.push(guess);
      if (guess === game.secretNumber) {
        game.ended = true;
        game.fakeIntervals.forEach(i => clearInterval(i));
        activeGames.delete(message.channel.id);
        const t = game.language === 'en' ? '🎉 Winner!' : '🎉 فائز!';
        const d = game.language === 'en' ? `**${message.author}** guessed **${game.secretNumber}**! 🏆` : `**${message.author}** خمن **${game.secretNumber}**! 🏆`;
        await message.channel.send({ embeds: [new EmbedBuilder().setTitle(t).setDescription(d).setColor(0xFFD700)] });
      }
    }
    return;
  }

  const isMentioned = message.mentions.has(client.user);
  const isAiChannel = message.channel.name === 'ai-chat';

  if (isMentioned || isAiChannel) {
    await message.channel.sendTyping();
    const cleanMessage = message.content.replace(`<@${client.user.id}>`, '').trim();
    if (!cleanMessage) {
      await message.reply({ content: 'نعم؟ كيف أقدر أساعدك؟ | Yes? How can I help you?' });
      return;
    }
    const aiResponse = await getAIResponseWithMemory(message.author.id, cleanMessage);
    if (aiResponse) {
      const chunks = aiResponse.match(/[\s\S]{1,2000}/g) || [];
      for (const chunk of chunks) {
        await message.reply({ content: chunk, allowedMentions: { repliedUser: false } });
      }
    } else {
      await message.reply('❌ عذراً، حصل خطأ. جرب مرة أخرى.');
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
      const desc = language === 'en' ? `**Prize:** ${prize}\n**Duration:** ${duration} min\n**React with:** ${emoji}` : `**الجائزة:** ${prize}\n**المدة:** ${duration} دقيقة\n**تفاعل بـ:** ${emoji}`;
      const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x9B59B6).addFields({ name: language === 'en' ? '⏰ Ends' : '⏰ ينتهي', value: `<t:${endTime}:R>`, inline: true }, { name: language === 'en' ? '👤 Host' : '👤 المستضيف', value: interaction.user.toString(), inline: true }).setFooter({ text: language === 'en' ? 'React to enter!' : 'تفاعل للدخول!' });
      await interaction.editReply({ embeds: [embed] });
      const msg = await interaction.fetchReply();
      await msg.react(emoji);
      const timer = setTimeout(() => endGiveaway(interaction.guildId, interaction.channelId, msg.id, prize, language, emoji), duration * 60 * 1000);
      activeGiveaways.set(`${interaction.guildId}-${msg.id}`, timer);
    } catch (e) {
      console.error('❌ giveaway:', e.message);
      await interaction.editReply({ embeds: [new EmbedBuilder().setDescription('❌ خطأ داخلي!').setColor(0xFF0000)] });
    }
  }

  else if (interaction.commandName === 'guess_game') {
    const language = interaction.options.getString('language') || 'ar';
    if (activeGames.has(interaction.channel.id)) {
      await interaction.reply({ content: language === 'en' ? '❌ Game already active!' : '❌ هناك لعبة نشطة!', ephemeral: true });
      return;
    }
    await interaction.reply({ content: language === 'en' ? '🎯 Starting! 🍀' : '🎯 بدء اللعبة! 🍀' });
    await startGuessGame(interaction.channel, language);
  }

  else if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('📚 المساعدة | Help')
      .setDescription('بوت متكامل مع AI، قيف أوي، وألعاب')
      .setColor(0x3498db)
      .addFields({ name: '🤖 AI Chat', value: 'منشن البوت أو اكتب في روم `ai-chat`', inline: false }, { name: '🎉 سحب', value: '`/giveaway`', inline: false }, { name: '🎯 لعبة', value: '`/guess_game`', inline: false })
      .setFooter({ text: 'Bot • شغال 24 ساعة' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.on('error', (e) => console.error('❌ Client error:', e.message));
process.on('unhandledRejection', (e) => console.error('❌ Unhandled rejection:', e.message));

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('❌ DISCORD_TOKEN not found'); process.exit(1); }
client.login(TOKEN).then(() => console.log('🚀 Bot connecting...')).catch(e => { console.error('❌ Login failed:', e.message); process.exit(1); });