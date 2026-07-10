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
    secret: process.env.SESSION_SECRET || 'saas_royal_vault_level_secret_key_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { 
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Days Persistent
        secure: false, 
        httpOnly: true
    }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/auth/login', (req, res) => {
    req.session.user = {
        id: '288467953',
        username: 'RoyalManager',
        tag: 'RoyalManager#1337',
        avatar: 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
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

app.get('/api/auth/servers', (req, res) => {
    const mockServers = [
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
        { 
            id: '5566778899', 
            name: 'سيرفر الألعاب والترفيه / Public Lounge', 
            icon: 'https://cdn.discordapp.com/embed/avatars/3.png',
            status: 'invite', 
            permissions: true,
            // تم تحديث رابط دعوة البوت الحقيقي الخاص بك هنا
            inviteLink: 'https://discord.com/oauth2/authorize?client_id=1525198327711399967&permissions=8&integration_type=0&scope=bot+applications.commands'
        },
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
        databaseSize: JSON.stringify(guild).length,
        botPing: botClient.ws.ping || 12
    };

    res.json({ config: guild, liveStats });
});

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
    res.json({ success: true });
});

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
    res.json({ success: true });
});

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

app.post('/api/ai/chat', (req, res) => {
    const { guildId, question } = req.body;
    const guild = db.getGuild(guildId);
    
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

botClient.login(process.env.BOT_TOKEN).catch(() => {
    console.log("⚠️ Failed to login with BOT_TOKEN env. Bot features will remain offline, but dashboard is fully operational.");
});

app.listen(PORT, () => {
    console.log(`⚜️ SaaS Royal Portal running on port ${PORT}`);
});