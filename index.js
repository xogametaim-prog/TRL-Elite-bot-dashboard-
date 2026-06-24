/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                      SYSTEM BOT - MAIN FILE                          ║
 * ║         Developed by Taim (Lead Developer & Founder)                 ║
 * ║                Powered & Secured by TRL.dev Team                     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  REST, 
  Routes, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  ChannelType,
  SlashCommandBuilder // تم إضافتها هنا بشكل صحيح ومضمون
} = require('discord.js');
const fs = require('fs');
const http = require('http');

// [1] تشغيل سيرفر ويب وهمي لضمان استمرارية البوت 24 ساعة على ريندر دون توقف
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TRL.dev System Bot Is Fully Operational and Live! 🚀\n');
});
server.listen(process.env.PORT || 3000, () => {
  console.log('🌐 Web Server generated for Uptime Robot pinging.');
});

// [2] إعداد الجلسة وتفعيل الـ Intents الكاملة لقراءة الرسائل والأعضاء
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// جلب التوكن وآيدي البوت
const TOKEN = process.env.TOKEN; 
const CLIENT_ID = "1254845579979329618"; 

// دالة جلب وحفظ البيانات من ملف db.json بشكل آمن وضمان عدم الضياع
function getDB() { 
  try {
    return JSON.parse(fs.readFileSync('./db.json', 'utf8')); 
  } catch(e) {
    return { warns: {}, vouchers: {}, replies: {}, tickets: {}, ticketConfig: {}, userMessages: {}, levelConfig: {} };
  }
}
function saveDB(db) { fs.writeFileSync('./db.json', JSON.stringify(db, null, 2)); }

// [3] بناء مصفوفة الأوامر (Slash Commands Data)
const commandsData = [
  // أمر إعداد التذاكر بالقائمة المنسدلة والصور المخصصة للـ Admin
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('إعداد لوحة التكتات بقائمة منسدلة احترافية مع دعم الصور')
    .addStringOption(o => o.setName('title').setRequired(true).setDescription('عنوان اللوحة الإيمبد'))
    .addStringOption(o => o.setName('description').setRequired(true).setDescription('وصف اللوحة والتعليمات'))
    .addStringOption(o => o.setName('options').setRequired(true).setDescription('الأقسام تفصل بينها بفاصلة (مثال: دعم فني,شكاوي,استفسار)'))
    .addRoleOption(o => o.setName('staff-role').setRequired(true).setDescription('الرتبة المسؤول عن استلام هذه التذاكر'))
    .addStringOption(o => o.setName('image').setDescription('رابط الصورة المخصصة للوحة (اختياري)')).toJSON(),

  // أمر الـ Embed المطور لإرسال الرسائل المنظمة مع بوكس مخصص للصورة
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('إرسال رسالة إيمبد مخصصة مع بوكس للصورة للادارة')
    .addStringOption(o => o.setName('title').setRequired(true).setDescription('عنوان الرسالة'))
    .addStringOption(o => o.setName('description').setRequired(true).setDescription('محتوى الرسالة ووصفها'))
    .addStringOption(o => o.setName('image').setDescription('رابط الصورة (Image URL)')).toJSON(),

  // أمر ليفلات الرسائل والـ 10 رتب التفاعلية للأعضاء
  new SlashCommandBuilder()
    .setName('setup-levels')
    .setDescription('إعداد نظام الرتب لـ 10 رتب مخصصة حسب عدد الرسائل')
    .addChannelOption(o => o.setName('log-channel').setRequired(true).setDescription('روم إرسال التبريكات بالترقية'))
    .addRoleOption(o => o.setName('role1').setRequired(true).setDescription('الرتبة 1')).addIntegerOption(o => o.setName('messages1').setRequired(true).setDescription('رسائل 1'))
    .addRoleOption(o => o.setName('role2').setDescription('الرتبة 2')).addIntegerOption(o => o.setName('messages2').setDescription('رسائل 2'))
    .addRoleOption(o => o.setName('role3').setDescription('الرتبة 3')).addIntegerOption(o => o.setName('messages3').setDescription('رسائل 3'))
    .addRoleOption(o => o.setName('role4').setDescription('الرتبة 4')).addIntegerOption(o => o.setName('messages4').setDescription('رسائل 4'))
    .addRoleOption(o => o.setName('role5').setDescription('الرتبة 5')).addIntegerOption(o => o.setName('messages5').setDescription('رسائل 5'))
    .addRoleOption(o => o.setName('role6').setDescription('الرتبة 6')).addIntegerOption(o => o.setName('messages6').setDescription('رسائل 6'))
    .addRoleOption(o => o.setName('role7').setDescription('الرتبة 7')).addIntegerOption(o => o.setName('messages7').setDescription('رسائل 7'))
    .addRoleOption(o => o.setName('role8').setDescription('الرتبة 8')).addIntegerOption(o => o.setName('messages8').setDescription('رسائل 8'))
    .addRoleOption(o => o.setName('role9').setDescription('الرتبة 9')).addIntegerOption(o => o.setName('messages9').setDescription('رسائل 9'))
    .addRoleOption(o => o.setName('role10').setDescription('الرتبة 10')).addIntegerOption(o => o.setName('messages10').setDescription('رسائل 10')).toJSON(),

  // أمر الفاوتشر لتحديد روم سجل العمليات الإدارية
  new SlashCommandBuilder()
    .setName('voucher')
    .setDescription('تحديد روم الحالية لتكون روم سجل العمليات الإدارية')
    .addChannelOption(o => o.setName('channel').setRequired(true).setDescription('الروم المخصصة')).toJSON(),

  // أمر معلومات المطور الشخصي لـ تيم و TRL.dev
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('عرض ملف المطور الشخصي لـ تيم والمعلومات الأساسية لـ TRL.dev').toJSON()
];

// [4] حدث إقلاع البوت وتسجيل الأوامر تلقائياً فورياً بالسيرفرات
client.once('ready', async () => {
  console.log(`✨ [TRL.dev] Connected successfully as: ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('⏳ Syncing and registering application (/) commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsData });
    console.log('🎉 All Commands Synced Perfectly on Discord Guilds!');
  } catch (error) { console.error('❌ Sync Error:', error); }
});

// [5] استقبال التفاعلات (أوامر السلاش، القوائم المنسدلة، أزرار التكتات)
client.on('interactionCreate', async interaction => {
  const db = getDB();
  const guildId = interaction.guild?.id;

  // أ) معالجة أوامر السلاش التنفيذية مع نظام الحماية الصارم
  if (interaction.isChatInputCommand()) {
    const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasControlRole = interaction.member.roles.cache.some(r => r.name === 'System Control');
    
    if (interaction.commandName !== 'info' && !hasAdmin && !hasControlRole) {
      return interaction.reply({ content: '❌ عذراً! هذا الأمر مخصص فقط للإدارة العليا أو لمن يمتلك رتبة `System Control`.', ephemeral: true });
    }

    // أمر الـ setup-ticket المطور بالقوائم والصور
    if (interaction.commandName === 'setup-ticket') {
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const img = interaction.options.getString('image');
      const staffRole = interaction.options.getRole('staff-role');
      const rawOptions = interaction.options.getString('options').split(',');

      if (!db.ticketConfig) db.ticketConfig = {};
      if (!db.ticketConfig[guildId]) db.ticketConfig[guildId] = {};

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`ticket_select_${guildId}`)
        .setPlaceholder('Choose an option... 🎫');

      rawOptions.forEach((opt, index) => {
        const trimmed = opt.trim();
        if (trimmed.length > 0) {
          const valueId = `opt_${index}_${Date.now()}`;
          selectMenu.addOptions({ label: trimmed, description: `اضغط لفتح تذكرة في قسم ${trimmed}`, value: valueId });
          db.ticketConfig[guildId][valueId] = { roleId: staffRole.id, name: trimmed };
        }
      });
      saveDB(db);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#2f3136');
      if (img && (img.startsWith('http://') || img.startsWith('https://'))) embed.setImage(img);

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ تم إنشاء لوحة التكتات المنسدلة بنجاح فائق!', ephemeral: true });
    }

    // أمر الإيمبد والصور العام للادارة
    if (interaction.commandName === 'embed') {
      const embed = new EmbedBuilder()
        .setTitle(interaction.options.getString('title'))
        .setDescription(interaction.options.getString('description'))
        .setColor('#5865F2')
        .setTimestamp();
      const img = interaction.options.getString('image');
      if (img && (img.startsWith('http://') || img.startsWith('https://'))) embed.setImage(img);

      await interaction.channel.send({ embeds: [embed] });
      return interaction.reply({ content: '✅ تم إرسال رسالة الإيمبد بنجاح مذهل!', ephemeral: true });
    }

    // أمر نظام الـ 10 ليفلات
    if (interaction.commandName === 'setup-levels') {
      const logChannel = interaction.options.getChannel('log-channel');
      if (!db.levelConfig) db.levelConfig = {};
      db.levelConfig[guildId] = { channelId: logChannel.id, roles: [] };

      for (let i = 1; i <= 10; i++) {
        const role = interaction.options.getRole(`role${i}`);
        const msgs = interaction.options.getInteger(`messages${i}`);
        if (role && msgs) db.levelConfig[guildId].roles.push({ roleId: role.id, requiredMessages: msgs });
      }
      db.levelConfig[guildId].roles.sort((a, b) => a.requiredMessages - b.requiredMessages);
      saveDB(db);
      return interaction.reply({ content: `✅ تم تفعيل إعدادات الـ 10 ليفلات بنجاح وروم الإرسال: ${logChannel}`, ephemeral: true });
    }

    // أمر الفاوتشر
    if (interaction.commandName === 'voucher') {
      const channel = interaction.options.getChannel('channel');
      if (!db.vouchers) db.vouchers = {}; db.vouchers[guildId] = channel.id; saveDB(db);
      return interaction.reply(`✅ تم اعتماد الروم ${channel} لتكون روم الـ **voucher log**.`);
    }

    // أمر معلومات المطور تيم
    if (interaction.commandName === 'info') {
      const embed = new EmbedBuilder()
        .setTitle('📋 ملف المطور الشخصي والمعلومات الأساسية')
        .setColor('#5865F2')
        .addFields(
          { name: '👤 الاسم المطور', value: 'تيم (Taim) - Lead Developer', inline: true },
          { name: '⚡ الفريق والمنظمة', value: 'مؤسس وقائد فريق TRL.dev و مجتمع BRQ 🎉', inline: true },
          { name: '🛠️ التخصص التقني', value: '• هندسة وبرمجة بوتات ديسكورد المتقدمة وتطوير صفحات الويب والأنظمة الذكية.' }
        )
        .setFooter({ text: 'system bot for all • Developed beautifully by TRL.dev' });
      return interaction.reply({ embeds: [embed] });
    }
  }

  // ب) فتح التذكرة الذكية عند الاختيار من القائمة المنسدلة للأعضاء
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_select_')) {
    const userId = interaction.user.id;
    const selectedValue = interaction.values[0];

    if (!db.tickets) db.tickets = {};
    const hasOpenTicket = Object.values(db.tickets).some(t => t.ownerId === userId && t.guildId === guildId && t.status === 'open');
    if (hasOpenTicket) return interaction.reply({ content: '❌ عذراً! لا يمكنك فتح أكثر من تذكرة مفعلة في نفس الوقت.', ephemeral: true });

    const configData = db.ticketConfig?.[guildId]?.[selectedValue];
    if (!configData) return interaction.reply({ content: '❌ فشل العثور على القسم المطلوب بقاعدة البيانات.', ephemeral: true });

    const { roleId, name: sectionName } = configData;

    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${sectionName}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
        ...(roleId ? [{ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
      ]
    });

    db.tickets[ticketChannel.id] = { guildId, ownerId: userId, claimedBy: null, status: 'open', roleId: roleId };
    saveDB(db);

    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التكت 🛡️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التكت 🔒').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ping_owner').setLabel('نداء العضو 🔔').setStyle(ButtonStyle.Secondary)
    );

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 تذكرة جديدة مخصصة | قسم: ${sectionName}`)
      .setDescription(`مرحباً بك ${interaction.user} في تذكرتك المفتوحة حديثاً.\nالرجاء كتابة تفاصيل استفسارك بوضوح تام لحين حضور الطاقم الإداري المسؤول.\n\n⚠️ **الدعم المسؤول:** <@&${roleId}>`)
      .setColor('#3498db')
      .setTimestamp();

    await ticketChannel.send({ content: `${interaction.user} | <@&${roleId}>`, embeds: [welcomeEmbed], components: [controlRow] });
    return interaction.reply({ content: `✅ تم فتح تذكرتك بنجاح فائق في: ${ticketChannel}`, ephemeral: true });
  }

  // ج) معالجة أزرار التحكم داخل التكت (قفل الإغلاق للعضو العادي)
  if (interaction.isButton()) {
    const channelId = interaction.channel.id;
    const ticket = db.tickets?.[channelId];
    if (!ticket) return;

    const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasTicketRole = ticket.roleId ? interaction.member.roles.cache.has(ticket.roleId) : interaction.member.roles.cache.some(r => r.name === 'System Control');

    if (interaction.customId === 'claim_ticket') {
      if (!hasAdmin && !hasTicketRole) return interaction.reply({ content: '❌ ليس لديك الصلاحية لاستلام التذكرة ومتابعتها!', ephemeral: true });
      ticket.claimedBy = interaction.user.id; saveDB(db);
      await interaction.reply({ content: `🛡️ تم استلام التذكرة بنجاح وجاري المتابعة من قِبل المسؤول: ${interaction.user}` });
    }

    if (interaction.customId === 'close_ticket') {
      if (!hasAdmin && !hasTicketRole) return interaction.reply({ content: '❌ خطأ أمني: زر الإغلاق مخصص حصرياً لطاقم الإدارة المسؤول فقط!', ephemeral: true });
      
      ticket.status = 'closed'; saveDB(db);
      await interaction.reply('🔒 تم قبول طلب الإغلاق، سيتم أرشفة وحذف القناة خلال 5 ثوانٍ...');
      setTimeout(async () => { await interaction.channel.delete().catch(() => null); }, 5000);
    }

    if (interaction.customId === 'ping_owner') {
      await interaction.reply({ content: `🔔 تنبيه ونداء عاجل لصاحب التذكرة المتأخر: <@${ticket.ownerId}>` });
    }
  }
});

// [6] كاونتر احتساب رسائل الأعضاء التلقائي مع ترقية الليفلات وحفظ الرتب القديمة
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const db = getDB();
  const guildId = message.guild.id;
  const userId = message.author.id;

  if (!db.userMessages) db.userMessages = {};
  if (!db.userMessages[guildId]) db.userMessages[guildId] = {};
  if (!db.userMessages[guildId][userId]) db.userMessages[guildId][userId] = 0;

  db.userMessages[guildId][userId] += 1;
  const currentCount = db.userMessages[guildId][userId];
  saveDB(db);

  // التحقق والتحجيم التلقائي لليفلات الرتب الـ 10
  const serverLevelConfig = db.levelConfig?.[guildId];
  if (serverLevelConfig && serverLevelConfig.roles && serverLevelConfig.roles.length > 0) {
    let eligibleRoleInfo = null;
    for (const rInfo of serverLevelConfig.roles) {
      if (currentCount >= rInfo.requiredMessages) eligibleRoleInfo = rInfo;
    }

    if (eligibleRoleInfo) {
      const targetRole = message.guild.roles.cache.get(eligibleRoleInfo.roleId);
      if (targetRole && !message.member.roles.cache.has(targetRole.id)) {
        try {
          await message.member.roles.add(targetRole);
          const logChannel = message.guild.channels.cache.get(serverLevelConfig.channelId);
          if (logChannel) {
            await logChannel.send({ content: `🎉 تهانينا الحارة ${message.author}! لقد تخطيت حاجز \`${eligibleRoleInfo.requiredMessages}\` رسالة وحصلت على رتبة التميز الفخرية: **${targetRole.name}**! (وتم الاحتفاظ بكافة رتبك السابقة كاملة 💾).` });
          }
        } catch (err) { console.error('Level Up Role Error:', err); }
      }
    }
  }

  // نظام الردود التلقائية الذكية
  const text = message.content.trim().toLowerCase();
  if (db.replies?.[guildId]?.[text]) {
    return message.reply({ content: `${db.replies[guildId][text]}` });
  }
});

client.login(TOKEN);
