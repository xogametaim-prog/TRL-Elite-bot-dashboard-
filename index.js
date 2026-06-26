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

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Ticket & Broadcast Bot is Online!'));
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

const TICKET_PREFIX = '-st'; 
const EMBED_PREFIX = '-em';  
const BROADCAST_PREFIX = '-t';
const HELP_PREFIX = '-hp'; 

const LOG_TICKET_PREFIX = '-lgt';      
const LOG_FEEDBACK_PREFIX = '-lgfd';   

const tempSetup = new Map();
const embedSetup = new Map();
const dmSetup = new Map();

let logTicketChannelId = null;
let logFeedbackChannelId = null;

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// منع انهيار البوت عند حدوث أي خطأ غير متوقع بالاتصال مع ديسكورد
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

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

    client.guilds.cache.forEach(async guild => {
        const defaultChannel = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages))
            .first();
        if (defaultChannel) {
            await defaultChannel.send('📢 **تم تحديث البوت وتفعيل كافة الأوامر والميزات التفاعلية الجديدة بنجاح!**').catch(() => {});
        }
    });
});

async function sendTicketLog(guild, channelName, creatorId, claimerId, closerUser, claimTime = null) {
    if (!logTicketChannelId) return;
    const logChannel = guild.channels.cache.get(logTicketChannelId);
    if (!logChannel) return;

    const creator = guild.members.cache.get(creatorId);
    const claimer = claimerId ? guild.members.cache.get(claimerId) : 'لا يوجد (لم تُستلم)';

    const logEmbed = new EmbedBuilder()
        .setTitle('📂 سجل إغلاق تذكرة | Ticket Log')
        .setColor('#e74c3c')
        .setDescription(`تم إغلاق وحذف قناة تذكرة بنجاح من قبل الإدارة.`)
        .addFields(
            { name: '📝 اسم التذكرة', value: `\`${channelName}\``, inline: true },
            { name: '👤 منشئ التذكرة', value: creator ? `${creator}` : `\`أيدي: ${creatorId}\``, inline: true },
            { name: '⏰ وقت الفتح', value: `<t:${Math.floor(Date.now() / 1000 - 300)}:R>`, inline: true },
            { name: '🙋‍♂️ الإداري المستلم', value: claimerId ? `${claimer}` : '`لم يتم الاستلام`', inline: true },
            { name: '⏱️ وقت الاستلام', value: claimTime ? `<t:${Math.floor(claimTime / 1000)}:t>` : '`لم تستلم`', inline: true },
            { name: '🔒 مغلق التذكرة', value: `${closerUser}`, inline: true }
        )
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [logEmbed] });
    } catch (err) {
        console.error(err);
    }
}

async function sendRatingLog(guild, creator, rating, claimerName) {
    if (!logFeedbackChannelId) return;
    const logChannel = guild.channels.cache.get(logFeedbackChannelId);
    if (!logChannel) return;

    const ratingStars = '⭐'.repeat(rating);

    const embed = new EmbedBuilder()
        .setTitle('⭐ تقييم مشرف تذكرة جديد | Feedback')
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

function getHelpEmbed() {
    return new EmbedBuilder()
        .setTitle('⚙️ دليل اختصارات وأوامر البوت المطور بالكامل')
        .setDescription('مرحباً بك! إليك الشرح المفصل لجميع الاختصارات والميزات التفاعلية المتاحة لخدمتكم:')
        .setColor('#5865F2')
        .addFields(
            { name: '📂 أولاً: اختصارات اللوج والسجلات (Logs)', value: 
                `**${LOG_TICKET_PREFIX} [#القناة أو الأيدي]** : لتحديد قناة سجلات وتفاصيل حركة التذاكر.\n` +
                `**${LOG_FEEDBACK_PREFIX} [#القناة أو الأيدي]** : لتحديد روم إرسال تقييمات الدعم الفني بالنجوم (⭐) التي يختارها العضو.`
            },
            { name: '⚙️ ثانياً: اختصارات التصميم والإعداد التفاعلي لشات نظيف', value: 
                `**${TICKET_PREFIX}** : لتصميم بوكس التذاكر المتعدد (تحدد الرتب، الأسماء، وعدد المربعات من 1 إلى 5 أقسام، ويمسح رسائل الإعداد فوراً عند الانتهاء).\n` +
                `**${EMBED_PREFIX}** : لتصميم وإرسال رسائل إمبد تفاعلية مخصصة بـ (عنوان، وصف، وزر تفاعلي أسفل الرسالة).\n` +
                `**${BROADCAST_PREFIX}** : لبدء برودكاست الخاص الذكي فائق السرعة؛ يمنشن العضو، ويرسل للمتصلين (Online) أولاً ثم للاوفلاين (Offline) ثانياً لتفادي الباند من ديسكورد.`
            },
            { name: '🎫 ثالثاً: الاختصارات الداخلية للتحكم بداخل التذاكر المفتوحة', value: 
                `**!ping** : يكتبه المشرف داخل التذكرة؛ ليقوم البوت بعمل منشن واستدعاء فوري وسريع للعضو في الروم.\n` +
                `**أزرار التذكرة** : تحتوي كل تذكرة على أزرار تفاعلية فورية لـ (استلام التكت، إغلاق التكت، تنبيه العضو، منشن الإدارة، وطلب إغلاق التكت لإنهاء المشكلة).`
            }
        )
        .setTimestamp();
}

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();

    if (content === HELP_PREFIX) {
        await message.channel.send({ embeds: [getHelpEmbed()] });
        await message.delete().catch(() => {});
        return;
    }

    if (content.startsWith(LOG_TICKET_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logTicketChannelId = await handleConfigSetup(message, LOG_TICKET_PREFIX, 'سجلات حركة التذاكر (-lgt)');
        return;
    }

    if (content.startsWith(LOG_FEEDBACK_PREFIX)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        logFeedbackChannelId = await handleConfigSetup(message, LOG_FEEDBACK_PREFIX, 'تقييمات الدعم الفني بالنجوم (-lgfd)');
        return;
    }

    if (content === TICKET_PREFIX) {
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

        const prompt = await message.channel.send(`${message.author}, ⚙️ **بدء إعداد بوكس تذاكر تفاعلي جديد ومتعدد الأقسام**\n\n**الخطوة [1]:** كم عدد الأقسام (الخيارات) التي تريد وضعها في هذا البوكس؟ (اكتب رقماً من **1 إلى 5**):`);
        setupState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    if (content === EMBED_PREFIX) {
        const member = message.member;
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ عذراً، هذا الأمر مخصص للإداريين فقط.');
        }

        const embedState = { step: 1, title: null, description: null, buttonLabel: null, messagesToDelete: [] };
        embedSetup.set(message.author.id, embedState);

        const prompt1 = await message.channel.send(`${message.author}, 📝 **بدء إعداد إمبد مخصص**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان (Title)** الإمبد:`);
        embedState.messagesToDelete.push(message.id, prompt1.id);
        return;
    }

    if (content === BROADCAST_PREFIX) {
        const member = message.member;
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ عذراً، هذا الأمر مخصص للإداريين فقط.');
        }

        const broadcastState = { step: 1, title: null, description: null, imageUrl: null, messagesToDelete: [] };
        dmSetup.set(message.author.id, broadcastState);

        const prompt = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست الخاص فائق السرعة والآمن**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان** رسالة البرودكاست:`);
        broadcastState.messagesToDelete.push(message.id, prompt.id);
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

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            embedSetup.delete(message.author.id);
        }
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

            const statusMsg = await message.channel.send('⏳ **جاري فرز الأعضاء والبدء بالبرودكاست التدريجي الفائق السرعة والآمن...**');

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            const members = await message.guild.members.fetch();
            
            const onlineMembers = [];
            const offlineMembers = [];

            members.forEach(member => {
                if (member.user.bot) return;
                const status = member.presence ? member.presence.status : 'offline';
                if (status === 'offline') {
                    offlineMembers.push(member);
                } else {
                    onlineMembers.push(member);
                }
            });

            const sortedMembers = [...onlineMembers, ...offlineMembers];

            let sentCount = 0;
            let failedCount = 0;
            let index = 0;

            const interval = setInterval(async () => {
                if (index >= sortedMembers.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتمل البرودكاست بنجاح فائق!**\n\n📬 تم الإرسال للمتصلين أولاً والأوفلاين ثانياً بنجاح.\n🟢 ناجح: \`${sentCount}\` | ❌ فشل: \`${failedCount}\``);
                    return;
                }

                const targetMember = sortedMembers[index];
                
                const personalizedEmbed = new EmbedBuilder()
                    .setTitle(state.title)
                    .setDescription(`أهلاً بك يا ${targetMember} 👋\n\n${state.description}`)
                    .setColor('#5865F2')
                    .setTimestamp();

                if (state.imageUrl) {
                    personalizedEmbed.setImage(state.imageUrl);
                }

                try {
                    await targetMember.send({ content: `${targetMember}`, embeds: [personalizedEmbed] });
                    sentCount++;
                } catch (err) {
                    failedCount++;
                }

                await statusMsg.edit(`⏳ **جاري الإرسال التدريجي للأعضاء (المتصلين 🟢 ثم الأوفلاين 🔴)...**\n\n📊 التقدم: \`${index + 1}/${sortedMembers.length}\` عضو.\n✅ تم الإرسال: \`${sentCount}\` | ❌ فشل: \`${failedCount}\``);
                index++;
            }, 2000); 

            dmSetup.delete(message.author.id);
            return;
        }
    }

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

client.on('interactionCreate', async interaction => {
    // حل مشكلة تأخر الاستجابة (Interaction Timeout) عبر إرسال الرد المبدئي في ديسكورد فوراً وبأقل من ثانية واحدة لضمان استقرار البوت
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup') {
            await interaction.reply({ content: 'بدء الإعداد المخصص بالخاص أو الشات...', flags: MessageFlags.Ephemeral }).catch(() => {});
            await startInteractiveSetup(interaction.channel, interaction.user);
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('multi_t_menu_')) {
            // الاستجابة الفورية للغاية خلال أقل من جزء من الثانية لإنهاء مهلة الـ 3 ثوانٍ الخاصة بـ ديسكورد
            await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

            const parts = interaction.customId.split('_');
            const targetCategoryId = parts[4] === 'none' ? null : parts[4];

            const selectedValue = interaction.values[0];
            const targetRoleId = selectedValue.replace('opaction_', '');

            const guild = interaction.guild;
            const member = interaction.member;

            const existingChannel = guild.channels.cache.find(c => c.name.startsWith('ticket-') && c.name.endsWith(member.user.username));
            if (existingChannel) {
                return interaction.editReply({ content: `❌ لا يمكنك فتح تذكرة جديدة؛ لأن لديك تذكرة مفتوحة بالفعل وهي: ${existingChannel}` }).catch(() => {});
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

                await channel.setTopic(`creator_id:${member.id};open_time:${Date.now()}`);

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('🎫 تذكرة دعم مخصصة جديدة')
                    .setDescription(`مرحباً بك ${member}، تم فتح التذكرة الخاصة بك بنجاح وتحويلها للقسم المختص.\n\nيرجى استخدام الأزرار أدناه لإدارة التذكرة والتواصل مع الإدارة.`)
                    .setColor('#5865F2')
                    .setTimestamp();

                const claimButton = new ButtonBuilder().setCustomId(`btn_claim_${targetRoleId}`).setLabel('استلام التذكرة 🙋‍♂️').setStyle(ButtonStyle.Primary);
                const closeButton = new ButtonBuilder().setCustomId(`btn_close_${targetRoleId}`).setLabel('إغلاق التذكرة 🔒').setStyle(ButtonStyle.Danger);
                const pingUserBtn = new ButtonBuilder().setCustomId('btn_ping_user').setLabel('تنبيه العضو 🔔').setStyle(ButtonStyle.Secondary);
                const pingAdminBtn = new ButtonBuilder().setCustomId(`btn_ping_admin_${targetRoleId}`).setLabel('تنبيه الإدارة 🚨').setStyle(ButtonStyle.Secondary);
                const requestCloseBtn = new ButtonBuilder().setCustomId('btn_request_close').setLabel('طلب إغلاق 🛑').setStyle(ButtonStyle.Success);

                const row1 = new ActionRowBuilder().addComponents(claimButton, closeButton);
                const row2 = new ActionRowBuilder().addComponents(pingUserBtn, pingAdminBtn, requestCloseBtn);

                const supportRoleMention = targetRoleId ? `<@&${targetRoleId}>` : '';
                await channel.send({ 
                    content: `${member} ${supportRoleMention}`, 
                    embeds: [welcomeEmbed], 
                    components: [row1, row2] 
                });

                await interaction.editReply({ content: `تم فتح تذكرتك بنجاح في القناة: ${channel}` }).catch(() => {});

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ حدث خطأ غير متوقع أثناء محاولة إنشاء التذكرة.' }).catch(() => {});
            }
        }
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;
        const member = interaction.member;

        if (customId.startsWith('btn_claim_')) {
            const targetRoleId = customId.replace('btn_claim_', '');

            const hasRequiredRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المخصصة للتحكم فيها!', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            // الاستجابة الفورية والسريعة لديسكورد
            await interaction.deferUpdate().catch(() => {});

            const topic = interaction.channel.topic || '';
            const creatorId = topic.split('creator_id:')[1]?.split(';')[0] || '';
            const openTime = topic.split('open_time:')[1]?.split(';')[0] || Date.now();
            
            await interaction.channel.setTopic(`creator_id:${creatorId};open_time:${openTime};claimed_by:${member.id};claimer_name:${member.user.username};claim_time:${Date.now()}`);

            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .addFields({ name: 'المشرف المستلم', value: `👤 تم الاستلام بواسطة: ${member}` });

            const disabledClaimButton = new ButtonBuilder().setCustomId('claimed_disabled_btn').setLabel(`مستلمة بواسطة ${member.user.username}`).setStyle(ButtonStyle.Success).setDisabled(true);
            const closeButton = new ButtonBuilder().setCustomId(`btn_close_${targetRoleId}`).setLabel('إغلاق التذكرة 🔒').setStyle(ButtonStyle.Danger);
            const pingUserBtn = new ButtonBuilder().setCustomId('btn_ping_user').setLabel('تنبيه العضو 🔔').setStyle(ButtonStyle.Secondary);
            const pingAdminBtn = new ButtonBuilder().setCustomId(`btn_ping_admin_${targetRoleId}`).setLabel('تنبيه الإدارة 🚨').setStyle(ButtonStyle.Secondary);
            const requestCloseBtn = new ButtonBuilder().setCustomId('btn_request_close').setLabel('طلب إغلاق 🛑').setStyle(ButtonStyle.Success);

            const row1 = new ActionRowBuilder().addComponents(disabledClaimButton, closeButton);
            const row2 = new ActionRowBuilder().addComponents(pingUserBtn, pingAdminBtn, requestCloseBtn);

            await interaction.editReply({ embeds: [updatedEmbed], components: [row1, row2] }).catch(() => {});
            
            const creatorMention = creatorId ? `<@${creatorId}>` : '';
            await interaction.followUp({ content: `${creatorMention} **تم استلام تكت عن طريق هذا الإدارة: ${member}، تابع معه.**` }).catch(() => {});
        }

        if (customId === 'btn_ping_user') {
            const topic = interaction.channel.topic || '';
            const creatorId = topic.split('creator_id:')[1]?.split(';')[0] || '';
            const targetMember = interaction.guild.members.cache.get(creatorId);
            
            if (targetMember) {
                await interaction.reply({ content: `🔔 تنبيه وتذكير للعضو ${targetMember} لمراجعة شات التذكرة والرد على المشرفين.` }).catch(() => {});
            } else {
                await interaction.reply({ content: '❌ لم يتم العثور على صاحب التذكرة في السيرفر حالياً.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }

        if (customId.startsWith('btn_ping_admin_')) {
            const targetRoleId = customId.replace('btn_ping_admin_', '');
            const roleMention = targetRoleId ? `<@&${targetRoleId}>` : '@everyone';
            await interaction.reply({ content: `🚨 تنبيه للرتبة المسؤولة عن القسم ${roleMention}، هناك تذكرة مفتوحة تحتاج مراجعة فورية.` }).catch(() => {});
        }

        if (customId === 'btn_request_close') {
            const topic = interaction.channel.topic || '';
            const creatorId = topic.split('creator_id:')[1]?.split(';')[0] || '';
            const targetMember = creatorId ? `<@${creatorId}>` : 'صاحب التذكرة';

            const requestEmbed = new EmbedBuilder()
                .setTitle('🛑 طلب إغلاق تذكرة معلق')
                .setDescription(`مرحباً ${targetMember}، يرى الإشراف المتابع معك أن المشكلة قد تم حلها بنجاح.\n\nيرجى مراجعة التذكرة وتأكيد الإغلاق أو كتابة استفسارك إذا كنت لا تزال بحاجة لمساعدة.`)
                .setColor('#e67e22');

            await interaction.reply({ embeds: [requestEmbed] }).catch(() => {});
        }

        if (customId.startsWith('btn_close_')) {
            const targetRoleId = customId.replace('btn_close_', '');
            const topic = interaction.channel.topic || '';
            
            const creatorId = topic.includes('creator_id:') ? topic.split('creator_id:')[1].split(';')[0] : null;
            const claimerId = topic.includes('claimed_by:') ? topic.split('claimed_by:')[1].split(';')[0] : null;
            const claimerName = topic.includes('claimer_name:') ? topic.split('claimer_name:')[1].split(';')[0] : 'مشرف الدعم';
            const claimTime = topic.includes('claim_time:') ? parseInt(topic.split('claim_time:')[1].split(';')[0]) : null;

            const isClaimer = topic.includes(`claimed_by:${member.id}`);
            const hasSupportRole = member.roles.cache.has(targetRoleId);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isClaimer && !hasSupportRole && !isAdmin) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط لمن استلمها أو الرتبة المخصصة للقسم.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            await interaction.reply({ content: '⚠️ جاري إرسال اللوج وطلب التقييم وحذف التذكرة خلال 5 ثوانٍ...' }).catch(() => {});

            await sendTicketLog(interaction.guild, interaction.channel.name, creatorId, claimerId, member, claimTime);

            const creatorUser = await interaction.guild.members.fetch(creatorId).catch(() => null);
            if (creatorUser) {
                const ratingEmbed = new EmbedBuilder()
                    .setTitle('⭐ تقييم مستوى الدعم الفني المخصص')
                    .setDescription(`لقد تم إغلاق تذكرتك بنجاح في سيرفر **${interaction.guild.name}**.\n\nيرجى الضغط على أحد الأزرار أدناه لتقييم أداء المشرف المتابع معك (**${claimerName}**):`)
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

        if (customId.startsWith('rate_')) {
            await interaction.deferUpdate().catch(() => {});
            const parts = customId.split('_');
            const rating = parseInt(parts[1]);
            const claimerName = parts[2];

            await sendRatingLog(interaction.guild, interaction.user, rating, claimerName);
            await interaction.followUp({ content: '✅ **شكراً جزيلاً لك على تقييمك المطور! تم إرسال التقييم لقسم السجلات بنجاح.**', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        if (customId === 'general_embed_button_action') {
            await interaction.reply({ content: 'سيتم فتح تذكرة عامة لك الآن...', flags: MessageFlags.Ephemeral }).catch(() => {});
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
            await interaction.reply({ content: '⚠️ سيتم حذف التذكرة نهائياً وإغلاق القناة خلال 5 ثوانٍ...' }).catch(() => {});
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