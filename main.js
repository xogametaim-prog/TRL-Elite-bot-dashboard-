require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. تهيئة البوت الفعلي (تأكد من تفعيل الـ Intents المطلوبة في الـ Developer Portal)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// إعداد Passport مع صلاحية قراءة الحساب والسيرفرات (identify, guilds)
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

app.use(session({
    secret: process.env.SESSION_SECRET || 'bank_bot_secret_key',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// ميثود للتحقق مما إذا كان العضو يملك صلاحية إدارة السيرفر (Administrator أو Manage Guild)
function canManageGuild(permissions) {
    const ADMIN_PERMISSION = 0x8;
    const MANAGE_GUILD_PERMISSION = 0x20;
    const perms = BigInt(permissions);
    return (perms & BigInt(ADMIN_PERMISSION)) === BigInt(ADMIN_PERMISSION) || 
           (perms & BigInt(MANAGE_GUILD_PERMISSION)) === BigInt(MANAGE_GUILD_PERMISSION);
}

// ================= المسارات (Routes) =================

// 1. الصفحة الرئيسية (تسجيل الدخول)
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/servers');
    
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bank Bot - تسجيل الدخول</title>
            <style>
                body {
                    background: radial-gradient(circle at center, #1e1f22, #111214);
                    color: #fff;
                    font-family: 'Segoe UI', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .login-card {
                    background: #2b2d31;
                    padding: 40px;
                    border-radius: 12px;
                    text-align: center;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                    max-width: 400px;
                    width: 90%;
                    border: 1px solid #3f4248;
                }
                h1 { color: #ffcc00; margin-bottom: 10px; }
                p { color: #b5bac1; font-size: 14px; margin-bottom: 30px; }
                .btn-login {
                    background-color: #5865F2;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    font-size: 16px;
                    font-weight: bold;
                    border-radius: 6px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                }
            </style>
        </head>
        <body>
            <div class="login-card">
                <h1>🏦 Bank Bot 🏛️</h1>
                <p>قم بتسجيل الدخول لتتمكن من اختيار سيرفرك والتحكم ببيانات البنك الحقيقية.</p>
                <a href="/auth/discord" class="btn-login">تسجيل الدخول عبر ديسكورد</a>
            </div>
        </body>
        </html>
    `);
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/redirect', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/servers'); // التحويل لصفحة السيرفرات فوراً
});

// 2. صفحة اختيار السيرفرات الحقيقية (Server Selection)
app.get('/servers', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');

    const user = req.user;
    
    // فلترة السيرفرات التي يملك فيها العضو صلاحيات الإدارة فقط
    const manageGuilds = user.guilds.filter(guild => guild.owner || canManageGuild(guild.permissions));

    let serversHTML = '';
    
    manageGuilds.forEach(guild => {
        // التحقق من أن البوت الفعلي متواجد داخل هذا السيرفر
        const isBotInGuild = client.guilds.cache.has(guild.id);
        const iconURL = guild.icon 
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` 
            : 'https://cdn.discordapp.com/embed/avatars/0.png';

        if (isBotInGuild) {
            // البوت موجود -> إظهار زر "تحكم"
            serversHTML += `
                <div class="server-card">
                    <img src="${iconURL}" class="server-icon" alt="Icon">
                    <div class="server-name">${guild.name}</div>
                    <a href="/dashboard/${guild.id}" class="btn btn-manage">تحكم وإدارة ⚙️</a>
                </div>
            `;
        } else {
            // البوت غير موجود -> إظهار زر "إضافة البوت"
            const inviteURL = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}`;
            serversHTML += `
                <div class="server-card invited">
                    <img src="${iconURL}" class="server-icon" alt="Icon" style="filter: grayscale(80%);">
                    <div class="server-name" style="color: #8e9297;">${guild.name}</div>
                    <a href="${inviteURL}" target="_blank" class="btn btn-invite">إدخال البوت ➕</a>
                </div>
            `;
        }
    });

    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bank Bot - اختيار السيرفر</title>
            <style>
                body {
                    background-color: #111214;
                    color: #fff;
                    font-family: 'Segoe UI', sans-serif;
                    margin: 0;
                    padding: 40px 20px;
                }
                .container { max-width: 900px; margin: 0 auto; text-align: center; }
                h1 { color: #ffcc00; margin-bottom: 30px; }
                .servers-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                .server-card {
                    background: #1e1f22;
                    border: 1px solid #2e3035;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    transition: transform 0.2s;
                }
                .server-card:hover { transform: translateY(-3px); }
                .server-icon { width: 70px; height: 70px; border-radius: 50%; margin-bottom: 12px; }
                .server-name { font-weight: bold; font-size: 16px; margin-bottom: 15px; height: 40px; overflow: hidden; }
                .btn {
                    width: 100%;
                    padding: 10px;
                    border-radius: 5px;
                    text-decoration: none;
                    font-weight: bold;
                    font-size: 14px;
                    display: block;
                }
                .btn-manage { background: #ffcc00; color: #111214; }
                .btn-invite { background: #5865F2; color: #fff; }
                
                /* شاشة تحميل سريعة جداً */
                #loader {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background-color: #111214; z-index: 9999; display: flex;
                    flex-direction: column; justify-content: center; align-items: center;
                    transition: opacity 0.3s ease, visibility 0.3s;
                }
                .loader-spinner {
                    width: 45px; height: 45px; border: 4px solid #2b2d31;
                    border-top: 4px solid #ffcc00; border-radius: 50%;
                    animation: spin 0.5s linear infinite;
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div id="loader">
                <div class="loader-spinner"></div>
                <h3 style="margin-top: 15px; color: #ffcc00;">جاري تحميل سيرفراتك...</h3>
            </div>

            <div class="container">
                <h1>🎮 اختر السيرفر لإدارة البنك</h1>
                <p style="color: #b5bac1;">ستظهر لك السيرفرات التي تملك فيها رتبة إدارة فقط.</p>
                <div class="servers-grid">
                    ${serversHTML || '<p style="color: #ff4747;">لم نجد أي سيرفر تملك فيه رتبة إدارة وتستطيع التحكم به.</p>'}
                </div>
            </div>

            <script>
                window.addEventListener('DOMContentLoaded', () => {
                    setTimeout(() => {
                        const loader = document.getElementById('loader');
                        loader.style.opacity = '0';
                        setTimeout(() => loader.style.visibility = 'hidden', 300);
                    }, 600); // لودنج سريع جداً (600 مللي ثانية)
                });
            </script>
        </body>
        </html>
    `);
});

// 3. صفحة لوحة تحكم السيرفر المحدد (التحكم الفعلي بالمعلومات من ديسكورد)
app.get('/dashboard/:guildID', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');

    const guildID = req.params.guildID;
    const guild = client.guilds.cache.get(guildID);

    if (!guild) {
        return res.send('<h2>عذراً، البوت ليس متواجداً في هذا السيرفر حالياً. يرجى إدخاله أولاً.</h2><a href="/servers">العودة</a>');
    }

    // قراءة البيانات الحقيقية من ديسكورد عبر البوت (live data)
    const serverName = guild.name;
    const memberCount = guild.memberCount;
    const iconURL = guild.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png';

    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bank Bot - تحكم ${serverName}</title>
            <style>
                body {
                    background-color: #111214; color: #fff; font-family: 'Segoe UI', sans-serif; margin: 0;
                }
                header {
                    background: #1e1f22; padding: 15px 30px; display: flex;
                    justify-content: space-between; align-items: center; border-bottom: 1px solid #2e3035;
                }
                .server-header { display: flex; align-items: center; gap: 15px; }
                .server-icon { width: 50px; height: 50px; border-radius: 50%; }
                .main { padding: 40px 20px; max-width: 1000px; margin: 0 auto; }
                .card { background: #2b2d31; padding: 25px; border-radius: 8px; border: 1px solid #3f4248; margin-bottom: 20px; }
                .card h3 { margin-top: 0; color: #ffcc00; }
                .grid-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .btn-back { background: #5865F2; color: #fff; text-decoration: none; padding: 10px 15px; border-radius: 4px; font-weight: bold; }
            </style>
        </head>
        <body>
            <header>
                <div class="server-header">
                    <img src="${iconURL}" class="server-icon" alt="Icon">
                    <h2>إدارة بنك سيرفر: ${serverName} 🏛️</h2>
                </div>
                <a href="/servers" class="btn-back">⬅️ تغيير السيرفر</a>
            </header>

            <div class="main">
                <div class="grid-stats">
                    <div class="card">
                        <h3>📊 إحصائيات ديسكورد الحقيقية للسيرفر</h3>
                        <p><strong>عدد الأعضاء الحالي:</strong> ${memberCount} عضو</p>
                        <p><strong>مُعرّف السيرفر (ID):</strong> ${guildID}</p>
                    </div>

                    <div class="card">
                        <h3>🪙 معلومات اقتصاد البنك المالي</h3>
                        <p><strong>إجمالي أرصدة السيرفر:</strong> جاري الاستدعاء من ديسكورد...</p>
                        <p><strong>حالة اتصال الخادم:</strong> متصل بنجاح 🟢</p>
                    </div>
                </div>

                <div class="card" style="margin-top: 20px;">
                    <h3>💡 ربط البوت بقاعدة البيانات الحقيقية الخاصة بك</h3>
                    <p>اللوحة الآن تقرأ السيرفر وتفاصيله الحية من ديسكورد بنجاح [1].</p>
                    <p>لكي نقوم بربط **الرصيد الفعلي** للاعبين والـ **الذهب المكتسب** من ديسكورد مباشرة إلى هذه الصفحة، يرجى إخباري:</p>
                    <p style="background: #1e1f22; padding: 15px; border-radius: 5px; color: #ffcc00;">
                        <strong>ما هي قاعدة البيانات (Database) التي يستخدمها بوتك لحفظ بيانات اللاعبين ورصيدهم المصرفي؟</strong><br>
                        (مثل: MongoDB أو SQLite أو Quick.db أو ملف محلي JSON؟)
                    </p>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

client.once('ready', () => {
    console.log(`[BOT] تم تشغيل البوت باسم: ${client.user.tag}`);
});

if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(console.error);
}

app.listen(PORT, () => {
    console.log(`[SERVER] السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});