// bot.js
const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits 
} = require('discord.js');
const { db } = require('./database');
const EventEmitter = require('events');

class BotEvents extends EventEmitter {}
const botEvents = new BotEvents();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.once('ready', () => {
    console.log(`🤖 Luxury Bot Active: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    try {
        const guildId = interaction.guildId;
        if (!guildId) return;
        const guildData = db.getGuild(guildId);

        if (interaction.isButton() && interaction.customId.startsWith('panel_create_')) {
            const panelId = interaction.customId.split('_')[2];
            const panel = guildData.panels.find(p => p.id === panelId);
            if (!panel) return interaction.reply({ content: "خطأ: لم يتم العثور على الإعدادات الخاصة بهذه اللوحة.", ephemeral: true });

            if (panel.formId) {
                const form = guildData.forms.find(f => f.id === panel.formId);
                if (form && form.questions.length > 0) {
                    const modal = new ModalBuilder()
                        .setCustomId(`form_submit_${panelId}_${form.id}`)
                        .setTitle(form.name);

                    form.questions.slice(0, 5).forEach((q, index) => {
                        const input = new TextInputBuilder()
                            .setCustomId(`q_${index}`)
                            .setLabel(q.label)
                            .setPlaceholder(q.placeholder || '')
                            .setStyle(q.longText ? TextInputStyle.Paragraph : TextInputStyle.Short)
                            .setRequired(q.required);
                        
                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                    });
                    return await interaction.showModal(modal);
                }
            }
            return await createTicketChannel(interaction, panel, {});
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('form_submit_')) {
            const [,, panelId, formId] = interaction.customId.split('_');
            const panel = guildData.panels.find(p => p.id === panelId);
            const form = guildData.forms.find(f => f.id === formId);
            
            const answers = {};
            if (form) {
                form.questions.forEach((q, index) => {
                    answers[q.label] = interaction.fields.getTextInputValue(`q_${index}`);
                });
            }
            await interaction.deferReply({ ephemeral: true });
            return await createTicketChannel(interaction, panel, answers);
        }

        if (interaction.isButton()) {
            const ticketId = interaction.channel.id;
            const ticket = guildData.tickets[ticketId];
            if (!ticket) return;

            if (interaction.customId === 'ticket_claim') {
                ticket.status = 'Claimed';
                ticket.assignedStaff = interaction.user.id;
                ticket.history.push({ action: 'Claimed', user: interaction.user.tag, timestamp: Date.now() });
                db.save();

                await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                    ViewChannel: true, SendMessages: true, AttachFiles: true
                });

                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#D4AF37')
                    .setFields([
                        { name: "⚜️ الحالة / Status", value: "مستلمة / Claimed", inline: true },
                        { name: "👑 الموظف المسؤول", value: `<@${interaction.user.id}>`, inline: true }
                    ]);
                await interaction.update({ embeds: [embed] });
                db.logAction(guildId, 'TICKET_CLAIMED', { ticketId, user: interaction.user.tag });
                botEvents.emit('update', { guildId });
            }

            if (interaction.customId === 'ticket_close') {
                ticket.status = 'Closed';
                ticket.closeDate = Date.now();
                ticket.history.push({ action: 'Closed', user: interaction.user.tag, timestamp: Date.now() });
                db.save();

                await interaction.reply({ content: "🔐 جاري معالجة وتوليد الأرشيف وإغلاق التذكرة...", ephemeral: false });
                
                const transcriptHtml = await generateTranscript(interaction.channel, ticket);
                const transcriptBuffer = Buffer.from(transcriptHtml, 'utf-8');

                if (guildData.settings.logChannelId) {
                    const logChannel = await interaction.guild.channels.fetch(guildData.settings.logChannelId).catch(() => null);
                    if (logChannel) {
                        await logChannel.send({
                            content: `⚜️ **سجل التذكرة مؤرشفة رقم #${ticket.number}**`,
                            files: [{ attachment: transcriptBuffer, name: `gold-transcript-${ticket.number}.html` }]
                        });
                    }
                }

                setTimeout(async () => {
                    await interaction.channel.delete().catch(() => null);
                }, 4000);

                db.logAction(guildId, 'TICKET_CLOSED', { ticketId, user: interaction.user.tag });
                botEvents.emit('update', { guildId });
            }
        }
    } catch (err) {
        console.error("Bot Interaction Error:", err);
    }
});

async function createTicketChannel(interaction, panel, answers) {
    const guildId = interaction.guildId;
    const guildData = db.getGuild(guildId);
    
    const ticketNumber = Object.keys(guildData.tickets).length + 1;
    const channelName = `gold-${interaction.user.username}-${ticketNumber}`;

    const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
            { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
            ...(guildData.roles?.staff ? [{ id: guildData.roles.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
        ]
    });

    const ticket = {
        id: channel.id,
        number: ticketNumber,
        category: panel.category,
        status: 'Open',
        priority: 'Royal',
        creator: { id: interaction.user.id, tag: interaction.user.tag, avatar: interaction.user.displayAvatarURL() },
        assignedStaff: null,
        creationDate: Date.now(),
        answers,
        history: [{ action: 'Created', user: interaction.user.tag, timestamp: Date.now() }]
    };

    guildData.tickets[channel.id] = ticket;
    db.save();

    const embed = new EmbedBuilder()
        .setTitle(`⚜️ ${panel.embedTitle || `تذكرة خدمة #${ticketNumber}`}`)
        .setDescription(panel.embedDescription || `مرحباً بك في القسم المخصص، سيتولى مستشار الدعم طلبك في أقرب وقت.`)
        .setColor('#D4AF37')
        .setFooter({ text: 'بوابة التذاكر الفاخرة • Ultra Premium Flow', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    if (Object.keys(answers).length > 0) {
        Object.entries(answers).forEach(([q, a]) => {
            embed.addFields({ name: `📌 ${q}`, value: `\`\`\`${a || "لم تذكر تفاصيل"}\`\`\``, inline: false });
        });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('استلام التذكرة / Claim').setStyle(ButtonStyle.Success).setEmoji('👑'),
        new ButtonBuilder().setCustomId('ticket_close').setLabel('إغلاق التذكرة / Close').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
    );

    await channel.send({ content: `<@${interaction.user.id}> مرحباً بك في بوابة الخدمة المخصصة.`, embeds: [embed], components: [row] });
    
    if (interaction.deferred) {
        await interaction.editReply({ content: `✅ تم إنشاء تذكرتك بنجاح: <#${channel.id}>` });
    } else {
        await interaction.reply({ content: `✅ تم إنشاء تذكرتك بنجاح: <#${channel.id}>`, ephemeral: true });
    }

    db.logAction(guildId, 'TICKET_CREATED', { ticketId: channel.id, user: interaction.user.tag });
    botEvents.emit('update', { guildId });
}

async function generateTranscript(channel, ticket) {
    const messages = await channel.messages.fetch({ limit: 100 });
    let msgHtml = '';
    
    messages.reverse().forEach(m => {
        if (m.author.bot && m.embeds.length === 0 && !m.content.includes("Welcome!") && !m.content.includes("مرحباً")) return;
        const avatar = m.author.displayAvatarURL();
        const content = m.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        msgHtml += `
        <div class="message">
            <img class="avatar" src="${avatar}" alt="Avatar">
            <div class="msg-body">
                <span class="author">${m.author.tag}</span>
                <span class="timestamp">${m.createdAt.toLocaleString()}</span>
                <div class="content">${content}</div>
            </div>
        </div>`;
    });

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <style>
            body { background-color: #0F1115; color: #E5E5E5; font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; }
            .header { border-bottom: 2px solid #D4AF37; padding-bottom: 25px; margin-bottom: 30px; }
            .title { font-size: 26px; color: #D4AF37; font-weight: bold; }
            .meta { font-size: 13px; color: #A3A3A3; margin-top: 8px; }
            .message { display: flex; margin-bottom: 20px; border-bottom: 1px solid rgba(212, 175, 55, 0.08); padding-bottom: 15px; }
            .avatar { width: 42px; height: 42px; border-radius: 50%; border: 1.5px solid #D4AF37; margin-left: 15px; }
            .author { font-weight: bold; color: #FFFFFF; font-size: 15px; }
            .timestamp { font-size: 11px; color: #737373; margin-right: 10px; }
            .content { margin-top: 8px; color: #E5E5E5; font-size: 14px; line-height: 1.6; }
        </style>
        <title>أرشيف التذكرة #${ticket.number}</title>
    </head>
    <body>
        <div class="header">
            <div class="title">⚜️ أرشيف بوابة التذاكر الفاخرة</div>
            <div class="meta">تذكرة رقم: #${ticket.number} | منشئ التذكرة: ${ticket.creator.tag} | التصنيف: ${ticket.category}</div>
        </div>
        <div class="messages">
            ${msgHtml}
        </div>
    </body>
    </html>`;
}

module.exports = { client, botEvents };