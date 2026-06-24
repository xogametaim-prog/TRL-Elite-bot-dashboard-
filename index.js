const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits, 
    ChannelType,
    REST,
    Routes
} = require('discord.js');
const express = require('express');

// إعداد خادم الويب لمنصة Render (ربطه بجميع المنافذ 0.0.0.0 لضمان الاستقرار)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot status: Active!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// البريفكس الاحتياطي في حال عدم ظهور أوامر السلاش
const PREFIX = '!'; 

// ==================== إعدادات نظام التذاكر المطور ====================
const TICKET_CONFIG = {
    // ضع هنا أيدي القسم (Category) الذي تفتح فيه التذاكر
    categoryID: 'ضع_هنا_أيدي_القسم', 

    // روابط الصور (يمكنك تغييرها أو تركها فارغة '' إذا كنت لا تريد صوراً)
    mainEmbedImage: 'https://i.imgur.com/ضع_رابط_صورة_البوكس_الرئيسي_هنا.png', 
    ticketEmbedImage: 'https://i.imgur.com/ضع_رابط_صورة_التذكرة_الداخلية_هنا.png',

    // الخيارات الخمسة والرتب المخصصة للاستلام
    options: [
        {
            value: 'option_1',
            label: 'الدعم الفني والتقني',
            description: 'للمشاكل البرمجية والتقنية داخل السيرفر',
            emoji: '🛠️',
            roleId: 'ضع_ايدي_الرتبة_1', 
        },
        {
            value: 'option_2',
            label: 'الاستفسارات العامة',
            description: 'لأي سؤال عام تود طرحه على الإدارة',
            emoji: '❓',
            roleId: 'ضع_ايدي_الرتبة_2', 
        },
        {
            value: 'option_3',
            label: 'الشكاوى والبلاغات',
            description: 'لتقديم شكوى ضد عضو أو الإبلاغ عن مشكلة',
            emoji: '⚠️',
            roleId: 'ضع_ايدي_الرتبة_3', 
        },
        {
            value: 'option_4',
            label: 'المبيعات والاشتراكات',
            description: 'للاستفسار عن الأسعار أو الشراء المباشر',
            emoji: '💰',
            roleId: 'ضع_ايدي_الرتبة_4', 
        },
        {
            value: 'option_5',
            label: 'الإدارة العليا',
            description: 'للتواصل المباشر والحالات الخاصة جداً',
            emoji: '👑',
            roleId: 'ضع_ايدي_الرتبة_5', 
        }
    ]
};
// ====================================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    const commands = [
        {
            name: 'setup-ticket',
            description: 'إنشاء رسالة نظام التذاكر بالقائمة المنسدلة'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('Registering slash commands...');
        // تم تحديث التسجيل ليكون شاملاً وفورياً
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('Successfully registered commands.');
    } catch (error) {
        console.error(error);
    }
});

// دالة مساعدة لإنشاء وإرسال البوكس الرئيسي (الذي تم استدعاؤه بـ السلاش أو البريفكس)
async function sendTicketSetup(channel) {
    const embed = new EmbedBuilder()
        .setTitle('الدعم الفني | Support')
        .setDescription('مرحباً بك في نظام الدعم الفني الخاص بنا.\nيرجى تحديد القسم المناسب لمشكلتك من القائمة المنسدلة أدناه لفتح تذكرة مباشرة مع الطاقم المختص.')
        .setColor('#2b2d31');

    if (TICKET_CONFIG.mainEmbedImage && TICKET_CONFIG.mainEmbedImage.startsWith('http')) {
        embed.setImage(TICKET_CONFIG.mainEmbedImage);
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_menu_select')
        .setPlaceholder('الرجاء اختيار قسم لفتح التذكرة...')
        .addOptions(
            TICKET_CONFIG.options.map(opt => 
                new StringSelectMenuOptionBuilder()
                    .setValue(opt.value)
                    .setLabel(opt.label)
                    .setDescription(opt.description)
                    .setEmoji(opt.emoji)
            )
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await channel.send({ embeds: [embed], components: [row] });
}

// 1. التعامل مع الأوامر العادية بالبريفكس (حل مشكلة عدم ظهور السلاش)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/+/);
    const command = args.shift().toLowerCase();

    if (command === 'setup-ticket' || command === 'setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ عذراً، هذا الأمر مخصص للإداريين فقط.');
        }

        try {
            await sendTicketSetup(message.channel);
            await message.delete().catch(() => {}); // حذف رسالة الأمر للحفاظ على مظهر القناة
        } catch (err) {
            console.error(err);
        }
    }
});

// 2. التعامل مع أوامر السلاش (إذا ظهرت لاحقاً)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'عذراً، هذا الأمر مخصص للإداريين فقط.', ephemeral: true });
            }

            await interaction.reply({ content: 'تم إعداد نظام التذاكر بنجاح!', ephemeral: true });
            await sendTicketSetup(interaction.channel);
        }
    }

    // 3. عند اختيار قسم من القائمة المنسدلة
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_menu_select') {
            await interaction.deferReply({ ephemeral: true });

            const selectedValue = interaction.values[0];
            const selectedOption = TICKET_CONFIG.options.find(opt => opt.value === selectedValue);

            if (!selectedOption) {
                return interaction.editReply({ content: 'عذراً، حدث خطأ في معالجة طلبك.' });
            }

            const guild = interaction.guild;
            const member = interaction.member;

            const permissionOverwrites = [
                {
                    id: guild.id, // إخفاء القناة عن الجميع
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: member.id, // السماح للعضو برؤية التذكرة والكتابة
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                }
            ];

            // إتاحة رؤية القناة للرتبة المسؤولة عن القسم قبل الاستلام
            if (selectedOption.roleId) {
                permissionOverwrites.push({
                    id: selectedOption.roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                });
            }

            try {
                const channelName = `ticket-${selectedOption.value}-${member.user.username}`;
                const channel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: TICKET_CONFIG.categoryID || null,
                    permissionOverwrites: permissionOverwrites
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle(`تذكرة جديدة - ${selectedOption.label}`)
                    .setDescription(`أهلاً بك ${member}، لقد قمت بفتح تذكرة في قسم **${selectedOption.label}**.\n\nيرجى كتابة مشكلتك هنا بوضوح وانتظار استلام التذكرة من قبل الإداري المختص.`)
                    .setColor('#5865F2')
                    .setTimestamp();

                if (TICKET_CONFIG.ticketEmbedImage && TICKET_CONFIG.ticketEmbedImage.startsWith('http')) {
                    welcomeEmbed.setImage(TICKET_CONFIG.ticketEmbedImage);
                }

                // زر الاستلام وزر الإغلاق
                const claimButton = new ButtonBuilder()
                    .setCustomId(`claim_ticket_${selectedOption.value}`)
                    .setLabel('استلام التذكرة')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🙋‍♂️');

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_ticket_${selectedOption.value}`)
                    .setLabel('إغلاق التذكرة')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

                const supportRoleMention = selectedOption.roleId ? `<@&${selectedOption.roleId}>` : '';
                await channel.send({ 
                    content: `${member} ${supportRoleMention}`, 
                    embeds: [welcomeEmbed], 
                    components: [row] 
                });

                await interaction.editReply({ content: `تم إنشاء تذكرتك بنجاح: ${channel}` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'حدث خطأ أثناء محاولة إنشاء التذكرة. يرجى التحقق من صلاحيات البوت.' });
            }
        }
    }

    // 4. معالجة أزرار الاستلام والإغلاق (حماية تامة وصلاحيات مقيدة)
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // أ- زر الاستلام
        if (customId.startsWith('claim_ticket_')) {
            const optionValue = customId.replace('claim_ticket_', '');
            const selectedOption = TICKET_CONFIG.options.find(opt => opt.value === optionValue);

            if (!selectedOption) return;

            const member = interaction.member;

            // التحقق من أن الشخص الذي ضغط على الزر يملك الرتبة المحددة للقسم أو هو مدير السيرفر
            const hasRequiredRole = member.roles.cache.has(selectedOption.roleId) || member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المطلوبة لهذا القسم!', ephemeral: true });
            }

            // تخزين أيدي الإداري المستلم في وصف موضوع القناة كمرجع دائم بدون داتابيس
            await interaction.channel.setTopic(`claimed_by:${member.id}`);

            // تعديل أزرار الرسالة لتعطيل زر الاستلام وعرض اسم المستلم
            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .addFields({ name: 'المشرف المستلم', value: `👤 تم الاستلام بواسطة: ${member}` });

            const disabledClaimButton = new ButtonBuilder()
                .setCustomId('claimed_disabled_btn')
                .setLabel(`مستلمة بواسطة ${member.user.username}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(true);

            const closeButton = new ButtonBuilder()
                .setCustomId(`close_ticket_${optionValue}`)
                .setLabel('إغلاق التذكرة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const row = new ActionRowBuilder().addComponents(disabledClaimButton, closeButton);

            await interaction.update({ embeds: [updatedEmbed], components: [row] });
            
            // إرسال تنبيه في القناة يشير إلى العضو بأن طلبه قيد المراجعة
            await interaction.followUp({ content: `🔔 تم استلام التذكرة من قبل المشرف المختص ${member}. يرجى الانتظار لقراءة استفسارك.` });
        }

        // ب- زر الإغلاق
        if (customId.startsWith('close_ticket_')) {
            const optionValue = customId.replace('close_ticket_', '');
            const selectedOption = TICKET_CONFIG.options.find(opt => opt.value === optionValue);

            const member = interaction.member;
            const topic = interaction.channel.topic || '';
            const isClaimer = topic.includes(`claimed_by:${member.id}`);
            const hasSupportRole = selectedOption && member.roles.cache.has(selectedOption.roleId);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            // يسمح بالإغلاق فقط لـ: المشرف الذي قام بالاستلام، أو شخص يملك رتبة القسم، أو مدير السيرفر
            if (!isClaimer && !hasSupportRole && !isAdmin) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط للمشرف الذي استلمها أو الإدارة العليا.', ephemeral: true });
            }

            await interaction.reply({ content: '⚠️ سيتم إغلاق التذكرة وحذف هذه القناة بعد 5 ثوانٍ...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error('Failed to delete channel:', err);
                }
            }, 5000);
        }
    }
});

client.login(TOKEN);