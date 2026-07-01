const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    REST,
    Routes,
    PermissionFlagsBits,
    Events,
    ChannelType,
    MessageFlags
} = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ==================== إعداد وتوصيل قاعدة بيانات MongoDB ====================
const MONGO_URI = process.env.MONGO_URI; 

mongoose.connect(MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(err => console.error('Failed to connect to MongoDB:', err));

const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    username: { type: String },
    guildId: { type: String }
});

const VerifiedUser = mongoose.model('VerifiedUser', UserSchema);
// ====================================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// الاختصارات والأوامر البرمجية
const PREFIX = '-';
const DELETE_CHANNELS_PREFIX = '-dch'; // حذف كل الرومات
const ADD_CHANNEL_PREFIX = '-ach';      // إنشاء روم مخصص

const OWNER_ID = '1459567453251309639'; // أيدي المالك الحصري المسموح له بالتحكم بالأوامر

client.once(Events.ClientReady, async () => {
    console.log(`Verify & Broadcast Bot is Online as ${client.user.tag}`);
});

app.get('/', (req, res) => res.send('System is active!'));

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // 1. ميزة حذف جميع رومات السيرفر بالكامل صامتاً وبأقصى سرعة (-dch)
    if (content === DELETE_CHANNELS_PREFIX) {
        // التحقق من صلاحيات الأونر الحصرية
        if (message.author.id !== OWNER_ID) return;

        const statusMsg = await message.reply('⏳ **جاري حذف وتصفية جميع قنوات ورومات وتصنيفات السيرفر بالكامل يرجى الانتظار ثوانٍ معدودة...**');

        try {
            message.guild.channels.cache.forEach(async (chan) => {
                // استبعاد الروم الحالي الذي نكتب فيه الأمر مؤقتاً لكي لا تنقطع المحادثة والتقرير
                if (chan.id !== message.channel.id) {
                    await chan.delete().catch(() => {});
                }
            });

            setTimeout(async () => {
                await statusMsg.edit('✅ **تم بنجاح حذف وتصفية جميع رومات وقنوات وتصنيفات السيرفر بالكامل صامتاً وبنجاح تام!**');
            }, 3000);
        } catch (err) {
            console.error(err);
        }
        return;
    }

    // 2. ميزة إنشاء روم نصي مخصص ديناميكياً بداخل نفس الكاتيجوري الحالي (-ach [اسم الروم])
    if (content.startsWith(ADD_CHANNEL_PREFIX)) {
        if (message.author.id !== OWNER_ID) return;

        const roomName = content.slice(ADD_CHANNEL_PREFIX.length).trim();
        if (!roomName) {
            return message.reply('❌ يرجى كتابة اسم الروم النصي المراد إنشاؤه (مثال: `-ach chat-players`):');
        }

        try {
            const currentChannel = message.channel;

            const newChannel = await message.guild.channels.create({
                name: roomName,
                type: ChannelType.GuildText,
                parent: currentChannel.parentId || null, // ربط الروم تلقائياً بالتصنيف (Category) المفتوح فيه الروم الحالي
                reason: `Auto-created by owner: ${message.author.tag}`
            });

            await message.reply(`✅ **تم بنجاح إنشاء القناة النصية المخصصة الجديدة بداخل نفس التصنيف:** ${newChannel}`);
            await message.delete().catch(() => {});
        } catch (err) {
            console.error(err);
            message.reply('❌ حدث خطأ غير متوقع أثناء محاولة إنشاء القناة، تأكد من إعطاء البوت صلاحيات إدارية كافية.');
        }
        return;
    }
});

client.login(process.env.TOKEN);