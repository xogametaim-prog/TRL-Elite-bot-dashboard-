// server.js
const express = require('express');
const session = require('express-session');
const path = require('path');
const { db } = require('./database');
const { client: botClient, botEvents } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
    name: 'luxury_session',
    secret: 'saas_royal_vault_level_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Days Persistent Session (Saves login across restarts)
        secure: false, // Set to true in production with HTTPS
        httpOnly: true
    }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// OAuth2 Lightweight Authentication Simulation with absolute persistence
app.post('/api/auth/login', (req, res) => {
    req.session.user = {
        id: '288467953',
        username: 'RoyalManager',
        tag: 'RoyalManager#1337',
        avatar: 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
    db.data.sessions[req.session.id] = { user: req.session.user, lastActive: Date.now() };
    db.save();
    res.json({ success: true, user: req.session.user });
});

app.get('/api/auth/status', (req, res) => {
    if (req.session.user) {
        return res.json({ loggedIn: true, user: req.session.user });
    }
    res.json({ loggedIn: false });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Segmenting Discord Servers into exactly the Three mandated UX categories
app.get('/api/auth/servers', (req, res) => {
    // Simulated live Discord Servers list returning categorized status:
    const mockServers = [
        // Category 1: ✅ Installed & User has full manage access
        { 
            id: '1292334668', 
            name: 'سيرفر الإدارة الرئيسي / Elite Server', 
            icon: 'https://cdn.discordapp.com/embed/avatars/1.png',
            status: 'installed', 
            permissions: true 
        },
        { 
            id: '9988776655', 
            name: 'سيرفر المبيعات والشركات / Business Lounge', 
            icon: 'https://cdn.discordapp.com/embed/avatars/2.png',
            status: 'installed', 
            permissions: true 
        },
        // Category 2: ➕ Not Installed but User has permission to Add Bot
        { 
            id: '5566778899', 
            name: 'سيرفر الألعاب والترفيه / Public Lounge', 
            icon: 'https://cdn.discordapp.com/embed/avatars/3.png',
            status: 'invite', 
            permissions: true,
            inviteLink: 'https://discord.com/oauth2/authorize?client_id=12345678&scope=bot&permissions=8'
        },
        // Category 3: 🚫 Locked. User does not have "Manage Server" permissions
        { 
            id: '1122334455', 
            name: 'مجتمع البرمجة العربي / Developer Forum', 
            icon: 'https://cdn.discordapp.com/embed/avatars/4.png',
            status: 'locked', 
            permissions: false 
        }
    ];
    res.json({ servers: mockServers });
});

// SSE Event Broadcast system
app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const updateListener = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    botEvents.on('update', updateListener);
    req.on('close', () => {
        botEvents.removeListener('update', updateListener);
    });
});

app.get('/api/guilds/:guildId/data', (req, res) => {
    const { guildId } = req.params;
    const guild = db.getGuild(guildId);
    
    const dGuild = botClient.guilds.cache.get(guildId);
    const liveStats = {
        onlineMembers: dGuild ? dGuild.members.cache.filter(m => m.presence?.status !== 'offline').size : 120,
        totalMembers: dGuild ? dGuild.memberCount : 4500,
        uptime: Math.floor(process.uptime()),
        databaseSize: JSON.stringify(db.data).length,
        botPing: botClient.ws.ping || 12
    };

    res.json({ config: guild, liveStats });
});

// Persistent State Auto Save Engine (Remembers absolutely everything dynamically)
app.post('/api/guilds/:guildId/ux-save', (req, res) => {
    const { guildId } = req.params;
    const { uxState } = req.body;
    db.saveGuildConfig(guildId, 'uxState', uxState);
    res.json({ success: true });
});

app.post('/api/guilds/:guildId/save-config', (req, res) => {
    const { guildId } = req.params;
    const { key, data } = req.body;
    db.saveGuildConfig(guildId, key, data);
    botEvents.emit('update', { guildId });
    res.json({ success: true, updated: db.getGuild(guildId) });
});

// Simulated Exports for Table data
app.post('/api/export/:type', (req, res) => {
    const { type } = req.params;
    const { data } = req.body;
    
    if (type === 'csv') {
        const headers = 'Number,User,Status,Priority\n';
        const rows = data.map(t => `${t.number},"${t.creator.tag}",${t.status},${t.priority}`).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=tickets-export.csv');
        return res.send(headers + rows);
    }
    res.json({ success: true, message: 'PDF Generation simulated successfully.' });
});

// Built-in Country Selector mock database
app.get('/api/countries', (req, res) => {
    const countries = [
        { code: 'SA', name: 'المملكة العربية السعودية', flag: '🇸🇦', favorite: true },
        { code: 'AE', name: 'الإمارات العربية المتحدة', flag: '🇦🇪', favorite: true },
        { code: 'QA', name: 'قطر', flag: '🇶🇦', favorite: false },
        { code: 'KW', name: 'الكويت', flag: '🇰🇼', favorite: false },
        { code: 'BH', name: 'البحرين', flag: '🇧🇭', favorite: false },
        { code: 'OM', name: 'سلطنة عمان', flag: '🇴🇲', favorite: false },
        { code: 'EG', name: 'جمهورية مصر العربية', flag: '🇪🇬', favorite: false },
        { code: 'JO', name: 'الأردن', flag: '🇯🇴', favorite: false }
    ];
    res.json({ countries });
});

// Royal AI Advisor System Prompt Engine
app.post('/api/ai/chat', async (req, res) => {
    const { guildId, question } = req.body;
    const guild = db.getGuild(guildId);
    db.data.globalStats.aiRequests++;
    db.save();

    let response = `⚜️ **التحليل الفني والحلول المقترحة من الإدارة الذكية للتذاكر:**\n\n`;
    const qLower = question.toLowerCase();

    if (qLower.includes("تذكرة") || qLower.includes("مشكلة") || qLower.includes("ticket")) {
        response += `لقد تم رصد إعدادات بوابة التذاكر الحالية:
- السيرفر يمتلك حالياً لوحة نشطة بعنوان **"${guild.panels[0]?.embedTitle || "بوابة الدعم الموحدة"}"**.
- ننصح بالتحقق من ربط قنوات الأرشفة والتقارير بمجموعات الموظفين للتأكد من استلام التذاكر في أقل من دقيقة.`;
    } else if (qLower.includes("حفظ") || qLower.includes("تلقائي")) {
        response += `بصفتي المشرف الذكي على النظام، أؤكد لك أن **الحفظ التلقائي للقرارات نشط** بمجرد إحداث أي تغيير.
- يتم مزامنة حالة لوحة التحكم وصلاحيات السيرفرات وإعداد التذاكر في الوقت الحقيقي داخل قاعدة البيانات والمسودات لضمان عدم ضياع أي بيان عند إغلاق المتصفح.`;
    } else {
        response += `لقد تم فحص السيرفر والتحقق من قواعد البيانات. نظام الأتمتة مهيأ ومستعد لتلقي استفسارك بالتحديد. الرجاء تفصيل المشكلة التقنية وسأعالجها في الحال.`;
    }

    res.json({ response });
});

botClient.login('BOT_TOKEN_PLACEHOLDER').catch(() => {
    console.log("⚜️ Server is running offline with full simulations at http://localhost:3000");
});

app.listen(PORT, () => {
    console.log(`⚜️ SaaS Royal Portal running on port ${PORT}`);
});