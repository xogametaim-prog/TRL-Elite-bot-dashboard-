const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType 
} = require('discord.js');
const fs = require('fs');

function getDB() { return JSON.parse(fs.readFileSync('./db.json', 'utf8')); }
function saveDB(db) { fs.writeFileSync('./db.json', JSON.stringify(db, null, 2)); }

// دالة مساعدة لإرسال السجلات (Voucher) تلقائياً لقنوات التوثيق
async function sendVoucher(guild, title, description, color = '#ff0000') {
  const db = getDB();
  const channelId = db.vouchers?.[guild.id];
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle(`📜 سجل العمليات | ${title}`)
      .setDescription(description)
      .setColor(color)
      .setTimestamp();
    await channel.send({ embeds: [embed] }).catch(() => null);
  }
}

module.exports = {
  // ==================== [ نظام التذاكر المطور ] ====================
  'setup-ticket': {
    name: 'setup-ticket',
    shortcuts: ['تكت', 'تذاكر'],
    data: new SlashCommandBuilder()
      .setName('setup-ticket')
      .setDescription('إعداد لوحة التذاكر الذكية بالأزرار والرتب المخصصة')
      .addStringOption(o => o.setName('title').setDescription('عنوان لوحة التذاكر الإيمبد').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('وصف لوحة التذاكر').setRequired(true))
      .addStringOption(o => o.setName('buttons').setDescription('أزرار التكت والرتب (مثال: الدعم:@رتبة | الإدارة:@رتبة)').setRequired(true)),
    
    executeSlash: async (interaction) => {
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const buttonsString = interaction.options.getString('buttons');
      
      const db = getDB();
      if (!db.ticketConfig) db.ticketConfig = {};
      if (!db.ticketConfig[interaction.guild.id]) db.ticketConfig[interaction.guild.id] = {};

      const parts = buttonsString.split('|');
      if (parts.length > 5) return interaction.reply({ content: '❌ لا يمكنك إضافة أكثر من 5 أزرار للتذاكر.', ephemeral: true });

      const row = new ActionRowBuilder();
      let count = 1;

      for (const part of parts) {
        const btnInfo = part.split(':');
        if (btnInfo.length < 2) continue;
        
        const btnName = btnInfo[0].trim();
        const roleMention = btnInfo[1].trim();
        const roleId = roleMention.replace(/[^0-9]/g, '');

        const customId = `ticket_btn_${count}_${interaction.guild.id}`;
        
        db.ticketConfig[interaction.guild.id][customId] = { roleId, name: btnName };

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(customId)
            .setLabel(btnName)
            .setStyle(ButtonStyle.Primary)
        );
        count++;
      }

      saveDB(db);

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor('#00ffcc')
        .setFooter({ text: 'نظام التذاكر تلقائي الإدارة' });

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ تم إنشاء لوحة التذاكر وحفظ الإعدادات بنجاح.', ephemeral: true });
    },
    executeMessage: async (message) => {
      message.reply('❌ يرجى استخدام أمر السلاش `/setup-ticket` لتحديد الأزرار والمنشن للرتب بدقة عالية.');
    }
  },

  // أمر تفعيل وتحديد روم الفاوتشر (سجل العمليات)
  'voucher': {
    name: 'voucher', shortcuts: ['فاوتشر', 'سجل'],
    data: new SlashCommandBuilder().setName('voucher').setDescription('تحديد روم الحالية لتكون روم سجل العمليات والتوثيق').addChannelOption(o => o.setName('channel').setRequired(true).setDescription('الروم')),
    executeSlash: async (interaction) => {
      const channel = interaction.options.getChannel('channel');
      const db = getDB(); if (!db.vouchers) db.vouchers = {};
      db.vouchers[interaction.guild.id] = channel.id; saveDB(db);
      interaction.reply(`✅ تم اعتماد الروم ${channel} للـ **voucher**.`);
    },
    executeMessage: async (message) => {
      const db = getDB(); if (!db.vouchers) db.vouchers = {};
      db.vouchers[message.guild.id] = message.channel.id; saveDB(db);
      message.reply(`✅ تم تحديد الروم الحالية للـ **voucher**.`);
    }
  },

  // ==================== [ أوامر الإدارة والعقوبات الأساسية ] ====================
  'ban': {
    name: 'ban', shortcuts: ['باند', 'حظر', 'ب'],
    data: new SlashCommandBuilder().setName('ban').setDescription('حظر عضو من السيرفر').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addStringOption(o => o.setName('reason').setDescription('السبب')),
    executeSlash: async (interaction) => {
      const user = interaction.options.getUser('user'); const reason = interaction.options.getString('reason') || 'بدون سبب';
      await interaction.guild.members.ban(user, { reason });
      interaction.reply(`✅ تم حظر الحساب ${user.tag}.`);
      sendVoucher(interaction.guild, 'الحظر (Ban)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**السبب:** ${reason}`, '#ff0000');
    },
    executeMessage: async (message, args) => {
      const user = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
      if (!user) return message.reply('❌ يرجى منشن العضو أو كتابة الآيدي.');
      const reason = args.slice(1).join(' ') || 'بدون سبب';
      await message.guild.members.ban(user, { reason }); message.reply(`✅ تم حظر **${user.tag}**.`);
      sendVoucher(message.guild, 'الحظر (Ban)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}\n**السبب:** ${reason}`, '#ff0000');
    }
  },

  'unban': {
    name: 'unban', shortcuts: ['فك-باند', 'ف-ب'],
    data: new SlashCommandBuilder().setName('unban').setDescription('إلغاء حظر عضو باستخدام الآيدي').addStringOption(o => o.setName('userid').setRequired(true).setDescription('آيدي العضو')),
    executeSlash: async (interaction) => {
      const userId = interaction.options.getString('userid'); await interaction.guild.members.unban(userId);
      interaction.reply(`✅ تم فك حظر الآيدي \`${userId}\`.`);
      sendVoucher(interaction.guild, 'فك حظر (Unban)', `**الآيدي:** ${userId}\n**المسؤول:** ${interaction.user.tag}`, '#00ff00');
    },
    executeMessage: async (message, args) => {
      if (!args[0]) return message.reply('❌ يرجى كتابة الآيدي لفك الحظر.');
      await message.guild.members.unban(args[0]); message.reply(`✅ تم فك حظر الآيدي \`${args[0]}\`.`);
      sendVoucher(message.guild, 'فك حظر (Unban)', `**الآيدي:** ${args[0]}\n**المسؤول:** ${message.author.tag}`, '#00ff00');
    }
  },

  'kick': {
    name: 'kick', shortcuts: ['طرد', 'ط'],
    data: new SlashCommandBuilder().setName('kick').setDescription('طرد عضو من السيرفر').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addStringOption(o => o.setName('reason').setDescription('السبب')),
    executeSlash: async (interaction) => {
      const user = interaction.options.getUser('user'); const reason = interaction.options.getString('reason') || 'بدون سبب';
      const member = await interaction.guild.members.fetch(user.id).catch(() => null); if (!member) return interaction.reply('❌ غير متواجد.');
      await member.kick(reason); interaction.reply(`✅ تم طرد ${user.tag}.`);
      sendVoucher(interaction.guild, 'الطرد (Kick)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**السبب:** ${reason}`, '#ffa500');
    },
    executeMessage: async (message, args) => {
      const user = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
      if (!user) return message.reply('❌ يرجى تحديد العضو.');
      const member = await message.guild.members.fetch(user.id).catch(() => null); if (!member) return message.reply('❌ غير متواجد.');
      const reason = args.slice(1).join(' ') || 'بدون سبب'; await member.kick(reason); message.reply(`✅ تم طرد **${user.tag}**.`);
      sendVoucher(message.guild, 'الطرد (Kick)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}\n**السبب:** ${reason}`, '#ffa500');
    }
  },

  'mute': {
    name: 'mute', shortcuts: ['ميوت', 'كتم', 'م'],
    data: new SlashCommandBuilder().setName('mute').setDescription('إعطاء ميوت (تايم آوت) لعضو').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addIntegerOption(o => o.setName('time').setRequired(true).setDescription('الوقت بالدقائق')),
    executeSlash: async (interaction) => {
      const user = interaction.options.getUser('user'); const time = interaction.options.getInteger('time');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null); if (!member) return interaction.reply('❌ غير متواجد.');
      await member.timeout(time * 60 * 1000, 'ميوت إداري'); interaction.reply(`✅ تم كتم ${user.tag} لـ ${time} دقيقة.`);
      sendVoucher(interaction.guild, 'كتم (Mute)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**المدة:** ${time} دقيقة`, '#ffff00');
    },
    executeMessage: async (message, args) => {
      const user = message.mentions.users.first(); const time = parseInt(args[1]);
      if (!user || isNaN(time)) return message.reply('❌ الإستخدام: `ميوت @العضو الدقائق`');
      const member = await message.guild.members.fetch(user.id).catch(() => null); if (!member) return message.reply('❌ غير متواجد.');
      await member.timeout(time * 60 * 1000, 'ميوت إداري'); message.reply(`✅ تم كتم **${user.tag}** لـ ${time} دقيقة.`);
      sendVoucher(message.guild, 'كتم (Mute)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}\n**المدة:** ${time} دقيقة`, '#ffff00');
    }
  },

  'unmute': {
    name: 'unmute', shortcuts: ['فك-ميوت', 'ف-م'],
    data: new SlashCommandBuilder().setName('unmute').setDescription('إلغاء الميوت والتايم آوت عن العضو فوراً').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')),
    executeSlash: async (interaction) => {
      const user = interaction.options.getUser('user'); const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply('❌ غير متواجد.'); await member.timeout(null); interaction.reply(`✅ تم فك الكتم عن ${user.tag}.`);
      sendVoucher(interaction.guild, 'فك كتم (Unmute)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}`, '#00ff00');
    },
    executeMessage: async (message, args) => {
      const user = message.mentions.users.first(); if (!user) return message.reply('❌ يرجى منشن العضو.');
      const member = await message.guild.members.fetch(user.id).catch(() => null); if (!member) return message.reply('❌ غير متواجد.');
      await member.timeout(null); message.reply(`✅ تم فك الكتم عن **${user.tag}**.`);
      sendVoucher(message.guild, 'فك كتم (Unmute)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}`, '#00ff00');
    }
  },

  'warn': {
    name: 'warn', shortcuts: ['تحذير', 'ت'],
    data: new SlashCommandBuilder().setName('warn').setDescription('توجيه تحذير رسمي للعضو').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addStringOption(o => o.setName('reason').setDescription('السبب')),
    executeSlash: async (interaction) => {
      const user = interaction.options.getUser('user'); const reason = interaction.options.getString('reason') || 'بدون سبب';
      const db = getDB(); if (!db.warns[user.id]) db.warns[user.id] = [];
      db.warns[user.id].push({ guild: interaction.guild.id, reason, date: new Date().toLocaleDateString() }); saveDB(db);
      interaction.reply(`⚠️ تم تسجيل تحذير ضد ${user.tag}: ${reason}`);
      sendVoucher(interaction.guild, 'تحذير (Warn)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**السبب:** ${reason}`, '#e67e22');
    },
    executeMessage: async (message, args) => {
      const user = message.mentions.users.first(); if (!user) return message.reply('❌ يرجى منشن العضو.');
      const reason = args.slice(1).join(' ') || 'بدون سبب';
      const db = getDB(); if (!db.warns[user.id]) db.warns[user.id] = [];
      db.warns[user.id].push({ guild: message.guild.id, reason, date: new Date().toLocaleDateString() }); saveDB(db);
      message.reply(`⚠️ تم تسجيل تحذير ضد **${user.tag}**: ${reason}`);
      sendVoucher(message.guild, 'تحذير (Warn)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}\n**السبب:** ${reason}`, '#e67e22');
    }
  },

  'add-reply': {
    name: 'add-reply', shortcuts: ['اضف-رد'],
    data: new SlashCommandBuilder().setName('add-reply').setDescription('إضافة كلمة ورد تلقائي عليها').addStringOption(o => o.setName('question').setRequired(true).setDescription('السؤال')).addStringOption(o => o.setName('answer').setRequired(true).setDescription('الرد')),
    executeSlash: async (interaction) => {
      const q = interaction.options.getString('question').trim().toLowerCase(); const a = interaction.options.getString('answer');
      const db = getDB(); if (!db.replies) db.replies = {}; if (!db.replies[interaction.guild.id]) db.replies[interaction.guild.id] = {};
      db.replies[interaction.guild.id][q] = a; saveDB(db); interaction.reply(`✅ تم حفظ الرد لـ "${q}".`);
    },
    executeMessage: async (message, args) => {
      const content = args.join(' '); const parts = content.split('|'); if (parts.length < 2) return message.reply('❌ الإستخدام: `اضف-رد الكلمة | الرد`');
      const q = parts[0].trim().toLowerCase(); const a = parts[1].trim();
      const db = getDB(); if (!db.replies) db.replies = {}; if (!db.replies[message.guild.id]) db.replies[message.guild.id] = {};
      db.replies[message.guild.id][q] = a; saveDB(db); message.reply(`✅ تم حفظ الرد.`);
    }
  },

  'info': {
    name: 'info', shortcuts: ['انفو', 'معلومات', 'ا'],
    data: new SlashCommandBuilder().setName('info').setDescription('عرض ملف المطور الشخصي لـ تيم والمعلومات الأساسية لـ TRL.dev'),
    executeSlash: async (interaction) => { interaction.reply({ embeds: [createInfoEmbed()] }); },
    executeMessage: async (message) => { message.reply({ embeds: [createInfoEmbed()] }); }
  }
};

function createInfoEmbed() {
  return new EmbedBuilder()
    .setTitle('📋 الملف الشخصي والمعلومات الأساسية')
    .setColor('#7289da')
    .addFields(
      { name: '👤 الاسم', value: 'تيم (Taim)', inline: true },
      { name: '🛠️ المسمى التقني', value: 'مؤسس وقائد فريق TRL.dev (Lead Developer)', inline: true },
      { name: '📧 البريد الإلكتروني', value: 'hacked909h@gmail.com', inline: false },
      { name: '⚡ المهارات والقدرات التقنية', value: '• تطوير وبرمجة بوتات منصة Discord و Twitch\n• تصميم وتطوير مواقع الويب والتطبيقات (HTML, CSS, JavaScript)\n• تطوير وبناء الألعاب الرقمية\n• إتقان لغات البرمجة: Python, JavaScript' },
      { name: '🚀 المشاريع والإنجازات (تحت مظلة TRL.dev)', value: '• **بوتات إدارة الخوادم والأنظمة:** حماية وإدارة صلاحيات.\n• **بوت كأس العالم:** متابعة المباريات والجدولة تلقائياً.\n• **بوت Gangster bot:** البوت الخاص بالفريق وتطوير ميزاته.' }
    )
    .setFooter({ text: 'system bot for all • Powered by TRL.dev' })
    .setTimestamp();
}
