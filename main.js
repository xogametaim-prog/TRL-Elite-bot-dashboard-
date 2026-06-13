const { Client, GatewayIntentBits, PermissionsBitField, ChannelType, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http');

// السيرفر الوهمي عشان ريندر
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Cloner Bot is running!');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT);

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildExpressions
    ] 
});

const OWNER_ID = '1515394889855275281'; // 🔒 قفل الأمان حقك

// 🛠️ 1. تعريف أمر السلاش وتجهيز الخيارات (IDs السيرفرات)
const commands = [
    new SlashCommandBuilder()
        .setName('clone')
        .setDescription('نسخ الرومات، الرتب، والإيموجيات من سيرفر إلى سيرفر آخر')
        .addStringOption(option => 
            option.setName('source')
                .setDescription('ضع ID السيرفر القديم (المصدر)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('target')
                .setDescription('ضع ID السيرفر الجديد (الهدف) - اترك فارغاً للسيرفر الحالي')
                .setRequired(false))
].map(command => command.toJSON());

// 🚀 2. تسجيل أمر السلاش تلقائياً في الديسكورد عند التشغيل
client.on('ready', async () => {
    console.log(`تم تشغيل بوت النسخ بنجاح: ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('جاري تسجيل أوامر السلاش...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('تم تسجيل أمر /clone بنجاح وجاهز للاستخدام!');
    } catch (error) {
        console.error('خطأ في تسجيل الأوامر:', error);
    }
});

// ⚡ 3. استقبال وتنفيذ أمر السلاش
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({ content: '❌ هذا الأمر مخصص لصاحب البوت السرّي فقط!', ephemeral: true });
    }

    const { commandName, options } = interaction;

    if (commandName === 'clone') {
        const sourceId = options.getString('source');
        const targetId = options.getString('target') || interaction.guildId;

        // جلب السيرفرات والتأكد أن البوت موجود فيها
        const sourceGuild = client.guilds.cache.get(sourceId);
        const targetGuild = client.guilds.cache.get(targetId);

        if (!sourceGuild || !targetGuild) {
            return interaction.reply({ content: '❌ لم أستطع العثور على السيرفرات. تأكد أنني موجود في السيرفرين ومضاف كـ Administrator!', ephemeral: true });
        }

        // الرد الأولي عشان الديسكورد ما يعطي Timeout (الأمر ياخذ وقت)
        await interaction.reply({ content: '⏳ جاري بدء عملية النسخ الشاملة... انتظر ثواني والتفت لسيرفرك الجديد وهو يعمر!', ephemeral: true });

        try {
            // === [ أولاً: نسخ الرتب Roles ] ===
            const sourceRoles = await sourceGuild.roles.fetch();
            // ترتيب الرتب عشان تنزل صح
            const sortedRoles = sourceRoles.sort((a, b) => a.position - b.position);
            
            for (const [id, role] of sortedRoles) {
                if (role.managed || role.id === sourceGuild.id) continue; // تخطي رتب البوتات ورتبة @everyone
                
                // التأكد إذا الرتبة موجودة مسبقاً بنفس الاسم عشان ما يكررها
                const existingRole = targetGuild.roles.cache.find(r => r.name === role.name);
                if (!existingRole) {
                    try {
                        await targetGuild.roles.create({
                            name: role.name,
                            color: role.color,
                            hoist: role.hoist,
                            permissions: role.permissions,
                            mentionable: role.mentionable
                        });
                        await new Promise(resolve => setTimeout(resolve, 800));
                    } catch (e) {}
                }
            }

            // === [ ثانياً: نسخ الفئات والرومات Channels & Categories ] ===
            const sourceChannels = await sourceGuild.channels.fetch();
            
            // 1. نسخ الفئات (Categories) أولاً وتخزين الـ IDs الجديدة لها
            const categoriesMap = new Map();
            const categories = sourceChannels.filter(c => c.type === ChannelType.GuildCategory);
            
            for (const [id, category] of categories) {
                try {
                    const newCategory = await targetGuild.channels.create({
                        name: category.name,
                        type: ChannelType.GuildCategory,
                        permissionOverwrites: category.permissionOverwrites.cache.map(p => ({
                            id: targetGuild.roles.cache.find(r => r.name === sourceGuild.roles.cache.get(p.id)?.name)?.id || targetGuild.id,
                            allow: p.allow,
                            deny: p.deny,
                            type: p.type
                        }))
                    });
                    categoriesMap.set(category.id, newCategory.id);
                    await new Promise(resolve => setTimeout(resolve, 800));
                } catch (e) {}
            }

            // 2. نسخ الرومات (الكتابية والصوتية) وربطها بالفئات الجديدة
            const textAndVoiceChannels = sourceChannels.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice);
            
            for (const [id, channel] of textAndVoiceChannels) {
                try {
                    await targetGuild.channels.create({
                        name: channel.name,
                        type: channel.type,
                        topic: channel.topic,
                        parent: channel.parentId ? categoriesMap.get(channel.parentId) : null,
                        permissionOverwrites: channel.permissionOverwrites.cache.map(p => ({
                            id: targetGuild.roles.cache.find(r => r.name === sourceGuild.roles.cache.get(p.id)?.name)?.id || targetGuild.id,
                            allow: p.allow,
                            deny: p.deny,
                            type: p.type
                        }))
                    });
                    await new Promise(resolve => setTimeout(resolve, 800));
                } catch (e) {}
            }

            // === [ ثالثاً: نسخ الإيموجيات Emojis ] ===
            const sourceEmojis = await sourceGuild.emojis.fetch();
            for (const [id, emoji] of sourceEmojis) {
                const existingEmoji = targetGuild.emojis.cache.find(e => e.name === emoji.name);
                if (!existingEmoji) {
                    try {
                        await targetGuild.emojis.create({ attachment: emoji.url, name: emoji.name });
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (e) {}
                }
            }

            // تعديل الرسالة بعد الانتهاء
            await interaction.followUp({ content: '✅ مبروك يا زعيم! تم نسخ كل شيء بنجاح (رتب، رومات، فئات، إيموجيات). سيرفرك الجديد صار نسخة طبق الأصل!', ephemeral: true });

        } catch (error) {
            console.error(error);
            await interaction.followUp({ content: '❌ حدثت مشكلة أثناء النسخ، تأكد من صلاحيات البوت وترتيب رتبته.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
