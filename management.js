// ==================== management.js ====================
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'bots_database.db');
let db;

function initDB() {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS all_bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_name TEXT NOT NULL,
      bot_category TEXT NOT NULL,
      description_ar TEXT,
      description_en TEXT,
      invite_link TEXT,
      keywords TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_keywords ON all_bots(keywords)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_category ON all_bots(bot_category)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_name ON all_bots(bot_name)`);
  
  console.log('✅ Database initialized');
}

function initGiveawayTable() {
  if (!db) initDB();
  db.exec(`
    CREATE TABLE IF NOT EXISTS giveaways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      prize TEXT,
      language TEXT DEFAULT 'ar',
      emoji TEXT DEFAULT '🎉',
      end_time INTEGER,
      winners_count INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1
    )
  `);
  console.log('✅ Giveaway table ready');
}

function importBotsFromJSON(filepath = 'bots_data.json') {
  if (!db) initDB();
  if (!fs.existsSync(filepath)) {
    console.warn(`⚠️ File ${filepath} not found, skipping import`);
    return;
  }
  
  const count = db.prepare('SELECT COUNT(*) as count FROM all_bots').get().count;
  if (count > 0) {
    console.log(`📊 Database already has ${count} bots`);
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  const bots = Array.isArray(data) ? data : (data.bots || []);
  
  const insert = db.prepare(`
    INSERT INTO all_bots (bot_name, bot_category, description_ar, description_en, invite_link, keywords)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((bots) => {
    for (const bot of bots) {
      insert.run(
        bot.name || '',
        bot.category || '',
        bot.desc_ar || '',
        bot.desc_en || '',
        bot.link || '',
        bot.keywords || ''
      );
    }
  });
  
  transaction(bots);
  console.log(`✅ Imported ${bots.length} bots`);
}

function searchBots(query, limit = 10) {
  if (!db) initDB();
  const likeQuery = `%${query}%`;
  return db.prepare(`
    SELECT bot_name, bot_category, description_ar, description_en, invite_link
    FROM all_bots
    WHERE bot_name LIKE ? OR keywords LIKE ? OR bot_category LIKE ? OR description_ar LIKE ? OR description_en LIKE ?
    LIMIT ?
  `).all(likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, limit);
}

function saveGiveaway(guildId, channelId, messageId, prize, language, emoji, endTime, winners) {
  if (!db) initDB();
  db.prepare(`
    INSERT INTO giveaways (guild_id, channel_id, message_id, prize, language, emoji, end_time, winners_count, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(guildId, channelId, messageId, prize, language, emoji, endTime, winners);
}

function getActiveGiveaways() {
  if (!db) initDB();
  return db.prepare('SELECT * FROM giveaways WHERE is_active = 1').all();
}

function deactivateGiveaway(guildId, messageId) {
  if (!db) initDB();
  db.prepare('UPDATE giveaways SET is_active = 0 WHERE guild_id = ? AND message_id = ?').run(guildId, messageId);
}

module.exports = { initDB, searchBots, importBotsFromJSON, initGiveawayTable, saveGiveaway, getActiveGiveaways, deactivateGiveaway };