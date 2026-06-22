const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
const commandsData = [];

// قراءة الأوامر من مجلد commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const cmds = require(`./commands/${file}`);
  for (const key in cmds) {
    client.commands.set(key, cmds[key]);
    if (cmds[key].data) {
      commandsData.push(cmds[key].data.toJSON());
    }
  }
}

// تسجيل أوامر السلاش عند التشغيل فوراً بشكل عام (Global) لجميع السيرفرات
client.once('ready', async () => {
  console.log(`🤖 ${client.user.username} is online and ready for all servers!`);
  
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN || config.token);
  try {
    console.log('🔄 Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandsData });
    console.log('✅ Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

// حدث عند دخول البوت لسيرفر جديد (إنشاء رتبة وإرسال الإيمبد)
client.on('guildCreate', async (guild) => {
  try {
    // 1. إنشاء رتبة التحكم بالبوت
    const controlRole = await guild.roles.create({
      name: 'System Control',
      color: '#ff0000',
      reason: 'رتبة التحكم بإعدادات وأوامر بوت system bot for all',
    });

    // 2. البحث عن أعلى رتبة في السيرفر لمنشنته (باستثناء البوت نفسه)
    const highestRole = guild.roles.cache
      .filter(r => r.id !== guild.roles.everyone.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .first();

    // 3. البحث عن أول روم يمدي البوت يرسل فيها رسالة
    const channel = guild.channels.cache
      .filter(c => c.type === 0 && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages))
      .first();

    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('📥 تم دخول البوت بنجاح! | system bot for all')
        .setDescription(`مرحباً بكم في نظام الإدارة الشامل.\n\n🛠️ تم إنشاء رتبة جديدة باسم **${controlRole}** تلقائياً، يمكنك إعطاؤها لمن تريد ليتحكم بكامل أوامر البوت.\n\n🌐 **لوحة التحكم (Dashboard):** قريباً .`)
        .setColor('#00ffcc')
        .setTimestamp();

      const mentionMsg = highestRole ? `👋 منشن لأعلى رتبة في السيرفر: ${highestRole}` : '👋 مرحباً بإدارة السيرفر!';
      await channel.send({ content: mentionMsg, embeds: [embed] });
    }
  } catch (err) {
    console.error('حدث خطأ أثناء إعدادات دخول السيرفر:', err);
  }
});

// التعامل مع أوامر السلاش
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // التحقق من الصلاحية: يجب أن يمتلك العضو صلاحية Administrator أو يمتلك رتبة System Control
  const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  const hasRole = interaction.member.roles.cache.some(r => r.name === 'System Control');

  if (interaction.commandName !== 'info' && !hasAdmin && !hasRole) {
    return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة أو لمن يمتلك رتبة `System Control` فقط!', ephemeral: true });
  }

  try {
    await command.executeSlash(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر السلاش.', ephemeral: true });
  }
});

// التعامل مع اختصارات الشات المباشرة (بدون بريفكس وبدون علامات)
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const text = message.content.trim().toLowerCase();
  const args = text.split(/ +/);
  const firstWord = args.shift();

  // البحث عن الأمر من خلال الاسم أو الاختصار المباشر
  const command = client.commands.find(cmd => cmd.name === firstWord || (cmd.shortcuts && cmd.shortcuts.includes(firstWord)));
  if (!command) return;

  // التحقق من الصلاحية
  const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
  const hasRole = message.member.roles.cache.some(r => r.name === 'System Control');

  if (command.name !== 'info' && !hasAdmin && !hasRole) {
    return message.reply('❌ هذا الأمر مخصص للإدارة أو لمن يمتلك رتبة `System Control` فقط!');
  }

  try {
    // تحويل الوسائط العادية لتتوافق مع كود التشغيل للمسج
    await command.executeMessage(message, args);
  } catch (error) {
    console.error(error);
    message.reply('❌ حدث خطأ أثناء تنفيذ هذا الاختصار.');
  }
});

client.login(process.env.TOKEN || config.token);
