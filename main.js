const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const express = require('express');
const Database = require('better-sqlite3');

// 1️⃣ إعداد خادم الويب لمنصة Render
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('World Cup 2026 Bot v1.3 🔥 Is Online!'));
app.listen(port, () => console.log(`Web server listening on port ${port}`));

// 2️⃣ إعداد قاعدة البيانات المحدثة بالكامل
const db = new Database('worldcup2026.db');
// جدول المستخدمين والنقاط والفريق المختار ووقت كرت الحظ
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        username TEXT,
        points INTEGER DEFAULT 0,
        favoriteTeam TEXT DEFAULT 'لم يحدد بعد ⚽',
        lastLuckyCard TEXT
    )
`).run();

// جدول الإعدادات وروم الأخبار
db.prepare(`
    CREATE TABLE IF NOT EXISTS config (
        guildId TEXT PRIMARY KEY,
        newsChannelId TEXT
    )
`).run();

// جدول التوقعات للمباريات
db.prepare(`
    CREATE TABLE IF NOT EXISTS predictions (
        userId TEXT PRIMARY KEY,
        prediction TEXT
    )
`).run();

// 3️⃣ إنشاء عميل الديسكورد مع النوايا المطلوبة
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const BOT_NAME = "world cup 2026 bot";
const BOT_VERSION = "1.3v 🔥";
const activeGames = new Set();

// 4️⃣ مصفوفات البيانات (أعلام + قمصان المنتخبات)
const flagData = [
    { countryAr: "المغرب", countryEn: "morocco", flagUrl: "https://flagcdn.com/w640/ma.png" },
    { countryAr: "السعودية", countryEn: "saudi arabia", flagUrl: "https://flagcdn.com/w640/sa.png" },
    { countryAr: "مصر", countryEn: "egypt", flagUrl: "https://flagcdn.com/w640/eg.png" },
    { countryAr: "الأرجنتين", countryEn: "argentina", flagUrl: "https://flagcdn.com/w640/ar.png" },
    { countryAr: "فرنسا", countryEn: "france", flagUrl: "https://flagcdn.com/w640/fr.png" },
    { countryAr: "البرازيل", countryEn: "brazil", flagUrl: "https://flagcdn.com/w640/br.png" },
    { countryAr: "المكسيك", countryEn: "mexico", flagUrl: "https://flagcdn.com/w640/mx.png" },
    { countryAr: "أمريكا", countryEn: "usa", flagUrl: "https://flagcdn.com/w640/us.png" },
    { countryAr: "كندا", countryEn: "canada", flagUrl: "https://flagcdn.com/w640/ca.png" }
];

const jerseyData = [
    { countryAr: "الأرجنتين", countryEn: "argentina", url: "https://i.imgur.com/8N69Fm8.png" },
    { countryAr: "البرازيل", countryEn: "brazil", url: "https://i.imgur.com/gSgPh6X.png" },
    { countryAr: "ألمانيا", countryEn: "germany", url: "https://i.imgur.com/YgY619H.png" },
    { countryAr: "فرنسا", countryEn: "france", url: "https://i.imgur.com/vA1W9pG.png" },
    { countryAr: "المغرب", countryEn: "morocco", url: "https://i.imgur.com/K6b01pY.png" }
];

const teamsList = [
    { name: "🇲🇦 المغرب", id: "morocco" }, { name: "🇸🇦 السعودية", id: "saudi_arabia" },
    { name: "🇪🇬 مصر", id: "egypt" }, { name: "🇲🇽 المكسيك", id: "mexico" },
    { name: "🇺🇸 أمريكا", id: "usa" }, { name: "🇨🇦 كندا", id: "canada" },
    { name: "🇦🇷 الأرجنتين", id: "argentina" }, { name: "🇧🇷 البرازيل", id: "brazil" },
    { name: "🇫🇷 فرنسا", id: "france" }, { name: "🇪🇸 إسبانيا", id: "spain" },
    { name: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 إنجلترا", id: "england" }, { name: "🇩🇪 ألمانيا", id: "germany" }
];

// 5️⃣ تسجيل أوامر الـ Slash Commands التفاعلية بالكامل
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Version: ${BOT_VERSION}`);

    const commands = [
        new SlashCommandBuilder().setName('help').setDescription('عرض قائمة المساعدة والدعم لغتين / Show help menu'),
        new SlashCommandBuilder().setName('teams').setDescription('عرض الفرق المشاركة بكأس العالم / Show participating teams'),
        new SlashCommandBuilder().setName('guess-flag').setDescription('شغل لعبة تخمين العلم (عربي/إنجليزي)'),
        new SlashCommandBuilder().setName('countdown').setDescription('العد التنازلي لافتتاح كأس العالم / World Cup Countdown'),
        new SlashCommandBuilder().setName('leaderboard').setDescription('عرض قائمة متصدري لعبة التخمين / Show Leaderboard'),
        new SlashCommandBuilder().setName('info').setDescription('عرض معلومات البوت الفنية وسرعة اتصال البنك والمطور'),
        new SlashCommandBuilder().setName('lucky-card').setDescription('اسحب بطاقة حظك المونديالية اليومية لتربح نقاطاً 🎁'),
        new SlashCommandBuilder().setName('penalty').setDescription('ابدأ تحدي ركلات الترجيح الذكي بالأزرار ضد البوت ⚽'),
        
        new SlashCommandBuilder()
            .setName('choose-team')
            .setDescription('اختر فريقك المفضل الذي تشجعه في المونديال 🏆')
            .addStringOption(opt => 
                opt.setName('team')
                .setDescription('اختر منتخباً')
                .setRequired(true)
                .addChoices(...teamsList.map(t => ({ name: t.name, value: t.name })))),

        new SlashCommandBuilder()
            .setName('predict')
            .setDescription('توقع نتيجة مباراة الافتتاح (المكسيك ضد كندا) واكسب +3 نقاط! 🔮')
            .addIntegerOption(opt => opt.setName('mexico').setDescription('أهداف المكسيك').setRequired(true))
            .addIntegerOption(opt => opt.setName('canada').setDescription('أهداف كندا').setRequired(true)),

        new SlashCommandBuilder()
            .setName('set-news')
            .setDescription('تحديد روم نشر أخبار وجدول مباريات كأس العالم (للإدارة فقط)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(opt => opt.setName('room').setDescription('اختر الروم المخصص للأخبار').setRequired(true))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Successfully registered all Interactivity Slash Commands.');
    } catch (error) {
        console.error(error);
    }

    // ⏳ نظام جدولة تلقائي لمباراة الافتتاح (فكرة 4 التلقائية)
    // غداً 11 يونيو الافتتاح، نفترض انتهاء المباراة الساعة 21:00 UTC، البوت يعلن تلقائياً النتيجة والجوائز الساعة 21:30 UTC
    setupAutomaticMatchResult();
});

// دالة مساعدة لزيادة نقاط المستخدم وحفظ اسمه
function addPoints(userId, username, amount) {
    const row = db.prepare('SELECT points FROM users WHERE userId = ?').get(userId);
    if (row) {
        db.prepare('UPDATE users SET points = points + ?, username = ? WHERE userId = ?').run(amount, username, userId);
        return row.points + amount;
    } else {
        db.prepare('INSERT INTO users (userId, username, points) VALUES (?, ?, ?)').run(userId, username, amount);
        return amount;
    }
}

// 6️⃣ دالة ألعاب التخمين (الأعلام والقمصان)
async function startGuessGame(channel, type = 'flag') {
    if (activeGames.has(channel.id)) return channel.send('❌ هناك لعبة قائمة بالفعل في هذه القناة!');
    activeGames.add(channel.id);

    const isFlag = type === 'flag';
    const chosen = isFlag 
        ? flagData[Math.floor(Math.random() * flagData.length)]
        : jerseyData[Math.floor(Math.random() * jerseyData.length)];

    const gameEmbed = new EmbedBuilder()
        .setTitle(isFlag ? '🤔 خمن اسم الدولة صاحبة هذا العلم!' : '👕 خمن لمن هذا قميص المنتخب المشارك!')
        .setDescription('⏱️ لديك **15 ثانية** فقط! الإجابة مقبولة بالـ (العربية / English)')
        .setImage(isFlag ? chosen.flagUrl : chosen.url)
        .setColor(0xE67E22);

    await channel.send({ embeds: [gameEmbed] });

    const filter = res => {
        const ans = res.content.trim().toLowerCase();
        return ans === chosen.countryAr || ans === chosen.countryEn;
    };

    const collector = channel.createMessageCollector({ filter, time: 15000, max: 1 });
    let won = false;

    collector.on('collect', async m => {
        won = true;
        const total = addPoints(m.author.id, m.author.username, 1);

        const successEmbed = new EmbedBuilder()
            .setTitle('🎉 إجابة صحيحة / Correct Answer!')
            .setDescription(`🏆 البطل **${m.author}** عرف الإجابة السريعة!\nالدولة هي: **${chosen.countryAr}** | **${chosen.countryEn.toUpperCase()}**\nتم إضافة +1 نقطة! رصيدك الحالي: \`${total}\``)
            .setColor(0x2ECC71);
        await channel.send({ embeds: [successEmbed] });
        collector.stop();
    });

    collector.on('end', () => {
        activeGames.delete(channel.id);
        if (!won) {
            channel.send(`⏱️ انتهى الوقت! الإجابة الصحيحة هي: **${chosen.countryAr}** / **${chosen.countryEn.toUpperCase()}** 😔`);
        }
    });
}

// 7️⃣ استقبال الاختصارات الشات العادية (.w للأعلام و .j للقمصان)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.trim().toLowerCase() === '.w') {
        await startGuessGame(message.channel, 'flag');
    }
    if (message.content.trim().toLowerCase() === '.j') {
        await startGuessGame(message.channel, 'jersey');
    }
});

// 8️⃣ معالجة الـ Slash Commands بالكامل
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, channel, user, guild } = interaction;

    // أمر اختيار الفريق المفضّل
    if (commandName === 'choose-team') {
        await interaction.deferReply();
        const selectedTeam = options.getString('team');
        
        const row = db.prepare('SELECT userId FROM users WHERE userId = ?').get(user.id);
        if (!row) {
            db.prepare('INSERT INTO users (userId, username, favoriteTeam) VALUES (?, ?, ?)').run(user.id, user.username, selectedTeam);
        } else {
            db.prepare('UPDATE users SET favoriteTeam = ?, username = ? WHERE userId = ?').run(selectedTeam, user.username, user.id);
        }

        await interaction.editReply({ content: `🏆 تم بنجاح اختيار **${selectedTeam}** كفريقك المفضل الذي تشجعه وتدعمه في كأس العالم 2026! ⚽🔥` });
    }

    // أمر توقع مباراة الافتتاح
    if (commandName === 'predict') {
        await interaction.deferReply({ ephemeral: true });
        const goalsMex = options.getInteger('mexico');
        const goalsCan = options.getInteger('canada');
        const predictionStr = `${goalsMex}-${goalsCan}`;

        db.prepare('INSERT INTO predictions (userId, prediction) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET prediction = ?')
            .run(user.id, predictionStr, predictionStr);

        await interaction.editReply({ content: `🔮 تم تسجيل توقعك لمباراة الافتتاح بنجاح: **المكسيك ${goalsMex} - ${goalsCan} كندا**. انتظر انتهاء المباراة غداً لمعرفة النتيجة وحصد الجوائز تلقائياً!` });
    }

    // لعبة ركلات الترجيح بالأزرار الذكية
    if (commandName === 'penalty') {
        await interaction.deferReply();

        const rowAction = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shoot_left').setLabel('يسار ⬅️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('shoot_center').setLabel('وسط ⬆️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('shoot_right').setLabel('يمين ➡️').setStyle(ButtonStyle.Primary)
        );

        const startEmbed = new EmbedBuilder()
            .setTitle('⚽ تحدي ركلات الترجيح الذكي 🥅')
            .setDescription(`أهلاً بك يا بطل **${user.username}**! الكرة على نقطة الجزاء والحارس مستعد.\nاختر الآن عبر الأزرار في الأسفل أين ستسدد الكرة لتخادع الحارس!`)
            .setColor(0x3498DB);

        const msg = await interaction.editReply({ embeds: [startEmbed], components: [rowAction] });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

        collector.on('collect', async btnInteraction => {
            if (btnInteraction.user.id !== user.id) {
                return btnInteraction.reply({ content: '❌ هذا التحدي ليس لك! اكتب `/penalty` لبدء تحديك الخاص.', ephemeral: true });
            }

            await btnInteraction.deferUpdate();
            const directions = ['shoot_left', 'shoot_center', 'shoot_right'];
            const botGoalkeeperJump = directions[Math.floor(Math.random() * directions.length)];
            const userShoot = btnInteraction.customId;

            let resultTitle, resultDesc, finalColor;

            if (userShoot === botGoalkeeperJump) {
                resultTitle = '❌ تصدى لها الحارس براعة!';
                resultDesc = `💥 قمت بالتسديد نحو نفس الاتجاه وقام الحارس بصد الكرة بقوة وطير عليك النقطة! حاول مجدداً لاحقاً.`;
                finalColor = 0xE74C3C;
            } else {
                resultTitle = '⚽ جووووول! هدف أسطوري!';
                const newTotal = addPoints(user.id, user.username, 1);
                resultDesc = `🎉 ذكاء خارق! الحارس قفز في اتجاه خاطئ تماماً وسكنت الكرة الشباك المونديالية بنجاح!\nتم إضافة **+1 نقطة** لرصيدك الكلي. رصيدك الحالي: \`${newTotal}\``;
                finalColor = 0x2ECC71;
            }

            const resultEmbed = new EmbedBuilder().setTitle(resultTitle).setDescription(resultDesc).setColor(finalColor);
            await interaction.editReply({ embeds: [resultEmbed], components: [] });
            collector.stop();
        });
    }

    // بطاقة الحظ اليومية
    if (commandName === 'lucky-card') {
        await interaction.deferReply();
        const nowStr = new Date().toDateString(); // لمقارنة الأيام لمنع التكرار قبل 24 ساعة

        const userData = db.prepare('SELECT lastLuckyCard, points FROM users WHERE userId = ?').get(user.id);
        if (userData && userData.lastLuckyCard === nowStr) {
            return interaction.editReply({ content: '❌ لقد سحبت بطاقة حظك المونديالية لهذا اليوم بالفعل! عد مجدداً غداً بعد انتهاء اليوم لرؤية حظك الجديد. 🗓️' });
        }

        const luckyRewards = [
            { text: "🥇 حظك المونديالي اليوم أسطوري! كسبت +3 نقاط كاملة مجاناً!", pts: 3, color: 0xF1C40F },
            { text: "👟 الحذاء الذهبي! حصلت على هدف نظيف ونلت +1 نقطة إضافية!", pts: 1, color: 0x2ECC71 },
            { text: "🟨 كرت أصفر من الحكم بسبب إضاعة الوقت! لم تكسب نقاط اليوم حظاً أوفر.", pts: 0, color: 0xE67E22 },
            { text: "🟥 كرت أحمر طرد مباشر من الملعب! ضاعت عليك الفرصة اليوم ولم تكسب أي شيء.", pts: 0, color: 0xE74C3C }
        ];

        const finalReward = luckyRewards[Math.floor(Math.random() * luckyRewards.length)];
        
        // تحديث قاعدة البيانات بوقت السحب والنقاط
        if (!userData) {
            db.prepare('INSERT INTO users (userId, username, points, lastLuckyCard) VALUES (?, ?, ?, ?)').run(user.id, user.username, finalReward.pts, nowStr);
        } else {
            db.prepare('UPDATE users SET points = points + ?, lastLuckyCard = ?, username = ? WHERE userId = ?').run(finalReward.pts, nowStr, user.username, user.id);
        }

        const luckyEmbed = new EmbedBuilder()
            .setTitle(`🎁 بطاقة الحظ اليومية لـ ${user.username}`)
            .setDescription(finalReward.text)
            .setColor(finalReward.color);
        await interaction.editReply({ embeds: [luckyEmbed] });
    }

    // أمر معلومات البوت الصافي الدقيق
    if (commandName === 'info') {
        await interaction.deferReply();
        const ping = client.ws.ping;
        const totalServers = client.guilds.cache.size;

        const infoEmbed = new EmbedBuilder()
            .setTitle(`🤖 معلومات ${BOT_NAME}`)
            .setColor(0x2C3E50)
            .addFields(
                { name: '💿 الإصدار الحالي (Version):', value: `\`${BOT_VERSION}\``, inline: true },
                { name: '👑 مطور البوت (Developer):', value: `\`Lead Developer (BRQ & RTR)\``, inline: true },
                { name: '🌐 إجمالي عدد السيرفرات:', value: `\`${totalServers}\` سيرفر`, inline: false },
                { name: '⚡ سرعة اتصال البوت (Ping):', value: `\`${ping}ms\``, inline: true }
            );
        await interaction.editReply({ embeds: [infoEmbed] });
    }

    // باقي الأوامر القياسية السابقة (Help, Teams, Countdown, Leaderboard, Set-News)
    if (commandName === 'help') {
        await interaction.deferReply();
        const helpEmbed = new EmbedBuilder()
            .setTitle(`📖 قائمة مساعدة ${BOT_NAME}`)
            .setDescription(`أهلاً بك! إليك قائمة الأوامر التفاعلية الكاملة للمونديال:`)
            .addFields(
                { name: '🎮 ألعاب تفاعلية عامة', value: '`/penalty` - ركلات جزاء ذكية بالأزرار\n`/lucky-card` - بطاقة الحظ اليومية\n`.w` - تخمين العلم الشات\n`.j` - تخمين قميص المنتخب بالصور', inline: true },
                { name: '🏆 فعاليات كأس العالم', value: '`/choose-team` - اختر منتخبك المفضل\n`/predict` - توقع مباراة الافتتاح وتحدي النقاط\n`/teams` - عرض المجموعات والفرق\n`/countdown` - مؤشر الوقت المتبقي', inline: true }
            ).setColor(0x9B59B6);
        await interaction.editReply({ embeds: [helpEmbed] });
    }

    if (commandName === 'teams') {
        await interaction.deferReply();
        const teamsEmbed = new EmbedBuilder()
            .setTitle('🌍 الفرق المشاركة والمجموعات بكأس العالم')
            .setDescription(`🏆 **المجموعات الأولية المبرمجة حالياً:**\n• **المجموعة أ:** المكسيك 🇲🇽، كندا 🇨🇦، أمريكا 🇺🇸\n• **المجموعة ب:** الأرجنتين 🇦🇷، فرنسا 🇫🇷، البرازيل 🇧🇷، المغرب 🇲🇦، مصر 🇪🇬، السعودية 🇸🇦.`)
            .setColor(0x1ABC9C);
        await interaction.editReply({ embeds: [teamsEmbed] });
    }

    if (commandName === 'guess-flag') {
        await startGuessGame(channel, 'flag');
    }

    if (commandName === 'countdown') {
        await interaction.deferReply();
        const worldCupDate = new Date('2026-06-11T18:00:00Z');
        const difference = worldCupDate - new Date();
        if (difference <= 0) return interaction.editReply({ content: '🎉 انطلقت بطولة كأس العالم 2026 والافتتاح الآن! ⚽🏆' });

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const cdEmbed = new EmbedBuilder()
            .setTitle('🏆 المؤقت التنازلي للمونديال')
            .setDescription(`⏳ المتبقي على مباراة الافتتاح الرسمية بالمكسيك: **${days}** يوم و **${hours}** ساعة و **${minutes}** دقيقة!`)
            .setColor(0x3498DB);
        await interaction.editReply({ embeds: [cdEmbed] });
    }

    if (commandName === 'leaderboard') {
        await interaction.deferReply();
        const rows = db.prepare('SELECT username, points, favoriteTeam FROM users ORDER BY points DESC LIMIT 10').all();
        if (rows.length === 0) return interaction.editReply({ content: '📊 لا توجد نقاط مسجلة حتى الآن!' });

        let description = "🏆 **أعلى 10 لاعبين متصدرين بالنقاط والمنتخبات المشجعة:**\n\n";
        rows.forEach((row, index) => {
            let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            description += `${medal} **${row.username}** — \`${row.points}\` نقطة [يشجع: ${row.favoriteTeam}]\n`;
        });
        const lbEmbed = new EmbedBuilder().setTitle('📊 لوحة الصدارة العالمية للمشجعين').setDescription(description).setColor(0xF1C40F);
        await interaction.editReply({ embeds: [lbEmbed] });
    }

    if (commandName === 'set-news') {
        await interaction.deferReply({ ephemeral: true });
        const targetRoom = options.getChannel('room');
        db.prepare('INSERT INTO config (guildId, newsChannelId) VALUES (?, ?) ON CONFLICT(guildId) DO UPDATE SET newsChannelId = ?').run(guild.id, targetRoom.id, targetRoom.id);
        await interaction.editReply({ content: `📢 تم تفعيل وتأكيد روم ${targetRoom} لاستقبال تحديات ونتائج وتوقعات المونديال بنجاح!` });
    }
});

// 9️⃣ ميكانيكية الإعلان التلقائي لنتائج التوقعات والمباراة
function setupAutomaticMatchResult() {
    // توقيت انتهاء مباراة الافتتاح الافتراضي غداً (11 يونيو 2026) مع إضافة نصف ساعة (مثال: ضبط المؤقت ليعمل تلقائياً)
    const matchEndTime = new Date('2026-06-11T21:30:00Z'); 
    const delay = matchEndTime - new Date();

    if (delay > 0) {
        setTimeout(async () => {
            console.log('🤖 جاري معالجة وتوزيع جوائز التوقعات لمباراة الافتتاح تلقائياً...');
            
            // نفترض أن النتيجة الحقيقية لمباراة الافتتاح انتهت بفوز المكسيك 2 - 1 على كندا
            const correctResult = "2-1"; 

            // جلب روم الأخبار لإعلان الفائزين
            const guildsConfig = db.prepare('SELECT * FROM config').all();
            
            // جلب الأعضاء أصحاب التوقع الصحيح من قاعدة البيانات
            const winners = db.prepare('SELECT userId FROM predictions WHERE prediction = ?').all(correctResult);

            for (const conf of guildsConfig) {
                try {
                    const channel = await client.channels.fetch(conf.newsChannelId);
                    if (!channel) continue;

                    let winnersMentions = winners.map(w => `<@${w.userId}>`).join(', ');
                    if (!winnersMentions) winnersMentions = "لا يوجد أحد توقع النتيجة بدقة 😔";

                    // توزيع النقاط تلقائياً على أصحاب التوقع الصحيح
                    winners.forEach(w => {
                        db.prepare('UPDATE users SET points = points + 3 WHERE userId = ?').run(w.userId);
                    });

                    const resultEmbed = new EmbedBuilder()
                        .setTitle('🚨 انتهت المباراة! النتيجة الرسمية وجوائز التوقعات 🔮')
                        .setDescription(`⚽ **مباراة الافتتاح:** المكسيك **2 - 1** كندا\n\n🥇 **الأعضاء العباقرة الذين توقعوا النتيجة الصحيحة ونالوا +3 نقاط كافية:**\n${winnersMentions}`)
                        .setColor(0xF1C40F)
                        .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png');

                    await channel.send({ embeds: [resultEmbed] });
                } catch (err) {
                    console.error('خطأ أثناء إرسال النتيجة التلقائية لسيرفر محدد:', err);
                }
            }
        }, delay);
    }
}

client.login(process.env.TOKEN);
