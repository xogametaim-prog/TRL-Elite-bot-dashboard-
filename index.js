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

// إعداد خادم ويب لتفادي توقف البوت على منصة Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==================== إعدادات الخيارات الخمسة والرتب ====================
const TICKET_CONFIG = {
    // ضع هنا أيدي القسم (Category) الذي تفتح فيه التذاكر (اختياري)
    // إذا لم تكن تريد قسماً معيناً، اتركها فارغة ''
    categoryID: 'ايدي_قسم_التذاكر_هنا', 

    options: [
        {
            value: 'option_1',
            label: 'الدعم الفني والتقني', // النص الذي يظهر في الخيار الأول
            description: 'للمشاكل البرمجية والتقنية داخل السيرفر', // الوصف
            emoji: '🛠️', // الإيموجي
            roleId: 'ايدي_رتبة_الدعم_الفني_هنا', // أيدي الرتبة التي تستلم هذه التذكرة
        },
        {
            value: 'option_2',
            label: 'الاستفسارات العامة', // الخيار الثاني
            description: 'لأي سؤال عام تود طرحه على الإدارة',
            emoji: '❓',
            roleId: 'ايدي_رتبة_الاستفسارات_هنا', 
        },
        {
            value: 'option_3',
            label: 'الشكاوى والبلاغات', // الخيار الثالث
            description: 'لتقديم شكوى ضد عضو أو الإبلاغ عن مشكلة',
            emoji: '⚠️',
            roleId: 'ايدي_رتبة_الشكاوى_هنا', 
        },
        {
            value: 'option_4',
            label: 'المبيعات والاشتراكات', // الخيار الرابع
            description: 'للاستفسار عن الأسعار أو الشراء المباشر',
            emoji: '💰',
            roleId: 'ايدي_رتبة_المبيعات_هنا', 
        },
        {
            value: 'option_5',
            label: 'الإدارة العليا', // الخيار الخامس
            description: 'للتواصل المباشر والحالات الخاصة جداً',
            emoji: '👑',
            roleId: 'ايدي_رتبة_الإدارة_العليا_هنا', 
        }
    ]
};
// ====================================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    // تسجيل أمر سلاش لإرسال رسالة التذاكر في القناة المطلوبة
    const commands = [
        {
            name: 'setup-ticket',
            description: 'إنشاء رسالة نظام التذاكر بالقائمة المنسدلة'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('Successfully registered commands.');
    } catch (error) {
        console.error(error);
    }
});

// التعامل مع التفاعلات والأوامر
client.on('interactionCreate', async interaction => {
    // 1. عند كتابة الأمر /setup-ticket
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-ticket') {
            // التحقق من صلاحيات المدير
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'عذراً، هذا الأمر مخصص للإداريين فقط.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('الدعم الفني | Support')
                .setDescription('مرحباً بك في نظام الدعم الفني الخاص بنا.\nيرجى تحديد القسم المناسب لمشكلتك من القائمة المنسدلة أدناه لفتح تذكرة مباشرة مع الطاقم المختص.')
                .setColor('#2b2d31');

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

            await interaction.reply({ content: 'تم إرسال نظام التذاكر بنجاح!', ephemeral: true });
            await interaction.channel.send({ embeds: [embed], components: [row] });
        }
    }

    // 2. عند اختيار قسم من القائمة المنسدلة
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

            // تحديد الصلاحيات الافتراضية للتذكرة
            const permissionOverwrites = [
                {
                    id: guild.id, // للجميع (اخفاء القناة)
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: member.id, // للعضو فتح التذكرة (إظهار وإمكانية الكتابة)
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                }
            ];

            // إضافة رتبة الدعم المحددة لهذا القسم إلى الصلاحيات
            if (selectedOption.roleId) {
                permissionOverwrites.push({
                    id: selectedOption.roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                });
            }

            try {
                // إنشاء القناة
                const channel = await guild.channels.create({
                    name: `ticket-${selectedOption.value}-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: TICKET_CONFIG.categoryID || null,
                    permissionOverwrites: permissionOverwrites
                });

                // إرسال رسالة الترحيب بداخل التذكرة
                const welcomeEmbed = new EmbedBuilder()
                    .setTitle(`تذكرة جديدة - ${selectedOption.label}`)
                    .setDescription(`أهلاً بك ${member}، لقد قمت بفتح تذكرة في قسم **${selectedOption.label}**.\nيرجى كتابة استفسارك أو مشكلتك هنا وسيقوم فريق العمل بالرد عليك قريباً.`)
                    .setColor('#5865F2')
                    .setTimestamp();

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket_btn')
                    .setLabel('إغلاق التذكرة')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row = new ActionRowBuilder().addComponents(closeButton);

                // منشن العضو والرتبة المسؤولة
                const supportRoleMention = selectedOption.roleId ? `<@&${selectedOption.roleId}>` : '';
                await channel.send({ 
                    content: `${member} ${supportRoleMention}`, 
                    embeds: [welcomeEmbed], 
                    components: [row] 
                });

                await interaction.editReply({ content: `تم إنشاء تذكرتك بنجاح: ${channel}` });

            } catch (error) {
                console.error('Error creating ticket:', error);
                await interaction.editReply({ content: 'حدث خطأ أثناء محاولة إنشاء التذكرة. تأكد من إعطاء البوت الصلاحيات الكافية (إدارة القنوات وإدارة الرتب).' });
            }
        }
    }

    // 3. عند الضغط على زر إغلاق التذكرة
    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket_btn') {
            await interaction.reply({ content: 'سيتم حذف وإغلاق هذه التذكرة خلال 5 ثوانٍ...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error('Error deleting channel:', err);
                }
            }, 5000);
        }
    }
});

client.login(TOKEN);