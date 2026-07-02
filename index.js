/**
 * 🎫 PRO TICKET BOT V1 & SaaS GLASSMORPHISM DASHBOARD
 */

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
    TextInputStyle,
    AttachmentBuilder
} = require('discord.js');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(__dirname, 'config.json');

// --- قاعدة البيانات السحابية والمحلية الذكية ---
let database = {
    guilds: {} // إعدادات البوت والداشبورد لكل سيرفر بشكل مستقل
};

function loadDatabase() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            if (data.trim() !== "") {
                database = JSON.parse(data);
            }
        }
    } catch (err) {
        console.error("Error reading config.json local storage: ", err);
    }
}
loadDatabase();

function saveDatabase() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(database, null, 2), 'utf8');
    } catch (err) {
        console.error("Error saving database local storage: ", err);
    }
}

// مزامنة احتياطية سحابية لضمان عدم ضياع إعدادات السيرفرات في Render
function syncDatabaseCloud() {
    try {
        const dataStr = JSON.stringify(database);
        const options = {
            hostname: 'kv.fast-db.com', 
            port: 443,
            path: `/set?key=pro_ticket_bot_db_${process.env.CLIENT_ID}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(dataStr)
            }
        };
        const req = https.request(options, (res) => {});
        req.on('error', (e) => { console.error("Cloud sync issue: ", e.message); });
        req.write(dataStr);
        req.end();
    } catch (err) {
        console.error("Cloud Sync Failed: ", err);
    }
}

function restoreDatabaseCloud() {
    try {
        https.get(`https://kv.fast-db.com/get?key=pro_ticket_bot_db_${process.env.CLIENT_ID}`, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    if (data && data.trim() !== "" && data !== "null") {
                        database = JSON.parse(data);
                        saveDatabase();
                        console.log("☁️ [Cloud Sync] Database recovered successfully!");
                    }
                } catch (e) {
                    console.log("Using local configurations database.");
                }
            });
        }).on('error', (e) => {
            console.error("Cloud Restore Failed: ", e.message);
        });
    } catch (err) {
        console.error("Cloud Restore Trigger Failed: ", err);
    }
}

// جلب إعدادات سيرفر محدد أو تطبيق القوالب الافتراضية
function getGuildConfig(guildId) {
    if (!database.guilds[guildId]) {
        database.guilds[guildId] = {
            logsChannelId: "",
            embedChannelId: "",
            defaultCategoryId: "",
            maxTicketsPerUser: 4, 
            embed: {
                title: "🎫 مركز المساعدة والدعم الفني",
                description: "أهلاً بك في مركز الدعم. يرجى النقر على القسم المطلوب بالأسفل للتحدث مع فريق العمل الإداري.",
                color: "#3b82f6",
                author: "ticket bot.v1",
                footer: "نحن هنا لخدمتك دائماً",
                thumbnail: "",
                image: "",
                timestamp: true
            },
            buttons: [
                {
                    id: "support_general",
                    label: "الدعم الفني",
                    emoji: "🎫",
                    style: "PRIMARY",
                    ticketName: "ticket-{username}",
                    mentionRole: "",
                    categoryId: "",
                    welcomeMessage: "أهلاً بك {user} في قسم الدعم الفني العام. يرجى كتابة تفاصيل مشكلتك هنا وسيرد عليك الإداري المختص."
                }
            ],
            activeEmbedMessageId: "",
            // الإضافات والميزات الجديدة المطلوبة:
            autoReplies: [], // نظام الرد التلقائي
            welcome: {
                enabled: false,
                channelId: "",
                mentionUser: true,
                message: "مرحباً بك {user} في سيرفرنا الرائع! نورت السيرفر ✨",
                bgUrl: "https://i.imgur.com/4S7jFv1.png"
            },
            embedSender: {
                title: "",
                description: "",
                color: "#3b82f6",
                image: "",
                thumbnail: "",
                footer: "",
                author: "",
                targetChannelId: "",
                lastMessageId: ""
            },
            autoRole: {
                enabled: false,
                roleId: ""
            }
        };
        saveDatabase();
    }
    return database.guilds[guildId];
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
    secret: process.env.SESSION_SECRET || 'probot-ticket-saas-key',
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

// جدران الحماية للتحقق من الصلاحيات والوصول
function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}

function checkGuildAccess(req, res, next) {
    const guildId = req.params.guildId;
    if (!guildId) return res.redirect('/dashboard');

    const userGuilds = req.user.guilds;
    const targetGuild = userGuilds.find(g => g.id === guildId);
    
    if (!targetGuild) {
        return res.status(403).send("عذراً، لست عضواً في هذا السيرفر.");
    }

    const permissions = Number(targetGuild.permissions);
    const isAdmin = (permissions & 0x8) === 0x8;
    const isManageGuild = (permissions & 0x20) === 0x20;

    if (isAdmin || isManageGuild) {
        const botInGuild = client.guilds.cache.has(guildId);
        if (!botInGuild) {
            return res.status(403).send(`
                <div style="background-color: #05070f; color: #fff; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: 'Cairo', sans-serif;">
                    <h2 style="color: #3b82f6;">البوت غير مضاف للسيرفر!</h2>
                    <p style="color: #94a3b8; margin-bottom: 20px;">يرجى إضافة البوت للسيرفر أولاً لتتمكن من إدارته بالكامل.</p>
                    <a href="https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&integration_type=0&scope=bot+applications.commands" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 12px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);" target="_blank">دعوة البوت الآن 🚀</a>
                </div>
            `);
        }
        return next();
    }
    return res.status(403).send("عذراً، لا تمتلك صلاحيات كافية (مسؤول أو مدير السيرفر) لدخول لوحة التحكم.");
}

// تصميم لوحة التحكم المتقدم بنظام Glassmorphism المتوهج
function renderDashboard(content, activeTab, req, currentGuildId = null) {
    const user = req.user;
    const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const botName = "ticket bot.v1";
    
    const homeLink = currentGuildId ? `/dashboard/${currentGuildId}` : '/dashboard';
    const ticketLink = currentGuildId ? `/dashboard/${currentGuildId}/ticket-msg` : '#';
    const settingsLink = currentGuildId ? `/dashboard/${currentGuildId}/settings` : '#';
    const welcomeLink = currentGuildId ? `/dashboard/${currentGuildId}/welcome` : '#';
    const autoreplyLink = currentGuildId ? `/dashboard/${currentGuildId}/autoreply` : '#';
    const embedsenderLink = currentGuildId ? `/dashboard/${currentGuildId}/embedsender` : '#';
    const autoroleLink = currentGuildId ? `/dashboard/${currentGuildId}/autorole` : '#';

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
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap');
            :root {
                --bg-deep: #05070f;
                --bg-glass: rgba(15, 23, 42, 0.65);
                --bg-sidebar: rgba(10, 15, 30, 0.95);
                --accent-blue: #3b82f6;
                --accent-purple: #8b5cf6;
                --text-light: #f8fafc;
                --text-muted: #94a3b8;
                --glow-color: rgba(59, 130, 246, 0.35);
            }
            body {
                background: radial-gradient(circle at 50% 50%, #0d1224 0%, var(--bg-deep) 100%);
                color: var(--text-light);
                font-family: 'Cairo', sans-serif;
                min-height: 100vh;
                overflow-x: hidden;
            }
            #loader {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: var(--bg-deep);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                transition: opacity 0.5s ease;
            }
            .spinner {
                width: 60px;
                height: 60px;
                border: 4px solid rgba(59, 130, 246, 0.1);
                border-top-color: var(--accent-blue);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                box-shadow: 0 0 15px var(--glow-color);
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .glass-card {
                background: var(--bg-glass);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 1.25rem;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
            }
            .glass-card:hover {
                box-shadow: 0 12px 40px 0 rgba(59, 130, 246, 0.2);
            }
            .sidebar {
                background-color: var(--bg-sidebar);
                backdrop-filter: blur(25px);
                min-height: 100vh;
                width: 290px;
                position: fixed;
                top: 0;
                bottom: 0;
                right: 0;
                z-index: 100;
                border-left: 1px solid rgba(255, 255, 255, 0.05);
                transition: all 0.4s ease;
            }
            .main-content {
                margin-right: 290px;
                padding: 2.5rem;
                transition: all 0.4s ease;
            }
            @media (max-width: 991.98px) {
                .sidebar { right: -290px; }
                .sidebar.active { right: 0; }
                .main-content { margin-right: 0; padding: 1.5rem; }
            }
            .btn-glow-primary {
                background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
                border: none;
                color: #fff;
                font-weight: 700;
                border-radius: 50px;
                padding: 10px 24px;
                box-shadow: 0 0 15px var(--glow-color);
                transition: all 0.3s ease;
            }
            .btn-glow-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 0 25px rgba(139, 92, 246, 0.65);
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
            .btn-glow-danger {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                border: none;
                color: #fff;
                font-weight: 600;
                border-radius: 50px;
                padding: 10px 24px;
                transition: all 0.3s ease;
            }
            .btn-glow-danger:hover {
                transform: translateY(-2px);
                box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
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
                opacity: 0.25;
                pointer-events: none;
            }
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
        </style>
    </head>
    <body>
        <div id="loader">
            <div class="spinner"></div>
            <p style="margin-top: 20px; font-weight: 700; letter-spacing: 1px; color: var(--accent-blue);">جاري تحميل اللوحة الاحترافية...</p>
        </div>

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
                <a href="${autoreplyLink}" class="nav-link ${activeTab === 'autoreply' ? 'active' : ''} ${!currentGuildId ? 'disabled' : ''}">
                    <i class="bi bi-chat-quote"></i> الرد التلقائي (Auto Reply)
                </a>
                <a href="${welcomeLink}" class="nav-link ${activeTab === 'welcome' ? 'active' : ''} ${!currentGuildId ? 'disabled' : ''}">
                    <i class="bi bi-megaphone"></i> نظام الترحيب والبطاقات
                </a>
                <a href="${embedsenderLink}" class="nav-link ${activeTab === 'embedsender' ? 'active' : ''} ${!currentGuildId ? 'disabled' : ''}">
                    <i class="bi bi-envelope"></i> مرسل رسائل Embed
                </a>
                <a href="${autoroleLink}" class="nav-link ${activeTab === 'autorole' ? 'active' : ''} ${!currentGuildId ? 'disabled' : ''}">
                    <i class="bi bi-person-badge"></i> رتب الدخول (Auto Role)
                </a>
                
                <hr class="mx-3 border-secondary">
                
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

        <script>
            window.addEventListener('load', () => {
                const loader = document.getElementById('loader');
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 500);
            });
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
    const config = getGuildConfig(guildId);
    
    let openTickets = 0;
    if (guild) {
        openTickets = guild.channels.cache.filter(c => c.name.startsWith('ticket-')).size;
    }

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
                                <div class="text-xs text-primary text-uppercase mb-1 fw-bold">حالة البوت</div>
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
                                <div class="h5 mb-0 fw-bold">${client.ws.ping} ms</div>
                            </div>
                            <div class="col-auto"><i class="bi bi-cpu text-warning" style="font-size: 2rem;"></i></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    res.send(renderDashboard(content, 'home', req, guildId));
});

// صفحة الإعدادات وجلب الغلاف (رتب، رومات، تصنيفات تلقائياً عبر API)
app.get('/dashboard/:guildId/settings', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    const guild = client.guilds.cache.get(guildId);

    const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
    
    let logsOptions = `<option value="">-- اختر روم اللوق --</option>`;
    let embedOptions = `<option value="">-- اختر روم الإرسال --</option>`;
    channels.forEach(ch => {
        logsOptions += `<option value="${ch.id}" ${config.logsChannelId === ch.id ? 'selected' : ''}>#${ch.name}</option>`;
        embedOptions += `<option value="${ch.id}" ${config.embedChannelId === ch.id ? 'selected' : ''}>#${ch.name}</option>`;
    });

    let categoryOptions = `<option value="">-- اختر تصنيف التكتات الافتراضي --</option>`;
    categories.forEach(cat => {
        categoryOptions += `<option value="${cat.id}" ${config.defaultCategoryId === cat.id ? 'selected' : ''}>${cat.name}</option>`;
    });

    const successMsg = req.query.success === 'true' ? `
        <div class="alert alert-success alert-dismissible fade show" role="alert" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981;">
            تم تحديث وحفظ الإعدادات بنجاح.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    ` : '';

    const content = `
    <div class="container-fluid">
        <h2 class="fw-bold mb-4">قنوات وهيكل التكت الذكي (بدون كتابة معرفات يدوياً)</h2>
        ${successMsg}
        
        <form action="/dashboard/${guildId}/settings" method="POST">
            <div class="row">
                <div class="col-lg-8">
                    <!-- نظام الحد الأقصى للتكتات -->
                    <div class="card glass-card text-white mb-4">
                        <div class="card-header bg-transparent border-0 fw-bold h5">الحد الأقصى للتذاكر للمستخدم الواحد (Max Tickets Per User)</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">اختر الحد الأقصى للتذاكر</label>
                                <select class="form-select bg-dark text-white border-secondary text-white" name="maxTicketsPerUser" id="maxTicketsSelector">
                                    <option value="1" ${config.maxTicketsPerUser == 1 ? 'selected' : ''}>1 تكت</option>
                                    <option value="2" ${config.maxTicketsPerUser == 2 ? 'selected' : ''}>2 تكت</option>
                                    <option value="3" ${config.maxTicketsPerUser == 3 ? 'selected' : ''}>3 تكت</option>
                                    <option value="4" ${config.maxTicketsPerUser == 4 ? 'selected' : ''}>4 تكت (الافتراضي)</option>
                                    <option value="5" ${config.maxTicketsPerUser == 5 ? 'selected' : ''}>5 تكت</option>
                                    <option value="custom" ${![1,2,3,4,5].includes(Number(config.maxTicketsPerUser)) ? 'selected' : ''}>رقم مخصص</option>
                                </select>
                            </div>
                            <div class="mb-3 d-none" id="customLimitWrapper">
                                <label class="form-label">ادخل الرقم المخصص</label>
                                <input type="number" class="form-control bg-dark text-white border-secondary" name="customMaxTickets" value="${![1,2,3,4,5].includes(Number(config.maxTicketsPerUser)) ? config.maxTicketsPerUser : '4'}" min="1">
                            </div>
                        </div>
                    </div>

                    <div class="card glass-card text-white">
                        <div class="card-header bg-transparent border-0 fw-bold h5">القنوات والتصنيفات الأساسية بالسيرفر</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">روم السجلات واللوق (Logs Channel)</label>
                                <select class="form-select bg-dark text-white border-secondary" name="logsChannelId">
                                    ${logsOptions}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">روم إرسال رسالة التكت (Embed Channel)</label>
                                <select class="form-select bg-dark text-white border-secondary" name="embedChannelId">
                                    ${embedOptions}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">تصنيف التكتات الافتراضي (Category)</label>
                                <select class="form-select bg-dark text-white border-secondary" name="defaultCategoryId">
                                    ${categoryOptions}
                                </select>
                            </div>
                            <button type="submit" class="btn btn-glow-primary px-5 mt-3">حفظ الإعدادات الفنية 💾</button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </div>

    <script>
        const selector = document.getElementById('maxTicketsSelector');
        const customWrapper = document.getElementById('customLimitWrapper');
        function toggleCustom() {
            if (selector.value === 'custom') {
                customWrapper.classList.remove('d-none');
            } else {
                customWrapper.classList.add('d-none');
            }
        }
        selector.addEventListener('change', toggleCustom);
        toggleCustom();
    </script>
    `;
    res.send(renderDashboard(content, 'settings', req, guildId));
});

app.post('/dashboard/:guildId/settings', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    if (req.body.maxTicketsPerUser === 'custom') {
        config.maxTicketsPerUser = Number(req.body.customMaxTickets) || 4;
    } else {
        config.maxTicketsPerUser = Number(req.body.maxTicketsPerUser) || 4;
    }

    config.logsChannelId = req.body.logsChannelId;
    config.embedChannelId = req.body.embedChannelId;
    config.defaultCategoryId = req.body.defaultCategoryId;
    
    saveGuildConfig(guildId, config);
    res.redirect(`/dashboard/${guildId}/settings?success=true`);
});

// صفحة تعديل وتصميم رسالة التكت والتحكم بالأزرار
app.get('/dashboard/:guildId/ticket-msg', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    const guild = client.guilds.cache.get(guildId);

    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
    const roles = guild.roles.cache.filter(r => r.name !== '@everyone');

    let buttonsHtml = '';
    config.buttons.forEach((btn, i) => {
        let catOptions = `<option value="">-- استخدام التصنيف الافتراضي --</option>`;
        categories.forEach(cat => {
            catOptions += `<option value="${cat.id}" ${btn.categoryId === cat.id ? 'selected' : ''}>${cat.name}</option>`;
        });

        let roleOptions = `<option value="">-- بدون منشن للرتبة --</option>`;
        roles.forEach(role => {
            roleOptions += `<option value="${role.id}" ${btn.mentionRole === role.id ? 'selected' : ''}>@${role.name}</option>`;
        });

        buttonsHtml += `
        <div class="accordion-item bg-dark border-secondary text-white mb-3" id="btn_card_${i}">
            <h2 class="accordion-header" id="headingBtn${i}">
                <button class="accordion-button collapsed bg-secondary text-white" type="button" data-bs-toggle="collapse" data-bs-target="#collapseBtn${i}">
                    فئة تكت رقم ${i+1}: ${btn.label || 'تكت جديدة'}
                </button>
            </h2>
            <div id="collapseBtn${i}" class="accordion-collapse collapse" data-bs-parent="#buttonsAccordion">
                <div class="accordion-body">
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">نص الزر (Label)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary btn-label-input" name="buttons[${i}][label]" value="${btn.label}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">إيموجي الزر (Emoji)</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary" name="buttons[${i}][emoji]" value="${btn.emoji || ''}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">ستايل الزر (Style)</label>
                            <select class="form-select bg-dark text-white border-secondary btn-style-input" name="buttons[${i}][style]">
                                <option value="PRIMARY" ${btn.style === 'PRIMARY' ? 'selected' : ''}>أزرق (Primary)</option>
                                <option value="SECONDARY" ${btn.style === 'SECONDARY' ? 'selected' : ''}>رمادي (Secondary)</option>
                                <option value="SUCCESS" ${btn.style === 'SUCCESS' ? 'selected' : ''}>أخضر (Success)</option>
                                <option value="DANGER" ${btn.style === 'DANGER' ? 'selected' : ''}>أحمر (Danger)</option>
                            </select>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">صيغة تسمية التكت الجديد</label>
                            <input type="text" class="form-control bg-dark text-white border-secondary" name="buttons[${i}][ticketName]" value="${btn.ticketName || 'ticket-{username}'}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">رتبة الدعم لعمل منشن لها (Role)</label>
                            <select class="form-select bg-dark text-white border-secondary" name="buttons[${i}][mentionRole]">
                                ${roleOptions}
                            </select>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">تصنيف التكتات الخاص بهذه الفئة (Category)</label>
                            <select class="form-select bg-dark text-white border-secondary" name="buttons[${i}][categoryId]">
                                ${catOptions}
                            </select>
                        </div>
                        <div class="col-12 mb-3">
                            <label class="form-label">رسالة ترحيب مخصصة داخل التكت</label>
                            <textarea class="form-control bg-dark text-white border-secondary" name="buttons[${i}][welcomeMessage]" rows="3">${btn.welcomeMessage || ''}</textarea>
                        </div>
                        <div class="col-12 text-end">
                            <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeBtnCard(${i})">حذف هذه الفئة 🗑️</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    });

    const embed = config.embed || {};

    const content = `
    <div class="container-fluid">
        <h2 class="fw-bold mb-4">تصميم لوحة رسائل التكت وفئات الأزرار المتعددة</h2>
        ${req.query.success === 'true' ? `<div class="alert alert-success">تم حفظ الإعدادات بنجاح!</div>` : ''}

        <form id="ticketForm" method="POST" action="/dashboard/${guildId}/ticket-msg">
            <div class="row">
                <div class="col-lg-7">
                    <div class="card glass-card text-white mb-4">
                        <div class="card-header bg-transparent border-0 fw-bold h5">تخصيص رسالة الـ Embed</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">عنوان الرسالة (Title)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="title" value="${embed.title || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">وصف الرسالة (Description)</label>
                                <textarea class="form-control bg-dark text-white border-secondary" name="description" rows="4">${embed.description || ''}</textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">لون جانب الرسالة (Color)</label>
                                <input type="color" class="form-control form-control-color bg-dark border-secondary w-100" name="color" value="${embed.color || '#3b82f6'}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">اسم كاتب الرسالة (Author)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="author" value="${embed.author || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">تذييل الرسالة (Footer Text)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="footer" value="${embed.footer || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">رابط مصغرة الصورة بالأعلى (Thumbnail URL)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="thumbnail" value="${embed.thumbnail || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">رابط الصورة الكبيرة بالأسفل (Image URL)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="image" value="${embed.image || ''}">
                            </div>
                        </div>
                    </div>

                    <div class="card glass-card text-white mb-4">
                        <div class="card-header bg-transparent border-0 d-flex justify-content-between align-items-center">
                            <h5 class="fw-bold m-0">فئات أزرار التكت النشطة</h5>
                            <button type="button" class="btn btn-sm btn-glow-primary" onclick="addNewBtnCard()">+ إضافة فئة جديدة</button>
                        </div>
                        <div class="card-body">
                            <div class="accordion" id="buttonsAccordion">
                                ${buttonsHtml}
                            </div>
                        </div>
                    </div>

                    <div class="card glass-card text-white">
                        <div class="card-header bg-transparent border-0 fw-bold h5">عمليات لوحة ديسكورد المباشرة</div>
                        <div class="card-body">
                            <div class="d-flex gap-2 flex-wrap">
                                <button type="submit" name="action" value="save" class="btn btn-glow-secondary">حفظ التغييرات 💾</button>
                                <button type="submit" name="action" value="send" class="btn btn-glow-success">إرسال لوحة جديدة للروم 📢</button>
                                <button type="submit" name="action" value="edit" class="btn btn-glow-primary" ${!config.activeEmbedMessageId ? 'disabled' : ''}>تحديث الرسالة الحالية ✏️</button>
                                <button type="submit" name="action" value="delete" class="btn btn-glow-danger" ${!config.activeEmbedMessageId ? 'disabled' : ''}>حذف اللوحة من ديسكورد 🗑️</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-5">
                    <div class="sticky-top" style="top: 2rem; z-index: 10;">
                        <h4 class="mb-3 text-muted fw-bold">معاينة لوحة ديسكورد</h4>
                        <div class="card glass-card border-0">
                            <div class="card-body bg-dark rounded-4">
                                <div class="discord-preview" style="border-right-color: ${embed.color || '#3b82f6'};">
                                    <div class="discord-preview-title">${embed.title || 'العنوان الافتراضي'}</div>
                                    <div class="discord-preview-desc">${embed.description || 'الوصف الافتراضي للتكت...'}</div>
                                    <div class="discord-preview-footer">${embed.footer || 'تذييل الرسالة'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </div>

    <script>
        function addNewBtnCard() {
            const accordion = document.getElementById('buttonsAccordion');
            const newIndex = accordion.children.length;
            
            const div = document.createElement('div');
            div.className = 'accordion-item bg-dark border-secondary text-white mb-3';
            div.id = 'btn_card_' + newIndex;
            div.innerHTML = \`
                <h2 class="accordion-header" id="headingBtn\${newIndex}">
                    <button class="accordion-button bg-secondary text-white" type="button" data-bs-toggle="collapse" data-bs-target="#collapseBtn\${newIndex}">
                        فئة تكت رقم \${newIndex + 1}: فئة جديدة (يرجى حفظ التغييرات بعد التعديل)
                    </button>
                </h2>
                <div id="collapseBtn\${newIndex}" class="accordion-collapse collapse show" data-bs-parent="#buttonsAccordion">
                    <div class="accordion-body">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">نص الزر (Label)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="buttons[\${newIndex}][label]" value="فئة جديدة">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">إيموجي الزر (Emoji)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="buttons[\${newIndex}][emoji]" value="🎫">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">صيغة تسمية التكت الجديد</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="buttons[\${newIndex}][ticketName]" value="ticket-{username}">
                            </div>
                            <div class="col-12 mb-3">
                                <label class="form-label">رسالة ترحيب مخصصة داخل التكت</label>
                                <textarea class="form-control bg-dark text-white border-secondary" name="buttons[\${newIndex}][welcomeMessage]" rows="3">مرحباً بك!</textarea>
                            </div>
                            <div class="col-12 text-end">
                                <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeBtnCard(\${newIndex})">حذف 🗑️</button>
                            </div>
                        </div>
                    </div>
                </div>
            \`;
            accordion.appendChild(div);
        }

        function removeBtnCard(index) {
            const card = document.getElementById('btn_card_' + index);
            if (card) card.remove();
        }
    </script>
    `;
    res.send(renderDashboard(content, 'ticket', req, guildId));
});

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
        image: req.body.image
    };

    config.buttons = [];
    if (req.body.buttons && typeof req.body.buttons === 'object') {
        const btnsArray = Object.values(req.body.buttons);
        btnsArray.forEach(btn => {
            if (btn.label && btn.label.trim() !== "") {
                config.buttons.push({
                    label: btn.label,
                    emoji: btn.emoji || "",
                    style: btn.style || "PRIMARY",
                    ticketName: btn.ticketName || "ticket-{username}",
                    mentionRole: btn.mentionRole || "",
                    categoryId: btn.categoryId || "",
                    welcomeMessage: btn.welcomeMessage || ""
                });
            }
        });
    }

    saveGuildConfig(guildId, config);

    let status = '';
    try {
        if (action === 'send') {
            await sendTicketEmbed(guildId);
            status = 'تم إرسال اللوحة للروم بنجاح!';
        } else if (action === 'edit') {
            await editTicketEmbed(guildId);
            status = 'تم تعديل اللوحة الحالية بنجاح!';
        } else if (action === 'delete') {
            await deleteTicketEmbed(guildId);
            status = 'تم حذف اللوحة بنجاح!';
        }
    } catch (e) {
        status = 'Error: ' + e.message;
    }

    res.redirect(`/dashboard/${guildId}/ticket-msg?success=true&statusMsg=${encodeURIComponent(status)}`);
});

// --- 1. نظام الرد التلقائي (Automatic Reply Dashboard) ---
app.get('/dashboard/:guildId/autoreply', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    let rowsHtml = '';
    config.autoReplies.forEach((item, index) => {
        rowsHtml += `
        <tr>
            <td class="fw-bold text-info">${item.keyword}</td>
            <td>${item.reply}</td>
            <td>
                <span class="badge ${item.enabled ? 'bg-success' : 'bg-secondary'}">
                    ${item.enabled ? 'نشط' : 'معطل'}
                </span>
            </td>
            <td>
                <form action="/dashboard/${guildId}/autoreply/toggle/${index}" method="POST" class="d-inline">
                    <button type="submit" class="btn btn-sm btn-outline-warning rounded-pill">تغيير الحالة 🔄</button>
                </form>
                <form action="/dashboard/${guildId}/autoreply/delete/${index}" method="POST" class="d-inline">
                    <button type="submit" class="btn btn-sm btn-glow-danger rounded-pill ms-1">حذف 🗑️</button>
                </form>
            </td>
        </tr>
        `;
    });

    const content = `
    <div class="container-fluid">
        <h2 class="fw-bold mb-4">🤖 نظام الردود التلقائية الذكي (Auto Reply)</h2>
        ${req.query.success === 'true' ? `<div class="alert alert-success">تم حفظ الإجراء بنجاح!</div>` : ''}
        
        <div class="row">
            <div class="col-lg-5 mb-4">
                <div class="card glass-card text-white border-0">
                    <div class="card-header bg-transparent border-0 fw-bold h5">إضافة رد تلقائي جديد</div>
                    <div class="card-body">
                        <form action="/dashboard/${guildId}/autoreply/add" method="POST">
                            <div class="mb-3">
                                <label class="form-label">الكلمة أو الجملة المفتاحية (البحث)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="keyword" placeholder="مثال: السلام عليكم" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">الرد المقابل من البوت</label>
                                <textarea class="form-control bg-dark text-white border-secondary" name="reply" placeholder="مثال: وعليكم السلام ورحمة الله وبركاته" rows="3" required></textarea>
                            </div>
                            <button type="submit" class="btn btn-glow-primary w-100">إضافة الرد التلقائي 🚀</button>
                        </form>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-7">
                <div class="card glass-card text-white border-0">
                    <div class="card-header bg-transparent border-0 fw-bold h5">قائمة الردود المضافة</div>
                    <div class="card-body p-0">
                        <table class="table table-dark table-hover table-borderless m-0 bg-transparent text-white align-middle">
                            <thead>
                                <tr class="border-bottom border-secondary text-muted">
                                    <th>الجملة المفتاحية</th>
                                    <th>رد البوت</th>
                                    <th>الحالة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml || '<tr><td colspan="4" class="text-center text-muted py-5">لا توجد ردود تلقائية مضافة حالياً.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    res.send(renderDashboard(content, 'autoreply', req, guildId));
});

app.post('/dashboard/:guildId/autoreply/add', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    config.autoReplies.push({
        keyword: req.body.keyword,
        reply: req.body.reply,
        enabled: true
    });
    
    saveGuildConfig(guildId, config);
    res.redirect(`/dashboard/${guildId}/autoreply?success=true`);
});

app.post('/dashboard/:guildId/autoreply/toggle/:index', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    const index = req.params.index;
    
    if (config.autoReplies[index]) {
        config.autoReplies[index].enabled = !config.autoReplies[index].enabled;
        saveGuildConfig(guildId, config);
    }
    res.redirect(`/dashboard/${guildId}/autoreply?success=true`);
});

app.post('/dashboard/:guildId/autoreply/delete/:index', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    const index = req.params.index;
    
    if (config.autoReplies[index]) {
        config.autoReplies.splice(index, 1);
        saveGuildConfig(guildId, config);
    }
    res.redirect(`/dashboard/${guildId}/autoreply?success=true`);
});

// --- 2. نظام الترحيب والبطاقات (Welcome System Dashboard) ---
app.get('/dashboard/:guildId/welcome', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    const guild = client.guilds.cache.get(guildId);

    const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    let channelsHtml = `<option value="">-- اختر روم الترحيب --</option>`;
    channels.forEach(ch => {
        channelsHtml += `<option value="${ch.id}" ${config.welcome.channelId === ch.id ? 'selected' : ''}>#${ch.name}</option>`;
    });

    const content = `
    <div class="container-fluid">
        <h2 class="fw-bold mb-4">👋 نظام ترحيب الأعضاء والبطاقات التلقائية</h2>
        ${req.query.success === 'true' ? `<div class="alert alert-success">تم حفظ إعدادات الترحيب بنجاح!</div>` : ''}
        
        <form action="/dashboard/${guildId}/welcome" method="POST">
            <div class="row">
                <div class="col-lg-8">
                    <div class="card glass-card text-white border-0">
                        <div class="card-header bg-transparent border-0 fw-bold h5">إعدادات بطاقة ورسالة الترحيب</div>
                        <div class="card-body">
                            <div class="mb-3 form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="enabled" ${config.welcome.enabled ? 'checked' : ''}>
                                <label class="form-check-label fw-bold">تشغيل نظام الترحيب والبطاقات بالروم</label>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">روم الترحيب (Welcome Channel)</label>
                                <select class="form-select bg-dark text-white border-secondary" name="channelId">
                                    ${channelsHtml}
                                </select>
                            </div>
                            
                            <div class="mb-3 form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="mentionUser" ${config.welcome.mentionUser ? 'checked' : ''}>
                                <label class="form-check-label">عمل منشن للعضو الجديد مع الرسالة</label>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">نص رسالة الترحيب</label>
                                <textarea class="form-control bg-dark text-white border-secondary" name="message" rows="3" placeholder="مرحباً بك {user} في سيرفرنا!">${config.welcome.message || ''}</textarea>
                                <small class="text-muted">استخدم {user} لمنشن العضو.</small>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">رابط خلفية بطاقة الترحيب (Welcome Card Background)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="bgUrl" value="${config.welcome.bgUrl || ''}">
                                <small class="text-muted">يقوم البوت تلقائياً بتوليد بطاقة ترحيبية احترافية مدمجة بصورة العضو، اسمه، وعدد الأعضاء.</small>
                            </div>
                            
                            <button type="submit" class="btn btn-glow-primary px-5 mt-3">حفظ إعدادات الترحيب والبطاقة 💾</button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </div>
    `;
    res.send(renderDashboard(content, 'welcome', req, guildId));
});

app.post('/dashboard/:guildId/welcome', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    config.welcome = {
        enabled: req.body.enabled === 'on',
        channelId: req.body.channelId,
        mentionUser: req.body.mentionUser === 'on',
        message: req.body.message,
        bgUrl: req.body.bgUrl || "https://i.imgur.com/4S7jFv1.png"
    };
    
    saveGuildConfig(guildId, config);
    res.redirect(`/dashboard/${guildId}/welcome?success=true`);
});

// --- 3. نظام مرسل رسائل Embed (Embed Sender Dashboard) ---
app.get('/dashboard/:guildId/embedsender', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    const guild = client.guilds.cache.get(guildId);

    const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    let channelsHtml = `<option value="">-- اختر روم الإرسال --</option>`;
    channels.forEach(ch => {
        channelsHtml += `<option value="${ch.id}" ${config.embedSender.targetChannelId === ch.id ? 'selected' : ''}>#${ch.name}</option>`;
    });

    const statusMsg = req.query.statusMsg ? `
        <div class="alert alert-info">
            الإجراء: ${decodeURIComponent(req.query.statusMsg)}
        </div>
    ` : '';

    const content = `
    <div class="container-fluid">
        <h2 class="fw-bold mb-4">📢 مرسل رسائل الـ Embed المنسقة بالكامل</h2>
        ${statusMsg}
        
        <form action="/dashboard/${guildId}/embedsender" method="POST">
            <div class="row">
                <div class="col-lg-7">
                    <div class="card glass-card text-white border-0 mb-4">
                        <div class="card-header bg-transparent border-0 fw-bold h5">بناء رسالة الـ Embed</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">روم الإرسال المستهدف</label>
                                <select class="form-select bg-dark text-white border-secondary" name="targetChannelId">
                                    ${channelsHtml}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">العنوان (Title)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="title" value="${config.embedSender.title || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">الوصف (Description)</label>
                                <textarea class="form-control bg-dark text-white border-secondary" name="description" rows="5">${config.embedSender.description || ''}</textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">اللون (Color)</label>
                                <input type="color" class="form-control form-control-color bg-dark border-secondary w-100" name="color" value="${config.embedSender.color || '#3b82f6'}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">رابط الصورة الكبيرة (Image URL)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="image" value="${config.embedSender.image || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">رابط مصغرة الصورة (Thumbnail URL)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="thumbnail" value="${config.embedSender.thumbnail || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">الكاتب (Author)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="author" value="${config.embedSender.author || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">تذييل الرسالة (Footer)</label>
                                <input type="text" class="form-control bg-dark text-white border-secondary" name="footer" value="${config.embedSender.footer || ''}">
                            </div>
                        </div>
                    </div>
                    
                    <div class="card glass-card text-white">
                        <div class="card-body">
                            <div class="d-flex gap-2 flex-wrap">
                                <button type="submit" name="action" value="send" class="btn btn-glow-success">إرسال كرسالة جديدة 📢</button>
                                <button type="submit" name="action" value="edit" class="btn btn-glow-primary" ${!config.embedSender.lastMessageId ? 'disabled' : ''}>تعديل آخر رسالة تم إرسالها ✏️</button>
                                <button type="submit" name="action" value="delete" class="btn btn-glow-danger" ${!config.embedSender.lastMessageId ? 'disabled' : ''}>حذف آخر رسالة تم إرسالها 🗑️</button>
                            </div>
                            ${config.embedSender.lastMessageId ? `<p class="text-success mt-3 small mb-0">تم رصد رسالة نشطة معرفها: ${config.embedSender.lastMessageId}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </div>
    `;
    res.send(renderDashboard(content, 'embedsender', req, guildId));
});

app.post('/dashboard/:guildId/embedsender', checkAuth, checkGuildAccess, async (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    const action = req.body.action;

    config.embedSender = {
        title: req.body.title,
        description: req.body.description,
        color: req.body.color || "#3b82f6",
        image: req.body.image,
        thumbnail: req.body.thumbnail,
        footer: req.body.footer,
        author: req.body.author,
        targetChannelId: req.body.targetChannelId,
        lastMessageId: config.embedSender.lastMessageId || ""
    };

    saveGuildConfig(guildId, config);

    let status = '';
    try {
        const channel = client.channels.cache.get(config.embedSender.targetChannelId);
        if (!channel) throw new Error("لم يتم العثور على القناة المحددة للإرسال.");

        const embed = new EmbedBuilder()
            .setColor(config.embedSender.color)
            .setTimestamp();

        if (config.embedSender.title) embed.setTitle(config.embedSender.title);
        if (config.embedSender.description) embed.setDescription(config.embedSender.description);
        if (config.embedSender.image) embed.setImage(config.embedSender.image);
        if (config.embedSender.thumbnail) embed.setThumbnail(config.embedSender.thumbnail);
        if (config.embedSender.author) embed.setAuthor({ name: config.embedSender.author });
        if (config.embedSender.footer) embed.setFooter({ text: config.embedSender.footer });

        if (action === 'send') {
            const msg = await channel.send({ embeds: [embed] });
            config.embedSender.lastMessageId = msg.id;
            saveGuildConfig(guildId, config);
            status = 'تم إرسال رسالة الـ Embed بنجاح!';
        } else if (action === 'edit') {
            const msg = await channel.messages.fetch(config.embedSender.lastMessageId);
            if (msg) {
                await msg.edit({ embeds: [embed] });
                status = 'تم تعديل رسالة الـ Embed بنجاح!';
            }
        } else if (action === 'delete') {
            const msg = await channel.messages.fetch(config.embedSender.lastMessageId);
            if (msg) {
                await msg.delete();
                config.embedSender.lastMessageId = "";
                saveGuildConfig(guildId, config);
                status = 'تم حذف رسالة الـ Embed بنجاح!';
            }
        }
    } catch (e) {
        status = 'فشلت العملية: ' + e.message;
    }

    res.redirect(`/dashboard/${guildId}/embedsender?statusMsg=${encodeURIComponent(status)}`);
});

// --- 4. نظام الرتب التلقائية (Auto Role Dashboard) ---
app.get('/dashboard/:guildId/autorole', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    const guild = client.guilds.cache.get(guildId);

    const roles = guild.roles.cache.filter(r => r.name !== '@everyone');
    let rolesHtml = `<option value="">-- اختر الرتبة التي يحصل عليها العضو --</option>`;
    roles.forEach(role => {
        rolesHtml += `<option value="${role.id}" ${config.autoRole.roleId === role.id ? 'selected' : ''}>@${role.name}</option>`;
    });

    const content = `
    <div class="container-fluid">
        <h2 class="fw-bold mb-4">👤 نظام إعطاء الرتب تلقائياً عند الدخول (Auto Role)</h2>
        ${req.query.success === 'true' ? `<div class="alert alert-success">تم حفظ إعدادات إعطاء الرتب التلقائي بنجاح!</div>` : ''}
        
        <form action="/dashboard/${guildId}/autorole" method="POST">
            <div class="row">
                <div class="col-lg-8">
                    <div class="card glass-card text-white border-0">
                        <div class="card-header bg-transparent border-0 fw-bold h5">تخصيص رتب الدخول التلقائية</div>
                        <div class="card-body">
                            <div class="mb-4 form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="enabled" ${config.autoRole.enabled ? 'checked' : ''}>
                                <label class="form-check-label fw-bold">تشغيل نظام Auto Role بالسيرفر</label>
                            </div>
                            
                            <div class="mb-4">
                                <label class="form-label">الرتبة الممنوحة تلقائياً عند الدخول</label>
                                <select class="form-select bg-dark text-white border-secondary" name="roleId">
                                    ${rolesHtml}
                                </select>
                            </div>
                            
                            <button type="submit" class="btn btn-glow-primary px-5">حفظ إعدادات الرتب 💾</button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </div>
    `;
    res.send(renderDashboard(content, 'autorole', req, guildId));
});

app.post('/dashboard/:guildId/autorole', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.params.guildId;
    const config = getGuildConfig(guildId);
    
    config.autoRole = {
        enabled: req.body.enabled === 'on',
        roleId: req.body.roleId
    };
    
    saveGuildConfig(guildId, config);
    res.redirect(`/dashboard/${guildId}/autorole?success=true`);
});

// ==================== دوال وتفاعلات ديسكورد للبوت ====================

// دقة ترحيب الأعضاء ودخولهم (Welcome Card & Auto Role Events)
client.on('guildMemberAdd', async member => {
    const guildId = member.guild.id;
    const config = getGuildConfig(guildId);

    // 1. تفعيل وتطبيق الـ Auto Role عند الدخول
    if (config.autoRole && config.autoRole.enabled && config.autoRole.roleId) {
        try {
            const role = member.guild.roles.cache.get(config.autoRole.roleId);
            if (role) {
                await member.roles.add(role);
            }
        } catch (e) {
            console.error("Auto Role Error: ", e.message);
        }
    }

    // 2. تفعيل وتطبيق نظام الترحيب المطور مع توليد البطاقة الرسومية التلقائية
    if (config.welcome && config.welcome.enabled && config.welcome.channelId) {
        const channel = member.guild.channels.cache.get(config.welcome.channelId);
        if (channel) {
            const memberCount = member.guild.memberCount;
            const welcomeText = (config.welcome.message || "مرحباً بك {user}").replace('{user}', `${member}`);

            // توليد بطاقة ترحيب احترافية بتنسيق SVG عالي الدقة وسريع للتشغيل السحابي
            const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
            const cleanName = member.user.username.replace(/[^a-zA-Z0-9\s]/g, '');

            const svgCard = `
            <svg width="800" height="350" viewBox="0 0 800 350" xmlns="http://www.w3.org/2000/svg">
                <!-- الخلفية والمؤثرات الزجاجية -->
                <rect width="800" height="350" rx="20" fill="#0d1117" />
                <rect x="10" y="10" width="780" height="330" rx="15" fill="none" stroke="#21262d" stroke-width="3" />
                
                <!-- خطوط التزيين والنيون -->
                <circle cx="400" cy="110" r="70" fill="none" stroke="#3b82f6" stroke-width="4" />
                
                <!-- صورة العضو الاسم والتفاصيل -->
                <clipPath id="avatar-clip">
                    <circle cx="400" cy="110" r="68" />
                </clipPath>
                <image href="${avatarUrl}" x="332" y="42" width="136" height="136" clip-path="url(#avatar-clip)" />
                
                <!-- نصوص الترحيب -->
                <text x="400" y="225" font-family="'Segoe UI', 'Cairo', sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">مرحباً بك في السيرفر</text>
                <text x="400" y="265" font-family="'Segoe UI', 'Cairo', sans-serif" font-size="24" font-weight="600" fill="#3b82f6" text-anchor="middle">${cleanName}</text>
                <text x="400" y="305" font-family="'Segoe UI', 'Cairo', sans-serif" font-size="18" fill="#8b5cf6" text-anchor="middle">أنت العضو رقم #${memberCount} في السيرفر</text>
            </svg>
            `;

            const buffer = Buffer.from(svgCard, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: 'welcome-card.svg' });

            channel.send({
                content: welcomeText,
                files: [attachment]
            }).catch(e => console.error("Error sending welcome message: ", e.message));
        }
    }
});

// استقبال الرسائل وتطبيق الرد التلقائي (Auto Reply Message Receiver)
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const guildId = message.guildId;
    if (!guildId) return;

    const config = getGuildConfig(guildId);
    
    // فحص وتطبيق الرد التلقائي المضاف عبر لوحة التحكم
    if (config.autoReplies && config.autoReplies.length > 0) {
        const text = message.content.toLowerCase().trim();
        const found = config.autoReplies.find(item => item.enabled && item.keyword.toLowerCase().trim() === text);
        
        if (found) {
            message.channel.send(found.reply).catch(e => console.error(e.message));
        }
    }
});

// تفاعل وتلقي انضمام البوت لسيرفر جديد (Auto Role Assign for Bot)
client.on('guildCreate', async guild => {
    // محاولة جلب الإعدادات المسبقة
    const config = getGuildConfig(guild.id);
    console.log(`Bot joined new guild: ${guild.name}`);
});

// تفاعلات أزرار ومودالات التذاكر
client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;
    const config = getGuildConfig(guildId);

    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith('open_ticket_')) {
            await interaction.deferReply({ ephemeral: true });
            const index = parseInt(customId.replace('open_ticket_', ''));
            const btnConfig = config.buttons[index];

            if (!btnConfig) {
                return interaction.editReply({ content: "خطأ: لم يتم العثور على إعدادات هذا الزر بالملفات." });
            }

            const maxLimit = Number(config.maxTicketsPerUser) || 4;
            
            const activeCount = interaction.guild.channels.cache.filter(c => {
                return c.name.startsWith('ticket-') && c.permissionOverwrites.cache.has(interaction.user.id);
            }).size;

            if (activeCount >= maxLimit) {
                return interaction.editReply({ content: `⚠️ عذراً، لقد تجاوزت الحد الأقصى للتذاكر المفتوحة المسموح به في هذا السيرفر وهو: **${maxLimit} تكت**.` });
            }

            const cleanName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
            const expectedName = (btnConfig.ticketName || 'ticket-{username}').replace('{username}', cleanName);

            const duplicate = interaction.guild.channels.cache.find(c => c.name === expectedName);
            if (duplicate) {
                return interaction.editReply({ content: `لديك تكت مفتوح وموجود بالفعل داخل هذا السيرفر: <#${duplicate.id}>` });
            }

            const parentId = btnConfig.categoryId || config.defaultCategoryId || null;
            const permissionOverwrites = [
                {
                    id: interaction.guild.id,
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
                const ticketChannel = await interaction.guild.channels.create({
                    name: expectedName,
                    type: ChannelType.GuildText,
                    parent: parentId,
                    permissionOverwrites: permissionOverwrites
                });

                logEvent('open', guildId, { user: interaction.user, channel: ticketChannel, buttonLabel: btnConfig.label });

                const welcome = (btnConfig.welcomeMessage || "مرحباً {user}").replace('{user}', `<@${interaction.user.id}>`);
                const roleMention = btnConfig.mentionRole ? `<@&${btnConfig.mentionRole}>` : '';

                const embed = new EmbedBuilder()
                    .setTitle(`مركز الخدمات والدعم - ${btnConfig.label}`)
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
                await interaction.editReply({ content: "فشل إنشاء التكت. يرجى مراجعة وتعديل صلاحيات البوت في السيرفر." });
            }
        }

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
            await interaction.reply({ content: 'جاري توليد الأرشيف HTML وإغلاق التكت خلال 5 ثوانٍ...' });
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
                return interaction.reply({ content: "عذراً، لا تملك الصلاحية الإدارية الكافية لاستلام هذا التكت.", ephemeral: true });
            }

            const claimed = channel.topic && channel.topic.startsWith("Claimed_by_");
            if (claimed) {
                const adminId = channel.topic.replace("Claimed_by_", "");
                return interaction.reply({ content: `⚠️ تم استلام هذا التكت بالفعل بواسطة الإداري المسؤول: <@${adminId}>`, ephemeral: true });
            }

            await channel.setTopic(`Claimed_by_${interaction.user.id}`);
            await channel.permissionOverwrites.edit(interaction.user.id, {
                SendMessages: true,
                ViewChannel: true,
                ReadMessageHistory: true
            });

            await interaction.reply({ content: `✅ تم استلام هذا التكت بواسطة الإداري: ${interaction.user}` });
            logEvent('claim', guildId, { user: interaction.user, channel: channel });
        }

        if (customId === 'ticket_rename') {
            const modal = new ModalBuilder().setCustomId('modal_rename').setTitle('إعادة تسمية التكت');
            const nameInp = new TextInputBuilder()
                .setCustomId('new_name')
                .setLabel('الاسم الجديد للروم')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: support-resolved')
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
            await interaction.reply({ content: 'جاري إنشاء الأرشيف الفوري والنسخ الاحتياطي...' });
            const html = await generateTranscript(interaction.channel);
            const buffer = Buffer.from(html, 'utf-8');
            await interaction.followUp({
                content: 'تفضل، إليك أرشيف التكت الفوري الحالي الموثق بالكامل:',
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

                await interaction.reply({ content: `تمت إضافة العضو ${targetMember} بنجاح للتكت وتنشيط صلاحيات المتابعة.` });
                logEvent('add_member', guildId, { user: interaction.user, channel: interaction.channel, details: targetMember.user });
            } catch (err) {
                await interaction.reply({ content: 'عذراً، تعذر العثور على العضو داخل السيرفر بالمعرف الرقمي المدخل.', ephemeral: true });
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
                await interaction.reply({ content: 'عذراً، تعذر العثور على العضو داخل السيرفر بالمعرف الرقمي المدخل.', ephemeral: true });
            }
        }
    }
});

// دالة توليد أرشيف التكت
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

// تشغيل البوت والربط المباشر مع قاعدة البيانات السحابية
client.once('ready', () => {
    console.log(`Bot logged in as: ${client.user.tag} (Pro SaaS Mode enabled)`);
    restoreDatabaseCloud();
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Failed to login to Discord: ", err.message);
});

app.listen(PORT, () => {
    console.log(`Professional SaaS Web Dashboard running on port ${PORT}`);
});