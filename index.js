const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const commandsList = require('./commands.js'); // استدعاء الأوامر

// ---------------- [ سيرفر ريندر الوهمي ] ----------------
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('FROM TRL TEAM™ Bot is Online! 🚀'));
app.listen(PORT, () => console.log(`🌐 السيرفر الوهمي يعمل على منفذ: ${PORT}`));
// --------------------------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = '+';

client.once('ready', () => {
    console.log(`✅ تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return; // يتجاهل البوتات والرسائل بدون +

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. أمر +help
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📚 قائمة مساعدة FROM TRL TEAM™')
            .setDescription('يرجى اختيار القسم الذي تريد استعراضه من خلال الأزرار أدناه:');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_owner').setLabel('👑 أوامر الأونر').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('help_public').setLabel('👥 الأوامر العامة').setStyle(ButtonStyle.Primary)
        );

        return message.reply({ embeds: [helpEmbed], components: [row] });
    }

    // 2. أمر +info المطور الخاص بك
    if (command === 'info') {
        const infoEmbed = new EmbedBuilder()
            .setColor('#00F0FF')
            .setTitle('👑 الملف الشخصي والمعلومات الأساسية')
            .setDescription('**الاسم:** تيم (Taim)\n**المسمى التقني:** مؤسس وقائد فريق TRL.dev (Lead Developer)\n**البريد الإلكتروني:** hacked909h@gmail.com')
            .addFields(
                { 
                    name: '🚀 المهارات والقدرات التقنية', 
                    value: '• تطوير وبرمجة بوتات منصة Discord و Twitch\n• تصميم وتطوير مواقع الويب والتطبيقات (HTML, CSS, JavaScript)\n• تطوير وبناء الألعاب الرقمية\n• إتقان لغات البرمجة: Python, JavaScript\n• أدوات التطوير: GitHub, Google AI Studio' 
                },
                { 
                    name: '📁 المشاريع والإنجازات (تحت مظلة TRL.dev)', 
                    value: '• **بوتات إدارة الخوادم:** حماية وأنظمة تحقق فورية وتيكتات.\n• **بوت كأس العالم:** متابعة وجدولة المباريات وتزويد النتائج تلقائياً.\n• **RTR Bot:** بناء وتطوير البوت الخاص بالفريق وتحديث ميزاته باستمرار.\n• **لوحات التحكم (Dashboards):** تصميم لوحات ويب لربط وإدارة البوتات بسهولة.' 
                }
            )
            .setFooter({ text: 'FROM TRL TEAM™', iconURL: client.user.displayAvatarURL() });

        return message.reply({ embeds: [infoEmbed] });
    }
});

// التفاعل مع الأزرار في الـ help
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'help_owner') {
        let ownerFields = commandsList.owner.map(cmd => ({ name: cmd.name, value: cmd.desc }));
        
        // تقسيم الـ Fields لشرائح إذا كانت كثيرة (الحد الأقصى للـ Embed هو 25 حقل)
        const ownerEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('👑 أوامر الأونر (المطور)')
            .addFields(ownerFields.slice(0, 25)); // يعرض أول 25 أمر كحد أقصى للـ Embed الواحد

        await interaction.update({ embeds: [ownerEmbed] });
    }

    if (interaction.customId === 'help_public') {
        let publicFields = commandsList.public.map(cmd => ({ name: cmd.name, value: cmd.desc }));

        const publicEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('👥 الأوامر العامة (للجميع)')
            .addFields(publicFields);

        await interaction.update({ embeds: [publicEmbed] });
    }
});

client.login(process.env.DISCORD_TOKEN);
