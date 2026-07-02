/**
 * 🎫 PRO TICKET BOT V1 & SaaS GLASSMORPHISM DASHBOARD
 * الميزات:
 * 1. واجهة مستخدم زجاجية (SaaS Glassmorphism UI) بتأثيرات توهج وانتقالات فائقة النعومة مع شاشة تحميل احترافية.
 * 2. إزالة المعرفات (IDs) يدوياً بشكل نهائي؛ يتم جلب الغرف والرتب والتصنيفات ديناميكياً عبر Discord API.
 * 3. نظام تذاكر ديناميكي غير محدود الفئات (إضافة/حذف/تعديل تذاكر الدعم، الشكاوى، الشراء، وغيرها).
 * 4. نظام حد التذاكر المفتوحة الذكي (Max Tickets Per User) مع قيمة افتراضية قدرها 4 تذاكر.
 * 5. نظام استلام التكت (Claim & Unclaim System) الحصري للإداريين مع قفل التفاعل وربط اللوق.
 * 6. نظام نقاط الخبرة (XP System) يمنح نقاط خبرة عند إرسال الرسائل مع صفحة لترتيب الأعضاء (Ranking Leaderboard).
 * 7. نظام عملات خاص بالبوت (Coins / Stars / Tokens) مع إمكانية تعديل قيم التحويل وتغيير مسماها ديناميكياً.
 * 8. نظام حماية واشتراكات Premium تلقائي مدمج بالكامل؛ يتم تفعيله عند التحويل إلى حساب صاحب البوت داخل سيرفر الدعم الفني المحدد.
 * 9. تخزين سحابي مجاني ومدمج بالكامل لضمان عدم ضياع البيانات حتى عند نوم أو إعادة تشغيل خادم Render المجاني.
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
    TextInputStyle 
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
    guilds: {},      // إعدادات التذاكر والأزرار لكل سيرفر
    users: {},       // نظام الـ XP، والعملات، والاشتراكات Premium للمستخدمين عالمياً
    premiumKeys: [], // سجل تفعيلات الـ Premium
    premiumSettings: {
        botName: "ticket bot.v1",
        botAvatar: "",
        paymentMethod: "ProBot Transfer",
        priceTier1: 20000000,
        priceTier2: 30000000
    }
};

function loadDatabase() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            if (data.trim() !== "") {
                const parsed = JSON.parse(data);
                database = { ...database, ...parsed };
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

// دمج نظام النسخ الاحتياطي السحابي التلقائي لتجاوز مشكلة Ephemeral Filesystem في Render
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
        req.on('error', (e) => { console.error("Cloud backup connection issue: ", e.message); });
        req.write(dataStr);
        req.end();
        console.log("☁️ [Database Cloud Sync] Database backup uploaded safely!");
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
                        const parsed = JSON.parse(data);
                        if (Object.keys(parsed).length > 0) {
                            database = parsed;
                            saveDatabase();
                            console.log("☁️ [Database Cloud Sync] Restored active configuration successfully!");
                        }
                    }
                } catch (e) {
                    console.log("Starting with fresh/local configuration file.");
                }
            });
        }).on('error', (e) => {
            console.error("Cloud Database Restore Failed: ", e.message);
        });
    } catch (err) {
        console.error("Cloud Database Restore Trigger Failed: ", err);
    }
}

// جلب إعدادات سيرفر محدد أو تطبيق القوالب الافتراضية
function getGuildConfig(guildId) {
    if (!database.guilds[guildId]) {
        database.guilds[guildId] = {
            logsChannelId: "",
            embedChannelId: "",
            defaultCategoryId: "",
            maxTicketsPerUser: 4, // القيمة الافتراضية كما في Ticket Bot V2
            currencyName: "Coins", // اسم العملة الافتراضية
            creditsToCoinRatio: 1000, // النسبة الافتراضية 1000 Credits = 1 Coin
            xpPerMessage: 15, // كمية الـ XP الافتراضية لكل رسالة
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
                },
                {
                    id: "support_report",
                    label: "الشكاوى والبلاغات",
                    emoji: "⚠️",
                    style: "DANGER",
                    ticketName: "report-{username}",
                    mentionRole: "",
                    categoryId: "",
                    welcomeMessage: "أهلاً بك {user} في قسم الشكاوى والبلاغات. يرجى توفير الدلائل الكافية ليتم النظر بطلبك سريعاً."
                }
            ],
            activeEmbedMessageId: ""
        };
        saveDatabase();
    }
    return database.guilds[guildId];
}

// جلب بيانات مستخدم محدد أو تهيئة حسابه ديناميكياً
function getUserData(userId) {
    if (!database.users[userId]) {
        database.users[userId] = {
            xp: 0,
            level: 1,
            coins: 0,
            premiumTier: 0, // 0 = مجاني, 1 = بريميوم أول, 2 = بريميوم ثاني
            premiumExpiry: null,
            username: "عضو"
        };
        saveDatabase();
    }
    return database.users[userId];
}

// تهيئة البوت
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// تهيئة Express لـ Render
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
    res.redirect('/login');
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
                    <a href="https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&integration_type=0&scope=bot+applications.commands" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 12px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);" target="_blank">دعوة البوت الآن 🚀</a>
                </div>
            `);
        }
        return next();
    }
    return res.status(403).send("عذراً، لا تمتلك الصلاحيات الكافية (Administrator أو Manage Server) لإدارة هذا السيرفر.");
}

// تصميم لوحة التحكم المتقدمة SaaS Glassmorphism UI
function renderDashboard(content, activeTab, req, currentGuildId = null) {
    const user = req.user;
    const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const config = currentGuildId ? getGuildConfig(currentGuildId) : {};
    const botName = database.premiumSettings.botName || "ticket bot.v1";
    
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
            /* شاشة التحميل الاحترافية مثل ProBot */
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
            /* Glassmorphism SaaS Cards */
            .glass-card {
                background: var(--bg-glass);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
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
        <!-- شاشة التحميل الاحترافية -->
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
                <a href="/dashboard/ranking" class="nav-link ${activeTab === 'ranking' ? 'active' : ''}">
                    <i class="bi bi-trophy"></i> جدول ترتيب الخبرة (XP)
                </a>
                <a href="/dashboard/premium" class="nav-link ${activeTab === 'premium' ? 'active' : ''}">
                    <i class="bi bi-star"></i> صفحة باقات Premium
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
            // إخفاء شاشة التحميل بمجرد انتهاء التحميل
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

// صفحة اختيار السيرفر
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

// الصفحة الرئيسية لإحصائيات السيرفر
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
            <p class="text-muted">الحد الأقصى للتكتات للمستخدم الواحد حالياً: **${config.maxTicketsPerUser}**</p>
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
                                <div class="text-xs text-info text-uppercase mb-1 fw-bold">التكتات المفتوحة</div>
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
                                <div class="text-xs text-success text-uppercase mb-1 fw-bold">الأعضاء بالسيرفر</div>
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

    // جلب الرومات والتصنيفات والرتب ديناميكياً لبنائها كـ Dropdowns
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

                    <!-- نظام نقاط الخبرة XP ونظام العملات -->
                    <div class="card glass-card text-white mb-4">
                        <div class="card-header bg-transparent border-0 fw-bold h5">إعدادات الاقتصاد ونظام الـ XP</div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">كمية الـ XP الممنوحة لكل رسالة</label>
                                    <input type="number" class="form-control bg-dark text-white border-secondary" name="xpPerMessage" value="${config.xpPerMessage || 15}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">اسم عملة السيرفر الخاصة بالبوت</label>
                                    <input type="text" class="form-control bg-dark text-white border-secondary" name="currencyName" value="${config.currencyName || 'Coins'}">
                                </div>
                                <div class="col-12 mb-3">
                                    <label class="form-label">قيمة التحويل من Credits التابع لـ Probot إلى العملة الخاصة</label>
                                    <div class="input-group">
                                        <input type="number" class="form-control bg-dark text-white border-secondary" name="creditsToCoinRatio" value="${config.creditsToCoinRatio || 1000}">
                                        <span class="input-group-text bg-secondary text-white">Credits = 1 Coin</span>
                                    </div>
                                </div>
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
    config.xpPerMessage = Number(req.body.xpPerMessage) || 15;
    config.currencyName = req.body.currencyName || 'Coins';
    config.creditsToCoinRatio = Number(req.body.creditsToCoinRatio) || 1000;
    
    saveGuildConfig(guildId, config);
    res.redirect(`/dashboard/${guildId}/settings?success=true`);
});

// صفحة تعديل وتصميم رسالة التكت والتحكم بالأزرار غير المحدودة (إضافة وتعديل وحذف الفئات)
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
        ${req.query.success === 'true' ? `<div class="alert alert-success">تم حفظ الإعدادات وإرسال التحديثات لـ ديسكورد بنجاح!</div>` : ''}

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
            // كود مبسط لإضافة فئة جديدة للزر تلقائياً وحفظها من الواجهة الرسومية بالداشبورد
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

// استقبال وحفظ بيانات التذاكر والتحكم بالأزرار
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

    // فلترة وبناء قائمة الأزرار غير المحدودة من المدخلات الرسومية بالداشبورد
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

// صفحة ترتيب نقاط الخبرة XP Leaderboard
app.get('/dashboard/ranking', checkAuth, (req, res) => {
    // تصفية وترتيب حسابات الأعضاء حسب نقاط الـ XP التراكمية بشكل تنازلي
    const sortedUsers = Object.entries(database.users)
        .map(([id, u]) => ({ id, ...u }))
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 15);

    let rankingRows = '';
    sortedUsers.forEach((u, index) => {
        rankingRows += `
        <tr>
            <td class="fw-bold text-info fs-5">#${index + 1}</td>
            <td>
                <span class="fw-bold">${u.username}</span>
                ${u.premiumExpiry ? '<span class="badge bg-warning text-dark ms-2">Premium ⭐</span>' : ''}
            </td>
            <td><span class="badge bg-secondary">Level ${u.level}</span></td>
            <td class="text-success fw-bold">${u.xp} XP</td>
            <td class="text-warning fw-bold">${u.coins} Coins</td>
        </tr>
        `;
    });

    const content = `
    <div class="container-fluid">
        <h2 class="fw-bold mb-4">🏆 جدول ترتيب نقاط الخبرة والعملات (XP & Coins Leaderboard)</h2>
        <div class="card glass-card text-white border-0">
            <div class="card-body">
                <table class="table table-dark table-hover table-borderless m-0 bg-transparent text-white align-middle">
                    <thead>
                        <tr class="border-bottom border-secondary text-muted">
                            <th>الترتيب</th>
                            <th>العضو</th>
                            <th>المستوى (Level)</th>
                            <th>نقاط الخبرة (XP)</th>
                            <th>الرصيد بالعملة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rankingRows || '<tr><td colspan="5" class="text-center text-muted py-5">لا توجد سجلات خبرة نشطة حالياً.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
    res.send(renderDashboard(content, 'ranking', req));
});

// صفحة الـ Premium والباقات وتعديل بيانات البوت
app.get('/dashboard/premium', checkAuth, (req, res) => {
    const isOwner = req.user.id === "1459567453251309639" || req.user.id === "1457923390143856642"; // حساب المطور/المالك لتعديل الأسعار والباقات
    const pSettings = database.premiumSettings;

    const content = `
    <div class="container-fluid">
        <h2 class="fw-bold mb-1">⭐ بوابة اشتراكات Premium الاحترافية</h2>
        <p class="text-muted mb-4">احصل على أعلى ميزات الحماية والتخصيص الفاخرة بشكل تلقائي.</p>

        <div class="row">
            <!-- باقة Premium الأولى -->
            <div class="col-md-6 mb-4">
                <div class="card glass-card text-white h-100 border-start border-primary border-4 p-3">
                    <div class="card-body d-flex flex-column justify-content-between">
                        <div>
                            <h3 class="fw-bold text-primary">باقة Premium الأولى ⭐</h3>
                            <h4 class="my-3 text-info fw-bold">${pSettings.priceTier1.toLocaleString()} Credits</h4>
                            <hr class="border-secondary">
                            <ul class="text-muted lh-lg">
                                <li>إخفاء حقوق البوت No Branding بالكامل.</li>
                                <li>سرعة تشغيل وأولوية بالمعالجة فائقة السرعة.</li>
                                <li>دعم فني مخصص على مدار الساعة.</li>
                            </ul>
                        </div>
                        <a href="https://discord.gg/TvFaRGadkc" class="btn btn-glow-primary w-100 mt-4" target="_blank">شراء وتفعيل الاشتراك تلقائياً 🚀</a>
                    </div>
                </div>
            </div>

            <!-- باقة Premium الثانية -->
            <div class="col-md-6 mb-4">
                <div class="card glass-card text-white h-100 border-start border-warning border-4 p-3">
                    <div class="card-body d-flex flex-column justify-content-between">
                        <div>
                            <h3 class="fw-bold text-warning">باقة Premium الثانية ⭐⭐</h3>
                            <h4 class="my-3 text-info fw-bold">${pSettings.priceTier2.toLocaleString()} Credits</h4>
                            <hr class="border-secondary">
                            <ul class="text-muted lh-lg">
                                <li>جميع ميزات الباقة الأولى بشكل دائم.</li>
                                <li>إمكانية إنشاء عدد غير محدود من أنواع وأقسام التكتات.</li>
                                <li>تخصيص كامل لاسم البوت وصورته الخاصة من لوحة التحكم.</li>
                                <li>استباقية الحصول على كافة التحديثات والميزات المستقبلية.</li>
                            </ul>
                        </div>
                        <a href="https://discord.gg/TvFaRGadkc" class="btn btn-glow-success w-100 mt-4" target="_blank">شراء وتفعيل الاشتراك تلقائياً 🚀</a>
                    </div>
                </div>
            </div>
        </div>

        ${isOwner ? `
        <!-- لوحة تحكم الإدارة لمالك البوت فقط لتغيير الأسعار والباقات ديناميكياً -->
        <div class="row mt-4">
            <div class="col-12">
                <div class="card glass-card text-white">
                    <div class="card-header bg-transparent border-0 fw-bold h5">🛠️ إعدادات التحكم بالباقات (للمطورين والمالك فقط)</div>
                    <div class="card-body">
                        <form action="/dashboard/premium/admin-save" method="POST">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">اسم البوت (Premium)</label>
                                    <input type="text" class="form-control bg-dark text-white border-secondary" name="botName" value="${pSettings.botName}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">سعر الباقة الأولى (Credits)</label>
                                    <input type="number" class="form-control bg-dark text-white border-secondary" name="priceTier1" value="${pSettings.priceTier1}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">سعر الباقة الثانية (Credits)</label>
                                    <input type="number" class="form-control bg-dark text-white border-secondary" name="priceTier2" value="${pSettings.priceTier2}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">وسيلة التحويل المعتمدة</label>
                                    <input type="text" class="form-control bg-dark text-white border-secondary" name="paymentMethod" value="${pSettings.paymentMethod}">
                                </div>
                            </div>
                            <button type="submit" class="btn btn-glow-primary mt-3">حفظ إعدادات الباقات السحابية</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}
    </div>
    `;
    res.send(renderDashboard(content, 'premium', req));
});

// معالجة حفظ إعدادات باقات بريميوم لمالك البوت
app.post('/dashboard/premium/admin-save', checkAuth, (req, res) => {
    const isOwner = req.user.id === "1459567453251309639" || req.user.id === "1457923390143856642";
    if (!isOwner) return res.status(403).send("غير مصرح لك بالدخول.");

    database.premiumSettings.botName = req.body.botName;
    database.premiumSettings.priceTier1 = Number(req.body.priceTier1) || 20000000;
    database.premiumSettings.priceTier2 = Number(req.body.priceTier2) || 30000000;
    database.premiumSettings.paymentMethod = req.body.paymentMethod;

    saveDatabase();
    syncDatabaseCloud();
    res.redirect('/dashboard/premium');
});

// ==================== دوال التحكم والاتصال مع ديسكورد ====================

async function sendTicketEmbed(guildId) {
    const config = getGuildConfig(guildId);
    const channel = client.channels.cache.get(config.embedChannelId);
    if (!channel) throw new Error("قناة الإرسال غير متوفرة أو لم يتم تحديدها بالإعدادات العامة.");

    const embedData = config.embed;
    const embed = new EmbedBuilder()
        .setTitle(embedData.title || "لوحة التكت")
        .setDescription(embedData.description || "انقر بالأسفل للتواصل")
        .setColor(embedData.color || "#3b82f6");

    if (embedData.author) embed.setAuthor({ name: embedData.author });
    if (embedData.footer) embed.setFooter({ text: embedData.footer });
    if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
    if (embedData.image) embed.setImage(embedData.image);
    embed.setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();

    config.buttons.forEach((btn, idx) => {
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
    saveGuildConfig(guildId, config);
}

async function editTicketEmbed(guildId) {
    const config = getGuildConfig(guildId);
    const channel = client.channels.cache.get(config.embedChannelId);
    if (!channel) throw new Error("لم يتم العثور على القناة المحددة للرسالة.");
    const msg = await channel.messages.fetch(config.activeEmbedMessageId);
    if (!msg) throw new Error("لم يتم العثور على الرسالة لتحديثها بالديسكورد.");

    const embedData = config.embed;
    const embed = new EmbedBuilder()
        .setTitle(embedData.title || "تكت جديد")
        .setDescription(embedData.description || "انقر بالأسفل للتواصل")
        .setColor(embedData.color || "#3b82f6");

    if (embedData.author) embed.setAuthor({ name: embedData.author });
    if (embedData.footer) embed.setFooter({ text: embedData.footer });
    if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
    if (embedData.image) embed.setImage(embedData.image);
    embed.setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();

    config.buttons.forEach((btn, idx) => {
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
        } catch (e) {
            console.error("Embed delete error: ", e.message);
        }
    }
    config.activeEmbedMessageId = "";
    saveGuildConfig(guildId, config);
}

function saveGuildConfig(guildId, config) {
    database.guilds[guildId] = config;
    saveDatabase();
    syncDatabaseCloud();
}

// ==================== نظام التفاعل والتحقق من اشتراكات Premium تلقائياً ====================

client.on('messageCreate', async message => {
    if (message.author.bot) {
        // التحقق ومراقبة عمليات التحويل الصادرة من بوت ProBot داخل سيرفر الدعم الفني فقط
        if (message.guildId === "1517507260023308400") {
            const content = message.content;
            
            // قراءة رسائل التحويل لـ Probot لدفع العملات والتفعيل التلقائي الفوري للاشتراك
            // مثال: ta_im1, قام بتحويل "$1" لـ <@!1457923390143856642> | :moneybag:
            if (content.includes("قام بتحويل") && (content.includes("1459567453251309639") || content.includes("1457923390143856642"))) {
                // استخراج السعر والمستلم والدافع
                const regExp = /قام بتحويل\s*"\s*\$?([\d,]+)\s*"\s*لـ\s*<@!?(\d+)>/;
                const matches = content.match(regExp);
                
                if (matches) {
                    const price = parseInt(matches[1].replace(/,/g, ''));
                    const targetId = matches[2]; // حساب صاحب البوت المستلم الصحيح
                    
                    // البحث عن العضو المحول من خلال المنشن الأول بالرسالة
                    const payerMember = message.mentions.members.first();
                    if (payerMember && (targetId === "1459567453251309639" || targetId === "1457923390143856642")) {
                        const userId = payerMember.id;
                        const userData = getUserData(userId);
                        
                        let tierGranted = 0;
                        if (price >= database.premiumSettings.priceTier2) {
                            tierGranted = 2; // Premium الثاني
                        } else if (price >= database.premiumSettings.priceTier1) {
                            tierGranted = 1; // Premium الأول
                        }

                        if (tierGranted > 0) {
                            userData.premiumTier = tierGranted;
                            const expiry = new Date();
                            expiry.setMonth(expiry.getMonth() + 1); // التفعيل لمدة شهر واحد تلقائياً
                            userData.premiumExpiry = expiry.getTime();
                            userData.username = payerMember.user.username;
                            
                            saveDatabase();
                            syncDatabaseCloud();

                            // إرسال رسالة شكر وتفعيل الترقية تلقائياً
                            message.channel.send(`🎉 **تهانينا يا ${payerMember}!** تم التحقق من التحويل المالي للمبلغ \`${price.toLocaleString()}\` Credits بنجاح.\n⭐ **تم تفعيل باقة Premium لـ ${tierGranted === 2 ? 'المستوى الثاني' : 'المستوى الأول'} تلقائياً** وربط الاشتراك بحسابك بنجاح!`);
                        }
                    }
                }
            }
        }
        return;
    }

    // --- نظام نقاط الخبرة XP التراكمي في السيرفر ---
    const guildId = message.guildId;
    if (guildId) {
        const config = getGuildConfig(guildId);
        const userData = getUserData(message.author.id);
        userData.username = message.author.username;
        
        const xpGained = config.xpPerMessage || 15;
        userData.xp += xpGained;
        
        // ترقية مستوى العضو ديناميكياً عند تجاوزه حدود نقاط الـ XP
        const nextLevelThreshold = userData.level * userData.level * 350;
        if (userData.xp >= nextLevelThreshold) {
            userData.level += 1;
            // إضافة عملات تشجيعية مجاناً عند صعود المستوى
            userData.coins += 5;
            message.channel.send(`🎉 **مبارك صعود مستواك يا ${message.author}!** لقد وصلت الآن للمستوى **${userData.level}** وحصلت على عملات تشجيعية مجاناً!`).catch(() => {});
        }
        saveDatabase();
    }
});

// تفاعلات أزرار التذاكر ومودالات التحكم
client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;
    const config = getGuildConfig(guildId);

    if (interaction.isButton()) {
        const customId = interaction.customId;

        // تفاعل فتح تكت جديد
        if (customId.startsWith('open_ticket_')) {
            await interaction.deferReply({ ephemeral: true });
            const index = parseInt(customId.replace('open_ticket_', ''));
            const btnConfig = config.buttons[index];

            if (!btnConfig) {
                return interaction.editReply({ content: "خطأ: لم يتم العثور على إعدادات الزر بالسيرفر." });
            }

            const maxLimit = Number(config.maxTicketsPerUser) || 4;
            
            // التحقق من حد التذاكر المفتوحة بالتزامن للمستخدم الفردي
            const activeCount = interaction.guild.channels.cache.filter(c => {
                return c.name.startsWith('ticket-') && c.permissionOverwrites.cache.has(interaction.user.id);
            }).size;

            if (activeCount >= maxLimit) {
                return interaction.editReply({ content: `⚠️ عذراً، لقد تجاوزت الحد الأقصى للتذاكر المفتوحة المسموح به في هذا السيرفر وهو: **${maxLimit} تكت**.` });
            }

            // إنشاء تكت ترحيبي بمودال أو زر
            const cleanName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
            const expectedName = (btnConfig.ticketName || 'ticket-{username}').replace('{username}', cleanName);

            // التحقق من التكرار
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

        // نظام الـ Claim (استلام وإقفال التكت)
        if (customId === 'ticket_claim') {
            const channel = interaction.channel;
            const member = interaction.member;

            if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: "عذراً، لا تملك الصلاحية الإدارية الكافية لاستلام هذا التكت.", ephemeral: true });
            }

            // منع الـ Claim المزدوج
            const claimed = channel.topic && channel.topic.startsWith("Claimed_by_");
            if (claimed) {
                const adminId = channel.topic.replace("Claimed_by_", "");
                return interaction.reply({ content: `⚠️ تم استلام هذا التكت بالفعل بواسطة الإداري المسؤول: <@${adminId}>`, ephemeral: true });
            }

            // تحديث الصلاحيات وقفل التكت للمستلم
            await channel.setTopic(`Claimed_by_${interaction.user.id}`);
            await channel.permissionOverwrites.edit(interaction.user.id, {
                SendMessages: true,
                ViewChannel: true,
                ReadMessageHistory: true
            });

            await interaction.reply({ content: `✅ تم استلام هذا التكت بواسطة الإداري: ${interaction.user}` });
            logEvent('claim', guildId, { user: interaction.user, channel: channel });
        }

        // تغيير اسم الروم
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

        // إضافة عضو للتكت
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

        // إزالة عضو من التكت
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

        // أرشيف فوري محلياً داخل التكت
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

// دالة تسجيل اللوق والأحداث
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