/**
 * Bot Version: 3.9.1v (Mafia Gamers Cup & Live Fix Edition)
 * Developer: ta_im1 | Team: TRL for development
 */

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits, ChannelType } = require('discord.js');
const express = require('express');

// 1️⃣ خادم ويب مستقر لمنع التايم آوت وحل مشكلة البورت على رندر
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('World cup 2026 bot. is perfectly running! 🚀'));
app.listen(port, () => console.log(`[SYSTEM] Web server active on port ${port}`));

// 2️⃣ إعداد عميل ديسكورد مع كافة النوايا الضرورية للأوامر والرسائل
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const BOT_VERSION = "3.9.1v";
const footerText = { text: "Development: ta_im1 | Team: TRL for development" };
const activeGames = new Set();
const tempUsers = new Map();

// ذاكرة المستخدمين المؤقتة للنقاط
function getUserData(userId, username) {
    if (!tempUsers.has(userId)) {
        tempUsers.set(userId, {
            userId: userId,
            username: username || 'مشجع مونديالي',
            points: 0,
            favoriteTeam: 'لم يحدد بعد ⚽',
            goalsScored: 0
        });
    }
    return tempUsers.get(userId);
}

async function addPoints(userId, username, amount) {
    const userData = getUserData(userId, username);
    userData.points += amount;
    if (username) userData.username = username;
    try {
        const user = await client.users.fetch(userId);
        if (user) await user.send(`🎉 مبروك حصلت على **+${amount}** نقطة! رصيدك: \`${userData.points}\` 🏆`);
    } catch (e) {}
    return userData.points;
}

// قواميس الألعاب الكلاسيكية
const flagData = [
    { countryAr: "المغرب", countryEn: "morocco", flagUrl: "https://flagcdn.com/w640/ma.png" },
    { countryAr: "السعودية", countryEn: "saudi arabia", flagUrl: "https://flagcdn.com/w640/sa.png" },
    { countryAr: "مصر", countryEn: "egypt", flagUrl: "https://flagcdn.com/w640/eg.png" },
    { countryAr: "الأرجنتين", countryEn: "argentina", flagUrl: "https://flagcdn.com/w640/ar.png" },
    { countryAr: "فرنسا", countryEn: "france", flagUrl: "https://flagcdn.com/w640/fr.png" },
    { countryAr: "البرازيل", countryEn: "brazil", flagUrl: "https://flagcdn.com/w640/br.png" }
];
const teamsList = [
    { name: "🇲🇦 المغرب", id: "morocco" }, { name: "🇸🇦 السعودية", id: "saudi_arabia" },
    { name: "🇪🇬 مصر", id: "egypt" }, { name: "🇦🇷 الأرجنتين", id: "argentina" },
    { name: "🇧🇷 البرازيل", id: "brazil" }, { name: "🇫🇷 فرنسا", id: "france" }
];

// 3️⃣ حل مشكلة توقف الـ Slash Commands وتصليح السيرفر
client.once('ready', async () => {
    console.log(`[ONLINE] Logged in as ${client.user.tag}! Version: ${BOT_VERSION}`);

    const commands = [
        new SlashCommandBuilder().setName('help').setDescription('عرض دليل المساعدة والأوامر بالكامل للتحديث v3.9.1'),
        new SlashCommandBuilder().setName('teams').setDescription('عرض المنتخبات والمجموعات المبرمجة'),
        new SlashCommandBuilder().setName('guess-flag').setDescription('بدء جولة تخمين سريعة لاسم العلم'),
        new SlashCommandBuilder().setName('profile').setDescription('عرض ملفك الشخصي الرياضي، نقاطك وفريقك المفضل'),
        new SlashCommandBuilder().setName('countdown').setDescription('مؤقت الوقت المتبقي لصافرة البداية والافتتاح'),
        new SlashCommandBuilder().setName('leaderboard').setDescription('عرض لوحة الصدارة لأعلى المشجعين بالنقاط'),
        new SlashCommandBuilder().setName('penalty').setDescription('تحدي ركلات الترجيح المباشر بالأزرار ضد البوت'),
        new SlashCommandBuilder().setName('setup-verify').setDescription('إنشاء رسالة التحقق والـ Verification التلقائية بالأزرار (للإدارة)'),
        new SlashCommandBuilder().setName('guess-nationality').setDescription('بدء لعبة خمن جنسية اللاعب الجديدة (شبكة 3x3)'),
        new SlashCommandBuilder()
            .setName('match-poll')
            .setDescription('إنشاء تصويت تفاعلي بالأزرار لمباراة مونديالية (للإدارة فقط)')
            .addStringOption(opt => opt.setName('description').setDescription('وصف المباراة').setRequired(true))
            .addStringOption(opt => opt.setName('team1').setDescription('اسم المنتخب الأول').setRequired(true))
            .addStringOption(opt => opt.setName('team2').setDescription('اسم المنتخب الثاني').setRequired(true))
            .addBooleanOption(opt => opt.setName('allow-draw').setDescription('هل تريد إتاحة خيار التعادل؟').setRequired(true)),
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('إنشاء قيف اوي مونديالي منظم بالوقت والإيموجي (للإدارة فقط)')
            .addStringOption(opt => opt.setName('prize').setDescription('الجائزة').setRequired(true))
            .addIntegerOption(opt => opt.setName('duration').setDescription('المدة الزمنية').setRequired(true))
            .addStringOption(opt => opt.setName('unit').setDescription('وحدة الوقت').setRequired(true).addChoices({ name: 'دقائق', value: 'm' }, { name: 'ساعات', value: 'h' }))
            .addStringOption(opt => opt.setName('emoji').setDescription('الإيموجي الخاص بالتفاعل').setRequired(true))
            .addIntegerOption(opt => opt.setName('winners').setDescription('عدد الفائزين')),
        new SlashCommandBuilder()
            .setName('choose-team')
            .setDescription('اختر فريقك الذي تدعمه وتشجعه في المونديال')
            .addStringOption(opt => opt.setName('team').setDescription('اختر المنتخب المفضل').setRequired(true).addChoices(...teamsList.map(t => ({ name: t.name, value: t.name })))),
    ].map(cmd => cmd.toJSON());

    // التسجيل الإجباري المستقل للأوامر المائلة بالتوكن فور الإقلاع
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('[SYSTEM] Starting refreshing application (/) commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[SYSTEM] Successfully reloaded application (/) commands. All commands are working now!');
    } catch (error) {
        console.error('[ERROR] Failed to register slash commands:', error);
    }
});

// 4️⃣ نظام التذاكر المتطور والمصلح بالأمر النصي `.wr`
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.trim().toLowerCase() === '.wr') {
        // البحث عن الرتبة المطلوبة ticket بدقة
        let ticketRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'ticket');
        if (!ticketRole) {
            return message.reply('❌ خطأ: لم يتم العثور على رتبة باسم `ticket` في السيرفر! يرجى إنشائها أولاً لتشغيل النظام.');
        }

        try {
            const ticketChannel = await message.guild.channels.create({
                name: `ticket-${message.author.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: message.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: message.author.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles]
                    },
                    {
                        id: ticketRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }
                ]
            });
            await message.reply(`✅ تم إنشاء غرفة التذكرة الخاصة بك بنجاح: ${ticketChannel}`);
        } catch (err) {
            console.error(err);
            await message.reply('❌ فشل إنشاء التذكرة، تأكد من إعطاء البوت رتبة عليا وصلاحية إدارة القنوات (`Manage Channels`).');
        }
    }
});

// 5️⃣ نظام ألعاب المافيا الاحترافي الشامل المطور بالأمر النصي `.m`
let activeMafiaGame = null;

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.trim().toLowerCase() === '.m') {
        if (activeMafiaGame) {
            return message.reply('⚠️ هناك لعبة مافيا قائمة بالفعل في السيرفر حالياً!');
        }

        // بدء هيكلة اللعبة البرمجية
        activeMafiaGame = {
            hostChannel: message.channel.id,
            players: new Map(), // يحفظ معرّف الشخص والاسم
            status: 'lobby',
            messageId: null
        };

        const updateEmbed = () => {
            const playerList = Array.from(activeMafiaGame.players.values()).map((p, index) => `${index + 1}- <@${p.id}>`).join('\n') || 'لا يوجد لاعبين مسجلين حالياً.';
            
            return new EmbedBuilder()
                .setTitle('✨ .•°•-BRQ Community 7K°.•?')
                .setDescription(`**شرح اللعبة:**\n1- انضم للعبة عبر الزر الأخضر الموجود في الأسفل.\n2- كل لاعب يحصل على دور سري (مافيا، مواطن، طبيب، وغيرها).\n3- تتصرف الأدوار الخاصة سراً؛ نهاراً يصوت الجميع لطرد مشتبه.\n4- يفوز المواطنون بإقصاء جميع القاتلين، المافيا تفوز إن تفوق عددهم على المواطنين المتبقين، بعض الأدوار لها هدف خاص.\n\n**المشاركين (${activeMafiaGame.players.size}/25):**\n${playerList}\n\n**ستبدأ اللعبة خلال 30 ثانية أو عند اكتمال العدد**`)
                .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png') // رفع صورة كلمة مافيا المطابقة لـ 1000001214.png
                .setColor(0x5865F2)
                .setFooter({ text: "ستبدأ اللعبة خلال 30 ثانية | Clover" });
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mafia_join').setEmoji('📥').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('mafia_leave').setEmoji('📤').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('mafia_info').setLabel('info').setStyle(ButtonStyle.Secondary)
        );

        const gameMsg = await message.channel.send({ embeds: [updateEmbed()], components: [row] });
        activeMafiaGame.messageId = gameMsg.id;

        const collector = gameMsg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async interaction => {
            if (interaction.customId === 'mafia_join') {
                if (activeMafiaGame.players.has(interaction.user.id)) {
                    return interaction.reply({ content: '❌ أنت مسجل بالفعل في قائمة اللاعبين الحالية!', ephemeral: true });
                }
                if (activeMafiaGame.players.size >= 25) {
                    return interaction.reply({ content: '❌ عذراً، اكتمل الحد الأقصى للاعبين (25 لاعب)!', ephemeral: true });
                }
                activeMafiaGame.players.set(interaction.user.id, { id: interaction.user.id, name: interaction.user.username });
                await interaction.deferUpdate();
                await gameMsg.edit({ embeds: [updateEmbed()] });
            }

            if (interaction.customId === 'mafia_leave') {
                if (!activeMafiaGame.players.has(interaction.user.id)) {
                    return interaction.reply({ content: '❌ أنت غير مسجل في هذه اللعبة لتخرج منها!', ephemeral: true });
                }
                activeMafiaGame.players.delete(interaction.user.id);
                await interaction.deferUpdate();
                await gameMsg.edit({ embeds: [updateEmbed()] });
            }

            if (interaction.customId === 'mafia_info') {
                await interaction.reply({
                    content: `🕵️‍♂️ **دليل أدوار لعبة مافيا لاعبين:**\n• **الحكم:** يدير النقاشات، ويكشف هوية اللاعبين المشتبه بهم.\n• **المافيا:** يتفقون سراً لتصفية مواطن كل ليلة.\n• **المسعف (الطبيب):** يختار شخصاً واحداً كل ليلة لحمايته من القتل.\n• **المواطن:** يحاول استخدام الذكاء والتحليل لكشف المافيا في النهار المفتوح.`,
                    ephemeral: true
                });
            }
        });

        collector.on('end', async () => {
            if (!activeMafiaGame) return;
            
            // إلغاء اللعبة في حال كان العدد أقل من 4 مطابقة للصورة المرفقة
            if (activeMafiaGame.players.size < 4) {
                await message.channel.send(`❌ | **تم إلغاء اللعبة نظراً لعدم وجود 4 لاعبين على الأقل.**`);
                activeMafiaGame = null;
                return;
            }

            // ميكانيكية حساب وزيادة المسعفين والحكام ديناميكياً كلما زاد عدد اللاعبين
            const playerIds = Array.from(activeMafiaGame.players.keys());
            const totalCount = playerIds.length;

            let mafiaCount = Math.max(1, Math.floor(totalCount * 0.25));
            let doctorCount = Math.max(1, Math.floor(totalCount * 0.15));
            let judgeCount = Math.max(1, Math.floor(totalCount * 0.15));

            // خلط المصفوفة عشوائياً لتوزيع الأدوار السرية
            const shuffled = playerIds.sort(() => 0.5 - Math.random());
            const assignments = {};

            for (let i = 0; i < shuffled.length; i++) {
                if (i < mafiaCount) assignments[shuffled[i]] = "مافيا 🕵️‍♂️";
                else if (i < mafiaCount + doctorCount) assignments[shuffled[i]] = "مسعف (طبيب) 🩺";
                else if (i < mafiaCount + doctorCount + judgeCount) assignments[shuffled[i]] = "حكم المباراة ⚖️";
                else assignments[shuffled[i]] = "مواطن صالِح ⚽";
            }

            await message.channel.send(`🎮 **اكتملت القائمة المونديالية! تم توزيع الأدوار سراً على الخاص لـ \`${totalCount}\` لاعباً وبدأت المعركة الآن!**`);

            // إرسال كروت الأدوار سراً للأعضاء في الـ DM
            for (const pId of playerIds) {
                try {
                    const u = await client.users.fetch(pId);
                    if (u) {
                        const roleEmbed = new EmbedBuilder()
                            .setTitle('🎯 بطاقة دورك السري في المافيا')
                            .setDescription(`أهلاً بك في البطولة، دورك الحقيقي في هذه الجولة هو: **[ ${assignments[pId]} ]**\n\nلا تكشف دورك لأي لاعب في الشات العام وحافظ على السرية لتحقيق الفوز!`)
                            .setThumbnail('https://images2.imgbox.com/00/fc/p9N6Xb8H_o.png') // لوجو مصغر ملائم للبطاقة 1000001213.jpg
                            .setColor(0xE74C3C);
                        await u.send({ embeds: [roleEmbed] });
                    }
                } catch (e) {
                    console.log(`Could not send private role card to ${pId}`);
                }
            }

            activeMafiaGame = null; // تصفير الجلسة لاستقبال لعبة جديدة لاحقاً
        });
    }
});

// 6️⃣ نظام الـ DM المطور للإدارة العليا (للكل أو لشخص معين)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.startsWith('/dm')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ خطأ إداري: هذا الأمر مخصص فقط لمسؤولي السيرفر (Administrator)!');
        }

        const args = message.content.slice('/dm'.length).trim().split(/ +/);
        if (args.length < 1 || !args[0]) {
            return message.reply('❌ صيغة خاطئة! الاستخدام الصحيح:\n• لإرسال لشخص معين: `/dm @Member نص الرسالة`\n• لإرسال لجميع أعضاء السيرفر: `/dm all نص الرسالة`');
        }

        const targetMention = message.mentions.users.first();

        if (targetMention) {
            // الإرسال لشخص معين
            const messageText = args.slice(1).join(' ');
            if (!messageText) return message.reply('❌ يرجى كتابة نص الرسالة التي ترغب في إرسالها للمستخدم بعد المنشن!');
            
            try {
                await targetMention.send(`📢 **رسالة إدارية خاصة من إدارة السيرفر:**\n\n${messageText}`);
                await message.reply(`✅ تم إرسال الرسالة الخاصة إلى <@${targetMention.id}> بنجاح تام!`);
            } catch (err) {
                await message.reply('❌ تعذر إرسال الرسالة لهذا العضو، قد يكون قد قام بقفل الخاص (DMs Closed).');
            }
        } else if (args[0].toLowerCase() === 'all') {
            // الإرسال الجماعي لجميع الأعضاء
            const messageText = args.slice(1).join(' ');
            if (!messageText) return message.reply('❌ يرجى كتابة نص الرسالة الإدارية الجماعية بعد كلمة all!');

            await message.reply('⏳ جاري البدء في إرسال الرسائل الخاصة لجميع الأعضاء في الخلفية...');
            try {
                const fetchedMembers = await message.guild.members.fetch();
                let sentCount = 0;
                fetchedMembers.forEach(member => {
                    if (!member.user.bot) {
                        member.send(`📢 **إشعار جماعي هام من إدارة السيرفر:**\n\n${messageText}`)
                            .then(() => sentCount++)
                            .catch(() => {});
                    }
                });
            } catch (err) {
                console.error(err);
            }
        } else {
            await message.reply('❌ يرجى تحديد منشن صحيح للعضو، أو كتابة كلمة `all` لإرسال الرسالة للجميع مجاناً.');
        }
    }
});

// 7️⃣ الاحتفاظ بالأوامر القديمة بالكامل (لعبة الأعلام الكلاسيكية والشات)
async function startGuessGame(channel) {
    if (activeGames.has(channel.id)) return channel.send('❌ هناك جولة قائمة بالفعل في هذه القناة!');
    activeGames.add(channel.id);

    const chosen = flagData[Math.floor(Math.random() * flagData.length)];
    const gameEmbed = new EmbedBuilder().setTitle('🤔 خمن اسم الدولة صاحبة هذا العلم!').setImage(chosen.flagUrl).setColor(0xF39C12).setFooter(footerText);
    await channel.send({ embeds: [gameEmbed] });

    const filter = res => { const ans = res.content.trim().toLowerCase(); return ans === chosen.countryAr || ans === chosen.countryEn; };
    const collector = channel.createMessageCollector({ filter, time: 15000, max: 1 });
    let won = false;

    collector.on('collect', async m => {
        won = true;
        const total = await addPoints(m.author.id, m.author.username, 1);
        await channel.send({ embeds: [new EmbedBuilder().setTitle('🎉 إجابة صحيحة!').setDescription(`الدولة هي: **${chosen.countryAr}**\nتم منحك **+1 نقطة**! رصيدك: \`${total}\``).setColor(0x2ECC71).setFooter(footerText)] });
        collector.stop();
    });
    collector.on('end', () => { activeGames.delete(channel.id); if (!won) channel.send(`⏱️ انتهى الوقت! الدولة هي: **${chosen.countryAr}**`); });
}

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    if (message.content.trim().toLowerCase() === '.w') {
        await startGuessGame(message.channel);
    }
});

// معالجة كافة الـ Interactions الخاصة بأوامر السلاش والأزرار القديمة بدون استثناء
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_member') {
            await interaction.deferReply({ ephemeral: true });
            let verifyRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'member');
            if (!verifyRole) return interaction.editReply({ content: '❌ لم يتم العثور على رتبة باسم `Member`.' });
            try {
                await interaction.member.roles.add(verifyRole);
                return interaction.editReply({ content: `✅ تم التحقق منك بنجاح ورتبتك جاهزة! 🎉` });
            } catch (err) { return interaction.editReply({ content: '❌ مشكلة في إعطاء الرتبة.' }); }
        }

        if (interaction.customId.startsWith('nat_')) {
            await interaction.deferReply({ ephemeral: true });
            const answer = interaction.customId.split('_')[1];
            if (answer === 'correct') {
                const total = await addPoints(interaction.user.id, interaction.user.username, 1);
                await interaction.editReply({ content: `✅ كفوو! إجابة صحيحة تامة! نلت **+1 نقطة** وعلم البرازيل هو جنسية نيمار الصحيحة! رصيدك الإجمالي: \`${total}\`` });
                await interaction.message.delete().catch(() => {});
            } else {
                await interaction.editReply({ content: `❌ خطأ! هذا العلم ليس الجنسية الصحيحة للاعب، حاول في التحدي القادم!` });
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, channel, user } = interaction;

    const isAdminCommand = ['setup-verify', 'match-poll', 'giveaway'].includes(commandName);
    if (isAdminCommand && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ خطأ إداري: هذا الأمر مخصص فقط لمسؤولي السيرفر (Administrator)!', ephemeral: true });
    }

    if (commandName === 'guess-nationality') {
        await interaction.deferReply();
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nat_wrong1').setLabel('🇲🇦 المغرب').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nat_wrong2').setLabel('🇸🇦 السعودية').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nat_wrong3').setLabel('🇪🇬 مصر').setStyle(ButtonStyle.Secondary)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nat_wrong4').setLabel('🇲🇽 المكسيك').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nat_correct').setLabel('🇧🇷 البرازيل').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('nat_wrong5').setLabel('🇦🇷 الأرجنتين').setStyle(ButtonStyle.Secondary)
        );
        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nat_wrong6').setLabel('🇫🇷 فرنسا').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nat_wrong7').setLabel('🇪🇸 إسبانيا').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nat_wrong8').setLabel('🇩🇪 ألمانيا').setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
            .setTitle('🧠 تحدي جنسية اللاعب الذكي (3x3)!')
            .setDescription('⚽ اللاعب هو النجم الساحر: **[ نيمار / Neymar ]**\n\nاضغط على علم بلد جنسيته الصحيحة من الشبكة أدناه لتفوز!')
            .setColor(0x27AE60)
            .setFooter(footerText);

        await interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });
    }

    if (commandName === 'profile') {
        await interaction.deferReply();
        const userData = getUserData(user.id, user.username);
        const profileEmbed = new EmbedBuilder()
            .setTitle(`🪪 الهوية الرياضية لـ ${user.username}`)
            .setColor(0x27AE60)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🥇 إجمالي نقاطك:', value: `\`${userData.points}\` نقطة`, inline: true },
                { name: '🥅 أهداف الترجيح:', value: `\`${userData.goalsScored}\` هدف`, inline: true },
                { name: '❤️ المنتخب المشجع:', value: `**${userData.favoriteTeam}**`, inline: false }
            ).setFooter(footerText);
        await interaction.editReply({ embeds: [profileEmbed] });
    }

    if (commandName === 'penalty') {
        await interaction.deferReply();
        const rowAction = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shoot_left').setLabel('يسار ⬅️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('shoot_center').setLabel('وسط ⬆️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('shoot_right').setLabel('يمين ➡️').setStyle(ButtonStyle.Primary)
        );
        const startEmbed = new EmbedBuilder().setTitle('⚽ تحدي ركلات الترجيح الكبرى 🥅').setDescription(`سدد الآن يا بطل!`).setColor(0x2980B9).setFooter(footerText);
        const msg = await interaction.editReply({ embeds: [startEmbed], components: [rowAction] });
        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

        collector.on('collect', async btnInteraction => {
            if (btnInteraction.user.id !== user.id) return btnInteraction.reply({ content: '❌ ليس دورك!', ephemeral: true });
            await btnInteraction.deferUpdate();
            const botGoalkeeperJump = ['shoot_left', 'shoot_center', 'shoot_right'][Math.floor(Math.random() * 3)];
            
            if (btnInteraction.customId === botGoalkeeperJump) {
                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌ تصدى لها الحارس!').setColor(0xC0392B).setFooter(footerText)], components: [] });
            } else {
                const userData = getUserData(user.id, user.username);
                userData.goalsScored++;
                const newTotal = await addPoints(user.id, user.username, 1);
                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚽ هدف هز الشباك المونديالية الحارقة!').setDescription(`تم إضافة **+1 نقطة** وترقية رصيدك وإرسال إشعار خاص! رصيدك: \`${newTotal}\``).setColor(0x27AE60).setFooter(footerText)], components: [] });
            }
            collector.stop();
        });
    }

    if (commandName === 'leaderboard') {
        await interaction.deferReply();
        const sortedUsers = Array.from(tempUsers.values()).sort((a, b) => b.points - a.points).slice(0, 10);
        if (sortedUsers.length === 0) return interaction.editReply({ content: '📊 لا توجد نقاط مسجلة حالياً!' });

        let description = "🏆 **ترتيب أعلى المشجعين بالنقاط حالياً:**\n\n";
        sortedUsers.forEach((row, index) => { description += `${index + 1}. **${row.username}** — \`${row.points}\` نقطة [الفريق: ${row.favoriteTeam}]\n`; });
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📊 لوحة الصدارة').setDescription(description).setColor(0xF1C40F).setFooter(footerText)] });
    }

    if (commandName === 'match-poll') {
        await interaction.deferReply();
        const desc = options.getString('description');
        const t1 = options.getString('team1');
        const t2 = options.getString('team2');
        const allowDraw = options.getBoolean('allow-draw');

        let votes = { t1: 0, t2: 0, draw: 0 };
        const votedUsers = new Set();

        const generateEmbed = () => {
            return new EmbedBuilder()
                .setTitle('📊 تصويت لمباراة مونديالية حية!')
                .setDescription(`🏆 **تفاصيل الحدث:**\n${desc}\n\nاضغط لتوقعك الفائز!`)
                .addFields(
                    { name: `🔹 ${t1}`, value: `\`${votes.t1}\` تصويت`, inline: true },
                    allowDraw ? { name: `🤝 التعادل`, value: `\`${votes.draw}\` تصويت`, inline: true } : { name: '—', value: '—', inline: true },
                    { name: `🔸 ${t2}`, value: `\`${votes.t2}\` تصويت`, inline: true }
                ).setColor(0xE67E22).setFooter(footerText);
        };

        const pollRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vote_t1').setLabel(t1).setStyle(ButtonStyle.Primary),
            ...(allowDraw ? [new ButtonBuilder().setCustomId('vote_draw').setLabel('🤝 التعادل').setStyle(ButtonStyle.Secondary)] : []),
            new ButtonBuilder().setCustomId('vote_t2').setLabel(t2).setStyle(ButtonStyle.Success)
        );

        const pollMessage = await interaction.editReply({ embeds: [generateEmbed()], components: [pollRow] });
        const collector = pollMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 24 * 60 * 60 * 1000 });

        collector.on('collect', async btnInt => {
            if (votedUsers.has(btnInt.user.id)) return btnInt.reply({ content: '❌ لقد قمت بالتصويت مسبقاً!', ephemeral: true });
            votedUsers.add(btnInt.user.id);
            if (btnInt.customId === 'vote_t1') votes.t1++;
            if (btnInt.customId === 'vote_t2') votes.t2++;
            if (btnInt.customId === 'vote_draw') votes.draw++;
            await btnInt.deferUpdate();
            await interaction.editReply({ embeds: [generateEmbed()] });
        });
    }

    if (commandName === 'giveaway') {
        await interaction.reply({ content: '🎉 تم إطلاق القيف اوي بنجاح في الغرفة!', ephemeral: true });
        const prize = options.getString('prize');
        const duration = options.getInteger('duration');
        const unit = options.getString('unit');
        const customEmoji = options.getString('emoji');
        const winnersCount = options.getInteger('winners') || 1;

        const durationMs = unit === 'm' ? duration * 60 * 1000 : duration * 60 * 60 * 1000;
        const endTimestamp = Math.floor((Date.now() + durationMs) / 1000);

        const giveawayEmbed = new EmbedBuilder()
            .setTitle(`🎁 قيف اوي المونديال الكبرى`)
            .setDescription(`🏆 **الجائزة المتاحة:** **${prize}**\n⚡ **عدد الفائزين:** \`${winnersCount}\`\n⏱️ **ينتهي في:** <t:${endTimestamp}:R>\n\nاضغط على الإيموجي لتشترك!`)
            .setColor(0xD35400).setFooter(footerText);

        const giveawayMsg = await channel.send({ embeds: [giveawayEmbed] });
        try { await giveawayMsg.react(customEmoji); } catch (err) { return; }

        setTimeout(async () => {
            try {
                const refreshedMsg = await channel.messages.fetch(giveawayMsg.id);
                const reaction = refreshedMsg.reactions.cache.get(customEmoji);
                if (!reaction) return;
                const usersReaction = await reaction.users.fetch();
                const eligibleUsers = usersReaction.filter(u => !u.bot).map(u => u.id);

                if (eligibleUsers.length === 0) return channel.send(`😔 انتهى وقت القيف اوي ولم يشترك أحد!`);
                const shuffled = eligibleUsers.sort(() => 0.5 - Math.random());
                const winners = shuffled.slice(0, winnersCount).map(id => `<@${id}>`);

                await channel.send({ content: `🥳 مبروك للفائزين بالقيف اوي: ${winners.join(', ')}!` });
            } catch (err) { console.error(err); }
        }, durationMs);
    }

    if (commandName === 'choose-team') {
        await interaction.deferReply();
        const selectedTeam = options.getString('team');
        const userData = getUserData(user.id, user.username);
        userData.favoriteTeam = selectedTeam;
        await interaction.editReply({ content: `🏆 تم تسجيل **${selectedTeam}** كفريقك المفضل المشجع بنجاح! 🔥` });
    }

    if (commandName === 'help') {
        await interaction.deferReply();
        const helpEmbed = new EmbedBuilder()
            .setTitle(`📖 دليل الأوامر وتحديثات v3.9.1v الشاملة والكاملة`)
            .setDescription(`**الأوامر المائلة (Slash Commands):**\n• \`/help\` - لعرض هذه القائمة المساعدة.\n• \`/profile\` - لعرض ملفك الشخصي الرياضي.\n• \`/penalty\` - بدء تحدي ركلات الترجيح.\n• \`/choose-team\` - اختيار منتخبك المفضل.\n• \`/leaderboard\` - عرض المتصدرين بالنقاط.\n• \`/guess-nationality\` - لعبة الـ 3x3 لخمن جنسية اللاعب.\n\n**الأوامر النصية العادية (Text Commands):**\n• \`.m\` - لبدء لعبة مافيا لاعبين الكبرى الفورية.\n• \`.wr\` - لإنشاء تذكرة وروم مستقل لرتبة ticket.\n• \`.w\` - لبدء جولة تخمين سريعة لأعلام الدول.\n• \`/dm @user\` أو \`/dm all\` - إرسال رسائل خاصة من قبل الإدارة العليا.`)
            .setColor(0x8E44AD)
            .setFooter(footerText);
        await interaction.editReply({ embeds: [helpEmbed] });
    }
    
    if (commandName === 'countdown') await interaction.reply({ content: ` Stadiums are ready for World Cup 2026! 🏟️` });
    if (commandName === 'teams') await interaction.reply({ content: `🌍 المنتخبات المبرمجة جاهزة للتحدي والمنافسة!` });
});

client.login(process.env.TOKEN);
