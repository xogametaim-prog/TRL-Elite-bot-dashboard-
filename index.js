/**
 * 🤖 INDEX.JS - DISCORD BOT ONLY
 * مسؤول عن جميع أحداث البوت والتفاعل داخل ديسكورد
 */

const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(__dirname, 'config.json');

// استدعاء خادم الويب من الملف المستقل
const { startWebServer, getDatabase, saveDatabase, syncDatabaseCloud } = require('./dashboard.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// جلب الإعدادات الخاصة بالسيرفر ديناميكياً
function getGuildConfig(guildId) {
    const db = getDatabase();
    if (!db.guilds[guildId]) {
        db.guilds[guildId] = {
            logsChannelId: "",
            embedChannelId: "",
            defaultCategoryId: "",
            maxTicketsPerUser: 4, 
            embed: {
                title: "🎫 مركز المساعدة والدعم الفني",
                description: "أهلاً بك في مركز الدعم. يرجى النقر على القسم المطلوب بالأسفل للتحدث مع فريق العمل الإداري.",
                color: "#3b82f6",
                author: "ticket bot.v1",
                footer: "نحن هنا لخدمتك دائماً",
                thumbnail: "",
                image: "",
                timestamp: true
            },
            buttons: [
                {
                    label: "الدعم الفني والشكاوى",
                    emoji: "🎫",
                    style: "PRIMARY",
                    ticketName: "ticket-{username}",
                    mentionRole: "",
                    categoryId: "",
                    welcomeMessage: "أهلاً بك {user} في قسم الدعم والشكاوى! يرجى طرح مشكلتك أو استفسارك بالتفصيل وسيقوم أحد الإداريين بالرد عليك في أقرب وقت."
                }
            ],
            activeEmbedMessageId: "",
            autoReplies: [], 
            welcome: {
                enabled: false,
                channelId: "",
                mentionUser: true,
                message: "مرحباً بك {user} في سيرفرنا الرائع! نورت السيرفر ✨",
                bgUrl: "https://i.imgur.com/4S7jFv1.png"
            },
            embedSender: {
                title: "",
                description: "",
                color: "#3b82f6",
                image: "",
                thumbnail: "",
                footer: "",
                author: "",
                targetChannelId: "",
                lastMessageId: ""
            },
            autoRole: {
                enabled: false,
                roleId: ""
            }
        };
        saveDatabase(db);
    }
    return db.guilds[guildId];
}

// تصدير الـ Client لملف الداشبورد لقراءة البيانات المباشرة
module.exports = { client };

// ==================== أحداث وتفاعلات البوت ====================

// حدث ترحيب الأعضاء ودخولهم (Welcome Card & Auto Role Events)
client.on('guildMemberAdd', async member => {
    const guildId = member.guild.id;
    const config = getGuildConfig(guildId);

    // 1. نظام الـ Auto Role
    if (config.autoRole && config.autoRole.enabled && config.autoRole.roleId) {
        try {
            const role = member.guild.roles.cache.get(config.autoRole.roleId);
            if (role) await member.roles.add(role);
        } catch (e) {
            console.error("Auto Role assignment failed: ", e.message);
        }
    }

    // 2. نظام الترحيب مع توليد بطاقة ترحيب فائقة الدقة SVG
    if (config.welcome && config.welcome.enabled && config.welcome.channelId) {
        const channel = member.guild.channels.cache.get(config.welcome.channelId);
        if (channel) {
            const memberCount = member.guild.memberCount;
            const welcomeText = (config.welcome.message || "مرحباً بك {user}").replace('{user}', `${member}`);
            const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
            const cleanName = member.user.username.replace(/[^a-zA-Z0-9\s]/g, '');

            const svgCard = `
            <svg width="800" height="350" viewBox="0 0 800 350" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="350" rx="20" fill="#05070f" />
                <rect x="10" y="10" width="780" height="330" rx="15" fill="none" stroke="#3b82f6" stroke-width="3" />
                <circle cx="400" cy="110" r="70" fill="none" stroke="#8b5cf6" stroke-width="4" />
                <clipPath id="avatar-clip">
                    <circle cx="400" cy="110" r="68" />
                </clipPath>
                <image href="${avatarUrl}" x="332" y="42" width="136" height="136" clip-path="url(#avatar-clip)" />
                <text x="400" y="225" font-family="Segoe UI, sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">مرحباً بك في السيرفر</text>
                <text x="400" y="265" font-family="Segoe UI, sans-serif" font-size="24" font-weight="600" fill="#3b82f6" text-anchor="middle">${cleanName}</text>
                <text x="400" y="305" font-family="Segoe UI, sans-serif" font-size="18" fill="#8b5cf6" text-anchor="middle">العضو رقم #${memberCount}</text>
            </svg>
            `;

            const buffer = Buffer.from(svgCard, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: 'welcome-card.svg' });

            channel.send({ content: welcomeText, files: [attachment] }).catch(e => console.error(e.message));
        }
    }
});

// استقبال الرسائل وتطبيق الرد التلقائي
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const guildId = message.guildId;
    if (!guildId) return;

    const config = getGuildConfig(guildId);
    
    if (config.autoReplies && config.autoReplies.length > 0) {
        const text = message.content.toLowerCase().trim();
        const found = config.autoReplies.find(item => {
            if (!item.enabled) return false;
            const isTargetChannel = item.channelId === 'all' || item.channelId === message.channel.id;
            return isTargetChannel && item.keyword.toLowerCase().trim() === text;
        });
        
        if (found) {
            message.channel.send(found.reply).catch(e => console.error(e.message));
        }
    }
});

// تفاعلات أزرار ومودالات التذاكر ديسكورد
client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;
    const config = getGuildConfig(guildId);

    if (interaction.isButton()) {
        const customId = interaction.customId;

        // فتح تكت جديد
        if (customId.startsWith('open_ticket_')) {
            await interaction.deferReply({ ephemeral: true });
            const index = parseInt(customId.replace('open_ticket_', ''));
            const btnConfig = config.buttons[index];

            if (!btnConfig) {
                return interaction.editReply({ content: "خطأ: لم يتم العثور على إعدادات هذا الزر." });
            }

            const maxLimit = Number(config.maxTicketsPerUser) || 4;
            const activeCount = interaction.guild.channels.cache.filter(c => {
                return c.name.startsWith('ticket-') && c.permissionOverwrites.cache.has(interaction.user.id);
            }).size;

            if (activeCount >= maxLimit) {
                return interaction.editReply({ content: `⚠️ عذراً، لقد تجاوزت الحد الأقصى للتذاكر المفتوحة وهو: **${maxLimit} تكت**.` });
            }

            const cleanName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
            const expectedName = (btnConfig.ticketName || 'ticket-{username}').replace('{username}', cleanName);

            const duplicate = interaction.guild.channels.cache.find(c => c.name === expectedName);
            if (duplicate) {
                return interaction.editReply({ content: `لديك تكت مفتوح بالفعل: <#${duplicate.id}>` });
            }

            const parentId = btnConfig.categoryId || config.defaultCategoryId || null;
            const permissionOverwrites = [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ]
                }
            ];

            if (btnConfig.mentionRole) {
                permissionOverwrites.push({
                    id: btnConfig.mentionRole,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ]
                });
            }

            try {
                const ticketChannel = await interaction.guild.channels.create({
                    name: expectedName,
                    type: ChannelType.GuildText,
                    parent: parentId,
                    permissionOverwrites: permissionOverwrites
                });

                logEvent('open', guildId, { user: interaction.user, channel: ticketChannel, buttonLabel: btnConfig.label });

                const welcome = (btnConfig.welcomeMessage || "مرحباً {user}").replace('{user}', `<@${interaction.user.id}>`);
                const roleMention = btnConfig.mentionRole ? `<@&${btnConfig.mentionRole}>` : '';

                const embed = new EmbedBuilder()
                    .setTitle(`مركز الخدمات والدعم - ${btnConfig.label}`)
                    .setDescription(welcome)
                    .setColor(config.dashboardColor || "#3b82f6")
                    .setTimestamp();

                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_close').setLabel('إغلاق 🔒').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ticket_claim').setLabel('استلام 🔑').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_rename').setLabel('تغيير الاسم ✏️').setStyle(ButtonStyle.Secondary)
                );
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_add_member').setLabel('إضافة عضو 👤').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_remove_member').setLabel('إزالة عضو ➖').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_transcript').setLabel('أرشيف محلي 📄').setStyle(ButtonStyle.Secondary)
                );

                await ticketChannel.send({
                    content: `${roleMention} ${interaction.user}`,
                    embeds: [embed],
                    components: [row1, row2]
                });

                await interaction.editReply({ content: `تم فتح التكت بنجاح: <#${ticketChannel.id}>` });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: "فشل إنشاء التكت. يرجى رفع رتبة البوت وتعديل الصلاحيات بالسيرفر." });
            }
        }

        // إغلاق التكت
        if (customId === 'ticket_close') {
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('تأكيد الإغلاق 🔒').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('إلغاء').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ content: 'هل تريد تأكيد إغلاق هذه التكت وحفظ الأرشيف باللوق؟', components: [confirmRow] });
        }

        if (customId === 'ticket_close_cancel') {
            await interaction.message.delete().catch(() => {});
        }

        if (customId === 'ticket_close_confirm') {
            await interaction.reply({ content: 'جاري توليد الأرشيف HTML وإغلاق التكت خلال 5 ثوانٍ...' });
            const channel = interaction.channel;
            const guild = interaction.guild;

            const transcriptHtml = await generateTranscript(channel);
            const logsChannelId = config.logsChannelId;

            if (logsChannelId) {
                const logsChannel = guild.channels.cache.get(logsChannelId);
                if (logsChannel) {
                    const buffer = Buffer.from(transcriptHtml, 'utf-8');
                    await logsChannel.send({
                        content: `📄 **أرشيف تكت:** \`${channel.name}\`\n**تم إغلاقه بواسطة:** ${interaction.user}`,
                        files: [{
                            attachment: buffer,
                            name: `${channel.name}-transcript.html`
                        }]
                    });
                    logEvent('close', guildId, { user: interaction.user, channel: channel });
                }
            }

            setTimeout(async () => {
                await channel.delete().catch(() => {});
            }, 5000);
        }

        // نظام استلام ومتابعة التكت (Claim)
        if (customId === 'ticket_claim') {
            const channel = interaction.channel;
            const member = interaction.member;

            if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: "عذراً، لا تملك الصلاحية الإدارية لاستلام التكت.", ephemeral: true });
            }

            const claimed = channel.topic && channel.topic.startsWith("Claimed_by_");
            if (claimed) {
                const adminId = channel.topic.replace("Claimed_by_", "");
                return interaction.reply({ content: `⚠️ تم استلام هذا التكت بالفعل بواسطة: <@${adminId}>`, ephemeral: true });
            }

            await channel.setTopic(`Claimed_by_${interaction.user.id}`);
            await channel.permissionOverwrites.edit(interaction.user.id, {
                SendMessages: true,
                ViewChannel: true,
                ReadMessageHistory: true
            });

            await interaction.reply({ content: `✅ تم استلام هذا التكت بواسطة الإداري: ${interaction.user}` });
            logEvent('claim', guildId, { user: interaction.user, channel: channel });
        }

        // تغيير اسم التكت
        if (customId === 'ticket_rename') {
            const modal = new ModalBuilder().setCustomId('modal_rename').setTitle('إعادة تسمية التكت');
            const nameInp = new TextInputBuilder()
                .setCustomId('new_name')
                .setLabel('الاسم الجديد للروم')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('support-resolved')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInp));
            await interaction.showModal(modal);
        }

        // إضافة وإزالة أعضاء
        if (customId === 'ticket_add_member') {
            const modal = new ModalBuilder().setCustomId('modal_add_member').setTitle('إضافة عضو للتكت');
            const userInp = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('ID العضو المطلوب إضافته')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(userInp));
            await interaction.showModal(modal);
        }

        if (customId === 'ticket_remove_member') {
            const modal = new ModalBuilder().setCustomId('modal_remove_member').setTitle('إزالة عضو من التكت');
            const userInp = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('ID العضو المطلوب إزالته')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(userInp));
            await interaction.showModal(modal);
        }

        if (customId === 'ticket_transcript') {
            await interaction.reply({ content: 'جاري إنشاء الأرشيف الفوري...' });
            const html = await generateTranscript(interaction.channel);
            const buffer = Buffer.from(html, 'utf-8');
            await interaction.followUp({
                content: 'تفضل، أرشيف التكت الفوري الحالي الموثق:',
                files: [{ attachment: buffer, name: `${interaction.channel.name}-instant.html` }]
            });
        }
    }

    if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        if (customId === 'modal_rename') {
            const newName = interaction.fields.getTextInputValue('new_name').toLowerCase().replace(/\s+/g, '-');
            await interaction.reply({ content: `جاري إعادة تسمية الروم إلى \`${newName}\`...` });
            await interaction.channel.setName(newName);
            logEvent('rename', guildId, { user: interaction.user, channel: interaction.channel, details: newName });
        }

        if (customId === 'modal_add_member') {
            const userId = interaction.fields.getTextInputValue('user_id');
            try {
                const targetMember = await interaction.guild.members.fetch(userId);
                await interaction.channel.permissionOverwrites.edit(targetMember.id, {
                    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true
                });
                await interaction.reply({ content: `تمت إضافة العضو ${targetMember} بنجاح للتكت.` });
                logEvent('add_member', guildId, { user: interaction.user, channel: interaction.channel, details: targetMember.user });
            } catch (err) {
                await interaction.reply({ content: 'عذراً، تعذر العثور على العضو بسيرفر ديسكورد بالمعرف المدخل.', ephemeral: true });
            }
        }

        if (customId === 'modal_remove_member') {
            const userId = interaction.fields.getTextInputValue('user_id');
            try {
                const targetMember = await interaction.guild.members.fetch(userId);
                await interaction.channel.permissionOverwrites.delete(targetMember.id);
                await interaction.reply({ content: `تمت إزالة العضو ${targetMember} بنجاح من التكت الفني.` });
                logEvent('remove_member', guildId, { user: interaction.user, channel: interaction.channel, details: targetMember.user });
            } catch (err) {
                await interaction.reply({ content: 'عذراً، تعذر العثور على العضو بسيرفر ديسكورد بالمعرف المدخل.', ephemeral: true });
            }
        }
    }
});

// دالة تسجيل اللوق والأحداث بالسيرفر المخصص
function logEvent(type, guildId, data) {
    const config = getGuildConfig(guildId);
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const logChannel = guild.channels.cache.get(config.logsChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor(config.dashboardColor || "#3b82f6")
        .setTimestamp();

    switch (type) {
        case 'open':
            embed.setTitle('📂 تم إنشاء تكت جديد')
                 .setDescription(`**صاحب التكت:** ${data.user}\n**قناة التكت:** ${data.channel}\n**نوع القسم المختار:** ${data.buttonLabel}`);
            break;
        case 'close':
            embed.setTitle('🔒 تم إغلاق وتصنيف تكت')
                 .setDescription(`**تم الإغلاق بواسطة:** ${data.user}\n**اسم روم التكت:** ${data.channel.name}`);
            break;
        case 'claim':
            embed.setTitle('🔑 تم استلام تكت ومتابعته')
                 .setDescription(`**المشرف المسؤول:** ${data.user}\n**التكت المستهدف:** ${data.channel}`);
            break;
        case 'rename':
            embed.setTitle('✏️ تم تعديل اسم التكت')
                 .setDescription(`**بواسطة:** ${data.user}\n**قناة التكت:** ${data.channel}\n**الاسم الجديد المطبق:** ${data.details}`);
            break;
        case 'add_member':
            embed.setTitle('👤 إضافة عضو جديد للتكت')
                 .setDescription(`**بواسطة:** ${data.user}\n**التكت:** ${data.channel}\n**العضو الذي تمت إضافته:** ${data.details}`);
            break;
        case 'remove_member':
            embed.setTitle('➖ إزالة عضو من التكت')
                 .setDescription(`**بواسطة:** ${data.user}\n**التكت:** ${data.channel}\n**العضو الذي تمت إزالته:** ${data.details}`);
            break;
        case 'embed_send':
            embed.setTitle('📢 نشر لوحة الأزرار الأساسية')
                 .setDescription(`**بواسطة المسؤول:** ${data.user}\n**القناة المستهدفة:** ${data.channel}`);
            break;
        case 'embed_edit':
            embed.setTitle('✏️ تعديل وتحديث لوحة التكت')
                 .setDescription(`**بواسطة المسؤول:** ${data.user}`);
            break;
        case 'embed_delete':
            embed.setTitle('🗑️ إزالة وحذف لوحة التكت')
                 .setDescription(`**بواسطة المسؤول:** ${data.user}`);
            break;
    }

    logChannel.send({ embeds: [embed] }).catch(() => {});
}

async function generateTranscript(channel) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sortedMsgs = Array.from(messages.values()).reverse();

    let msgsMarkup = '';
    sortedMsgs.forEach(msg => {
        const avatar = msg.author.displayAvatarURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const dateStr = msg.createdAt.toLocaleString('ar-EG');
        const textContent = msg.content || '';

        let attachmentsMarkup = '';
        if (msg.attachments.size > 0) {
            msg.attachments.forEach(att => {
                if (att.contentType && att.contentType.startsWith('image/')) {
                    attachmentsMarkup += `<br><img src="${att.url}" style="max-width: 320px; border-radius: 6px; margin-top: 8px;">`;
                } else {
                    attachmentsMarkup += `<br><a href="${att.url}" target="_blank" style="color: #00aff0; font-size: 13px; text-decoration: none;">[تحميل المرفق: ${att.name}]</a>`;
                }
            });
        }

        let embedsMarkup = '';
        if (msg.embeds.length > 0) {
            msg.embeds.forEach(emb => {
                embedsMarkup += `
                <div style="background-color: #2f3136; border-right: 4px solid ${emb.color ? '#' + emb.color.toString(16) : '#5865f2'}; border-radius: 4px; padding: 12px; margin-top: 10px; max-width: 520px;">
                    ${emb.title ? `<div style="font-weight: bold; color: white; margin-bottom: 6px;">${emb.title}</div>` : ''}
                    ${emb.description ? `<div style="font-size: 14px; color: #dcddde; line-height: 1.4;">${emb.description}</div>` : ''}
                </div>
                `;
            });
        }

        msgsMarkup += `
        <div style="display: flex; margin-bottom: 18px; border-bottom: 1px solid #2f3136; padding-bottom: 12px;">
            <img src="${avatar}" style="width: 42px; height: 42px; border-radius: 50%; margin-left: 15px;">
            <div>
                <div>
                    <span style="font-weight: bold; color: white; margin-left: 10px;">${msg.author.username}</span>
                    <span style="color: #72767d; font-size: 12px;">${dateStr}</span>
                </div>
                <div style="color: #dcddde; font-size: 15px; margin-top: 6px; white-space: pre-wrap;">${textContent}</div>
                ${attachmentsMarkup}
                ${embedsMarkup}
            </div>
        </div>
        `;
    });

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>سجلات الأرشيف - تكت ${channel.name}</title>
        <style>
            body { background-color: #1e1f22; color: #dbdee1; font-family: sans-serif; margin: 0; padding: 24px; }
            .header { border-bottom: 2px solid #2f3136; padding-bottom: 20px; margin-bottom: 24px; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .header p { color: #949ba4; margin: 6px 0 0 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>سيرفر: ${channel.guild.name}</h1>
            <p>أرشيف وسجلات المحادثة لقناة: #${channel.name}</p>
            <p>تاريخ تصدير الأرشيف: ${new Date().toLocaleString('ar-EG')}</p>
        </div>
        <div class="messages-container">
            ${msgsMarkup || '<p style="text-align: center; color: #949ba4; padding: 40px;">لا توجد رسائل مسجلة بهذه التكت.</p>'}
        </div>
    </body>
    </html>
    `;
}

// دالة تفاعلية لإرسال Embed من ملف اللوحة المدمج
async function triggerTicketEmbed(guildId, channelId) {
    const config = getGuildConfig(guildId);
    const channel = client.channels.cache.get(channelId);
    if (!channel) throw new Error("قناة الإرسال غير متوفرة أو لم يتم تحديدها بالإعدادات العامة.");

    const embedData = config.embed;
    const embed = new EmbedBuilder()
        .setTitle(embedData.title || "لوحة التكت")
        .setDescription(embedData.description || "انقر بالأسفل للتواصل")
        .setColor(embedData.color || "#3b82f6");

    if (embedData.author) embed.setAuthor({ name: embedData.author });
    if (embedData.footer) embed.setFooter({ text: embedData.footer });
    if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
    if (embedData.image) embed.setImage(embedData.image);
    embed.setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();

    config.buttons.forEach((btn, idx) => {
        let style = ButtonStyle.Primary;
        if (btn.style === 'SECONDARY') style = ButtonStyle.Secondary;
        if (btn.style === 'SUCCESS') style = ButtonStyle.Success;
        if (btn.style === 'DANGER') style = ButtonStyle.Danger;

        const button = new ButtonBuilder()
            .setCustomId(`open_ticket_${idx}`)
            .setLabel(btn.label)
            .setStyle(style);

        if (btn.emoji) button.setEmoji(btn.emoji);
        currentRow.addComponents(button);

        if (currentRow.components.length === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
    });

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    const msg = await channel.send({ embeds: [embed], components: rows });
    config.activeEmbedMessageId = msg.id;
    config.embedChannelId = channelId;
    saveGuildConfig(guildId, config);
    return msg;
}

async function triggerEditEmbed(guildId) {
    const config = getGuildConfig(guildId);
    const channel = client.channels.cache.get(config.embedChannelId);
    if (!channel) throw new Error("لم يتم العثور على القناة المحددة للرسالة.");
    const msg = await channel.messages.fetch(config.activeEmbedMessageId);
    if (!msg) throw new Error("لم يتم العثور على الرسالة لتحديثها بالديسكورد.");

    const embedData = config.embed;
    const embed = new EmbedBuilder()
        .setTitle(embedData.title || "تكت جديد")
        .setDescription(embedData.description || "انقر بالأسفل للتواصل")
        .setColor(embedData.color || "#3b82f6");

    if (embedData.author) embed.setAuthor({ name: embedData.author });
    if (embedData.footer) embed.setFooter({ text: embedData.footer });
    if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
    if (embedData.image) embed.setImage(embedData.image);
    embed.setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();

    config.buttons.forEach((btn, idx) => {
        let style = ButtonStyle.Primary;
        if (btn.style === 'SECONDARY') style = ButtonStyle.Secondary;
        if (btn.style === 'SUCCESS') style = ButtonStyle.Success;
        if (btn.style === 'DANGER') style = ButtonStyle.Danger;

        const button = new ButtonBuilder()
            .setCustomId(`open_ticket_${idx}`)
            .setLabel(btn.label)
            .setStyle(style);

        if (btn.emoji) button.setEmoji(btn.emoji);
        currentRow.addComponents(button);

        if (currentRow.components.length === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
    });

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    await msg.edit({ embeds: [embed], components: rows });
}

async function triggerDeleteEmbed(guildId) {
    const config = getGuildConfig(guildId);
    const channel = client.channels.cache.get(config.embedChannelId);
    if (channel && config.activeEmbedMessageId) {
        try {
            const msg = await channel.messages.fetch(config.activeEmbedMessageId);
            if (msg) await msg.delete();
        } catch (e) {
            console.error("Embed delete error: ", e.message);
        }
    }
    config.activeEmbedMessageId = "";
    saveGuildConfig(guildId, config);
}

// بدء خادم ويب DashBoard المدمج بمجرد استقرار ديسكورد بوت
client.once('ready', () => {
    console.log(`Bot logged in as: ${client.user.tag} (Pro SaaS Mode enabled)`);
    restoreDatabaseCloud();
    startWebServer();
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Failed to login to Discord: ", err.message);
});

module.exports = { triggerTicketEmbed, triggerEditEmbed, triggerDeleteEmbed, logEvent };