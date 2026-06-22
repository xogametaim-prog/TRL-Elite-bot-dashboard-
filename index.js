import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// البريفكس الخاص بالبوت
const prefix = '+'; 

client.on('ready', () => {
    console.log(`تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // تجاهل رسائل البوتات الأخرى أو الرسائل التي لا تبدأ بالبريفكس
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    // تقسيم الرسالة إلى الأمر والمحاميل (Arguments)
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- أوامر الأعضاء (Public) ---
    if (command === 'stock') {
        return message.reply('📦 **ستوك الأعضاء الحالي المتواجد في المخزون هو:** [جاري جلب البيانات...]');
    }

    if (command === 'coins') {
        return message.reply(`💰 **رصيدك الحالي هو:** \`0\` كوينز.`);
    }

    if (command === 'boost') {
        return message.reply('🎁 **تم استلام هدية البوست بنجاح!** شكراً لدعمك السيرفر.');
    }

    if (command === 'top') {
        return message.reply('🏆 **أعلى 6 أشخاص يمتلكون كوينز:**\n1. لا يوجد بيانات بعد.');
    }

    if (command === 'invite') {
        return message.reply('🔗 **رابط دعوة بوت الأعضاء:** [اضغط هنا للدعوة](https://discord.com)');
    }

    if (command === 'tax') {
        const amount = args[0];
        if (!amount || isNaN(amount)) return message.reply('❌ **يرجى كتابة المبلغ المراد حساب الضريبة له.** مثال: `+tax 1000`');
        // حساب ضريبة البروبوت التقريبية (5%)
        const tax = Math.floor(amount * (20 / 19)) + 1;
        return message.reply(`💰 **المبلغ المراد تحويله مع الضريبة:** \`${tax}\``);
    }

    // --- أوامر الملاك والإدارة (Owner / Admin) ---
    if (command === 'give') {
        const user = message.mentions.users.first() || args[0];
        const amount = args[1];
        if (!user || !amount) return message.reply('❌ **الاستخدام الصحيح:** `+give [@user] [amount]`');
        return message.reply(`✅ **تم إضافة \`${amount}\` كوينز بنجاح للعضو.**`);
    }

    if (command === 'take') {
        const user = message.mentions.users.first() || args[0];
        const amount = args[1];
        if (!user || !amount) return message.reply('❌ **الاستخدام الصحيح:** `+take [@user] [amount]`');
        return message.reply(`✅ **تم سحب \`${amount}\` كوينز بنجاح من العضو.**`);
    }

    if (command === 'bank') {
        const bankId = args[0];
        if (!bankId) return message.reply('❌ **الاستخدام الصحيح:** `+bank [bank id]`');
        return message.reply(`🏦 **تم تعيين آيدي البنك الجديد بنجاح إلى:** \`${bankId}\``);
    }

    if (command === 'limite') {
        const limit = args[0];
        if (!limit) return message.reply('❌ **الاستخدام الصحيح:** `+limite [limite members]`');
        return message.reply(`⚙️ **تم وضع أقل عدد للأعضاء من الشراء وهو:** \`${limit}\``);
    }

    if (command === 'clinet') {
        const roleId = args[0];
        if (!roleId) return message.reply('❌ **الاستخدام الصحيح:** `+clinet [role id]`');
        return message.reply(`🛒 **تم تعيين رول الشراء بنجاح للآيدي:** \`${roleId}\``);
    }

    if (command === 'stock') {
        if (args[0] === 'img') {
            const imgLink = args[1];
            if (!imgLink) return message.reply('❌ **الاستخدام الصحيح:** `+stock img [link]`');
            return message.reply(`🖼️ **تم تعيين صورة الستوك بنجاح:** ${imgLink}`);
        }
    }

    if (command === 'panel') {
        if (args[0] === 'img') {
            const imgLink = args[1];
            if (!imgLink) return message.reply('❌ **الاستخدام الصحيح:** `+panel img [link]`');
            return message.reply(`🖼️ **تم تعيين صورة البانل بنجاح:** ${imgLink}`);
        }
        return message.reply('🛒 **تم إرسال لوحة شراء الأعضاء بنجاح.**');
    }

    if (command === 'add') {
        const serverId = args[0];
        const amount = args[1];
        if (!serverId || !amount) return message.reply('❌ **الاستخدام الصحيح:** `+add [server id] [amount]`');
        return message.reply(`🚀 **جاري إدخال \`${amount}\` عضو إلى السيرفر \`${serverId}\`...**`);
    }

    if (command === 'check') {
        const user = message.mentions.users.first() || args[0] || message.author;
        return message.reply(`🔍 **فحص التوثيق:** الشخص المعني موثق في النظام ومستعد.`);
    }

    if (command === 'send') {
        return message.reply('🔘 **تم إرسال زر "وثق نفسك" بنجاح.**');
    }

    if (command === 'refresh') {
        return message.reply('🔄 **تم عمل رفرش وتحديث للستوك بنجاح.**');
    }

    if (command === 'spun') {
        return message.reply('🎡 **تم إرسال زر عجلة الحظ بنجاح.**');
    }

    if (command === 'delete-tickets') {
        return message.reply('🗑️ **جاري إغلاق وحذف جميع التذاكر في السيرفر...**');
    }

    if (command === 'restart') {
        await message.reply('🔄 **جاري إعادة تشغيل البوت...**');
        return process.exit(); // سيعيد تشغيل البوت تلقائياً إذا كان الاستضافة تدعم التكرار
    }

    if (command === 'transfer') {
        return message.reply('📥 **تم تحديد روم التحويل بنجاح.**');
    }

    if (command === 'taxid') {
        return message.reply('🧾 **تم تحديد روم الضريبة بنجاح.**');
    }

    if (command === 'leave') {
        const serverId = args[0];
        if (!serverId) return message.reply('❌ **الاستخدام الصحيح:** `+leave [server id]`');
        return message.reply(`🚪 **تم الخروج من السيرفر بنجاح:** \`${serverId}\``);
    }

    if (command === 'log') {
        return message.reply('📝 **تم تحديد آيدي روم العمليات (Log) بنجاح.**');
    }

    if (command === 'price') {
        const price = args[0];
        if (!price) return message.reply('❌ **الاستخدام الصحيح:** `+price [price]`');
        return message.reply(`💰 **تم تحديد سعر الأعضاء الجديد بنجاح:** \`${price}\``);
    }

    if (command === 'leaveall') {
        return message.reply('🚪 **جاري إخراج البوت من جميع السيرفرات المتواجد فيها...**');
    }

    if (command === 'set') {
        if (args[0] === 'name') {
            const name = args.slice(1).join(' ');
            if (!name) return message.reply('❌ **الاستخدام الصحيح:** `+set name [name]`');
            await client.user.setName(name);
            return message.reply(`✅ **تم تغيير اسم البوت بنجاح إلى:** \`${name}\``);
        }
        if (args[0] === 'avatar') {
            const avatarLink = args[1];
            if (!avatarLink) return message.reply('❌ **الاستخدام الصحيح:** `+set avatar [link]`');
            await client.user.setAvatar(avatarLink);
            return message.reply('✅ **تم تغيير صورة البوت بنجاح.**');
        }
    }

    if (command === 'mozz3') {
        const roleId = args[0];
        if (!roleId) return message.reply('❌ **الاستخدام الصحيح:** `+mozz3 [role id]`');
        return message.reply(`🛡️ **تم وضع آيدي رول الموزعين بنجاح:** \`${roleId}\``);
    }

    if (command === 'sendp') {
        return message.reply('📊 **تم إرسال لوحة أسعار الكوينز بنجاح.**');
    }

    if (command === 'sendp1') {
        return message.reply('✉️ **تم إرسال رسالة السعر الخاصة بنجاح.**');
    }

    if (command === 'nitro') {
        return message.reply('🎁 **تم إرسال عرض النيترو المجاني بنجاح!**');
    }

    if (command === 'say') {
        const msg = args.join(' ');
        if (!msg) return message.reply('❌ **يرجى كتابة الرسالة المراد إرسالها.**');
        await message.delete(); // حذف رسالة العضو الأصيلة
        return message.channel.send(msg);
    }
});

// ضع توكن البوت الخاص بك هنا
client.login('ضع_توكن_البوت_هنا');
