// database.js
const fs = require('fs');
const path = require('path');

class DatabaseEngine {
    constructor() {
        this.dbPath = path.join(__dirname, 'data.json');
        this.backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
        this.data = { guilds: {}, sessions: {}, globalStats: { processedMessages: 0, aiRequests: 0 } };
        this.load();
    }

    load() {
        if (fs.existsSync(this.dbPath)) {
            try {
                this.data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
            } catch (err) {
                console.error("Failed to read DB, restoring backup...", err);
                this.backup('system_recovery');
            }
        } else {
            this.save();
        }
    }

    save() {
        try {
            const tempPath = this.dbPath + '.tmp';
            fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 4), 'utf8');
            fs.renameSync(tempPath, this.dbPath);
        } catch (err) {
            console.error("Critical error saving DB:", err);
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
                // Full UX UI State Memory object
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

    backup(guildId, label = 'system') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `backup_${guildId}_${label}_${timestamp}.json`;
        const backupPath = path.join(this.backupDir, backupFileName);
        
        const guildData = this.getGuild(guildId);
        fs.writeFileSync(backupPath, JSON.stringify(guildData, null, 4), 'utf8');
        
        if (!guildData.backups) guildData.backups = [];
        guildData.backups.unshift({
            id: 'backup_' + Date.now(),
            fileName: backupFileName,
            label,
            timestamp: Date.now()
        });
        this.save();
        return backupFileName;
    }
}

const db = new DatabaseEngine();
module.exports = { db };