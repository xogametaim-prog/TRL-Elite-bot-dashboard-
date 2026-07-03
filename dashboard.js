const express = require('express');
const session = require('express-session');
const axios = require('axios');
const fs = require('fs');
const { ChannelType } = require('discord.js');

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-dashboard-key-123',
  resave: false,
  saveUninitialized: false
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function normalizeArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
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

  app.get('/login', (req, res) => {
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
    res.send(renderBaseHtml("الرئيسية", `
      <div class="text-center py-20">
        <h1 class="text-5xl font-black mb-6 glow">لوحة تحكم البوت الاحترافية</h1>
        <p class="text-slate-400 max-w-xl mx-auto mb-8">قم بإدارة وإعداد نظام التكتات والترحيب والردود التلقائية لسيرفرات الديسكورد الخاصة بك بواجهة فائقة السرعة والجمال.</p>
        <a href="/login" class="px-8 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-lg shadow-indigo-600/30">سجل دخولك الآن عبر Discord</a>
      </div>
    `, null));
  });

  app.get('/dashboard', checkAuth, (req, res) => {
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
            <label class="block mb-2 text-slate-400">روم إرسال بنل التكت</label>
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

  app.get('/dashboard/:guildId/tickets', checkAuth, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("البوت ليس متواجداً في هذا السيرفر!");

    const config = getGuildConfig(guild.id);
    const channels = guild.channels.cache;
    const roles = guild.roles.cache.filter(r => r.name !== '@everyone');

    const rolesJson = JSON.stringify(roles.map(r => ({ id: r.id, name: r.name })));
    const categoriesJson = JSON.stringify(channels.filter(c => c.type === ChannelType.GuildCategory).map(c => ({ id: c.id, name: c.name })));

    let ticketsHtml = '';
    const tickets = config.tickets || [];
    tickets.forEach((ticket, idx) => {
      const roleOptions = getRoleSelectOptions(roles, ticket.mentionRole);
      const catOptions = getSelectOptions(channels, ChannelType.GuildCategory, ticket.category);
      ticketsHtml += `
        <div class="glass p-6 rounded-2xl border border-slate-800 space-y-4 mb-6 ticket-card">
          <div class="flex justify-between items-center">
            <h4 class="font-bold text-lg text-indigo-400 card-title">تذكرة: ${ticket.name}</h4>
            <button type="button" onclick="this.closest('.ticket-card').remove();" class="text-red-500 hover:text-red-400 transition font-medium text-sm"><i class="fa-solid fa-trash"></i> إزالة</button>
          </div>
          <input type="hidden" name="id" value="${ticket.id || 'ticket_' + Date.now() + '_' + idx}" />
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">اسم الزر</label>
              <input type="text" name="name" value="${ticket.name}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" required />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Emoji</label>
              <input type="text" name="emoji" value="${ticket.emoji || '📩'}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">لون الزر</label>
              <select name="color" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">
                <option value="Primary" ${ticket.color === 'Primary' ? 'selected' : ''}>أزرق (Primary)</option>
                <option value="Secondary" ${ticket.color === 'Secondary' ? 'selected' : ''}>رمادي (Secondary)</option>
                <option value="Success" ${ticket.color === 'Success' ? 'selected' : ''}>أخضر (Success)</option>
                <option value="Danger" ${ticket.color === 'Danger' ? 'selected' : ''}>أحمر (Danger)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">الرتبة الممنشنة</label>
              <select name="mentionRole" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">${roleOptions}</select>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">الكاتيجوري المخصص</label>
              <select name="category" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">${catOptions}</select>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">صيغة اسم الروم</label>
              <input type="text" name="channelName" value="${ticket.channelName || 'ticket-{user}'}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">رسالة الترحيب بالتكت</label>
              <input type="text" name="welcomeMessage" value="${ticket.welcomeMessage || ''}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
          </div>
        </div>
      `;
    });

    const content = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">🎫 التحكم في التذاكر وأنواعها</h2>
        <button type="button" onclick="addNewTicketCard();" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition text-sm"><i class="fa-solid fa-plus"></i> إضافة نوع تكت جديد</button>
      </div>
      <form action="/dashboard/${guild.id}/tickets/save" method="POST" class="space-y-6">
        <div class="glass p-6 rounded-2xl border border-slate-800 mb-6 flex items-center justify-between">
          <div>
            <h4 class="font-bold text-white mb-1">الحد الأقصى للتكتات المفتوحة لكل عضو</h4>
            <p class="text-xs text-slate-400">حدد عدد التكتات التي يسمح للعضو الواحد بفتحها كحد أقصى.</p>
          </div>
          <input type="number" name="maxTickets" min="1" max="100" value="${config.maxTickets || '4'}" class="w-24 bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white text-center focus:outline-none focus:border-indigo-500" />
        </div>
        <div id="tickets-container">
          ${ticketsHtml}
        </div>
        <button type="submit" class="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition w-full">حفظ بنية التكتات بالكامل</button>
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
              <div class="flex justify-between items-center">
                <h4 class="font-bold text-lg text-indigo-400 card-title">تذكرة جديدة</h4>
                <button type="button" onclick="this.closest('.ticket-card').remove();" class="text-red-500 hover:text-red-400 transition font-medium text-sm"><i class="fa-solid fa-trash"></i> إزالة</button>
              </div>
              <input type="hidden" name="id" value="\${id}" />
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label class="block text-xs text-slate-400 mb-1">اسم الزر</label>
                  <input type="text" name="name" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" required />
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">Emoji</label>
                  <input type="text" name="emoji" value="📩" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" />
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">لون الزر</label>
                  <select name="color" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">
                    <option value="Primary">أزرق (Primary)</option>
                    <option value="Secondary">رمادي (Secondary)</option>
                    <option value="Success">أخضر (Success)</option>
                    <option value="Danger">أحمر (Danger)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">الرتبة الممنشنة</label>
                  <select name="mentionRole" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">
                    \${generateSelectOptions(rawRoles, "لا يوجد منشن (فارغ)")}
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs text-slate-400 mb-1">الكاتيجوري المخصص</label>
                  <select name="category" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">
                    \${generateSelectOptions(rawCategories, "لا يوجد تحديد (فارغ)")}
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">صيغة اسم الروم</label>
                  <input type="text" name="channelName" value="ticket-{user}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" />
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">رسالة الترحيب بالتكت</label>
                  <input type="text" name="welcomeMessage" value="أهلاً بك، تفضل بكتابة طلبك." class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" />
                </div>
              </div>
            </div>
          \`;
          container.insertAdjacentHTML('beforeend', cardHtml);
        }
      </script>
    `;

    res.send(renderGuildLayout(guild, "tickets", content, req.session.user));
  });

  app.get('/dashboard/:guildId/auto-reply', checkAuth, (req, res) => {
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
            <h4 class="font-bold text-lg text-indigo-400">رد تلقائي</h4>
            <button type="button" onclick="this.closest('.reply-card').remove();" class="text-red-500 hover:text-red-400 transition font-medium text-sm"><i class="fa-solid fa-trash"></i> إزالة</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">الكلمة المفتاحية</label>
              <input type="text" name="keyword" value="${reply.keyword}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" required />
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs text-slate-400 mb-1">الرد المبرمج</label>
              <input type="text" name="reply" value="${reply.reply}" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" required />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">مكان العمل</label>
              <select name="channel" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">${channelOptions}</select>
            </div>
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">حالة الرد</label>
            <select name="enabled" class="bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">
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
        <button type="button" onclick="addNewReplyCard();" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition text-sm"><i class="fa-solid fa-plus"></i> إضافة رد جديد</button>
      </div>
      <form action="/dashboard/${guild.id}/auto-reply/save" method="POST" class="space-y-6">
        <div id="replies-container">
          ${repliesHtml}
        </div>
        <button type="submit" class="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition w-full">حفظ جميع الردود</button>
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
                <h4 class="font-bold text-lg text-indigo-400">رد تلقائي جديد</h4>
                <button type="button" onclick="this.closest('.reply-card').remove();" class="text-red-500 hover:text-red-400 transition font-medium text-sm"><i class="fa-solid fa-trash"></i> إزالة</button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label class="block text-xs text-slate-400 mb-1">الكلمة المفتاحية</label>
                  <input type="text" name="keyword" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" required />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-xs text-slate-400 mb-1">الرد المبرمج</label>
                  <input type="text" name="reply" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white" required />
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">مكان العمل</label>
                  <select name="channel" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">
                    \    ${generateChannelOptions()}
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">حالة الرد</label>
                <select name="enabled" class="bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">
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

    res.send(renderGuildLayout(guild, "auto-reply", content, req.session.user));
  });

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
            <select name="enabled" class="bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">
              <option value="true" ${config.welcome?.enabled ? 'selected' : ''}>مفعّل</option>
              <option value="false" ${!config.welcome?.enabled ? 'selected' : ''}>معطّل</option>
            </select>
          </div>
          <hr class="border-slate-800" />
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block mb-2 text-slate-400">روم الترحيب</label>
              <select name="channelId" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white">${logChannelOptions}</select>
            </div>
            <div>
              <label class="block mb-2 text-slate-400">عمل منشن (Mention) للعضو عند الترحيب به</label>
              <select name="mentionUser" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white">
                <option value="true" ${config.welcome?.mentionUser ? 'selected' : ''}>نعم</option>
                <option value="false" ${!config.welcome?.mentionUser ? 'selected' : ''}>لا</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block mb-2 text-slate-400">رسالة الترحيب النصية</label>
            <textarea name="message" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white h-28 focus:outline-none focus:border-indigo-500">${config.welcome?.message || 'Welcome to the server, {user}!'}</textarea>
            <span class="text-xs text-slate-500">ملاحظة: يمكنك استخدام {user} لمنشن العضو، {server} لاسم السيرفر، {count} لعدد الأعضاء.</span>
          </div>
        </div>
        <button type="submit" class="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition">حفظ إعدادات الترحيب</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "welcome", content, req.session.user));
  });

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
            <select name="enabled" class="bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white">
              <option value="true" ${config.autoRole?.enabled ? 'selected' : ''}>مفعّل</option>
              <option value="false" ${!config.autoRole?.enabled ? 'selected' : ''}>معطّل</option>
            </select>
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
        </div>
        <button type="submit" class="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition">ارسل الرسالة الآن</button>
      </form>
    `;

    res.send(renderGuildLayout(guild, "embed-sender", content, req.session.user));
  });

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

  app.post('/dashboard/:guildId/tickets/save', checkAuth, (req, res) => {
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
        emoji: emojis[i] || '📩',
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

  app.post('/dashboard/:guildId/auto-reply/save', checkAuth, (req, res) => {
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

  app.post('/dashboard/:guildId/welcome/save', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    config.welcome = {
      enabled: req.body.enabled === 'true',
      channelId: req.body.channelId,
      mentionUser: req.body.mentionUser === 'true',
      message: req.body.message
    };
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/welcome`);
  });

  app.post('/dashboard/:guildId/auto-role/save', checkAuth, (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    config.autoRole = {
      enabled: req.body.enabled === 'true',
      roleId: req.body.roleId
    };
    client.saveConfig();
    res.redirect(`/dashboard/${req.params.guildId}/auto-role`);
  });

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

        await chan.send({ embeds: [embed] });
      } catch (err) {
        console.error("Failed to send embed via dashboard:", err);
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
      autoRole: {}
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

      <section class="flex-grow w-full md:w-3/4 glass p-8 md:p-10 rounded-3xl border border-slate-800">
        ${content}
      </section>
    </div>
  `;

  return renderBaseHtml(guild.name, body, user);
}

module.exports = { startDashboard, app };