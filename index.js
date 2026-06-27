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
    MessageFlags
} = require('discord.js');
const express = require('express');
const { createCanvas, loadImage } = require('@napi-rs/canvas'); 

const app = express();
const PORT = process.env.PORT || 3000;

// نظام تخزين التحقق التلقائي (OAuth2)
let verifiedUsersCount = 0; 
let verifyUrl = 'https://discord.com/api/oauth2/authorize...'; // الرابط الافتراضي للتحقق

app.get('/', (req, res) => res.send('Bot is ready!'));
// رابط استقبال التحويل (Callback/Redirect) للـ OAuth2 لتسجيل الأعضاء بنجاح
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (code) {
        verifiedUsersCount++; // زيادة عدد الموثقين بمجرد إتمام التحقق
        res.send('<h1>✅ Verified Successfully! You can now close this tab.</h1>');
    } else {
        res.send('<h1>❌ Verification Failed. Please try again.</h1>');
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server connected to port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences 
    ]
});

// الاختصارات الأساسية
const PREFIX = '-';
const CREATE_ROOM_PREFIX = '-rm'; 
const WELCOME_SETUP_PREFIX = '-wel';
const BYE_SETUP_PREFIX = '-bye';
const PIC_ONLY_PREFIX = '-puc';
const LOG_PIC_PREFIX = '-lgpuc';
const ROLE_MEMBER_PREFIX = '-gm';
const ROLE_BOT_PREFIX = '-gb';
const LOG_TICKET_PREFIX = '-lgt';
const DM_BROADCAST_PREFIX = '-dm';
const HELP_PREFIX = '-hp';

// اختصارات نظام التحقق المطور (Verify System) - مخفية من -hp
const VERIFY_SETUP_PREFIX = '-vr';    // إرسال البوكس في الروم
const SET_VERIFY_URL_PREFIX = '-vt';  // تعيين رابط التحقق
const COUNT_VERIFY_PREFIX = '-vf';    // معرفة عدد الموافقين

const tempSetup = new Map();
const dmSetup = new Map();
const userWarns = new Map();

// قنوات الإعداد واللوج
let welcomeChannelId = null;
let byeChannelId = null;
let picOnlyChannelId = null;
let logPicChannelId = null;
let logTicketChannelId = null;

let autoMemberRoleId = null;
let autoBotRoleId = null;

// توحيد مسمى متغير التوكن مع نهاية الكود لضمان قراءته ومنع الـ ReferenceError
const TOKEN = process.env.TOKEN || process.env.token || process.env.توكين || process.env.توكن;
const CLIENT_ID = process.env.CLIENT_ID || process.env.client_id || process.env.سلينت;

client.once('clientReady', async () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    const commands = [
        { name: 'setup', description: 'بدء إعداد نظام التذاكر المتعدد التفاعلي' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Commands registered.');
    } catch (e) {
        console.error(e);
    }
});

// توافقية إضافية لضمان التشغيل في كل الحالات
client.once('ready', async () => {
    if (client.isReady()) return;
    console.log(`Bot logged in as ${client.user.tag}`);
});

// دالة توليد بطاقة مرسومة بالكانفا (للدخول أو الخروج)
async function generateCard(member, title, colorHex) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    // الخلفية
    ctx.fillStyle = '#23272a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // إطار ملوّن أنيق بحدود مائلة
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 8;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // نصوص فنية
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.fillText(title, 250, 100);

    ctx.fillStyle = colorHex;
    ctx.font = '24px Arial';
    ctx.fillText(member.user.username, 250, 145);

    ctx.fillStyle = '#99aab5';
    ctx.font = '16px Arial';
    ctx.fillText(`ID: ${member.user.id}`, 250, 185);

    // رسم صورة العضو الدائرية
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
        ctx.fillStyle = colorHex;
        ctx.beginPath();
        ctx.arc(125, 125, 64, 0, Math.PI * 2, true);
        ctx.fill();
    }

    return canvas.toBuffer('image/png');
}

// دالة المساعدة المحدثة بالكامل دون مراجع للأسئلة
function getHelpEmbed() {
    return new EmbedBuilder()
        .setTitle('⚙️ دليل أوامر واختصارات البوت الكامل والمستقر')
        .setDescription('إليك الشرح لجميع الميزات والاختصارات الحصرية المتاحة لك الآن لتهيئة السيرفر:')
        .setColor('#5865F2')
        .addFields(
            { name: '📂 أولاً: اختصارات اللوج وقنوات المراقبة والمنع', value:
                `**${LOG_PIC_PREFIX} [#القناة]** : لتحديد قناة سجلات وتخريب شات الصور والفيديوهات المحددة.\n` +
                `**${LOG_TICKET_PREFIX} [#القناة]** : لتحديد قناة سجلات إغلاق وحذف التذاكر في السيرفر.`
            },
            { name: '📊 ثانياً: ترحيب الأعضاء والمغادرة والرتب التلقائية', value:
                `**${WELCOME_SETUP_PREFIX} [#القناة]** : لتحديد روم ترحيب الأعضاء الجدد ببطاقة الاسم والصورة الشخصية.\n` +
                `**${BYE_SETUP_PREFIX} [#القناة]** : لتحديد روم توديع الأعضاء ببطاقة الاسم والصورة الشخصية.\n` +
                `**${ROLE_MEMBER_PREFIX} [أيدي الرتبة]** : لتحديد رتبة تلقائية يتم منحها فوراً لأي عضو حقيقي يدخل السيرفر.\n` +
                `**${ROLE_BOT_PREFIX} [أيدي الرتبة]** : لتحديد رتبة تلقائية يتم منحها فوراً لأي بوت ينضم للسيرفر.`
            },
            { name: '🎫 ثالثاً: اختصارات التصميم والإرسال التفاعلي والبرودكاست', value:
                `**${TICKET_SETUP_PREFIX}** : لبدء الإعداد التفاعلي المتقدم لبوكس تذاكر موحد (من 1 إلى 10 خيارات) مع الرتب المخصصة للاستلام والشرح.\n` +
                `**${PIC_ONLY_PREFIX}** : يكتب داخل الروم لتفعيل نظام **(صور وفيديوهات فقط)** ومسح النصوص وتحذير الأعضاء بالخاص.\n` +
                `**${DM_BROADCAST_PREFIX}** : لبدء برودكاست جماعي تفاعلي يبدأ بإرسال الرسائل للأعضاء المتصلين (Online) أولاً ثم البقية لتجنب الباند.`
            }
        )
        .setTimestamp();
}

// قراءة دخول الأعضاء (الترحيب + اللوج + الرتب التلقائية)
client.on('guildMemberAdd', async member => {
    if (member.user.bot) {
        if (autoBotRoleId) {
            const role = member.guild.roles.cache.get(autoBotRoleId);
            if (role) await member.roles.add(role).catch(console.error);
        }
    } else {
        if (autoMemberRoleId) {
            const role = member.guild.roles.cache.get(autoMemberRoleId);
            if (role) await member.roles.add(role).catch(console.error);
        }
    }

    if (welcomeChannelId) {
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
        if (welcomeChannel) {
            try {
                const imageBuffer = await generateCard(member, 'WELCOME!', '#5865F2');
                await welcomeChannel.send({
                    content: `👋 مرحباً بك يا ${member} في سيرفرنا الرائع! يسعدنا جداً انضمامك إلينا.`,
                    files: [{ attachment: imageBuffer, name: 'welcome-card.png' }]
                }).catch(console.error);
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// قراءة خروج ومغادرة الأعضاء ورسم بطاقة المغادرة
client.on('guildMemberRemove', async member => {
    if (byeChannelId) {
        const byeChannel = member.guild.channels.cache.get(byeChannelId);
        if (byeChannel) {
            try {
                const imageBuffer = await generateCard(member, 'GOOD BYE!', '#e74c3c');
                await byeChannel.send({
                    content: `📤 غادرنا العضو **${member.user.username}**، نتمنى له التوفيق.`,
                    files: [{ attachment: imageBuffer, name: 'bye-card.png' }]
                }).catch(console.error);
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// دالة مساعدة لتحديد قنوات اللوج أو الإعداد بيسر وسهولة
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

// الاستماع للرسائل وتطبيق كامل العمليات المطلوبة بدقة تامة
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();

    if (content === HELP_PREFIX) {
        await message.channel.send({ embeds: [getHelpEmbed()] });
        await message.delete().catch(() => {});
        return;
    }

    // 1. نظام التحقق المطور المكتوم (Verify System) - مخفي من المساعدة
    if (content === VERIFY_SETUP_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Server Verification / التحقق الذاتي')
            .setDescription('Please click the button below to verify yourself and get full access to the server.\n\nالرجاء الضغط على الزر أدناه لإتمام التحقق وتفعيل حسابك بالكامل بداخل السيرفر.')
            .setColor('#2b2d31');

        const verifyButton = new ButtonBuilder()
            .setLabel('Verify yourself')
            .setURL(verifyUrl)
            .setStyle(ButtonStyle.Link)
            .setEmoji('✅');

        const row = new ActionRowBuilder().addComponents(verifyButton);

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
        return;
    }

    if (content.startsWith(SET_VERIFY_URL_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const newUrl = content.replace(SET_VERIFY_URL_PREFIX, '').trim();
        if (!newUrl || !newUrl.startsWith('http')) {
            return message.reply('❌ يرجى وضع رابط الـ OAuth2 الصحيح للتحقق (مثال: `-vt https://discord.com/...`):');
        }
        verifyUrl = newUrl;
        await message.reply('✅ **تم بنجاح حفظ وتحديث رابط التحقق الذاتي الخاص بك!**');
        await message.delete().catch(() => {});
        return;
    }

    if (content === COUNT_VERIFY_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        await message.reply(`📊 **إحصائية التحقق المطور:**\nالعدد الكلي للأعضاء الموافقين والموثقين بنجاح هو: \`${verifiedUsersCount}\` عضو.`);
        return;
    }

    // إنشاء روم نصي بصلاحيات الـ @everyone فقط (-rm [الاسم])
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

    // أمر إضافة رتب لقناة نصية محددة مع المنشن
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

    // تعيين قنوات السيرفر المختلفة بالاختصارات
    if (content.startsWith(WELCOME_SETUP_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        welcomeChannelId = await handleConfigSetup(message, WELCOME_SETUP_PREFIX, 'الترحيب بالأعضاء الجدد (-wel)');
        return;
    }

    if (content.startsWith(BYE_SETUP_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        byeChannelId = await handleConfigSetup(message, BYE_SETUP_PREFIX, 'توديع الأعضاء (-bye)');
        return;
    }

    if (content.startsWith(LOG_PIC_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logPicChannelId = await handleConfigSetup(message, LOG_PIC_PREFIX, 'لوقات وسجلات روم الصور (-lgpuc)');
        return;
    }

    if (content.startsWith(LOG_TICKET_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logTicketChannelId = await handleConfigSetup(message, LOG_TICKET_PREFIX, 'سجلات التذاكر (-lgt)');
        return;
    }

    // تعيين الرتب التلقائية الفورية بدقة
    if (content.startsWith(ROLE_MEMBER_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const roleId = content.replace(ROLE_MEMBER_PREFIX, '').trim();
        const role = message.guild.roles.cache.get(roleId);
        if (!role) return message.reply('❌ الأيدي غير صحيح أو الرتبة غير موجودة:');
        autoMemberRoleId = roleId;
        await message.reply(`✅ **تم تعيين الرتبة التلقائية للأعضاء الجدد بنجاح لتكون: ${role.name}**`);
        return;
    }

    if (content.startsWith(ROLE_BOT_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const roleId = content.replace(ROLE_BOT_PREFIX, '').trim();
        const role = message.guild.roles.cache.get(roleId);
        if (!role) return message.reply('❌ الأيدي غير صحيح أو الرتبة غير موجودة:');
        autoBotRoleId = roleId;
        await message.reply(`✅ **تم تعيين الرتبة التلقائية للبوتات بنجاح لتكون: ${role.name}**`);
        return;
    }

    // أمر تحويل الروم إلى (روم صور وفيديوهات فقط) -puc
    if (content === PIC_ONLY_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        picOnlyChannelId = message.channel.id;
        await message.reply('📸 **تم بنجاح تحويل هذه القناة إلى قناة صور فقط! سيتم تنظيف وحذف أي نصوص عادية.**');
        await message.delete().catch(() => {});
        return;
    }

    // البوكس المخصص للتذاكر التفاعلية لإنشاء البوكسات
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

        const prompt = await message.channel.send(`${message.author}, ⚙️ **بدء إعداد بوكس تذاكر مخصص بالكامل**\n\n**الخطوة [1]:** كم عدد الأقسام (الخيارات) التي تريد وضعها في هذا البوكس؟ (اكتب رقماً من **1 إلى 10**):`);
        setupState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    // برودكاست الخاص فائق السرعة والآمن بالكامل لتجنب الباند (-dm) - يسأل هل تود المنشن أم لا
    if (content === DM_BROADCAST_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const broadcastState = { step: 1, title: null, description: null, imageUrl: null, needPing: 'لا', messagesToDelete: [] };
        dmSetup.set(message.author.id, broadcastState);

        const prompt = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست الخاص الذكي والآمن (أونلاين أولاً)**\n\n**الخطوة [1/4]:** يرجى كتابة **عنوان** رسالة البرودكاست:`);
        broadcastState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    // تتبع خطوات إعداد بوكس التذاكر المتعدد -st ومسح جميع رسائل الأسئلة عند الانتهاء
    if (tempSetup.has(message.author.id)) {
        const state = tempSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 'get_count') {
            const count = parseInt(message.content.trim());
            if (isNaN(count) || count < 1 || count > 10) {
                const errPrompt = await message.reply('❌ يرجى كتابة رقم صحيح من 1 إلى 10 فقط:');
                state.messagesToDelete.push(errPrompt.id);
                return;
            }
            state.optionsCount = count;
            state.currentOptionIndex = 0;
            state.step = 'get_option_label';
            const nextPrompt = await message.reply(`✅ تم تحديد عدد الأقسام: **${count}**\n\n💬 **الآن لنبدأ بتجهيز القسم رقم [1]**:\nيرجى كتابة **اسم المربع / الخيار**:`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_option_label') {
            const label = message.content.trim();
            state.options.push({ label: label, roleId: null, description: null, value: `opt_${state.currentOptionIndex + 1}` });
            state.step = 'get_option_desc';
            const nextPrompt = await message.reply(`✅ تم حفظ اسم القسم: **${label}**\n\n📝 يرجى كتابة **الشرح/الوصف** الذي تريده أن يظهر كشرح فرعي لهذا القسم:`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_option_desc') {
            const desc = message.content.trim();
            state.options[state.currentOptionIndex].description = desc;
            state.step = 'get_option_role';
            const nextPrompt = await message.reply(`✅ تم حفظ الوصف.\n\n👤 يرجى كتابة **أيدي الرتبة (Role ID)** المسؤولة عن تذاكر هذا القسم:`);
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
                const nextPrompt = await message.reply(`✅ تم ربط الرتبة **${role.name}** بالقسم السابق.\n\n💬 **لننتقل للقسم رقم [${state.currentOptionIndex + 1}]**:\nيرجى كتابة **اسم المربع / الخيار**:`);
                state.messagesToDelete.push(nextPrompt.id);
                return;
            } else {
                state.step = 'get_image';
                const nextPrompt = await message.reply(`✅ تم الانتهاء من إعداد جميع الأقسام بنجاح!\n\n🖼 يرجى وضع **رابط الصورة (Image URL)** للبوكس الرئيسي (إذا كنت لا تريد صورة اكتب: \`لا\`):`);
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
                .setTitle('بوابة الدعم الفني والمساعدات | Support Portal')
                .setDescription(`يرجى تحديد القسم المناسب لمشكلتك من القائمة المنسدلة أدناه لفتح تذكرة مباشرة مع الطاقم المختص ومتابعتك.`)
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
                        .setDescription(opt.description || `تذكرة بقسم ${opt.label}`)
                        .setEmoji('🎫')
                );
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.channel.send({ embeds: [embed], components: [row] });
            
            // تصفية جميع رسائل الإعداد تلقائياً ليبقى الشات نظيفاً
            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            tempSetup.delete(message.author.id);
        }
    }

    // تتبع خطوات البرودكاست الخاص -dm (متصل أولاً ثم غير متصل)
    if (dmSetup.has(message.author.id)) {
        const state = dmSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 1) {
            state.title = message.content.trim();
            state.step = 2;
            const prompt2 = await message.reply(`✅ تم حفظ العنوان.\n\n**الخطوة [2/4]:** يرجى كتابة **الوصف (محتوى الرسالة)**:`);
            state.messagesToDelete.push(prompt2.id);
            return;
        }

        if (state.step === 2) {
            state.description = message.content.trim();
            state.step = 3;
            const prompt3 = await message.reply(`✅ تم حفظ الوصف.\n\n**الخطوة [3/4]:** ضع رابط صورة للرسالة (أو اكتب \`لا\` للإلغاء):`);
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
            state.step = 4;
            const prompt4 = await message.reply(`✅ تم حفظ الصورة.\n\n**الخطوة [4/4] الأخيرة:** هل تريد الإشارة والمنشن للعضو بداخل الرسالة الخاصة؟ (اكتب **نعم** أو **لا**):`);
            state.messagesToDelete.push(prompt4.id);
            return;
        }

        if (state.step === 4) {
            const input = message.content.trim();
            state.needPing = input === 'نعم' ? 'نعم' : 'لا';

            // تصفية وحذف محادثات الإعداد فوراً لشات نظيف
            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            const statusMsg = await message.channel.send('⏳ **جاري بدء عملية البرودكاست التدريجي والآمن لتجنب الباند من ديسكورد...**');

            const members = await message.guild.members.fetch({ withPresences: true });
            const allMembers = Array.from(members.values()).filter(m => !m.user.bot);

            // فرز الأعضاء (أونلاين أولاً ثم أوفلاين) لسرعة وصول الرسائل وزيادة التفاعل
            const onlineMembers = allMembers.filter(m => m.presence && m.presence.status !== 'offline');
            const offlineMembers = allMembers.filter(m => !m.presence || m.presence.status === 'offline');

            const sortedMembers = [...onlineMembers, ...offlineMembers];

            let sentCount = 0;
            let failedCount = 0;
            let index = 0;

            const interval = setInterval(async () => {
                if (index >= sortedMembers.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتمل البرودكاست بنجاح!**\n\n📬 تم الإرسال إلى: \`${sentCount}\` عضو.\n❌ فشل الإرسال لـ: \`${failedCount}\` عضو (بسبب إغلاق الخاص).`);
                    return;
                }

                const targetMember = sortedMembers[index];
                
                const pingText = state.needPing === 'نعم' ? `👋 مرحباً بك يا ${targetMember}!\n\n` : '';
                const personalEmbed = new EmbedBuilder()
                    .setTitle(state.title)
                    .setDescription(`${pingText}${state.description}`)
                    .setColor('#5865F2')
                    .setTimestamp();

                if (state.imageUrl) {
                    personalEmbed.setImage(state.imageUrl);
                }

                try {
                    await targetMember.send({ embeds: [personalEmbed] });
                    sentCount++;
                } catch (err) {
                    failedCount++;
                }

                const progressType = index < onlineMembers.length ? '🟢 جاري إرسال المتصلين (Online)' : '⚫ جاري إرسال غير المتصلين (Offline)';
                await statusMsg.edit(`⏳ **${progressType}...**\n\n📊 التقدم الحالي: \`${index + 1}/${sortedMembers.length}\` عضو.\n✅ تم الإرسال: \`${sentCount}\` | ❌ فشل: \`${failedCount}\``);
                index++;
            }, 2500); 

            dmSetup.delete(message.author.id);
            return;
        }
    }

    // 8. حماية روم الصور فقط ومسح النصوص وتنبيه العضو واللوج التلقائي للتخريب
    if (picOnlyChannelId && message.channel.id === picOnlyChannelId) {
        const hasAttachment = message.attachments.size > 0;
        const hasEmbedImage = message.embeds.some(e => e.image || e.thumbnail);

        if (!hasAttachment && !hasEmbedImage) {
            await message.delete().catch(() => {});

            await message.author.send(`❌ عذراً يا **${message.author.username}**! يمنع منعاً باتاً إرسال الرسائل النصية داخل قناة الصور فقط، هذه القناة مخصصة للصور والفيديوهات فقط.`).catch(() => {});

            const warns = userWarns.get(message.author.id) || 0;
            const newWarns = warns + 1;
            userWarns.set(message.author.id, newWarns);

            if (newWarns >= 5) {
                if (logPicChannelId) {
                    const logChannel = message.guild.channels.cache.get(logPicChannelId);
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

client.on('interactionCreate', async interaction => {
    // فتح تكت من القوائم المنسدلة المتعددة المستقلة والمحفوظ فيها معلومات القسم والرتب
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('multi_t_menu_')) {
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

                await channel.setTopic(`creator_id:${member.id}`);

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('بوابة المساعدة الفنية والخدمات | Ticket Open')
                    .setDescription(`مرحباً بك ${member}، تم فتح التذكرة الخاصة بك بنجاح وتحويلها للقسم المختص.\n\nيرجى كتابة استفسارك هنا بوضوح وانتظار استلام المشرفين للتذكرة لمساعدتك.`)
                    .setColor('#5865F2')
                    .setTimestamp();

                // أزرار التحكم الكاملة والمطلوبة من قبلك داخل التكت المفتوح
                const claimButton = new ButtonBuilder()
                    .setCustomId(`claim_custom_ticket_${targetRoleId}`)
                    .setLabel('استلام التكت')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🙋‍♂️');

                const alertStaffButton = new ButtonBuilder()
                    .setCustomId(`alert_staff_btn_${targetRoleId}`)
                    .setLabel('تنبيه الإدارة المستلمة')
                    .setStyle(ButtonStyle.Warning)
                    .setEmoji('⚠️');

                const alertUserButton = new ButtonBuilder()
                    .setCustomId(`alert_user_btn_${targetRoleId}`)
                    .setLabel('تنبيه العضو')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔔');

                const requestCloseButton = new ButtonBuilder()
                    .setCustomId(`request_close_btn_${targetRoleId}`)
                    .setLabel('طلب إغلاق التكت')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🛑');

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_custom_ticket_${targetRoleId}`)
                    .setLabel('إغلاق التكت')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                // دمج الأزرار بحد أقصى 5 أزرار في السطر الواحد
                const row1 = new ActionRowBuilder().addComponents(claimButton, alertStaffButton, alertUserButton, requestCloseButton, closeButton);

                const supportRoleMention = targetRoleId ? `<@&${targetRoleId}>` : '';
                await channel.send({ 
                    content: `${member} ${supportRoleMention}`, 
                    embeds: [welcomeEmbed], 
                    components: [row1] 
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

        // 1. زر استلام التكت
        if (customId.startsWith('claim_custom_ticket_')) {
            const targetRoleId = customId.replace('claim_custom_ticket_', '');
            const member = interaction.member;

            const hasRequiredRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المخصصة للتحكم فيها!', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferUpdate();

            const topic = interaction.channel.topic || '';
            const creatorId = topic.split('creator_id:')[1]?.split(';')[0] || '';
            
            await interaction.channel.setTopic(`creator_id:${creatorId};claimed_by:${member.id};claimer_name:${member.user.username}`);

            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .addFields({ name: 'المشرف المستلم', value: `👤 تم الاستلام بواسطة: ${member}` });

            const disabledClaimButton = new ButtonBuilder()
                .setCustomId('claimed_disabled_btn')
                .setLabel(`مستلمة بواسطة ${member.user.username}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(true);

            // جلب الأزرار الأخرى وحظر إظهار الـ Lag
            const alertStaffButton = new ButtonBuilder().setCustomId(`alert_staff_btn_${targetRoleId}`).setLabel('تنبيه الإدارة المستلمة').setStyle(ButtonStyle.Warning).setEmoji('⚠️');
            const alertUserButton = new ButtonBuilder().setCustomId(`alert_user_btn_${targetRoleId}`).setLabel('تنبيه العضو').setStyle(ButtonStyle.Secondary).setEmoji('🔔');
            const requestCloseButton = new ButtonBuilder().setCustomId(`request_close_btn_${targetRoleId}`).setLabel('طلب إغلاق التكت').setStyle(ButtonStyle.Secondary).setEmoji('🛑');
            const closeButton = new ButtonBuilder().setCustomId(`close_custom_ticket_${targetRoleId}`).setLabel('إغلاق التكت').setStyle(ButtonStyle.Danger).setEmoji('🔒');

            const row = new ActionRowBuilder().addComponents(disabledClaimButton, alertStaffButton, alertUserButton, requestCloseButton, closeButton);

            await interaction.editReply({ embeds: [updatedEmbed], components: [row] });
            
            const creatorMention = creatorId ? `<@${creatorId}>` : '';
            await interaction.followUp({ content: `${creatorMention} **تم استلام تكت عن طريق هذا الإدارة: ${member}، تابع معه.**` });
        }

        // 2. زر تنبيه الإدارة المستلمة (⚠️)
        if (customId.startsWith('alert_staff_btn_')) {
            const topic = interaction.channel.topic || '';
            const claimerId = topic.includes('claimed_by:') ? topic.split('claimed_by:')[1].split(';')[0] : null;

            if (!claimerId) {
                return interaction.reply({ content: '❌ لم يتم استلام هذه التذكرة من قبل أي مشرف بعد لتنبيهه.', flags: MessageFlags.Ephemeral });
            }

            const claimerUser = interaction.guild.members.cache.get(claimerId);
            if (claimerUser) {
                await interaction.reply({ content: `⚠️ ${claimerUser}، يرجى مراجعة التكت فوراً؛ لأن صاحب الطلب بانتظار ردك.` });
            } else {
                await interaction.reply({ content: '❌ تعذر العثور على المشرف المستلم حالياً.', flags: MessageFlags.Ephemeral });
            }
        }

        // 3. زر تنبيه العضو (🔔)
        if (customId.startsWith('alert_user_btn_')) {
            const targetRoleId = customId.replace('alert_user_btn_', '');
            const member = interaction.member;

            const hasRequiredRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ هذا الزر مخصص للمشرف المستلم أو الإدارة لتنبيه العضو.', flags: MessageFlags.Ephemeral });
            }

            const topic = interaction.channel.topic || '';
            const creatorId = topic.includes('creator_id:') ? topic.split('creator_id:')[1].split(';')[0] : null;

            if (creatorId) {
                const creatorUser = interaction.guild.members.cache.get(creatorId);
                await interaction.reply({ content: `🔔 تنبيه للعضو ${creatorUser}! يرجى مراجعة التذكرة لمتابعة الرد مع الإدارة.` });
            } else {
                await interaction.reply({ content: '❌ لم يتم التعرف على صاحب التذكرة لتنبيهه.', flags: MessageFlags.Ephemeral });
            }
        }

        // 4. زر طلب إغلاق التكت (🛑)
        if (customId.startsWith('request_close_btn_')) {
            const topic = interaction.channel.topic || '';
            const creatorId = topic.includes('creator_id:') ? topic.split('creator_id:')[1].split(';')[0] : null;

            if (interaction.user.id !== creatorId) {
                return interaction.reply({ content: '❌ هذا الخيار مخصص لصاحب التذكرة لطلب الإغلاق من الإدارة.', flags: MessageFlags.Ephemeral });
            }

            await interaction.reply({ content: '🛑 **قام العضو بتقديم طلب لإغلاق هذه التذكرة. يرجى من الإدارة مراجعة الطلب والموافقة على الإغلاق.**' });
        }

        // 5. زر إغلاق التذكرة المخصصة ونظام التقييم (🔒)
        if (customId.startsWith('close_custom_ticket_')) {
            const targetRoleId = customId.replace('close_custom_ticket_', '');
            const member = interaction.member;
            const topic = interaction.channel.topic || '';
            
            const creatorId = topic.includes('creator_id:') ? topic.split('creator_id:')[1].split(';')[0] : null;
            const claimerId = topic.includes('claimed_by:') ? topic.split('claimed_by:')[1].split(';')[0] : null;
            const claimerName = topic.includes('claimer_name:') ? topic.split('claimer_name:')[1].split(';')[0] : 'مشرف الدعم';

            const isClaimer = topic.includes(`claimed_by:${member.id}`);
            const hasSupportRole = member.roles.cache.has(targetRoleId);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isClaimer && !hasSupportRole && !isAdmin) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط لمن استلمها أو الرتبة المخصصة للقسم.', flags: MessageFlags.Ephemeral });
            }

            await interaction.reply({ content: '⚠️ جاري إرسال التقييم للعضو وحذف التذكرة خلال 5 ثوانٍ...' });

            await sendTicketLog(interaction.guild, interaction.channel.name, creatorId, claimerId, member);

            // إرسال أزرار التقييم للعضو في الخاص وحل مشكلة وصول التقييم تماماً
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

        // تسجيل التقييم في قناة اللوج فور ضغط العضو عليه بالخاص
        if (customId.startsWith('rate_')) {
            await interaction.deferUpdate();
            const parts = customId.split('_');
            const rating = parseInt(parts[1]);
            const claimerName = parts[2];

            await sendRatingLog(interaction.guild, interaction.user, rating, claimerName);
            await interaction.followUp({ content: '✅ **شكراً جزيلاً لك على تقييمك! تم إرسال التقييم للإدارة بنجاح.**', flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(TOKEN);