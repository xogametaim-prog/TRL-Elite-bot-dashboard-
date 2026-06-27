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
    Routes,
    MessageFlags,
    Events
} = require('discord.js');
const express = require('express');

// تشغيل خادم الويب بأعلى درجات الاستقرار لمنع توقف البوت على Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Rocket League & Ticket Bot Active!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server connected to port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences // ضروري لمعرفة المتصلين والاوفلاين للبرودكاست
    ]
});

// الاختصارات والأوامر الأساسية لروكيت ليق والتذاكر والإمبد
const PREFIX = '-';
const CREATE_ROOM_PREFIX = '-rm';
const WELCOME_SETUP_PREFIX = '-wel';
const PIC_ONLY_SETUP_PREFIX = '-puc';
const LOG_MESSAGES_PREFIX = '-lgm';
const BROADCAST_PREFIX = '-t';
const HELP_PREFIX = '-hp';

// اختصارات قنوات السجلات المختلفة
const LOG_FEEDBACK_PREFIX = '-lgfd'; // لوق التقييمات الجديد
const LOG_TICKET_PREFIX = '-lgt';   // لوق التذاكر المطور المخصص

// لوقات الدخول والخروج والتقييمات والرتب التلقائية
let welcomeChannelId = null;     
let picOnlyChannelId = null;     
let logMessagesChannelId = null; 
let logWelcomeChannelId = null;  
let logByeChannelId = null;      
let logFeedbackChannelId = null; // -lgfd
let logTicketChannelId = null;   // -lgt

let autoRoleMemberId = null;     
let autoRoleBotId = null;        

let questionInterval = null;     
const userWarns = new Map();     
const tempSetup = new Map();
const embedSetup = new Map();
const dmSetup = new Map();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// أسئلة روكيت ليق التفاعلية العشوائية (أكثر من 45 سؤالاً)
const ROCKET_LEAGUE_QUESTIONS = [
    "🏎️ ما هي سيارتك المفضلة للعب التنافسي في روكيت ليق؟",
    "⚽ ما هو أعلى رتبة (Rank) وصلت إليها في اللعبة حتى الآن؟",
    "💥 هل تفضل استراتيجية تفجير الخصوم (Demos) أم تفضل الدفاع الهادئ؟",
    "🔥 ما هو رأيك في خريطة Wasteland الجديدة التنافسية؟",
    "🎩 ما هي القبعة (Topper) الأكثر تميزاً في حسابك؟",
    "⚡ كم نسبة نجاحك في القيام بحركة الـ Double Tap؟",
    "🚀 هل تتقن الـ Air Dribble أم لا زلت تتدرب عليها؟",
    "🎮 هل تلعب باستخدام الكنترولر (يد التحكم) أم الكيبورد والماوس؟",
    "⭐ من هو لاعبك المحترف المفضل في بطولة RLCS؟",
    "🥅 هل تفضل اللعب كمهاجم أم حارس مرمى دائم؟",
    "💨 ما هو الـ Boost المفضل لديك من ناحية الصوت والمظهر؟",
    "🔧 كم عدد الساعات الكلي الذي قضيته في روكيت ليق حتى الآن؟",
    "🚗 هل تفضل سيارة Octane أم Fennec ولماذا؟",
    "🛠️ ما هو رأيك في سيارة Dominus وهل تصلح للـ 50-50؟",
    "📦 ما هو أندر عنصر (Item) تمتلكه في مستودعك الخاص؟",
    "🏆 ما هو النمط المفضل لديك: 1v1 أم 2v2 أم 3v3؟",
    "🌀 هل تفضل مهارة الـ Speed Flip أثناء ضربة البداية (Kickoff)؟",
    "🎯 ما هي أفضل مهارة دفاعية تتقنها في اللعبة؟",
    "🛡️ كيف تتعامل مع المهاجمين الذين يعتمدون على مهارة الـ Flick؟",
    "🌋 هل تفضل اللعب في الخرائط الليلية أم الخرائط النهارية؟",
    "🎒 ما هو الغرض الأكثر طلباً للتجارة (Trading) في حسابك؟",
    "⚡ ما هي أفضل طريقة برأيك لجمع الـ Boost بسرعة أثناء اللعب؟",
    "🥅 ما هي ردة فعلك عندما يقوم زميلك في الفريق بـ Own Goal (هدف عكسي)؟",
    "🏎️ هل تمتلك سيارة الـ Batmobile وهل تفضل اللعب بها؟",
    "🌟 ما هو هدفك الأساسي في الموسم الحالي من روكيت ليق؟",
    "🎈 هل تلعب نمط Rumble الترفيهي أم تفضل الأنماط الكلاسيكية فقط؟",
    "⛸️ ما رأيك في نمط Snow Day (الهوكي) وهل تراه تكتيكياً؟",
    "🏀 هل تلعب قسم السلة (Hoops) وهل تراه يساعد في مهارات الجو؟",
    "🎵 ما هي الأغنية المفضلة لديك في واجهة اللعبة الرئيسية؟",
    "⏱️ كم ساعة تقريباً تلعب روكيت ليق أسبوعياً؟",
    "⚽ تكتيكياً: متى يجب عليك القيام بمهارة الـ Half-Flip للعودة للدفاع؟",
    "🎯 سؤال: كيف تضمن الفوز في الـ 50-50 في الكرات الأرضية؟",
    "🚀 ما رأيك في حركة الـ Ceiling Shot وهل تراها سهلة الدفاع؟",
    "🔥 تكتيك: هل تفضل البقاء خلف زميلك (Rotation) أم الضغط الثنائي الدائم؟",
    "💥 هل تعتمد على الشات السريع (Quick Chat) لتوجيه فريقك أم تفضل الصمت؟",
    "🚗 ما هو العشب المفضلة لديك في ملاعب روكيت ليق؟",
    "🏆 هل شاركت في بطولات روكيت ليق الرسمية داخل اللعبة (Tournaments)؟",
    "🌟 ما هو اللقب (Title) المفضل لديك المعلق تحت اسمك في اللعبة؟",
    "💨 هل تؤيد إلغاء ميزة الـ Trading الرسمية التي حدثت في اللعبة؟",
    "🌀 ما هي أفضل لقطة (Clip) قمت بتسجيلها في مسيرتك باللعبة؟",
    "🎮 هل تفضل اللعب مع الأصدقاء بالصوت (Voice Chat) أم اللعب الفردي التام؟",
    "🛡️ ما هو أفضل كوستومايز (تصميم سيارة) قمت بتركيبه حتى الآن؟",
    "🔥 هل تستخدم الـ Rocket Pass وهل يستحق الشراء دائماً؟",
    "⚽ كم مرة قمت بإنقاذ تاريخي في اللحظة الأخيرة (Epic Save) اليوم؟",
    "🏆 لو واجهت فريقاً محترفاً، ما هو التكتيك الذي ستعتمده للفوز؟"
];

// دالة مساعدة لتعيين اللوجات فوراً
async function handleConfigSetup(message, prefix, name) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const channelMention = message.mentions.channels.first();
    const inputId = args[0];

    const targetChannel = channelMention || message.guild.channels.cache.get(inputId);

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        message.reply(`❌ يرجى منشن قناة نصية صحيحة أو وضع أيدي القناة لتعيين قناة **${name}**:`);
        return null;
    }

    await message.reply(`✅ **تم تعيين قناة ${name} على: ${targetChannel}**`);
    await message.delete().catch(() => {});
    return targetChannel.id;
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const commands = [
        { name: 'setup', description: 'بدء الإعداد التفاعلي لتخصيص بوكس التذاكر الخاص بك' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error(error);
    }
});

// إشعار فوري لجميع السيرفرات عند تحديث وتعديل البوت
client.on('ready', async () => {
    client.guilds.cache.forEach(async guild => {
        try {
            const defaultChannel = guild.channels.cache
                .filter(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages))
                .first();
            if (defaultChannel) {
                const updateEmbed = new EmbedBuilder()
                    .setTitle('🚀 تم تحديث البوت وتنشيطه بنجاح!')
                    .setDescription('تم إدخال جميع التحسينات البرمجية الجديدة وحل مشكلة تعليق التفاعل بالكامل. البوت الآن يعمل بأعلى سرعة استجابة.')
                    .setColor('#2ecc71')
                    .setTimestamp();
                await defaultChannel.send({ embeds: [updateEmbed] }).catch(() => {});
            }
        } catch (err) {
            console.error(err);
        }
    });
});

// منشن الرتبة العليا عند انضمام البوت
client.on(Events.GuildCreate, async guild => {
    try {
        const owner = await guild.fetchOwner();
        const highestRole = guild.roles.cache
            .filter(role => role.permissions.has(PermissionFlagsBits.Administrator) && !role.managed)
            .sort((a, b) => b.position - a.position)
            .first();

        const defaultChannel = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages))
            .first();

        if (defaultChannel) {
            const highestMention = highestRole ? `<@&${highestRole.id}>` : `${owner}`;
            await defaultChannel.send({
                content: `🔔 أهلاً بك ${highestMention}! تم تفعيل وتجهيز البوت بنجاح لخدمتكم.\nيمكنك كتابة الأمر \`-hp\` لعرض دليل الشرح الكامل للاختصارات.`
            });
        }
    } catch (err) {
        console.error(err);
    }
});

// ترحيب فوري وسريع للأعضاء
client.on('guildMemberAdd', async member => {
    if (member.user.bot) {
        if (autoRoleBotId) {
            const role = member.guild.roles.cache.get(autoRoleBotId);
            if (role) await member.roles.add(role).catch(console.error);
        }
    } else {
        if (autoRoleMemberId) {
            const role = member.guild.roles.cache.get(autoRoleMemberId);
            if (role) await member.roles.add(role).catch(console.error);
        }
    }

    if (welcomeChannelId) {
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
        if (welcomeChannel) {
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('✨ عضو جديد انضم إلينا!')
                .setDescription(`👋 أهلاً بك يا ${member} في سيرفرنا الرائع!\nيسعدنا جداً انضمامك ونتمنى لك وقتاً ممتعاً معنا.`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 })) 
                .setColor('#5865F2')
                .addFields(
                    { name: '👤 اسم المستخدم', value: `\`${member.user.username}\``, inline: true },
                    { name: '📊 رقم العضو', value: `\`#${member.guild.memberCount}\``, inline: true }
                )
                .setTimestamp();

            await welcomeChannel.send({ content: `${member}`, embeds: [welcomeEmbed] }).catch(console.error);
        }
    }

    if (logWelcomeChannelId) {
        const logChannel = member.guild.channels.cache.get(logWelcomeChannelId);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('📥 عضو جديد دخل السيرفر')
                .setColor('#2ecc71')
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: '👤 الاسم والتاغ', value: `${member.user.tag}`, inline: true },
                    { name: '🆔 الأيدي (ID)', value: `\`${member.user.id}\``, inline: true },
                    { name: '⏱️ تاريخ إنشاء الحساب', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '📅 وقت الدخول', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(console.error);
        }
    }
});

// لوق خروج الأعضاء
client.on('guildMemberRemove', async member => {
    if (logByeChannelId) {
        const logChannel = member.guild.channels.cache.get(logByeChannelId);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('📤 عضو غادر السيرفر')
                .setColor('#e74c3c')
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: '👤 الاسم والتاغ', value: `${member.user.tag}`, inline: true },
                    { name: '🆔 الأيدي (ID)', value: `\`${member.user.id}\``, inline: true },
                    { name: '📅 وقت المغادرة', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(console.error);
        }
    }
});

// لوق التذاكر المطور المخصص الـ Embed (-lgt)
async function sendDetailedTicketLog(guild, channelName, creatorId, claimerId, closerUser, creationTime, claimTime) {
    if (!logTicketChannelId) return;
    const logChannel = guild.channels.cache.get(logTicketChannelId);
    if (!logChannel) return;

    const creator = guild.members.cache.get(creatorId);
    const claimer = claimerId ? guild.members.cache.get(claimerId) : 'لم تُستلم التذكرة';

    const embed = new EmbedBuilder()
        .setTitle('📂 سجل تفصيلي لإغلاق تذكرة | Ticket Logs')
        .setColor('#e74c3c')
        .addFields(
            { name: '📝 اسم التذكرة', value: `\`${channelName}\``, inline: true },
            { name: '👤 فاتح التذكرة', value: creator ? `${creator}` : `\`أيدي: ${creatorId}\``, inline: true },
            { name: '⏰ وقت فتح التذكرة', value: creationTime ? `<t:${Math.floor(creationTime / 1000)}:f>` : 'غير معروف', inline: true },
            { name: '🙋‍♂️ المشرف المستلم', value: claimerId ? `${claimer}` : '`لم يتم الاستلام`', inline: true },
            { name: '⏱️ وقت استلام التذكرة', value: claimTime ? `<t:${Math.floor(claimTime / 1000)}:f>` : '`لم يتم الاستلام`', inline: true },
            { name: '🔒 مغلق التذكرة', value: `${closerUser}`, inline: true }
        )
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error(err);
    }
}

// إرسال لوق التقييمات بالنجوم (-lgfd)
async function sendDetailedFeedbackLog(guild, creator, rating, claimerName) {
    if (!logFeedbackChannelId) return;
    const logChannel = guild.channels.cache.get(logFeedbackChannelId);
    if (!logChannel) return;

    const ratingStars = '⭐'.repeat(rating);

    const embed = new EmbedBuilder()
        .setTitle('⭐ تقييم دعم فني جديد | Feedback')
        .setColor('#f1c40f')
        .addFields(
            { name: '👤 العضو المقيم', value: `${creator}`, inline: true },
            { name: '🙋‍♂️ الإداري المسؤول', value: `\`${claimerName}\``, inline: true },
            { name: '📊 التقييم المستلم', value: `${ratingStars} (${rating}/5)`, inline: true }
        )
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error(err);
    }
}

// الاستماع للرسائل والأوامر
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // 1. الشرح الكامل لكافة الأوامر -hp
    if (content === HELP_PREFIX) {
        const embed = new EmbedBuilder()
            .setTitle('🏎️ دليل أوامر واختصارات البوت الشامل والمطور')
            .setDescription('مرحباً بك! إليك الشرح المحدث لجميع الميزات والاختصارات الحصرية المتاحة لك:')
            .setColor('#e67e22')
            .addFields(
                { name: '📂 أولاً: لوقات وسجلات السيرفر (Logs)', value:
                    `**-lgt [#القناة]** : لتحديد قناة سجلات التذاكر التفصيلية المحدثة (توثق الفاتح، المستلم، والوقت بالتفصيل).\n` +
                    `**-lgfd [#القناة]** : لتحديد قناة تقارير تقييم المشرفين بالنجوم (⭐).\n` +
                    `**-wel [#القناة]** : لتحديد روم ترحيب الأعضاء الجدد.\n` +
                    `**-lgwelcome [#القناة]** : لتحديد روم لوقات دخول الأعضاء الجدد.\n` +
                    `**-lgbye [#القناة]** : لتحديد روم لوقات خروج الأعضاء.`
                },
                { name: '⚙️ ثانياً: رومات الصور والصلاحيات والرتب', value:
                    `**-rm [الاسم]** : لإنشاء روم نصي جديد ينسخ فقط صلاحيات الـ \`@everyone\` من الروم الحالي فوراً دون رتب.\n` +
                    `**-puc** : يكتب داخل الروم لجعلها **روم صور فقط** ومسح النصوص وتنبيه الأعضاء يدوياً بالخاص.\n` +
                    `**-lgm [#القناة]** : لتحديد قناة سجلات وتخريب شات الصور.\n` +
                    `**-gm [أيدي الرتبة]** : لتحديد رتبة تلقائية للبشر.\n` +
                    `**-gb [أيدي الرتبة]** : لتحديد رتبة تلقائية للبوتات.`
                },
                { name: '⚽ ثالثاً: تحديات وأسئلة روكيت ليق والبرودكاست', value:
                    `**-sn** : لتشغيل الإرسال التلقائي للأسئلة العشوائية والممتعة في الشات كل 10 دقائق.\n` +
                    `**-snp** : لإيقاف نظام الإرسال التلقائي للأسئلة العشوائية فوراً.\n` +
                    `**-s** : لإرسال سؤال عشوائي وتحدي واحد فوراً في الشات لتجربة التفاعل.\n` +
                    `**-t** : لبدء برودكاست جماعي ذكي وسريع (يرسل للأونلاين أولاً ثم الأوفلاين ويمشن العضو تلقائياً).`
                }
            )
            .setTimestamp();
        await message.channel.send({ embeds: [embed] });
        await message.delete().catch(() => {});
        return;
    }

    // 2. تعيين اللوجات والاختصارات فوراً
    if (content.startsWith('-lgt')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logTicketChannelId = await handleConfigSetup(message, '-lgt', 'لوقات التذاكر التفصيلية المحدثة');
        return;
    }

    if (content.startsWith(LOG_FEEDBACK_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logFeedbackChannelId = await handleConfigSetup(message, LOG_FEEDBACK_PREFIX, 'تقييمات الأعضاء بالنجوم');
        return;
    }

    if (content.startsWith(WELCOME_SETUP_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        welcomeChannelId = await handleConfigSetup(message, WELCOME_SETUP_PREFIX, 'ترحيب الأعضاء');
        return;
    }

    if (content.startsWith(LOG_MESSAGES_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logMessagesChannelId = await handleConfigSetup(message, LOG_MESSAGES_PREFIX, 'تخريب شات الصور');
        return;
    }

    if (content.startsWith('-lgwelcome')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logWelcomeChannelId = await handleConfigSetup(message, '-lgwelcome', 'لوقات دخول الأعضاء الجدد');
        return;
    }

    if (content.startsWith('-lgbye')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logByeChannelId = await handleConfigSetup(message, '-lgbye', 'لوقات خروج الأعضاء');
        return;
    }

    // 3. رومات everyone فقط
    if (content.startsWith(CREATE_ROOM_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;

        const roomName = content.slice(CREATE_ROOM_PREFIX.length).trim();
        if (!roomName) {
            return message.reply('❌ يرجى كتابة اسم الروم النصي المراد إنشاؤه:');
        }

        try {
            const currentChannel = message.channel;
            const everyonePermissions = currentChannel.permissionOverwrites.cache.get(message.guild.id);

            const permissionOverwrites = [
                {
                    id: message.guild.id, 
                    allow: everyonePermissions ? everyonePermissions.allow.toArray() : [],
                    deny: everyonePermissions ? everyonePermissions.deny.toArray() : []
                }
            ];

            const newChannel = await message.guild.channels.create({
                name: roomName,
                type: ChannelType.GuildText,
                parent: currentChannel.parentId || null,
                permissionOverwrites: permissionOverwrites
            });

            await message.reply(`✅ **تم بنجاح إنشاء القناة النصية الجديدة بصلاحيات everyone فقط:** ${newChannel}`);
            await message.delete().catch(() => {});
        } catch (err) {
            console.error(err);
        }
        return;
    }

    // 4. الرتب التلقائية الفورية
    if (content.startsWith('-gm')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const roleId = content.replace('-gm', '').trim();
        const role = message.guild.roles.cache.get(roleId);
        if (!role) return message.reply('❌ الأيدي غير صحيح أو الرتبة غير موجودة:');
        autoRoleMemberId = roleId;
        await message.reply(`✅ **تم تعيين الرتبة التلقائية للأعضاء الجدد بنجاح لتكون: ${role.name}**`);
        return;
    }

    if (content.startsWith('-gb')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const roleId = content.replace('-gb', '').trim();
        const role = message.guild.roles.cache.get(roleId);
        if (!role) return message.reply('❌ الأيدي غير صحيح أو الرتبة غير موجودة:');
        autoRoleBotId = roleId;
        await message.reply(`✅ **تم تعيين الرتبة التلقائية للبوتات بنجاح لتكون: ${role.name}**`);
        return;
    }

    // 5. شات الصور فقط
    if (content === PIC_ONLY_SETUP_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        picOnlyChannelId = message.channel.id;
        await message.reply('📸 **تم بنجاح تحويل هذه القناة إلى قناة صور فقط! سيتم تنظيف وحذف أي نصوص عادية.**');
        await message.delete().catch(() => {});
        return;
    }

    // 6. أسئلة روكيت ليق
    if (content === '-sn') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        if (questionInterval) return message.reply('⚠️ نظام الأسئلة التلقائية يعمل بالفعل حالياً في السيرفر.');

        await message.reply('🚀 **تم تفعيل وتشغيل نظام إرسال أسئلة روكيت ليق العشوائية تلقائياً كل 10 دقائق!**');
        
        questionInterval = setInterval(async () => {
            const randomQuestion = ROCKET_LEAGUE_QUESTIONS[Math.floor(Math.random() * ROCKET_LEAGUE_QUESTIONS.length)];

            const embed = new EmbedBuilder()
                .setTitle('⚽ تحدي وأسئلة روكيت ليق اليومية!')
                .setDescription(randomQuestion)
                .setColor('#2980b9')
                .setTimestamp();

            await message.channel.send({ embeds: [embed] }).catch(console.error);
        }, 600000);
        return;
    }

    if (content === '-snp') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        if (!questionInterval) return message.reply('❌ نظام الأسئلة التلقائية متوقف بالفعل.');
        clearInterval(questionInterval);
        questionInterval = null;
        await message.reply('🛑 **تم إيقاف نظام إرسال الأسئلة التلقائية عن روكيت ليق بنجاح.**');
        return;
    }

    if (content === '-s') {
        const randomQuestion = ROCKET_LEAGUE_QUESTIONS[Math.floor(Math.random() * ROCKET_LEAGUE_QUESTIONS.length)];

        const embed = new EmbedBuilder()
            .setTitle('⚽ تحدي وأسئلة روكيت ليق العشوائية!')
            .setDescription(randomQuestion)
            .setColor('#2980b9')
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        await message.delete().catch(() => {});
        return;
    }

    // 7. ميزة الإرسال التلقائي للبرودكاست الخاص فائق السرعة والأمان
    // (منشن العضو + الإرسال للمتصلين Online أولاً ثم الـ Offline ثانياً)
    if (content === BROADCAST_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const broadcastState = { step: 1, title: null, description: null, imageUrl: null, messagesToDelete: [] };
        dmSetup.set(message.author.id, broadcastState);

        const prompt = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست الخاص الآمن**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان** رسالة البرودكاست:`);
        broadcastState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    if (dmSetup.has(message.author.id)) {
        const state = dmSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 1) {
            state.title = message.content.trim();
            state.step = 2;
            const prompt2 = await message.reply(`✅ تم حفظ العنوان.\n\n**الخطوة [2/3]:** يرجى كتابة **الوصف (محتوى الرسالة)**:`);
            state.messagesToDelete.push(prompt2.id);
            return;
        }

        if (state.step === 2) {
            state.description = message.content.trim();
            state.step = 3;
            const prompt3 = await message.reply(`✅ تم حفظ الوصف.\n\n**الخطوة [3/3] الأخيرة:** ضع رابط صورة للرسالة (أو اكتب \`لا\` للإلغاء):`);
            state.messagesToDelete.push(prompt3.id);
            return;
        }

        if (state.step === 3) {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا' && input.startsWith('http')) {
                state.imageUrl = input;
            } else {
                state.imageUrl = null;
            }

            const statusMsg = await message.channel.send('⏳ **جاري فرز الأعضاء وبدء البرودكاست فائق السرعة والآمن (أونلاين أولاً)...**');

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            const members = await message.guild.members.fetch();
            const memberArray = Array.from(members.values()).filter(m => !m.user.bot);

            // فرز وترتيب الأعضاء: المتصلين بالإنترنت (Online) أولاً، ثم غير المتصلين (Offline) ثانياً
            const onlineMembers = memberArray.filter(m => m.presence && m.presence.status !== 'offline');
            const offlineMembers = memberArray.filter(m => !m.presence || m.presence.status === 'offline');
            const sortedMembers = [...onlineMembers, ...offlineMembers];

            let sentCount = 0;
            let failedCount = 0;
            let index = 0;

            // إرسال سريع وآمن للغاية (فاصل 1.5 ثانية فقط لسرعة فائقة ودون تعريض البوت للباند)
            const interval = setInterval(async () => {
                if (index >= sortedMembers.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتمل البرودكاست بنجاح!**\n\n📬 تم الإرسال إلى: \`${sentCount}\` عضو.\n❌ فشل الإرسال لـ: \`${failedCount}\` عضو.`);
                    return;
                }

                const targetMember = sortedMembers[index];
                
                // كتابة رسالة الإمبد المخصصة مع المنشن المباشر لشد انتباه العضو
                const broadcastEmbed = new EmbedBuilder()
                    .setTitle(state.title)
                    .setDescription(`مرحباً بك ${targetMember}،\n\n${state.description}`)
                    .setColor('#5865F2')
                    .setTimestamp();

                if (state.imageUrl) {
                    broadcastEmbed.setImage(state.imageUrl);
                }

                try {
                    await targetMember.send({ embeds: [broadcastEmbed] });
                    sentCount++;
                } catch (err) {
                    failedCount++;
                }

                await statusMsg.edit(`⏳ **جاري الإرسال التدريجي لجميع الأعضاء...**\n\n📊 التقدم: \`${index + 1}/${sortedMembers.length}\` عضو.\n✅ تم الإرسال: \`${sentCount}\` | ❌ فشل: \`${failedCount}\``);
                index++;
            }, 1500); 

            dmSetup.delete(message.author.id);
            return;
        }
    }

    // 8. حماية شات الصور
    if (picOnlyChannelId && message.channel.id === picOnlyChannelId) {
        const hasAttachment = message.attachments.size > 0;
        const hasEmbedImage = message.embeds.some(e => e.image || e.thumbnail);

        if (!hasAttachment && !hasEmbedImage) {
            await message.delete().catch(() => {});

            await message.author.send(`❌ عذراً يا **${message.author.username}**! يمنع منعاً باتاً إرسال الرسائل النصية داخل قناة الصور فقط، هذه القناة مخصصة للصور فقط.`).catch(() => {});

            const warns = userWarns.get(message.author.id) || 0;
            const newWarns = warns + 1;
            userWarns.set(message.author.id, newWarns);

            if (newWarns >= 5) {
                if (logMessagesChannelId) {
                    const logChannel = message.guild.channels.cache.get(logMessagesChannelId);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle('⚠️ تنبيه: تخريب شات الصور!')
                            .setColor('#e74c3c')
                            .setDescription(`قام العضو ${message.author} بإرسال رسائل نصية عشوائية بداخل قناة الصور أكثر من 5 مرات متكررة بشكل مخالف للقوانين.`)
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(console.error);
                    }
                }
                userWarns.set(message.author.id, 0); 
            }
        }
    }

    // 9. بوكس التكت المخصص التفاعلي المطور والمسح التلقائي
    if (message.content.trim() === TICKET_PREFIX) {
        const member = message.member;
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ عذراً، هذا الأمر مخصص للإداريين فقط.');
        }

        const setupState = { 
            step: 'get_count',
            optionsCount: 0,
            currentOptionIndex: 0,
            options: [], 
            imageUrl: null,
            categoryId: null,
            messagesToDelete: [] 
        };
        tempSetup.set(message.author.id, setupState);

        const prompt = await message.channel.send(`${message.author}, ⚙️ **بدء إعداد بوكس تذاكر مخصص بالكامل**\n\n**الخطوة [1]:** كم عدد الأقسام (الخيارات) التي تريد وضعها في هذا البوكس؟ (اكتب رقماً من **1 إلى 5**):`);
        setupState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    if (tempSetup.has(message.author.id)) {
        const state = tempSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 'get_count') {
            const count = parseInt(message.content.trim());
            if (isNaN(count) || count < 1 || count > 5) {
                const errPrompt = await message.reply('❌ يرجى كتابة رقم صحيح من 1 إلى 5 فقط:');
                state.messagesToDelete.push(errPrompt.id);
                return;
            }
            state.optionsCount = count;
            state.currentOptionIndex = 0;
            state.step = 'get_option_label';
            const nextPrompt = await message.reply(`✅ تم تحديد عدد الأقسام: **${count}**\n\n💬 **الآن لنبدأ بتجهيز القسم رقم [1]**:\nيرجى كتابة **اسم القسم**:`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_option_label') {
            const label = message.content.trim();
            state.options.push({ label: label, roleId: null, value: `opt_${state.currentOptionIndex + 1}` });
            state.step = 'get_option_role';
            const nextPrompt = await message.reply(`✅ تم حفظ اسم القسم: **${label}**\n\n👤 يرجى كتابة **أيدي الرتبة (Role ID)** المسؤولة عن تذاكر هذا القسم:`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_option_role') {
            const roleId = message.content.trim();
            const role = message.guild.roles.cache.get(roleId);
            if (!role) {
                const errPrompt = await message.reply('❌ أيدي الرتبة غير صحيح. يرجى كتابة أيدي رتبة صحيح وموجود بالسيرفر:');
                state.messagesToDelete.push(errPrompt.id);
                return;
            }

            state.options[state.currentOptionIndex].roleId = roleId;
            state.currentOptionIndex++;

            if (state.currentOptionIndex < state.optionsCount) {
                state.step = 'get_option_label';
                const nextPrompt = await message.reply(`✅ تم ربط الرتبة **${role.name}** بالقسم السابق.\n\n💬 **لننتقل للقسم رقم [${state.currentOptionIndex + 1}]**:\nيرجى كتابة **اسم القسم**:`);
                state.messagesToDelete.push(nextPrompt.id);
                return;
            } else {
                state.step = 'get_image';
                const nextPrompt = await message.reply(`✅ تم الانتهاء من إعداد جميع الأقسام بنجاح!\n\n🖼️ يرجى وضع **رابط الصورة (Image URL)** للبوكس الرئيسي (إذا كنت لا تريد صورة اكتب: \`لا\`):`);
                state.messagesToDelete.push(nextPrompt.id);
                return;
            }
        }

        if (state.step === 'get_image') {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا' && input.startsWith('http')) {
                state.imageUrl = input;
            } else {
                state.imageUrl = null;
            }
            state.step = 'get_category';
            const nextPrompt = await message.reply(`✅ تم حفظ إعدادات الصورة.\n\n📂 يرجى كتابة **أيدي القسم (Category ID)** الذي تفتح فيه التذاكر (إذا كنت تريدها تفتح في أي مكان اكتب: \`لا\`):`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_category') {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا') {
                state.categoryId = input;
            } else {
                state.categoryId = null;
            }

            const embed = new EmbedBuilder()
                .setTitle('الدعم الفني والخدمات | Support Portal')
                .setDescription(`يرجى اختيار القسم المخصص أدناه لفتح تذكرة مباشرة مع رتبة الدعم المخصصة له.`)
                .setColor('#2b2d31');

            if (state.imageUrl) {
                embed.setImage(state.imageUrl);
            }

            const uniqueId = Date.now().toString().slice(-4);
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`multi_t_menu_${uniqueId}_${state.categoryId || 'none'}`)
                .setPlaceholder('الرجاء اختيار قسم لفتح التذكرة...');

            state.options.forEach(opt => {
                selectMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setValue(`opaction_${opt.roleId}`) 
                        .setLabel(opt.label)
                        .setDescription(`اضغط لفتح تذكرة بقسم ${opt.label}`)
                        .setEmoji('🎫')
                );
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.channel.send({ embeds: [embed], components: [row] });
            
            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            tempSetup.delete(message.author.id);
        }
    }
});

// التعامل مع التفاعلات والسلاش والأزرار وحل مشكلة الـ Unknown Interaction بالكامل
client.on('interactionCreate', async interaction => {
    // 1. تشغيل الأوامر الإدارية
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup') {
            // استجابة فورية لمنع تعليق التفاعل نهائياً
            await interaction.reply({ content: 'جاري بدء إعداد البوكس التفاعلي...', flags: MessageFlags.Ephemeral });
            await startInteractiveSetup(interaction.channel, interaction.user);
        }
    }

    // 2. فتح تذكرة دعم مخصصة من القائمة المنسدلة
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('multi_t_menu_')) {
            // استجابة فورية لمنع الـ Unknown Interaction الخطأ الظاهر في ريندر
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const parts = interaction.customId.split('_');
            const targetCategoryId = parts[4] === 'none' ? null : parts[4];

            const selectedValue = interaction.values[0];
            const targetRoleId = selectedValue.replace('opaction_', '');

            const guild = interaction.guild;
            const member = interaction.member;

            const existingChannel = guild.channels.cache.find(c => c.name.startsWith('ticket-') && c.name.endsWith(member.user.username));
            if (existingChannel) {
                return interaction.editReply({ content: `❌ لا يمكنك فتح تذكرة جديدة؛ لأن لديك تذكرة مفتوحة بالفعل وهي: ${existingChannel}` });
            }

            const permissionOverwrites = [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ];

            if (targetRoleId && targetRoleId !== 'none') {
                permissionOverwrites.push({
                    id: targetRoleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                });
            }

            try {
                const channel = await guild.channels.create({
                    name: `ticket-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: targetCategoryId,
                    permissionOverwrites: permissionOverwrites
                });

                // تخزين أيدي فاتح التذكرة ووقت الفتح بالملي ثانية في التوبك
                const creationTime = Date.now();
                await channel.setTopic(`creator_id:${member.id};created_at:${creationTime}`);

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('تذكرة دعم جديدة')
                    .setDescription(`مرحباً بك ${member}، تم فتح التذكرة الخاصة بك بنجاح وتحويلها للقسم المختص.\n\nيرجى استخدام الأزرار أدناه للتحكم بالتذكرة ومتابعة الإشراف.`)
                    .setColor('#5865F2')
                    .setTimestamp();

                // الأزرار الخمسة التفاعلية بداخل التذكرة المفتوحة
                const claimButton = new ButtonBuilder()
                    .setCustomId(`claim_custom_ticket_${targetRoleId}`)
                    .setLabel('استلام')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🙋‍♂️');

                const alertMemberButton = new ButtonBuilder()
                    .setCustomId(`ping_member_btn`)
                    .setLabel('تنبيه العضو')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔔');

                const alertStaffButton = new ButtonBuilder()
                    .setCustomId(`ping_staff_btn_${targetRoleId}`)
                    .setLabel('تنبيه الإدارة')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📣');

                const requestCloseButton = new ButtonBuilder()
                    .setCustomId(`request_close_btn`)
                    .setLabel('طلب إغلاق')
                    .setStyle(ButtonStyle.Warning)
                    .setEmoji('⚠️');

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_custom_ticket_${targetRoleId}`)
                    .setLabel('إغلاق')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row1 = new ActionRowBuilder().addComponents(claimButton, alertMemberButton, alertStaffButton);
                const row2 = new ActionRowBuilder().addComponents(requestCloseButton, closeButton);

                const supportRoleMention = targetRoleId ? `<@&${targetRoleId}>` : '';
                await channel.send({ 
                    content: `${member} ${supportRoleMention}`, 
                    embeds: [welcomeEmbed], 
                    components: [row1, row2] 
                });

                await interaction.editReply({ content: `تم فتح تذكرتك بنجاح في القناة: ${channel}` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ حدث خطأ غير متوقع أثناء محاولة إنشاء التذكرة.' });
            }
        }
    }

    // 3. معالجة الأزرار الخمسة التفاعلية والتقييم واللوجات السريعة
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // أ- زر استلام التذكرة وتحديد توقيت الاستلام بالملي ثانية
        if (customId.startsWith('claim_custom_ticket_')) {
            const targetRoleId = customId.replace('claim_custom_ticket_', '');
            const member = interaction.member;

            const hasRequiredRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المخصصة للتحكم فيها!', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferUpdate();

            const topic = interaction.channel.topic || '';
            const creatorId = topic.includes('creator_id:') ? topic.split('creator_id:')[1].split(';')[0] : '';
            const creationTime = topic.includes('created_at:') ? topic.split('created_at:')[1].split(';')[0] : '';
            
            const claimTime = Date.now();
            await interaction.channel.setTopic(`creator_id:${creatorId};created_at:${creationTime};claimed_by:${member.id};claimer_name:${member.user.username};claimed_at:${claimTime}`);

            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .addFields({ name: 'المشرف المستلم', value: `👤 تم الاستلام بواسطة: ${member}` });

            const disabledClaimButton = new ButtonBuilder()
                .setCustomId('claimed_disabled_btn')
                .setLabel(`مستلمة بواسطة ${member.user.username}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(true);

            // الحفاظ على الأزرار الأخرى نشطة
            const alertMemberButton = new ButtonBuilder().setCustomId(`ping_member_btn`).setLabel('تنبيه العضو').setStyle(ButtonStyle.Secondary).setEmoji('🔔');
            const alertStaffButton = new ButtonBuilder().setCustomId(`ping_staff_btn_${targetRoleId}`).setLabel('تنبيه الإدارة').setStyle(ButtonStyle.Secondary).setEmoji('📣');
            const requestCloseButton = new ButtonBuilder().setCustomId(`request_close_btn`).setLabel('طلب إغلاق').setStyle(ButtonStyle.Warning).setEmoji('⚠️');
            const closeButton = new ButtonBuilder().setCustomId(`close_custom_ticket_${targetRoleId}`).setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒');

            const row1 = new ActionRowBuilder().addComponents(disabledClaimButton, alertMemberButton, alertStaffButton);
            const row2 = new ActionRowBuilder().addComponents(requestCloseButton, closeButton);

            await interaction.editReply({ embeds: [updatedEmbed], components: [row1, row2] });
            
            const creatorMention = creatorId ? `<@${creatorId}>` : '';
            await interaction.followUp({ content: `${creatorMention} **تم استلام تكت عن طريق هذا الإدارة: ${member}، تابع معه.**` });
        }

        // ب- زر تنبيه العضو
        if (customId === 'ping_member_btn') {
            await interaction.deferUpdate();
            const topic = interaction.channel.topic || '';
            const creatorId = topic.includes('creator_id:') ? topic.split('creator_id:')[1].split(';')[0] : null;
            if (creatorId) {
                const member = interaction.guild.members.cache.get(creatorId);
                if (member) {
                    await interaction.channel.send(`🔔 تنبيه للعضو: ${member}، يرجى مراجعة التذكرة لمتابعة الرد مع الإدارة.`);
                }
            }
        }

        // ج- زر تنبيه الإدارة
        if (customId.startsWith('ping_staff_btn_')) {
            await interaction.deferUpdate();
            const targetRoleId = customId.replace('ping_staff_btn_', '');
            const supportRoleMention = targetRoleId ? `<@&${targetRoleId}>` : '';
            await interaction.channel.send(`📣 تنبيه للإدارة: ${supportRoleMention}، يرجى التوجه ومراجعة التذكرة لحل مشكلة العضو.`);
        }

        // د- زر طلب إغلاق التذكرة
        if (customId === 'request_close_btn') {
            await interaction.reply({ content: '⚠️ **الإدارة تتساءل عما إذا تم حل مشكلتك بالكامل ومستعد لإغلاق التذكرة؟**' });
        }

        // هـ- زر إغلاق التذكرة ونظام التقييم واللوقات المطور الـ Embed
        if (customId.startsWith('close_custom_ticket_')) {
            const targetRoleId = customId.replace('close_custom_ticket_', '');
            const member = interaction.member;
            const topic = interaction.channel.topic || '';
            
            const creatorId = topic.includes('creator_id:') ? topic.split('creator_id:')[1].split(';')[0] : null;
            const creationTime = topic.includes('created_at:') ? parseInt(topic.split('created_at:')[1].split(';')[0]) : null;
            const claimerId = topic.includes('claimed_by:') ? topic.split('claimed_by:')[1].split(';')[0] : null;
            const claimerName = topic.includes('claimer_name:') ? topic.split('claimer_name:')[1].split(';')[0] : 'مشرف الدعم';
            const claimTime = topic.includes('claimed_at:') ? parseInt(topic.split('claimed_at:')[1].split(';')[0]) : null;

            const isClaimer = topic.includes(`claimed_by:${member.id}`);
            const hasSupportRole = member.roles.cache.has(targetRoleId);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isClaimer && !hasSupportRole && !isAdmin) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط لمن استلمها أو الرتبة المخصصة للقسم.', flags: MessageFlags.Ephemeral });
            }

            await interaction.reply({ content: '⚠️ جاري إرسال تقارير التقييم واللوجات الملونة وحذف الروم...' });

            // إرسال اللوج المطور بـ Embed تفصيلي يحتوي على اسم الفاتح، وقت الفتح، المستلم، ووقت الاستلام (-lgt)
            await sendDetailedTicketLog(interaction.guild, interaction.channel.name, creatorId, claimerId, member, creationTime, claimTime);

            // إرسال التقييم بالخاص بشكل فوري (-lgfd)
            const creatorUser = await interaction.guild.members.fetch(creatorId).catch(() => null);
            if (creatorUser) {
                const ratingEmbed = new EmbedBuilder()
                    .setTitle('⭐ تقييم مستوى الدعم الفني')
                    .setDescription(`لقد تم إغلاق تذكرتك في سيرفر **${interaction.guild.name}**.\nيرجى التقييم بالضغط على أحد النجوم لتطوير مستوى الخدمة ومعرفة أداء المشرف المتابع معك (**${claimerName}**):`)
                    .setColor('#f1c40f');

                const starsRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rate_1_${claimerName}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`rate_2_${claimerName}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`rate_3_${claimerName}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`rate_4_${claimerName}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`rate_5_${claimerName}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
                );

                await creatorUser.send({ embeds: [ratingEmbed], components: [starsRow] }).catch(() => {});
            }

            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error('Error deleting channel:', err);
                }
            }, 5000);
        }

        // تسجيل التقييم في قناة اللوج المخصصة للتقييمات (-lgfd)
        if (customId.startsWith('rate_')) {
            await interaction.deferUpdate();
            const parts = customId.split('_');
            const rating = parseInt(parts[1]);
            const claimerName = parts[2];

            await sendDetailedFeedbackLog(interaction.guild, interaction.user, rating, claimerName);
            await interaction.followUp({ content: '✅ **تم إرسال تقييمك بنجاح للإدارة، شكراً لك!**', flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(TOKEN);