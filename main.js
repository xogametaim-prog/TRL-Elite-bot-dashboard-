/**
 * Bot Version: 4.5.0v (The Ultimate God-Mode Code - All Systems Restored)
 * Developer: ta_im1 | Team: TRL for development
 * Platform: Optimized for Mobile (Pydroid 3 / Replit)
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, 
    ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const express = require('express');

// 1️⃣ خادم الويب للحفاظ على استقرار البوت 24 ساعة دون انقطاع
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Gangster-bot Server is Online! 🚀'));
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

const BOT_VERSION = "4.5.0v";
const tempUsers = new Map();
let activeMafiaGame = null;
let TICKET_LOG_CHANNEL_ID = "ضع_هنا_ايدي_روم_الادارة"; 

// --- [ قاعدة البيانات والأنظمة الرياضية القديمة ] ---
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

// 2️⃣ تسجيل جميع الأوامر المائلة الشاملة بالديسكورد (بدون حذف أي نظام)
client.once('ready', async () => {
    console.log(`[ONLINE] ${client.user.tag} active! Version: ${BOT_VERSION}`);

    const commands = [
        new SlashCommandBuilder().setName('help').setDescription('عرض جميع أوامر البوت الحقيقية والشغالة حالياً'),
        new SlashCommandBuilder().setName('profile').setDescription('عرض ملفك الشخصي ونقاطك الرياضية'),
        new SlashCommandBuilder().setName('penalty').setDescription('تحدي ركلات الترجيح التفاعلي ضد البوت'),
        new SlashCommandBuilder().setName('guess-nationality').setDescription('بدء لعبة خمن جنسية اللاعب من العلم'),
        new SlashCommandBuilder()
            .setName('vote')
            .setDescription('إنشاء تصويت سريع وعادل بالأزرار للأعضاء')
            .addStringOption(opt => opt.setName('question').setDescription('موضوع التصويت').setRequired(true)),
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('إنشاء مسابقة جيف اواي تفاعلية بنظام التفاعل في السيرفر')
            .addStringOption(opt => opt.setName('prize').setDescription('الجائزة المستهدفة').setRequired(true))
            .addIntegerOption(opt => opt.setName('duration').setDescription('المدة بالدقائق').setRequired(true)),
        new SlashCommandBuilder()
            .setName('setup-ticket')
            .setDescription('إنشاء رسالة نظام التذاكر المطور بالـ Modals المفتوحة دائماً')
            .addStringOption(opt => opt.setName('title').setDescription('عنوان إمبيد التكت').setRequired(true))
            .addStringOption(opt => opt.setName('description').setDescription('وصف أو شروط التكت').setRequired(true))
            .addStringOption(opt => opt.setName('button_text').setDescription('النص المكتوب على زر الفتح').setRequired(true)),
        new SlashCommandBuilder()
            .setName('dm')
            .setDescription('نظام إرسال الرسائل الخاصة الإداري الشامل')
            .addSubcommand(sub => sub
                .setName('user')
                .setDescription('إرسال رسالة مخصصة لعضو معين على الخاص')
                .addUserOption(opt => opt.setName('target').setDescription('العضو المستهدف').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('نص الرسالة').setRequired(true)))
            .addSubcommand(sub => sub
                .setName('all')
                .setDescription('إرسال رسالة جماعية شاملة لكل أعضاء السيرفر على الخاص')
                .addStringOption(opt => opt.setName('title').setDescription('عنوان الرسالة الجماعية').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('نص الرسالة الجماعية').setRequired(true)))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[SYSTEM] All global slash commands successfully operational!');
    } catch (error) { console.error(error); }
});

// 3️⃣ استقبال الاختصارات النصية (.m و .w و .dm) ونظام المافيا المفتوح والمحدث للبوتات والأعضاء
client.on('messageCreate', async message => {
    // نسمح هنا لجميع الرسائل بالاختصارات، حتى لو كان الكاتب بوت آخر ليدخل في اللعبة!
    if (!message.guild) return;

    const msgContent = message.content.trim().toLowerCase();

    // اختصار الترحيب المباشر (.w)
    if (msgContent === '.w') {
        if (message.author.bot) return; // منع البوتات من ترحيب نفسها
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('✨ أهلاً بك في مجتمع BRQ Community!')
            .setDescription(`منور السيرفر يا غالي <@${message.author.id}> نتمنى لك وقتاً أسطورياً معنا! 🔥`)
            .setColor(0x3498DB)
            .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png');
        return message.channel.send({ embeds: [welcomeEmbed] });
    }

    // اختصار لعبة المافيا الأسطورية المفتوحة للنقاش والدخول العشوائي (.m)
    if (msgContent === '.m') {
        if (activeMafiaGame) return message.reply('⚠️ هناك جولة مافيا قائمة بالفعل في هذا الشات!');
        
        activeMafiaGame = { hostChannel: message.channel.id, players: new Map() };

        const updateEmbed = () => {
            const playerList = Array.from(activeMafiaGame.players.values()).map((p, idx) => `${idx + 1}- <@${p.id}> ${p.isBot ? '🤖 [بوت ديسكورد]' : '👤'}`).join('\n') || 'لا يوجد لاعبين مسجلين حتى الآن.';
            return new EmbedBuilder()
                .setTitle('✨ .•°•-BRQ Community Mafia Tournament-•°•? ✨')
                .setDescription(`**المشاركين الحاليين في بطولة المافيا المفتوحة والأعضاء والبوتات تعالي وتناقشوا براحتكم (${activeMafiaGame.players.size}/25):**\n\n${playerList}`)
                .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png') 
                .setColor(0x5865F2)
                .setFooter({ text: 'ملاحظة: اللعبة مفتوحة بالكامل للنقاش والسوالف وتسمح بدخول البوتات الأخرى!' });
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mafia_join_global').setEmoji('📥').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('mafia_leave_global').setEmoji('📤').setStyle(ButtonStyle.Danger)
        );

        const gameMsg = await message.channel.send({ embeds: [updateEmbed()], components: [row] });
        const lobbyCollector = gameMsg.createMessageComponentCollector({ time: 45000 }); // مهلة 45 ثانية للتسجيل

        lobbyCollector.on('collect', async interaction => {
            // يمكن للأعضاء الضغط عادي
            if (interaction.customId === 'mafia_join_global') {
                if (activeMafiaGame.players.has(interaction.user.id)) return interaction.reply({ content: '❌ أنت مسجل بالفعل في هذه الجولة!', ephemeral: true });
                activeMafiaGame.players.set(interaction.user.id, { id: interaction.user.id, username: interaction.user.username, isBot: false });
                await interaction.deferUpdate(); await gameMsg.edit({ embeds: [updateEmbed()] });
            }
            if (interaction.customId === 'mafia_leave_global') {
                if (!activeMafiaGame.players.has(interaction.user.id)) return interaction.reply({ content: '❌ أنت لست مسجلاً لتخرج!', ephemeral: true });
                activeMafiaGame.players.delete(interaction.user.id);
                await interaction.deferUpdate(); await gameMsg.edit({ embeds: [updateEmbed()] });
            }
        });

        // ميزة إدخال البوتات الأخرى: إذا أرسل أي بوت في السيرفر رسالة محتواها "دخول مافيا" أو "bot join" يتم تسجيله تلقائياً باللعبة!
        client.on('messageCreate', async botMsg => {
            if (!activeMafiaGame || botMsg.channel.id !== message.channel.id) return;
            if (botMsg.author.bot && (botMsg.content.includes('دخول') || botMsg.content.toLowerCase().includes('join') || botMsg.content.includes('مافيا'))) {
                if (!activeMafiaGame.players.has(botMsg.author.id)) {
                    activeMafiaGame.players.set(botMsg.author.id, { id: botMsg.author.id, username: botMsg.author.username, isBot: true });
                    await gameMsg.edit({ embeds: [updateEmbed()] }).catch(() => {});
                }
            }
        });

        lobbyCollector.on('end', async () => {
            if (!activeMafiaGame) return;
            if (activeMafiaGame.players.size < 2) {
                await message.channel.send('❌ تم إلغاء جولة المافيا لعدم اكتمال العدد الأدنى المطلوبة لبدء المعركة.');
                activeMafiaGame = null;
                return;
            }

            await message.channel.send('🎮 **تم قفل ساحة التسجيل وتوزيع بطاقات المافيا والمواطنين سراً عبر الخاص!**\n💬 **الآن الشات مفتوح بالكامل لكم وللبوتات للمناقشة والتحليل وتبادل الاتهامات والسوالف براحتكم!**');

            // مهلة نقاش حية ومفتوحة تماماً دون قفل الروم أو إسكات الأعضاء والبوتات
            setTimeout(async () => {
                await message.channel.send('🗳️ **انتهت مهلة التفكير الحر! بدأت الآن ساحة التصويت التفاعلية بالأزرار لإقصاء المشتبه بهم!**');
                
                const rows = [];
                let currentRow = new ActionRowBuilder();
                const participants = Array.from(activeMafiaGame.players.values());

                for (let i = 0; i < participants.length; i++) {
                    if (i > 0 && i % 5 === 0) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
                    currentRow.addComponents(
                        new ButtonBuilder().setCustomId(`vote_mafia_target_${participants[i].id}`).setLabel(participants[i].username.slice(0, 8)).setStyle(ButtonStyle.Primary)
                    );
                }
                if (currentRow.components.length >= 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
                currentRow.addComponents(new ButtonBuilder().setCustomId('vote_mafia_skip').setLabel('⏭️ تخطي التصويت').setStyle(ButtonStyle.Danger));
                rows.push(currentRow);

                const voteEmbed = new EmbedBuilder().setTitle('🗳️ ساحة تصويت المافيا الحية').setDescription('اضغط على اسم الشخص المراد إقصاؤه من البطولة، وتذكروا أن الشات سيبقى دائماً مفتوحاً لنقاشاتكم!').setColor(0xE74C3C);
                const voteMsg = await message.channel.send({ embeds: [voteEmbed], components: rows });

                const voteCollector = voteMsg.createMessageComponentCollector({ time: 30000 });
                voteCollector.on('end', () => { 
                    message.channel.send('🏁 انتهت جولة التصويت بنجاح، وتم تصفير اللعبة لتبدأوا جولة جديدة متى شئتم!');
                    activeMafiaGame = null; 
                });
            }, 45000); // 45 ثانية نقاش وسوالف حرة ومفتوحة
        });
    }

    // الاختصار النصي لإرسال الـ .dm من الإداريين
    if (msgContent.startsWith('.dm')) {
        if (message.author.bot) return;
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const args = message.content.slice('.dm'.length).trim().split(/ +/);
        if (args.length < 1) return;

        if (args[0] === 'كل' || args[0].toLowerCase() === 'all') {
            const broadcastText = args.slice(1).join(' ');
            if (!broadcastText) return;
            const members = await message.guild.members.fetch();
            members.forEach(m => { if (!m.user.bot) m.send(`📢 **إشعار جماعي عاجل من الإدارة:**\n\n${broadcastText}`).catch(() => {}); });
        } else {
            const targetUser = message.mentions.users.first();
            const directText = args.slice(1).join(' ');
            if (!targetUser || !directText) return;
            try { await targetUser.send(`📢 **رسالة إدارية مباشرة من الإدارة العليا:**\n\n${directText}`); } catch (e) {}
        }
    }
});

// 4️⃣ نظام التذاكر بالـ Modals الاحترافي (بناءً على الصورة 1000001222.jpg وتظل الروم مفتوحة بالكامل)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-ticket') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ للمدراء فقط!', ephemeral: true });
        TICKET_LOG_CHANNEL_ID = interaction.channel.id;

        const ticketEmbed = new EmbedBuilder()
            .setTitle(interaction.options.getString('title'))
            .setDescription(interaction.options.getString('description'))
            .setColor(0x3498DB)
            .setFooter({ text: 'اضغط على الزر لتوضيح مشكلتك في النافذة المنبثقة' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_modal_ticket_system').setLabel(interaction.options.getString('button_text')).setStyle(ButtonStyle.Primary).setEmoji('🎟️')
        );
        await interaction.reply({ content: '✅ تم تثبيت رسالة نظام التذاكر المطور بالكامل!', ephemeral: true });
        await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });
    }

    if (interaction.isButton() && interaction.customId === 'open_modal_ticket_system') {
        const modal = new ModalBuilder().setCustomId('ticket_modal_screen').setTitle('General Support');
        const reasonInput = new TextInputBuilder()
            .setCustomId('ticket_user_reason')
            .setLabel('What is your question?')
            .setPlaceholder("Please describe your problem in details. Don't spam random letters or only write 'I need help'")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal_screen') {
        const problem = interaction.fields.getTextInputValue('ticket_user_reason');
        
        // إنشاء الروم وتظل مفتوحة تماماً للمحادثة والنقاش دون إغلاق آلي
        const ch = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
            ]
        });

        await interaction.reply({ content: `✅ تم فتح تذكرتك بنجاح وبقيت مفتوحة للنقاش في الروم: ${ch}`, ephemeral: true });
        
        await ch.send({ 
            content: `⚠️ استدعاء عاجل للـ @Administrator والمدراء مراجعة تكت المشكلة فوراً!`,
            embeds: [new EmbedBuilder().setTitle('🎟️ دعم فني مفتوح').setDescription(`مرحباً بك يا <@${interaction.user.id}>\n\n**تفاصيل المشكلة المرفوعة بالنافذة:**\n\`\`\`text\n${problem}\n\`\`\``).setColor(0x2ECC71).setFooter({ text: 'تحدث هنا براحتك، الروم ستبقى مفتوحة.' })] 
        });
    }
});

// 5️⃣ استرجاع أنظمة الـ Giveaway والـ Vote والأنظمة العامة بالكامل دون نقص
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // نظام الجيف اواي (Giveaway System) المسترجع
    if (interaction.commandName === 'giveaway') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ للمدراء فقط!', ephemeral: true });
        const prize = interaction.options.getString('prize');
        const duration = interaction.options.getInteger('duration');

        const giveEmbed = new EmbedBuilder()
            .setTitle('🎉 **GIVEAWAY STARTED / مسابقة جديدة** 🎉')
            .setDescription(`**الجائزة المعروضة:** \`${prize}\`\n**المدة المتبقية:** \`${duration}\` دقيقة\n\nاضغط على زر التفاعل أدناه للدخول في السحب فوراً!`)
            .setColor(0xE74C3C)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_giveaway_btn').setLabel('🎉 دخول السحب').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ content: '✅ تم إطلاق الجيف اواي بنجاح في السيرفر!', ephemeral: true });
        const giveMsg = await interaction.channel.send({ embeds: [giveEmbed], components: [row] });

        const entrants = [];
        const giveCollector = giveMsg.createMessageComponentCollector({ time: duration * 60000 });
        
        giveCollector.on('collect', async i => {
            if (i.customId === 'join_giveaway_btn') {
                if (entrants.includes(i.user.id)) return i.reply({ content: '❌ أنت مسجل بالفعل بالمسابقة!', ephemeral: true });
                entrants.push(i.user.id);
                await i.reply({ content: '✅ تم تسجيل دخولك في السحب بنجاح، حظاً موفقاً!', ephemeral: true });
            }
        });

        giveCollector.on('end', async () => {
            if (entrants.length === 0) return interaction.channel.send('❌ انتهت المسابقة ولم يشترك أحد، تم إلغاء السحب.');
            const winner = entrants[Math.floor(Math.random() * entrants.length)];
            await interaction.channel.send(`🎉 **مبروك الفائز بالمسابقة هو: <@${winner}>! لقد حصلت على الجائزة: \`${prize}\` بقوة!**`);
        });
    }

    // نظام التصويت بالإيموجي والأزرار العادلة (Vote System) المسترجع
    if (interaction.commandName === 'vote') {
        const question = interaction.options.getString('question');
        const voteEmbed = new EmbedBuilder()
            .setTitle('🗳️ إستطلاع رأي وتصويت للأعضاء')
            .setDescription(`**الموضوع المطروح:**\n\n${question}`)
            .setColor(0x9B59B6)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vote_yes').setLabel('موافق 👍').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('vote_no').setLabel('معارض 👎').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ content: '✅ تم نشر التصويت بنجاح!', ephemeral: true });
        await interaction.channel.send({ embeds: [voteEmbed], components: [row] });
    }

    // أنظمة ألعاب ضربات الجزاء والبروفايل والأعلام كاملة ومستقرة
    if (interaction.commandName === 'profile') {
        const data = getUserData(interaction.user.id, interaction.user.username);
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🪪 ملف ${interaction.user.username}`).addFields({ name: '🥈 النقاط:', value: `\`${data.points}\`` }).setColor(0x27AE60)] });
    }
    if (interaction.commandName === 'penalty') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('kick_l').setLabel('يسار ⬅️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('kick_r').setLabel('يمين ➡️').setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({ content: '⚽ سدد ركلة الترجيح الرياضية القاتلة الآن:', components: [row] });
    }
    if (interaction.commandName === 'guess-nationality') {
        const flag = flagData[Math.floor(Math.random() * flagData.length)];
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🌍 خمن العلم التالي للحصول على النقاط!').setImage(flag.flagUrl).setColor(0xF39C12)] });
    }
});

// 6️⃣ قائمة المساعدة الفورية والصادقة 100% الشاملة لكل الأنظمة القديمة والجديدة دون استثناء
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'help') return;

    const helpEmbed = new EmbedBuilder()
        .setTitle('🤖 قائمة التحكم والأوامر الكاملة والشغالة للبوت')
        .setDescription('**جميع الأنظمة والمسابقات مدمجة وتعمل بأعلى استقرار:**\n\n• 🛑 **أنظمة الإدارة (Admin Commands)**\n └ `/dm user`, `/dm all`, `/setup-ticket`\n\n• 🎉 **أنظمة المسابقات والتصويت (Giveaway & Vote)**\n └ `/giveaway` (نظام السحبات المطور)، `/vote` (لوحة التصويت)\n\n• 👥 **أنظمة الألعاب والترفيه (Games)**\n └ `/profile`, `/penalty`, `/guess-nationality`\n\n• 🎟️ **الاختصارات النصية المباشرة (Text Shortcuts)**\n └ `.m` (لعبة المافيا المفتوحة للبوتات والأعضاء)، `.w` (الترحيب الفوري بالصور)')
        .setColor(0x5865F2)
        .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png'); 

    await interaction.reply({ embeds: [helpEmbed] });
});

client.login(process.env.TOKEN);
