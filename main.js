const { 
    Client, 
    GatewayIntentBits, 
    ChannelType, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder 
} = require('discord.js');

// استدعاء ملف تشغيل الخادم لمنع البوت من التوقف (24/7)
const keepAlive = require('./server.js');
keepAlive();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// مهلة زمنية بسيطة لتفادي حظر الطلبات السريعة (Rate Limits) من ديسكورد
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// هيكل الرومات والتصنيفات كما في الصور المرفقة
const STRUCTURE = [
    {
        category: null,
        channels: [
            { name: "🔒・°•- اثبت • نفسك 🎴", type: "text" },
            { name: "🔒・°•- الحرق ⚠️", type: "text" }
        ]
    },
    {
        category: "🌍 | Start",
        channels: [
            { name: "🔒・°•-📜 › القوانين || Rules", type: "text" },
            { name: "🔒・°•-📢 › الاخبار || News", type: "text" },
            { name: "🔒・°•-🛫 › الترحيب || Welcome", type: "text" },
            { name: "🔒・°•-🌐 › فروعنا || Branches", type: "text" },
            { name: "🔒・°•-🐒 › تشهير", type: "text" },
            { name: "🔒・°•-🎖️ › اختر • رتبك", type: "text" },
            { name: "🔒・°•-🏆 › كأس • العالم", type: "text" }
        ]
    },
    {
        category: "💬 | General",
        channels: [
            { name: "💬・°•-💭 › الشات || Chat", type: "text" },
            { name: "💬・°•-💠 › رتب • التفاعل", type: "text" },
            { name: "💬・°•-🤖 › الاوامر || Commands", type: "text" },
            { name: "💬・°•-🏦 › البنك || Bank", type: "text" },
            { name: "💬・°•-🎮 › دردشة • مع • البوت", type: "text" }
        ]
    },
    {
        category: "🎁 | Event",
        channels: [
            { name: "🎁・°•-🔮 › Supporters || الداعمين", type: "text" },
            { name: "🎁・°•-🔮 › Supporters • مميزات", type: "text" },
            { name: "🎁・°•-🛸 › Deliveries || التسليمات", type: "text" },
            { name: "🎁・°•-🎁 › Gifts || الهدايا", type: "text" }
        ]
    },
    {
        category: "🔌 | YouTube",
        channels: [
            { name: "🔌・°•-🔌 › YouTube • اخبار • قناة", type: "text" },
            { name: "🔌・°•-📹 › YouTube • فيديوهات", type: "text" }
        ]
    },
    {
        category: "✉️ | Support",
        channels: [
            { name: "✉️・°•-✉️ › الدعم • الفني", type: "text" },
            { name: "✉️・°•-📋 › تقييم • الادارة", type: "text" }
        ]
    },
    {
        category: "🛠️ | تقديم • الادارة",
        channels: [
            { name: "❄️・°•-🛠️ › تقديم • الادارة", type: "text" },
            { name: "❄️・°•-🏛️ › تسليمات • الأدارة", type: "text" },
            { name: "❄️・°•-🛠️ › نتائج • الادارة", type: "text" }
        ]
    },
    {
        category: "💵 | Ads",
        channels: [
            { name: "💵・°•-💸 › اسعار • الاعلانات", type: "text" },
            { name: "💵・°•-💸 › تكت • الاعلانات", type: "text" },
            { name: "💵・°•-💸 › تقييم • الاعلانات", type: "text" }
        ]
    },
    {
        category: "⚖️ | BRQ - Meditators",
        channels: [
            { name: "⚖️・°•-📜 › قوانين • التوسط", type: "text" },
            { name: "⚖️・°•-🌀 › حدود • الوسطاء", type: "text" },
            { name: "⚖️・°•-🎫 › طلب • وسيط", type: "text" },
            { name: "⚖️・°•-📄 › تسجيلات • الوسطاء", type: "text" },
            { name: "⚖️・°•-☑️ › تقيم • الوسطاء", type: "text" },
            { name: "⚖️・°•-⚖️ › بانل • وسيط", type: "text" }
        ]
    },
    {
        category: "👑 | Owner",
        channels: [
            { name: "🔒・°•-👑 › تريدة • الاونر", type: "text" },
            { name: "🔒・°•-👑 › مسؤوليات • الاونر", type: "text" },
            { name: "🔒・°•-👑 › قوانين • الاونر", type: "text" },
            { name: "🔒・°•-👑 › اخبار • الاونر", type: "text" },
            { name: "🔒・°•-👑 › رواتب • الاونر", type: "text" },
            { name: "🔒・°•-👑 › شات • الاونر", type: "text" },
            { name: "🔒・°•-👑 › ترقيات • الاونر", type: "text" },
            { name: "🔒・°•-👑 › العقوبات • الاونر", type: "text" },
            { name: "🔒・°•-👑 › مهام • الاونر", type: "text" },
            { name: "🔒・°•-👑 › اجازات • الاونر", type: "text" },
            { name: "🔒・°•-👑 › استقالة • الاونر", type: "text" }
        ]
    },
    {
        category: "🛠️ | Staff",
        channels: [
            { name: "🔒・°•-🛠️ › الثريد", type: "text" },
            { name: "🔒・°•-🛠️ › قوانين • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › اخبار • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › النظام • الاداري", type: "text" },
            { name: "🔒・°•-🛠️ › مهام • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › شات • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › العقوبات • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › الترقيات • اداره", type: "text" },
            { name: "🔒・°•-🛠️ › الإجازات", type: "text" },
            { name: "🔒・°•-🛠️ › استقالة • الإدارة", type: "text" },
            { name: "🔒・°•-🛠️ › نظام • الترقيات", type: "text" },
            { name: "🔒・°•-🛠️ › هدايا • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › دلائل • تكتات", type: "text" }
        ]
    },
    {
        category: "🛠️ | Logo",
        channels: [
            { name: "🔒・°•-🛠️ › لوق • الباند", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الطرد", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الرومات", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الرتب", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • التايم", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الرسائل", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الاعضاء", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • العامة", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • اللفلات", type: "text" },
            { name: "👥-members-6141", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الدعوات", type: "text" }
        ]
    },
    {
        category: "🎙️ | Vios",
        channels: [
            { name: "🔒・°•-🛠️ › التحكم • بالفويس", type: "text" },
            { name: "قرآن 🕌", type: "voice" },
            { name: "انشاء • فويس 🔊", type: "voice" }
        ]
    },
    {
        category: "🔊 | غرف صوتية",
        channels: [
            { name: "مسرح المواهب القرآنية 🎙️", type: "voice", userLimit: 99 }
        ]
    }
];

client.once('ready', async () => {
    console.log(`تم تسجيل الدخول بنجاح كـ: ${client.user.tag}`);
    
    // تسجيل الأوامر التفاعلية (Slash Commands)
    const commands = [
        {
            name: 'ban',
            description: 'حظر عضو من السيرفر',
            options: [
                { name: 'member', type: 6, description: 'العضو المراد حظره', required: true },
                { name: 'reason', type: 3, description: 'السبب', required: false }
            ]
        },
        {
            name: 'timeout',
            description: 'إعطاء تايم أوت (كتم مؤقت) لعضو في السيرفر',
            options: [
                { name: 'member', type: 6, description: 'العضو المراد كتمه', required: true },
                { name: 'minutes', type: 4, description: 'المدة بالدقائق', required: true },
                { name: 'reason', type: 3, description: 'السبب', required: false }
            ]
        },
        {
            name: 'setup_server',
            description: 'إنشاء رومات وقنوات وتصنيفات السيرفر تلقائياً'
        },
        {
            name: 'setup_ticket',
            description: 'إرسال لوحة التحكم بنظام التذاكر'
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('تمت مزامنة أوامر الـ Slash Commands بنجاح.');
    } catch (error) {
        console.error('فشلت عملية تسجيل الأوامر:', error);
    }
});

// التعامل مع الأوامر والتفاعلات (Interactions)
client.on('interactionCreate', async (interaction) => {
    // 1. التعامل مع الضغط على الأزرار (Buttons)
    if (interaction.isButton()) {
        const { guild, member, customId, channel } = interaction;

        // عند الضغط على زر إنشاء التذكرة
        if (customId === 'create_ticket_btn') {
            await interaction.deferReply({ ephemeral: true });

            let category = guild.channels.cache.find(c => c.name === '🎫 | Tickets' && c.type === ChannelType.GuildCategory);
            if (!category) {
                try {
                    category = await guild.channels.create({
                        name: '🎫 | Tickets',
                        type: ChannelType.GuildCategory
                    });
                } catch (e) {
                    return interaction.followUp({ content: '❌ حدث خطأ أثناء إنشاء تصنيف التذاكر.', ephemeral: true });
                }
            }

            try {
                // إنشاء روم التذكرة وتخصيص الصلاحيات لضمان الخصوصية
                const ticketChannel = await guild.channels.create({
                    name: `🎫-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: member.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                        },
                        {
                            id: guild.members.me.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                        }
                    ]
                });

                const embed = new EmbedBuilder()
                    .setTitle('نظام التذاكر الموحد')
                    .setDescription(`مرحباً بك ${member} في نظام الدعم الفني الخاص بنا.\nالرجاء كتابة مشكلتك أو طلبك هنا، وسيقوم فريق الدعم بالرد عليك في أقرب وقت ممكن.`)
                    .setColor(0x00FF00)
                    .setFooter({ text: 'لإغلاق التذكرة، اضغط على الزر بالأسفل.' });

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket_btn')
                        .setLabel('إغلاق التذكرة 🔒')
                        .setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ embeds: [embed], components: [closeRow] });
                await interaction.followUp({ content: `✅ تم إنشاء تذكرتك بنجاح: ${ticketChannel}`, ephemeral: true });

            } catch (e) {
                console.error(e);
                await interaction.followUp({ content: '❌ حدث خطأ أثناء إنشاء روم التذكرة.', ephemeral: true });
            }
        }

        // عند الضغط على زر إغلاق التذكرة
        if (customId === 'close_ticket_btn') {
            await interaction.reply({ content: 'سيتم إغلاق وحذف التذكرة خلال 5 ثوانٍ...', ephemeral: false });
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (e) {
                    console.error('Failed to delete ticket channel:', e);
                }
            }, 5000);
        }
    }

    // 2. التعامل مع أوامر السلاش (Slash Commands)
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, member } = interaction;

        // أمر الحظر (Ban)
        if (commandName === 'ban') {
            if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
                return interaction.reply({ content: '❌ لا تملك صلاحية حظر الأعضاء.', ephemeral: true });
            }
            const target = options.getMember('member');
            const reason = options.getString('reason') || 'لا يوجد سبب';

            if (!target) return interaction.reply({ content: '❌ لم يتم العثور على هذا العضو.', ephemeral: true });

            try {
                await target.ban({ reason });
                await interaction.reply({ content: `✅ تم حظر ${target} بنجاح. السبب: ${reason}` });
            } catch (e) {
                await interaction.reply({ content: `❌ لم أتمكن من حظر العضو: ${e.message}`, ephemeral: true });
            }
        }

        // أمر الكتم المؤقت (Timeout)
        if (commandName === 'timeout') {
            if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return interaction.reply({ content: '❌ لا تملك صلاحية التحكم في كتم الأعضاء.', ephemeral: true });
            }
            const target = options.getMember('member');
            const minutes = options.getInteger('minutes');
            const reason = options.getString('reason') || 'لا يوجد سبب';

            if (!target) return interaction.reply({ content: '❌ لم يتم العثور على هذا العضو.', ephemeral: true });

            try {
                const duration = minutes * 60 * 1000; // تحويل إلى ميلي ثانية
                await target.timeout(duration, reason);
                await interaction.reply({ content: `✅ تم إعطاء تايم أوت لـ ${target} لمدة ${minutes} دقيقة. السبب: ${reason}` });
            } catch (e) {
                await interaction.reply({ content: `❌ لم أتمكن من إعطاء تايم أوت للعضو: ${e.message}`, ephemeral: true });
            }
        }

        // أمر إعداد السيرفر تلقائياً (Setup Server)
        if (commandName === 'setup_server') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط.', ephemeral: true });
            }
            await interaction.reply({ content: '⏳ جاري تهيئة وإنشاء الرومات والتصنيفات تلقائياً، يرجى الانتظار...', ephemeral: true });

            try {
                for (const group of STRUCTURE) {
                    let category = null;
                    if (group.category) {
                        category = await guild.channels.create({
                            name: group.category,
                            type: ChannelType.GuildCategory
                        });
                        await sleep(500);
                    }

                    for (const ch of group.channels) {
                        await guild.channels.create({
                            name: ch.name,
                            type: ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
                            parent: category ? category.id : null,
                            userLimit: ch.userLimit || undefined
                        });
                        await sleep(500);
                    }
                }
                await interaction.followUp({ content: '✅ تم الانتهاء من إنشاء كافة الرومات بنجاح!', ephemeral: true });
            } catch (e) {
                console.error(e);
                await interaction.followUp({ content: `❌ حدث خطأ أثناء إعداد الرومات: ${e.message}`, ephemeral: true });
            }
        }

        // أمر إرسال لوحة التذاكر (Setup Ticket)
        if (commandName === 'setup_ticket') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('تذكرة الدعم الفني | Tickets Panel 🎫')
                .setDescription('إذا كنت تواجه مشكلة، أو ترغب بتقديم شكوى أو استفسار، يرجى فتح تذكرة عبر الضغط على الزر أدناه وسيقوم فريق العمل بتقديم المساعدة.')
                .setColor(0x0099FF)
                .setFooter({ text: 'نظام تذاكر سيرفر BRQ Community' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket_btn')
                    .setLabel('إنشاء تذكرة 🎫')
                    .setStyle(ButtonStyle.Success)
            );

            try {
                await interaction.channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: '✅ تم إرسال لوحة التحكم بالتذاكر بنجاح!', ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `❌ حدث خطأ أثناء إرسال اللوحة: ${e.message}`, ephemeral: true });
            }
        }
    }
});

// ضع توكن البوت الخاص بك هنا أو قم بإعداده في متغيرات البيئة بـ Render باسم DISCORD_TOKEN
const TOKEN = process.env.DISCORD_TOKEN || 'ضع_توكن_البوت_الخاص_بِك_هنا';
client.login(TOKEN);