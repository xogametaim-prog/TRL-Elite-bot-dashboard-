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

function getDB() { 
  try {
    return JSON.parse(fs.readFileSync('./db.json', 'utf8')); 
  } catch(e) {
    return { warns: {}, lockedChannels: {}, vouchers: {}, replies: {}, tickets: {}, ticketConfig: {} };
  }
}
function saveDB(db) { fs.writeFileSync('./db.json', JSON.stringify(db, null, 2)); }

// دالة مساعدة مع حماية كاملة لمنع كراش الأمر السلاش
async function sendVoucher(guild, title, description, color = '#ff0000') {
  try {
    const db = getDB();
    if (!db.vouchers || !db.vouchers[guild.id]) return;
    const channelId = db.vouchers[guild.id];
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(`📜 سجل العمليات | ${title}`)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
      await channel.send({ embeds: [embed] }).catch(() => null);
    }
  } catch(err) {
    console.error('Error in sendVoucher:', err);
  }
}

module.exports = {
  // ==================== [ نظام التذاكر المطور بالمربعات الخمسة ] ====================
  'setup-ticket': {
    name: 'setup-ticket',
    shortcuts: ['تكت', 'تذاكر'],
    data: new SlashCommandBuilder()
      .setName('setup-ticket')
      .setDescription('إعداد لوحة التذاكر الذكية باختيار الأزرار والرتب المخصصة')
      .addStringOption(o => o.setName('title').setDescription('عنوان لوحة التذاكر (الإيمبد)').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('وصف لوحة التذاكر').setRequired(true))
      // الزر الأول ورتبته (إجباري)
      .addStringOption(o => o.setName('button1').setDescription('اسم الزر الأول').setRequired(true))
      .addRoleOption(o => o.setName('role1').setDescription('الرتبة التي تستلم تذاكر الزر الأول').setRequired(true))
      // الزر الثاني ورتبته (اختياري)
      .addStringOption(o => o.setName('button2').setDescription('اسم الزر الثاني').setRequired(false))
      .addRoleOption(o => o.setName('role2').setDescription('الرتبة التي تستلم تذاكر الزر الثاني').setRequired(false))
      // الزر الثالث ورتبته (اختياري)
      .addStringOption(o => o.setName('button3').setDescription('اسم الزر الثالث').setRequired(false))
      .addRoleOption(o => o.setName('role3').setDescription('الرتبة التي تستلم تذاكر الزر الثالث').setRequired(false))
      // الزر الرابع ورتبته (اختياري)
      .addStringOption(o => o.setName('button4').setDescription('اسم الزر الرابع').setRequired(false))
      .addRoleOption(o => o.setName('role4').setDescription('الرتبة التي تستلم تذاكر الزر الرابع').setRequired(false))
      // الزر الخامس ورتبته (اختياري)
      .addStringOption(o => o.setName('button5').setDescription('اسم الزر الخامس').setRequired(false))
      .addRoleOption(o => o.setName('role5').setDescription('الرتبة التي تستلم تذاكر الزر الخامس').setRequired(false)),
    
    executeSlash: async (interaction) => {
      try {
        const title = interaction.options.getString('title');
        const desc = interaction.options.getString('description');
        
        const db = getDB();
        if (!db.ticketConfig) db.ticketConfig = {};
        if (!db.ticketConfig[interaction.guild.id]) db.ticketConfig[interaction.guild.id] = {};

        const row = new ActionRowBuilder();

        // اللوب يمر على الخمس أزرار والرتب المحددة بالمربعات
        for (let i = 1; i <= 5; i++) {
          const btnName = interaction.options.getString(`button${i}`);
          const role = interaction.options.getRole(`role${i}`);

          if (btnName && role) {
            const customId = `ticket_btn_${i}_${interaction.guild.id}`;
            
            // حفظ الإعدادات في الداتا بيز لكل زر برتبته المحددة
            db.ticketConfig[interaction.guild.id][customId] = { roleId: role.id, name: btnName };

            row.addComponents(
              new ButtonBuilder()
                .setCustomId(customId)
                .setLabel(btnName)
                .setStyle(ButtonStyle.Primary)
            );
          }
        }

        saveDB(db);

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(desc)
          .setColor('#00ffcc')
          .setFooter({ text: 'نظام تذاكر متطور تلقائي الإدارة' });

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ تم إنشاء لوحة التذاكر وحفظ الإعدادات لكل رتبة بنجاح.', ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: '❌ حدث خطأ أثناء إعداد لوحة التذاكر، تأكد من ملء الحقول بشكل صحيح.', ephemeral: true });
      }
    },
    executeMessage: async (message) => {
      message.reply('❌ يرجى استخدام أمر السلاش المطور `/setup-ticket` لتحديد الأزرار والرتب من المربعات.');
    }
  },

  // أمر تفعيل وتحديد روم الفاوتشر (سجل العمليات)
  'voucher': {
    name: 'voucher', shortcuts: ['فاوتشر', 'سجل'],
    data: new SlashCommandBuilder().setName('voucher').setDescription('تحديد روم الحالية لتكون روم سجل العمليات والتوثيق').addChannelOption(o => o.setName('channel').setRequired(true).setDescription('الروم')),
    executeSlash: async (interaction) => {
      try {
        const channel = interaction.options.getChannel('channel');
        const db = getDB(); if (!db.vouchers) db.vouchers = {};
        db.vouchers[interaction.guild.id] = channel.id; saveDB(db);
        await interaction.reply(`✅ تم اعتماد الروم ${channel} للـ **voucher**.`);
      } catch(e) { await interaction.reply({ content: '❌ خطأ في تنفيذ الأمر.', ephemeral: true }); }
    },
    executeMessage: async (message) => {
      const db = getDB(); if (!db.vouchers) db.vouchers = {};
      db.vouchers[message.guild.id] = message.channel.id; saveDB(db);
      message.reply(`✅ تم تحديد الروم الحالية للـ **voucher**.`);
    }
  },

  // ==================== [ أوامر الإدارة والعقوبات الأساسية مع حماية Try/Catch لتجنب أخطاء الصورة ] ====================
  'ban': {
    name: 'ban', shortcuts: ['باند', 'حظر', 'ب'],
    data: new SlashCommandBuilder().setName('ban').setDescription('حظر عضو من السيرفر').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addStringOption(o => o.setName('reason').setDescription('السبب')),
    executeSlash: async (interaction) => {
      try {
        const user = interaction.options.getUser('user'); const reason = interaction.options.getString('reason') || 'بدون سبب';
        await interaction.guild.members.ban(user, { reason });
        await interaction.reply(`✅ تم حظر الحساب ${user.tag}.`);
        await sendVoucher(interaction.guild, 'الحظر (Ban)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**السبب:** ${reason}`, '#ff0000');
      } catch(e) { await interaction.reply({ content: '❌ فشل تنفيذ الباند (قد لا أملك الصلاحيات الكافية لحظر هذا الشخص).', ephemeral: true }); }
    },
    executeMessage: async (message, args) => {
      try {
        const user = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!user) return message.reply('❌ يرجى منشن العضو أو كتابة الآيدي.');
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        await message.guild.members.ban(user, { reason }); message.reply(`✅ تم حظر **${user.tag}**.`);
        sendVoucher(message.guild, 'الحظر (Ban)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}\n**السبب:** ${reason}`, '#ff0000');
      } catch(e) { message.reply('❌ فشل تنفيذ الحظر.'); }
    }
  },

  'unban': {
    name: 'unban', shortcuts: ['فك-باند', 'ف-ب'],
    data: new SlashCommandBuilder().setName('unban').setDescription('إلغاء حظر عضو باستخدام الآيدي').addStringOption(o => o.setName('userid').setRequired(true).setDescription('آيدي العضو')),
    executeSlash: async (interaction) => {
      try {
        const userId = interaction.options.getString('userid'); await interaction.guild.members.unban(userId);
        await interaction.reply(`✅ تم فك حظر الآيدي \`${userId}\`.`);
        await sendVoucher(interaction.guild, 'فك حظر (Unban)', `**الآيدي:** ${userId}\n**المسؤول:** ${interaction.user.tag}`, '#00ff00');
      } catch(e) { await interaction.reply({ content: '❌ الآيدي غير محظور أو خاطئ.', ephemeral: true }); }
    },
    executeMessage: async (message, args) => {
      try {
        if (!args[0]) return message.reply('❌ يرجى كتابة الآيدي لفك الحظر.');
        await message.guild.members.unban(args[0]); message.reply(`✅ تم فك حظر الآيدي \`${args[0]}\`.`);
        sendVoucher(message.guild, 'فك حظر (Unban)', `**الآيدي:** ${args[0]}\n**المسؤول:** ${message.author.tag}`, '#00ff00');
      } catch(e) { message.reply('❌ فشل فك الحظر.'); }
    }
  },

  'kick': {
    name: 'kick', shortcuts: ['طرد', 'ط'],
    data: new SlashCommandBuilder().setName('kick').setDescription('طرد عضو من السيرفر').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addStringOption(o => o.setName('reason').setDescription('السبب')),
    executeSlash: async (interaction) => {
      try {
        const user = interaction.options.getUser('user'); const reason = interaction.options.getString('reason') || 'بدون سبب';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null); if (!member) return interaction.reply('❌ غير متواجد.');
        await member.kick(reason); await interaction.reply(`✅ تم طرد ${user.tag}.`);
        await sendVoucher(interaction.guild, 'الطرد (Kick)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**السبب:** ${reason}`, '#ffa500');
      } catch(e) { await interaction.reply({ content: '❌ لا يمكن طرد هذا العضو بسبب الصلاحيات.', ephemeral: true }); }
    },
    executeMessage: async (message, args) => {
      try {
        const user = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!user) return message.reply('❌ يرجى تحديد العضو.');
        const member = await message.guild.members.fetch(user.id).catch(() => null); if (!member) return message.reply('❌ غير متواجد.');
        const reason = args.slice(1).join(' ') || 'بدون سبب'; await member.kick(reason); message.reply(`✅ تم طرد **${user.tag}**.`);
        sendVoucher(message.guild, 'الطرد (Kick)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}\n**السبب:** ${reason}`, '#ffa500');
      } catch(e) { message.reply('❌ فشل الطرد.'); }
    }
  },

  'mute': {
    name: 'mute', shortcuts: ['ميوت', 'كتم', 'م'],
    data: new SlashCommandBuilder().setName('mute').setDescription('إعطاء ميوت (تايم آوت) لعضو').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addIntegerOption(o => o.setName('time').setRequired(true).setDescription('الوقت بالدقائق')),
    executeSlash: async (interaction) => {
      try {
        const user = interaction.options.getUser('user'); const time = interaction.options.getInteger('time');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null); if (!member) return interaction.reply('❌ العضو غير متواجد بسيرفر.');
        await member.timeout(time * 60 * 1000, 'ميوت إداري'); 
        await interaction.reply(`✅ تم كتم ${user.tag} لـ ${time} دقيقة.`);
        await sendVoucher(interaction.guild, 'كتم (Mute)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**المدة:** ${time} دقيقة`, '#ffff00');
      } catch(e) { await interaction.reply({ content: '❌ فشل الكتم (تأكد أن رتبة البوت أعلى من رتبة العضو المطلوب كتمه).', ephemeral: true }); }
    },
    executeMessage: async (message, args) => {
      try {
        const user = message.mentions.users.first(); const time = parseInt(args[1]);
        if (!user || isNaN(time)) return message.reply('❌ الإستخدام: `ميوت @العضو الدقائق`');
        const member = await message.guild.members.fetch(user.id).catch(() => null); if (!member) return message.reply('❌ غير متواجد.');
        await member.timeout(time * 60 * 1000, 'ميوت إداري'); message.reply(`✅ تم كتم **${user.tag}** لـ ${time} دقيقة.`);
        sendVoucher(message.guild, 'كتم (Mute)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}\n**المدة:** ${time} دقيقة`, '#ffff00');
      } catch(e) { message.reply('❌ فشل الكتم.'); }
    }
  },

  'unmute': {
    name: 'unmute', shortcuts: ['فك-ميوت', 'ف-م'],
    data: new SlashCommandBuilder().setName('unmute').setDescription('إلغاء الميوت والتايم آوت عن العضو فوراً').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')),
    executeSlash: async (interaction) => {
      try {
        const user = interaction.options.getUser('user'); const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply('❌ غير متواجد.'); await member.timeout(null); await interaction.reply(`✅ تم فك الكتم عن ${user.tag}.`);
        await sendVoucher(interaction.guild, 'فك كتم (Unmute)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}`, '#00ff00');
      } catch(e) { await interaction.reply({ content: '❌ فشل فك الكتم.', ephemeral: true }); }
    },
    executeMessage: async (message, args) => {
      try {
        const user = message.mentions.users.first(); if (!user) return message.reply('❌ يرجى منشن العضو.');
        const member = await message.guild.members.fetch(user.id).catch(() => null); if (!member) return message.reply('❌ غير متواجد.');
        await member.timeout(null); message.reply(`✅ تم فك الكتم عن **${user.tag}**.`);
        sendVoucher(message.guild, 'فك كتم (Unmute)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}`, '#00ff00');
      } catch(e) { message.reply('❌ فشل فك الكتم.'); }
    }
  },

  'warn': {
    name: 'warn', shortcuts: ['تحذير', 'ت'],
    data: new SlashCommandBuilder().setName('warn').setDescription('توجيه تحذير رسمي للعضو').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addStringOption(o => o.setName('reason').setDescription('السبب')),
    executeSlash: async (interaction) => {
      try {
        const user = interaction.options.getUser('user'); const reason = interaction.options.getString('reason') || 'بدون سبب';
        const db = getDB(); if (!db.warns) db.warns = {}; if (!db.warns[user.id]) db.warns[user.id] = [];
        db.warns[user.id].push({ guild: interaction.guild.id, reason, date: new Date().toLocaleDateString() }); saveDB(db);
        await interaction.reply(`⚠️ تم تسجيل تحذير ضد ${user.tag}: ${reason}`);
        await sendVoucher(interaction.guild, 'تحذير (Warn)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**السبب:** ${reason}`, '#e67e22');
      } catch(e) { await interaction.reply({ content: '❌ خطأ في تحذير العضو.', ephemeral: true }); }
    },
    executeMessage: async (message, args) => {
      const user = message.mentions.users.first(); if (!user) return message.reply('❌ يرجى منشن العضو.');
      const reason = args.slice(1).join(' ') || 'بدون سبب';
      const db = getDB(); if (!db.warns) db.warns = {}; if (!db.warns[user.id]) db.warns[user.id] = [];
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
      db.replies[interaction.guild.id][q] = a; saveDB(db); await interaction.reply(`✅ تم حفظ الرد لـ "${q}".`);
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
    executeSlash: async (interaction) => { await interaction.reply({ embeds: [createInfoEmbed()] }); },
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
