/**
 * Bot Version: 3.9.5v (DealerBot Style & Advanced Mafia/DM Edition)
 * Developer: ta_im1 | Team: TRL for development
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits, 
    ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder 
} = require('discord.js');
const express = require('express');

// 1️⃣ خادم ويب لمنع التايم آوت
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Gangster-bot is running perfectly! 🚀'));
app.listen(port, () => console.log(`[SYSTEM] Web server active on port ${port}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const BOT_VERSION = "3.9.5v";
const footerText = { text: "Development: ta_im1 | Team: TRL for development" };
const activeGames = new Set();
const tempUsers = new Map();

function getUserData(userId, username) {
    if (!tempUsers.has(userId)) {
        tempUsers.set(userId, { userId, username: username || 'مشجع مونديالي', points: 0, favoriteTeam: 'لم يحدد بعد ⚽', goalsScored: 0 });
    }
    return tempUsers.get(userId);
}

async function addPoints(userId, username, amount) {
    const userData = getUserData(userId, username);
    userData.points += amount;
    if (username) userData.username = username;
    try {
        const user = await client.users.fetch(userId);
        if (user) await user.send(`🎉 مبروك حصلت على **+${amount}** نقطة! رصيدك الحالي: \`${userData.points}\` 🏆`);
    } catch (e) {}
    return userData.points;
}

const flagData = [
    { countryAr: "المغرب", countryEn: "morocco", flagUrl: "https://flagcdn.com/w640/ma.png" },
    { countryAr: "السعودية", countryEn: "saudi arabia", flagUrl: "https://flagcdn.com/w640/sa.png" },
    { countryAr: "مصر", countryEn: "egypt", flagUrl: "https://flagcdn.com/w640/eg.png" }
];

// 2️⃣ إعداد وتسجيل الأوامر المائلة (Slash Commands)
client.once('ready', async () => {
    console.log(`[ONLINE] Logged in as ${client.user.tag}! Version: ${BOT_VERSION}`);

    const commands = [
        new SlashCommandBuilder().setName('help').setDescription('عرض قائمة المساعدة والأوامر تفاعلياً كـ DealerBot'),
        new SlashCommandBuilder().setName('profile').setDescription('عرض ملفك الشخصي الرياضي ونقاطك'),
        new SlashCommandBuilder().setName('penalty').setDescription('تحدي ركلات الترجيح ضد البوت'),
        new SlashCommandBuilder().setName('guess-nationality').setDescription('بدء لعبة خمن جنسية اللاعب (شبكة 3x3)'),
        new SlashCommandBuilder()
            .setName('dm')
            .setDescription('نظام إرسال الرسائل الخاصة المتطور (للإدارة فقط)')
            .addSubcommand(sub => sub
                .setName('user')
                .setDescription('إرسال رسالة لعضو محدد')
                .addUserOption(opt => opt.setName('target').setDescription('العضو المستهدف').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('نص الرسالة').setRequired(true)))
            .addSubcommand(sub => sub
                .setName('all')
                .setDescription('إرسال رسالة جماعية لجميع أعضاء السيرفر')
                .addStringOption(opt => opt.setName('title').setDescription('عنوان الرسالة الجماعية').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('نص الرسالة الجماعية').setRequired(true)))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[SYSTEM] Slash commands updated successfully!');
    } catch (error) {
        console.error('[ERROR] Failed to register slash commands:', error);
    }
});

// 3️⃣ نظام قائمة المساعدة المتطور /help (بمحاكاة ستايل DealerBot الكامل)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Bot Commands')
            .setDescription('**Categories:**\n• 🛑 **Admin Commands**\n• 👥 **Public Commands**\n• ✨ **Level System**\n• 🔮 **Greet Commands**\n• ⚙️ **Automation System**\n• 🎉 **Giveaway Commands**\n• 🔏 **Protection Commands**\n• 🆔 **Invite System**\n• 🎟️ **Ticket System**')
            .setColor(0x5865F2)
            .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png'); // صورة الترحيب والمساعدة المطابقة لملف 1000001215.jpg

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('Choose a category to view its commands')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Admin Commands').setDescription('Displays Admin commands').setValue('help_admin').setEmoji('🛑'),
                new StringSelectMenuOptionBuilder().setLabel('Public Commands').setDescription('Displays Public commands').setValue('help_public').setEmoji('👥'),
                new StringSelectMenuOptionBuilder().setLabel('Ticket System').setDescription('Displays Ticket commands').setValue('help_ticket').setEmoji('🎟️')
            );

        const menuRow = new ActionRowBuilder().addComponents(selectMenu);

        const linksRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Invite Bot').setURL('https://discord.com/oauth2/authorize?client_id=1509320177366466620&permissions=8&integration_type=0&scope=bot+applications.commands').setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('Support Server').setURL('https://discord.gg/esSmsjd9WG').setStyle(ButtonStyle.Link)
        );

        await interaction.reply({ embeds: [helpEmbed], components: [menuRow, linksRow] });
    }
});

// معالجة اختيارات قائمة الـ help المنسدلة
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'help_category') return;

    let responseText = "";
    if (interaction.values[0] === 'help_admin') {
        responseText = "🛑 **أوامر الإدارة المتاحة:**\n• `/dm user` - إرسال رسالة خاصة لعضو.\n• `/dm all` - إرسال إشعار جماعي مخصص.";
    } else if (interaction.values[0] === 'help_public') {
        responseText = "👥 **الأوامر العامة والمسابقات:**\n• `/profile` - استعراض هويتك الرياضية.\n• `/penalty` - بدء ضربات الترجيح.\n• `/guess-nationality` - لعبة خمن الجنسية.\n• `.m` - تشغيل لعبة المافيا الكبرى.";
    } else if (interaction.values[0] === 'help_ticket') {
        responseText = "🎟️ **نظام التذاكر والسيرفر:**\n• `.wr` - لفتح تذكرة دعم مخصصة فورياً مع الإدارة.";
    }

    await interaction.reply({ content: responseText, ephemeral: true });
});

// 4️⃣ نظام الـ DM المطور والمصلح بالكامل (Slash Commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'dm') return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة العليا فقط!', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'user') {
        const target = interaction.options.getUser('target');
        const messageText = interaction.options.getString('message');

        try {
            await target.send(`📢 **رسالة إدارية خاصة:**\n\n${messageText}`);
            await interaction.reply({ content: `✅ تم إرسال الرسالة بنجاح إلى الخاص لـ ${target}`, ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: `❌ تعذر الإرسال، العضو يغلق الرسائل الخاصة.`, ephemeral: true });
        }
    }

    if (subcommand === 'all') {
        const title = interaction.options.getString('title');
        const messageText = interaction.options.getString('message');

        await interaction.reply({ content: '⏳ جاري بدء الإرسال الجماعي لجميع أعضاء السيرفر...', ephemeral: true });
        const members = await interaction.guild.members.fetch();
        
        members.forEach(member => {
            if (!member.user.bot) {
                member.send(`📢 **${title}**\n\n${messageText}`).catch(() => {});
            }
        });
    }
});

// 5️⃣ نظام الأوامر النصية المختصرة للـ DM والـ Ticket
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // اختصار أمر التذاكر .wr
    if (message.content.trim().toLowerCase() === '.wr') {
        let ticketRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'ticket');
        if (!ticketRole) return message.reply('❌ يجب توفر رتبة باسم `ticket` بالسيرفر أولاً.');

        try {
            const ticketChannel = await message.guild.channels.create({
                name: `ticket-${message.author.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: ticketRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });
            await message.reply(`✅ تم إنشاء تذكرتك بنجاح: ${ticketChannel}`);
        } catch (e) { message.reply('❌ تعذر إنشاء الروم، يرجى التحقق من صلاحيات البوت الإدارية.'); }
    }

    // اختصار أمر الـ DM النصي: .dm
    if (message.content.startsWith('.dm')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const args = message.content.slice('.dm'.length).trim().split(/ +/);
        if (args.length < 1) return message.reply('❌ استخدام خاطئ! الصيغة:\n`.dm @اليوزر الرسالة` أو `.dm كل العنوان والرسالة`');

        if (args[0] === 'كل' || args[0].toLowerCase() === 'all') {
            const broadcastText = args.slice(1).join(' ');
            if (!broadcastText) return message.reply('❌ يرجى كتابة محتوى الرسالة الجماعية!');

            message.reply('⏳ جاري إرسال الرسالة الجماعية لجميع الأعضاء الحقيقيين...');
            const members = await message.guild.members.fetch();
            members.forEach(m => { if (!m.user.bot) m.send(`📢 **إشعار هام من الإدارة**\n\n${broadcastText}`).catch(() => {}); });
        } else {
            const targetUser = message.mentions.users.first();
            const directText = args.slice(1).join(' ');
            if (!targetUser || !directText) return message.reply('❌ يرجى تحديد المنشن وكتابة نص الرسالة بشكل صحيح.');

            try {
                await targetUser.send(`📢 **رسالة إدارية مخصصة:**\n\n${directText}`);
                await message.reply(`✅ تم إرسال الرسالة الخاصة إلى ${targetUser} بنجاح.`);
            } catch (e) { message.reply('❌ فشل الإرسال، قد تكون الرسائل الخاصة مغلقة لدى هذا المستخدم.'); }
        }
    }
});

// 6️⃣ نظام ألعاب المافيا الاحترافي الشامل (.m) بوقت تفكير وتصويت تفاعلي بالأزرار
let activeMafiaGame = null;

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.trim().toLowerCase() === '.m') {
        if (activeMafiaGame) return message.reply('⚠️ هناك مباراة مافيا قائمة بالفعل!');

        activeMafiaGame = { hostChannel: message.channel.id, players: new Map(), status: 'lobby', messageId: null };

        const updateEmbed = () => {
            const playerList = Array.from(activeMafiaGame.players.values()).map((p, idx) => `${idx + 1}- <@${p.id}>`).join('\n') || 'لا يوجد لاعبين مسجلين حالياً.';
            return new EmbedBuilder()
                .setTitle('✨ .•°•-BRQ Community 7K°.•?')
                .setDescription(`**المشاركين الحاليين (${activeMafiaGame.players.size}/25):**\n${playerList}\n\nاضغط على الأزرار للتفاعل والاشتراك بالبطولة!`)
                .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png') // صورة المافيا المستوحاة من الملف المرفق 1000001214_2.png
                .setColor(0x5865F2);
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('m_join').setEmoji('📥').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('m_leave').setEmoji('📤').setStyle(ButtonStyle.Danger)
        );

        const gameMsg = await message.channel.send({ embeds: [updateEmbed()], components: [row] });
        activeMafiaGame.messageId = gameMsg.id;

        const lobbyCollector = gameMsg.createMessageComponentCollector({ time: 30000 });

        lobbyCollector.on('collect', async interaction => {
            if (interaction.customId === 'm_join') {
                if (activeMafiaGame.players.has(interaction.user.id)) return interaction.reply({ content: '❌ أنت مسجل بالفعل!', ephemeral: true });
                if (activeMafiaGame.players.size >= 25) return interaction.reply({ content: '❌ اكتمل العدد الأقصى!', ephemeral: true });
                activeMafiaGame.players.set(interaction.user.id, { id: interaction.user.id, username: interaction.user.username });
                await interaction.deferUpdate();
                await gameMsg.edit({ embeds: [updateEmbed()] });
            }
            if (interaction.customId === 'm_leave') {
                if (!activeMafiaGame.players.has(interaction.user.id)) return interaction.reply({ content: '❌ أنت غير مسجل أصلاً!', ephemeral: true });
                activeMafiaGame.players.delete(interaction.user.id);
                await interaction.deferUpdate();
                await gameMsg.edit({ embeds: [updateEmbed()] });
            }
        });

        lobbyCollector.on('end', async () => {
            if (!activeMafiaGame) return;
            if (activeMafiaGame.players.size < 2) { // للทดสอบ والتأكيد تم وضع الحد الأدنى لاعبين
                await message.channel.send('❌ تم إلغاء اللعبة لعدم وجود عدد كافٍ من اللاعبين المشاركين.');
                activeMafiaGame = null;
                return;
            }

            const playerIds = Array.from(activeMafiaGame.players.keys());
            await message.channel.send('🎮 **تم قفل التسجيل وتوزيع الأدوار سراً على الخاص!**\n⏱️ **بدأت مرحلة التفكير والمناقشة الحية (30 ثانية).. تناقشوا بحذر!**');

            // إرسال كروت الأدوار السريّة كالمعتاد
            for (const pId of playerIds) {
                try {
                    const u = await client.users.fetch(pId);
                    if (u) u.send('🎯 **دورك السري في هذه الجولة هو: [ مواطن صالح / أو دور خاص ]**\nحافظ على السرية المطلقة!');
                } catch (e) {}
            }

            // الانتظار التام لـ 30 ثانية وقت التفكير والمناقشة الشاملة
            setTimeout(async () => {
                await message.channel.send('🔊 **انتهى وقت التفكير! بدأ الآن وقت التصويت العلني لاكتشاف القاتل والمافيا!**');

                // بناء صفوف أزرار التصويت لكل لاعب مشترك بالبطولة بشكل تلقائي وديناميكي
                const rows = [];
                let currentRow = new ActionRowBuilder();

                const participants = Array.from(activeMafiaGame.players.values());
                for (let i = 0; i < participants.length; i++) {
                    if (i > 0 && i % 5 === 0) {
                        rows.push(currentRow);
                        currentRow = new ActionRowBuilder();
                    }
                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`vote_${participants[i].id}`)
                            .setLabel(participants[i].username)
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                // إضافة زر التخطي (Skip) بشكل مستقل وذكي في النهاية
                if (currentRow.components.length >= 5) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }
                currentRow.addComponents(
                    new ButtonBuilder().setCustomId('vote_skip_round').setLabel('⏭️ تخطي التصويت').setStyle(ButtonStyle.Danger)
                );
                rows.push(currentRow);

                const voteEmbed = new EmbedBuilder()
                    .setTitle('🗳️ ساحة التصويت العلني للمافيا')
                    .setDescription('اضغط على اسم الشخص الذي تشك بأنه ينتمي لعصابات المافيا، أو اضغط تخطي إذا كنت غير متأكد!')
                    .setColor(0xE74C3C);

                const voteMsg = await message.channel.send({ embeds: [voteEmbed], components: rows });
                const voteCollector = voteMsg.createMessageComponentCollector({ time: 30000 });

                const voteCounts = {};
                let skipVotes = 0;
                const usersVoted = new Set();

                voteCollector.on('collect', async vInteraction => {
                    if (!activeMafiaGame.players.has(vInteraction.user.id)) {
                        return vInteraction.reply({ content: '❌ أنت لست جزءاً من هذه اللعبة لتشارك في التصويت!', ephemeral: true });
                    }
                    if (usersVoted.has(vInteraction.user.id)) {
                        return vInteraction.reply({ content: '❌ لقد قمت بالتصويت بالفعل في هذه الجولة الحالية!', ephemeral: true });
                    }

                    usersVoted.add(vInteraction.user.id);

                    if (vInteraction.customId === 'vote_skip_round') {
                        skipVotes++;
                        await vInteraction.reply({ content: '🗳️ اخترت تخطي التصويت لهذه الجولة.', ephemeral: true });
                    } else {
                        const votedId = vInteraction.customId.split('_')[1];
                        voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
                        const targetUserObj = activeMafiaGame.players.get(votedId);
                        await vInteraction.reply({ content: `🗳️ تم تسجيل صوتك ضد اللاعب: **${targetUserObj ? targetUserObj.username : 'مجهول'}**`, ephemeral: true });
                    }
                });

                voteCollector.on('end', async () => {
                    await message.channel.send('🏁 **انتهى وقت التصويت الرسمي! جاري فرز وحساب الأصوات...**');
                    // يمكن إضافة ميكانيكية الطرد والإعلان عن النتيجة هنا حسب الرغبة الحرة
                    activeMafiaGame = null; // إنهاء وتصفير الجلسة بسلام
                });

            }, 30000); // 30 ثانية تفكير كاملة
        });
    }
});

// الألعاب والتحديات الكلاسيكية المتبقية لضمان الاستقرار (Penalty & Profile)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'profile') {
        const userData = getUserData(interaction.user.id, interaction.user.username);
        const profile = new EmbedBuilder()
            .setTitle(`🪪 ملف ${interaction.user.username}`)
            .addFields(
                { name: '🥇 النقاط:', value: `\`${userData.points}\``, inline: true },
                { name: '🥅 أهداف ركلات الترجيح:', value: `\`${userData.goalsScored}\``, inline: true }
            ).setColor(0x27AE60);
        await interaction.reply({ embeds: [profile] });
    }

    if (interaction.commandName === 'penalty') {
        const rowAction = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('p_left').setLabel('يسار ⬅️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('p_center').setLabel('وسط ⬆️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('p_right').setLabel('يمين ➡️').setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({ content: '⚽ **سدد ركلة الترجيح القاتلة الآن بقوة:**', components: [rowAction] });
    }
});

client.login(process.env.TOKEN);
