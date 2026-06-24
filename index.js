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
    Routes
} = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Ticket & Embed Bot Active!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server connected to port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TICKET_PREFIX = '-st'; // لإنشاء بوكس تكت مخصص
const EMBED_PREFIX = '-em';  // لإنشاء إمبد مخصص مع أزرار

const tempSetup = new Map();
const embedSetup = new Map();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const commands = [
        { name: 'setup', description: 'بدء الإعداد التفاعلي لتخصيص بوكس التذاكر الخاص بك' },
        { name: 'embed', description: 'بدء إعداد إمبد مخصص مع أزرار' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error(error);
    }
});

// دالة بدء الإعداد التفاعلي لبوكس التكت المخصص
async function startInteractiveSetup(messageOrInteraction, channel, user) {
    const member = channel.guild.members.cache.get(user.id);
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        const replyContent = '❌ عذراً، هذا الأمر مخصص للإداريين فقط.';
        if (messageOrInteraction.reply) {
            return messageOrInteraction.reply({ content: replyContent, ephemeral: true });
        } else {
            return channel.send(replyContent);
        }
    }

    const setupState = { step: 1, roleId: null, boxTitle: null, imageUrl: null, categoryId: null };
    tempSetup.set(user.id, setupState);

    const welcomeMsg = `⚙️ **بدء إعداد بوكس تذاكر تفاعلي جديد**\n\n**الخطوة [1/4]:** يرجى كتابة (أيدي الرتبة - Role ID) التي تريدها أن تستلم وتتحكم في تذاكر هذا البوكس.`;
    if (messageOrInteraction.reply) {
        await messageOrInteraction.reply({ content: welcomeMsg, ephemeral: true });
    } else {
        await channel.send(`${user}, ${welcomeMsg}`);
    }
}

// دالة بدء الإعداد التفاعلي للإمبد المخصص مع الأزرار
async function startEmbedSetup(messageOrInteraction, channel, user) {
    const member = channel.guild.members.cache.get(user.id);
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        const replyContent = '❌ عذراً، هذا الأمر مخصص للإداريين فقط.';
        if (messageOrInteraction.reply) {
            return messageOrInteraction.reply({ content: replyContent, ephemeral: true });
        } else {
            return channel.send(replyContent);
        }
    }

    const embedState = { step: 1, title: null, description: null, buttonLabel: null, buttonStyle: 'Primary' };
    embedSetup.set(user.id, embedState);

    const welcomeMsg = `📝 **بدء إعداد إمبد مخصص**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان (Title)** الإمبد:`;
    if (messageOrInteraction.reply) {
        await messageOrInteraction.reply({ content: welcomeMsg, ephemeral: true });
    } else {
        await channel.send(`${user}, ${welcomeMsg}`);
    }
}

// قراءة الإجابات والتحكم في الرسائل
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // تشغيل الإعداد التفاعلي للبوكس المخصص عبر -st
    if (message.content.trim() === TICKET_PREFIX) {
        return startInteractiveSetup(message, message.channel, message.author);
    }

    // تشغيل الإعداد التفاعلي للإمبد عبر -em
    if (message.content.trim() === EMBED_PREFIX) {
        return startEmbedSetup(message, message.channel, message.author);
    }

    // أمر استدعاء العضو داخل التكت المفتوح
    if (message.content.trim().toLowerCase() === '!ping') {
        const topic = message.channel.topic || '';
        if (topic.includes('creator_id:')) {
            // استخراج الأيدي بدقة من التوبك
            const creatorPart = topic.split('creator_id:')[1];
            const creatorId = creatorPart ? creatorPart.split(';')[0] : null;
            const member = message.guild.members.cache.get(creatorId);
            if (member) {
                return message.channel.send(`🔔 تنبيه للعضو: ${member}، يرجى مراجعة التذكرة لمتابعة الرد مع الإدارة.`);
            }
        }
    }

    // 1. تتبع خطوات إعداد بوكس التكت المخصص
    if (tempSetup.has(message.author.id)) {
        const state = tempSetup.get(message.author.id);

        if (state.step === 1) {
            const roleId = message.content.trim();
            const role = message.guild.roles.cache.get(roleId);
            if (!role) {
                return message.reply('❌ الأيدي غير صحيح أو لم يتم العثور على الرتبة. يرجى كتابة أيدي رتبة صحيح:');
            }
            state.roleId = roleId;
            state.step = 2;
            return message.reply(`✅ تم تحديد الرتبة: **${role.name}**\n\n**الخطوة [2/4]:** اكتب الآن الاسم الذي تريده أن يظهر داخل البوكس (مثال: الدعم الفني، المبيعات... إلخ):`);
        }

        if (state.step === 2) {
            state.boxTitle = message.content.trim();
            state.step = 3;
            return message.reply(`✅ تم حفظ الاسم: **${state.boxTitle}**\n\n**الخطوة [3/4]:** ضع رابط الصورة (Image URL) للبوكس الرئيسي (إذا كنت لا تريد صورة اكتب: \`لا\`):`);
        }

        if (state.step === 3) {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا' && input.startsWith('http')) {
                state.imageUrl = input;
            } else {
                state.imageUrl = null;
            }
            state.step = 4;
            return message.reply(`✅ تم حفظ إعدادات الصورة.\n\n**الخطوة [4/4] الأخيرة:** يرجى كتابة أيدي القسم (Category ID) الذي تفتح فيه التذاكر (إذا كنت تريدها تفتح في أي مكان اكتب: \`لا\`):`);
        }

        if (state.step === 4) {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا') {
                state.categoryId = input;
            } else {
                state.categoryId = null;
            }

            const embed = new EmbedBuilder()
                .setTitle('الدعم الفني | Support Setup')
                .setDescription(`يرجى اختيار القسم المخصص أدناه لفتح تذكرة مباشرة مع رتبة الدعم المخصصة.`)
                .setColor('#2b2d31');

            if (state.imageUrl) {
                embed.setImage(state.imageUrl);
            }

            // قمنا بتمرير الرتبة والقسم في customId ليكون كل بوكس مستقلاً بذاته
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`custom_ticket_menu_${state.roleId}_${state.categoryId || 'none'}`)
                .setPlaceholder('الرجاء اختيار قسم لفتح التذكرة...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setValue('open_custom_ticket')
                        .setLabel(state.boxTitle)
                        .setDescription(`اضغط لفتح تذكرة وسيستلمها أصحاب الرتبة المحددة`)
                        .setEmoji('🎫')
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.channel.send({ embeds: [embed], components: [row] });
            await message.reply('🎉 **تم إنشاء وتخصيص البوكس بنجاح! يمكنك تكرار الأمر لعمل بوكس آخر برتبة مختلفة.**');

            tempSetup.delete(message.author.id);
        }
    }

    // 2. تتبع خطوات إعداد إمبد -em المخصص
    if (embedSetup.has(message.author.id)) {
        const state = embedSetup.get(message.author.id);

        if (state.step === 1) {
            state.title = message.content.trim();
            state.step = 2;
            return message.reply(`✅ تم حفظ العنوان.\n\n**الخطوة [2/3]:** يرجى كتابة **وصف (Description)** الإمبد:`);
        }

        if (state.step === 2) {
            state.description = message.content.trim();
            state.step = 3;
            return message.reply(`✅ تم حفظ الوصف.\n\n**الخطوة [3/3] الأخيرة:** يرجى كتابة **النص المكتوب على الزر** (مثال: فتح تذكرة، اضغط هنا...):`);
        }

        if (state.step === 3) {
            state.buttonLabel = message.content.trim();

            const customEmbed = new EmbedBuilder()
                .setTitle(state.title)
                .setDescription(state.description)
                .setColor('#5865F2');

            // زر مخصص يفتح تذكرة عامة أو مخصصة حسب رغبتك
            const customButton = new ButtonBuilder()
                .setCustomId('general_embed_button_action')
                .setLabel(state.buttonLabel)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫');

            const row = new ActionRowBuilder().addComponents(customButton);

            await message.channel.send({ embeds: [customEmbed], components: [row] });
            await message.reply('🎉 **تم إنشاء الإمبد المخصص مع الأزرار بنجاح!**');

            embedSetup.delete(message.author.id);
        }
    }
});

// التعامل مع التفاعلات والسلاش والأزرار
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup') {
            await startInteractiveSetup(interaction, interaction.channel, interaction.user);
        }
        if (interaction.commandName === 'embed') {
            await startEmbedSetup(interaction, interaction.channel, interaction.user);
        }
    }

    // فتح التذاكر من القوائم المنسدلة المخصصة
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('custom_ticket_menu_')) {
            await interaction.deferReply({ ephemeral: true });

            const parts = interaction.customId.split('_');
            const targetRoleId = parts[3];
            const targetCategoryId = parts[4] === 'none' ? null : parts[4];

            const guild = interaction.guild;
            const member = interaction.member;

            const permissionOverwrites = [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ];

            if (targetRoleId) {
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

                // تخزين صاحب التذكرة في موضوع القناة (Topic) لنتمكن من استدعائه لاحقاً بـ !ping
                await channel.setTopic(`creator_id:${member.id}`);

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('تذكرة دعم فني جديدة')
                    .setDescription(`مرحباً بك ${member}، لقد قمت بفتح تذكرة فنية مخصصة.\n\nيرجى الانتظار حتى يقوم أحد أفراد الرتبة المحددة باستلام تذكرتك ومساعدتك.`)
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

                await interaction.editReply({ content: `تم فتح التذكرة المخصصة بنجاح: ${channel}` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'حدث خطأ أثناء إنشاء التذكرة الفنية المخصصة.' });
            }
        }
    }

    // التعامل مع الأزرار وتحديث نظام الاستلام والتنبيهات
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // استلام تذكرة مخصصة
        if (customId.startsWith('claim_custom_ticket_')) {
            const targetRoleId = customId.replace('claim_custom_ticket_', '');
            const member = interaction.member;

            const hasRequiredRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المخصصة للتحكم فيها!', ephemeral: true });
            }

            // تحديث التوبك وحفظ اسم المستلم
            const topic = interaction.channel.topic || '';
            const creatorId = topic.split(':')[1]?.split(';')[0] || '';
            await interaction.channel.setTopic(`creator_id:${creatorId};claimed_by:${member.id}`);

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

            await interaction.update({ embeds: [updatedEmbed], components: [row] });
            
            // التنبيه المخصص الذي طلبته تماماً عند استلام التكت
            const creatorMention = creatorId ? `<@${creatorId}>` : '';
            await interaction.followUp({ content: `${creatorMention} **تم استلام تكت عن طريق هذا الإدارة: ${member}، تابع معه.**` });
        }

        // إغلاق تذكرة مخصصة
        if (customId.startsWith('close_custom_ticket_')) {
            const targetRoleId = customId.replace('close_custom_ticket_', '');
            const member = interaction.member;
            const topic = interaction.channel.topic || '';
            const isClaimer = topic.includes(`claimed_by:${member.id}`);
            const hasSupportRole = member.roles.cache.has(targetRoleId);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isClaimer && !hasSupportRole && !isAdmin) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط لمن استلمها أو الرتبة المخصصة.', ephemeral: true });
            }

            await interaction.reply({ content: '⚠️ سيتم حذف التذكرة نهائياً وإغلاق القناة خلال 5 ثوانٍ...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error('Error deleting channel:', err);
                }
            }, 5000);
        }

        // التعامل مع زر الإمبد العام المخصص
        if (customId === 'general_embed_button_action') {
            await interaction.reply({ content: 'سيتم فتح تذكرة عامة لك الآن...', ephemeral: true });
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
