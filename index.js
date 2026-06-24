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

// تشغيل السيرفر لمنصة Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Ticket bot is running!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server connected to port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// البريفكس المختصر الذي طلبته
const PREFIX = '-st'; 

// لتخزين الإعدادات المؤقتة التي تختارها أنت بنفسك أثناء الإعداد التفاعلي
const tempSetup = new Map();

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
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error(error);
    }
});

// دالة لبدء عملية التخصيص التفاعلية معك خطوة بخطوة
async function startInteractiveSetup(messageOrInteraction, channel, user) {
    // التأكد من أن المستخدم لديه صلاحيات الإدارة
    const member = channel.guild.members.cache.get(user.id);
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        const replyContent = '❌ عذراً، هذا الأمر مخصص للإداريين فقط.';
        if (messageOrInteraction.reply) {
            return messageOrInteraction.reply({ content: replyContent, ephemeral: true });
        } else {
            return channel.send(replyContent);
        }
    }

    const setupState = {
        step: 1,
        roleId: null,
        boxTitle: null,
        imageUrl: null,
        categoryId: null
    };

    tempSetup.set(user.id, setupState);

    const welcomeMsg = `⚙️ **بدء إعداد بوكس التذاكر التفاعلي**\n\n**الخطوة [1/4]:** يرجى كتابة (أيدي الرتبة - Role ID) التي تريدها أن تستلم وتتحكم في التذاكر المفتوحة.`;
    
    if (messageOrInteraction.reply) {
        await messageOrInteraction.reply({ content: welcomeMsg, ephemeral: true });
    } else {
        await channel.send(`${user}, ${welcomeMsg}`);
    }
}

// قراءة الإجابات أثناء الإعداد خطوة بخطوة
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // 1. تشغيل عبر الاختصار -st
    if (message.content.trim() === PREFIX) {
        return startInteractiveSetup(message, message.channel, message.author);
    }

    // 2. تتبع خطوات الإعداد المخصص
    if (tempSetup.has(message.author.id)) {
        const state = tempSetup.get(message.author.id);

        if (state.step === 1) {
            // إدخال أيدي الرتبة
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
            // تسمية المربع/الخيار
            state.boxTitle = message.content.trim();
            state.step = 3;
            return message.reply(`✅ تم حفظ الاسم: **${state.boxTitle}**\n\n**الخطوة [3/4]:** ضع رابط الصورة (Image URL) للبوكس الرئيسي (إذا كنت لا تريد صورة اكتب: \`لا\`):`);
        }

        if (state.step === 3) {
            // تحديد الصورة
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
            // تحديد القسم النهائي وإنشاء البوكس فوراً
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا') {
                state.categoryId = input;
            } else {
                state.categoryId = null;
            }

            // إرسال البوكس النهائي المخصص بالكامل بناءً على اختياراتك
            const embed = new EmbedBuilder()
                .setTitle('الدعم الفني | Support Setup')
                .setDescription(`يرجى اختيار القسم المخصص أدناه لفتح تذكرة مباشرة مع رتبة الدعم المخصصة.`)
                .setColor('#2b2d31');

            if (state.imageUrl) {
                embed.setImage(state.imageUrl);
            }

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
            await message.reply('🎉 **تم إنشاء وتخصيص البوكس بنجاح بناءً على الخيارات التي أدخلتها بنفسك!**');

            // إنهاء وإزالة الجلسة التفاعلية للمستخدم
            tempSetup.delete(message.author.id);
        }
    }
});

// التعامل مع أوامر السلاش والتفاعلات
client.on('interactionCreate', async interaction => {
    // تشغيل الإعداد التفاعلي عبر السلاش /setup
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup') {
            await startInteractiveSetup(interaction, interaction.channel, interaction.user);
        }
    }

    // فتح تذكرة بناءً على الخيارات المخصصة ديناميكياً والمخزنة في معرف القائمة (Custom ID)
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('custom_ticket_menu_')) {
            await interaction.deferReply({ ephemeral: true });

            // استخراج الرتبة والقسم ديناميكياً من معرف القائمة نفسه
            const parts = interaction.customId.split('_');
            const targetRoleId = parts[3];
            const targetCategoryId = parts[4] === 'none' ? null : parts[4];

            const guild = interaction.guild;
            const member = interaction.member;

            const permissionOverwrites = [
                {
                    id: guild.id, // إخفاء عن الجميع
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: member.id, // العضو الذي فتح التذكرة
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                }
            ];

            // السماح للرتبة التي قمت أنت بتحديدها برؤية التذكرة والكتابة
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

    // التعامل مع الأزرار الديناميكية (الاستلام والإغلاق للرتبة المحددة)
    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith('claim_custom_ticket_')) {
            const targetRoleId = customId.replace('claim_custom_ticket_', '');
            const member = interaction.member;

            // التحقق من الرتبة المحددة التي اخترتها للبوكس
            const hasRequiredRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المخصصة للتحكم فيها!', ephemeral: true });
            }

            await interaction.channel.setTopic(`claimed_by:${member.id}`);

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
            await interaction.followUp({ content: `🔔 تم استلام التذكرة بنجاح بواسطة ${member}.` });
        }

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
    }
});

client.login(TOKEN);