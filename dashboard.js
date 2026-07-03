const express = require('express');
const session = require('express-session');
const axios = require('axios');
const fs = require('fs');
const { ChannelType } = require('discord.js');

const app = express();

// إعداد الجلسة (Session) لمعالجة تسجيل الدخول
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-dashboard-key-123',
  resave: false,
  saveUninitialized: false
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// تشغيل خادم الويب
function startDashboard(client) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[DASHBOARD] Web Server running on port ${PORT}`);
  });

  // التحقق من حالة تسجيل الدخول للمستخدم
  function checkAuth(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
  }

  // صفحة تسجيل الدخول (Discord OAuth2)
  app.get('/login', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.CALLBACK_URL);
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;
    res.redirect(discordAuthUrl);
  });

  // استرجاع الكود ومعالجة طلب المصادقة
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

  // تسجيل الخروج
  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
  });

  // الصفحة الرئيسية العامة
  app.get('/', (req, res) => {
    res.send(renderBaseHtml("الرئيسية", `
      <div class="text-center py-20">
        <h1 class="text-5xl font-black mb-6 glow">لوحة تحكم البوت الاحترافية</h1>
        <p class="text-slate-400 max-w-xl mx-auto mb-8">قم بإدارة وإعداد نظام التكتات والترحيب والردود التلقائية لسيرفرات الديسكورد الخاصة بك بواجهة فائقة السرعة والجمال.</p>
        <a href="/login" class="px-8 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-lg shadow-indigo-600/30">سجل دخولك الآن عبر Discord</a>
      </div>
    `, null));
  });

  // صفحة لوحة التحكم - اختيار السيرفرات
  app.get('/dashboard', checkAuth, (req, res) => {
    // تصفية السيرفرات التي يملك فيها صلاحية مدير أو إدارة السيرفر
    const adminGuilds = req.session.guilds.filter(g => (g.permissions & 0x8) === 0x8 || (g.permissions & 0x20) === 0x20);

    let guildsHtml = `<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">`;
    adminGuilds.forEach(g => {
      const isBotIn = client.guilds.cache.has(g.id);
      const guildIcon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
      guildsHtml += `
        <div class="glass p-6 rounded-2xl flex flex-col items-center justify-between text-center border border-slate-800 card-glow transition">
          <img src="${guildIcon}" class="w-20 h-20 rounded-full mb-4 ring-4 ring-indigo-500/20" />
          <h3 class="font-bold text-xl mb-4 text-white">${g.name}</h3>
          ${isBotIn ? `
            <a href="/dashboard/${g.id}" class="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition w-full">تعديل الإعدادات</a>
          ` : `
            <a href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${g.id}" target="_blank" class="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition w-full">دعوة البوت</a>
          `}
        </div>
      `;
    });
    guildsHtml += `</div>`;

    res.send(renderBaseHtml("سيرفراتك", `
      <h2 class="text-3xl font-bold mb-2">اختر السيرفر</h2>
      <p class="text-slate-400">اختر السيرفر الذي ترغب بتعديل لوحته وإعداداته.</p>
      ${guildsHtml}
    `, req.session.user));
  });

  // الصفحات الفرعية الخاصة بكل سيرفر
  app.get('/dashboard/:guildId', checkAuth, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const config = getGuildConfig(guild.id);
    const channels = guild.channels.cache;

    const logChannelOptions = getSelectOptions(channels, ChannelType.GuildText, config.general?.logsChannel);
    const ticketChannelOptions = getSelectOptions(channels, ChannelType.GuildText, config.general?.ticketChannel);
    const categoryOptions = getSelectOptions(channels, ChannelType.GuildCategory, config.general?.defaultCategory);

    const content = `
      <h2 class="text-2xl font-bold mb-6">⚙️ الإعدادات العامة للمشروع</h2>
      <form action="/dashboard/${guild.id}/save-general" method="POST" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block mb-2 text-slate-400">اسم البوت باللوحة</label>
            <input type="text" name="botName" value="${config.general?.botName || client.user.username}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label class="block mb-2 text-slate-400">شعار البوت باللوحة (URL)</label>
            <input type="text" name="botLogo" value="${config.general?.botLogo || client.user.displayAvatarURL()}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label class="block mb-2 text-slate-400">روم السجلات (Logs)</label>
            <select name="logsChannel" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500">${logChannelOptions}</select>
          </div>
          <div>
            <label class="block mb-2 text-slate-400">روم إرسال البنل</label>
            <select name="ticketChannel" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500">${ticketChannelOptions}</select>
          </div>
          <div>
            <label class="block mb-2 text-slate-400">الكاتيجوري الافتراضي للتكتات</label>
            <select name="defaultCategory" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500">${categoryOptions}</select>
          </div>
        </div>
        <button type="submit" class="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition">حفظ التغييرات</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "general", content, req.session.user));
  });

  // صفحة نظام التكتات (Ticket Dashboard)
  app.get('/dashboard/:guildId/tickets', checkAuth, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const config = getGuildConfig(guild.id);
    const channels = guild.channels.cache;
    const roles = guild.roles.cache.filter(r => r.name !== '@everyone');

    let ticketsHtml = '';
    const tickets = config.tickets || [];
    tickets.forEach((ticket, idx) => {
      const roleOptions = getRoleSelectOptions(roles, ticket.mentionRole);
      const catOptions = getSelectOptions(channels, ChannelType.GuildCategory, ticket.category);
      ticketsHtml += `
        <div class="glass p-6 rounded-2xl border border-slate-800 space-y-4 mb-6">
          <div class="flex justify-between items-center">
            <h4 class="font-bold text-lg text-indigo-400">تذكرة #${idx + 1}: ${ticket.name}</h4>
            <a href="/dashboard/${guild.id}/tickets/delete/${idx}" class="text-red-500 hover:text-red-400 transition font-medium text-sm"><i class="fa-solid fa-trash"></i> حذف النوع</a>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">اسم الزر</label>
              <input type="text" name="name[${idx}]" value="${ticket.name}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" required />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Emoji</label>
              <input type="text" name="emoji[${idx}]" value="${ticket.emoji || '📩'}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">لون الزر</label>
              <select name="color[${idx}]" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">
                <option value="Primary" ${ticket.color === 'Primary' ? 'selected' : ''}>أزرق (Primary)</option>
                <option value="Secondary" ${ticket.color === 'Secondary' ? 'selected' : ''}>رمادي (Secondary)</option>
                <option value="Success" ${ticket.color === 'Success' ? 'selected' : ''}>أخضر (Success)</option>
                <option value="Danger" ${ticket.color === 'Danger' ? 'selected' : ''}>أحمر (Danger)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">الرتبة الممنشنة</label>
              <select name="mentionRole[${idx}]" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">${roleOptions}</select>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">الكاتيجوري المخصص</label>
              <select name="category[${idx}]" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">${catOptions}</select>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">صيغة اسم الروم</label>
              <input type="text" name="channelName[${idx}]" value="${ticket.channelName || 'ticket-{user}'}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">رسالة الترحيب بالتكت</label>
              <input type="text" name="welcomeMessage[${idx}]" value="${ticket.welcomeMessage || ''}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
          </div>
        </div>
      `;
    });

    const content = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">🎫 التحكم في التذاكر وأنواعها</h2>
        <a href="/dashboard/${guild.id}/tickets/add" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition text-sm"><i class="fa-solid fa-plus"></i> إضافة نوع تكت جديد</a>
      </div>
      <form action="/dashboard/${guild.id}/tickets/save" method="POST" class="space-y-6">
        <div class="glass p-6 rounded-2xl border border-slate-800 mb-6 flex items-center justify-between">
          <div>
            <h4 class="font-bold text-white mb-1">الحد الأقصى للتكتات المفتوحة لكل عضو</h4>
            <p class="text-xs text-slate-400">حدد عدد التكتات التي يسمح للعضو الواحد بفتحها كحد أقصى.</p>
          </div>
          <input type="number" name="maxTickets" min="1" max="100" value="${config.maxTickets || '4'}" class="w-24 bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white text-center focus:outline-none focus:border-indigo-500" />
        </div>
        ${ticketsHtml || '<p class="text-slate-400 text-center py-10">لا يوجد أي تكت مهيأ حالياً، ابدأ بإضافة نوع تكت جديد.</p>'}
        <button type="submit" class="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition">حفظ بنية التكتات</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "tickets", content, req.session.user));
  });

  // صفحة نظام الردود التلقائية (Auto Reply)
  app.get('/dashboard/:guildId/auto-reply', checkAuth, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const config = getGuildConfig(guild.id);
    const channels = guild.channels.cache;

    let repliesHtml = '';
    const replies = config.autoReplies || [];
    replies.forEach((reply, idx) => {
      const channelOptions = `<option value="all" ${reply.channel === 'all' ? 'selected' : ''}>كل الرومات (All)</option>` + getSelectOptions(channels, ChannelType.GuildText, reply.channel);
      repliesHtml += `
        <div class="glass p-6 rounded-2xl border border-slate-800 space-y-4 mb-6">
          <div class="flex justify-between items-center">
            <h4 class="font-bold text-lg text-indigo-400">رد تلقائي #${idx + 1}</h4>
            <a href="/dashboard/${guild.id}/auto-reply/delete/${idx}" class="text-red-500 hover:text-red-400 transition font-medium text-sm"><i class="fa-solid fa-trash"></i> حذف الرد</a>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">الكلمة المفتاحية</label>
              <input type="text" name="keyword[${idx}]" value="${reply.keyword}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" required />
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs text-slate-400 mb-1">الرد المبرمج</label>
              <input type="text" name="reply[${idx}]" value="${reply.reply}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" required />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">مكان العمل</label>
              <select name="channel[${idx}]" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">${channelOptions}</select>
            </div>
          </div>
          <div class="flex items-center space-x-2 space-x-reverse">
            <input type="checkbox" name="enabled[${idx}]" value="true" ${reply.enabled ? 'checked' : ''} class="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded" />
            <label class="text-xs text-slate-300">تشغيل هذا الرد تلقائياً</label>
          </div>
        </div>
      `;
    });

    const content = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">💬 نظام الردود التلقائية (Auto Reply)</h2>
        <a href="/dashboard/${guild.id}/auto-reply/add" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition text-sm"><i class="fa-solid fa-plus"></i> إضافة رد جديد</a>
      </div>
      <form action="/dashboard/${guild.id}/auto-reply/save" method="POST" class="space-y-6">
        ${repliesHtml || '<p class="text-slate-400 text-center py-10">لا يوجد ردود تلقائية مهيأة حالياً، ابدأ بإضافة رد جديد.</p>'}
        <button type="submit" class="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition">حفظ وحفظ التعديلات</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "auto-reply", content, req.session.user));
  });

  // صفحة نظام الترحيب (Welcome System)
  app.get('/dashboard/:guildId/welcome', checkAuth, (req, res) => {
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
            <input type="checkbox" name="enabled" value="true" ${config.welcome?.enabled ? 'checked' : ''} class="w-6 h-6 text-indigo-600 bg-slate-900 border-slate-700 rounded" />
          </div>
          <hr class="border-slate-800" />
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400">روم الترحيب</label>
              <select name="channelId" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white">${logChannelOptions}</select>
            </div>
            <div class="flex items-center space-x-2 space-x-reverse mt-8">
              <input type="checkbox" name="mentionUser" value="true" ${config.welcome?.mentionUser ? 'checked' : ''} class="w-5 h-5 text-indigo-600 bg-slate-900 border-slate-700 rounded" />
              <label class="text-slate-300">عمل منشن (Mention) للعضو عند الترحيب به</label>
            </div>
          </div>
          <div>
            <label class="block mb-2 text-slate-400">رسالة الترحيب النصية (تظهر بجوار بطاقة الترحيب)</label>
            <textarea name="message" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white h-28 focus:outline-none focus:border-indigo-500">${config.welcome?.message || 'Welcome to the server, {user}!'}</textarea>
            <span class="text-xs text-slate-500">ملاحظة: يمكنك استخدام {user} لمنشن العضو، {server} لاسم السيرفر، {count} لعدد الأعضاء.</span>
          </div>
        </div>
        <button type="submit" class="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition">حفظ إعدادات الترحيب</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "welcome", content, req.session.user));
  });

  // صفحة نظام الرتبة التلقائية (Auto Role)
  app.get('/dashboard/:guildId/auto-role', checkAuth, (req, res) => {
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
            <input type="checkbox" name="enabled" value="true" ${config.autoRole?.enabled ? 'checked' : ''} class="w-6 h-6 text-indigo-600 bg-slate-900 border-slate-700 rounded" />
          </div>
          <hr class="border-slate-800" />
          <div>
            <label class="block mb-2 text-slate-400">الرتبة المحددة</label>
            <select name="roleId" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white">${roleOptions}</select>
          </div>
        </div>
        <button type="submit" class="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition">حفظ إعدادات الرتبة</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "auto-role", content, req.session.user));
  });

  // صفحة مرسل رسائل Embed (Embed Sender)
  app.get('/dashboard/:guildId/embed-sender', checkAuth, (req, res) => {
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
            <select name="channelId" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white">${textChannelOptions}</select>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400">عنوان الإمبد (Embed Title)</label>
              <input type="text" name="title" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white" />
            </div>
            <div>
              <label class="block mb-2 text-slate-400">اللون (Color / Hex Code)</label>
              <input type="text" name="color" placeholder="#4f46e5" value="#4f46e5" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white" />
            </div>
          </div>
          <div>
            <label class="block mb-2 text-slate-400">المحتوى / الوصف (Description)</label>
            <textarea name="description" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white h-32 focus:outline-none focus:border-indigo-500"></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400">الصورة الكبيرة (Image URL)</label>
              <input type="text" name="image" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white" />
            </div>
            <div>
              <label class="block mb-2 text-slate-400">الصورة الصغيرة (Thumbnail URL)</label>
              <input type="text" name="thumbnail" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white" />
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400">اسم كاتب الرسالة (Author)</label>
              <input type="text" name="author" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white" />
            </div>
            <div>
              <label class="block mb-2 text-slate-400">تذييل الرسالة (Footer)</label>
              <input type="text" name="footer" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white" />
            </div>
          </div>
        </div>
        <button type="submit" class="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition">ارسل الرسالة الآن</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "embed-sender", content, req.session.user));
  });

  // معالجة الحفظ التلقائي - الإعدادات العامة
  app.post('/dashboard/:guildId/save-general', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    config.general = {
      botName: req.body.botName,
      botLogo: req.body.botLogo,
      logsChannel: req.body.logsChannel,
      ticketChannel: req.body.ticketChannel,
      defaultCategory: req.body.defaultCategory,
      themeColor: config.general?.themeColor || '#4f46e5'
    };
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}`);
  });

  // معالجة حفظ التكتات
  app.post('/dashboard/:guildId/tickets/save', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    config.maxTickets = req.body.maxTickets || '4';

    const updatedTickets = [];
    const names = req.body.name || [];

    for (let i = 0; i < names.length; i++) {
      if (!req.body.name[i]) continue;
      updatedTickets.push({
        id: config.tickets[i]?.id || `ticket_${Date.now()}_${i}`,
        name: req.body.name[i],
        emoji: req.body.emoji[i] || '📩',
        color: req.body.color[i] || 'Primary',
        mentionRole: req.body.mentionRole[i] || '',
        category: req.body.category[i] || '',
        channelName: req.body.channelName[i] || 'ticket-{user}',
        welcomeMessage: req.body.welcomeMessage[i] || ''
      });
    }

    config.tickets = updatedTickets;
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/tickets`);
  });

  // إضافة نوع تكت جديد
  app.get('/dashboard/:guildId/tickets/add', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    if (!config.tickets) config.tickets = [];
    config.tickets.push({
      id: `ticket_${Date.now()}`,
      name: "دعم فني جديد",
      emoji: "📩",
      color: "Primary",
      mentionRole: "",
      category: "",
      channelName: "ticket-{user}",
      welcomeMessage: "أهلاً بك، تفضل بكتابة طلبك."
    });
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/tickets`);
  });

  // حذف نوع تكت
  app.get('/dashboard/:guildId/tickets/delete/:index', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    const idx = parseInt(req.params.index);
    if (config.tickets && config.tickets[idx]) {
      config.tickets.splice(idx, 1);
      client.saveConfig();
    }
    res.redirect(`/dashboard/${req.params.guildId}/tickets`);
  });

  // معالجة حفظ الردود التلقائية
  app.post('/dashboard/:guildId/auto-reply/save', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    const updatedReplies = [];
    const keywords = req.body.keyword || [];

    for (let i = 0; i < keywords.length; i++) {
      if (!req.body.keyword[i]) continue;
      updatedReplies.push({
        keyword: req.body.keyword[i],
        reply: req.body.reply[i],
        channel: req.body.channel[i] || 'all',
        enabled: req.body.enabled && req.body.enabled[i] === 'true' ? true : false
      });
    }

    config.autoReplies = updatedReplies;
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/auto-reply`);
  });

  // إضافة رد تلقائي جديد
  app.get('/dashboard/:guildId/auto-reply/add', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    if (!config.autoReplies) config.autoReplies = [];
    config.autoReplies.push({
      keyword: "السلام عليكم",
      reply: "وعليكم السلام ورحمة الله وبركاته.",
      channel: "all",
      enabled: true
    });
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/auto-reply`);
  });

  // حذف رد تلقائي
  app.get('/dashboard/:guildId/auto-reply/delete/:index', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    const idx = parseInt(req.params.index);
    if (config.autoReplies && config.autoReplies[idx]) {
      config.autoReplies.splice(idx, 1);
      client.saveConfig();
    }
    res.redirect(`/dashboard/${req.params.guildId}/auto-reply`);
  });

  // حفظ إعدادات الترحيب
  app.post('/dashboard/:guildId/welcome/save', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    config.welcome = {
      enabled: req.body.enabled === 'true' || req.body.enabled === 'on',
      channelId: req.body.channelId,
      mentionUser: req.body.mentionUser === 'true' || req.body.mentionUser === 'on',
      message: req.body.message
    };
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/welcome`);
  });

  // حفظ إعدادات الرتبة التلقائية
  app.post('/dashboard/:guildId/auto-role/save', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    config.autoRole = {
      enabled: req.body.enabled === 'true' || req.body.enabled === 'on',
      roleId: req.body.roleId
    };
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/auto-role`);
  });

  // إرسال الإمبد مباشرة
  app.post('/dashboard/:guildId/embed-sender/send', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("السيرفر غير متوفر.");

    const chan = guild.channels.cache.get(req.body.channelId);
    if (chan) {
      try {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder().setColor(req.body.color || '#4f46e5');

        if (req.body.title) embed.setTitle(req.body.title);
        if (req.body.description) embed.setDescription(req.body.description);
        if (req.body.image) embed.setImage(req.body.image);
        if (req.body.thumbnail) embed.setThumbnail(req.body.thumbnail);
        if (req.body.author) embed.setAuthor({ name: req.body.author });
        if (req.body.footer) embed.setFooter({ text: req.body.footer });

        await chan.send({ embeds: [embed] });
      } catch (err) {
        console.error("Failed to send embed via dashboard:", err);
      }
    }
    res.redirect(`/dashboard/${req.params.guildId}/embed-sender`);
  });
}

// ميكانيكية استخلاص البيانات من config لكل سيرفر
function getGuildConfig(guildId) {
  if (!app.client) return {};
  if (!app.client.config.guilds[guildId]) {
    app.client.config.guilds[guildId] = {
      general: {},
      tickets: [],
      autoReplies: [],
      welcome: {},
      autoRole: {}
    };
  }
  return app.client.config.guilds[guildId];
}

// توليد خيارات الاختيار (Select Menus Options) للرومات والكاتيجوري ديناميكياً
function getSelectOptions(channels, type, selectedId) {
  let options = '<option value="">لا يوجد تحديد (فارغ)</option>';
  const filtered = channels.filter(c => c.type === type);
  filtered.forEach(c => {
    options += `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}># ${c.name}</option>`;
  });
  return options;
}

// توليد خيارات اختيار الرتب (Roles Select Menu Options) ديناميكياً
function getRoleSelectOptions(roles, selectedId) {
  let options = '<option value="">لا يوجد منشن (فارغ)</option>';
  roles.forEach(r => {
    options += `<option value="${r.id}" ${selectedId === r.id ? 'selected' : ''}>@ ${r.name}</option>`;
  });
  return options;
}

// القالب الهيكلي لتصميم لوحة التحكم الرئيسي (Base HTML - Glassmorphism UI)
function renderBaseHtml(title, body, user) {
  const userSection = user ? `
    <div class="flex items-center space-x-3 space-x-reverse">
      <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" class="w-10 h-10 rounded-full" />
      <div class="text-right">
        <h5 class="text-sm font-bold text-white">${user.username}</h5>
        <a href="/logout" class="text-xs text-red-500 hover:text-red-400">تسجيل الخروج</a>
      </div>
    </div>
  ` : `<a href="/login" class="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition text-sm">تسجيل دخول</a>`;

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
        body { font-family: 'Tajawal', sans-serif; background-color: #030712; color: #f3f4f6; }
        .glass { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
        .glow { text-shadow: 0 0 15px rgba(99, 102, 241, 0.5); }
        .card-glow:hover { border-color: rgba(99, 102, 241, 0.4); box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.15); }
      </style>
    </head>
    <body class="min-h-screen flex flex-col">
      <nav class="glass border-b border-slate-800 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50">
        <div class="flex items-center space-x-4 space-x-reverse">
          <i class="fa-solid fa-headset text-indigo-500 text-3xl"></i>
          <span class="text-xl font-black text-white tracking-wider">Discord Ticket Pro</span>
        </div>
        ${userSection}
      </nav>
      <main class="flex-grow max-w-7xl w-full mx-auto p-6 md:p-12">
        ${body}
      </main>
      <footer class="glass border-t border-slate-800 text-center py-6 text-slate-500 text-xs">
        &copy; 2026 Discord Ticket Pro. جميع الحقوق محفوظة.
      </footer>
    </body>
    </html>
  `;
}

// القالب الهيكلي لإعدادات السيرفر الفردي (Sidebar + Content - Glassmorphism)
function renderGuildLayout(guild, activePage, content, user) {
  const config = getGuildConfig(guild.id);
  const botLogo = config.general?.botLogo || guild.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png';
  const botName = config.general?.botName || guild.name;

  const menuItems = [
    { id: 'general', label: '⚙️ الإعدادات العامة', link: `/dashboard/${guild.id}` },
    { id: 'tickets', label: '🎫 نظام التكتات', link: `/dashboard/${guild.id}/tickets` },
    { id: 'auto-reply', label: '💬 الردود التلقائية', link: `/dashboard/${guild.id}/auto-reply` },
    { id: 'welcome', label: '👋 نظام الترحيب', link: `/dashboard/${guild.id}/welcome` },
    { id: 'auto-role', label: '🛡️ الرتب التلقائية', link: `/dashboard/${guild.id}/auto-role` },
    { id: 'embed-sender', label: '✉️ مرسل الإمبد', link: `/dashboard/${guild.id}/embed-sender` }
  ];

  let sidebarHtml = '';
  menuItems.forEach(item => {
    const active = activePage === item.id ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-white';
    sidebarHtml += `
      <a href="${item.link}" class="flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-xl border-r-4 transition font-semibold text-sm ${active}">
        <span>${item.label}</span>
      </a>
    `;
  });

  const body = `
    <div class="flex flex-col md:flex-row gap-8">
      <!-- الـ Sidebar -->
      <aside class="w-full md:w-1/4 glass p-6 rounded-3xl border border-slate-800 space-y-6 self-start">
        <div class="flex flex-col items-center pb-6 border-b border-slate-800">
          <img src="${botLogo}" class="w-20 h-20 rounded-full mb-3 shadow-lg shadow-indigo-600/10 ring-2 ring-slate-800" />
          <h4 class="font-bold text-lg text-white text-center leading-snug">${botName}</h4>
          <span class="text-xs text-indigo-400 font-semibold mt-1">لوحة تحكم السيرفر</span>
        </div>
        <nav class="flex flex-col space-y-2">
          ${sidebarHtml}
        </nav>
      </aside>

      <!-- محتوى الإعدادات -->
      <section class="flex-grow w-full md:w-3/4 glass p-8 md:p-10 rounded-3xl border border-slate-800">
        ${content}
      </section>
    </div>
  `;

  return renderBaseHtml(guild.name, body, user);
}

module.exports = { startDashboard, app };