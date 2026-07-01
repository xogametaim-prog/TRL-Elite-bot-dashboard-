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

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Running!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server connected`));

// إعداد كائن البوت أولاً لضمان سلامة الترتيب البرمجي ومنع الـ ReferenceError
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

// لتخزين القنوات المحددة للترحيب والمغادرة وقنوات الإمبد التفاعلية المتعددة
const welcomeChannels = new Set();
const byeChannels = new Set();
const embedTargetChannelIds = new Set(); 

// الأوامر المعتمدة بالبريفكس الإيجابي (+) والسلبي (-)
const TICKET_SETUP_PREFIX = '-st'; 
const DM_BROADCAST_PREFIX = '-t';   
const WELCOME_SETUP_PREFIX = '+wel';
const BYE_SETUP_PREFIX = '+Bye';
const EMBED_MESSAGE_SETUP_PREFIX = '+em'; 

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// الصورة الفخمة المطلوب إرفاقها تلقائياً أسفل منشورات الإمبد
const EMBED_FOOTER_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1521977140227211477/1521980487764148435/lv_0_.png?ex=6a46ce49&is=6a457cc9&hm=a629b2a4de8b6b23f5bc18eed10214224000ad8ac7ecd930ef81191177f81363&';

client.once('ready', async () => {
    console.log(`Verify & Broadcast Bot is Online as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();
    const isAuthorized = message.member.permissions.has(PermissionFlagsBits.Administrator) || message.member.roles.cache.some(r => r.name === 'Ownerv');

    // ==================== ميزة الـ Auto-Embed التفاعلية للروم المخصصة المتعددة ====================
    if (embedTargetChannelIds.has(message.channel.id)) {
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

    if (content.startsWith(EMBED_MESSAGE_SETUP_PREFIX)) {
        if (!isAuthorized) return;
        const channelMention = message.mentions.channels.first();
        if (!channelMention) return message.reply('❌ يرجى منشن روم المنشورات المخصص لتفعيله (مثال: `+em #روم-الصور`):');

        embedTargetChannelIds.add(channelMention.id);
        await message.reply(`✅ **تم بنجاح إضافة قناة المنشورات التلقائية المخصصة: ${channelMention}**`);
        await message.delete().catch(() => {});
        return;
    }

    if (content.startsWith(WELCOME_SETUP_PREFIX)) {
        if (!isAuthorized) return;
        const channelMention = message.mentions.channels.first();
        if (!channelMention) return message.reply('❌ يرجى منشن القناة لإضافتها لقائمة الترحيب (مثال: `+wel #روم-الترحيب`):');
        
        welcomeChannels.add(channelMention.id);
        await message.reply(`✅ **تم بنجاح إضافة قناة الترحيب: ${channelMention}**`);
        await message.delete().catch(() => {});
        return;
    }

    if (content.startsWith(BYE_SETUP_PREFIX)) {
        if (!isAuthorized) return;
        const channelMention = message.mentions.channels.first();
        if (!channelMention) return message.reply('❌ يرجى منشن القناة لإضافتها لقائمة المغادرة (مثال: `+Bye #روم-المغادرة`):');
        
        byeChannels.add(channelMention.id);
        await message.reply(`✅ **تم بنجاح إضافة قناة المغادرة: ${channelMention}**`);
        await message.delete().catch(() => {});
        return;
    }

    // الاختصار -st لبدء الإعداد التفاعلي لبوكس التكت المتعدد مع المسح التلقائي للأسئلة
    if (content === TICKET_SETUP_PREFIX) {
        if (!isAuthorized) return;

        const setupState = { 
            step: 'get_count',
            optionsCount: 0,
            currentOptionIndex: 0,
            options: [], 
            imageUrl: null,
            categoryId: null,
            messagesToDelete: [] 
        };
        tempSetup.set(message.author.id, setupState);

        const prompt = await message.channel.send(`${message.author}, ⚙️ **بدء إعداد بوكس تذاكر مخصص بالكامل**\n\n**الخطوة [1]:** كم عدد الأقسام (الخيارات) التي تريد وضعها في هذا البوكس؟ (اكتب رقماً من **1 إلى 10**):`);
        setupState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    // تتبع خطوات إعداد بوكس التذاكر المتعدد -st ومسح جميع رسائل الأسئلة عند الانتهاء
    if (tempSetup.has(message.author.id)) {
        const state = tempSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 'get_count') {
            const count = parseInt(message.content.trim());
            if (isNaN(count) || count < 1 || count > 10) {
                const errPrompt = await message.reply('❌ يرجى كتابة رقم صحيح من 1 إلى 10 فقط:');
                state.messagesToDelete.push(errPrompt.id);
                return;
            }
            state.optionsCount = count;
            state.currentOptionIndex = 0;
            state.step = 'get_option_label';
            const nextPrompt = await message.reply(`✅ تم تحديد عدد الأقسام: **${count}**\n\n💬 **الآن لنبدأ بتجهيز القسم رقم [1]**:\nيرجى كتابة **اسم المربع / الخيار**:`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_option_label') {
            const label = message.content.trim();
            state.options.push({ label: label, roleId: null, description: null, value: `opt_${state.currentOptionIndex + 1}` });
            state.step = 'get_option_desc';
            const nextPrompt = await message.reply(`✅ تم حفظ اسم القسم: **${label}**\n\n📝 يرجى كتابة **الشرح/الوصف** الذي تريده أن يظهر كشرح فرعي لهذا القسم:`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_option_desc') {
            const desc = message.content.trim();
            state.options[state.currentOptionIndex].description = desc;
            state.step = 'get_option_role';
            const nextPrompt = await message.reply(`✅ تم حفظ الوصف.\n\n👤 يرجى كتابة **أيدي الرتبة (Role ID)** المسؤولة عن تذاكر هذا القسم:`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_option_role') {
            const roleId = message.content.trim();
            const role = message.guild.roles.cache.get(roleId);
            if (!role) {
                const errPrompt = await message.reply('❌ أيدي الرتبة غير صحيح. يرجى كتابة أيدي رتبة صحيح وموجود بالسيرفر:');
                state.messagesToDelete.push(errPrompt.id);
                return;
            }

            state.options[state.currentOptionIndex].roleId = roleId;
            state.currentOptionIndex++;

            if (state.currentOptionIndex < state.optionsCount) {
                state.step = 'get_option_label';
                const nextPrompt = await message.reply(`✅ تم ربط الرتبة **${role.name}** بالقسم السابق.\n\n💬 **لننتقل للقسم رقم [${state.currentOptionIndex + 1}]**:\nيرجى كتابة **اسم المربع / الخيار**:`);
                state.messagesToDelete.push(nextPrompt.id);
                return;
            } else {
                state.step = 'get_image';
                const nextPrompt = await message.reply(`✅ تم الانتهاء من إعداد جميع الأقسام بنجاح!\n\n🖼 يرجى وضع **رابط الصورة (Image URL)** للبوكس الرئيسي (إذا كنت لا تريد صورة اكتب: \`لا\`):`);
                state.messagesToDelete.push(nextPrompt.id);
                return;
            }
        }

        if (state.step === 'get_image') {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا' && input.startsWith('http')) {
                state.imageUrl = input;
            } else {
                state.imageUrl = null;
            }
            state.step = 'get_category';
            const nextPrompt = await message.reply(`✅ تم حفظ إعدادات الصورة.\n\n📂 يرجى كتابة **أيدي القسم (Category ID)** الذي تفتح فيه التذاكر (إذا كنت تريدها تفتح في أي مكان اكتب: \`لا\`):`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_category') {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا') {
                state.categoryId = input;
            } else {
                state.categoryId = null;
            }

            const embed = new EmbedBuilder()
                .setTitle('بوابة الدعم الفني والمساعدات | Support Portal')
                .setDescription(`يرجى تحديد القسم المناسب لمشكلتك من القائمة المنسدلة أدناه لفتح تذكرة مباشرة مع الطاقم المختص ومتابعتك.`)
                .setColor('#2b2d31');

            if (state.imageUrl) {
                embed.setImage(state.imageUrl);
            }

            const uniqueId = Date.now().toString().slice(-4);
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`multi_t_menu_${uniqueId}_${state.categoryId || 'none'}`)
                .setPlaceholder('الرجاء اختيار قسم لفتح التذكرة...');

            state.options.forEach(opt => {
                selectMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setValue(`opaction_${opt.roleId}`) 
                        .setLabel(opt.label)
                        .setDescription(opt.description || `تذكرة بقسم ${opt.label}`)
                        .setEmoji('🎫')
                );
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.channel.send({ embeds: [embed], components: [row] });
            
            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            tempSetup.delete(message.author.id);
        }
    }

    // البرودكاست الخاص فائق السرعة والآمن بالكامل لتجنب الباند (-dm) - يسأل هل تود المنشن أم لا
    if (content === DM_BROADCAST_PREFIX) {
        if (!isAuthorized) return;

        const broadcastState = { step: 1, title: null, description: null, imageUrl: null, messagesToDelete: [] };
        dmSetup.set(message.author.id, broadcastState);

        const prompt = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست الخاص الذكي مع المنشن (أونلاين أولاً)**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان** رسالة البرودكاست:`);
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
                    .setColor('#5865F2')
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

client.login(TOKEN);