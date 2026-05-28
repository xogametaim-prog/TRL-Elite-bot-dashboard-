import aiosqlite
from config import عملات_البداية, رصيد_البداية

مسار_قاعدة_البيانات = "game_data.db"

async def تهيئة_قاعدة_البيانات():
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            coins INTEGER DEFAULT ?,
            credits INTEGER DEFAULT ?,
            last_daily INTEGER DEFAULT 0,
            last_hourly INTEGER DEFAULT 0,
            active_team INTEGER DEFAULT 0
        )''', (عملات_البداية, رصيد_البداية))
        
        await db.execute('''CREATE TABLE IF NOT EXISTS teams (
            user_id TEXT,
            slot INTEGER,
            name TEXT DEFAULT '',
            PRIMARY KEY (user_id, slot)
        )''')
        
        await db.execute('''CREATE TABLE IF NOT EXISTS inventory (
            user_id TEXT,
            item_id INTEGER,
            quantity INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, item_id)
        )''')
        
        await db.execute('''CREATE TABLE IF NOT EXISTS shop (
            item_id INTEGER PRIMARY KEY,
            name TEXT,
            coin_price INTEGER,
            credit_price INTEGER,
            description TEXT
        )''')
        
        cursor = await db.execute("SELECT COUNT(*) FROM shop")
        count = (await cursor.fetchone())[0]
        if count == 0:
            العناصر = [
                (1, "🍎 تفاحة سحرية", 100, 5, "تستعيد 20 نقطة صحة"),
                (2, "🗡️ سيف حديدي", 250, 10, "يزيد الهجوم بمقدار 10"),
                (3, "🛡️ درع فولاذي", 200, 8, "يزيد الدفاع بمقدار 8"),
                (4, "💎 ياقوتة", 500, 20, "حجر كريم ثمين"),
                (5, "🧪 جرعة شفاء", 80, 3, "تشفي 50 نقطة صحة"),
                (6, "📜 درع قديم", 300, 12, "يعلم مهارة جديدة"),
                (7, "🐉 ناب تنين", 1000, 40, "يصنع أسلحة أسطورية"),
                (8, "👑 تاج الملوك", 2000, 80, "يمنح سلطة ملكية"),
                (9, "⚡ حذاء البرق", 400, 15, "يزيد السرعة"),
                (10, "🔮 كرة بلورية", 350, 14, "تكشف الأسرار الخفية"),
                (11, "🧥 عباءة الظلال", 450, 18, "تجعلك غير مرئي ليلاً"),
                (12, "🏹 قوس إلف", 600, 25, "هجوم بعيد المدى"),
                (13, "🍄 عيش غراب ذهبي", 150, 6, "تأثير عشوائي"),
                (14, "🧙 قبعة الساحر", 700, 28, "تعزز القوة السحرية"),
                (15, "⛏️ فأس قزم", 500, 20, "ينجم خامات نادرة"),
                (16, "🐺 رفيق ذئب", 1200, 50, "يقاتل معك"),
                (17, "🕯️ شمعة الحقيقة", 180, 7, "تكشف الأكاذيب"),
                (18, "🧩 مفتاح غامض", 250, 10, "يفتح الأبواب السرية"),
                (19, "💀 كتاب الموتى", 1500, 60, "يستحضر الموتى"),
                (20, "🧪 إكسير الحياة", 3000, 120, "يطيل العمر"),
                (21, "🎣 صنارة صيد", 200, 8, "تصطاد سمكاً نادراً"),
                (22, "🏔️ درع الجليد", 800, 32, "يقاوم ضرر البرد"),
                (23, "🔥 عصا النار", 900, 36, "يطلق كرات نارية"),
                (24, "🌀 تميمة الريح", 550, 22, "يتحكم بالرياح"),
                (25, "🌟 شظية نجم", 400, 16, "يحقق الأمنيات")
            ]
            await db.executemany("INSERT INTO shop (item_id, name, coin_price, credit_price, description) VALUES (?,?,?,?,?)", العناصر)
        await db.commit()

async def احصل_على_مستخدم(user_id):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as db:
        cursor = await db.execute("SELECT coins, credits, last_daily, last_hourly, active_team FROM users WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        if row is None:
            await db.execute("INSERT INTO users (user_id, coins, credits, last_daily, last_hourly, active_team) VALUES (?, ?, ?, ?, ?, ?)",
                              (user_id, عملات_البداية, رصيد_البداية, 0, 0, 0))
            await db.execute("INSERT OR IGNORE INTO teams (user_id, slot, name) VALUES (?, 0, ''), (?, 1, '')", (user_id, user_id))
            await db.commit()
            return {"coins": عملات_البداية, "credits": رصيد_البداية, "last_daily": 0, "last_hourly": 0, "active_team": 0}
        else:
            return {"coins": row[0], "credits": row[1], "last_daily": row[2], "last_hourly": row[3], "active_team": row[4]}

async def تحديث_مستخدم(user_id, coins=None, credits=None, last_daily=None, last_hourly=None, active_team=None):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as db:
        if coins is not None:
            await db.execute("UPDATE users SET coins = ? WHERE user_id = ?", (coins, user_id))
        if credits is not None:
            await db.execute("UPDATE users SET credits = ? WHERE user_id = ?", (credits, user_id))
        if last_daily is not None:
            await db.execute("UPDATE users SET last_daily = ? WHERE user_id = ?", (last_daily, user_id))
        if last_hourly is not None:
            await db.execute("UPDATE users SET last_hourly = ? WHERE user_id = ?", (last_hourly, user_id))
        if active_team is not None:
            await db.execute("UPDATE users SET active_team = ? WHERE user_id = ?", (active_team, user_id))
        await db.commit()

async def احصل_على_فريق(user_id, slot):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as db:
        cursor = await db.execute("SELECT name FROM teams WHERE user_id = ? AND slot = ?", (user_id, slot))
        row = await cursor.fetchone()
        return row[0] if row else ""

async def تعيين_فريق(user_id, slot, name):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as db:
        await db.execute("INSERT OR REPLACE INTO teams (user_id, slot, name) VALUES (?, ?, ?)", (user_id, slot, name))
        await db.commit()

async def احصل_على_كل_المستخدمين_للترتيب():
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as db:
        cursor = await db.execute("SELECT user_id, coins FROM users")
        return await cursor.fetchall()

async def أضف_إلى_المخزون(user_id, item_id, quantity):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as db:
        await db.execute("INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + ?",
                          (user_id, item_id, quantity, quantity))
        await db.commit()

async def احصل_على_المخزون(user_id):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as db:
        cursor = await db.execute("SELECT item_id, quantity FROM inventory WHERE user_id = ?", (user_id,))
        return await cursor.fetchall()

async def احصل_على_سلعة_من_المتجر(item_id):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as db:
        cursor = await db.execute("SELECT item_id, name, coin_price, credit_price, description FROM shop WHERE item_id = ?", (item_id,))
        row = await cursor.fetchone()
        if row:
            return {"id": row[0], "name": row[1], "coinPrice": row[2], "creditPrice": row[3], "desc": row[4]}
        return None

async def احصل_على_كل_سلع_المتجر():
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as db:
        cursor = await db.execute("SELECT item_id, name, coin_price, credit_price, description FROM shop ORDER BY item_id")
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "coinPrice": r[2], "creditPrice": r[3], "desc": r[4]} for r in rows]