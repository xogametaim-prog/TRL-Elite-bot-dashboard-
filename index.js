// استيراد المكتبات الأساسية
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

const configPath = path.join(__dirname, 'config.json');

// دالة لقراءة إعدادات السيرفر المحدد من config.json بشكل آمن ومستقل
function getGuildConfig(guildId) {
    let fullConfig = {};
    try {
        if (fs.existsSync(configPath)) {
            fullConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (err) {
        console.error("Error reading config: ", err);
    }

    if (!fullConfig[guildId]) {
        fullConfig[guildId] = {
            logsChannelId: "",
            embedChannelId: "",
            defaultCategoryId: "",
            dashboardColor: "#3b82f6",
            botDisplayName: "ticket bot.v1",
            maxTicketsPerUser: 1, // الخيار الافتراضي لحد التكتات
            embed: {
                title: "🎫 مركز الدعم الفني والمساعدة",
                description: "يسعدنا دائماً تقديم يد العون لكم. يرجى اختيار القسم المناسب من الأزرار بالأسفل لتلقي المساعدة الفورية من فريق عملنا المتواجد على مدار الساعة.",
                color: "#3b82f6",
                author: "ticket bot.v1",
                footer: "جميع الحقوق محفوظة للبوت ©",
                thumbnail: "",
                image: "",
                timestamp: true
            },
            buttons: [
                {
                    label: "الدعم الفني والشكاوى",
                    emoji: "🎫",
                    style: "PRIMARY",
                    ticketName: "ticket-{username}",
                    mentionRole: "",
                    categoryId: "",
                    welcomeMessage: "أهلاً بك {user} في قسم الدعم والشكاوى! يرجى طرح مشكلتك أو استفسارك بالتفصيل وسيقوم أحد الإداريين بالرد عليك في أقرب وقت."
                }
            ],
            activeEmbedMessageId: ""
        };
        fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2), 'utf8');
    }

    return fullConfig[guildId];
}

// دالة لحفظ وتحديث إعدادات السيرفر
function saveGuildConfig(guildId, guildConfig) {
    let fullConfig = {};
    try {
        if (fs.existsSync(configPath)) {
            fullConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (err) {
        console.error("Error reading config before save: ", err);
    }
    fullConfig[guildId] = guildConfig;
    try {
        fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2), 'utf8');
    } catch (err) {
        console.error("Error writing config: ", err);
    }
}

// تهيئة ديسكورد بوت
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// تهيئة خادم الويب
const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
    secret: process.env.SESSION_SECRET || 'premium-glassmorphism-key-v1',
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

// جدار حماية للتحقق من الصلاحيات الإدارية في السيرفر المختار
function checkGuildAccess(req, res, next) {
    const guildId = req.params.guildId;
    if (!guildId) return res.redirect('/dashboard');

    const userGuilds = req.user.guilds;
    const targetGuild = userGuilds.find(g => g.id === guildId);
    
    if (!targetGuild) {
        return res.status(403).send("عذراً، أنت لست عضواً في هذا السيرفر.");
    }

    const permissions = Number(targetGuild.permissions);
    const isAdmin = (permissions & 0x8) === 0x8;
    const isManageGuild = (permissions & 0x20) === 0x20;

    if (isAdmin || isManageGuild) {
        const botInGuild = client.guilds.cache.has(guildId);
        if (!botInGuild) {
            return res.status(403).send(`
                <div style="background-color: #0b0f19; color: #fff; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: sans-serif;">
                    <h2 style="color: #3b82f6; margin-bottom: 10px;">البوت غير مضاف للسيرفر!</h2>
                    <p style="color: #94a3b8; margin-bottom: 25px;">يرجى إضافة البوت للسيرفر أولاً لتتمكن من إدارته.</p>
                    <a href="https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&integration_type=0&scope=bot+applications.commands" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 12px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);" target="_blank">دعوة البوت الآن 🚀</a>
                </div>
            `);
        }
        return next();
    }
    return res.status(403).send("عذراً، لا تمتلك صلاحيات كافية (مسؤول أو مدير السيرفر) لدخول لوحة التحكم.");
}

// تصميم لوحة التحكم المتقدم بنظام Glassmorphism المتوهج والأزرار الناعمة المستديرة
function renderDashboard(content, activeTab, req, currentGuildId = null) {
    const user = req.user;
    const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const config = currentGuildId ? getGuildConfig(currentGuildId) : {};
    const botName = "ticket bot.v1";
    
    const homeLink = currentGuildId ? `/dashboard/${currentGuildId}` : '/dashboard';
    const ticketLink = currentGuildId ? `/dashboard/${currentGuildId}/ticket-msg` : '#';
    const settingsLink = currentGuildId ? `/dashboard/${currentGuildId}/settings` : '#';

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${botName} - Dashboard</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap');
            :root {
                --bg-deep: #05070f;
                --bg-glass: rgba(15, 23, 42, 0.65);
                --bg-sidebar: rgba(10, 15, 30, 0.95);
                --accent-blue: #3b82f6;
                --accent-purple: #8b5cf6;
                --text-light: #f8fafc;
                --text-muted: #94a3b8;
                --glow-color: rgba(59, 130, 246, 0.3);
            }
            body {
                background: radial-gradient(circle at 50% 50%, #0d1224 0%, var(--bg-deep) 100%);
                color: var(--text-light);
                font-family: 'Cairo', sans-serif;
                min-height: 100vh;
                overflow-x: hidden;
            }
            /* تأثير البطاقات الزجاجية Glassmorphism */
            .glass-card {
                background: var(--bg-glass);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 1.25rem;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
            }
            .glass-card:hover {
                box-shadow: 0 12px 40px 0 rgba(59, 130, 246, 0.15);
            }
            .sidebar {
                background-color: var(--bg-sidebar);
                backdrop-filter: blur(20px);
                min-height: 100vh;
                width: 290px;
                position: fixed;
                top: 0;
                bottom: 0;
                right: 0;
                z-index: 100;
                border-left: 1px solid rgba(255, 255, 255, 0.05);
                transition: all 0.3s ease;
            }
            .main-content {
                margin-right: 290px;
                padding: 2.5rem;
                transition: all 0.3s ease;
            }
            @media (max-width: 991.98px) {
                .sidebar { right: -290px; }
                .sidebar.active { right: 0; }
                .main-content { margin-right: 0; padding: 1.5rem; }
            }
            /* الأزرار الدائرية ذات التوهج والتدرج اللوني */
            .btn-glow-primary {
                background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
                border: none;
                color: #fff;
                font-weight: 600;
                border-radius: 50px;
                padding: 10px 24px;
                box-shadow: 0 0 15px var(--glow-color);
                transition: all 0.3s ease;
            }
            .btn-glow-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 0 25px rgba(139, 92, 246, 0.5);
                color: #fff;
            }
            .btn-glow-success {
                background: linear-gradient(135deg, #10b981, #059669);
                border: none;
                color: #fff;
                font-weight: 600;
                border-radius: 50px;
                padding: 10px 24px;
                box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
                transition: all 0.3s ease;
            }
            .btn-glow-success:hover {
                transform: translateY(-2px);
                box-shadow: 0 0 25px rgba(16, 185, 129, 0.5);
                color: #fff;
            }
            .btn-glow-danger {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                border: none;
                color: #fff;
                font-weight: 600;
                border-radius: 50px;
                padding: 10px 24px;
                box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
                transition: all 0.3s ease;
            }
            .btn-glow-danger:hover {
                transform: translateY(-2px);
                box-shadow: 0 0 25px rgba(239, 68, 68, 0.5);
                color: #fff;
            }
            .btn-glow-secondary {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #fff;
                font-weight: 600;
                border-radius: 50px;
                padding: 10px 24px;
                transition: all 0.3s ease;
            }
            .btn-glow-secondary:hover {
                background: rgba(255, 255, 255, 0.15);
                transform: translateY(-2px);
                color: #fff;
            }
            .nav-link {
                color: var(--text-muted);
                padding: 0.8rem 1.5rem;
                border-radius: 50px;
                margin: 0.3rem 1.25rem;
                display: flex;
                align-items: center;
                gap: 14px;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            .nav-link:hover, .nav-link.active {
                background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
                color: #fff !important;
                box-shadow: 0 0 15px var(--glow-color);
            }
            .nav-link.disabled {
                opacity: 0.3;
                pointer-events: none;
            }
            /* معاينة ديسكورد الراقية */
            .discord-preview {
                background-color: #111214;
                border-radius: 12px;
                padding: 20px;
                border-right: 4px solid var(--accent-blue);
                color: #dbdee1;
                font-size: 0.95rem;
            }
            .discord-preview-title { color: #fff; font-weight: 700; font-size: 1.1rem; margin-bottom: 8px; }
            .discord-preview-desc { line-height: 1.5; white-space: pre-wrap; }
            .discord-preview-footer { font-size: 0.75rem; color: #949ba4; margin-top: 10px; }
            .discord-preview-author { font-size: 0.9rem; font-weight: 700; color: #fff; margin-bottom: 6px; }
            .discord-btn {
                padding: 8px 18px;
                border-radius: 50px;
                font-size: 0.85rem;
                font-weight: 600;
                border: none;
                color: white;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin: 4px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }
            .discord-btn-primary { background-color: #5865f2; }
            .discord-btn-secondary { background-color: #4f545c; }
            .discord-btn-success { background-color: #248046; }
            .discord-btn-danger { background-color: #da373c; }
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
                <img src="${avatarUrl}" alt="Avatar" class="rounded-circle border border-info" width="48" height="48">
                <div>
                    <div class="fw-bold text-truncate" style="max-width: 170px;">${user.username}</div>
                    <small class="text-info"><i class="bi bi-circle-fill" style="font-size: 8px;"></i> متصل بالمنصة</small>
                </div>
            </div>
            <div class="py-3">
                <a href="/dashboard" class="nav-link ${activeTab === 'select' ? 'active' : ''}">
                    <i class="bi bi-arrow-left-right"></i> تبديل السيرفر
                </a>
                <a href="${homeLink}" class="nav-link ${activeTab === 'home' ? 'active' : ''} ${!currentGuildId ? 'disabled' : ''}">
                    <i class="bi bi-grid-1x2"></i> الإحصائيات العامة
                </a>
                <a href="${ticketLink}" class="nav-link ${activeTab === 'ticket' ? 'active' : ''} ${!currentGuildId ? 'disabled' : ''}">
                    <i class="bi bi-layers"></i> رسالة الأزرار والـ Embed
                </a>
                <a href="${settingsLink}" class="nav-link ${activeTab === 'settings' ? 'active' : ''} ${!currentGuildId ? 'disabled' : ''}">
                    <i class="bi bi-sliders"></i> قنوات وإعدادات التكت
                </a>
                
                <hr class="mx-3 border-secondary">
                
                <!-- سيرفر الدعم الفني الخاص بك -->
                <a href="https://discord.gg/TvFaRGadkc" class="nav-link text-info fw-bold" target="_blank" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2);">
                    <i class="bi bi-headset"></i> سيرفر الدعم الفني للبوت
                </a>
                
                <a href="/logout" class="nav-link text-danger mt-3">
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

// ==================== مسارات الويب EXPRESS ====================

app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ticket bot.v1 - تسجيل الدخول</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
            body {
                background: radial-gradient(circle at 50% 50%, #0d1224 0%, #05070f 100%);
                color: #fff;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                font-family: 'Cairo', sans-serif;
            }
            .hero-card {
                background: rgba(15, 23, 42, 0.65);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 1.5rem;
                padding: 3.5rem;
                text-align: center;
                max-width: 520px;
                width: 100%;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            }
            .btn-discord {
                background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                color: white;
                font-weight: 700;
                padding: 12px 30px;
                border-radius: 50px;
                display: inline-flex;
                align-items: center;
                gap: 12px;
                text-decoration: none;
                box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
                transition: all 0.3s ease;
            }
            .btn-discord:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 25px rgba(139, 92, 246, 0.6);
                color: white;
            }
        </style>
    </head>
    <body>
        <div class="hero-card">
            <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); width: 80px; height: 80px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; box-shadow: 0 8px 25px rgba(59,130,246,0.3);">
                <i class="bi bi-ticket-perforated" style="font-size: 2.5rem; color: white;"></i>
            </div>
            <h1 class="fw-bold mb-3">ticket bot.v1</h1>
            <p class="text-muted mb-4">نظام الدعم الفني المجاني الأكثر تقدماً بالكامل. تذاكر بلا حدود، إعدادات متكاملة، وقوالب زجاجية عصرية.</p>
            <a href="/login" class="btn btn-discord">
                <i class="bi bi-discord"></i> دخول لوحة التحكم الذكية
            </a>
        </div>
    </body>
    </html>
    `);
});

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

// اختيار السيرفر المشترك
app.get('/dashboard', checkAuth, (req, res) => {
    const userGuilds = req.user.guilds;
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
            <div class="card glass-card h-100 text-center border-0">
                <div class="card-body d-flex flex-column align-items-center justify-content-between p-4">
                    <div class="position-relative mb-3">
                        <img src="${iconUrl}" alt="${g.name}" class="rounded-circle border border-secondary" width="80" height="80">
                        ${botInGuild ? '<span class="position-absolute bottom-0 start-100 translate-middle p-2 bg-success border border-light rounded-circle" title="متصل"></span>' : ''}
                    </div>
                    <h5 class="fw-bold text-truncate w-100 mb-3">${g.name}</h5>
                    ${botInGuild ? `
                        <a href="/dashboard/${g.id}" class="btn btn-glow-primary w-100">دخول اللوحة الفنية <i class="bi bi-box-arrow-in-left"></i></a>
                    ` : `
                        <a href="https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&integration_type=0&scope=bot+applications.commands" class="btn btn-glow-secondary w-100" target="_blank">إضافة البوت أولاً <i class="bi bi-plus-lg"></i></a>
                    `}
                </div>
            </div>
        </div>
        `;
    });

    const content = `
    <div class="container-fluid">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="fw-bold mb-1">اختر السيرفر للبدء</h2>
                <p class="text-muted">اللوحة تدعم جميع سيرفراتك وإعداداتها بشكل منفصل ومجاني بالكامل.</p>
            </div>
            <!-- زر الانتقال لسيرفر الدعم -->
            <a href="https://discord.gg/TvFaRGadkc" class="btn btn-glow-primary" target="_blank"><i class="bi bi-discord"></i> سيرفر الدعم الفني</a>
        </div>
        <div class="row">
            ${guildsListHtml || '<div class="col-12 text-center text-muted py-5"><p>لا توجد سيرفرات تملك فيها رتبة إدارية.</p></div>'}
        </div>
    </div>
    `;

    res.send(renderDashboard(content, 'select', req));
});

// الصفحة الرئيسية لإحصائيات السيرفر المختار
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
            <h2 class="fw-bold mb-1">إحصائيات سيرفر: ${guild.name}</h2>
            <p class="text-muted">جميع الميزات مفعلة بالكامل ومتاحة بدون اشتراكات أو قيود.</p>
        </div>
        
        <div class="row">
            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card glass-card h-100 border-start border-primary border-4 text-white">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col">
                                <div class="text-xs text-primary text-uppercase mb-1 fw-bold">حالة البوت الأساسي</div>
                                <div class="h5 mb-0 fw-bold">متصل بالخدمة 🟢</div>
                            </div>
                            <div class="col-auto"><i class="bi bi-robot text-primary" style="font-size: 2rem;"></i></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card glass-card h-100 border-start border-info border-4 text-white">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col">
                                <div class="text-xs text-info text-uppercase mb-1 fw-bold">عدد التكتات المفتوحة</div>
                                <div class="h5 mb-0 fw-bold">${openTickets} تكت</div>
                            </div>
                            <div class="col-auto"><i class="bi bi-chat-left-dots text-info" style="font-size: 2rem;"></i></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card glass-card h-100 border-start border-success border-4 text-white">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col">
                                <div class="text-xs text-success text-uppercase mb-1 fw-bold">إجمالي المستخدمين</div>
                                <div class="h5 mb-0 fw-bold">${guild.memberCount} عضو</div>
                            </div>
                            <div class="col-auto"><i class="bi bi-people text-success" style="font-size: 2rem;"></i></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card glass-card h-100 border-start border-warning border-4 text-white">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col">
                                <div class="text-xs text-warning text-uppercase mb-1 fw-bold">سرعة الاتصال (Ping)</div>
                                <div class="h5 mb-0 fw-bold">${ping} ms</div>
                            </div>
                            <div class="col-auto"><i class="bi bi-cpu text-warning" style="font-size: 2rem;"></i></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mt-4">
            <div class="col-lg-6">
                <div class="card glass-card text-white">
                    <div class="card-header border-0 bg-transparent fw-bold h5">أداء واستقرار النظام</div>
                    <div class="card-body">
                        <table class="table table-dark table-hover table-borderless m-0 bg-transparent text-white">
                            <tbody>
                                <tr>
                                    <td>وقت التشغيل المتواصل (Uptime)</td>
                                    <td class="text-end text-info">${uptime} دقيقة</td>
                                </tr>
                                <tr>
                                    <td>استهلاك ذاكرة الخادم الأساسية</td>
                                    <td class="text-end text-info">${ramUsage} MB</td>
                                </tr>
                                <tr>
                                    <td>مستند الدعم الرسمي للبوت</td>
                                    <td class="text-end"><a href="https://discord.gg/TvFaRGadkc" target="_blank" class="text-info text-decoration-none">انقر للانضمام</a></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card glass-card text-white">
                    <div class="card-header border-0 bg-transparent fw-bold h5">الدليل السريع وميزات ديسكورد</div>
                    <div class="card-body">
                        <p>نظام التذاكر بالكامل مجاني وذكي للغاية:</p>
                        <ul>
                            <li>يمنع الأعضاء تلقائياً من تجاوز الحد الأقصى للتذاكر المسموح بفتحها.</li>
                            <li>يدعم أرشيف الرسائل بصيغة HTML منسقة ومحمية ومباشرة.</li>
                        </ul>
                        <div class="d-grid mt-4">
                            <a href="/dashboard/${guildId}/ticket-msg" class="btn btn-glow-primary">تصميم رسالة التكت الأولى الآن 🎨</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    res.send(renderDashboard(content, 'home', req, guildId));
});

// صفحة الإعدادات العامة ونظام تحديد الحد الأقصى للتكتات (Ticket Limit System)
app.get('/dashboard/:guildId/settings', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    const successMsg = req.query.success === 'true' ? `
        <div class="alert alert-success alert-dismissible fade show" role="alert" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981;">
            تم حفظ وتحديث إعدادات الحد الأقصى وقنوات التكت بنجاح بالخادم.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    ` : '';

    const content = `
    <div class="container-fluid">
        <h2 class="fw-bold mb-4">قنوات وهيكل التكت والتحكم الذكي</h2>
        ${successMsg}
        
        <form action="/dashboard/${guildId}/settings" method="POST">
            <div class="row">
                <div class="col-lg-8">
                    <!-- نظام الحد الأقصى المطور (Ticket Limit System) -->
                    <div class="card glass-card text-white mb-4">
                        <div class="card-header bg-transparent border-0 fw-bold h5">نظام تحديد حد التكتات الأقصى للمستخدم (Ticket Limit System)</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">الحد الأقصى للتذاكر المفتوحة لكل مستخدم بنفس الوقت</label>
                                <select class="form-select bg-dark text-white border-secondary" name="maxTicketsPerUser" id="maxTicketsSelector">
                                    <option value="1" ${config.maxTicketsPerUser == 1 ? 'selected' : ''}>تكت واحدة لكل مستخدم (1 Ticket)</option>
                                    <option value="2" ${config.maxTicketsPerUser == 2 ? 'selected' : ''}>تكتين لكل مستخدم (2 Tickets)</option>
                                    <option value="3" ${config.maxTicketsPerUser == 3 ? 'selected' : ''}>3 تكتات لكل مستخدم (3 Tickets)</option>
                                    <option value="custom" ${![1, 2, 3].includes(Number(config.maxTicketsPerUser)) ? 'selected' : ''}>رقم مخصص (Custom Number)</option>
                                </select>
                            </div>
                            <div class="mb-3 d-none" id="customLimitWrapper">
                                <label class="form-label">ادخل الرقم المخصص للحد الأقصى</label>
                                <input type="number" class="form-control bg-dark text-white border-secondary" name="customMaxTickets" value="${![1, 2, 3].includes(Number(config.maxTicketsPerUser)) ? config.maxTicketsPerUser : '4'}" min="1">
                            </div>
                        </div>
                    </div>

                    <div class="card glass-card text-white">
                        <div class="card-header bg-transparent border-0 fw-bold h5">القنوات والمسميات الأساسية بالخادم</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">معرف روم السجلات واللوق (Logs Channel ID)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="logsChannelId" value="${config.logsChannelId || ''}" placeholder="ضع الـ ID هنا">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">معرف روم إرسال رسالة التكت (Embed Channel ID)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="embedChannelId" value="${config.embedChannelId || ''}" placeholder="ضع الـ ID هنا">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">معرف الكاتيجوري الافتراضي للتكتات (Default Category ID)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="defaultCategoryId" value="${config.defaultCategoryId || ''}" placeholder="ضع الـ ID هنا">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">اسم البوت ومسؤول النظام بالواجهات</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="botDisplayName" value="${config.botDisplayName || 'ticket bot.v1'}" placeholder="مثال: لوحة تحكم سيرفرنا">
                            </div>
                            <button type="submit" class="btn btn-glow-primary px-5 mt-3">حفظ جميع الإعدادات</button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </div>

    <script>
        const selector = document.getElementById('maxTicketsSelector');
        const customWrapper = document.getElementById('customLimitWrapper');
        
        function toggleCustomInput() {
            if (selector.value === 'custom') {
                customWrapper.classList.remove('d-none');
            } else {
                customWrapper.classList.add('d-none');
            }
        }

        selector.addEventListener('change', toggleCustomInput);
        toggleCustomInput();
    </script>
    `;
    res.send(renderDashboard(content, 'settings', req, guildId));
});

// استقبال وحفظ إعدادات القنوات والحدود
app.post('/dashboard/:guildId/settings', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    // حفظ الحد الأقصى للتكتات بناءً على اختيار المستخدم
    if (req.body.maxTicketsPerUser === 'custom') {
        config.maxTicketsPerUser = Number(req.body.customMaxTickets) || 1;
    } else {
        config.maxTicketsPerUser = Number(req.body.maxTicketsPerUser) || 1;
    }

    config.logsChannelId = req.body.logsChannelId;
    config.embedChannelId = req.body.embedChannelId;
    config.defaultCategoryId = req.body.defaultCategoryId;
    config.botDisplayName = req.body.botDisplayName;
    
    saveGuildConfig(guildId, config);
    res.redirect(`/dashboard/${guildId}/settings?success=true`);
});

// صفحة تعديل وتصميم رسالة الـ Embed والأزرار غير المحدودة (Button System)
app.get('/dashboard/:guildId/ticket-msg', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    const success = req.query.success === 'true' ? `
        <div class="alert alert-success alert-dismissible fade show" role="alert" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981;">
            تم تحديث رسالة الأزرار والـ Embed بنجاح.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    ` : '';
    
    const actionStatus = req.query.actionStatus ? `
        <div class="alert alert-info alert-dismissible fade show" role="alert" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; border: 1px solid #3b82f6;">
            حالة الإجراء: ${decodeURIComponent(req.query.actionStatus)}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    ` : '';

    // بناء الأزرار الخمسة لتعبئتها وتخصيص قنواتها والمنشن الخاص بها
    let buttonsHtml = '';
    for (let i = 0; i < 5; i++) {
        const btn = config.buttons && config.buttons[i] ? config.buttons[i] : {
            label: '', emoji: '', style: 'PRIMARY', ticketName: 'ticket-{username}', mentionRole: '', categoryId: '', welcomeMessage: ''
        };
        buttonsHtml += `
        <div class="accordion-item bg-dark border-secondary text-white mb-3">
            <h2 class="accordion-header" id="headingBtn${i}">
                <button class="accordion-button collapsed bg-secondary text-white" type="button" data-bs-toggle="collapse" data-bs-target="#collapseBtn${i}" aria-expanded="false" aria-controls="collapseBtn${i}">
                    الزر رقم ${i+1}: ${btn.label || 'غير مفعّل (اترك حقل اسم الزر فارغاً لإيقافه)'}
                </button>
            </h2>
            <div id="collapseBtn${i}" class="accordion-collapse collapse" aria-labelledby="headingBtn${i}" data-bs-parent="#buttonsAccordion">
                <div class="accordion-body">
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">نص الزر (Button Label)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary btn-label-input" data-index="${i}" name="btn_${i}_label" value="${btn.label || ''}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">إيموجي الزر (Emoji)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary btn-emoji-input" data-index="${i}" name="btn_${i}_emoji" value="${btn.emoji || ''}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">لون وتصميم الزر (Style)</label>
                            <select class="form-select bg-dark text-white border-secondary btn-style-input" data-index="${i}" name="btn_${i}_style">
                                <option value="PRIMARY" ${btn.style === 'PRIMARY' ? 'selected' : ''}>أزرق (Primary)</option>
                                <option value="SECONDARY" ${btn.style === 'SECONDARY' ? 'selected' : ''}>رمادي (Secondary)</option>
                                <option value="SUCCESS" ${btn.style === 'SUCCESS' ? 'selected' : ''}>أخضر (Success)</option>
                                <option value="DANGER" ${btn.style === 'DANGER' ? 'selected' : ''}>أحمر (Danger)</option>
                            </select>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">صيغة تسمية التكت الجديد (Ticket Name Format)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary" name="btn_${i}_ticketName" value="${btn.ticketName || 'ticket-{username}'}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">رتبة الدعم لعمل منشن لها (Role ID)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary" name="btn_${i}_mentionRole" value="${btn.mentionRole || ''}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">تصنيف التكتات لهذا الزر (Category ID - اختياري)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary" name="btn_${i}_categoryId" value="${btn.categoryId || ''}">
                        </div>
                        <div class="col-12 mb-3">
                            <label class="form-label">رسالة ترحيب مخصصة داخل التكت</label>
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
        <h2 class="fw-bold mb-4">تصميم لوحة رسائل التكت والأزرار التفاعلية</h2>
        ${success}
        ${actionStatus}

        <form id="ticketForm" method="POST" action="/dashboard/${guildId}/ticket-msg">
            <div class="row">
                <div class="col-lg-7">
                    <div class="card glass-card text-white mb-4">
                        <div class="card-header bg-transparent border-0 fw-bold h5">تخصيص رسالة الـ Embed</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">عنوان الرسالة (Title)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" id="embedTitle" name="title" value="${embed.title || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">وصف الرسالة (Description)</label>
                                <textarea class="form-control bg-dark text-white border-secondary" id="embedDesc" name="description" rows="4">${embed.description || ''}</textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">لون جانب الرسالة (Color)</label>
                                <input type="color" class="form-control form-control-color bg-dark border-secondary w-100" id="embedColor" name="color" value="${embed.color || '#3b82f6'}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">اسم كاتب الرسالة (Author)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" id="embedAuthor" name="author" value="${embed.author || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">تذييل الرسالة (Footer Text)</label>
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

                    <div class="card glass-card text-white mb-4">
                        <div class="card-header bg-transparent border-0 fw-bold h5">أزرار فتح التكت (unlimited buttons)</div>
                        <div class="card-body">
                            <div class="accordion" id="buttonsAccordion">
                                ${buttonsHtml}
                            </div>
                        </div>
                    </div>

                    <div class="card glass-card text-white">
                        <div class="card-header bg-transparent border-0 fw-bold h5">عمليات اللوحة والتحكم المباشر</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">القناة الحالية المستهدفة لنشر رسالة الأزرار: </label>
                                <span class="badge bg-secondary p-2 fs-6 rounded-pill">${config.embedChannelId ? '#' + config.embedChannelId : 'غير محددة بالقنوات'}</span>
                            </div>
                            <div class="d-flex gap-2 flex-wrap">
                                <button type="submit" name="action" value="save" class="btn btn-glow-secondary">حفظ التغييرات بالملف</button>
                                <button type="submit" name="action" value="send" class="btn btn-glow-success">إرسال كرسالة جديدة 📢</button>
                                <button type="submit" name="action" value="edit" class="btn btn-glow-primary" ${!config.activeEmbedMessageId ? 'disabled' : ''}>تحديث الرسالة الحالية ✏️</button>
                                <button type="submit" name="action" value="delete" class="btn btn-glow-danger" ${!config.activeEmbedMessageId ? 'disabled' : ''}>إزالة اللوحة من ديسكورد 🗑️</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- شاشة المعاينة الحية المباشرة -->
                <div class="col-lg-5">
                    <div class="sticky-top" style="top: 2rem; z-index: 10;">
                        <h4 class="mb-3 text-muted fw-bold">المعاينة الفورية لرسالة الديسكورد (Live Preview)</h4>
                        <div class="card glass-card border-0">
                            <div class="card-body bg-dark rounded-4">
                                <div class="discord-preview" id="previewEmbed">
                                    <div class="discord-preview-author mb-1" id="previewAuthorContainer">
                                        <span id="previewAuthor"></span>
                                    </div>
                                    <div class="discord-preview-title" id="previewTitle">العنوان</div>
                                    <img src="" class="discord-preview-thumbnail d-none" id="previewThumbnailImg">
                                    <div class="discord-preview-desc" id="previewDesc">الوصف التعريفي للرسالة...</div>
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
            pTitle.innerText = titleInp.value || 'لا يوجد عنوان';
            pDesc.innerText = descInp.value || 'الوصف يظهر هنا عند الكتابة...';
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

// معالجة المدخلات والأزرار للسيرفر المحدد
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
                redirectStatus = encodeURIComponent('تم إرسال اللوحة الجديدة بنجاح ونشرها بالديسكورد.');
                logEvent('embed_send', guildId, { user: req.user, channel: `<#${config.embedChannelId}>` });
            }
        } else if (action === 'edit') {
            if (!config.activeEmbedMessageId) {
                redirectStatus = encodeURIComponent('حدث خطأ: لا توجد رسالة نشطة لتعديلها.');
            } else {
                await editTicketEmbed(guildId);
                redirectStatus = encodeURIComponent('تم تعديل وتحديث الرسالة الحالية بنجاح بالديسكورد.');
                logEvent('embed_edit', guildId, { user: req.user });
            }
        } else if (action === 'delete') {
            if (!config.activeEmbedMessageId) {
                redirectStatus = encodeURIComponent('حدث خطأ: لا توجد رسالة نشطة لحذفها.');
            } else {
                await deleteTicketEmbed(guildId);
                redirectStatus = encodeURIComponent('تم إزالة وحذف رسالة الأزرار بنجاح.');
                logEvent('embed_delete', guildId, { user: req.user });
            }
        } else {
            redirectStatus = encodeURIComponent('تم حفظ إعدادات الرسالة والأزرار بنجاح بالملف.');
        }
    } catch (err) {
        console.error(err);
        redirectStatus = encodeURIComponent('خطأ أثناء التعامل مع ديسكورد: ' + err.message);
    }

    res.redirect(`/dashboard/${guildId}/ticket-msg?success=true&actionStatus=${redirectStatus}`);
});

// ==================== وظائف البوت الأساسية لـ ديسكورد ====================

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
            console.error("Failed to delete message: ", err.message);
        }
    }
    config.activeEmbedMessageId = "";
    saveGuildConfig(guildId, config);
}

// ==================== تفاعل الأزرار وحسابات التكت في ديسكورد ====================

client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;
    const config = getGuildConfig(guildId);

    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith('open_ticket_')) {
            await interaction.deferReply({ ephemeral: true });
            const btnIndex = parseInt(customId.replace('open_ticket_', ''));
            const btnConfig = config.buttons[btnIndex];
            
            if (!btnConfig) {
                return interaction.editReply({ content: "خطأ: لم يتم العثور على إعدادات هذا الزر بالسيرفر." });
            }

            const guild = interaction.guild;
            
            // تحقق من حد التكتات الأقصى لكل مستخدم (Ticket Limit System)
            const maxLimit = Number(config.maxTicketsPerUser) || 1;
            
            // حساب التكتات النشطة حالياً للمستخدم في هذا السيرفر
            // ديسكورد يحتاج لتفقد القنوات التي تحمل أسمائهم أو يفحص الأذونات
            const activeTicketsCount = guild.channels.cache.filter(c => {
                const startsWithTicket = c.name.startsWith('ticket-');
                const hasUserPermission = c.permissionOverwrites.cache.has(interaction.user.id);
                return startsWithTicket && hasUserPermission;
            }).size;

            if (activeTicketsCount >= maxLimit) {
                return interaction.editReply({ 
                    content: `⚠️ عذراً، لقد تجاوزت الحد الأقصى للتذاكر المفتوحة المسموح به في هذا السيرفر وهو: **${maxLimit} تكت** لكل مستخدم.` 
                });
            }

            const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
            const expectedName = (btnConfig.ticketName || 'ticket-{username}')
                .replace('{username}', cleanUsername)
                .toLowerCase();

            // فحص وجود تكت مكرر بنفس الاسم بالكامل
            const duplicateChannel = guild.channels.cache.find(c => c.name === expectedName);
            if (duplicateChannel) {
                return interaction.editReply({ content: `لديك تكت مفتوح بالفعل: <#${duplicateChannel.id}>` });
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
                    .setTitle(`مركز المساعدة والخدمات - ${btnConfig.label}`)
                    .setDescription(welcome)
                    .setColor(config.dashboardColor || "#3b82f6")
                    .setTimestamp();

                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_close').setLabel('إغلاق 🔒').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ticket_claim').setLabel('استلام 🔑').setStyle(ButtonStyle.Success),
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

                await interaction.editReply({ content: `تم فتح التكت بنجاح: <#${ticketChannel.id}>` });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: "فشل إنشاء التكت. يرجى رفع رتبة البوت إلى أعلى رتب السيرفر أولاً." });
            }
        }

        // إغلاق التكت
        if (customId === 'ticket_close') {
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('تأكيد الإغلاق الفوري 🔒').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('إلغاء الإغلاق').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ content: 'هل أنت متأكد من رغبتك في إغلاق هذه التكت وحفظ الأرشيف؟', components: [confirmRow] });
        }

        if (customId === 'ticket_close_cancel') {
            await interaction.message.delete().catch(() => {});
        }

        if (customId === 'ticket_close_confirm') {
            await interaction.reply({ content: 'جاري إنشاء الأرشيف وإغلاق التكت الفوري خلال 5 ثوانٍ...' });
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

        // استلام التكت (Admin Claim System)
        if (customId === 'ticket_claim') {
            const channel = interaction.channel;
            const member = interaction.member;

            if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: "عذراً، لا تملك الصلاحية الكافية لاستلام هذا التكت.", ephemeral: true });
            }

            // تعديل الأذونات ليكون المسؤول هو المعين بمتابعة التكت ومخفية عن الباقي
            await channel.permissionOverwrites.edit(member.id, {
                SendMessages: true,
                ViewChannel: true,
                ReadMessageHistory: true
            });

            // إرسال رسالة الاستلام داخل التكت بالصيغة المطلوبة
            await interaction.reply({ 
                content: `🎫 تم استلام التكت من قبل الإداري: ${interaction.user}` 
            });

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
                .setPlaceholder('أدخل معرّف العضو هنا')
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
                .setPlaceholder('أدخل معرّف العضو هنا')
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

                await interaction.reply({ content: `تمت إضافة العضو ${targetMember} بنجاح للتكت وتفعيل صلاحيات المشاهدة.` });
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

                await interaction.reply({ content: `تمت إزالة العضو ${targetMember} بنجاح من التكت الفني.` });
                logEvent('remove_member', guildId, { user: interaction.user, channel: interaction.channel, details: targetMember.user });
            } catch (err) {
                await interaction.reply({ content: 'عذراً، تعذر العثور على العضو داخل السيرفر بالمعرف المدخل.', ephemeral: true });
            }
        }
    }
});

// دالة لتسجيل وبث الأحداث لـ ديسكورد
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

// توليد الأرشيف HTML الفاخر والمستقل
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
            body { background-color: #1e1f22; color: #dbdee1; font-family: sans-serif; margin: 0; padding: 24px; }
            .header { border-bottom: 2px solid #2f3136; padding-bottom: 20px; margin-bottom: 24px; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .header p { color: #949ba4; margin: 6px 0 0 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>سيرفر: ${channel.guild.name}</h1>
            <p>أرشيف وسجلات المحادثة لقناة: #${channel.name}</p>
            <p>تاريخ تصدير الأرشيف: ${new Date().toLocaleString('ar-EG')}</p>
        </div>
        <div class="messages-container">
            ${msgsMarkup || '<p style="text-align: center; color: #949ba4; padding: 40px;">لا توجد رسائل مسجلة بهذه التكت.</p>'}
        </div>
    </body>
    </html>
    `;
}

// تشغيل وربط خوادم البوت والويب معاً
client.once('ready', () => {
    console.log(`Bot logged in as: ${client.user.tag} (ticket bot.v1 is Ready)`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Failed to login to Discord: ", err.message);
});

app.listen(PORT, () => {
    console.log(`Web Dashboard is running on port ${PORT}`);
});