/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                PREMIUM TICKET & EMBED SYSTEM BOT                     ║
 * ║         Developed by Taim (Lead Developer & Founder)                 ║
 * ║                Powered & Secured by TRL.dev Team                     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  ChannelType,
  SlashCommandBuilder 
} = require('discord.js');
const http = require('http');

// [1] تشغيل سيرفر الويب لضمان استمرارية البوت 24 ساعة على ريندر
const server = http.createServer((req, res) => {
  res.writeHead(200); res.end('TRL.dev System Bot Is Active! 🚀');
});
server.listen(process.env.PORT || 3000);

// [2] إعداد الجلسة وتفعيل الـ Intents الأساسية
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

// جلب التوكن من الـ Environment Variables في ريندر وآيدي البوت الثابت
const TOKEN = process.env.TOKEN; 
const CLIENT_ID = "1254845579979329618"; 

// ذاكرة مؤقتة لحفظ إعدادات التكتات أثناء تشغيل البوت لتجنب تعقيد الملفات
const ticketMemoryConfig = new Map();

// [3] بناء مصفوفة الأوامر الاحترافية (التكت المطور والامبيد)
const commandsData = [
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('إعداد لوحة التكتات الفخمة بالقائمة المنسدلة والأزرار')
    .addStringOption(o => o.setName('title').setRequired(true).setDescription('عنوان لوحة الدعم الفني'))
    .addStringOption(o => o.setName('description').setRequired(true).setDescription('وصف اللوحة والتعليمات داخل البوكس'))
    .addStringOption(o => o.setName('options').setRequired(true).setDescription('الخيارات تفصل بينها بفاصلة (مثال: Support,شكاوي,Buy)'))
    .addRoleOption(o => o.setName('staff-role').setRequired(true).setDescription('الرتبة الإدارية المسؤولة عن استقبال التكتات'))
    .addStringOption(o => o.setName('image').setDescription('رابط البانر المخصص أو الصورة أعلى اللوحة (اختياري)')),

  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('إرسال رسالة إيمبد إدارية مخصصة بالكامل مع صورة')
    .addStringOption(o => o.setName('title').setRequired(true).setDescription('عنوان رسالة الإيمبد'))
    .addStringOption(o => o.setName('description').setRequired(true).setDescription('المحتوى النصي للإيمبد'))
    .addStringOption(o => o.setName('image').setDescription('رابط الصورة المخصصة للرسالة (اختياري)')),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('عرض ملف المطور الشخصي لـ تيم والمعلومات الأساسية لـ TRL.dev')
].map(cmd => cmd.toJSON());

// [4] حدث الإقلاع وتسجيل الأوامر عالمياً وفورياً بالسيرفر
client.once('ready', async () => {
  console.log(`✨ [TRL.dev] Connected successfully as: ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('⏳ Syncing global slash commands across Discord...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsData });
    console.log('🎉 Global Ticket & Embed Commands Registered Perfectly!');
  } catch (error) { 
    console.error('❌ Sync Error:', error); 
  }
});

// [5] استقبال ومعالجة التفاعلات
client.on('interactionCreate', async interaction => {
  const guildId = interaction.guild?.id;

  // أ) معالجة أوامر السلاش التنفيذية للادارة
  if (interaction.isChatInputCommand()) {
    const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasControlRole = interaction.member.roles.cache.some(r => r.name === 'System Control');
    
    if (interaction.commandName !== 'info' && !hasAdmin && !hasControlRole) {
      return interaction.reply({ content: '❌ عذراً! هذا الأمر مخصص فقط للإدارة العليا أو لمن يمتلك رتبة `System Control`.', ephemeral: true });
    }

    // أمر الـ setup-ticket المطور (نفس شكل الصورة تماماً)
    if (interaction.commandName === 'setup-ticket') {
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const img = interaction.options.getString('image');
      const staffRole = interaction.options.getRole('staff-role');
      const rawOptions = interaction.options.getString('options').split(',');

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`ticket_select_${guildId}`)
        .setPlaceholder('Choose an option... 🎫');

      rawOptions.forEach((opt, index) => {
        const trimmed = opt.trim();
        if (trimmed.length > 0) {
          const valueId = `opt_${index}_${Date.now()}`;
          selectMenu.addOptions({ 
            label: trimmed, 
            description: `Open a ${trimmed} ticket`, 
            value: valueId 
          });
          // حفظ إعدادات الخيار في الذاكرة لتوجيه التكت للرتبة الصح
          ticketMemoryConfig.set(valueId, { roleId: staffRole.id, name: trimmed });
        }
      });

      // إضافة قائمة خيار إعادة التعيين (Reset) مثل الصورة
      selectMenu.addOptions({ label: 'Reset', description: 'Reset to choose again', value: 'ticket_reset_option' });

      const rowMenu = new ActionRowBuilder().addComponents(selectMenu);

      // إنشاء أزرار إضافية تحت القائمة المنسدلة لإعطاء مظهر فخم (مثل الشروط والطلب)
      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('view_terms').setLabel('Terms 📋').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('view_buy').setLabel('Buy 🛒').setStyle(ButtonStyle.Secondary)
      );

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor('#2f3136')
        .setFooter({ text: 'Welcome to Members Support! We are here to help you anytime. 📝' });

      if (img && img.startsWith('http')) embed.setImage(img);

      await interaction.channel.send({ embeds: [embed], components: [rowMenu, rowButtons] });
      return interaction.reply({ content: '✅ تم إنشاء لوحة التكتات الاحترافية بنجاح فائق!', ephemeral: true });
    }

    // أمر الإيمبد العام للإدارة
    if (interaction.commandName === 'embed') {
      const embed = new EmbedBuilder()
        .setTitle(interaction.options.getString('title'))
        .setDescription(interaction.options.getString('description'))
        .setColor('#5865F2')
        .setTimestamp();
        
      const img = interaction.options.getString('image');
      if (img && img.startsWith('http')) embed.setImage(img);

      await interaction.channel.send({ embeds: [embed] });
      return interaction.reply({ content: '✅ تم إرسال رسالة الإيمبد بنجاح مذهل!', ephemeral: true });
    }

    // أمر معلومات المطور تيم
    if (interaction.commandName === 'info') {
      const embed = new EmbedBuilder()
        .setTitle('📋 ملف المطور الشخصي والمعلومات الأساسية')
        .setColor('#5865F2')
        .addFields(
          { name: '👤 الاسم المطور', value: 'تيم (Taim) - Lead Developer', inline: true },
          { name: '⚡ الفريق والمنظمة', value: 'مؤسس وقائد فريق TRL.dev و مجتمع BRQ 🎉', inline: true }
        )
        .setFooter({ text: 'Premium system bot • Developed beautifully by TRL.dev' });
      return interaction.reply({ embeds: [embed] });
    }
  }

  // ب) فتح التذكرة عند الاختيار من القائمة المنسدلة
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_select_')) {
    const selectedValue = interaction.values[0];

    // إذا اختار Reset نقوم بالرد عليه فقط لتصفية الاختيار
    if (selectedValue === 'ticket_reset_option') {
      return interaction.reply({ content: '🔄 تم إعادة تعيين الاختيار، يمكنك التحديد مجدداً الآن.', ephemeral: true });
    }

    await interaction.reply({ content: '⏳ جاري إنشاء تذكرتك الخاصة، يرجى الانتظار ثوانٍ...', ephemeral: true });

    // جلب الإعدادات من الذاكرة
    const configData = ticketMemoryConfig.get(selectedValue) || { name: 'Support', roleId: null };
    const { roleId, name: sectionName } = configData;

    // إنشاء روم التكت
    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${sectionName}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
        ...(roleId ? [{ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
      ]
    });

    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التكت 🛡️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التكت 🔒').setStyle(ButtonStyle.Danger)
    );

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 تذكرة جديدة | قسم: ${sectionName}`)
      .setDescription(`مرحباً بك ${interaction.user} في تذكرتك.\nالرجاء كتابة تفاصيل طلبك بوضوح هنا لحين حضور الطاقم الإداري المسؤل.`)
      .setColor('#3498db')
      .setTimestamp();

    await ticketChannel.send({ 
      content: `${interaction.user} ${roleId ? `| <@&${roleId}>` : ''}`, 
      embeds: [welcomeEmbed], 
      components: [controlRow] 
    });

    return interaction.editReply({ content: `✅ تم فتح تذكرتك بنجاح في: ${ticketChannel}` });
  }

  // ج) معالجة أزرار التحكم داخل التكت والأزرار العامة
  if (interaction.isButton()) {
    // الأزرار العامة التجميلية للوحة
    if (interaction.customId === 'view_terms') {
      return interaction.reply({ content: '📋 **قوانين الدعم الفني:** يرجى عدم تكرار المنشن، واحترام الطاقم الإداري، وكتابة مشكلتك في رسالة واحدة.', ephemeral: true });
    }
    if (interaction.customId === 'view_buy') {
      return interaction.reply({ content: '🛒 **للشراء والاستفسار عن المنتجات:** يرجى فتح تكت من القائمة المنسدلة واختيار قسم المبيعات.', ephemeral: true });
    }

    // أزرار التحكم بالتكت نفسه
    if (interaction.customId === 'claim_ticket') {
      await interaction.reply({ content: `🛡️ تم استلام التذكرة وبدء المتابعة من قِبل المسؤول: ${interaction.user}` });
    }

    if (interaction.customId === 'close_ticket') {
      await interaction.reply('🔒 تم قبول طلب الإغلاق، سيتم حذف القناة خلال 5 ثوانٍ...');
      setTimeout(async () => { await interaction.channel.delete().catch(() => null); }, 5000);
    }
  }
});

client.login(TOKEN);
