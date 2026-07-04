const express = require('express');
const session = require('express-session');
const axios = require('axios');
const fs = require('fs');
const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-dashboard-key-gold-123',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000 // مدة حفظ الجلسة 7 أيام متواصلة لمنع التحقق المكرر
  }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function normalizeArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

// دالة ذكية لفحص وتصفية الإيموجي وتفادي أخطاء الـ Discord API
function parseAndValidateEmoji(emojiInput) {
  if (!emojiInput || typeof emojiInput !== 'string') return null;
  const trimmed = emojiInput.trim();
  if (!trimmed) return null;

  // 1. التقاط إيموجي ديسكورد المخصص واستخلاص المعرف الرقمي ID الصافي
  const customEmojiRegex = /^<a?:([a-zA-Z0-9_~]+):(\d+)>$/;
  const matchCustom = trimmed.match(customEmojiRegex);
  if (matchCustom) {
    return matchCustom[2];
  }

  // 2. التحقق مما إذا كان المدخل عبارة عن ID رقمي صافي
  const numericRegex = /^\d+$/;
  if (numericRegex.test(trimmed)) {
    return trimmed;
  }

  // 3. التحقق من وجود رمز تعبيري Unicode قياسي لضمان عدم تمرير نصوص عادية
  const unicodeEmojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
  if (unicodeEmojiRegex.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function startDashboard(client) {
  app.client = client;
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    console.log(`[DASHBOARD] Web Server running on port ${PORT}`);
  });

  function checkAuth(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
  }

  function checkGuildAdmin(req, res, next) {
    if (!req.session.user || !req.session.guilds) {
      return res.redirect('/login');
    }
    const guildId = req.params.guildId;
    const sessionGuild = req.session.guilds.find(g => g.id === guildId);
    
    if (!sessionGuild) {
      return res.send("❌ ليس لديك صلاحية للوصول إلى هذا السيرفر أو أنك لست عضواً فيه.");
    }

    const is_admin = (parseInt(sessionGuild.permissions) & 0x8) === 0x8;
    if (!is_admin) {
      return res.send("❌ خطأ صلاحية: هذه اللوحة مخصصة للأعضاء الذين يملكون صلاحية Administrator فقط في هذا السيرفر.");
    }
    next();
  }

  app.get('/login', (req, res) => {
    if (req.session.user) {
      return res.redirect('/dashboard');
    }
    const redirectUri = encodeURIComponent(process.env.CALLBACK_URL);
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;
    res.redirect(discordAuthUrl);
  });

  app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send("فشل تسجيل الدخول: رمز التحقق مفقود.");

    try {
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.CALLBACK_URL,
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token } = tokenResponse.data;

      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      req.session.user = userResponse.data;
      req.session.guilds = guildsResponse.data;

      res.redirect('/dashboard');
    } catch (err) {
      console.error(err);
      res.send("حدث خطأ أثناء الاتصال بخوادم Discord OAuth2.");
    }
  });

  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
  });

  app.get('/', (req, res) => {
    const loginButton = req.session.user 
      ? `<a href="/dashboard" class="px-8 py-3 rounded-full btn-gold text-black font-bold transition shadow-lg inline-block">الذهاب إلى لوحة التحكم</a>`
      : `<a href="/login" class="px-8 py-3 rounded-full btn-gold text-black font-bold transition shadow-lg inline-block">سجل دخولك الآن عبر Discord</a>`;

    res.send(renderBaseHtml("الرئيسية", `
      <div class="text-center py-24">
        <h1 class="text-6xl font-black mb-6 glow-text tracking-wide text-white font-sans">اللوحة الملكية للديسكورد</h1>
        <p class="text-slate-400 max-w-xl mx-auto mb-10 text-lg leading-relaxed">تحكّم متكامل وسرعة عالية مصممة بأرقى خطوط وتناسقات الويب الحديثة لتجربة تفاعلية غير مسبوقة.</p>
        ${loginButton}
      </div>
    `, req.session.user));
  });

  app.get('/dashboard', checkAuth, (req, res) => {
    const adminGuilds = req.session.guilds.filter(g => (parseInt(g.permissions) & 0x8) === 0x8);

    let guildsHtml = `<div class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">`;
    adminGuilds.forEach(g => {
      const isBotIn = client.guilds.cache.has(g.id);
      const guildIcon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
      guildsHtml += `
        <div class="glass p-8 rounded-3xl flex flex-col items-center justify-between text-center card-glow transition">
          <img src="${guildIcon}" class="w-24 h-24 rounded-full mb-6 ring-4 ring-amber-500/25 shadow-lg" />
          <h3 class="font-black text-2xl mb-6 text-white">${g.name}</h3>
          ${isBotIn ? `
            <a href="/dashboard/${g.id}" class="px-6 py-3 rounded-full btn-gold text-black font-bold transition w-full text-center">تعديل الإعدادات</a>
          ` : `
            <a href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${g.id}" target="_blank" class="px-6 py-3 rounded-full border border-amber-500/50 hover:bg-amber-500/10 text-amber-400 font-bold transition w-full text-center">دعوة البوت الملكي</a>
          `}
        </div>
      `;
    });
    guildsHtml += `</div>`;

    res.send(renderBaseHtml("سيرفراتك", `
      <h2 class="text-4xl font-black mb-2 glow-text">اختر السيرفر المستهدف</h2>
      <p class="text-slate-400">ابدأ في إدارة سيرفراتك التي تمتلك فيها صلاحيات Administrator كلياً.</p>
      ${guildsHtml}
    `, req.session.user));
  });

  app.get('/dashboard/:guildId', checkAuth, checkGuildAdmin, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const config = getGuildConfig(guild.id);
    const channels = guild.channels.cache;

    const logChannelOptions = getSelectOptions(channels, ChannelType.GuildText, config.general?.logsChannel);
    const ticketChannelOptions = getSelectOptions(channels, ChannelType.GuildText, config.general?.ticketChannel);
    const categoryOptions = getSelectOptions(channels, ChannelType.GuildCategory, config.general?.defaultCategory);
    const transChannelOptions = getSelectOptions(channels, ChannelType.GuildText, config.general?.transcriptChannel);

    const content = `
      <h2 class="text-3xl font-black mb-6 text-white border-b border-amber-500/20 pb-4">⚙️ الإعدادات العامة للمشروع</h2>
      <form action="/dashboard/${guild.id}/save-general" method="POST" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block mb-2 text-slate-400 font-semibold">اسم البوت باللوحة</label>
            <input type="text" name="botName" value="${config.general?.botName || client.user.username}" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition" />
          </div>
          <div>
            <label class="block mb-2 text-slate-400 font-semibold">شعار البوت الملكي (URL)</label>
            <input type="text" name="botLogo" value="${config.general?.botLogo || client.user.displayAvatarURL()}" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block mb-2 text-slate-400 font-semibold">روم السجلات واللوق (Ticket Logs)</label>
            <select name="logsChannel" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition">${logChannelOptions}</select>
          </div>
          <div>
            <label class="block mb-2 text-slate-400 font-semibold">روم حفظ الترانسكريبت (Transcript Channel)</label>
            <select name="transcriptChannel" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition">${transChannelOptions}</select>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block mb-2 text-slate-400 font-semibold">الروم الافتراضي لإرسال بنل التكت</label>
            <select name="ticketChannel" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition">${ticketChannelOptions}</select>
          </div>
          <div>
            <label class="block mb-2 text-slate-400 font-semibold">الكاتيجوري الافتراضي للتكتات</label>
            <select name="defaultCategory" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition">${categoryOptions}</select>
          </div>
        </div>
        <button type="submit" class="px-8 py-3 rounded-full btn-gold text-black font-black transition shadow-lg">حفظ التغييرات</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "general", content, req.session.user, req));
  });

  app.get('/dashboard/:guildId/tickets', checkAuth, checkGuildAdmin, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const config = getGuildConfig(guild.id);
    const channels = guild.channels.cache;
    const roles = guild.roles.cache.filter(r => r.name !== '@everyone');

    const rolesJson = JSON.stringify(roles.map(r => ({ id: r.id, name: r.name })));
    const categoriesJson = JSON.stringify(channels.filter(c => c.type === ChannelType.GuildCategory).map(c => ({ id: c.id, name: c.name })));

    const sendPanelChannelOptions = getSelectOptions(channels, ChannelType.GuildText, config.general?.ticketChannel);

    let ticketsHtml = '';
    const tickets = config.tickets || [];
    tickets.forEach((ticket, idx) => {
      const roleOptions = getRoleSelectOptions(roles, ticket.mentionRole);
      const catOptions = getSelectOptions(channels, ChannelType.GuildCategory, ticket.category);
      ticketsHtml += `
        <div class="glass p-6 rounded-2xl border border-slate-800 space-y-4 mb-6 ticket-card">
          <div class="flex justify-between items-center border-b border-slate-800/50 pb-3">
            <h4 class="font-bold text-lg text-amber-400 card-title">تذكرة: ${ticket.name}</h4>
            <button type="button" onclick="this.closest('.ticket-card').remove();" class="text-red-500 hover:text-red-400 transition font-medium text-sm"><i class="fa-solid fa-trash"></i> إزالة</button>
          </div>
          <input type="hidden" name="id" value="${ticket.id || 'ticket_' + Date.now() + '_' + idx}" />
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">اسم الزر</label>
              <input type="text" name="name" value="${ticket.name}" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Emoji (Unicode أو مخصص)</label>
              <input type="text" name="emoji" value="${ticket.emoji || '📩'}" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">لون الزر</label>
              <select name="color" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
                <option value="Primary" ${ticket.color === 'Primary' ? 'selected' : ''}>أزرق (Primary)</option>
                <option value="Secondary" ${ticket.color === 'Secondary' ? 'selected' : ''}>رمادي (Secondary)</option>
                <option value="Success" ${ticket.color === 'Success' ? 'selected' : ''}>أخضر (Success)</option>
                <option value="Danger" ${ticket.color === 'Danger' ? 'selected' : ''}>أحمر (Danger)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">الرتبة الممنشنة</label>
              <select name="mentionRole" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">${roleOptions}</select>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">الكاتيجوري المخصص</label>
              <select name="category" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">${catOptions}</select>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">صيغة اسم الروم</label>
              <input type="text" name="channelName" value="${ticket.channelName || 'ticket-{user}'}" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">رسالة الترحيب بالتكت</label>
              <input type="text" name="welcomeMessage" value="${ticket.welcomeMessage || ''}" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" />
            </div>
          </div>
        </div>
      `;
    });

    const content = `
      <div class="glass p-8 rounded-3xl border border-slate-800 mb-8 shadow-xl">
        <h3 class="text-xl font-bold mb-2 text-amber-400">📤 إرسال لوحة التذاكر (Send Ticket Panel)</h3>
        <p class="text-xs text-slate-400 mb-4 font-medium">اختر الروم المناسب من القائمة ثم اضغط على زر إرسال لإطلاق لوحة التذاكر في سيرفرك مباشرة.</p>
        <form action="/dashboard/${guild.id}/tickets/send-panel" method="POST" class="flex flex-col md:flex-row gap-4 items-end">
          <div class="flex-grow w-full">
            <label class="block text-xs text-slate-400 mb-1 font-semibold">روم الإرسال المستهدف</label>
            <select name="targetChannelId" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white" required>
              ${sendPanelChannelOptions}
            </select>
          </div>
          <button type="submit" class="px-8 py-3 rounded-full btn-gold text-black font-black transition shadow-lg w-full md:w-auto text-center">إرسال اللوحة الآن</button>
        </form>
      </div>

      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">🎫 التحكم في التذاكر وأنواعها</h2>
        <button type="button" onclick="addNewTicketCard();" class="px-5 py-2 rounded-full btn-gold text-black font-black text-sm transition shadow-lg"><i class="fa-solid fa-plus"></i> إضافة نوع تكت جديد</button>
      </div>
      
      <form action="/dashboard/${guild.id}/tickets/save" method="POST" class="space-y-6">
        <div class="glass p-6 rounded-2xl border border-slate-800 mb-6 flex items-center justify-between">
          <div>
            <h4 class="font-bold text-white mb-1">الحد الأقصى للتكتات المفتوحة لكل عضو</h4>
            <p class="text-xs text-slate-400">حدد عدد التكتات التي يسمح للعضو الواحد بفتحها كحد أقصى.</p>
          </div>
          <input type="number" name="maxTickets" min="1" max="100" value="${config.maxTickets || '4'}" class="w-24 bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white text-center" />
        </div>
        <div id="tickets-container">
          ${ticketsHtml}
        </div>
        <button type="submit" class="px-8 py-3 rounded-full btn-gold text-black font-black transition w-full shadow-lg">حفظ بنية التكتات بالكامل</button>
      </form>

      <script>
        const rawRoles = ${rolesJson};
        const rawCategories = ${categoriesJson};

        function generateSelectOptions(items, placeholder) {
          let html = '<option value="">' + placeholder + '</option>';
          items.forEach(i => {
            html += '<option value="' + i.id + '">' + i.name + '</option>';
          });
          return html;
        }

        function addNewTicketCard() {
          const container = document.getElementById('tickets-container');
          const id = 'ticket_' + Date.now();
          const cardHtml = \`
            <div class="glass p-6 rounded-2xl border border-slate-800 space-y-4 mb-6 ticket-card">
              <div class="flex justify-between items-center border-b border-slate-800/50 pb-3">
                <h4 class="font-bold text-lg text-amber-400 card-title">تذكرة جديدة</h4>
                <button type="button" onclick="this.closest('.ticket-card').remove();" class="text-red-500 hover:text-red-400 transition font-medium text-sm"><i class="fa-solid fa-trash"></i> إزالة</button>
              </div>
              <input type="hidden" name="id" value="\${id}" />
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label class="block text-xs text-slate-400 mb-1">اسم الزر</label>
                  <input type="text" name="name" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required />
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">Emoji (Unicode أو مخصص)</label>
                  <input type="text" name="emoji" value="📩" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" />
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">لون الزر</label>
                  <select name="color" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
                    <option value="Primary">أزرق (Primary)</option>
                    <option value="Secondary">رمادي (Secondary)</option>
                    <option value="Success">أخضر (Success)</option>
                    <option value="Danger">أحمر (Danger)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">الرتبة الممنشنة</label>
                  <select name="mentionRole" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
                    \${generateSelectOptions(rawRoles, "لا يوجد منشن (فارغ)")}
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs text-slate-400 mb-1">الكاتيجوري المخصص</label>
                  <select name="category" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
                    \${generateSelectOptions(rawCategories, "لا يوجد تحديد (فارغ)")}
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">صيغة اسم الروم</label>
                  <input type="text" name="channelName" value="ticket-{user}" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" />
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">رسالة الترحيب بالتكت</label>
                  <input type="text" name="welcomeMessage" value="أهلاً بك، تفضل بكتابة طلبك." class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" />
                </div>
              </div>
            </div>
          \`;
          container.insertAdjacentHTML('beforeend', cardHtml);
        }
      </script>
    `;

    res.send(renderGuildLayout(guild, "tickets", content, req.session.user, req));
  });

  // معالجة وحفظ وإرسال بنل التكت للروم مع تقسيم الأزرار ديناميكياً وفحص الإيموجيات مسبقاً
  app.post('/dashboard/:guildId/tickets/send-panel', checkAuth, checkGuildAdmin, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("السيرفر غير متوفر.");

    const targetChannelId = req.body.targetChannelId;
    if (!targetChannelId) {
      return res.redirect(`/dashboard/${guild.id}/tickets?error=no_channel`);
    }

    const config = getGuildConfig(guild.id);
    if (!config.tickets || config.tickets.length === 0) {
      return res.redirect(`/dashboard/${guild.id}/tickets?error=no_tickets`);
    }

    const targetChannel = guild.channels.cache.get(targetChannelId) || await guild.channels.fetch(targetChannelId).catch(() => null);
    if (!targetChannel) {
      return res.redirect(`/dashboard/${guild.id}/tickets?error=channel_not_found`);
    }

    // التحقق الفني الصارم من صلاحيات البوت داخل القناة قبل الإرسال وتفادي الأخطاء الصامتة
    const me = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
    if (!me) {
      return res.redirect(`/dashboard/${guild.id}/tickets?error=bot_member_not_found`);
    }

    const channelPerms = targetChannel.permissionsFor(me);
    const missingPerms = [];
    if (!channelPerms.has(PermissionFlagsBits.ViewChannel)) missingPerms.push("رؤية القناة (View Channel)");
    if (!channelPerms.has(PermissionFlagsBits.SendMessages)) missingPerms.push("إرسال الرسائل (Send Messages)");
    if (!channelPerms.has(PermissionFlagsBits.EmbedLinks)) missingPerms.push("تضمين الروابط (Embed Links)");

    if (missingPerms.length > 0) {
      return res.redirect(`/dashboard/${guild.id}/tickets?error=missing_perms&perms=${encodeURIComponent(missingPerms.join(' و '))}`);
    }

    let hasInvalidEmojiWarning = false;

    try {
      const embed = new EmbedBuilder()
        .setTitle(config.general?.botName || "نظام التذاكر")
        .setDescription("اختر نوع التذكرة لفتح تكت جديد والمتابعة مع الدعم الفني.")
        .setColor('#d4af37');

      const rows = [];
      let currentRow = new ActionRowBuilder();

      const validTickets = config.tickets.filter(t => t && t.id && t.name);

      validTickets.forEach((ticket, idx) => {
        let style = ButtonStyle.Primary;
        if (ticket.color === 'Secondary') style = ButtonStyle.Secondary;
        if (ticket.color === 'Success') style = ButtonStyle.Success;
        if (ticket.color === 'Danger') style = ButtonStyle.Danger;

        const button = new ButtonBuilder()
          .setCustomId(`ticket_open_${ticket.id}`)
          .setLabel(ticket.name)
          .setStyle(style);

        // تصفية وتحليل الإيموجي ديناميكياً لتفادي استثناء الـ API الحاد
        const buttonEmoji = parseAndValidateEmoji(ticket.emoji);
        if (buttonEmoji) {
          button.setEmoji(buttonEmoji);
        } else if (ticket.emoji && ticket.emoji.trim() !== "") {
          hasInvalidEmojiWarning = true; // تم رصد وتصفية قيمة نصية أو تعبيرية غير متوافقة
        }

        currentRow.addComponents(button);

        if ((idx + 1) % 5 === 0 || idx === validTickets.length - 1) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }
      });

      await targetChannel.send({ embeds: [embed], components: rows });

      // تخزين روم الإرسال في قاعدة البيانات
      config.general.ticketChannel = targetChannelId;
      client.saveConfig();

      if (hasInvalidEmojiWarning) {
        return res.redirect(`/dashboard/${guild.id}/tickets?success=panel_sent_warn`);
      } else {
        return res.redirect(`/dashboard/${guild.id}/tickets?success=panel_sent`);
      }
    } catch (err) {
      console.error("[TICKET PANEL SEND ERROR] Crash trace captured inside Node:", err);
      return res.redirect(`/dashboard/${guild.id}/tickets?error=internal_error&msg=${encodeURIComponent(err.message)}`);
    }
  });

  app.get('/dashboard/:guildId/auto-reply', checkAuth, checkGuildAdmin, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const config = getGuildConfig(guild.id);
    const channels = guild.channels.cache;

    const textChannelsJson = JSON.stringify(channels.filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name })));

    let repliesHtml = '';
    const replies = config.autoReplies || [];
    replies.forEach((reply, idx) => {
      const channelOptions = `<option value="all" ${reply.channel === 'all' ? 'selected' : ''}>كل الرومات (All)</option>` + getSelectOptions(channels, ChannelType.GuildText, reply.channel);
      repliesHtml += `
        <div class="glass p-6 rounded-2xl border border-slate-800 space-y-4 mb-6 reply-card">
          <div class="flex justify-between items-center">
            <h4 class="font-bold text-lg text-amber-400">رد تلقائي</h4>
            <button type="button" onclick="this.closest('.reply-card').remove();" class="text-red-500 hover:text-red-400 transition font-medium text-sm"><i class="fa-solid fa-trash"></i> إزالة</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">الكلمة المفتاحية</label>
              <input type="text" name="keyword" value="${reply.keyword || ''}" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required />
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs text-slate-400 mb-1">الرد المبرمج</label>
              <input type="text" name="reply" value="${reply.reply || ''}" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">مكان العمل</label>
              <select name="channel" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">${channelOptions}</select>
            </div>
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">حالة الرد</label>
            <select name="enabled" class="bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
              <option value="true" ${reply.enabled ? 'selected' : ''}>مفعّل</option>
              <option value="false" ${!reply.enabled ? 'selected' : ''}>معطّل</option>
            </select>
          </div>
        </div>
      `;
    });

    const content = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">💬 نظام الردود التلقائية (Auto Reply)</h2>
        <button type="button" onclick="addNewReplyCard();" class="px-5 py-2 rounded-full btn-gold text-black font-black text-sm transition shadow-lg"><i class="fa-solid fa-plus"></i> إضافة رد جديد</button>
      </div>
      <form action="/dashboard/${guild.id}/auto-reply/save" method="POST" class="space-y-6">
        <div id="replies-container">
          ${repliesHtml}
        </div>
        <button type="submit" class="px-8 py-3 rounded-full btn-gold text-black font-black transition w-full shadow-lg">حفظ جميع الردود</button>
      </form>

      <script>
        const rawChannels = ${textChannelsJson};

        function generateChannelOptions() {
          let html = '<option value="all">كل الرومات (All)</option>';
          rawChannels.forEach(c => {
            html += '<option value="' + c.id + '"># ' + c.name + '</option>';
          });
          return html;
        }

        function addNewReplyCard() {
          const container = document.getElementById('replies-container');
          const cardHtml = \`
            <div class="glass p-6 rounded-2xl border border-slate-800 space-y-4 mb-6 reply-card">
              <div class="flex justify-between items-center">
                <h4 class="font-bold text-lg text-amber-400">رد تلقائي جديد</h4>
                <button type="button" onclick="this.closest('.reply-card').remove();" class="text-red-500 hover:text-red-400 transition font-medium text-sm"><i class="fa-solid fa-trash"></i> إزالة</button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label class="block text-xs text-slate-400 mb-1">الكلمة المفتاحية</label>
                  <input type="text" name="keyword" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-xs text-slate-400 mb-1">الرد المبرمج</label>
                  <input type="text" name="reply" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required />
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">مكان العمل</label>
                  <select name="channel" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
                    \${generateChannelOptions()}
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">حالة الرد</label>
                <select name="enabled" class="bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
                  <option value="true">مفعّل</option>
                  <option value="false">معطّل</option>
                </select>
              </div>
            </div>
          \`;
          container.insertAdjacentHTML('beforeend', cardHtml);
        }
      </script>
    `;

    res.send(renderGuildLayout(guild, "auto-reply", content, req.session.user, req));
  });

  app.post('/dashboard/:guildId/auto-reply/save', checkAuth, checkGuildAdmin, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    
    const keywords = normalizeArray(req.body.keyword);
    const replies = normalizeArray(req.body.reply);
    const channels = normalizeArray(req.body.channel);
    const enableds = normalizeArray(req.body.enabled);

    const updatedReplies = [];
    for (let i = 0; i < keywords.length; i++) {
      if (!keywords[i]) continue;
      updatedReplies.push({
        keyword: keywords[i],
        reply: replies[i],
        channel: channels[i] || 'all',
        enabled: enableds[i] === 'true'
      });
    }

    config.autoReplies = updatedReplies;
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/auto-reply`);
  });

  app.get('/dashboard/:guildId/broadcast', checkAuth, checkGuildAdmin, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const channels = guild.channels.cache;
    const roles = guild.roles.cache.filter(r => r.name !== '@everyone');

    const channelOptions = getSelectOptions(channels, ChannelType.GuildText);
    const roleOptions = getRoleSelectOptions(roles);

    const content = `
      <h2 class="text-3xl font-black mb-6 text-white border-b border-amber-500/20 pb-4">📢 نظام البث العام والرسائل الجماعية (Broadcast System)</h2>
      
      <form action="/dashboard/${guild.id}/broadcast/send" method="POST" class="space-y-6">
        <div class="glass p-8 rounded-3xl border border-slate-800 space-y-6">
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400 font-semibold">نوع الإرسال (Delivery Method)</label>
              <select name="sendType" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition">
                <option value="channel">إرسال في روم محدد (Channel Broadcast)</option>
                <option value="dm">إرسال في الخاص جماعي للأعضاء (DM Broadcast)</option>
              </select>
            </div>
            <div>
              <label class="block mb-2 text-slate-400 font-semibold">روم الإرسال (في حال الإرسال للروم)</label>
              <select name="channelId" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition">${channelOptions}</select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400 font-semibold">تحديد الفئة المستهدفة (Target Recipients)</label>
              <select name="targetType" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition">
                <option value="all">جميع أعضاء السيرفر</option>
                <option value="online">الأعضاء المتصلين فقط (Online)</option>
                <option value="offline">الأعضاء الأوفلاين فقط (Offline)</option>
                <option value="hasRole">الأعضاء الذين يملكون رتبة معينة</option>
                <option value="noRole">الأعضاء الذين لا يملكون رتبة معينة</option>
                <option value="bots">البوتات فقط (Bots Only)</option>
                <option value="humans">الأعضاء فقط (دون البوتات)</option>
              </select>
            </div>
            <div>
              <label class="block mb-2 text-slate-400 font-semibold">الرتبة المستهدفة (إذا تم اختيار فرز الرتب)</label>
              <select name="targetRoleId" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition">${roleOptions}</select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400 font-semibold">صيغة وهيكل الرسالة</label>
              <select name="format" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition">
                <option value="plain">رسالة عادية (Plain Text)</option>
                <option value="embed">إمبد مخصص (Embed Message)</option>
              </select>
            </div>
            <div>
              <label class="block mb-2 text-slate-400 font-semibold">المنشن (Mention)</label>
              <select name="mention" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition">
                <option value="none">بدون منشن</option>
                <option value="everyone">@everyone</option>
                <option value="here">@here</option>
                ${roleOptions}
              </select>
            </div>
          </div>

          <div class="border-t border-amber-500/20 pt-6 space-y-4">
            <h4 class="text-sm font-bold text-amber-400">محتوى وبنية البث:</h4>
            <div>
              <label class="block mb-2 text-slate-400">عنوان الإمبد (Embed Title - اختياري)</label>
              <input type="text" name="embedTitle" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition" />
            </div>
            <div>
              <label class="block mb-2 text-slate-400">نص الرسالة أو وصف الإمبد (Message / Embed Description)</label>
              <textarea name="message" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white h-32 focus:outline-none transition" required></textarea>
            </div>
            <div>
              <label class="block mb-2 text-slate-400">رابط صورة البث (Image URL - اختياري)</label>
              <input type="text" name="embedImage" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white focus:outline-none transition" />
            </div>
          </div>

        </div>
        <button type="submit" class="px-8 py-4 rounded-full btn-gold text-black font-black transition shadow-lg w-full text-lg">بدء إطلاق حملة البث العام</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "broadcast", content, req.session.user, req));
  });

  app.post('/dashboard/:guildId/broadcast/send', checkAuth, checkGuildAdmin, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("السيرفر غير متوفر.");

    const { sendType, channelId, targetType, targetRoleId, format, mention, embedTitle, message, embedImage } = req.body;

    try {
      await guild.members.fetch();

      const targetMembers = guild.members.cache.filter(m => {
        if (targetType === 'bots') return m.user.bot;
        if (targetType === 'humans') return !m.user.bot;
        if (targetType === 'online') return m.presence && m.presence.status !== 'offline';
        if (targetType === 'offline') return !m.presence || m.presence.status === 'offline';
        if (targetType === 'hasRole') return m.roles.cache.has(targetRoleId);
        if (targetType === 'noRole') return !m.roles.cache.has(targetRoleId);
        return true;
      });

      let payload = {};
      if (format === 'plain') {
        payload.content = message;
      } else {
        const embed = new EmbedBuilder()
          .setDescription(message)
          .setColor('#d4af37')
          .setTimestamp();
        
        if (embedTitle) embed.setTitle(embedTitle);
        if (embedImage) embed.setImage(embedImage);
        payload.embeds = [embed];
      }

      if (sendType === 'channel') {
        const chan = guild.channels.cache.get(channelId);
        if (chan) {
          let mentionStr = '';
          if (mention === 'everyone') mentionStr = '@everyone';
          else if (mention === 'here') mentionStr = '@here';
          else if (mention !== 'none') mentionStr = `<@&${mention}>`;

          if (mentionStr) {
            payload.content = mentionStr + '\n' + (payload.content || '');
          }
          await chan.send(payload);
        }
      } else if (sendType === 'dm') {
        (async () => {
          for (const [id, member] of targetMembers) {
            if (member.user.bot) continue;
            await member.send(payload).catch(() => {});
            await new Promise(r => setTimeout(r, 1000));
          }
        })();
      }

    } catch (err) {
      console.error("Error during broadcast:", err);
    }

    res.redirect(`/dashboard/${guild.id}/broadcast`);
  });

  app.get('/dashboard/:guildId/giveaway', checkAuth, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const config = getGuildConfig(guild.id);
    const channels = guild.channels.cache;
    const roles = guild.roles.cache.filter(r => r.name !== '@everyone');

    const channelOptions = getSelectOptions(channels, ChannelType.GuildText);
    const roleOptions = getRoleSelectOptions(roles);

    let activeHtml = '';
    const giveaways = config.giveaways || [];
    giveaways.forEach(g => {
      if (!g.ended) {
        activeHtml += `
          <div class="glass p-4 rounded-xl border border-slate-800 flex justify-between items-center mb-4">
            <div>
              <h5 class="font-bold text-white">${g.prize}</h5>
              <p class="text-xs text-slate-400">ينتهي في: ${new Date(g.endAt).toLocaleString()} | الفائزون: ${g.winnersCount}</p>
            </div>
            <a href="/dashboard/${guild.id}/giveaway/end/${g.messageId}" class="px-4 py-2 rounded-full border border-red-500/50 hover:bg-red-500/10 text-red-400 text-xs font-bold transition">إنهاء الآن</a>
          </div>
        `;
      }
    });

    const content = `
      <h2 class="text-3xl font-black mb-6 text-white border-b border-amber-500/20 pb-4">🎉 نظام القيف أواي وإدارة السحوبات (Giveaway)</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        <form action="/dashboard/${guild.id}/giveaway/start" method="POST" class="glass p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 class="text-lg font-bold text-amber-400 border-b border-slate-800 pb-2">إنشاء قيف أواي جديد</h3>
          
          <div>
            <label class="block text-xs text-slate-400 mb-1">الروم المستهدف</label>
            <select name="channelId" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required>${channelOptions}</select>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">العنوان الرئيسي</label>
              <input type="text" name="title" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">الجائزة</label>
              <input type="text" name="prize" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required />
            </div>
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">الوصف</label>
            <textarea name="description" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white h-20"></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">المدة الزمنية</label>
              <input type="number" name="durationValue" min="1" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">الوحدة الزمنية</label>
              <select name="durationUnit" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
                <option value="minutes">دقائق</option>
                <option value="hours">ساعات</option>
                <option value="days">أيام</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">عدد الفائزين</label>
              <input type="number" name="winnersCount" min="1" value="1" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" required />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">نوع المنشن</label>
              <select name="mentionType" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
                <option value="none">بدون منشن</option>
                <option value="everyone">@everyone</option>
                <option value="here">@here</option>
                ${roleOptions}
              </select>
            </div>
          </div>
          
          <div class="p-4 bg-slate-950/40 rounded-xl border border-slate-900 space-y-4">
            <h4 class="text-xs font-bold text-slate-400">شروط المشاركة الاختيارية</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-slate-500 mb-1">يجب امتلاك رتبة معينة</label>
                <select name="requiredRoleId" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">${roleOptions}</select>
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1">مدة الانتساب للسيرفر (أيام)</label>
                <input type="number" name="requiredServerDays" min="0" value="0" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" />
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs text-slate-400 mb-1">صورة إضافية اختيارية (URL)</label>
            <input type="text" name="image" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">رسالة الفائز المخصصة</label>
            <input type="text" name="winnerMessageTemplate" value="🎉 مبروك {user} لقد ربحت {prize}!" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white" />
          </div>
          
          <button type="submit" class="px-6 py-3 rounded-full btn-gold text-black font-black transition w-full shadow-lg">إطلاق السحب الآن</button>
        </form>

        <div class="space-y-4">
          <div class="glass p-6 rounded-2xl border border-slate-800">
            <h3 class="text-lg font-bold text-amber-400 border-b border-slate-800 pb-2 mb-4">السحوبات النشطة</h3>
            ${activeHtml || '<p class="text-slate-400 text-sm">لا توجد سحوبات نشطة حالياً.</p>'}
          </div>
        </div>
      </div>
    `;

    res.send(renderGuildLayout(guild, "giveaway", content, req.session.user, req));
  });

  app.post('/dashboard/:guildId/giveaway/start', checkAuth, checkGuildAdmin, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("السيرفر غير متوفر.");

    const config = getGuildConfig(guild.id);
    const chan = guild.channels.cache.get(req.body.channelId);

    if (chan) {
      try {
        const title = req.body.title;
        const prize = req.body.prize;
        const description = req.body.description || '';
        const durationValue = parseInt(req.body.durationValue);
        const durationUnit = req.body.durationUnit;
        const winnersCount = parseInt(req.body.winnersCount || '1');
        const mentionType = req.body.mentionType;
        const requiredRoleId = req.body.requiredRoleId || '';
        const requiredServerDays = parseInt(req.body.requiredServerDays || '0');
        const image = req.body.image || '';
        const winnerMessageTemplate = req.body.winnerMessageTemplate || "🎉 مبروك {user} لقد ربحت {prize}!";

        let durationMs = durationValue * 60 * 1000;
        if (durationUnit === 'hours') durationMs = durationValue * 60 * 60 * 1000;
        if (durationUnit === 'days') durationMs = durationValue * 24 * 60 * 60 * 1000;

        const endAt = Date.now() + durationMs;

        let mentionStr = '';
        if (mentionType === 'everyone') mentionStr = '@everyone';
        else if (mentionType === 'here') mentionStr = '@here';
        else if (mentionType !== 'none') mentionStr = `<@&${mentionType}>`;

        let reqsStr = '';
        if (requiredRoleId) reqsStr += `\n• يجب أن تمتلك رتبة: <@&${requiredRoleId}>`;
        if (requiredServerDays) reqsStr += `\n• يجب أن تكون عضواً بالسيرفر منذ: ${requiredServerDays} يوم/أيام`;
        if (!reqsStr) reqsStr = 'لا يوجد شروط';

        const embed = new EmbedBuilder()
          .setTitle(`🎉 قيف أواي: ${prize} 🎉`)
          .setDescription(`**العنوان:** ${title}\n${description}\n\n**الشروط:**\n${reqsStr}\n\n**المنتهي في:** <t:${Math.floor(endAt / 1000)}:R>\n**عدد الفائزين:** ${winnersCount}`)
          .setColor('#d4af37')
          .setTimestamp();

        if (image) embed.setImage(image);

        const msgPayload = { embeds: [embed] };
        if (mentionStr) msgPayload.content = mentionStr;

        const msg = await chan.send(msgPayload);
        await msg.react('🎉');

        if (!config.giveaways) config.giveaways = [];
        config.giveaways.push({
          id: `giveaway_${Date.now()}`,
          messageId: msg.id,
          channelId: chan.id,
          title,
          description,
          prize,
          image,
          durationMs,
          endAt,
          winnersCount,
          requiredRoleId,
          requiredServerDays,
          winnerMessageTemplate,
          ended: false
        });

        client.saveConfig();
      } catch (err) {
        console.error("Failed to start giveaway:", err);
      }
    }
    res.redirect(`/dashboard/${guild.id}/giveaway`);
  });

  app.get('/dashboard/:guildId/giveaway/end/:msgId', checkAuth, checkGuildAdmin, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("السيرفر غير متوفر.");

    const config = getGuildConfig(guild.id);
    const giveaway = config.giveaways?.find(g => g.messageId === req.params.msgId);

    if (giveaway && !giveaway.ended) {
      await endGiveaway(client, guild, giveaway);
    }
    res.redirect(`/dashboard/${guild.id}/giveaway`);
  });

  app.get('/dashboard/:guildId/welcome', checkAuth, checkGuildAdmin, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const config = getGuildConfig(guild.id);
    const channels = guild.channels.cache;
    const logChannelOptions = getSelectOptions(channels, ChannelType.GuildText, config.welcome?.channelId);

    const content = `
      <h2 class="text-2xl font-bold mb-6">👋 نظام الترحيب بالأعضاء الجدد</h2>
      <form action="/dashboard/${guild.id}/welcome/save" method="POST" class="space-y-6">
        <div class="glass p-6 rounded-2xl border border-slate-800 space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-bold text-white mb-1">تفعيل نظام الترحيب</h4>
              <p class="text-xs text-slate-400">تمكين الترحيب بالأعضاء وتوليد بطاقة ترحيبية مرسومة تلقائياً.</p>
            </div>
            <select name="enabled" class="bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
              <option value="true" ${config.welcome?.enabled ? 'selected' : ''}>مفعّل</option>
              <option value="false" ${!config.welcome?.enabled ? 'selected' : ''}>معطّل</option>
            </select>
          </div>
          <hr class="border-slate-800" />
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400">روم الترحيب</label>
              <select name="channelId" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white">${logChannelOptions}</select>
            </div>
            <div>
              <label class="block mb-2 text-slate-400">عمل منشن (Mention) للعضو عند الترحيب به</label>
              <select name="mentionUser" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white">
                <option value="true" ${config.welcome?.mentionUser ? 'selected' : ''}>نعم</option>
                <option value="false" ${!config.welcome?.mentionUser ? 'selected' : ''}>لا</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block mb-2 text-slate-400">رسالة الترحيب النصية</label>
            <textarea name="message" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white h-28 focus:outline-none transition">${config.welcome?.message || 'Welcome to the server, {user}!'}</textarea>
            <span class="text-xs text-slate-500">ملاحظة: يمكنك استخدام {user} لمنشن العضو، {server} لاسم السيرفر، {count} لعدد الأعضاء.</span>
          </div>
        </div>
        <button type="submit" class="px-8 py-3 rounded-full btn-gold text-black font-black transition shadow-lg">حفظ إعدادات الترحيب</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "welcome", content, req.session.user, req));
  });

  app.get('/dashboard/:guildId/auto-role', checkAuth, checkGuildAdmin, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const config = getGuildConfig(guild.id);
    const roles = guild.roles.cache.filter(r => r.name !== '@everyone');
    const roleOptions = getRoleSelectOptions(roles, config.autoRole?.roleId);

    const content = `
      <h2 class="text-2xl font-bold mb-6">🛡️ نظام الرتب التلقائية للأعضاء الجدد</h2>
      <form action="/dashboard/${guild.id}/auto-role/save" method="POST" class="space-y-6">
        <div class="glass p-6 rounded-2xl border border-slate-800 space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-bold text-white mb-1">تفعيل إعطاء رتبة تلقائياً</h4>
              <p class="text-xs text-slate-400">سيحصل العضو على الرتبة المحددة بمجرد دخوله السيرفر مباشرة.</p>
            </div>
            <select name="enabled" class="bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-white">
              <option value="true" ${config.autoRole?.enabled ? 'selected' : ''}>مفعّل</option>
              <option value="false" ${!config.autoRole?.enabled ? 'selected' : ''}>معطّل</option>
            </select>
          </div>
          <hr class="border-slate-800" />
          <div>
            <label class="block mb-2 text-slate-400">الرتبة المحددة</label>
            <select name="roleId" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white">${roleOptions}</select>
          </div>
        </div>
        <button type="submit" class="px-8 py-3 rounded-full btn-gold text-black font-black transition shadow-lg">حفظ إعدادات الرتبة</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "auto-role", content, req.session.user, req));
  });

  app.get('/dashboard/:guildId/embed-sender', checkAuth, checkGuildAdmin, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const channels = guild.channels.cache;
    const textChannelOptions = getSelectOptions(channels, ChannelType.GuildText);

    const content = `
      <h2 class="text-2xl font-bold mb-6">✉️ مرسل رسائل الإمبد (Embed Sender)</h2>
      <form action="/dashboard/${guild.id}/embed-sender/send" method="POST" class="space-y-6">
        <div class="glass p-6 rounded-2xl border border-slate-800 space-y-6">
          <div>
            <label class="block mb-2 text-slate-400">روم إرسال الرسالة</label>
            <select name="channelId" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white">${textChannelOptions}</select>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400">عنوان الإمبد (Embed Title)</label>
              <input type="text" name="title" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white" />
            </div>
            <div>
              <label class="block mb-2 text-slate-400">اللون (Color / Hex Code)</label>
              <input type="text" name="color" placeholder="#d4af37" value="#d4af37" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white" />
            </div>
          </div>
          <div>
            <label class="block mb-2 text-slate-400">المحتوى / الوصف (Description)</label>
            <textarea name="description" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white h-32 focus:outline-none transition"></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400 font-semibold">الصورة الكبيرة (Image URL)</label>
              <input type="text" name="image" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white" />
            </div>
            <div>
              <label class="block mb-2 text-slate-400 font-semibold">الصورة الصغيرة (Thumbnail URL)</label>
              <input type="text" name="thumbnail" class="w-full bg-black/60 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white" />
            </div>
          </div>
        </div>
        <button type="submit" class="px-8 py-3 rounded-full btn-gold text-black font-black transition shadow-lg">ارسل الرسالة الآن</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "embed-sender", content, req.session.user, req));
  });

  app.post('/dashboard/:guildId/save-general', checkAuth, checkGuildAdmin, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    config.general = {
      botName: req.body.botName,
      botLogo: req.body.botLogo,
      logsChannel: req.body.logsChannel,
      ticketChannel: req.body.ticketChannel,
      defaultCategory: req.body.defaultCategory,
      transcriptChannel: req.body.transcriptChannel,
      themeColor: config.general?.themeColor || '#d4af37'
    };
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}`);
  });

  app.post('/dashboard/:guildId/tickets/save', checkAuth, checkGuildAdmin, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    config.maxTickets = req.body.maxTickets || '4';

    const names = normalizeArray(req.body.name);
    const emojis = normalizeArray(req.body.emoji);
    const colors = normalizeArray(req.body.color);
    const roles = normalizeArray(req.body.mentionRole);
    const categories = normalizeArray(req.body.category);
    const channelNames = normalizeArray(req.body.channelName);
    const welcomeMessages = normalizeArray(req.body.welcomeMessage);
    const ids = normalizeArray(req.body.id);

    const updatedTickets = [];
    for (let i = 0; i < names.length; i++) {
      if (!names[i]) continue;
      updatedTickets.push({
        id: ids[i] || `ticket_${Date.now()}_${i}`,
        name: names[i],
        emoji: emojis[i],
        color: colors[i] || 'Primary',
        mentionRole: roles[i] || '',
        category: categories[i] || '',
        channelName: channelNames[i] || 'ticket-{user}',
        welcomeMessage: welcomeMessages[i] || ''
      });
    }

    config.tickets = updatedTickets;
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/tickets`);
  });

  app.post('/dashboard/:guildId/auto-role/save', checkAuth, checkGuildAdmin, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    config.autoRole = {
      enabled: req.body.enabled === 'true',
      roleId: req.body.roleId
    };
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/auto-role`);
  });

  app.post('/dashboard/:guildId/embed-sender/send', checkAuth, checkGuildAdmin, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("السيرفر غير متوفر.");

    const chan = guild.channels.cache.get(req.body.channelId);
    if (chan) {
      try {
        const embed = new EmbedBuilder().setColor(req.body.color || '#d4af37');

        if (req.body.title) embed.setTitle(req.body.title);
        if (req.body.description) embed.setDescription(req.body.description);
        if (req.body.image) embed.setImage(req.body.image);
        if (req.body.thumbnail) embed.setThumbnail(req.body.thumbnail);

        await chan.send({ embeds: [embed] });
      } catch (err) {
        console.error("Failed to send embed:", err);
      }
    }
    res.redirect(`/dashboard/${req.params.guildId}/embed-sender`);
  });
}

function getGuildConfig(guildId) {
  if (!app.client) return {};
  if (!app.client.config.guilds[guildId]) {
    app.client.config.guilds[guildId] = {
      general: {},
      tickets: [],
      autoReplies: [],
      welcome: {},
      autoRole: {},
      giveaways: []
    };
  }
  return app.client.config.guilds[guildId];
}

function getSelectOptions(channels, type, selectedId) {
  let options = '<option value="">لا يوجد تحديد (فارغ)</option>';
  const filtered = channels.filter(c => c.type === type);
  filtered.forEach(c => {
    options += `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}># ${c.name}</option>`;
  });
  return options;
}

function getRoleSelectOptions(roles, selectedId) {
  let options = '<option value="">لا يوجد منشن (فارغ)</option>';
  roles.forEach(r => {
    options += `<option value="${r.id}" ${selectedId === r.id ? 'selected' : ''}>@ ${r.name}</option>`;
  });
  return options;
}

function renderBaseHtml(title, body, user) {
  const userSection = user ? `
    <div class="flex items-center space-x-3 space-x-reverse">
      <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" class="w-10 h-10 rounded-full" />
      <div class="text-right">
        <h5 class="text-sm font-bold text-white">${user.username}</h5>
        <a href="/logout" class="text-xs text-red-500 hover:text-red-400 font-semibold">تسجيل الخروج</a>
      </div>
    </div>
  ` : `<a href="/login" class="px-6 py-3 rounded-full btn-gold text-black font-black text-sm transition shadow-lg inline-block">تسجيل دخول</a>`;

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | لوحة التحكم</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
        :root {
          --gold: #d4af37;
          --gold-glow: rgba(212, 175, 55, 0.25);
          --premium-black: #060608;
          --glass-bg: rgba(12, 12, 16, 0.82);
        }
        body { font-family: 'Tajawal', sans-serif; background-color: var(--premium-black); color: #f3f4f6; }
        .glass { background: var(--glass-bg); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(212, 175, 55, 0.12); }
        .btn-gold {
          background: linear-gradient(135deg, #d4af37 0%, #aa7c11 100%);
          color: #000 !important;
          font-weight: 900;
          box-shadow: 0 4px 15px var(--gold-glow);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-gold:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 22px rgba(212, 175, 55, 0.5);
        }
        .glow-text { text-shadow: 0 0 15px rgba(212, 175, 55, 0.3); }
        .card-glow { transition: all 0.3s ease; }
        .card-glow:hover { border-color: rgba(212, 175, 55, 0.3); box-shadow: 0 10px 25px -5px rgba(212, 175, 55, 0.12); }
      </style>
    </head>
    <body class="min-h-screen flex flex-col">
      <nav class="glass border-b border-amber-500/10 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50">
        <div class="flex items-center space-x-4 space-x-reverse">
          <i class="fa-solid fa-gem text-amber-500 text-3xl"></i>
          <span class="text-2xl font-black text-white tracking-wider glow-text">Discord Ticket Gold</span>
        </div>
        ${userSection}
      </nav>
      <main class="flex-grow max-w-7xl w-full mx-auto p-6 md:p-12">
        ${body}
      </main>
      <footer class="glass border-t border-amber-500/10 text-center py-6 text-slate-500 text-xs">
        &copy; 2026 Discord Ticket Gold. جميع الحقوق محفوظة.
      </footer>
    </body>
    </html>
  `;
}

function renderGuildLayout(guild, activePage, content, user, req) {
  const config = getGuildConfig(guild.id);
  const botLogo = config.general?.botLogo || guild.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png';
  const botName = config.general?.botName || guild.name;

  const success = req ? req.query.success : null;
  const error = req ? req.query.error : null;
  const missingPerms = req ? req.query.perms : '';
  const exceptionMsg = req ? req.query.msg : '';
  let alertHtml = '';

  if (success === 'panel_sent') {
    alertHtml = `
      <div class="mb-6 p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 flex items-center gap-3 text-emerald-400 text-sm">
        <i class="fa-solid fa-circle-check text-lg"></i>
        <span>تم إرسال لوحة التذاكر بنجاح إلى القناة المحددة وحفظ إعدادات القناة!</span>
      </div>
    `;
  } else if (success === 'panel_sent_warn') {
    alertHtml = `
      <div class="mb-6 p-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 flex items-center gap-3 text-amber-400 text-sm">
        <i class="fa-solid fa-triangle-exclamation text-lg"></i>
        <span>تم إرسال لوحة التذاكر بنجاح! (تنبيه: تم تجاوز بعض الرموز التعبيرية أو النصوص المدخلة في حقل الإيموجي لكونها غير صالحة، وذلك لحماية لوحة التكت من التعطل).</span>
      </div>
    `;
  } else if (error === 'no_channel') {
    alertHtml = `
      <div class="mb-6 p-4 rounded-2xl border border-red-500/25 bg-red-500/10 flex items-center gap-3 text-red-400 text-sm">
        <i class="fa-solid fa-circle-exclamation text-lg"></i>
        <span>خطأ: يرجى تحديد روم إرسال لوحة التذاكر من القائمة المنسدلة قبل الإرسال.</span>
      </div>
    `;
  } else if (error === 'no_tickets') {
    alertHtml = `
      <div class="mb-6 p-4 rounded-2xl border border-red-500/25 bg-red-500/10 flex items-center gap-3 text-red-400 text-sm">
        <i class="fa-solid fa-circle-exclamation text-lg"></i>
        <span>خطأ: لا يمكن إرسال بنل تكت فارغ، يرجى إضافة تكتات وحفظها أولاً.</span>
      </div>
    `;
  } else if (error === 'channel_not_found') {
    alertHtml = `
      <div class="mb-6 p-4 rounded-2xl border border-red-500/25 bg-red-500/10 flex items-center gap-3 text-red-400 text-sm">
        <i class="fa-solid fa-circle-exclamation text-lg"></i>
        <span>خطأ: تعذر العثور على القناة المحددة في خوادم ديسكورد. تأكد من وجود الروم وصلاحيات البوت.</span>
      </div>
    `;
  } else if (error === 'missing_perms') {
    alertHtml = `
      <div class="mb-6 p-4 rounded-2xl border border-red-500/25 bg-red-500/10 flex items-center gap-3 text-red-400 text-sm">
        <i class="fa-solid fa-circle-exclamation text-lg"></i>
        <span>خطأ صلاحيات البوت: البوت يفتقد الصلاحيات التالية في الروم المحدد: <b class="text-white underline">${missingPerms}</b>. يرجى تفعيلها للبوت من إعدادات الروم بدقة ليعمل الإرسال.</span>
      </div>
    `;
  } else if (error === 'internal_error') {
    alertHtml = `
      <div class="mb-6 p-4 rounded-2xl border border-red-500/25 bg-red-500/10 flex items-center gap-3 text-red-400 text-sm">
        <i class="fa-solid fa-bug text-lg"></i>
        <span>خطأ داخلي من الكود: <b class="text-white">${exceptionMsg}</b>. يرجى مراجعة وتعديل قيم الإيموجيات أو الحقول المدخلة، والتحقق من سجلات الـ Console.</span>
      </div>
    `;
  }

  const menuItems = [
    { id: 'general', label: '⚙️ الإعدادات العامة', link: `/dashboard/${guild.id}` },
    { id: 'tickets', label: '🎫 نظام التكتات', link: `/dashboard/${guild.id}/tickets` },
    { id: 'auto-reply', label: '💬 الردود التلقائية', link: `/dashboard/${guild.id}/auto-reply` },
    { id: 'broadcast', label: '📢 نظام البث العام', link: `/dashboard/${guild.id}/broadcast` },
    { id: 'giveaway', label: '🎉 نظام القيف أواي', link: `/dashboard/${guild.id}/giveaway` },
    { id: 'welcome', label: '👋 نظام الترحيب', link: `/dashboard/${guild.id}/welcome` },
    { id: 'auto-role', label: '🛡️ الرتب التلقائية', link: `/dashboard/${guild.id}/auto-role` },
    { id: 'embed-sender', label: '✉️ مرسل الإمبد', link: `/dashboard/${guild.id}/embed-sender` }
  ];

  let sidebarHtml = '';
  menuItems.forEach(item => {
    const active = activePage === item.id 
      ? 'bg-amber-500/10 text-amber-400 border-amber-500' 
      : 'text-slate-400 border-transparent hover:bg-amber-500/5 hover:text-white';
    sidebarHtml += `
      <a href="${item.link}" class="flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-xl border-r-4 transition font-bold text-sm ${active}">
        <span>${item.label}</span>
      </a>
    `;
  });

  const body = `
    <div class="flex flex-col md:flex-row gap-8">
      <aside class="w-full md:w-1/4 glass p-6 rounded-3xl border border-slate-800 space-y-6 self-start">
        <div class="flex flex-col items-center pb-6 border-b border-amber-500/15">
          <img src="${botLogo}" class="w-20 h-20 rounded-full mb-3 shadow-lg shadow-amber-500/5 ring-2 ring-amber-500/30" />
          <h4 class="font-bold text-lg text-white text-center leading-snug">${botName}</h4>
          <span class="text-xs text-amber-500 font-bold mt-1">لوحة تحكم السيرفر</span>
        </div>
        <nav class="flex flex-col space-y-2">
          ${sidebarHtml}
        </nav>
      </aside>

      <section class="flex-grow w-full md:w-3/4 glass p-8 md:p-10 rounded-3xl border border-slate-800">
        ${alertHtml}
        ${content}
      </section>
    </div>
  `;

  return renderBaseHtml(guild.name, body, user);
}

module.exports = { startDashboard, app };