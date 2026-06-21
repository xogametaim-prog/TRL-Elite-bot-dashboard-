const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// إنشاء الكلاينت مع الصلاحيات الأساسية
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
});

// تعريف أوامر الـ Slash
const commands = [
    new SlashCommandBuilder()
        .setName('game')
        .setDescription('لعبة رمي العملة (ملك أم كتابة)'),
    
    new SlashCommandBuilder()
        .setName('color')
        .setDescription('تغيير لون اسمك باستخدام كود Hex')
        .addStringOption(option => 
            option.setName('hex')
                .setDescription('كود اللون (مثال: #ff0000)')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('حظر عضو من السيرفر')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('العضو المراد حظره')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
];

// تسجيل الأوامر تلقائياً عند تشغيل البوت
client.once('ready', async () => {
    console.log(`تم تشغيل البوت: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('تم تسجيل أوامر الـ Slash بنجاح.');
    } catch (error) {
        console.error('خطأ في تسجيل الأوامر:', error);
    }
});

// معالجة الأوامر التفاعلية
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    // 1. أمر اللعبة (Game)
    if (commandName === 'game') {
        const choices = ['🪙 ملك (Heads)', '🪙 كتابة (Tails)'];
        const result = choices[Math.floor(Math.random() * choices.length)];
        return interaction.reply(`النتيجة هي: **${result}**`);
    }

    // 2. أمر الألوان (Color)
    if (commandName === 'color') {
        const hex = options.getString('hex');
        
        // التحقق من صحة كود اللون المدخل
        if (!hex.startsWith('#') || hex.length !== 7) {
            return interaction.reply({ content: 'الرجاء إدخال كود لون صحيح يبدأ بـ #. مثال: `#ff0000`', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // البحث عن الرتبة أو إنشاؤها إن لم تكن موجودة
            let role = interaction.guild.roles.cache.find(r => r.name === `color-${hex}`);
            if (!role) {
                role = await interaction.guild.roles.create({
                    name: `color-${hex}`,
                    color: hex,
                    reason: 'تخصيص لون الاسم من البوت'
                });
            }

            // إزالة رتب الألوان القديمة التي تبدأ بـ "color-" لتفادي تراكم الرتب على المستخدم
            const oldColorRoles = interaction.member.roles.cache.filter(r => r.name.startsWith('color-'));
            for (const [id, r] of oldColorRoles) {
                await interaction.member.roles.remove(r);
            }

            // إعطاء الرتبة الجديدة للعضو
            await interaction.member.roles.add(role);
            return interaction.editReply(`تم تغيير لون اسمك إلى **${hex}** بنجاح!`);
        } catch (err) {
            console.error(err);
            return interaction.editReply('حدث خطأ أثناء محاولة تعديل اللون. يرجى التأكد من أن رتبة البوت أعلى من رتب الألوان في قائمة الرتب.');
        }
    }

    // 3. أمر البان (Ban)
    if (commandName === 'ban') {
        const user = options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return interaction.reply({ content: 'العضو غير موجود في هذا السيرفر.', ephemeral: true });
        }

        if (!member.bannable) {
            return interaction.reply({ content: 'لا يمكنني حظر هذا العضو، رتبته أعلى مني أو لا أملك الصلاحيات الكافية.', ephemeral: true });
        }

        try {
            await member.ban({ reason: `تم الحظر بواسطة ${interaction.user.tag}` });
            return interaction.reply(`تم حظر العضو **${user.tag}** بنجاح.`);
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: 'فشل حظر العضو بسبب خطأ داخلي.', ephemeral: true });
        }
    }
});

// تسجيل الدخول عبر توكن البوت المخزن في متغيرات البيئة
client.login(process.env.DISCORD_TOKEN);