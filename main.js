const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, REST } = require('discord.js');
const express = require('express');
const { getAIResponseWithMemory } = require('./gemini.js'); // استدعاء الملف الجديد

// تشغيل سيرفر الويب المساعد عشان موقع Render يظل شغال 24 ساعة
const app = express();
app.get('/', (req, res) => res.send('Gangster Bot Ready with Gemini 1.5-Flash!'));
app.listen(process.env.PORT || 3000, () => console.log('سيرفر الويب المساعد يعمل بنجاح.'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// تعريف الأوامر (Giveaway & Guess Game)
const commands = [
    new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('إنشاء سحب جديد / Create a new giveaway')
        .addStringOption(opt => opt.setName('prize').setDescription('الجائزة / Prize').setRequired(true))
        .addIntegerOption(opt => opt.setName('duration').setDescription('المدة بالثواني / Duration in seconds').setRequired(true))
        .addStringOption(opt => opt.setName('lang').setDescription('اللغة / Language').setRequired(true).addChoices(
            { name: 'العربية', value: 'ar' },
            { name: 'English', value: 'en' }
        )),
    new SlashCommandBuilder()
        .setName('guess_game')
        .setDescription('لعبة تخمين الرقم مع البوتات الوهمية / Guess the number game')
];

client.once('ready', async () => {
    console.log(`تم تشغيل البوت بنجاح باسم: ${client.user.tag}!`);
    const rest = new REST({ version: '10' }).setToken(client.token);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('تم تسجيل أوامر السلاش بنجاح.');
    } catch (error) {
        console.error(error);
    }
});

// نظام الرد بالذكاء الاصطناعي الذكي (عند المنشن أو في روم ai-chat)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
    const isAiChannel = message.channel.name === 'ai-chat';

    if (isMentioned || isAiChannel) {
        await message.channel.sendTyping(); // إظهار حركة "البوت يكتب..." الحماسية
        
        // تنظيف الرسالة من منشن البوت عشان يفهمها الذكاء الاصطناعي بشكل صحيح
        const cleanMessage = message.content.replace(`<@${client.user.id}>`, '').trim();
        if (!cleanMessage) return message.reply("نعم يا غالي؟ اسألني أي شيء!");

        // جلب الرد من ملف جيميناي المطور بناءً على الـ ID الخاص بالعضو لمنع التداخل والخراب
        const responseText = await getAIResponseWithMemory(message.author.id, cleanMessage);

        if (responseText.length > 2000) {
            await message.reply(responseText.substring(0, 1990) + "...");
        } else {
            await message.reply(responseText);
        }
    }
});

// تشغيل أوامر السلاش (Giveaway & Guess Game)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // كود القيف أوي المصلّح لمنع مشاكل الكاش
    if (interaction.commandName === 'giveaway') {
        const prize = interaction.options.getString('prize');
        const duration = interaction.options.getInteger('duration');
        const lang = interaction.options.getString('lang');

        const embedTitle = lang === 'ar' ? '🎉 سحب جديد!' : '🎉 New Giveaway!';
        const embedDesc = lang === 'ar' 
            ? `الجائزة: **${prize}**\nاضغط على التفاعل 🎉 للمشاركة!\nالمدة: ${duration} ثانية.`
            : `Prize: **${prize}**\nReact with 🎉 to enter!\nDuration: ${duration} seconds.`;

        await interaction.reply({ content: lang === 'ar' ? 'تم بدء السحب!' : 'Giveaway started!', ephemeral: true });
        
        const gmsg = await interaction.channel.send({
            embeds: [{ title: embedTitle, description: embedDesc, color: 0x00ff00 }]
        });
        await gmsg.react('🎉');

        setTimeout(async () => {
            try {
                const targetMessage = await interaction.channel.messages.fetch(gmsg.id);
                const reaction = targetMessage.reactions.cache.get('🎉');
                if (!reaction) return interaction.channel.send(lang === 'ar' ? '❌ تم إلغاء السحب لعدم وجود تفاعلات.' : '❌ Giveaway cancelled.');

                const users = await reaction.users.fetch();
                const candidates = users.filter(u => !u.bot).map(u => u.id);

                if (candidates.length === 0) return interaction.channel.send(lang === 'ar' ? '❌ لم يشارك أحد.' : '❌ No one entered.');

                const winnerId = candidates[Math.floor(Math.random() * candidates.length)];
                
                if (lang === 'ar') {
                    await interaction.channel.send(`مبروك 🎉 لقد فزت في سحب: **${prize}**! <@${winnerId}>`);
                } else {
                    await interaction.channel.send(`Congratulations 🎉 You won the giveaway for: **${prize}**! <@${winnerId}>`);
                }
            } catch (err) {
                console.error(err);
            }
        }, duration * 1000);
    }

    // لعبة التخمين بالبوتات الوهمية
    if (interaction.commandName === 'guess_game') {
        const secretHN = Math.floor(Math.random() * 100) + 1;
        await interaction.reply({ content: '🎮 بدأت لعبة تخمين الرقم من 1 إلى 100! اكتبوا تخميناتكم بالشات الآن (لديك دقيقة واحدة).' });

        const fakeBots = ['Gamer_Bot🤖', 'AI_Player🤖', 'Gangster_Pro🤖'];
        let gameActive = true;

        const collector = interaction.channel.createMessageCollector({ time: 60000 });

        const fakeInterval = setInterval(() => {
            if (!gameActive) return clearInterval(fakeInterval);
            
            const randomBot = fakeBots[Math.floor(Math.random() * fakeBots.length)];
            const botGuess = Math.floor(Math.random() * 100) + 1;

            interaction.channel.send(`**[${randomBot}]** يخمن: ${botGuess}`);

            if (botGuess === secretHN) {
                gameActive = false;
                clearInterval(fakeInterval);
                collector.stop();
                return interaction.channel.send(`🚨 خطفها البوت! الفائز هو **${randomBot}** خمن الرقم [**${secretHN}**] بنجاح!`);
            }
        }, 10000);

        collector.on('collect', (m) => {
            if (m.author.bot || !gameActive) return;
            const userGuess = parseInt(m.content);
            
            if (userGuess === secretHN) {
                gameActive = false;
                clearInterval(fakeInterval);
                collector.stop();
                return m.reply(`🎉 كفوووو! مبروك الفوز خمنت الرقم الصحيح [**${secretHN}**] بنجاح!`);
            }
        });

        collector.on('end', () => {
            if (gameActive) {
                gameActive = false;
                clearInterval(fakeInterval);
                interaction.channel.send(`⏱️ انتهى الوقت! الرقم الصحيح كان: [**${secretHN}**].`);
            }
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
