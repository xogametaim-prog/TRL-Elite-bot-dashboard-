/**
 * Bot Version: 9.0.0v (Pure UNO Engine Test Edition)
 * Developer: ta_im1 | Team: TRL for development
 * Platform: Optimized for Mobile (Pydroid 3 / Replit)
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('UNO Engine Test is Active! 🃏'));
app.listen(process.env.PORT || 10000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// مصفوفة كروت الأونو الأساسية (ألوان وأرقام)
const CARD_COLORS = ['🔴 أحمر', '🔵 أزرق', '🟢 أخضر', '🟡 أصفر'];
const CARD_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function generateDeck() {
    let deck = [];
    for (let color of CARD_COLORS) {
        for (let value of CARD_VALUES) {
            deck.push({ color, value, label: `${color} [${value}]` });
            if (value !== '0') deck.push({ color, value, label: `${color} [${value}]` }); // تكرار الكروت مثل الأونو الحقيقية
        }
    }
    return deck.sort(() => 0.5 - Math.random());
}

// تخزين بيانات جولة الأونو الحالية
let unoGame = null;

client.once('ready', async () => {
    console.log(`[SYSTEM] UNO Test Bot Online!`);
    const commands = [
        new SlashCommandBuilder().setName('uno').setDescription('بدء لعبة أونو الكلاسيكية بالأزرار والرسائل المخفية')
            .addUserOption(opt => opt.setName('friend').setDescription('منشن صديقك لتحديه (اتركه فارغاً للعب ضد البوت)'))
    ].map(cmd => cmd.toJSON());
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (e) { console.error(e); }
});

// ⚡ الاختصار النصي .uno لتشغيل اللعبة فوراً دون أوامر مائلة
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.trim().toLowerCase() === '.uno') {
        if (unoGame) return message.channel.send('⚠️ هناك جيم أونو شغال حالياً في السيرفر!');
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('uno_start_bot').setLabel('🤖 لعب ضد البوت').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('uno_cancel_game').setLabel('❌ إلغاء').setStyle(ButtonStyle.Danger)
        );

        await message.channel.send({
            embeds: [new EmbedBuilder().setTitle('🃏 تحدي الأونو الأسطوري').setDescription('اختر نمط اللعب الحين باستخدام الأزرار بالأسفل:').setColor(0x5865F2)],
            components: [row]
        ]);
    }
});

// 🎮 إدارة لوجيك ولعب الأونو بالأزرار المخفية والتلقائية
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'uno') {
        if (unoGame) return interaction.reply({ content: '⚠️ هناك جيم أونو شغال حالياً!', ephemeral: true });
        const friend = interaction.options.getUser('friend');

        if (!friend) {
            // نمط البوت تلقائياً
            setupUnoMatch(interaction.channel, interaction.user, null);
            return interaction.reply({ content: '🤖 جاري تجهيز طاولة الأونو ضد البوت...', ephemeral: true });
        } else {
            // تحدي صديق
            if (friend.id === interaction.user.id) return interaction.reply({ content: '❌ ما تقدر تتحدى نفسك يا بطل!', ephemeral: true });
            
            unoGame = { isWaiting: true, challenger: interaction.user, target: friend, channelId: interaction.channel.id };
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('uno_accept_friend').setLabel('✅ موافقة ودخول').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('uno_cancel_game').setLabel('❌ رفض وإلغاء').setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({
                content: `⚔️ يا <@${friend.id}>! اللاعب <@${interaction.user.id}> يتحداك في جيم أونو حامي! هل تقبل التحدي؟`,
                components: [row]
            });
        }
    }

    if (!interaction.isButton()) return;

    // التعامل مع أزرار القبول والإلغاء العامة
    if (interaction.customId === 'uno_start_bot') {
        await interaction.deferUpdate();
        setupUnoMatch(interaction.channel, interaction.user, null);
    }

    if (interaction.customId === 'uno_accept_friend') {
        if (!unoGame || interaction.user.id !== unoGame.target.id) {
            return interaction.reply({ content: '❌ هذا الزر مو لك! الشخص الممّنشن هو اللي يضغط فقط.', ephemeral: true });
        }
        await interaction.deferUpdate();
        setupUnoMatch(interaction.channel, unoGame.challenger, unoGame.target);
    }

    if (interaction.customId === 'uno_cancel_game') {
        unoGame = null;
        return interaction.update({ content: '❌ تم إلغاء وإنهاء اللعبة بنجاح.', embeds: [], components: [] });
    }

    // --- [ الطريقة السحرية: فتح لوحة الكروت المخفية للاعب ] ---
    if (interaction.customId === 'uno_show_my_cards') {
        if (!unoGame) return interaction.reply({ content: '❌ الجيم انتهى أو غير موجود حالياً.', ephemeral: true });
        
        const isP1 = interaction.user.id === unoGame.p1.id;
        const isP2 = unoGame.p2 && interaction.user.id === unoGame.p2.id;

        if (!isP1 && !isP2) return interaction.reply({ content: '❌ أنت مجرد مشجع الحين! انتظر الجيم القادم لتلعب.', ephemeral: true });

        const playerObj = isP1 ? unoGame.p1 : unoGame.p2;
        
        // إنشاء أزرار الكروت الخاصة باللاعب فقط (مخفية Ephemeral)
        const rows = [];
        let currentRow = new ActionRowBuilder();

        playerObj.cards.forEach((card, idx) => {
            if (idx > 0 && idx % 4 === 0) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
            
            // تفعيل الزر فقط إذا كان كرت اللاعب يطابق اللون أو الرقم بالساحة + يكون دوره هو الحالي
            const canPlay = (unoGame.turn === playerObj.id) && (card.color === unoGame.topCard.color || card.value === unoGame.topCard.value);
            
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`uno_playcard_${idx}`)
                    .setLabel(card.label)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!canPlay)
            );
        });

        if (currentRow.components.length > 0 && rows.length < 4) {
            if (currentRow.components.length < 5) {
                currentRow.addComponents(new ButtonBuilder().setCustomId('uno_draw_card').setLabel('📥 سحب كرت جديد').setStyle(ButtonStyle.Danger).setDisabled(unoGame.turn !== playerObj.id));
            }
            rows.push(currentRow);
        }

        return interaction.reply({
            content: `🃏 **هذه كروتك السرية الحالية (لا يراها خصمك):**\nالكرت الموجود بالأرض الحين هو: **${unoGame.topCard.label}**\n${unoGame.turn === playerObj.id ? '🟢 **دورك الحين! العب كرت مناسب.**' : '🔴 انتظر دور خصمك الحين..'}`,
            components: rows,
            ephemeral: true
        });
    }

    // --- [ لعب كرت من الرسالة المخفية ] ---
    if (interaction.customId.startsWith('uno_playcard_')) {
        const cardIndex = parseInt(interaction.customId.replace('uno_playcard_', ''));
        const isP1 = interaction.user.id === unoGame.p1.id;
        const playerObj = isP1 ? unoGame.p1 : unoGame.p2;

        if (unoGame.turn !== playerObj.id) return interaction.reply({ content: '❌ انتظر دورك يا غالي!', ephemeral: true });

        const playedCard = playerObj.cards[cardIndex];
        
        // التحقق من صلاحية الكرت تأكيداً
        if (playedCard.color === unoGame.topCard.color || playedCard.value === unoGame.topCard.value) {
            playerObj.cards.splice(cardIndex, 1); // إزالة الكرت من يد اللاعب
            unoGame.topCard = playedCard; // تحديث كرت الأرض

            // فحص الفوز فوراً
            if (playerObj.cards.length === 0) {
                await interaction.channel.send(`🎉 **🏆 انتصار ساحق! الفائز في مباراة الأونو هو: <@${playerObj.id}>!! كفووو مبروك!** 🥳`);
                unoGame = null;
                return;
            }

            await interaction.reply({ content: `✅ لعبت كرت: ${playedCard.label}`, ephemeral: true });
            
            // تبديل الأدوار وتفعيل ذكاء البوت لو الطور ضد البوت
            if (unoGame.isVsBot) {
                unoGame.turn = 'bot';
                await updateMainGameBoard(interaction.channel);
                setTimeout(() => handleBotTurn(interaction.channel), 2000); // البوت يلعب تلقائياً بعد ثانيتين وما يوقف!
            } else {
                unoGame.turn = (unoGame.turn === unoGame.p1.id) ? unoGame.p2.id : unoGame.p1.id;
                await updateMainGameBoard(interaction.channel);
            }
        } else {
            return interaction.reply({ content: '❌ الكرت غير مطابق للون أو رقم كرت الساحة الحالي!', ephemeral: true });
        }
    }

    // --- [ زر سحب كرت جديد ] ---
    if (interaction.customId === 'uno_draw_card') {
        const isP1 = interaction.user.id === unoGame.p1.id;
        const playerObj = isP1 ? unoGame.p1 : unoGame.p2;

        if (unoGame.turn !== playerObj.id) return interaction.reply({ content: '❌ مو دورك الحين عشان تسحب كرت!', ephemeral: true });

        if (unoGame.deck.length === 0) unoGame.deck = generateDeck();
        const pulled = unoGame.deck.pop();
        playerObj.cards.push(pulled);

        await interaction.reply({ content: `📥 سحبت كرت جديد على يدك: **${pulled.label}**`, ephemeral: true });

        // تمرير الدور تلقائياً بعد السحب
        if (unoGame.isVsBot) {
            unoGame.turn = 'bot';
            await updateMainGameBoard(interaction.channel);
            setTimeout(() => handleBotTurn(interaction.channel), 2000);
        } else {
            unoGame.turn = (unoGame.turn === unoGame.p1.id) ? unoGame.p2.id : unoGame.p1.id;
            await updateMainGameBoard(interaction.channel);
        }
    }
});

// بناء وتجهيز الجيم بشكل حقيقي وكامل
function setupUnoMatch(channel, challenger, friendObj) {
    const deck = generateDeck();
    
    unoGame = {
        deck: deck,
        topCard: deck.pop(),
        isVsBot: friendObj === null,
        turn: challenger.id,
        p1: { id: challenger.id, username: challenger.username, cards: [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()] },
        p2: friendObj ? { id: friendObj.id, username: friendObj.username, cards: [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()] } 
                     : { id: 'bot', username: 'الروبوت الذكي 🤖', cards: [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()] }
    };

    // حماية كرت الساحة الأساسي ليكون كرت طبيعي سليم
    while (unoGame.topCard.value === '0') {
        unoGame.deck.unshift(unoGame.topCard);
        unoGame.topCard = unoGame.deck.pop();
    }

    sendNewGameBoard(channel);
}

// إرسال اللوحة الرئيسية للعبة في الشات العام
async function sendNewGameBoard(channel) {
    const mainEmbed = new EmbedBuilder()
        .setTitle('🃏 طاولة أونو التفاعلية الحية')
        .setDescription(`🔴 **الكرت الحالي في الساحة هو:**\n✨ **${unoGame.topCard.label}** ✨\n\n` +
                        `🟢 **الدور الحالي عند:** <@${unoGame.turn === 'bot' ? client.user.id : unoGame.turn}>\n\n` +
                        `📊 **عدد الكروت المتبقية:**\n` +
                        `• اللاعب <@${unoGame.p1.id}>: \`[ ${unoGame.p1.cards.length} كروت ]\`\n` +
                        `• ${unoGame.isVsBot ? 'الروبوت 🤖' : `الخصم <@${unoGame.p2.id}>`}: \`[ ${unoGame.p2.cards.length} كروت ]\``)
        .setColor(0xF39C12)
        .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png') // الخلفية الأسطورية الفخمة الثابتة بالإمبيد لتعطي شكل نار
        .setFooter({ text: 'اضغط على زر "عرض كروتي" لتظهر لك كروتك السرية واللعب سرياً' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('uno_show_my_cards').setLabel('🃏 عرض كروتي وسحب / لعب').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('uno_cancel_game').setLabel('🛑 إنهاء الجيم').setStyle(ButtonStyle.Danger)
    );

    unoGame.mainMsg = await channel.send({ embeds: [mainEmbed], components: [row] });
}

// تحديث الإمبيد العام تلقائياً فوراً وراء كل حركة وتغيير الكرت الحالي
async function updateMainGameBoard(channel) {
    if (!unoGame || !unoGame.mainMsg) return;

    const editEmbed = new EmbedBuilder()
        .setTitle('🃏 طاولة أونو التفاعلية الحية')
        .setDescription(`🔴 **الكرت الحالي في الساحة هو:**\n✨ **${unoGame.topCard.label}** ✨\n\n` +
                        `🟢 **الدور الحالي عند:** ${unoGame.turn === 'bot' ? '🤖 الروبوت الذكي' : `<@${unoGame.turn}>`}\n\n` +
                        `📊 **عدد الكروت المتبقية:**\n` +
                        `• اللاعب <@${unoGame.p1.id}>: \`[ ${unoGame.p1.cards.length} كروت ]\`\n` +
                        `• ${unoGame.isVsBot ? 'الروبوت 🤖' : `الخصم <@${unoGame.p2.id}>`}: \`[ ${unoGame.p2.cards.length} كروت ]\``)
        .setColor(0xF39C12)
        .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png')
        .setFooter({ text: 'اضغط على زر "عرض كروتي" لتظهر لك كروتك السرية واللعب سرياً' });

    try {
        await unoGame.mainMsg.edit({ embeds: [editEmbed] });
    } catch (err) { console.log("Error shifting frames"); }
}

// --- [ ذكاء اصطناعي كامل لتشغيل ولعب كرت البوت تلقائياً دون وقوف ] ---
async function handleBotTurn(channel) {
    if (!unoGame || unoGame.turn !== 'bot') return;

    const botCards = unoGame.p2.cards;
    // البحث عن كرت متوافق مع الأرض في يد البوت الحالية
    const matchIndex = botCards.findIndex(c => c.color === unoGame.topCard.color || c.value === unoGame.topCard.value);

    if (matchIndex !== -1) {
        const botPlayed = botCards[matchIndex];
        botCards.splice(matchIndex, 1);
        unoGame.topCard = botPlayed;

        await channel.send(`🤖 **الروبوت الذكي لعب كرت:** ${botPlayed.label}`);

        if (botCards.length === 0) {
            await channel.send('🤖 **يا للحسرة! هاردلك.. الروبوت الذكي أنهى كروته بالكامل وفاز بالجيم! 🏆**');
            unoGame = null; return;
        }

        unoGame.turn = unoGame.p1.id; // إرجاع الدور لك
        await updateMainGameBoard(channel);
    } else {
        // إذا لم يجد البوت كرت، يسحب تلقائياً من السلة ويكمل اللعب
        if (unoGame.deck.length === 0) unoGame.deck = generateDeck();
        const pulled = unoGame.deck.pop();
        botCards.push(pulled);

        await channel.send('🤖 **الروبوت ما عنده كرت مطابق، سحب كرت جديد من السلة ومرر الدور تلقائياً!**');
        
        unoGame.turn = unoGame.p1.id; // إرجاع الدور لك
        await updateMainGameBoard(channel);
    }
}

client.login(process.env.TOKEN);
