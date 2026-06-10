/**
 * Bot Version: 3.5
 * Developer: ta_im1
 * Team: TRL for development
 */

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Footer للمطورين
const footer = { text: "Developement: ta_im1 | Team: TRL for development" };

// 1. نظام لعبة الأعلام (3x3)
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    // منطق التحقق من اختيار العلم
    if (interaction.customId.startsWith('flag_')) {
        const isCorrect = interaction.customId === 'flag_brazil'; // مثال: العلم الصحيح
        if (isCorrect) {
            await interaction.reply({ content: '✅ إجابة صحيحة!', ephemeral: true });
            // إرسال تنبيه خاص عند كسب نقطة
            try {
                await interaction.user.send(`🎉 مبروك! لقد حصلت على نقطة جديدة في اللعبة. رصيدك الآن محدث.`);
            } catch (e) { console.log('Could not DM user'); }
        } else {
            await interaction.reply({ content: '❌ إجابة خاطئة، حاول مرة أخرى.', ephemeral: true });
        }
    }
});

// 2. نظام الرسائل الخاصة (DM System)
// أمر للإداريين فقط لإرسال DM للجميع
client.on('messageCreate', async message => {
    if (message.content.startsWith('/dm-all') && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const text = message.content.replace('/dm-all', '');
        message.guild.members.cache.forEach(member => {
            if (!member.user.bot) {
                member.send(text).catch(console.error);
            }
        });
        message.reply('تم إرسال الرسالة الخاصة لجميع الأعضاء.');
    }
});

client.login(process.env.TOKEN);
