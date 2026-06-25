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

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Ticket & Log Bot is Active!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server connected to port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// الاختصارات والأوامر الأساسية
const TICKET_PREFIX = '-st'; 
const EMBED_PREFIX = '-em';  
const DM_PREFIX = '-dm';     

// اختصارات اللوج (Logs)
const LOG_TICKET_PREFIX = '-lg';       
const LOG_DM_PREFIX = '-lgdm';         
const LOG_FEEDBACK_PREFIX = '-lgfeedback'; 
const LOG_EMBED_PREFIX = '-lgem';      

// التحكم في البرودكاست الخاص
const STOP_DM_PREFIX = '-sdm';         
const CHECK_DM_PREFIX = '-dmanyone';   

const tempSetup = new Map();
const embedSetup = new Map();
const dmSetup = new Map();

// متغيرات حفظ قنوات اللوج
let logTicketChannelId = null;
let logDmChannelId = null;
let logFeedbackChannelId = null;
let logEmbedChannelId = null;

let activeBroadcast = null; // لتتبع البرودكاست النشط

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const commands = [
        {
            name: 'setup',
            description: 'بدء الإعداد التفاعلي لتخصيص بوكس التذاكر الخاص بك'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('Slash commands registered.');
    } catch (error) {
        console.error(error);
    }
});

// دالة بدء الإعداد التفاعلي لبوكس التكت المتعدد (نظامك المفضل)
async function startInteractiveSetup(channel, user) {
    const member = channel.guild.members.cache.get(user.id);
    if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
        return channel.send('❌ عذراً، هذا الأمر مخصص للإداريين فقط.');
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
    tempSetup.set(user.id, setupState);

    const prompt = await channel.send(`${user}, ⚙️ **بدء إعداد بوكس تذاكر مخصص بالكامل**\n\n**الخطوة [1]:** كم عدد الأقسام (الخيارات) التي تريد وضعها في هذا البوكس؟ (اكتب رقماً من **1 إلى 5**):`);
    setupState.messagesToDelete.push(prompt.id);
}

// دالة بدء الإعداد التفاعلي للإمبد المخصص مع الأزرار
async function startEmbedSetup(channel, user) {
    const member = channel.guild.members.cache.get(user.id);
    if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
        return channel.send('❌ عذراً، هذا الأمر مخصص للإداريين فقط.');
    }

    const embedState = { step: 1, title: null, description: null, buttonLabel: null, messagesToDelete: [] };
    embedSetup.set(user.id, embedState);

    const prompt = await channel.send(`${user}, 📝 **بدء إعداد إمبد مخصص**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان (Title)** الإمبد:`);
    embedState.messagesToDelete.push(prompt.id);
}

// دالة إرسال تقرير اللوج عند إغلاق التذكرة
async function sendTicketLog(guild, channelName, creatorId, claimerId, closerUser) {
    if (!logTicketChannelId) return;
    const logChannel = guild.channels.cache.get(logTicketChannelId);
    if (!logChannel) return;

    const creator = guild.members.cache.get(creatorId);
    const claimer = claimerId ? guild.members.cache.get(claimerId) : 'لا يوجد (لم تُستلم التذكرة)';

    const logEmbed = new EmbedBuilder()
        .setTitle('📂 سجل إغلاق تذكرة | Ticket Logs')
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

// دالة إرسال تقرير التقييم للوج المخصص (-lgfeedback)
async function sendRatingLog(guild, creator, rating, claimerName) {
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

// دالة إرسال تقرير لوج إنشاء الإمبد (-lgem)
async function sendEmbedLog(guild, user, title, channel) {
    if (!logEmbedChannelId) return;
    const logChannel = guild.channels.cache.get(logEmbedChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('📝 سجل إنشاء إمبد جديد')
        .setColor('#3498db')
        .addFields(
            { name: '👤 المشرف المنشئ', value: `${user}`, inline: true },
            { name: '📺 القناة المستهدفة', value: `${channel}`, inline: true },
            { name: '🏷️ عنوان الإمبد', value: `\`${title}\``, inline: true }
        )
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error(err);
    }
}

// دالة إرسال تقرير لوج البرودكاست الخاص (-lgdm)
async function sendBroadcastLog(guild, user, title, sent, failed) {
    if (!logDmChannelId) return;
    const logChannel = guild.channels.cache.get(logDmChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('📢 تقرير إرسال برودكاست الخاص')
        .setColor('#2ecc71')
        .addFields(
            { name: '👤 المشرف المرسل', value: `${user}`, inline: true },
            { name: '🏷️ عنوان الرسالة', value: `\`${title}\``, inline: true },
            { name: '✅ تم الإرسال إلى', value: `\`${sent}\` أعضاء`, inline: true },
            { name: '❌ فشل الإرسال لـ', value: `\`${failed}\` أعضاء`, inline: true }
        )
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error(err);
    }
}

// دالة فحص وتحديد قنوات اللوج المختلفة بسهولة
async function handleLogSetup(message, prefix, name) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const channelMention = message.mentions.channels.first();
    const inputId = args[0];

    const targetChannel = channelMention || message.guild.channels.cache.get(inputId);

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        return message.reply(`❌ يرجى منشن قناة نصية صحيحة أو وضع الأيدي لتعيين قناة لوج **${name}**:`);
    }

    await message.reply(`✅ **تم تعيين قناة لوج ${name} على: ${targetChannel}**`);
    await message.delete().catch(() => {});
    return targetChannel.id;
}

// التعامل مع الرسائل والاختصارات
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // 1. إعداد قنوات اللوج المختلفة
    if (message.content.startsWith(LOG_TICKET_PREFIX) && !message.content.startsWith(LOG_DM_PREFIX) && !message.content.startsWith(LOG_FEEDBACK_PREFIX) && !message.content.startsWith(LOG_EMBED_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ عذراً، هذا الأمر للإداريين فقط.');
        logTicketChannelId = await handleLogSetup(message, LOG_TICKET_PREFIX, 'التذاكر');
        return;
    }
    if (message.content.startsWith(LOG_DM_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ عذراً، هذا الأمر للإداريين فقط.');
        logDmChannelId = await handleLogSetup(message, LOG_DM_PREFIX, 'البرودكاست الخاص');
        return;
    }
    if (message.content.startsWith(LOG_FEEDBACK_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ عذراً، هذا الأمر للإداريين فقط.');
        logFeedbackChannelId = await handleLogSetup(message, LOG_FEEDBACK_PREFIX, 'التقييمات والتعليقات');
        return;
    }
    if (message.content.startsWith(LOG_EMBED_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ عذراً، هذا الأمر للإداريين فقط.');
        logEmbedChannelId = await handleLogSetup(message, LOG_EMBED_PREFIX, 'إنشاء الإمبد');
        return;
    }

    // 2. إيقاف برودكاست الخاص فوراً (-sdm)
    if (message.content.trim() === STOP_DM_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ عذراً، هذا الأمر للإداريين فقط.');
        if (!activeBroadcast) {
            return message.reply('❌ لا يوجد برودكاست خاص نشط حالياً لإيقافه.');
        }
        clearInterval(activeBroadcast.intervalId);
        await message.reply(`🛑 **تم إيقاف البرودكاست الخاص فوراً بواسطة المشرف: ${message.author}**\n\n📊 تم الإرسال بنجاح إلى: \`${activeBroadcast.sentCount}\` | الفشل: \`${activeBroadcast.failedCount}\``);
        
        await sendBroadcastLog(message.guild, activeBroadcast.author, `${activeBroadcast.title} (تم إيقافه يدوياً)`, activeBroadcast.sentCount, activeBroadcast.failedCount);
        activeBroadcast = null;
        await message.delete().catch(() => {});
        return;
    }

    // 3. فحص إذا كان هناك برودكاست نشط (-dmanyone)
    if (message.content.trim() === CHECK_DM_PREFIX) {
        if (!activeBroadcast) {
            return message.reply('🟢 **لا يوجد أي برودكاست خاص نشط حالياً في السيرفر. يمكنك البدء بأمان.**');
        } else {
            return message.reply(`⚠️ **يوجد برودكاست خاص نشط حالياً!**\n\n👤 بواسطة المشرف: ${activeBroadcast.author}\n🏷️ عنوان الرسالة: \`${activeBroadcast.title}\`\n📊 حالة الإرسال الحالية: \`${activeBroadcast.currentIndex}/${activeBroadcast.total}\` عضو.`);
        }
    }

    // 4. الاختصار -st لبوكس التذاكر التفاعلي المتعدد
    if (message.content.trim() === TICKET_PREFIX) {
        try {
            await startInteractiveSetup(message.channel, message.author);
            await message.delete().catch(() => {});
        } catch (err) {
            console.error(err);
        }
        return;
    }

    // 5. الاختصار -em للإمبد المخصص مع الأزرار
    if (message.content.trim() === EMBED_PREFIX) {
        try {
            await startEmbedSetup(message.channel, message.author);
            await message.delete().catch(() => {});
        } catch (err) {
            console.error(err);
        }
        return;
    }

    // 6. الاختصار -dm لبرودكاست الخاص
    if (message.content.trim() === DM_PREFIX) {
        const member = message.member;
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ عذراً، هذا الأمر مخصص للإداريين فقط.');
        }

        if (activeBroadcast) {
            return message.reply(`❌ لا يمكنك بدء برودكاست جديد؛ لأن هناك برودكاست نشط حالياً بواسطة المشرف: **${activeBroadcast.author.username}**.`);
        }

        const dmState = { step: 1, title: null, description: null, imageUrl: null, messagesToDelete: [] };
        dmSetup.set(message.author.id, dmState);

        const prompt1 = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست الخاص الآمن**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان** الرسالة:`);
        dmState.messagesToDelete.push(message.id, prompt1.id);
        return;
    }

    // تتبع خطوات إعداد بوكس التكت المخصص -st
    if (tempSetup.has(message.author.id)) {
        const state = tempSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 'get_count') {
            const count = parseInt(message.content.trim());
            if (isNaN(count) || count < 1 || count > 5) {
                return message.reply('❌ يرجى كتابة رقم صحيح من 1 إلى 5 فقط:');
            }
            state.optionsCount = count;
            state.currentOptionIndex = 0;
            state.step = 'get_option_label';
            const prompt = await message.reply(`✅ تم تحديد عدد الأقسام: **${count}**\n\n💬 **الآن لنبدأ بتجهيز القسم رقم [1]**:\nيرجى كتابة **اسم القسم**:`);
            state.messagesToDelete.push(prompt.id);
            return;
        }

        if (state.step === 'get_option_label') {
            const label = message.content.trim();
            state.options.push({ label: label, roleId: null, value: `opt_${state.currentOptionIndex + 1}` });
            state.step = 'get_option_role';
            const prompt = await message.reply(`✅ تم حفظ اسم القسم: **${label}**\n\n👤 يرجى كتابة **أيدي الرتبة (Role ID)** المسؤولة عن تذاكر هذا القسم:`);
            state.messagesToDelete.push(prompt.id);
            return;
        }

        if (state.step === 'get_option_role') {
            const roleId = message.content.trim();
            const role = message.guild.roles.cache.get(roleId);
            if (!role) {
                return message.reply('❌ أيدي الرتبة غير صحيح. يرجى كتابة أيدي رتبة صحيح وموجود بالسيرفر:');
            }

            state.options[state.currentOptionIndex].roleId = roleId;
            state.currentOptionIndex++;

            if (state.currentOptionIndex < state.optionsCount) {
                state.step = 'get_option_label';
                const prompt = await message.reply(`✅ تم ربط الرتبة **${role.name}** بالقسم السابق.\n\n💬 **لننتقل للقسم رقم [${state.currentOptionIndex + 1}]**:\nيرجى كتابة **اسم القسم**:`);
                state.messagesToDelete.push(prompt.id);
                return;
            } else {
                state.step = 'get_image';
                const prompt = await message.reply(`✅ تم الانتهاء من إعداد جميع الأقسام بنجاح!\n\n🖼️ يرجى وضع **رابط الصورة (Image URL)** للبوكس الرئيسي (إذا كنت لا تريد صورة اكتب: \`لا\`):`);
                state.messagesToDelete.push(prompt.id);
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
            const prompt = await message.reply(`✅ تم حفظ إعدادات الصورة.\n\n📂 يرجى كتابة **أيدي القسم (Category ID)** الذي تفتح فيه التذاكر (إذا كنت تريدها تفتح في أي مكان اكتب: \`لا\`):`);
            state.messagesToDelete.push(prompt.id);
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
                .setDescription(`يرجى اختيار القسم المخصص أدناه لفتح تذكرة مباشرة مع رتبة الدعم المخصصة.`)
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
            
            // تنظيف الشات تلقائياً وحذف جميع رسائل الإعداد
            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            tempSetup.delete(message.author.id);
        }
    }

    // تتبع خطوات إعداد إمبد -em المخصص
    if (embedSetup.has(message.author.id)) {
        const state = embedSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 1) {
            state.title = message.content.trim();
            state.step = 2;
            const prompt2 = await message.reply(`✅ تم حفظ العنوان.\n\n**الخطوة [2/3]:** يرجى كتابة **وصف (Description)** الإمبد:`);
            state.messagesToDelete.push(prompt2.id);
            return;
        }

        if (state.step === 2) {
            state.description = message.content.trim();
            state.step = 3;
            const prompt3 = await message.reply(`✅ تم حفظ الوصف.\n\n**الخطوة [3/3] الأخيرة:** يرجى كتابة **النص المكتوب على الزر**:`);
            state.messagesToDelete.push(prompt3.id);
            return;
        }

        if (state.step === 3) {
            state.buttonLabel = message.content.trim();

            const customEmbed = new EmbedBuilder()
                .setTitle(state.title)
                .setDescription(state.description)
                .setColor('#5865F2');

            const customButton = new ButtonBuilder()
                .setCustomId('general_embed_button_action')
                .setLabel(state.buttonLabel)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫');

            const row = new ActionRowBuilder().addComponents(customButton);

            await message.channel.send({ embeds: [customEmbed], components: [row] });
            
            await sendEmbedLog(message.guild, message.author, state.title, message.channel);

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            embedSetup.delete(message.author.id);
        }
    }

    // تتبع خطوات إعداد برودكاست الخاص -dm
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

            const statusMsg = await message.channel.send('⏳ **جاري بدء عملية البرودكاست التدريجي والآمن لمنع البان...**');

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            const members = await message.guild.members.fetch();
            const memberArray = Array.from(members.values()).filter(m => !m.user.bot);

            activeBroadcast = {
                guildId: message.guild.id,
                author: message.author,
                title: state.title,
                sentCount: 0,
                failedCount: 0,
                currentIndex: 0,
                total: memberArray.length,
                intervalId: null
            };

            const interval = setInterval(async () => {
                if (!activeBroadcast || activeBroadcast.currentIndex >= memberArray.length) {
                    clearInterval(interval);
                    if (activeBroadcast) {
                        await statusMsg.edit(`✅ **اكتمل البرودكاست بنجاح!**\n\n📬 تم الإرسال إلى: \`${activeBroadcast.sentCount}\` عضو.\n❌ فشل الإرسال لـ: \`${activeBroadcast.failedCount}\` عضو.`);
                        await sendBroadcastLog(message.guild, activeBroadcast.author, activeBroadcast.title, activeBroadcast.sentCount, activeBroadcast.failedCount);
                        activeBroadcast = null;
                    }
                    return;
                }

                const targetMember = memberArray[activeBroadcast.currentIndex];
                try {
                    await targetMember.send({ embeds: [broadcastEmbed] });
                    activeBroadcast.sentCount++;
                } catch (err) {
                    activeBroadcast.failedCount++;
                }

                await statusMsg.edit(`⏳ **جاري الإرسال التدريجي لجميع الأعضاء...**\n\n📊 التقدم: \`${activeBroadcast.currentIndex + 1}/${activeBroadcast.total}\` عضو.\n✅ تم الإرسال: \`${activeBroadcast.sentCount}\` | ❌ فشل: \`${activeBroadcast.failedCount}\``);
                activeBroadcast.currentIndex++;
            }, 3000); 

            activeBroadcast.intervalId = interval;
            dmSetup.delete(message.author.id);
            return;
        }
    }

    // أمر استدعاء العضو داخل التكت المفتوح !ping
    if (message.content.trim().toLowerCase() === '!ping') {
        const topic = message.channel.topic || '';
        if (topic.includes('creator_id:')) {
            const creatorPart = topic.split('creator_id:')[1];
            const creatorId = creatorPart ? creatorPart.split(';')[0] : null;
            if (creatorId) {
                const member = message.guild.members.cache.get(creatorId);
                if (member) {
                    return message.channel.send(`🔔 تنبيه للعضو: ${member}، يرجى مراجعة التذكرة لمتابعة الرد مع الإدارة.`);
                }
            }
        }
    }
});

// التعامل مع السلاش والتفاعلات بشكل فوري
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup') {
            await startInteractiveSetup(interaction.channel, interaction.user);
            await interaction.reply({ content: 'بدء الإعداد المخصص التفاعلي بداخل الشات...', flags: MessageFlags.Ephemeral });
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('multi_t_menu_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const parts = interaction.customId.split('_');
            const targetCategoryId = parts[4] === 'none' ? null : parts[4];

            const selectedValue = interaction.values[0];
            const targetRoleId = selectedValue.replace('opaction_', '');

            const guild = interaction.guild;
            const member = interaction.member;

            // منع العضو من فتح أكثر من تذكرة واحدة في نفس الوقت
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
                    .setTitle('تذكرة دعم جديدة')
                    .setDescription(`مرحباً بك ${member}، تم فتح التذكرة الخاصة بك بنجاح وتحويلها للقسم المختص.\n\nيرجى كتابة استفسارك هنا بوضوح وانتظار استلام المشرفين للتذكرة لمساعدتك.`)
                    .setColor('#5865F2')
                    .setTimestamp();

                const claimButton = new ButtonBuilder()
                    .setCustomId(`claim_custom_ticket_${targetRoleId}`)
                    .setLabel('استلام التذكرة')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🙋‍♂️');

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_custom_ticket_${targetRoleId}`)
                    .setLabel('إغلاق التذكرة')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

                const supportRoleMention = targetRoleId ? `<@&${targetRoleId}>` : '';
                await channel.send({ 
                    content: `${member} ${supportRoleMention}`, 
                    embeds: [welcomeEmbed], 
                    components: [row] 
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

        // استلام تذكرة مخصصة
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
            
            // حفظ أيدي المشرف المستلم وأيدي صانع التكت في التوبك بشكل صحيح وسليم
            await interaction.channel.setTopic(`creator_id:${creatorId};claimed_by:${member.id};claimer_name:${member.user.username}`);

            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .addFields({ name: 'المشرف المستلم', value: `👤 تم الاستلام بواسطة: ${member}` });

            const disabledClaimButton = new ButtonBuilder()
                .setCustomId('claimed_disabled_btn')
                .setLabel(`مستلمة بواسطة ${member.user.username}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(true);

            const closeButton = new ButtonBuilder()
                .setCustomId(`close_custom_ticket_${targetRoleId}`)
                .setLabel('إغلاق التذكرة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const row = new ActionRowBuilder().addComponents(disabledClaimButton, closeButton);

            await interaction.editReply({ embeds: [updatedEmbed], components: [row] });
            
            const creatorMention = creatorId ? `<@${creatorId}>` : '';
            await interaction.followUp({ content: `${creatorMention} **تم استلام تكت عن طريق هذا الإدارة: ${member}، تابع معه.**` });
        }

        // إغلاق تذكرة مخصصة وإرسال التقييم
        if (customId.startsWith('close_custom_ticket_')) {
            const targetRoleId = customId.replace('close_custom_ticket_', '');
            const member = interaction.member;
            const topic = interaction.channel.topic || '';
            
            const creatorId = topic.split('creator_id:')[1]?.split(';')[0] || '';
            const claimerId = topic.includes('claimed_by:') ? topic.split('claimed_by:')[1].split(';')[0] : '';
            const claimerName = topic.includes('claimer_name:') ? topic.split('claimer_name:')[1].split(';')[0] : 'مشرف الدعم';

            const isClaimer = topic.includes(`claimed_by:${member.id}`);
            const hasSupportRole = member.roles.cache.has(targetRoleId);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isClaimer && !hasSupportRole && !isAdmin) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط لمن استلمها أو الرتبة المخصصة للقسم.', flags: MessageFlags.Ephemeral });
            }

            // الاستجابة الفورية لمنع الـ Lag وحل مشكلة عدم الإغلاق
            await interaction.reply({ content: '⚠️ جاري إرسال التقييم للعضو وحذف التذكرة خلال 5 ثوانٍ...' });

            // إرسال اللوج الخاص بالإغلاق
            await sendTicketLog(interaction.guild, interaction.channel.name, creatorId, claimerId, member);

            // إرسال أزرار التقييم للعضو في الخاص
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

            // جلب السيرفر ديناميكياً لتسجيل اللوج في القناة الصحيحة
            const guilds = client.guilds.cache;
            for (const [guildId, guild] of guilds) {
                await sendRatingLog(guild, interaction.user, rating, claimerName);
            }
            
            await interaction.followUp({ content: '✅ **شكراً جزيلاً لك على تقييمك! تم إرسال التقييم للإدارة بنجاح.**', flags: MessageFlags.Ephemeral });
        }

        // التعامل مع زر الإمبد المخصص العام
        if (customId === 'general_embed_button_action') {
            await interaction.reply({ content: 'سيتم فتح تذكرة عامة لك الآن...', flags: MessageFlags.Ephemeral });
            const guild = interaction.guild;
            const member = interaction.member;

            try {
                const channel = await guild.channels.create({
                    name: `ticket-general-${member.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });

                await channel.setTopic(`creator_id:${member.id}`);

                const embed = new EmbedBuilder()
                    .setTitle('تذكرة عامة مفتوحة')
                    .setDescription(`مرحباً بك ${member}، يرجى كتابة استفسارك هنا وسيجيبك الإشراف بأقرب وقت.`)
                    .setColor('#5865F2');

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_custom_ticket_general')
                    .setLabel('إغلاق التذكرة')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row = new ActionRowBuilder().addComponents(closeButton);
                await channel.send({ content: `${member}`, embeds: [embed], components: [row] });
            } catch (err) {
                console.error(err);
            }
        }

        if (customId === 'close_custom_ticket_general') {
            await interaction.reply({ content: '⚠️ سيتم حذف التذكرة نهائياً وإغلاق القناة خلال 5 ثوانٍ...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error(err);
                }
            }, 5000);
        }
    }
});

client.login(TOKEN);