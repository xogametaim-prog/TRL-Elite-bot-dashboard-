const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionFlagsBits,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const fs = require('fs');
const { startDashboard } = require('./dashboard.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.Reaction]
});

// تحميل الإعدادات من config.json بشكل آمن
let config = { guilds: {} };
if (fs.existsSync('./config.json')) {
  try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
  } catch (e) {
    config = { guilds: {} };
  }
}
client.config = config;

// دالة حفظ الإعدادات في config.json
client.saveConfig = () => {
  fs.writeFileSync('./config.json', JSON.stringify(client.config, null, 2));
};

client.on('ready', async () => {
  console.log(`[BOT] Logged in as ${client.user.tag}`);
  
  const commands = [
    {
      name: 'setup-ticket',
      description: 'إرسال بنل التكت إلى روم محدد',
    }
  ];

  await client.application.commands.set(commands);
  startDashboard(client);
});

// ميكانيكية إرسال السجلات (Logs)
async function sendLog(guild, embed) {
  const guildConfig = client.config.guilds[guild.id];
  if (!guildConfig || !guildConfig.general?.logsChannel) return;
  const channel = guild.channels.cache.get(guildConfig.general.logsChannel);
  if (channel) {
    channel.send({ embeds: [embed] }).catch(() => {});
  }
}

// مؤقت لفحص وإنهاء القيف أواي التلقائي (كل 15 ثانية)
setInterval(async () => {
  const now = Date.now();
  for (const guildId in client.config.guilds) {
    const guildConfig = client.config.guilds[guildId];
    if (!guildConfig.giveaways) continue;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    for (const giveaway of guildConfig.giveaways) {
      if (!giveaway.ended && now >= giveaway.endAt) {
        await endGiveaway(client, guild, giveaway);
      }
    }
  }
}, 15000);

// دالة إنهاء القيف أواي واختيار الفائزين بناء على المتطلبات
async function endGiveaway(client, guild, giveaway) {
  giveaway.ended = true;
  client.saveConfig();

  const channel = guild.channels.cache.get(giveaway.channelId);
  if (!channel) return;

  try {
    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (!message) return;

    const reaction = message.reactions.cache.get('🎉');
    if (!reaction) {
      return channel.send(`⚠️ لا يمكن تحديد فائز لعدم وجود تفاعلات على قيف أواي: **${giveaway.prize}**.`);
    }

    const users = await reaction.users.fetch();
    const participants = users.filter(u => !u.bot).map(u => u.id);

    const validParticipants = [];
    for (const userId of participants) {
      try {
        const member = await guild.members.fetch(userId);
        if (!member) continue;

        // التحقق من شرط الرتبة
        if (giveaway.requiredRoleId && !member.roles.cache.has(giveaway.requiredRoleId)) {
          continue;
        }

        // التحقق من شرط مدة التواجد بالسيرفر
        if (giveaway.requiredServerDays) {
          const joinedAt = member.joinedTimestamp;
          const daysDiff = (Date.now() - joinedAt) / (1000 * 60 * 60 * 24);
          if (daysDiff < giveaway.requiredServerDays) continue;
        }

        validParticipants.push(userId);
      } catch (_) {}
    }

    if (validParticipants.length === 0) {
      const embed = EmbedBuilder.from(message.embeds[0])
        .setDescription(`**انتهى القيف أواي!**\n\nلم يشارك أحد يستوفي الشروط المطلوبة.`)
        .setColor('#ef4444');
      await message.edit({ embeds: [embed], components: [] });
      return channel.send(`⚠️ انتهى القيف أواي على **${giveaway.prize}**، ولكن لم يشارك أي عضو يستوفي الشروط المطلوبة.`);
    }

    const winners = [];
    const count = Math.min(giveaway.winnersCount || 1, validParticipants.length);
    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * validParticipants.length);
      winners.push(validParticipants.splice(index, 1)[0]);
    }

    const winnersMentions = winners.map(w => `<@${w}>`).join(', ');

    const originalEmbed = message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setTitle(`🎉 انتهى القيف أواي: ${giveaway.prize} 🎉`)
      .setDescription(`${originalEmbed.description}\n\n**الفائزون:** ${winnersMentions}`)
      .setColor('#6366f1');
    await message.edit({ embeds: [updatedEmbed], components: [] });

    const template = giveaway.winnerMessageTemplate || "🎉 مبروك {user} لقد ربحت {prize}!";
    const winnerMsg = template
      .replace('{user}', winnersMentions)
      .replace('{prize}', giveaway.prize);

    await channel.send(winnerMsg);
  } catch (err) {
    console.error("Error ending giveaway:", err);
  }
}

// فعاليات انضمام الأعضاء (Welcome & Auto Role)
client.on('guildMemberAdd', async (member) => {
  const guildConfig = client.config.guilds[member.guild.id];
  if (!guildConfig) return;

  if (guildConfig.autoRole?.enabled && guildConfig.autoRole?.roleId) {
    const role = member.guild.roles.cache.get(guildConfig.autoRole.roleId);
    if (role) {
      member.roles.add(role).catch(() => {});
    }
  }

  if (guildConfig.welcome?.enabled && guildConfig.welcome?.channelId) {
    const channel = member.guild.channels.cache.get(guildConfig.welcome.channelId);
    if (channel) {
      const welcomeText = (guildConfig.welcome.message || "Welcome to the server, {user}!")
        .replace('{user}', `<@${member.id}>`)
        .replace('{server}', member.guild.name)
        .replace('{count}', member.guild.memberCount);

      let payload = { content: welcomeText };
      if (guildConfig.welcome.mentionUser) {
        payload.content = `<@${member.id}>\n${welcomeText}`;
      }

      try {
        const canvas = createCanvas(800, 350);
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 800, 350);
        gradient.addColorStop(0, '#0f172a');
        gradient.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 350);

        ctx.beginPath();
        ctx.arc(400, 110, 75, 0, Math.PI * 2);
        ctx.fillStyle = '#4f46e5';
        ctx.fill();

        try {
          const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
          const avatar = await loadImage(avatarUrl);
          ctx.save();
          ctx.beginPath();
          ctx.arc(400, 110, 70, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatar, 330, 40, 140, 140);
          ctx.restore();
        } catch (avatarError) {
          console.error("Failed to load user avatar in index.js, falling back to clean circle:", avatarError);
          ctx.beginPath();
          ctx.arc(400, 110, 60, 0, Math.PI * 2);
          ctx.fillStyle = '#312e81';
          ctx.fill();
        }

        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`WELCOME TO THE SERVER`, 400, 230);

        ctx.font = '26px sans-serif';
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText(`${member.user.tag}`, 400, 275);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`Member #${member.guild.memberCount}`, 400, 315);

        const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'welcome.png' });
        payload.files = [attachment];
      } catch (canvasErr) {
        console.error("Canvas generation failed in index.js, rendering pure text instead:", canvasErr);
      }

      channel.send(payload).catch((err) => console.error("Error sending welcome message:", err));
    }
  }
});

// الردود التلقائية
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const guildConfig = client.config.guilds[message.guild.id];
  if (!guildConfig) return;

  if (guildConfig.autoReplies && Array.isArray(guildConfig.autoReplies)) {
    const match = guildConfig.autoReplies.find(r => 
      r.enabled && 
      message.content.trim().toLowerCase() === r.keyword.trim().toLowerCase()
    );
    if (match) {
      if (match.channel === 'all' || match.channel === message.channel.id) {
        message.reply(match.reply).catch(() => {});
      }
    }
  }
});

// السجلات (Message Logs)
client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;
  const embed = new EmbedBuilder()
    .setTitle("🗑️ حُذفت رسالة")
    .setColor('#ff4a4a')
    .addFields(
      { name: "العضو:", value: `<@${message.author.id}> (${message.author.id})` },
      { name: "الروم:", value: `<#${message.channel.id}>` },
      { name: "المحتوى:", value: message.content || "*لا يوجد نص (صورة أو ملف)*" }
    )
    .setTimestamp();
  sendLog(message.guild, embed);
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
  const embed = new EmbedBuilder()
    .setTitle("📝 عُدلت رسالة")
    .setColor('#facc15')
    .addFields(
      { name: "العضو:", value: `<@${oldMessage.author.id}>` },
      { name: "الروم:", value: `<#${oldMessage.channel.id}>` },
      { name: "قبل التعديل:", value: oldMessage.content || "*فارغ*" },
      { name: "بعد التعديل:", value: newMessage.content || "*فارغ*" }
    )
    .setTimestamp();
  sendLog(oldMessage.guild, embed);
});

// التعامل مع تفاعلات الأزرار، المودال، وأوامر السلاش
client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild) return;
  const guildConfig = client.config.guilds[interaction.guild.id];

  // التعامل مع تقديم المودال (Modals Submit) للأزرار الاحترافية داخل التكت
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;

    if (customId === 'modal_add_member') {
      const userId = interaction.fields.getTextInputValue('user_id_input').replace(/[<@!>]/g, '');
      try {
        const member = await interaction.guild.members.fetch(userId);
        await interaction.channel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          SendMessages: true
        });
        await interaction.reply({ content: `✅ تم إضافة العضو ${member} إلى التكت.` });

        const logEmbed = new EmbedBuilder()
          .setTitle("👤 إضافة عضو للتكت")
          .setColor('#42f560')
          .addFields(
            { name: "التكت:", value: `${interaction.channel.name}` },
            { name: "العضو المضاف:", value: `<@${member.id}>` },
            { name: "بواسطة:", value: `<@${interaction.user.id}>` }
          ).setTimestamp();
        sendLog(interaction.guild, logEmbed);
      } catch (_) {
        return interaction.reply({ content: '❌ تعذر العثور على العضو، يرجى كتابة معرف ID صحيح.', ephemeral: true });
      }
    }

    if (customId === 'modal_remove_member') {
      const userId = interaction.fields.getTextInputValue('user_id_input').replace(/[<@!>]/g, '');
      try {
        const member = await interaction.guild.members.fetch(userId);
        await interaction.channel.permissionOverwrites.delete(member.id);
        await interaction.reply({ content: `✅ تم إزالة العضو ${member} من التكت.` });

        const logEmbed = new EmbedBuilder()
          .setTitle("👤 إزالة عضو من التكت")
          .setColor('#ef4444')
          .addFields(
            { name: "التكت:", value: `${interaction.channel.name}` },
            { name: "العضو المزال:", value: `<@${member.id}>` },
            { name: "بواسطة:", value: `<@${interaction.user.id}>` }
          ).setTimestamp();
        sendLog(interaction.guild, logEmbed);
      } catch (_) {
        return interaction.reply({ content: '❌ تعذر العثور على العضو، يرجى كتابة معرف ID صحيح.', ephemeral: true });
      }
    }

    if (customId === 'modal_rename') {
      const newName = interaction.fields.getTextInputValue('new_name_input').trim().replace(/\s+/g, '-');
      const oldName = interaction.channel.name;
      await interaction.channel.setName(`ticket-${newName}`);
      await interaction.reply({ content: `✅ تم تغيير اسم التكت من \`${oldName}\` إلى \`ticket-${newName}\`.` });

      const logEmbed = new EmbedBuilder()
        .setTitle("✏️ تغيير اسم التكت")
        .setColor('#3b82f6')
        .addFields(
          { name: "من:", value: `\`${oldName}\`` },
          { name: "إلى:", value: `\`ticket-${newName}\`` },
          { name: "بواسطة:", value: `<@${interaction.user.id}>` }
        ).setTimestamp();
      sendLog(interaction.guild, logEmbed);
    }
  }

  // التفاعل مع أوامر السلاش (Slash Commands)
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup-ticket') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ يجب أن تمتلك صلاحية مدير لإعداد التكت.', ephemeral: true });
      }
      return interaction.reply({ content: '💡 يرجى إرسال لوحة التذاكر من لوحة التحكم (Dashboard) مباشرة وبشكل فوري دون أوامر.', ephemeral: true });
    }
  }

  // التفاعل مع الأزرار (أزرار التكت الاحترافية)
  if (interaction.isButton()) {
    const customId = interaction.customId;

    if (customId.startsWith('ticket_open_')) {
      await interaction.deferReply({ ephemeral: true });
      const ticketTypeId = customId.replace('ticket_open_', '');
      const ticketType = guildConfig?.tickets?.find(t => t.id === ticketTypeId);

      if (!ticketType) {
        return interaction.editReply({ content: '❌ حدث خطأ في الحصول على نوع هذه التذكرة.' });
      }

      const maxTickets = parseInt(guildConfig.maxTickets || '4');
      const currentTickets = interaction.guild.channels.cache.filter(c => 
        c.name.includes('ticket-') && 
        c.topic && c.topic.includes(`owner:${interaction.user.id}`)
      );

      if (currentTickets.size >= maxTickets) {
        return interaction.editReply({ content: `❌ لقد تجاوزت الحد الأقصى للتكتات المفتوحة لك في هذا السيرفر (${maxTickets} تكت).` });
      }

      const channelName = (ticketType.channelName || 'ticket-{user}')
        .replace('{user}', interaction.user.username)
        .toLowerCase();

      const permissionOverwrites = [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }
      ];

      if (ticketType.mentionRole) {
        permissionOverwrites.push({
          id: ticketType.mentionRole,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
      }

      const parentCategory = ticketType.category || guildConfig.general?.defaultCategory || null;

      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parentCategory,
        topic: `owner:${interaction.user.id} | type:${ticketTypeId}`,
        permissionOverwrites: permissionOverwrites
      });

      const pingString = ticketType.mentionRole ? `<@&${ticketType.mentionRole}>` : '';
      if (pingString) {
        await ticketChannel.send(pingString).then(m => m.delete().catch(() => {}));
      }

      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`مرحبًا بك في تذكرة ${ticketType.name}`)
        .setDescription(ticketType.welcomeMessage || "الرجاء كتابة مشكلتك هنا وسيقوم الفريق المختص بمساعدتك قريباً.")
        .setColor(guildConfig.general?.themeColor || '#4f46e5')
        .setThumbnail(interaction.user.displayAvatarURL());

      // الأزرار الاحترافية الجديدة داخل التكت
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji('🎫').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_add_member_btn').setLabel('Add Member').setEmoji('➕').setStyle(ButtonStyle.Primary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_remove_member_btn').setLabel('Remove Member').setEmoji('➖').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_rename_btn').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary)
      );

      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [welcomeEmbed], components: [row1, row2] });
      await interaction.editReply({ content: `✅ تم إنشاء تذكرتك بنجاح: <#${ticketChannel.id}>` });

      const logEmbed = new EmbedBuilder()
        .setTitle("🔓 تكت مفتوح جديد")
        .setColor('#10b981')
        .addFields(
          { name: "العضو:", value: `<@${interaction.user.id}>` },
          { name: "الروم:", value: `<#${ticketChannel.id}>` },
          { name: "النوع:", value: ticketType.name }
        ).setTimestamp();
      sendLog(interaction.guild, logEmbed);
    }

    // زر Claim التفاعلي
    if (customId === 'ticket_claim') {
      const topic = interaction.channel.topic || '';
      if (topic.includes('claimed:')) {
        const claimer = topic.split('claimed:')[1]?.trim();
        return interaction.reply({ content: `⚠️ هذا التكت مستلم بالفعل بواسطة الإداري: <@${claimer}>`, ephemeral: true });
      }

      await interaction.channel.setTopic(`${topic} | claimed:${interaction.user.id}`);
      await interaction.reply({ content: `✅ تم استلام هذا التكت بواسطة <@${interaction.user.id}>` });

      const logEmbed = new EmbedBuilder()
        .setTitle("🎫 تكت مستلم")
        .setColor('#6366f1')
        .addFields(
          { name: "التكت:", value: `<#${interaction.channel.id}>` },
          { name: "المنفذ:", value: `<@${interaction.user.id}>` }
        ).setTimestamp();
      sendLog(interaction.guild, logEmbed);
    }

    // زر إضافة عضو (فتح المودال)
    if (customId === 'ticket_add_member_btn') {
      const modal = new ModalBuilder().setCustomId('modal_add_member').setTitle('إضافة عضو للتكت');
      const input = new TextInputBuilder()
        .setCustomId('user_id_input')
        .setLabel('معرف العضو (User ID) أو المنشن')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('مثال: 123456789012345678')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    // زر إزالة عضو (فتح المودال)
    if (customId === 'ticket_remove_member_btn') {
      const modal = new ModalBuilder().setCustomId('modal_remove_member').setTitle('إزالة عضو من التكت');
      const input = new TextInputBuilder()
        .setCustomId('user_id_input')
        .setLabel('معرف العضو (User ID) أو المنشن')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('مثال: 123456789012345678')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    // زر إعادة تسمية التكت (فتح المودال)
    if (customId === 'ticket_rename_btn') {
      const modal = new ModalBuilder().setCustomId('modal_rename').setTitle('إعادة تسمية التكت');
      const input = new TextInputBuilder()
        .setCustomId('new_name_input')
        .setLabel('الاسم الجديد للتكت (بدون مسافات)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('مثال: دعم-فني')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    // تأكيد إغلاق التكت
    if (customId === 'ticket_close_confirm') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close_yes').setLabel('تأكيد الإغلاق').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_close_no').setLabel('إلغاء').setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({ content: '❓ هل أنت متأكد من إغلاق التكت بالكامل الآن؟', components: [row] });
    }

    if (customId === 'ticket_close_no') {
      await interaction.message.delete().catch(() => {});
    }

    // تنفيذ الإغلاق وبناء ترانسكريبت احترافي زجاجي مدمج
    if (customId === 'ticket_close_yes') {
      await interaction.reply({ content: '⏳ جاري تصدير أرشيف التكت وإغلاق الروم...' });

      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const sortedMessages = messages.reverse();

      const serverIcon = interaction.guild.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png';
      
      // بناء تصميم ترانسكريبت ويب فاخر
      let transcriptHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>أرشيف تكت: ${interaction.channel.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
          body { background-color: #0b0f19; color: #f1f5f9; font-family: 'Tajawal', sans-serif; padding: 30px; }
          .container { max-w: 900px; margin: 0 auto; background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .header { display: flex; align-items: center; gap: 20px; padding-bottom: 20px; border-b: 1px solid rgba(255,255,255,0.1); margin-bottom: 30px; }
          .header img { width: 80px; height: 80px; border-radius: 50%; border: 3px solid #6366f1; }
          .header h2 { margin: 0; color: #fff; font-size: 24px; }
          .meta-info { font-size: 13px; color: #94a3b8; line-height: 1.6; }
          .message-box { display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px; padding: 15px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.03); transition: 0.2s; }
          .message-box:hover { background: rgba(255,255,255,0.04); }
          .avatar { width: 45px; height: 45px; border-radius: 50%; object-fit: cover; }
          .msg-header { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
          .user { font-weight: 700; color: #818cf8; font-size: 15px; }
          .time { font-size: 11px; color: #64748b; }
          .content { font-size: 14px; color: #e2e8f0; line-height: 1.5; word-break: break-word; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${serverIcon}" />
            <div>
              <h2>أرشيف تكت: ${interaction.channel.name}</h2>
              <div class="meta-info">
                السيرفر: <b>${interaction.guild.name}</b><br/>
                تاريخ الإغلاق: <b>${new Date().toLocaleString()}</b><br/>
                أغلق بواسطة: <b>${interaction.user.tag}</b>
              </div>
            </div>
          </div>
          <div class="messages">
      `;

      sortedMessages.forEach(m => {
        const authorAvatar = m.author.displayAvatarURL() || 'https://cdn.discordapp.com/embed/avatars/0.png';
        transcriptHtml += `
          <div class="message-box">
            <img class="avatar" src="${authorAvatar}" />
            <div>
              <div class="msg-header">
                <span class="user">${m.author.tag}</span>
                <span class="time">${m.createdAt.toLocaleString()}</span>
              </div>
              <div class="content">${m.content || "*وسائط أو رسالة فارغة*"}</div>
            </div>
          </div>
        `;
      });

      transcriptHtml += `
          </div>
        </div>
      </body>
      </html>
      `;

      const attachment = new AttachmentBuilder(Buffer.from(transcriptHtml, 'utf-8'), { name: `transcript-${interaction.channel.name}.html` });

      const logEmbed = new EmbedBuilder()
        .setTitle("🔒 تكت مغلق")
        .setColor('#ef4444')
        .addFields(
          { name: "اسم الروم:", value: `${interaction.channel.name}` },
          { name: "أغلق بواسطة:", value: `<@${interaction.user.id}>` }
        ).setTimestamp();

      // إرسال الأرشيف لقناة الترانسكريبت المحددة، أو قناة اللوق كخيار بديل
      const transChanId = guildConfig?.general?.transcriptChannel || guildConfig?.general?.logsChannel;
      if (transChanId) {
        const transChan = interaction.guild.channels.cache.get(transChanId);
        if (transChan) {
          await transChan.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
        }
      }

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);