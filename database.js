// database.js
const fs = require('fs');
const path = require('path');

class DatabaseEngine {
    constructor() {
        this.dbPath = path.join(__dirname, 'data.json');
        this.data = { guilds: {}, sessions: {}, globalStats: { processedMessages: 0, aiRequests: 0 } };
        this.load();
    }

    load() {
        if (fs.existsSync(this.dbPath)) {
            try {
                this.data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
            } catch (err) {
                console.error("Error reading database, resetting...", err);
            }
        } else {
            this.save();
        }
    }

    save() {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 4), 'utf8');
        } catch (err) {
            console.error("Critical error saving database:", err);
        }
    }

    getGuild(guildId) {
        if (!this.data.guilds[guildId]) {
            this.data.guilds[guildId] = {
                id: guildId,
                settings: {
                    theme: 'dark-gold',
                    language: 'ar',
                    ticketNaming: 'ticket-{username}',
                    autoCloseHours: 24,
                    autoDeleteHours: 12,
                    maxAttachmentSize: 8388608,
                    selectedCountry: { code: 'SA', name: 'المملكة العربية السعودية', flag: '🇸🇦' }
                },
                panels: [
                    {
                        id: 'royal_support',
                        name: 'الخدمات الخاصة وبوابة الدعم / Premium Gateway',
                        embedTitle: 'بوابة الدعم والمبيعات الفاخرة',
                        embedDescription: 'مرحباً بك في الفرع الرقمي المخصص. الرجاء النقر لفتح تذكرة وسيتم تسيير طلبك مباشرة.',
                        panelColor: '#D4AF37',
                        category: 'premium',
                        formId: 'default_form'
                    }
                ],
                categories: [
                    { id: 'premium', name: 'دعم النخبة / Royal Support', color: '#D4AF37', emoji: '⚜️' },
                    { id: 'standard', name: 'الاستفسارات العادية / Standard Support', color: '#171A21', emoji: '✉️' }
                ],
                forms: [
                    {
                        id: 'default_form',
                        name: 'استمارة تذكرة الخدمة',
                        questions: [
                            { label: 'وصف الخدمة المطلوبة', placeholder: 'مثال: تطوير بوت برمجياً', required: true, longText: true }
                        ]
                    }
                ],
                tickets: {},
                logs: [],
                backups: [],
                uxState: {
                    sidebarCollapsed: false,
                    lastPage: 'overview',
                    tableFilters: { search: '', status: 'all', sortColumn: 'number', sortOrder: 'asc' },
                    draftEmbed: null,
                    draftForm: null,
                    openTabs: {}
                }
            };
            this.save();
        }
        return this.data.guilds[guildId];
    }

    saveGuildConfig(guildId, key, value) {
        const guild = this.getGuild(guildId);
        guild[key] = value;
        this.save();
        return guild;
    }

    saveDraft(guildId, userId, page, draftData) {
        const guild = this.getGuild(guildId);
        if (!guild.uiDrafts) guild.uiDrafts = {};
        guild.uiDrafts[userId] = {
            lastPage: page,
            data: draftData,
            timestamp: Date.now()
        };
        this.save();
    }

    getDraft(guildId, userId) {
        const guild = this.getGuild(guildId);
        return guild.uiDrafts ? guild.uiDrafts[userId] : null;
    }

    logAction(guildId, action, details) {
        const guild = this.getGuild(guildId);
        const logEntry = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: Date.now(),
            action,
            ...details
        };
        guild.logs.unshift(logEntry);
        if (guild.logs.length > 500) guild.logs.pop();
        this.save();
        return logEntry;
    }
}

const db = new DatabaseEngine();
module.exports = { db };