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
const { createCanvas, loadImage } = require('@napi-rs/canvas'); 

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Gold Shop Bot Active!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server connected`));

// ==================== إعداد وتوصيل قاعدة بيانات MongoDB السحابية ====================
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

// جدول لحفظ قنوات الترحيب والمغادرة والإمبد بالداتابيس للأبد دون انقطاع
const GuildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    welcomeChannels: { type: [String], default: [] },
    byeChannels: { type: [String], default: [] },
    embedChannels: { type: [String], default: [] }
});
const GuildConfig = mongoose.model('GuildConfig', GuildConfigSchema);
// ====================================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

const tempSetup = new Map();
const dmSetup = new Map();

const TICKET_SETUP_PREFIX = '-st'; 
const DM_BROADCAST_PREFIX = '-t';   
const WELCOME_SETUP_PREFIX = '+wel';
const BYE_SETUP_PREFIX = '+Bye';
const EMBED_MESSAGE_SETUP_PREFIX = '+em'; 

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const EMBED_FOOTER_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1521977140227211477/1521980487764148435/lv_0_.png?ex=6a46ce49&is=6a457cc9&hm=a629b2a4de8b6b23f5bc18eed10214224000ad8ac7ecd930ef81191177f81363&';

client.once('ready', async () => {
    console.log(`Gold Shop Bot Online as ${client.user.tag}`);
});

// دالة رسم البطاقة الذهبية الفخمة للأعضاء برمجياً (ترحيب ومغادرة)
async function generateGoldCard(member, title, subtitle, countText) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const goldGrad = ctx.createLinearGradient(0, 0, 700, 250);
    goldGrad.addColorStop(0, '#bf953f');
    goldGrad.addColorStop(0.25, '#fcf6ba');
    goldGrad.addColorStop(0.5, '#b38728');
    goldGrad.addColorStop(0.75, '#fbf5b7');
    goldGrad.addColorStop(1, '#aa771c');

    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 8;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    ctx.fillStyle = goldGrad;
    ctx.font = 'bold 36px Arial';
    ctx.fillText(title, 250, 95);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial';
    ctx.fillText(member.user.username, 250, 140);

    ctx.fillStyle = '#8e8e8e';
    ctx.font = '16px Arial';
    ctx.fillText(subtitle, 250, 180);

    ctx.fillStyle = goldGrad;
    ctx.font = 'bold 18px Arial';
    ctx.fillText(countText, 250, 215);

    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarImage = await loadImage(avatarUrl);

        ctx.save();
        ctx.beginPath();
        ctx.arc(125, 125, 64, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImage, 61, 61, 128, 128);
        ctx.restore();

        ctx.strokeStyle = goldGrad;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(125, 125, 64, 0, Math.PI * 2, true);
        ctx.stroke();
    } catch (e) {
        ctx.fillStyle = goldGrad;
        ctx.beginPath();
        ctx.arc(125, 125, 64, 0, Math.PI * 2, true);
        ctx.fill();
    }

    return canvas.toBuffer('image/png');
}

// قراءة دخول الأعضاء (الترحيب الذهبي في رومات متعددة من الداتابيس)
client.on('guildMemberAdd', async member => {
    try {
        const config = await GuildConfig.findOne({ guildId: member.guild.id });
        if (config && config.welcomeChannels.length > 0) {
            const imageBuffer = await generateGoldCard(member, 'Gold shop', 'GS • منور دخولك سيرفر', `Member #${member.guild.memberCount}`);
            
            config.welcomeChannels.forEach(async (channelId) => {
                const welcomeChannel = member.guild.channels.cache.get(channelId);
                if (welcomeChannel) {
                    await welcomeChannel.send({
                        content: `👋 منورررر يا ${member} سيرفر **Gold shop**، لا تنسى تقرأ القوانين وكل شيء! ✨`,
                        files: [{ attachment: imageBuffer, name: 'welcome-gold.png' }]
                    }).catch(() => {});
                }
            });
        }
    } catch (err) {
        console.error(err);
    }
});

// قراءة مغادرة الأعضاء (التوديع الذهبي في رومات متعددة من الداتابيس)
client.on('guildMemberRemove', async member => {
    try {
        const config = await GuildConfig.findOne({ guildId: member.guild.id });
        if (config && config.byeChannels.length > 0) {
            const imageBuffer = await generateGoldCard(member, 'GOOD BYE', 'GS • نتمنى لك التوفيق دائماً', `Members remaining: ${member.guild.memberCount}`);
            
            config.byeChannels.forEach(async (channelId) => {
                const byeChannel = member.guild.channels.cache.get(channelId);
                if (byeChannel) {
                    await byeChannel.send({
                        content: `📤 غادرنا العضو **${member.user.username}** من سيرفر **Gold shop**...`,
                        files: [{ attachment: imageBuffer, name: 'bye-gold.png' }]
                    }).catch(() => {});
                }
            });
        }
    } catch (err) {
        console.error(err);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();
    const isOwner = message.member.permissions.has(PermissionFlagsBits.Administrator) || message.member.roles.cache.some(r => r.name === 'Ownerv');

    // جلب وحفظ قنوات الإمبد من الداتابيس لتفادي لغ الردود التلقائية
    let config = await GuildConfig.findOne({ guildId: message.guild.id });
    if (!config) {
        config = await GuildConfig.create({ guildId: message.guild.id });
    }

    // ==================== ميزة الـ Auto-Embed التفاعلية للروم المخصصة المتعددة ====================
    if (config.embedChannels.includes(message.channel.id)) {
        try {
            const userMessageText = message.content;
            await message.delete().catch(() => {});
            await message.channel.send(`💖 شكراً لك يا ${message.author} على مشاركتك الممتازة في القناة!`);

            const embed = new EmbedBuilder()
                .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                .setDescription(userMessageText || 'مشاركة فنية')
                .setColor('#bf953f') 
                .setImage(EMBED_FOOTER_IMAGE_URL)
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Error on Auto-Embed execution:', err);
        }
        return;
    }
    // =========================================================================================

    // 1. إعداد وتحديد روم إمبد تفاعلي إضافي وحفظه بالداتابيس (+em [#روم-المنشورات])
    if (content.startsWith(EMBED_MESSAGE_SETUP_PREFIX)) {
        if (!isOwner) return;
        const channelMention = message.mentions.channels.first();
        if (!channelMention) return message.reply('❌ يرجى منشن روم المنشورات المخصص لتفعيله (مثال: `+em #روم-الصور`):');

        await GuildConfig.findOneAndUpdate(
            { guildId: message.guild.id },
            { $addToSet: { embedChannels: channelMention.id } },
            { upsert: true }
        );

        await message.reply(`✅ **تم بنجاح إضافة قناة المنشورات التلقائية المخصصة بـ الداتابيس: ${channelMention}**`);
        await message.delete().catch(() => {});
        return;
    }

    // 2. إعداد قنوات الترحيب المتعددة وحفظها بالداتابيس للأبد (+wel)
    if (content.startsWith(WELCOME_SETUP_PREFIX)) {
        if (!isOwner) return;
        const channelMention = message.mentions.channels.first();
        if (!channelMention) return message.reply('❌ يرجى منشن القناة لإضافتها لقائمة الترحيب (مثال: `+wel #روم-الترحيب`):');
        
        await GuildConfig.findOneAndUpdate(
            { guildId: message.guild.id },
            { $addToSet: { welcomeChannels: channelMention.id } },
            { upsert: true }
        );

        await message.reply(`✅ **تم بنجاح ربط وحفظ قناة الترحيب بالداتابيس: ${channelMention}**`);
        await message.delete().catch(() => {});
        return;
    }

    // 3. إعداد قنوات المغادرة المتعددة وحفظها بالداتابيس للأبد (+Bye)
    if (content.startsWith(BYE_SETUP_PREFIX)) {
        if (!isOwner) return;
        const channelMention = message.mentions.channels.first();
        if (!channelMention) return message.reply('❌ يرجى منشن القناة لإضافتها لقائمة المغادرة (مثال: `+Bye #روم-المغادرة`):');
        
        await GuildConfig.findOneAndUpdate(
            { guildId: message.guild.id },
            { $addToSet: { byeChannels: channelMention.id } },
            { upsert: true }
        );

        await message.reply(`✅ **تم بنجاح ربط وحفظ قناة المغادرة بالداتابيس: ${channelMention}**`);
        await message.delete().catch(() => {});
        return;
    }

    // 4. الإعداد التفاعلي لبوكس التذاكر بالسؤال والمسح (-st)
    if (content === TICKET_SETUP_PREFIX) {
        if (!isOwner) return;

        const setupState = { step: 'get_button_label', title: null, description: null, buttonLabel: null, roleId: null, messagesToDelete: [] };
        tempSetup.set(message.author.id, setupState);

        const prompt = await message.channel.send(`${message.author}, ⚙ **بدء إعداد نظام التذاكر التفاعلي**\n\nيرجى كتابة **النص المكتوب على الزر** (مثال: فتح تذكرة):`);
        setupState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    if (tempSetup.has(message.author.id)) {
        const state = tempSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 'get_button_label') {
            state.buttonLabel = message.content.trim();
            state.step = 'get_title';
            const nextPrompt = await message.reply('✅ تم حفظ نص الزر.\n\nيرجى كتابة **عنوان البوكس (Title)**:');
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_title') {
            state.title = message.content.trim();
            state.step = 'get_desc';
            const nextPrompt = await message.reply('✅ تم حفظ العنوان.\n\nيرجى كتابة **الوصف والشرح** للبوكس:');
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_desc') {
            state.description = message.content.trim();
            state.step = 'get_role';
            const nextPrompt = await message.reply('✅ تم حفظ الوصف.\n\nيرجى كتابة **أيدي الرتبة (Role ID)** المسؤولة عن استلام التذاكر:');
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_role') {
            const roleId = message.content.trim();
            const role = message.guild.roles.cache.get(roleId);
            if (!role) {
                const errPrompt = await message.reply('❌ الرتبة غير موجودة. يرجى كتابة أيدي رتبة صحيح:');
                state.messagesToDelete.push(errPrompt.id);
                return;
            }

            state.roleId = roleId;

            const embed = new EmbedBuilder()
                .setTitle(state.title)
                .setDescription(state.description)
                .setColor('#bf953f'); 

            const openButton = new ButtonBuilder()
                .setCustomId(`open_gold_ticket_${state.roleId}`)
                .setLabel(state.buttonLabel)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫');

            const row = new ActionRowBuilder().addComponents(openButton);

            await message.channel.send({ embeds: [embed], components: [row] });

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            tempSetup.delete(message.author.id);
            return;
        }
    }

    // 5. البرودكاست الخاص فائق السرعة والآمن بالمنشن (متصل أولاً ثم أوفلاين) (+t)
    if (content === DM_BROADCAST_PREFIX) {
        if (!isOwner) return;

        const broadcastState = { step: 1, title: null, description: null, imageUrl: null, messagesToDelete: [] };
        dmSetup.set(message.author.id, broadcastState);

        const prompt = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست الخاص المطور (أونلاين أولاً)**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان** رسالة البرودكاست:`);
        broadcastState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    if (dmSetup.has(message.author.id)) {
        const state = dmSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 1) {
            state.title = message.content.trim();
            state.step = 2;
            const prompt2 = await message.reply(`✅ تم حفظ العنوان.\n\n**الخطوة [2/3]:** يرجى كتابة **الوصف (محتوى الرسالة)**:`);
            state.messagesToDelete.push(prompt2.id);
            return;
        }

        if (state.step === 2) {
            state.description = message.content.trim();
            state.step = 3;
            const prompt3 = await message.reply(`✅ تم حفظ الوصف.\n\n**الخطوة [3/3] الأخيرة:** ضع رابط صورة للرسالة (أو اكتب \`لا\` للإلغاء):`);
            state.messagesToDelete.push(prompt3.id);
            return;
        }

        if (state.step === 3) {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا' && input.startsWith('http')) {
                state.imageUrl = input;
            } else {
                state.imageUrl = null;
            }

            const statusMsg = await message.channel.send('⏳ **جاري بدء عملية البرودكاست التدريجي والآمن مع الإشارة للعضو (أونلاين أولاً)...**');

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            const members = await message.guild.members.fetch({ withPresences: true });
            const allMembers = Array.from(members.values()).filter(m => !m.user.bot);

            const onlineMembers = allMembers.filter(m => m.presence && m.presence.status !== 'offline');
            const offlineMembers = allMembers.filter(m => !m.presence || m.presence.status === 'offline');

            const sortedMembers = [...onlineMembers, ...offlineMembers];

            let sentCount = 0;
            let failedCount = 0;
            let index = 0;

            const interval = setInterval(async () => {
                if (index >= sortedMembers.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتمل البرودكاست بنجاح!**\n\n📬 تم الإرسال إلى: \`${sentCount}\` عضو.\n❌ فشل الإرسال لـ: \`${failedCount}\` عضو.`);
                    return;
                }

                const targetMember = sortedMembers[index];
                
                const personalEmbed = new EmbedBuilder()
                    .setTitle(state.title)
                    .setDescription(`👋 مرحباً بك يا ${targetMember}!\n\n${state.description}`)
                    .setColor('#bf953f')
                    .setTimestamp();

                if (state.imageUrl) {
                    personalEmbed.setImage(state.imageUrl);
                }

                try {
                    await targetMember.send({ embeds: [personalEmbed] });
                    sentCount++;
                } catch (err) {
                    failedCount++;
                }

                const progressType = index < onlineMembers.length ? '🟢 جاري إرسال المتصلين (Online)' : '⚫ جاري إرسال غير المتصلين (Offline)';
                await statusMsg.edit(`⏳ **${progressType}...**\n\n📊 التقدم الحالي: \`${index + 1}/${sortedMembers.length}\` عضو.\n✅ تم الإرسال: \`${sentCount}\` | ❌ فشل: \`${failedCount}\``);
                index++;
            }, 2500); 

            dmSetup.delete(message.author.id);
            return;
        }
    }
});

// التعامل الذكي مع التفاعلات والأزرار لمنع الـ Lag
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const guild = interaction.guild;
    const member = interaction.member;

    // أ- تفاعل زر فتح التذكرة
    if (customId.startsWith('open_gold_ticket_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetRoleId = customId.replace('open_gold_ticket_', '');

        const existingChannel = guild.channels.cache.find(c => c.name.startsWith('ticket-') && c.name.endsWith(member.user.username));
        if (existingChannel) {
            return interaction.editReply({ content: `❌ لا يمكنك فتح تذكرة جديدة؛ لأن لديك تذكرة مفتوحة بالفعل وهي: ${existingChannel}` });
        }

        const permissionOverwrites = [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ];

        if (targetRoleId && targetRoleId !== 'none') {
            permissionOverwrites.push({
                id: targetRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            });
        }

        try {
            const channel = await guild.channels.create({
                name: `ticket-${member.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: permissionOverwrites
            });

            await channel.setTopic(`creator_id:${member.id}`);

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('بوابة المساعدة الفنية والخدمات | Ticket Open')
                .setDescription(`تفضل يا ${member}، كيف يمكننا مساعدتك اليوم؟ يرجى كتابة استفسارك بوضوح بداخل الشات لمساعدتك.`)
                .setColor('#bf953f')
                .setTimestamp();

            const claimButton = new ButtonBuilder()
                .setCustomId(`claim_gold_ticket_${targetRoleId}`)
                .setLabel('استلام التكت')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🙋‍♂️');

            const closeButton = new ButtonBuilder()
                .setCustomId(`close_gold_ticket_${targetRoleId}`)
                .setLabel('إغلاق التكت')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

            await channel.send({ content: `${member}`, embeds: [welcomeEmbed], components: [row] });
            await interaction.editReply({ content: `تم فتح تذكرتك بنجاح بداخل الروم: ${channel}` });

        } catch (err) {
            console.error(err);
            await interaction.editReply({ content: '❌ حدث خطأ غير متوقع أثناء محاولة إنشاء التذكرة.' });
        }
    }

    // ب- تفاعل زر استلام التكت
    if (customId.startsWith('claim_gold_ticket_')) {
        const targetRoleId = customId.replace('claim_gold_ticket_', '');
        const hasRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);

        if (!hasRole) {
            return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المخصصة للتحكم فيها!', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferUpdate();

        const topic = interaction.channel.topic || '';
        const creatorId = topic.split('creator_id:')[1]?.split(';')[0] || '';
        await interaction.channel.setTopic(`creator_id:${creatorId};claimed_by:${member.id};claimer_name:${member.user.username}`);

        const oldEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(oldEmbed)
            .addFields({ name: 'المشرف المستلم', value: `👤 تم الاستلام بواسطة: ${member}` });

        const disabledClaimButton = new ButtonBuilder()
            .setCustomId('claimed_disabled_btn')
            .setLabel(`مستلمة بواسطة ${member.user.username}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const closeButton = new ButtonBuilder()
            .setCustomId(`close_gold_ticket_${targetRoleId}`)
            .setLabel('إغلاق التكت')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

        const row = new ActionRowBuilder().addComponents(disabledClaimButton, closeButton);
        await interaction.editReply({ embeds: [updatedEmbed], components: [row] });

        const creatorMention = creatorId ? `<@${creatorId}>` : '';
        await interaction.followUp({ content: `${creatorMention} **تم استلام تكت عن طريق هذا الإدارة: ${member}، تابع معه.**` });
    }

    // ج- تفاعل زر إغلاق التكت
    if (customId.startsWith('close_gold_ticket_')) {
        const targetRoleId = customId.replace('close_gold_ticket_', '');
        const topic = interaction.channel.topic || '';
        const isClaimer = topic.includes(`claimed_by:${member.id}`);
        const hasSupportRole = member.roles.cache.has(targetRoleId);
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isClaimer && !hasSupportRole && !isAdmin) {
            return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط للمشرف المستلم أو الإدارة العليا.', flags: MessageFlags.Ephemeral });
        }

        await interaction.reply({ content: '⚠️ سيتم حذف وإغلاق هذه التذكرة صامتاً خلال 5 ثوانٍ...' });
        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 5000);
    }
});

client.login(TOKEN);