// استيراد المكتبات الأساسية لـ ديسكورد والويب
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const fs = require('fs');
const path = require('path');

// التحقق من متغيرات البيئة الأساسية (تم الاستغناء عن GUILD_ID الثابت)
const requiredEnv = ['DISCORD_TOKEN', 'CLIENT_ID', 'CLIENT_SECRET', 'CALLBACK_URL', 'SESSION_SECRET'];
requiredEnv.forEach(env => {
    if (!process.env[env]) {
        console.warn(`[WARNING] Missing environment variable: ${env}`);
    }
});

const configPath = path.join(__dirname, 'config.json');

// دالة لقراءة إعدادات السيرفر المحدد من config.json بشكل آمن ومستقل
function getGuildConfig(guildId) {
    let fullConfig = {};
    try {
        if (fs.existsSync(configPath)) {
            fullConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (err) {
        console.error("خطأ في قراءة ملف الإعدادات: ", err);
    }

    // إذا لم تكن هناك إعدادات لهذا السيرفر، يتم إنشاء إعدادات افتراضية له
    if (!fullConfig[guildId]) {
        fullConfig[guildId] = {
            logsChannelId: "",
            embedChannelId: "",
            defaultCategoryId: "",
            dashboardColor: "#3b82f6",
            botDisplayName: "نظام التكت المتكامل",
            embed: {
                title: "نظام الدعم الفني والمساعدة",
                description: "يرجى الضغط على أحد الأزرار بالأسفل لفتح تكت تواصل جديدة مع قسم الدعم الفني.",
                color: "#3b82f6",
                author: "قسم المساعدة",
                footer: "نحن هنا لمساعدتكم",
                thumbnail: "",
                image: "",
                timestamp: true
            },
            buttons: [
                {
                    label: "الدعم الفني العامة",
                    emoji: "🎫",
                    style: "PRIMARY",
                    ticketName: "ticket-{username}",
                    mentionRole: "",
                    categoryId: "",
                    welcomeMessage: "مرحباً {user} في تكت الدعم الفني! يرجى طرح مشكلتك مباشرة وسيقوم الفريق بالرد عليك قريباً."
                }
            ],
            activeEmbedMessageId: ""
        };
        // حفظ الإعدادات الافتراضية فوراً في الملف
        fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2), 'utf8');
    }

    return fullConfig[guildId];
}

// دالة لحفظ وتحديث إعدادات السيرفر المحدد في config.json
function saveGuildConfig(guildId, guildConfig) {
    let fullConfig = {};
    try {
        if (fs.existsSync(configPath)) {
            fullConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (err) {
        console.error("خطأ في قراءة ملف الإعدادات قبل الحفظ: ", err);
    }

    fullConfig[guildId] = guildConfig;

    try {
        fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2), 'utf8');
    } catch (err) {
        console.error("خطأ في كتابة ملف الإعدادات: ", err);
    }
}

// تهيئة بوت الديسكورد
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// تهيئة خادم الويب Express
const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-multi-guild-key',
    resave: false,
    saveUninitialized: false
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

// جدار حماية للتحقق من تسجيل الدخول
function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

// جدار حماية يفحص صلاحيات المستخدم في السيرفر المطلوب ديناميكياً عبر الرابط (URL Parameters)
function checkGuildAccess(req, res, next) {
    const guildId = req.params.guildId;
    if (!guildId) return res.redirect('/dashboard');

    const userGuilds = req.user.guilds;
    const targetGuild = userGuilds.find(g => g.id === guildId);
    
    if (!targetGuild) {
        return res.status(403).send("عذراً، أنت لست عضواً في هذا السيرفر.");
    }

    // التحقق من امتلاك صلاحية Administrator (0x8) أو Manage Guild (0x20)
    const permissions = Number(targetGuild.permissions);
    const isAdmin = (permissions & 0x8) === 0x8;
    const isManageGuild = (permissions & 0x20) === 0x20;

    if (isAdmin || isManageGuild) {
        // التحقق من وجود البوت بالفعل داخل هذا السيرفر لتجنب الأخطاء البرمجية
        const botInGuild = client.guilds.cache.has(guildId);
        if (!botInGuild) {
            return res.status(403).send(`
                <h3>البوت غير موجود في هذا السيرفر!</h3>
                <p>يرجى دعوة البوت أولاً إلى السيرفر لتتمكن من إدارته.</p>
                <a href="https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&integration_type=0&scope=bot+applications.commands" class="btn btn-primary" target="_blank">دعوة البوت من هنا</a>
            `);
        }
        return next();
    }
    return res.status(403).send("عذراً، لا تمتلك الصلاحيات الإدارية الكافية لإدارة هذا السيرفر من لوحة التحكم.");
}

// تصميم الهيكل الخارجي الموحد للداشبورد المطور ليدعم تعدد السيرفرات
function renderDashboard(content, activeTab, req, currentGuildId = null) {
    const user = req.user;
    const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
    
    // جلب الإعدادات الخاصة بالسيرفر الحالي أو الإعدادات الافتراضية
    const config = currentGuildId ? getGuildConfig(currentGuildId) : {};
    const botName = config.botDisplayName || "نظام التكت";
    const botColor = config.dashboardColor || "#3b82f6";

    // روابط السيرفر المحدد أو روابط عامة
    const homeLink = currentGuildId ? `/dashboard/${currentGuildId}` : '/dashboard';
    const ticketLink = currentGuildId ? `/dashboard/${currentGuildId}/ticket-msg` : '#';
    const settingsLink = currentGuildId ? `/dashboard/${currentGuildId}/settings` : '#';

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${botName} - لوحة التحكم</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
        <style>
            :root {
                --bg-dark: #0f172a;
                --bg-sidebar: #1e293b;
                --accent-color: ${botColor};
                --text-light: #f8fafc;
                --text-muted: #94a3b8;
            }
            body {
                background-color: var(--bg-dark);
                color: var(--text-light);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            .sidebar {
                background-color: var(--bg-sidebar);
                min-height: 100vh;
                width: 280px;
                position: fixed;
                top: 0;
                bottom: 0;
                right: 0;
                z-index: 100;
                border-left: 1px solid #334155;
                transition: all 0.3s;
            }
            .main-content {
                margin-right: 280px;
                padding: 2rem;
                transition: all 0.3s;
            }
            @media (max-width: 991.98px) {
                .sidebar { right: -280px; }
                .sidebar.active { right: 0; }
                .main-content { margin-right: 0; }
            }
            .nav-link {
                color: var(--text-muted);
                padding: 0.75rem 1.5rem;
                border-radius: 0.375rem;
                margin: 0.25rem 1rem;
                display: flex;
                align-items: center;
                gap: 12px;
                transition: all 0.2s;
            }
            .nav-link:hover, .nav-link.active {
                background-color: var(--accent-color);
                color: #fff !important;
            }
            .nav-link.disabled {
                opacity: 0.4;
                pointer-events: none;
            }
            .card-custom {
                background-color: var(--bg-sidebar);
                border: 1px solid #334155;
                border-radius: 0.75rem;
                margin-bottom: 1.5rem;
            }
            .card-custom .card-header {
                background-color: rgba(0,0,0,0.1);
                border-bottom: 1px solid #334155;
                padding: 1rem 1.5rem;
                font-weight: 600;
            }
            .card-custom .card-body { padding: 1.5rem; }
            .discord-preview {
                background-color: #2f3136;
                border-radius: 4px;
                padding: 16px;
                border-right: 4px solid var(--accent-color);
                color: #dcddde;
            }
            .discord-preview-title { color: #fff; font-weight: 600; font-size: 1rem; margin-bottom: 8px; }
            .discord-preview-desc { font-size: 0.875rem; line-height: 1.375; white-space: pre-wrap; }
            .discord-preview-footer { font-size: 0.75rem; color: #72767d; margin-top: 8px; }
            .discord-preview-author { font-size: 0.875rem; font-weight: 600; color: #fff; margin-bottom: 4px; }
            .discord-preview-thumbnail { float: left; max-width: 60px; max-height: 60px; border-radius: 4px; }
            .discord-preview-image { max-width: 100%; border-radius: 4px; margin-top: 8px; }
            .discord-btn {
                padding: 6px 16px;
                border-radius: 3px;
                font-size: 0.875rem;
                font-weight: 500;
                border: none;
                color: white;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin: 4px;
            }
            .discord-btn-primary { background-color: #5865f2; }
            .discord-btn-secondary { background-color: #4f545c; }
            .discord-btn-success { background-color: #3ba55d; }
            .discord-btn-danger { background-color: #ed4245; }
        </style>
    </head>
    <body>
        <nav class="navbar navbar-expand-lg d-lg-none bg-dark border-bottom border-secondary p-3">
            <button class="btn btn-outline-light" id="sidebarToggle">
                <i class="bi bi-list"></i>
            </button>
            <span class="navbar-brand text-light ms-3">${botName}</span>
        </nav>

        <div class="sidebar" id="sidebar">
            <div class="p-4 border-bottom border-secondary d-flex align-items-center gap-3">
                <img src="${avatarUrl}" alt="Avatar" class="rounded-circle" width="45" height="45">
                <div>
                    <div class="fw-bold text-truncate" style="max-width: 180px;">${user.username}</div>
                    <small class="text-success"><i class="bi bi-circle-fill" style="font-size: 8px;"></i> متصل</small>
                </div>
            </div>
            <div class="py-3">
                <a href="/dashboard" class="nav-link ${activeTab === 'select' ? 'active' : ''}">
                    <i class="bi bi-arrow-left-right"></i> تغيير السيرفر
                </a>
                <a href="${homeLink}" class="nav-link ${activeTab === 'home' ? 'active' : ''} ${!currentGuildId ? 'disabled' : ''}">
                    <i class="bi bi-speedometer2"></i> الرئيسية للتحكم
                </a>
                <a href="${ticketLink}" class="nav-link ${activeTab === 'ticket' ? 'active' : ''} ${!currentGuildId ? 'disabled' : ''}">
                    <i class="bi bi-chat-square-text"></i> تصميم الرسالة والأزرار
                </a>
                <a href="${settingsLink}" class="nav-link ${activeTab === 'settings' ? 'active' : ''} ${!currentGuildId ? 'disabled' : ''}">
                    <i class="bi bi-gear"></i> إعدادات التحكم والقنوات
                </a>
                <hr class="mx-3 border-secondary">
                <a href="/logout" class="nav-link text-danger">
                    <i class="bi bi-box-arrow-right"></i> تسجيل الخروج
                </a>
            </div>
        </div>

        <div class="main-content">
            ${content}
        </div>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        <script>
            const sidebar = document.getElementById('sidebar');
            const sidebarToggle = document.getElementById('sidebarToggle');
            if (sidebarToggle) {
                sidebarToggle.addEventListener('click', () => {
                    sidebar.classList.toggle('active');
                });
            }
        </script>
    </body>
    </html>
    `;
}

// ==================== مسارات EXPRESS ====================

// الصفحة الرئيسية لتسجيل الدخول
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>تسجيل الدخول - نظام التكت المتعدد</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
        <style>
            body {
                background-color: #0f172a;
                color: #f8fafc;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                font-family: 'Segoe UI', sans-serif;
            }
            .login-card {
                background-color: #1e293b;
                border: 1px solid #334155;
                border-radius: 1rem;
                padding: 3rem;
                text-align: center;
                max-width: 480px;
                width: 100%;
                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            }
            .btn-discord {
                background-color: #5865f2;
                color: white;
                font-weight: 600;
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                display: inline-flex;
                align-items: center;
                gap: 10px;
                text-decoration: none;
                transition: 0.2s;
            }
            .btn-discord:hover { background-color: #4752c4; color: white; }
        </style>
    </head>
    <body>
        <div class="login-card">
            <i class="bi bi-server text-primary" style="font-size: 4.5rem;"></i>
            <h2 class="my-3">لوحة تحكم التكت المتعددة</h2>
            <p class="text-muted mb-4">بوابة تسجيل دخول آمنة للمسؤولين. تمكنك اللوحة من اختيار أي سيرفر تملكه وإدارته وتخصيصه بشكل منفصل.</p>
            <a href="/login" class="btn btn-discord">
                <i class="bi bi-discord"></i> تسجيل الدخول بواسطة ديسكورد
            </a>
        </div>
    </body>
    </html>
    `);
});

// توجيه OAuth2
app.get('/login', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/dashboard');
});

app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

// صفحة اختيار السيرفر (Server Selector)
app.get('/dashboard', checkAuth, (req, res) => {
    const userGuilds = req.user.guilds;
    
    // تصفية السيرفرات التي يملك فيها المستخدم صلاحيات إدارية (Admin: 0x8 أو Manage Server: 0x20)
    const adminGuilds = userGuilds.filter(g => {
        const perms = Number(g.permissions);
        return (perms & 0x8) === 0x8 || (perms & 0x20) === 0x20;
    });

    let guildsListHtml = '';
    adminGuilds.forEach(g => {
        const botInGuild = client.guilds.cache.has(g.id);
        const iconUrl = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        guildsListHtml += `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card card-custom h-100 text-center">
                <div class="card-body d-flex flex-column align-items-center justify-content-between">
                    <img src="${iconUrl}" alt="${g.name}" class="rounded-circle mb-3 border border-secondary" width="70" height="70">
                    <h5 class="card-title text-truncate w-100 mb-3">${g.name}</h5>
                    ${botInGuild ? `
                        <a href="/dashboard/${g.id}" class="btn btn-success w-100">دخول لوحة التحكم <i class="bi bi-box-arrow-in-left"></i></a>
                    ` : `
                        <a href="https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&integration_type=0&scope=bot+applications.commands" class="btn btn-primary w-100" target="_blank">دعوة البوت أولاً <i class="bi bi-plus-lg"></i></a>
                    `}
                </div>
            </div>
        </div>
        `;
    });

    const content = `
    <div class="container-fluid">
        <h2 class="h3 mb-2">اختر السيرفر المراد إدارته</h2>
        <p class="text-muted mb-4">جميع السيرفرات بالأسفل تملك فيها رتبة إدارية لإدارتها وتخصيص نظام التذاكر الخاص بها.</p>
        <div class="row">
            ${guildsListHtml || '<div class="col-12 text-center text-muted py-5"><p>لا توجد سيرفرات تملك فيها صلاحيات إدارية كافية حالياً.</p></div>'}
        </div>
    </div>
    `;

    res.send(renderDashboard(content, 'select', req));
});

// الصفحة الرئيسية لإحصائيات السيرفر المحدد
app.get('/dashboard/:guildId', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    
    let openTickets = 0;
    if (guild) {
        openTickets = guild.channels.cache.filter(c => c.name.startsWith('ticket-')).size;
    }
    
    const ping = client.ws.ping;
    const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const uptime = Math.floor(client.uptime / 60000);

    const content = `
    <div class="container-fluid">
        <div class="mb-4">
            <h2 class="h3 mb-1">الرئيسية للسيرفر: ${guild.name}</h2>
            <p class="text-muted">أنت تدير الآن إعدادات هذا السيرفر المستقلة بالكامل.</p>
        </div>
        
        <div class="row">
            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card card-custom h-100 border-start border-primary border-4">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col">
                                <div class="text-xs text-primary text-uppercase mb-1">حالة البوت</div>
                                <div class="h5 mb-0 fw-bold">متصل 🟢</div>
                            </div>
                            <div class="col-auto"><i class="bi bi-robot text-secondary" style="font-size: 2rem;"></i></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card card-custom h-100 border-start border-success border-4">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col">
                                <div class="text-xs text-success text-uppercase mb-1">إجمالي السيرفرات</div>
                                <div class="h5 mb-0 fw-bold">${client.guilds.cache.size}</div>
                            </div>
                            <div class="col-auto"><i class="bi bi-server text-secondary" style="font-size: 2rem;"></i></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card card-custom h-100 border-start border-info border-4">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col">
                                <div class="text-xs text-info text-uppercase mb-1">تكتات السيرفر المفتوحة</div>
                                <div class="h5 mb-0 fw-bold">${openTickets}</div>
                            </div>
                            <div class="col-auto"><i class="bi bi-chat-dots text-secondary" style="font-size: 2rem;"></i></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card card-custom h-100 border-start border-warning border-4">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col">
                                <div class="text-xs text-warning text-uppercase mb-1">أعضاء هذا السيرفر</div>
                                <div class="h5 mb-0 fw-bold">${guild.memberCount}</div>
                            </div>
                            <div class="col-auto"><i class="bi bi-people text-secondary" style="font-size: 2rem;"></i></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mt-4">
            <div class="col-lg-6">
                <div class="card card-custom">
                    <div class="card-header">معلومات نظام التشغيل والأداء</div>
                    <div class="card-body">
                        <table class="table table-dark table-hover table-borderless m-0">
                            <tbody>
                                <tr>
                                    <td>وقت التشغيل الكلي (Uptime)</td>
                                    <td class="text-end text-info">${uptime} دقيقة</td>
                                </tr>
                                <tr>
                                    <td>سرعة الاستجابة (Ping)</td>
                                    <td class="text-end text-info">${ping} ms</td>
                                </tr>
                                <tr>
                                    <td>استهلاك ذاكرة الرام (RAM)</td>
                                    <td class="text-end text-info">${ramUsage} MB</td>
                                </tr>
                                <tr>
                                    <td>إصدار المكتبة الأساسي</td>
                                    <td class="text-end text-info">discord.js v14</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card card-custom">
                    <div class="card-header">بدء الاستخدام وتصميم الأزرار</div>
                    <div class="card-body">
                        <p>أنت الآن في لوحة الإدارة المستقلة. يتيح لك النظام الحالي للتحكم بـ:</p>
                        <ul>
                            <li>تخصيص رومات الإرسال واللوج والكاتيجوري الخاص بهذا السيرفر بشكل مستقل.</li>
                            <li>تصميم وبناء رسالة التكت الخاصة بهذا السيرفر مع معاينة مباشرة وتعديلها أو حذفها بأي وقت.</li>
                        </ul>
                        <div class="d-grid mt-4">
                            <a href="/dashboard/${guildId}/ticket-msg" class="btn btn-primary">تعديل وتصميم رسالة التكت للسيرفر</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    res.send(renderDashboard(content, 'home', req, guildId));
});

// صفحة الإعدادات العامة للسيرفر المحدد
app.get('/dashboard/:guildId/settings', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    const successMsg = req.query.success === 'true' ? `
        <div class="alert alert-success alert-dismissible fade show" role="alert">
            تم حفظ إعدادات السيرفر بنجاح في ملف config.json.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    ` : '';

    const content = `
    <div class="container-fluid">
        <h2 class="h3 mb-4">إعدادات قنوات وهيكل التكت لسيرفرك</h2>
        ${successMsg}
        
        <form action="/dashboard/${guildId}/settings" method="POST">
            <div class="row">
                <div class="col-lg-8">
                    <div class="card card-custom">
                        <div class="card-header">الإعدادات العامة لقنوات السيرفر</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">معرف روم السجلات واللوق (Logs Channel ID)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="logsChannelId" value="${config.logsChannelId || ''}" placeholder="أدخل ID قناة السجلات">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">معرف روم إرسال رسالة التكت (Embed Channel ID)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="embedChannelId" value="${config.embedChannelId || ''}" placeholder="أدخل ID قناة الرسالة الأساسية">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">معرف الكاتيجوري الافتراضي لإنشاء التكتات (Default Category ID)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="defaultCategoryId" value="${config.defaultCategoryId || ''}" placeholder="أدخل ID التصنيف الافتراضي">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">اسم البوت ومسؤول النظام بالواجهات</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="botDisplayName" value="${config.botDisplayName || ''}" placeholder="أدخل اسم البوت الظاهر بالداشبورد">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">لون تمييز الداشبورد والأزرار المخصصة</label>
                                <input type="color" class="form-control form-control-color bg-dark border-secondary w-100" name="dashboardColor" value="${config.dashboardColor || '#3b82f6'}">
                            </div>
                            <button type="submit" class="btn btn-primary px-4 mt-3">حفظ الإعدادات</button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </div>
    `;
    res.send(renderDashboard(content, 'settings', req, guildId));
});

// حفظ إعدادات السيرفر المحدد
app.post('/dashboard/:guildId/settings', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    config.logsChannelId = req.body.logsChannelId;
    config.embedChannelId = req.body.embedChannelId;
    config.defaultCategoryId = req.body.defaultCategoryId;
    config.botDisplayName = req.body.botDisplayName;
    config.dashboardColor = req.body.dashboardColor;
    
    saveGuildConfig(guildId, config);
    res.redirect(`/dashboard/${guildId}/settings?success=true`);
});

// صفحة تعديل وتخصيص Embed وبناء الأزرار للسيرفر المحدد
app.get('/dashboard/:guildId/ticket-msg', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    const success = req.query.success === 'true' ? `
        <div class="alert alert-success alert-dismissible fade show" role="alert">
            تم حفظ إعدادات الرسالة والأزرار بنجاح.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    ` : '';
    
    const actionStatus = req.query.actionStatus ? `
        <div class="alert alert-info alert-dismissible fade show" role="alert">
            نتيجة الإجراء: ${decodeURIComponent(req.query.actionStatus)}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    ` : '';

    let buttonsHtml = '';
    for (let i = 0; i < 5; i++) {
        const btn = config.buttons && config.buttons[i] ? config.buttons[i] : {
            label: '', emoji: '', style: 'PRIMARY', ticketName: 'ticket-{username}', mentionRole: '', categoryId: '', welcomeMessage: ''
        };
        buttonsHtml += `
        <div class="accordion-item bg-dark border-secondary text-white mb-3">
            <h2 class="accordion-header" id="headingBtn${i}">
                <button class="accordion-button collapsed bg-secondary text-white" type="button" data-bs-toggle="collapse" data-bs-target="#collapseBtn${i}" aria-expanded="false" aria-controls="collapseBtn${i}">
                    الزر رقم ${i+1}: ${btn.label || 'غير نشط (اترك اسم الزر فارغاً للإيقاف)'}
                </button>
            </h2>
            <div id="collapseBtn${i}" class="accordion-collapse collapse" aria-labelledby="headingBtn${i}" data-bs-parent="#buttonsAccordion">
                <div class="accordion-body">
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">اسم الزر (Label)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary btn-label-input" data-index="${i}" name="btn_${i}_label" value="${btn.label || ''}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">إيموجي الزر (Emoji)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary btn-emoji-input" data-index="${i}" name="btn_${i}_emoji" value="${btn.emoji || ''}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">لون الزر (Style)</label>
                            <select class="form-select bg-dark text-white border-secondary btn-style-input" data-index="${i}" name="btn_${i}_style">
                                <option value="PRIMARY" ${btn.style === 'PRIMARY' ? 'selected' : ''}>أزرق (Primary)</option>
                                <option value="SECONDARY" ${btn.style === 'SECONDARY' ? 'selected' : ''}>رمادي (Secondary)</option>
                                <option value="SUCCESS" ${btn.style === 'SUCCESS' ? 'selected' : ''}>أخضر (Success)</option>
                                <option value="DANGER" ${btn.style === 'DANGER' ? 'selected' : ''}>أحمر (Danger)</option>
                            </select>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">صيغة اسم التكت الجديد</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary" name="btn_${i}_ticketName" value="${btn.ticketName || 'ticket-{username}'}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">رتبة المنشن والدعم بالسيرفر (Role ID)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary" name="btn_${i}_mentionRole" value="${btn.mentionRole || ''}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">تصنيف التكتات لهذا الزر (ID - اختياري)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary" name="btn_${i}_categoryId" value="${btn.categoryId || ''}">
                        </div>
                        <div class="col-12 mb-3">
                            <label class="form-label">رسالة الترحيب بالتكت (Welcome Message)</label>
                            <textarea class="form-control bg-dark text-white border-secondary" name="btn_${i}_welcomeMessage" rows="3">${btn.welcomeMessage || ''}</textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    const embed = config.embed || {};

    const content = `
    <div class="container-fluid">
        <h2 class="h3 mb-4">تصميم رسالة التكت والأزرار التفاعلية للسيرفر</h2>
        ${success}
        ${actionStatus}

        <form id="ticketForm" method="POST" action="/dashboard/${guildId}/ticket-msg">
            <div class="row">
                <div class="col-lg-7">
                    <div class="card card-custom">
                        <div class="card-header">تخصيص رسالة الـ Embed</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">عنوان الرسالة (Title)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" id="embedTitle" name="title" value="${embed.title || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">الوصف التفصيلي (Description)</label>
                                <textarea class="form-control bg-dark text-white border-secondary" id="embedDesc" name="description" rows="4">${embed.description || ''}</textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">لون الرسالة (Embed Color)</label>
                                <input type="color" class="form-control form-control-color bg-dark border-secondary w-100" id="embedColor" name="color" value="${embed.color || '#3b82f6'}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">اسم الكاتب أو صاحب الرسالة (Author)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" id="embedAuthor" name="author" value="${embed.author || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">تذييل الرسالة السفلي (Footer Text)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" id="embedFooter" name="footer" value="${embed.footer || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">رابط مصغرة الصورة بالأعلى (Thumbnail URL)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" id="embedThumbnail" name="thumbnail" value="${embed.thumbnail || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">رابط الصورة الكبيرة بالأسفل (Image URL)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" id="embedImage" name="image" value="${embed.image || ''}">
                            </div>
                            <div class="mb-3 form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="embedTimestamp" name="timestamp" ${embed.timestamp ? 'checked' : ''}>
                                <label class="form-check-label" for="embedTimestamp">تفعيل وإظهار التوقيت الزمني (Timestamp)</label>
                            </div>
                        </div>
                    </div>

                    <div class="card card-custom mt-4">
                        <div class="card-header">إعدادات الأزرار وبناء التكتات</div>
                        <div class="card-body">
                            <div class="accordion" id="buttonsAccordion">
                                ${buttonsHtml}
                            </div>
                        </div>
                    </div>

                    <div class="card card-custom mt-4">
                        <div class="card-header">العمليات المباشرة للإرسال والتحكم بالديسكورد</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">القناة الحالية المستهدفة لإرسال رسالة التكت: </label>
                                <span class="badge bg-secondary p-2">${config.embedChannelId ? '#' + config.embedChannelId : 'غير محددة'}</span>
                            </div>
                            <div class="d-flex gap-2 flex-wrap">
                                <button type="submit" name="action" value="save" class="btn btn-primary">حفظ الإعدادات بالملف</button>
                                <button type="submit" name="action" value="send" class="btn btn-success">إرسال الرسالة إلى ديسكورد 📢</button>
                                <button type="submit" name="action" value="edit" class="btn btn-info text-white" ${!config.activeEmbedMessageId ? 'disabled' : ''}>تعديل الرسالة المفتوحة ✏️</button>
                                <button type="submit" name="action" value="delete" class="btn btn-danger" ${!config.activeEmbedMessageId ? 'disabled' : ''}>حذف الرسالة الحالية 🗑️</button>
                            </div>
                            ${config.activeEmbedMessageId ? `<p class="text-success mt-3 small">تم العثور على رسالة نشطة حالياً برقم معرف: ${config.activeEmbedMessageId}</p>` : `<p class="text-warning mt-3 small">لا توجد رسالة نشطة ومحفوظة حالياً لهذا السيرفر.</p>`}
                        </div>
                    </div>
                </div>

                <!-- شاشة المعاينة الحية والمباشرة -->
                <div class="col-lg-5">
                    <div class="sticky-top" style="top: 2rem; z-index: 10;">
                        <h4 class="mb-3 text-muted">المعاينة الحية والمباشرة (Live Preview)</h4>
                        <div class="card card-custom">
                            <div class="card-body bg-dark">
                                <div class="discord-preview" id="previewEmbed">
                                    <div class="discord-preview-author mb-1" id="previewAuthorContainer">
                                        <span id="previewAuthor"></span>
                                    </div>
                                    <div class="discord-preview-title" id="previewTitle">العنوان الافتراضي</div>
                                    <img src="" class="discord-preview-thumbnail d-none" id="previewThumbnailImg">
                                    <div class="discord-preview-desc" id="previewDesc">الوصف التعريفي للرسالة يظهر هنا عند البدء في الكتابة...</div>
                                    <img src="" class="discord-preview-image d-none" id="previewImageImg">
                                    <div class="discord-preview-footer" id="previewFooterContainer">
                                        <span id="previewFooter"></span>
                                        <span id="previewTimestamp" class="ms-1 text-muted"></span>
                                    </div>
                                </div>
                                <div class="mt-3 d-flex flex-wrap" id="previewButtonsContainer"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </div>

    <script>
        const titleInp = document.getElementById('embedTitle');
        const descInp = document.getElementById('embedDesc');
        const colorInp = document.getElementById('embedColor');
        const authorInp = document.getElementById('embedAuthor');
        const footerInp = document.getElementById('embedFooter');
        const thumbInp = document.getElementById('embedThumbnail');
        const imgInp = document.getElementById('embedImage');
        const tsInp = document.getElementById('embedTimestamp');

        const pTitle = document.getElementById('previewTitle');
        const pDesc = document.getElementById('previewDesc');
        const pEmbed = document.getElementById('previewEmbed');
        const pAuthor = document.getElementById('previewAuthor');
        const pFooter = document.getElementById('previewFooter');
        const pThumb = document.getElementById('previewThumbnailImg');
        const pImage = document.getElementById('previewImageImg');
        const pTimestamp = document.getElementById('previewTimestamp');

        function refreshLivePreview() {
            pTitle.innerText = titleInp.value || 'لا يوجد عنوان للرسالة';
            pDesc.innerText = descInp.value || 'الوصف يظهر هنا عند البدء في الكتابة...';
            pEmbed.style.borderRightColor = colorInp.value;

            if (authorInp.value) {
                pAuthor.innerText = authorInp.value;
                document.getElementById('previewAuthorContainer').style.display = 'block';
            } else {
                document.getElementById('previewAuthorContainer').style.display = 'none';
            }

            pFooter.innerText = footerInp.value || '';

            if (thumbInp.value) {
                pThumb.src = thumbInp.value;
                pThumb.classList.remove('d-none');
            } else {
                pThumb.classList.add('d-none');
            }

            if (imgInp.value) {
                pImage.src = imgInp.value;
                pImage.classList.remove('d-none');
            } else {
                pImage.classList.add('d-none');
            }

            if (tsInp.checked) {
                pTimestamp.innerText = ' | اليوم في ' + new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'});
            } else {
                pTimestamp.innerText = '';
            }

            const btnContainer = document.getElementById('previewButtonsContainer');
            btnContainer.innerHTML = '';
            for (let i = 0; i < 5; i++) {
                const label = document.querySelector('[name="btn_' + i + '_label"]').value;
                const emoji = document.querySelector('[name="btn_' + i + '_emoji"]').value;
                const style = document.querySelector('[name="btn_' + i + '_style"]').value;

                if (label) {
                    let btnClass = 'discord-btn-primary';
                    if (style === 'SECONDARY') btnClass = 'discord-btn-secondary';
                    if (style === 'SUCCESS') btnClass = 'discord-btn-success';
                    if (style === 'DANGER') btnClass = 'discord-btn-danger';

                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'discord-btn ' + btnClass;
                    btn.innerHTML = (emoji ? emoji + ' ' : '') + label;
                    btnContainer.appendChild(btn);
                }
            }
        }

        [titleInp, descInp, colorInp, authorInp, footerInp, thumbInp, imgInp, tsInp].forEach(el => {
            el.addEventListener('input', refreshLivePreview);
        });
        document.querySelectorAll('.btn-label-input, .btn-emoji-input, .btn-style-input').forEach(el => {
            el.addEventListener('input', refreshLivePreview);
        });

        refreshLivePreview();
    </script>
    `;
    res.send(renderDashboard(content, 'ticket', req, guildId));
});

// معالجة عمليات الإرسال والتحرير والحذف للسيرفر المحدد
app.post('/dashboard/:guildId/ticket-msg', checkAuth, checkGuildAccess, async (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    const action = req.body.action;

    config.embed = {
        title: req.body.title,
        description: req.body.description,
        color: req.body.color,
        author: req.body.author,
        footer: req.body.footer,
        thumbnail: req.body.thumbnail,
        image: req.body.image,
        timestamp: req.body.timestamp === 'on'
    };

    config.buttons = [];
    for (let i = 0; i < 5; i++) {
        config.buttons.push({
            label: req.body[`btn_${i}_label`] || '',
            emoji: req.body[`btn_${i}_emoji`] || '',
            style: req.body[`btn_${i}_style`] || 'PRIMARY',
            ticketName: req.body[`btn_${i}_ticketName`] || 'ticket-{username}',
            mentionRole: req.body[`btn_${i}_mentionRole`] || '',
            categoryId: req.body[`btn_${i}_categoryId`] || '',
            welcomeMessage: req.body[`btn_${i}_welcomeMessage`] || ''
        });
    }

    saveGuildConfig(guildId, config);

    let redirectStatus = '';
    try {
        if (action === 'send') {
            if (!config.embedChannelId) {
                redirectStatus = encodeURIComponent('حدث خطأ: يرجى تحديد قناة إرسال التكت أولاً في لوحة الإعدادات.');
            } else {
                await sendTicketEmbed(guildId, config.embedChannelId);
                redirectStatus = encodeURIComponent('تم إرسال اللوحة الجديدة بنجاح ونشرها بالسيرفر ديسكورد.');
                logEvent('embed_send', guildId, { user: req.user, channel: `<#${config.embedChannelId}>` });
            }
        } else if (action === 'edit') {
            if (!config.activeEmbedMessageId) {
                redirectStatus = encodeURIComponent('حدث خطأ: لا توجد رسالة نشطة لتعديلها.');
            } else {
                await editTicketEmbed(guildId);
                redirectStatus = encodeURIComponent('تم تعديل الرسالة النشطة وتحديثها بنجاح بالسيرفر.');
                logEvent('embed_edit', guildId, { user: req.user });
            }
        } else if (action === 'delete') {
            if (!config.activeEmbedMessageId) {
                redirectStatus = encodeURIComponent('حدث خطأ: لا توجد رسالة نشطة لحذفها.');
            } else {
                await deleteTicketEmbed(guildId);
                redirectStatus = encodeURIComponent('تم حذف رسالة التكت بنجاح من السيرفر ديسكورد.');
                logEvent('embed_delete', guildId, { user: req.user });
            }
        } else {
            redirectStatus = encodeURIComponent('تم حفظ التغييرات والبيانات في الملف بنجاح بدون اتخاذ إجراء.');
        }
    } catch (err) {
        console.error(err);
        redirectStatus = encodeURIComponent('حدث خطأ فني أثناء التعامل مع ديسكورد: ' + err.message);
    }

    res.redirect(`/dashboard/${guildId}/ticket-msg?success=true&actionStatus=${redirectStatus}`);
});

// ==================== وظائف البوت المباشرة لعدة سيرفرات ====================

async function sendTicketEmbed(guildId, channelId) {
    const config = getGuildConfig(guildId);
    const channel = client.channels.cache.get(channelId);
    if (!channel) throw new Error("قناة الإرسال غير متوفرة أو لم يتم العثور عليها بالخادم.");

    const embedData = config.embed;
    const embed = new EmbedBuilder()
        .setTitle(embedData.title || "تكت جديد")
        .setDescription(embedData.description || "انقر لفتح تكت تواصل")
        .setColor(embedData.color || "#3b82f6");

    if (embedData.author) embed.setAuthor({ name: embedData.author });
    if (embedData.footer) embed.setFooter({ text: embedData.footer });
    if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
    if (embedData.image) embed.setImage(embedData.image);
    if (embedData.timestamp) embed.setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();

    config.buttons.forEach((btn, idx) => {
        if (!btn.label) return;
        let style = ButtonStyle.Primary;
        if (btn.style === 'SECONDARY') style = ButtonStyle.Secondary;
        if (btn.style === 'SUCCESS') style = ButtonStyle.Success;
        if (btn.style === 'DANGER') style = ButtonStyle.Danger;

        const button = new ButtonBuilder()
            .setCustomId(`open_ticket_${idx}`)
            .setLabel(btn.label)
            .setStyle(style);

        if (btn.emoji) button.setEmoji(btn.emoji);
        currentRow.addComponents(button);

        if (currentRow.components.length === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
    });

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    const msg = await channel.send({ embeds: [embed], components: rows });
    config.activeEmbedMessageId = msg.id;
    config.embedChannelId = channelId;
    saveGuildConfig(guildId, config);
    return msg;
}

async function editTicketEmbed(guildId) {
    const config = getGuildConfig(guildId);
    const channel = client.channels.cache.get(config.embedChannelId);
    if (!channel) throw new Error("لم يتم العثور على القناة المحددة للرسالة.");
    const msg = await channel.messages.fetch(config.activeEmbedMessageId);
    if (!msg) throw new Error("لم يتم العثور على الرسالة بالديسكورد لتعديلها.");

    const embedData = config.embed;
    const embed = new EmbedBuilder()
        .setTitle(embedData.title || "تكت جديد")
        .setDescription(embedData.description || "انقر لفتح تكت تواصل")
        .setColor(embedData.color || "#3b82f6");

    if (embedData.author) embed.setAuthor({ name: embedData.author });
    if (embedData.footer) embed.setFooter({ text: embedData.footer });
    if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
    if (embedData.image) embed.setImage(embedData.image);
    if (embedData.timestamp) embed.setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();

    config.buttons.forEach((btn, idx) => {
        if (!btn.label) return;
        let style = ButtonStyle.Primary;
        if (btn.style === 'SECONDARY') style = ButtonStyle.Secondary;
        if (btn.style === 'SUCCESS') style = ButtonStyle.Success;
        if (btn.style === 'DANGER') style = ButtonStyle.Danger;

        const button = new ButtonBuilder()
            .setCustomId(`open_ticket_${idx}`)
            .setLabel(btn.label)
            .setStyle(style);

        if (btn.emoji) button.setEmoji(btn.emoji);
        currentRow.addComponents(button);

        if (currentRow.components.length === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
    });

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    await msg.edit({ embeds: [embed], components: rows });
}

async function deleteTicketEmbed(guildId) {
    const config = getGuildConfig(guildId);
    const channel = client.channels.cache.get(config.embedChannelId);
    if (channel && config.activeEmbedMessageId) {
        try {
            const msg = await channel.messages.fetch(config.activeEmbedMessageId);
            if (msg) await msg.delete();
        } catch (err) {
            console.error("فشل حذف الرسالة مباشرة: ", err.message);
        }
    }
    config.activeEmbedMessageId = "";
    saveGuildConfig(guildId, config);
}

// ==================== تفاعل الأزرار والمودالات داخل الديسكورد لكل سيرفر ====================

client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;
    const config = getGuildConfig(guildId); // جلب الإعدادات الخاصة بهذا السيرفر فقط

    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith('open_ticket_')) {
            await interaction.deferReply({ ephemeral: true });
            const btnIndex = parseInt(customId.replace('open_ticket_', ''));
            const btnConfig = config.buttons[btnIndex];
            
            if (!btnConfig) {
                return interaction.editReply({ content: "خطأ: لم يتم العثور على إعدادات هذا الزر بالسيرفر الحالي." });
            }

            const guild = interaction.guild;
            const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
            const expectedName = (btnConfig.ticketName || 'ticket-{username}')
                .replace('{username}', cleanUsername)
                .toLowerCase();

            // فحص وجود تكت مكرر للعضو
            const duplicateChannel = guild.channels.cache.find(c => c.name === expectedName);
            if (duplicateChannel) {
                return interaction.editReply({ content: `لديك تكت مفتوح وموجود بالفعل داخل هذا السيرفر: <#${duplicateChannel.id}>` });
            }

            const parentId = btnConfig.categoryId || config.defaultCategoryId || null;
            const permissionOverwrites = [
                {
                    id: guild.id, // @everyone
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ]
                }
            ];

            if (btnConfig.mentionRole) {
                permissionOverwrites.push({
                    id: btnConfig.mentionRole,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ]
                });
            }

            try {
                const ticketChannel = await guild.channels.create({
                    name: expectedName,
                    type: ChannelType.GuildText,
                    parent: parentId,
                    permissionOverwrites: permissionOverwrites
                });

                logEvent('open', guildId, {
                    user: interaction.user,
                    channel: ticketChannel,
                    buttonLabel: btnConfig.label
                });

                const welcome = (btnConfig.welcomeMessage || "مرحباً {user}").replace('{user}', `<@${interaction.user.id}>`);
                const roleMention = btnConfig.mentionRole ? `<@&${btnConfig.mentionRole}>` : '';

                const embed = new EmbedBuilder()
                    .setTitle(`تكت دعم فني - ${btnConfig.label}`)
                    .setDescription(welcome)
                    .setColor(config.dashboardColor || "#3b82f6")
                    .setTimestamp();

                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_close').setLabel('إغلاق 🔒').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ticket_claim').setLabel('استلاف 🔑').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_rename').setLabel('تغيير الاسم ✏️').setStyle(ButtonStyle.Secondary)
                );
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_add_member').setLabel('إضافة عضو 👤').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_remove_member').setLabel('إزالة عضو ➖').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_transcript').setLabel('أرشيف محلي 📄').setStyle(ButtonStyle.Secondary)
                );

                await ticketChannel.send({
                    content: `${roleMention} ${interaction.user}`,
                    embeds: [embed],
                    components: [row1, row2]
                });

                await interaction.editReply({ content: `تم إنشاء تكت المساعدة بنجاح: <#${ticketChannel.id}>` });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: "تعذر إنشاء التكت بسبب نقص صلاحيات البوت الإدارية بالسيرفر." });
            }
        }

        if (customId === 'ticket_close') {
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('تأكيد الإغلاق الفوري 🔒').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('إلغاء الإغلاق').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ content: 'هل أنت متأكد من رغبتك في إغلاق التكت وإنشاء الأرشيف؟', components: [confirmRow] });
        }

        if (customId === 'ticket_close_cancel') {
            await interaction.message.delete().catch(() => {});
        }

        if (customId === 'ticket_close_confirm') {
            await interaction.reply({ content: 'جاري البدء في توليد الأرشيف HTML وحذف الروم...' });
            const channel = interaction.channel;
            const guild = interaction.guild;

            const transcriptHtml = await generateTranscript(channel);
            const logsChannelId = config.logsChannelId;

            if (logsChannelId) {
                const logsChannel = guild.channels.cache.get(logsChannelId);
                if (logsChannel) {
                    const buffer = Buffer.from(transcriptHtml, 'utf-8');
                    await logsChannel.send({
                        content: `📄 **أرشيف تكت:** \`${channel.name}\`\n**تم إغلاقه بواسطة:** ${interaction.user} (${interaction.user.id})`,
                        files: [{
                            attachment: buffer,
                            name: `${channel.name}-transcript.html`
                        }]
                    });
                    logEvent('close', guildId, { user: interaction.user, channel: channel });
                }
            }

            setTimeout(async () => {
                await channel.delete().catch(() => {});
            }, 5000);
        }

        if (customId === 'ticket_claim') {
            const channel = interaction.channel;
            const member = interaction.member;

            if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: "عذراً، ليست لديك الصلاحيات الكافية لاستلام هذا التكت.", ephemeral: true });
            }

            await channel.permissionOverwrites.edit(member.id, {
                SendMessages: true,
                ViewChannel: true,
                ReadMessageHistory: true
            });

            await interaction.reply({ content: `🔑 تم استلام ومتابعة التكت بواسطة المشرف المسؤول: ${interaction.user}` });
            logEvent('claim', guildId, { user: interaction.user, channel: channel });
        }

        if (customId === 'ticket_rename') {
            const modal = new ModalBuilder().setCustomId('modal_rename').setTitle('إعادة تسمية التكت');
            const nameInp = new TextInputBuilder()
                .setCustomId('new_name')
                .setLabel('الاسم الجديد للروم')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: ticket-closed-done')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInp));
            await interaction.showModal(modal);
        }

        if (customId === 'ticket_add_member') {
            const modal = new ModalBuilder().setCustomId('modal_add_member').setTitle('إضافة عضو للتكت');
            const userInp = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('ID العضو المطلوب إضافته')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('أدخل المعرف الرقمي للعضو هنا')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(userInp));
            await interaction.showModal(modal);
        }

        if (customId === 'ticket_remove_member') {
            const modal = new ModalBuilder().setCustomId('modal_remove_member').setTitle('إزالة عضو من التكت');
            const userInp = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('ID العضو المطلوب إزالته')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('أدخل المعرف الرقمي للعضو هنا')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(userInp));
            await interaction.showModal(modal);
        }

        if (customId === 'ticket_transcript') {
            await interaction.reply({ content: 'جاري إنشاء الأرشيف الفوري...' });
            const html = await generateTranscript(interaction.channel);
            const buffer = Buffer.from(html, 'utf-8');
            await interaction.followUp({
                content: 'تفضل، إليك أرشيف التكت الفوري والحالي:',
                files: [{
                    attachment: buffer,
                    name: `${interaction.channel.name}-instant.html`
                }]
            });
        }
    }

    if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        if (customId === 'modal_rename') {
            const newName = interaction.fields.getTextInputValue('new_name').toLowerCase().replace(/\s+/g, '-');
            await interaction.reply({ content: `جاري إعادة تسمية الروم إلى \`${newName}\`...` });
            await interaction.channel.setName(newName);
            logEvent('rename', guildId, { user: interaction.user, channel: interaction.channel, details: newName });
        }

        if (customId === 'modal_add_member') {
            const userId = interaction.fields.getTextInputValue('user_id');
            try {
                const targetMember = await interaction.guild.members.fetch(userId);
                if (!targetMember) throw new Error();

                await interaction.channel.permissionOverwrites.edit(targetMember.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true
                });

                await interaction.reply({ content: `تمت إضافة العضو ${targetMember} بنجاح إلى التكت وتفعيل صلاحيات المشاهدة.` });
                logEvent('add_member', guildId, { user: interaction.user, channel: interaction.channel, details: targetMember.user });
            } catch (err) {
                await interaction.reply({ content: 'عذراً، تعذر العثور على العضو داخل السيرفر بالمعرف المدخل.', ephemeral: true });
            }
        }

        if (customId === 'modal_remove_member') {
            const userId = interaction.fields.getTextInputValue('user_id');
            try {
                const targetMember = await interaction.guild.members.fetch(userId);
                if (!targetMember) throw new Error();

                await interaction.channel.permissionOverwrites.delete(targetMember.id);

                await interaction.reply({ content: `تمت إزالة العضو ${targetMember} بنجاح من التكت الفني الحالي.` });
                logEvent('remove_member', guildId, { user: interaction.user, channel: interaction.channel, details: targetMember.user });
            } catch (err) {
                await interaction.reply({ content: 'عذراً، تعذر العثور على العضو داخل السيرفر بالمعرف المدخل.', ephemeral: true });
            }
        }
    }
});

// دالة لتسجيل الأحداث واللوق لسيرفر محدد
function logEvent(type, guildId, data) {
    const config = getGuildConfig(guildId);
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const logChannel = guild.channels.cache.get(config.logsChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor(config.dashboardColor || "#3b82f6")
        .setTimestamp();

    switch (type) {
        case 'open':
            embed.setTitle('📂 تم إنشاء تكت جديد')
                 .setDescription(`**صاحب التكت:** ${data.user} (${data.user.id})\n**قناة التكت:** ${data.channel}\n**نوع القسم المختار:** ${data.buttonLabel}`);
            break;
        case 'close':
            embed.setTitle('🔒 تم إغلاق وتصنيف تكت')
                 .setDescription(`**تم الإغلاق بواسطة:** ${data.user} (${data.user.id})\n**اسم روم التكت:** ${data.channel.name}`);
            break;
        case 'claim':
            embed.setTitle('🔑 تم استلام تكت ومتابعته')
                 .setDescription(`**المشرف المسؤول:** ${data.user} (${data.user.id})\n**التكت المستهدف:** ${data.channel}`);
            break;
        case 'rename':
            embed.setTitle('✏️ تم تعديل اسم التكت')
                 .setDescription(`**بواسطة:** ${data.user} (${data.user.id})\n**قناة التكت:** ${data.channel}\n**الاسم الجديد المطبق:** ${data.details}`);
            break;
        case 'add_member':
            embed.setTitle('👤 إضافة عضو جديد للتكت')
                 .setDescription(`**بواسطة:** ${data.user} (${data.user.id})\n**التكت:** ${data.channel}\n**العضو الذي تمت إضافته:** ${data.details}`);
            break;
        case 'remove_member':
            embed.setTitle('➖ إزالة عضو من التكت')
                 .setDescription(`**بواسطة:** ${data.user} (${data.user.id})\n**التكت:** ${data.channel}\n**العضو الذي تمت إزالته:** ${data.details}`);
            break;
        case 'embed_send':
            embed.setTitle('📢 نشر لوحة الأزرار الأساسية')
                 .setDescription(`**بواسطة المسؤول:** ${data.user}\n**القناة المستهدفة:** ${data.channel}`);
            break;
        case 'embed_edit':
            embed.setTitle('✏️ تعديل وتحديث لوحة التكت')
                 .setDescription(`**بواسطة المسؤول:** ${data.user}`);
            break;
        case 'embed_delete':
            embed.setTitle('🗑️ إزالة وحذف لوحة التكت')
                 .setDescription(`**بواسطة المسؤول:** ${data.user}`);
            break;
    }

    logChannel.send({ embeds: [embed] }).catch(() => {});
}

async function generateTranscript(channel) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sortedMsgs = Array.from(messages.values()).reverse();

    let msgsMarkup = '';
    sortedMsgs.forEach(msg => {
        const avatar = msg.author.displayAvatarURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const dateStr = msg.createdAt.toLocaleString('ar-EG');
        const textContent = msg.content || '';

        let attachmentsMarkup = '';
        if (msg.attachments.size > 0) {
            msg.attachments.forEach(att => {
                if (att.contentType && att.contentType.startsWith('image/')) {
                    attachmentsMarkup += `<br><img src="${att.url}" style="max-width: 320px; border-radius: 6px; margin-top: 8px;">`;
                } else {
                    attachmentsMarkup += `<br><a href="${att.url}" target="_blank" style="color: #00aff0; font-size: 13px; text-decoration: none;">[تحميل المرفق: ${att.name}]</a>`;
                }
            });
        }

        let embedsMarkup = '';
        if (msg.embeds.length > 0) {
            msg.embeds.forEach(emb => {
                embedsMarkup += `
                <div style="background-color: #2f3136; border-right: 4px solid ${emb.color ? '#' + emb.color.toString(16) : '#5865f2'}; border-radius: 4px; padding: 12px; margin-top: 10px; max-width: 520px;">
                    ${emb.title ? `<div style="font-weight: bold; color: white; margin-bottom: 6px;">${emb.title}</div>` : ''}
                    ${emb.description ? `<div style="font-size: 14px; color: #dcddde; line-height: 1.4;">${emb.description}</div>` : ''}
                </div>
                `;
            });
        }

        msgsMarkup += `
        <div style="display: flex; margin-bottom: 18px; border-bottom: 1px solid #2f3136; padding-bottom: 12px;">
            <img src="${avatar}" style="width: 42px; height: 42px; border-radius: 50%; margin-left: 15px;">
            <div>
                <div>
                    <span style="font-weight: bold; color: white; margin-left: 10px;">${msg.author.username}</span>
                    <span style="color: #72767d; font-size: 12px;">${dateStr}</span>
                </div>
                <div style="color: #dcddde; font-size: 15px; margin-top: 6px; white-space: pre-wrap;">${textContent}</div>
                ${attachmentsMarkup}
                ${embedsMarkup}
            </div>
        </div>
        `;
    });

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>سجلات الأرشيف - تكت ${channel.name}</title>
        <style>
            body { background-color: #36393f; color: #dcddde; font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 24px; }
            .header { border-bottom: 2px solid #2f3136; padding-bottom: 20px; margin-bottom: 24px; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .header p { color: #72767d; margin: 6px 0 0 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>سيرفر: ${channel.guild.name}</h1>
            <p>أرشيف وسجلات المحادثة لقناة: #${channel.name}</p>
            <p>تاريخ تصدير الأرشيف: ${new Date().toLocaleString('ar-EG')}</p>
        </div>
        <div class="messages-container">
            ${msgsMarkup || '<p style="text-align: center; color: #72767d; padding: 40px;">لا توجد رسائل مسجلة بهذه التكت.</p>'}
        </div>
    </body>
    </html>
    `;
}

// تشغيل وربط خوادم البوت والويب معاً
client.once('ready', () => {
    console.log(`Bot logged in as: ${client.user.tag} (Multi-Guild Enabled)`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Failed to login to Discord: ", err.message);
});

app.listen(PORT, () => {
    console.log(`Web Dashboard is running on port ${PORT}`);
});