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
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const { startDashboard } = require('./dashboard.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User]
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
    },
    {
      name: 'add-member',
      description: 'إضافة عضو إلى التكت الحالي',
      options: [{ name: 'user', type: 6, description: 'العضو المطلوب إضافته', required: true }]
    },
    {
      name: 'remove-member',
      description: 'إزالة عضو من التكت الحالي',
      options: [{ name: 'user', type: 6, description: 'العضو المطلوب إزالته', required: true }]
    },
    {
      name: 'rename',
      description: 'تغيير اسم روم التكت',
      options: [{ name: 'name', type: 3, description: 'الاسم الجديد لروم التكت', required: true }]
    }
  ];

  await client.application.commands.set(commands);
  startDashboard(client);
});

async function sendLog(guild, embed) {
  const guildConfig = client.config.guilds[guild.id];
  if (!guildConfig || !guildConfig.general?.logsChannel) return;
  const channel = guild.channels.cache.get(guildConfig.general.logsChannel);
  if (channel) {
    channel.send({ embeds: [embed] }).catch(() => {});
  }
}

// فعاليات انضمام الأعضاء (Welcome & Auto Role)
client.on('guildMemberAdd', async (member) => {
  const guildConfig = client.config.guilds[member.guild.id];
  if (!guildConfig) return;

  // نظام Auto Role
  if (guildConfig.autoRole?.enabled && guildConfig.autoRole?.roleId) {
    const role = member.guild.roles.cache.get(guildConfig.autoRole.roleId);
    if (role) {
      member.roles.add(role).catch(() => {});
    }
  }

  // نظام Welcome System
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

client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild) return;
  const guildConfig = client.config.guilds[interaction.guild.id];

  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup-ticket') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ يجب أن تمتلك صلاحية مدير لإعداد التكت.', ephemeral: true });
      }
      if (!guildConfig || !guildConfig.tickets || guildConfig.tickets.length === 0) {
        return interaction.reply({ content: '❌ يرجى تهيئة خيارات وأنواع التكت من لوحة التحكم أولاً.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(guildConfig.general?.botName || "نظام التذاكر")
        .setDescription("اختر نوع التذكرة لفتح تكت جديد والمتابعة مع الدعم الفني.")
        .setColor(guildConfig.general?.themeColor || '#4f46e5');

      const row = new ActionRowBuilder();
      guildConfig.tickets.forEach(ticket => {
        let style = ButtonStyle.Primary;
        if (ticket.color === 'Secondary') style = ButtonStyle.Secondary;
        if (ticket.color === 'Success') style = ButtonStyle.Success;
        if (ticket.color === 'Danger') style = ButtonStyle.Danger;

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_open_${ticket.id}`)
            .setLabel(ticket.name)
            .setEmoji(ticket.emoji || "📩")
            .setStyle(style)
        );
      });

      const channelId = guildConfig.general?.ticketChannel || interaction.channel.id;
      const targetChannel = interaction.guild.channels.cache.get(channelId) || interaction.channel;
      
      await targetChannel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: `✅ تم إرسال بنل التكت إلى الروم <#${targetChannel.id}>`, ephemeral: true });
    }

    if (commandName === 'add-member' || commandName === 'remove-member') {
      if (!interaction.channel.name.includes('ticket-')) {
        return interaction.reply({ content: '❌ هذا الأمر مخصص للاستخدام داخل تكت مفتوح فقط.', ephemeral: true });
      }
      const user = interaction.options.getUser('user');
      if (commandName === 'add-member') {
        await interaction.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true
        });
        interaction.reply({ content: `✅ تم إضافة ${user} إلى التكت.` });
        
        const embed = new EmbedBuilder()
          .setTitle("👤 إضافة عضو للتكت")
          .setColor('#42f560')
          .addFields(
            { name: "التكت:", value: `${interaction.channel.name}` },
            { name: "العضو المضاف:", value: `<@${user.id}>` },
            { name: "بواسطة:", value: `<@${interaction.user.id}>` }
          ).setTimestamp();
        sendLog(interaction.guild, embed);
      } else {
        await interaction.channel.permissionOverwrites.delete(user.id);
        interaction.reply({ content: `✅ تم إزالة ${user} من التكت.` });

        const embed = new EmbedBuilder()
          .setTitle("👤 إزالة عضو من التكت")
          .setColor('#f54242')
          .addFields(
            { name: "التكت:", value: `${interaction.channel.name}` },
            { name: "العضو المزال:", value: `<@${user.id}>` },
            { name: "بواسطة:", value: `<@${interaction.user.id}>` }
          ).setTimestamp();
        sendLog(interaction.guild, embed);
      }
    }

    if (commandName === 'rename') {
      if (!interaction.channel.name.includes('ticket-')) {
        return interaction.reply({ content: '❌ هذا الأمر مخصص للاستخدام داخل تكت مفتوح فقط.', ephemeral: true });
      }
      const newName = interaction.options.getString('name');
      const oldName = interaction.channel.name;
      await interaction.channel.setName(`ticket-${newName}`);
      interaction.reply({ content: `✅ تم تعديل اسم الروم من \`${oldName}\` إلى \`ticket-${newName}\`.` });

      const embed = new EmbedBuilder()
        .setTitle("📝 تغيير اسم تكت")
        .setColor('#3b82f6')
        .addFields(
          { name: "من:", value: `\`${oldName}\`` },
          { name: "إلى:", value: `\`ticket-${newName}\`` },
          { name: "بواسطة:", value: `<@${interaction.user.id}>` }
        ).setTimestamp();
      sendLog(interaction.guild, embed);
    }
  }

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

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('استلام التكت (Claim)')
          .setEmoji('🙋‍♂️')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ticket_close_confirm')
          .setLabel('إغلاق التكت')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [welcomeEmbed], components: [row] });
      await interaction.editReply({ content: `✅ تم إنشاء تذكرتك بنجاح: <#${ticketChannel.id}>` });

      const logEmbed = new EmbedBuilder()
        .setTitle("🔓 تكت مفتوح جديد")
        .setColor('#10b981')
        .addFields(
          { name: "العضو:", value: `<@${interaction.user.id}> (${interaction.user.id})` },
          { name: "رقم الروم:", value: `<#${ticketChannel.id}>` },
          { name: "النوع:", value: ticketType.name }
        ).setTimestamp();
      sendLog(interaction.guild, logEmbed);
    }

    if (customId === 'ticket_claim') {
      const topic = interaction.channel.topic || '';
      if (topic.includes('claimed:')) {
        const claimer = topic.split('claimed:')[1]?.trim();
        return interaction.reply({ content: `⚠️ هذا التكت مستلم بالفعل بواسطة الإداري: <@${claimer}>`, ephemeral: true });
      }

      await interaction.channel.setTopic(`${topic} | claimed:${interaction.user.id}`);
      await interaction.reply({ content: `✅ تم استلام هذا التكت بواسطة <@${interaction.user.id}>` });

      const logEmbed = new EmbedBuilder()
        .setTitle("🙋‍♂️ تكت مستلم")
        .setColor('#6366f1')
        .addFields(
          { name: "التكت:", value: `<#${interaction.channel.id}>` },
          { name: "المنفذ:", value: `<@${interaction.user.id}>` }
        ).setTimestamp();
      sendLog(interaction.guild, logEmbed);
    }

    if (customId === 'ticket_close_confirm') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_close_yes')
          .setLabel('تأكيد الإغلاق')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('ticket_close_no')
          .setLabel('إلغاء')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ content: '❓ هل أنت متأكد من إغلاق التكت بالكامل الآن؟', components: [row] });
    }

    if (customId === 'ticket_close_no') {
      await interaction.message.delete().catch(() => {});
    }

    if (customId === 'ticket_close_yes') {
      await interaction.reply({ content: '⏳ جاري تصدير الأرشيف وإغلاق التكت...' });

      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      let transcriptHtml = `
      <!DOCTYPE html>
      <html lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>أرشيف تكت: ${interaction.channel.name}</title>
        <style>
          body { background-color: #0f172a; color: #cbd5e1; font-family: sans-serif; padding: 20px; direction: rtl; }
          .message-box { display: flex; align-items: flex-start; margin-bottom: 15px; background: rgba(30,41,59,0.5); padding: 10px; border-radius: 8px; }
          .avatar { width: 45px; height: 45px; border-radius: 50%; margin-left: 15px; }
          .user { font-weight: bold; color: #818cf8; margin-bottom: 5px; }
          .time { font-size: 0.75rem; color: #64748b; margin-right: 10px; }
          .content { font-size: 0.95rem; }
        </style>
      </head>
      <body>
        <h2>أرشيف تكت: ${interaction.channel.name}</h2>
        <hr style="border-color: #334155; margin-bottom: 20px;"/>
      `;

      messages.reverse().forEach(m => {
        transcriptHtml += `
        <div class="message-box">
          <img class="avatar" src="${m.author.displayAvatarURL()}" />
          <div>
            <div class="user">${m.author.tag} <span class="time">${m.createdAt.toLocaleString()}</span></div>
            <div class="content">${m.content || "*محتوى فارغ أو وسائط متعددة*"}</div>
          </div>
        </div>
        `;
      });

      transcriptHtml += `</body></html>`;
      const attachment = new AttachmentBuilder(Buffer.from(transcriptHtml, 'utf-8'), { name: `transcript-${interaction.channel.name}.html` });

      const logEmbed = new EmbedBuilder()
        .setTitle("🔒 تكت مغلق")
        .setColor('#ef4444')
        .addFields(
          { name: "اسم الروم:", value: `${interaction.channel.name}` },
          { name: "أغلق بواسطة:", value: `<@${interaction.user.id}>` }
        ).setTimestamp();

      const guildConfig = client.config.guilds[interaction.guild.id];
      if (guildConfig && guildConfig.general?.logsChannel) {
        const logChan = interaction.guild.channels.cache.get(guildConfig.general.logsChannel);
        if (logChan) {
          await logChan.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
        }
      }

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);