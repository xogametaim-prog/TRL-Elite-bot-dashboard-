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
    MessageFlags,
    Events
} = require('discord.js');
const express = require('express');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Rocket League & Ticket Bot Active!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server connected to port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// الاختصارات الأساسية
const PREFIX = '-';
const CREATE_ROOM_PREFIX = '-rm';
const WELCOME_SETUP_PREFIX = '-wel';
const PIC_ONLY_SETUP_PREFIX = '-puc';
const LOG_MESSAGES_PREFIX = '-lgm';
const BROADCAST_PREFIX = '-t';
const HELP_PREFIX = '-hp';

// اختصارات التذاكر واللوج الجديدة المحددة من قبلك
const TICKET_SETUP_PREFIX = '-st';
const LOG_TICKET_PREFIX = '-lgt';
const LOG_FEEDBACK_PREFIX = '-lgfd';

// لوقات دخول وخروج الأعضاء والرتب التلقائية
let welcomeChannelId = null;     
let picOnlyChannelId = null;     
let logMessagesChannelId = null; 
let logWelcomeChannelId = null;  
let logByeChannelId = null;      
let logTicketChannelId = null;   // -lgt
let logFeedbackChannelId = null; // -lgfd

let autoRoleMemberId = null;     
let autoRoleBotId = null;        

let questionInterval = null;     
const userWarns = new Map();     

const tempSetup = new Map();
const dmSetup = new Map();

// أسئلة روكيت ليق التفاعلية العشوائية
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
    "🥅 ما هي ردة فعلك عندما يقوم زميلك في الفريق بـ Goal عكسي؟",
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
    "🏆 هل شاركت في بطولات روكيت ليق الرسمية داخل اللعبة؟",
    "🌟 ما هو اللقب (Title) المفضل لديك المعلق تحت اسمك في اللعبة؟",
    "💨 هل تؤيد إلغاء ميزة الـ Trading الرسمية التي حدثت في اللعبة؟",
    "🌀 ما هي أفضل لقطة (Clip) قمت بتسجيلها في مسيرتك باللعبة؟",
    "🎮 هل تفضل اللعب مع الأصدقاء بالصوت أم اللعب الفردي التام؟",
    "🛡️ ما هو أفضل كوستومايز (تصميم سيارة) قمت بتركيبه حتى الآن؟",
    "🔥 هل تستخدم الـ Rocket Pass وهل يستحق الشراء دائماً؟",
    "⚽ كم مرة قمت بإنقاذ تاريخي في اللحظة الأخيرة اليوم؟",
    "🏆 لو واجهت فريقاً محترفاً، ما هو التكتيك الذي ستعتمده للفوز؟"
];

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', async () => {
    console.log(`Rocket League Bot logged in as ${client.user.tag}`);
    
    // إرسال تنبيه تحديث البوت التلقائي في أول قناة يجدها في السيرفرات المتصل بها
    client.guilds.cache.forEach(async guild => {
        const defaultChannel = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages))
            .first();
        if (defaultChannel) {
            const embed = new EmbedBuilder()
                .setTitle('📡 تحديث البوت الفني | Bot Update')
                .setDescription('**تم تحديث وتطوير نظام البوت والخدمات الفنية بنجاح!**\nكافة الأوامر المتقدمة واللوقات ونظام التذاكر المتعدد أصبحت مفعّلة الآن وبسرعة فائقة.')
                .setColor('#2ecc71')
                .setTimestamp();
            await defaultChannel.send({ embeds: [embed] }).catch(() => {});
        }
    });
});

// دالة توليد بطاقة ترحيبية مرسومة برمجياً
async function generateWelcomeImage(member) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#23272a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 700, 0);
    gradient.addColorStop(0, '#5865F2');
    gradient.addColorStop(1, '#00b0f4');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('WELCOME!', 250, 100);

    ctx.fillStyle = '#00b0f4';
    ctx.font = '24px Arial';
    ctx.fillText(member.user.username, 250, 145);

    ctx.fillStyle = '#99aab5';
    ctx.font = '18px Arial';
    ctx.fillText(`Member #${member.guild.memberCount}`, 250, 185);

    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarImage = await loadImage(avatarUrl);

        ctx.save();
        ctx.beginPath();
        ctx.arc(125, 125, 64, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(avatarImage, 61, 61, 128, 128);
        ctx.restore();
    } catch (e) {
        ctx.fillStyle = '#5865F2';
        ctx.beginPath();
        ctx.arc(125, 125, 64, 0, Math.PI * 2, true);
        ctx.fill();
    }

    return canvas.toBuffer('image/png');
}

// قراءة دخول الأعضاء (الترحيب المطور بالصورة + اللوج + الرتب التلقائية)
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
            try {
                const imageBuffer = await generateWelcomeImage(member);
                await welcomeChannel.send({
                    content: `👋 مرحباً بك يا ${member} في سيرفرنا الرائع! يسعدنا جداً انضمامك إلينا.`,
                    files: [{ attachment: imageBuffer, name: 'welcome-card.png' }]
                });
            } catch (err) {
                console.error(err);
            }
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
                    { name: '👤 الاسم', value: `${member.user.tag}`, inline: true },
                    { name: '🆔 الأيدي (ID)', value: `\`${member.user.id}\``, inline: true },
                    { name: '⏱️ تاريخ إنشاء حسابه', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '📅 وقت انضمامه للسيرفر', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(console.error);
        }
    }
});

// قراءة خروج ومغادرة الأعضاء (-lgbye)
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

// سجل التذاكر الشامل المطور (-lgt)
async function sendTicketLog(guild, channelName, creatorId, claimerId, closerUser) {
    if (!logTicketChannelId) return;
    const logChannel = guild.channels.cache.get(logTicketChannelId);
    if (!logChannel) return;

    const creator = guild.members.cache.get(creatorId);
    const claimer = claimerId ? guild.members.cache.get(claimerId) : 'لا يوجد (لم تُستلم التذكرة)';

    const logEmbed = new EmbedBuilder()
        .setTitle('📂 سجل وحالة التذاكر | Ticket Logs')
        .setColor('#e74c3c')
        .addFields(
            { name: '📝 اسم التذكرة', value: `\`${channelName}\``, inline: true },
            { name: '👤 منشئ التذكرة', value: creator ? `${creator}` : `\`أيدي: ${creatorId}\``, inline: true },
            { name: '🙋‍♂️ الإداري المستلم', value: claimerId ? `${claimer}` : '`لم يتم الاستلام`', inline: true },
            { name: '🔒 مغلق التذكرة', value: `${closerUser}`, inline: true }
        )
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [logEmbed] });
    } catch (err) {
        console.error(err);
    }
}

// سجل تقييم المشرفين المطور (-lgfd)
async function sendFeedbackLog(guild, creator, rating, claimerName) {
    if (!logFeedbackChannelId) return;
    const logChannel = guild.channels.cache.get(logFeedbackChannelId);
    if (!logChannel) return;

    const ratingStars = '⭐'.repeat(rating);

    const embed = new EmbedBuilder()
        .setTitle('⭐ تقييم أداء الدعم الفني | Feedback Logs')
        .setColor('#f1c40f')
        .addFields(
            { name: '👤 العضو المقيّم', value: `${creator}`, inline: true },
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

// دالة فحص وتعيين قنوات اللوج أو الإعداد بيسر وسهولة
async function handleConfigSetup(message, prefix, name) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const channelMention = message.mentions.channels.first();
    const inputId = args[0];

    const targetChannel = channelMention || message.guild.channels.cache.get(inputId);

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        message.reply(`❌ يرجى منشن قناة نصية صحيحة أو وضع أيدي القناة لتعيين قناة **${name}**:`);
        return null;
    }

    await message.reply(`✅ **تم بنجاح ربط وتعيين قناة ${name} على: ${targetChannel}**`);
    await message.delete().catch(() => {});
    return targetChannel.id;
}

// دالة المساعدة المحدثة بالكامل
function getHelpEmbed() {
    return new EmbedBuilder()
        .setTitle('🏎️ دليل أوامر واختصارات البوت الكامل والمستقر')
        .setDescription('مرحباً بك! إليك الشرح لجميع الميزات والاختصارات الحصرية المتاحة لك الآن:')
        .setColor('#e67e22')
        .addFields(
            { name: '📂 أولاً: رومات الصور وحماية القنوات واللوج والتذاكر', value:
                `**-rm [الاسم]** : لإنشاء روم نصي جديد ينسخ فقط صلاحيات الـ \`@everyone\` من الروم الحالي فوراً دون رتب.\n` +
                `**-puc** : يكتب داخل الروم لجعلها **روم صور فقط** ومسح النصوص وتنبيه الأعضاء يدوياً بالخاص.\n` +
                `**-lgm [#القناة]** : لتحديد قناة سجلات وتخريب شات الصور.\n` +
                `**-lgt [#القناة]** : لتحديد قناة لوقات وسجلات التذاكر بالكامل (توثيق الفتح والإغلاق والاستلام).\n` +
                `**-lgfd [#القناة]** : لتحديد قناة لوقات الفيدباك وتقييمات الأعضاء وأداء المشرفين بالنجوم (⭐).`
            },
            { name: '📊 ثانياً: لوقات السيرفر المتقدمة والرتب التلقائية الفورية', value:
                `**-wel [#القناة]** : لتحديد روم الترحيب التلقائي ببطاقة الاسم والصورة الشخصية المبتكرة.\n` +
                `**-lgwelcome [#القناة]** : لتحديد روم لوقات دخول الأعضاء الجدد وتوثيق حساباتهم.\n` +
                `**-lgbye [#القناة]** : لتحديد روم لوقات خروج ومغادرة الأعضاء.\n` +
                `**-gm [أيدي الرتبة]** : لتحديد رتبة تلقائية يتم منحها فوراً لأي عضو حقيقي يدخل السيرفر.\n` +
                `**-gb [أيدي الرتبة]** : لتحديد رتبة تلقائية يتم منحها فوراً لأي بوت يدخل السيرفر.`
            },
            { name: '⚽ ثالثاً: تحديات وأسئلة روكيت ليق والإرسال التلقائي', value:
                `**-st** : لتصميم البوكس الرئيسي الموحد التفاعلي مع خيارات تذاكر متعددة (من 1 إلى 5 أقسام) وتحديد رتبة استلام مخصصة لكل قسم.\n` +
                `**-sn** : لتشغيل الإرسال التلقائي للأسئلة العشوائية والممتعة في الشات كل 10 دقائق.\n` +
                `**-snp** : لإيقاف نظام الإرسال التلقائي للأسئلة العشوائية فوراً.\n` +
                `**-s** : لإرسال سؤال عشوائي وتحدي واحد فوراً في الشات لتجربة التفاعل.\n` +
                `**-t** : لبدء برودكاست جماعي فائق السرعة والآمن لجميع الأعضاء بالخاص مع الـ Rate limit لتفادي الباند.\n` +
                `**-hp** : لعرض دليل المساعدة والشرح الموحد الماثل أمامك الآن.`
            }
        )
        .setTimestamp();
}

// الاستماع للرسائل وتطبيق كامل العمليات المطلوبة بدقة تامة
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // 1. أمر المساعدة وعرض الشروح المحدث -hp
    if (content === HELP_PREFIX) {
        await message.channel.send({ embeds: [getHelpEmbed()] });
        await message.delete().catch(() => {});
        return;
    }

    // 2. ميزة إنشاء روم نصي بصلاحيات الـ @everyone فقط (-rm [الاسم])
    if (content.startsWith(CREATE_ROOM_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;

        const roomName = content.slice(CREATE_ROOM_PREFIX.length).trim();
        if (!roomName) {
            return message.reply('❌ يرجى كتابة اسم الروم النصي المراد إنشاؤه (مثال: `-rm chat-players`):');
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

    // أمر إضافة رتب لقناة نصية محددة
    if (content.startsWith('-addrole')) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;

        const roleMention = message.mentions.roles.first();
        if (!roleMention) {
            return message.reply('❌ يرجى منشن الرتبة المراد إضافتها للقناة:');
        }

        try {
            await message.channel.permissionOverwrites.create(roleMention, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            await message.reply(`✅ **تم بنجاح إضافة الرتبة ${roleMention} ومنحها كامل الصلاحيات في هذه القناة!**`);
        } catch (err) {
            console.error(err);
        }
        return;
    }

    // 3. تعيين قنوات السيرفر المختلفة بالاختصارات
    if (content.startsWith(WELCOME_SETUP_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        welcomeChannelId = await handleConfigSetup(message, WELCOME_SETUP_PREFIX, 'الترحيب بالأعضاء الجدد (-wel)');
        return;
    }

    if (content.startsWith(LOG_MESSAGES_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logMessagesChannelId = await handleConfigSetup(message, LOG_MESSAGES_PREFIX, 'سجلات التخريب وشات الصور (-lgm)');
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

    if (content.startsWith(LOG_TICKET_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logTicketChannelId = await handleConfigSetup(message, LOG_TICKET_PREFIX, 'سجلات ولوقات التذاكر بالكامل (-lgt)');
        return;
    }

    if (content.startsWith(LOG_FEEDBACK_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logFeedbackChannelId = await handleConfigSetup(message, LOG_FEEDBACK_PREFIX, 'سجلات الفيدباك والتقييمات (-lgfd)');
        return;
    }

    // 4. تعيين الرتب التلقائية الفورية بدقة
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

    // 5. أمر تحويل الروم إلى (روم صور فقط) -puc
    if (content === PIC_ONLY_SETUP_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        picOnlyChannelId = message.channel.id;
        await message.reply('📸 **تم بنجاح تحويل هذه القناة إلى قناة صور فقط! سيتم تنظيف وحذف أي نصوص عادية.**');
        await message.delete().catch(() => {});
        return;
    }

    // 6. تشغيل البث والأسئلة التلقائية التفاعلية عن روكيت ليق (-sn / -snp / -s)
    if (content === '-sn') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        if (questionInterval) {
            return message.reply('⚠️ نظام الأسئلة التلقائية يعمل بالفعل حالياً في السيرفر.');
        }

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
        if (!questionInterval) {
            return message.reply('❌ نظام الأسئلة التلقائية متوقف بالفعل.');
        }
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

    // 7. ميزة برودكاست الخاص فائق السرعة والآمن بالكامل لتجنب الباند (-t)
    if (content === BROADCAST_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const broadcastState = { step: 1, title: null, description: null, imageUrl: null, messagesToDelete: [] };
        dmSetup.set(message.author.id, broadcastState);

        const prompt = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست الخاص الآمن**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان** رسالة البرودكاست:`);
        broadcastState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    // تتبع برودكاست الخاص فائق السرعة والآمن مع التنظيف التلقائي
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

            const broadcastEmbed = new EmbedBuilder()
                .setTitle(state.title)
                .setDescription(state.description)
                .setColor('#5865F2')
                .setTimestamp();

            if (state.imageUrl) {
                broadcastEmbed.setImage(state.imageUrl);
            }

            const statusMsg = await message.channel.send('⏳ **جاري بدء عملية البرودكاست التدريجي والآمن لتجنب الباند من ديسكورد...**');

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            const members = await message.guild.members.fetch();
            const memberArray = Array.from(members.values()).filter(m => !m.user.bot);

            let sentCount = 0;
            let failedCount = 0;
            let index = 0;

            // إرسال سريع للغاية وآمن (تأخير 1.5 ثانية فقط بين كل عضو وهو أسرع معدل متوافق مع ديسكورد لمنع الباند)
            const interval = setInterval(async () => {
                if (index >= memberArray.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتمل البرودكاست بنجاح!**\n\n📬 تم الإرسال إلى: \`${sentCount}\` عضو.\n❌ فشل الإرسال لـ: \`${failedCount}\` عضو.`);
                    return;
                }

                const targetMember = memberArray[index];
                try {
                    await targetMember.send({ embeds: [broadcastEmbed] });
                    sentCount++;
                } catch (err) {
                    failedCount++;
                }

                await statusMsg.edit(`⏳ **جاري الإرسال التدريجي لجميع الأعضاء...**\n\n📊 التقدم: \`${index + 1}/${memberArray.length}\` عضو.\n✅ تم الإرسال: \`${sentCount}\` | ❌ فشل: \`${failedCount}\``);
                index++;
            }, 1500); 

            dmSetup.delete(message.author.id);
            return;
        }
    }

    // 8. الاختصار التفاعلي المرن لتصميم بوكس التذاكر المتعدد وتحديد الأقسام والرتب (-st)
    if (content === TICKET_SETUP_PREFIX) {
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

    // تتبع خطوات إعداد بوكس التذاكر المتعدد -st ومسح جميع رسائل الأسئلة عند الانتهاء
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
                        .setValue(`opaction_${opt.roleId}_${opt.label}`) 
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

    // 9. حماية روم الصور فقط ومسح النصوص وتنبيه العضو واللوج التلقائي للتخريب
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
});

// التعامل مع التفاعلات والأزرار
client.on('interactionCreate', async interaction => {
    // فتح تكت من القوائم المنسدلة المخصصة
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('multi_t_menu_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const parts = interaction.customId.split('_');
            const targetCategoryId = parts[4] === 'none' ? null : parts[4];

            const selectedValue = interaction.values[0];
            const dataParts = selectedValue.split('_');
            const targetRoleId = dataParts[1];
            const optionLabel = dataParts[2] || 'الدعم العام';

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

                // حفظ المنشئ والوقت والتفاصيل في التوبك
                const openTime = Math.floor(Date.now() / 1000);
                await channel.setTopic(`creator_id:${member.id};open_time:${openTime};option_label:${optionLabel}`);

                // التقرير المطور والمنسق داخل التكت كـ Embed فخم بدلاً من لوق عادي
                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('🎫 معلومات تفاصيل تذكرة الدعم | Ticket Status')
                    .setDescription(`مرحباً بك ${member}، تم فتح تذكرتك بنجاح وتحويلها للقسم المختص **(${optionLabel})**.\n\nيرجى استخدام الأزرار أدناه للتحكم بالتذكرة وسيقوم المشرف المتابع بالرد عليك.`)
                    .setColor('#5865F2')
                    .addFields(
                        { name: '👤 منشئ التذكرة', value: `${member}`, inline: true },
                        { name: '⏱️ وقت فتح التذكرة', value: `<t:${openTime}:f>`, inline: true },
                        { name: '🙋‍♂️ المشرف المستلم', value: '`في الانتظار...`', inline: true },
                        { name: '📅 وقت الاستلام', value: '`لم تُستلم بعد`', inline: true }
                    )
                    .setFooter({ text: 'نظام إدارة تذاكر الدعم الفني المتطور.' })
                    .setTimestamp();

                // 5 أزرار تفاعلية مخصصة للتحكم الكامل بالتكت
                const claimButton = new ButtonBuilder().setCustomId(`claim_custom_ticket_${targetRoleId}`).setLabel('استلام التذكرة').setStyle(ButtonStyle.Primary).setEmoji('🙋‍♂️');
                const pingMemberButton = new ButtonBuilder().setCustomId('ping_member_ticket_action').setLabel('تنبيه العضو').setStyle(ButtonStyle.Secondary).setEmoji('🔔');
                const pingSupportButton = new ButtonBuilder().setCustomId('ping_support_ticket_action').setLabel('تنبيه الإدارة المستلم').setStyle(ButtonStyle.Secondary).setEmoji('👤');
                const requestCloseButton = new ButtonBuilder().setCustomId('request_close_ticket_action').setLabel('طلب إغلاق التذكرة').setStyle(ButtonStyle.Success).setEmoji('🗳️');
                const closeButton = new ButtonBuilder().setCustomId(`close_custom_ticket_${targetRoleId}`).setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒');

                const row1 = new ActionRowBuilder().addComponents(claimButton, pingMemberButton, pingSupportButton);
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

    if (interaction.isButton()) {
        const customId = interaction.customId;
        const topic = interaction.channel.topic || '';

        const creatorId = topic.includes('creator_id:') ? topic.split('creator_id:')[1].split(';')[0] : null;
        const openTime = topic.includes('open_time:') ? topic.split('open_time:')[1].split(';')[0] : null;
        const optionLabel = topic.includes('option_label:') ? topic.split('option_label:')[1].split(';')[0] : 'الدعم العام';
        const claimerId = topic.includes('claimed_by:') ? topic.split('claimed_by:')[1].split(';')[0] : null;
        const claimTime = topic.includes('claim_time:') ? topic.split('claim_time:')[1].split(';')[0] : null;

        // 1. زر استلام التذكرة وتحديث تقرير الإمبد فوراً
        if (customId.startsWith('claim_custom_ticket_')) {
            const targetRoleId = customId.replace('claim_custom_ticket_', '');
            const member = interaction.member;

            const hasRequiredRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المخصصة للتحكم فيها!', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferUpdate();

            const currentClaimTime = Math.floor(Date.now() / 1000);
            await interaction.channel.setTopic(`${topic};claimed_by:${member.id};claim_time:${currentClaimTime};claimer_name:${member.user.username}`);

            // تحديث إمبد الترحيب فوراً بمعلومات الاستلام والوقت
            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .setFields(
                    { name: '👤 منشئ التذكرة', value: `<@${creatorId}>`, inline: true },
                    { name: '⏱️ وقت فتح التذكرة', value: `<t:${openTime}:f>`, inline: true },
                    { name: '🙋‍♂️ المشرف المستلم', value: `${member}`, inline: true },
                    { name: '📅 وقت الاستلام', value: `<t:${currentClaimTime}:f>`, inline: true }
                );

            await interaction.editReply({ embeds: [updatedEmbed] });
            
            const creatorMention = creatorId ? `<@${creatorId}>` : '';
            await interaction.followUp({ content: `${creatorMention} **تم استلام تكت عن طريق هذا الإدارة: ${member}، تابع معه.**` });
        }

        // 2. زر تنبيه العضو
        if (customId === 'ping_member_ticket_action') {
            const member = interaction.guild.members.cache.get(creatorId);
            if (member) {
                await interaction.reply({ content: `🔔 تم إرسال التنبيه للعضو بنجاح.` }).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
                await interaction.channel.send(`🔔 تنبيه للعضو: ${member}، يرجى مراجعة التذكرة لمتابعة الرد مع الإدارة.`);
            }
        }

        // 3. زر تنبيه المشرف المستلم
        if (customId === 'ping_support_ticket_action') {
            if (!claimerId) {
                return interaction.reply({ content: '❌ لم يتم استلام هذه التذكرة من قبل أي مشرف بعد لتنبيهه.', flags: MessageFlags.Ephemeral });
            }
            const claimerMember = interaction.guild.members.cache.get(claimerId);
            if (claimerMember) {
                await interaction.reply({ content: `🔔 تم تنبيه المشرف المستلم بنجاح.` }).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
                await interaction.channel.send(`🔔 تنبيه للمشرف المستلم: ${claimerMember}، يرجى الحضور والتواجد لمتابعة شات التذكرة.`);
            }
        }

        // 4. زر إغلاق التذكرة المخصصة وإرسال التقييم للخاص واللوج
        if (customId.startsWith('close_custom_ticket_')) {
            const targetRoleId = customId.replace('close_custom_ticket_', '');
            const member = interaction.member;

            const isClaimer = topic.includes(`claimed_by:${member.id}`);
            const hasSupportRole = member.roles.cache.has(targetRoleId);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isClaimer && !hasSupportRole && !isAdmin) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط لمن استلمها أو الرتبة المخصصة للقسم.', flags: MessageFlags.Ephemeral });
            }

            const claimerName = topic.includes('claimer_name:') ? topic.split('claimer_name:')[1].split(';')[0] : 'مشرف الدعم';

            await interaction.reply({ content: '⚠️ جاري إرسال التقييم للعضو وحذف التذكرة خلال 5 ثوانٍ...' });

            await sendTicketLog(interaction.guild, interaction.channel.name, creatorId, claimerId, member);

            // إرسال أزرار التقييم للعضو في الخاص وحل مشكلة وصول التقييم تماماً لقناة -lgfd
            const creatorUser = await interaction.guild.members.fetch(creatorId).catch(() => null);
            if (creatorUser) {
                const ratingEmbed = new EmbedBuilder()
                    .setTitle('⭐ تقييم مستوى الدعم الفني')
                    .setDescription(`لقد تم إغلاق تذكرتك في سيرفر **${interaction.guild.name}**.\nيرجى الضغط على أحد الأزرار أدناه لتقييم أداء المشرف المتابع معك (**${claimerName}**):`)
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

        // 5. زر طلب إغلاق التذكرة
        if (customId === 'request_close_ticket_action') {
            const member = interaction.member;
            const creatorMember = interaction.guild.members.cache.get(creatorId);

            if (member.id !== creatorId) {
                return interaction.reply({ content: '❌ هذا الخيار مخصص فقط للعضو صاحب التذكرة ليطلب إغلاق تذكرته عند انتهاء مشكلته.', flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setTitle('🗳️ طلب إغلاق التذكرة من قبل العضو')
                .setDescription(`قام العضو المفتوح له التذكرة ${member} بتقديم طلب لإغلاق التذكرة لحل مشكلته بالكامل.\nيمكن للإشراف مراجعة الشات الآن وإغلاقها.`)
                .setColor('#2ecc71')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        // معالجة وصول تقييمات الأعضاء للوج المخصص -lgfd
        if (customId.startsWith('rate_')) {
            await interaction.deferUpdate();
            const parts = customId.split('_');
            const rating = parseInt(parts[1]);
            const claimerName = parts[2];

            await sendFeedbackLog(interaction.guild, interaction.user, rating, claimerName);
            await interaction.followUp({ content: '✅ **شكراً جزيلاً لك على تقييمك! تم إرسال التقييم للإدارة بنجاح.**', flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(TOKEN);