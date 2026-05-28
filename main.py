import discord
from discord.ext import commands
from discord import app_commands
import aiosqlite
import asyncio
import random
import time
import os
import sys
import traceback
import threading
from flask import Flask
from datetime import datetime

# ========== Flask لـ Render ==========
تطبيق_فلاسك = Flask(__name__)

@تطبيق_فلاسك.route('/')
def الصفحة_الرئيسية():
    return "البوت شغال!"

def تشغيل_الخادم():
    تطبيق_فلاسك.run(host='0.0.0.0', port=8080)

# ========== التوكن والإعدادات ==========
التوكن = os.getenv("DISCORD_TOKEN")
if التوكن is None:
    print("❌ التوكن غير موجود")
    sys.exit(1)

# رتبة الأونر
رتبة_الأونر = 1507815463172833331
قناة_التسجيل = None

# إعدادات اللعبة
عملات_البداية = 1000
رصيد_البداية = 0
صحة_الفريق_البدائية = 200
مكافأة_يومية_عملات = 500
مكافأة_يومية_رصيد = 10
مكافأة_ساعية_عملات = 100
الحد_الأدنى_للعمل = 50
الحد_الأقصى_للعمل = 200
مدة_السرقة = 600
نسبة_السرقة = 0.2
مدة_التخفي = 1800
الحد_الأقصى_لاسم_الفريق = 20
ثواني_اليوم = 86400
ثواني_الساعة = 3600
ضرر_اللكمة_الأساسي = 10

أضرار_الأسلحة = {2: 25, 7: 50, 9: 20, 12: 35, 16: 45, 23: 40}
رابط_السيرفر = "https://discord.gg/gzFVT4zXKU"
اسم_المطور = "Gangster Bot"
مسار_قاعدة_البيانات = "game_data.db"

# ========== دوال قاعدة البيانات ==========
async def تهيئة_قاعدة_البيانات():
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        await قاعدة.execute('''CREATE TABLE IF NOT EXISTS المستخدمين (
            user_id TEXT PRIMARY KEY,
            عملات INTEGER DEFAULT 1000,
            رصيد INTEGER DEFAULT 0,
            اخر_يومي INTEGER DEFAULT 0,
            اخر_ساعي INTEGER DEFAULT 0,
            الفريق_النشط INTEGER DEFAULT 0,
            اخر_سرقة INTEGER DEFAULT 0
        )''')
        await قاعدة.execute('''CREATE TABLE IF NOT EXISTS الفرق (
            user_id TEXT,
            slot INTEGER,
            الاسم TEXT DEFAULT '',
            الصحة INTEGER DEFAULT 200,
            مخفي_حتى INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, slot)
        )''')
        await قاعدة.execute('''CREATE TABLE IF NOT EXISTS المخزون (
            user_id TEXT,
            item_id INTEGER,
            الكمية INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, item_id)
        )''')
        await قاعدة.execute('''CREATE TABLE IF NOT EXISTS المتجر (
            item_id INTEGER PRIMARY KEY,
            الاسم TEXT,
            سعر_عملات INTEGER,
            سعر_رصيد INTEGER,
            الوصف TEXT
        )''')
        await قاعدة.execute('''CREATE TABLE IF NOT EXISTS السوق_السوداء (
            item_id INTEGER PRIMARY KEY,
            الاسم TEXT,
            سعر_عملات INTEGER,
            سعر_رصيد INTEGER,
            الوصف TEXT,
            الصفحة INTEGER
        )''')
        await قاعدة.execute('''CREATE TABLE IF NOT EXISTS المهام (
            user_id TEXT PRIMARY KEY,
            مهمة1 TEXT, مهمة2 TEXT, مهمة3 TEXT,
            تقدم1 INTEGER, تقدم2 INTEGER, تقدم3 INTEGER,
            مكتمل1 INTEGER, مكتمل2 INTEGER, مكتمل3 INTEGER,
            اخر_تصفير INTEGER
        )''')
        
        # تعبئة المتجر العادي
        المؤشر = await قاعدة.execute("SELECT COUNT(*) FROM المتجر")
        if (await المؤشر.fetchone())[0] == 0:
            العناصر = [
                (1, "🍎 تفاحة سحرية", 100, 5, "تستعيد 20 صحة"),
                (2, "🗡️ سيف حديدي", 250, 10, "+25 ضرر"),
                (3, "🛡️ درع فولاذي", 200, 8, "+8 دفاع"),
                (4, "💎 ياقوتة", 500, 20, "حجر كريم"),
                (5, "🧪 جرعة شفاء", 80, 3, "تشفي 50 صحة"),
                (6, "📜 درع قديم", 300, 12, "مهارة جديدة"),
                (7, "🐉 ناب تنين", 1000, 40, "+50 ضرر"),
                (8, "👑 تاج الملوك", 2000, 80, "سلطة ملكية"),
                (9, "⚡ حذاء البرق", 400, 15, "+20 ضرر"),
                (10, "🔮 كرة بلورية", 350, 14, "تكشف الأسرار"),
                (11, "🧥 عباءة الظلال", 450, 18, "تخفي"),
                (12, "🏹 قوس إلف", 600, 25, "+35 ضرر"),
                (13, "🍄 عيش غراب ذهبي", 150, 6, "تأثير عشوائي"),
                (14, "🧙 قبعة الساحر", 700, 28, "+15 سحر"),
                (15, "⛏️ فأس قزم", 500, 20, "تعدين"),
                (16, "🐺 رفيق ذئب", 1200, 50, "+45 ضرر"),
                (17, "🕯️ شمعة الحقيقة", 180, 7, "تكشف الأكاذيب"),
                (18, "🧩 مفتاح غامض", 250, 10, "يفتح الأبواب"),
                (19, "💀 كتاب الموتى", 1500, 60, "يستحضر الموتى"),
                (20, "🧪 إكسير الحياة", 3000, 120, "يطيل العمر"),
                (21, "🎣 صنارة صيد", 200, 8, "تصطاد سمكاً"),
                (22, "🏔️ درع الجليد", 800, 32, "مقاومة البرد"),
                (23, "🔥 عصا النار", 900, 36, "+40 ضرر"),
                (24, "🌀 تميمة الريح", 550, 22, "يتحكم بالرياح"),
                (25, "🌟 شظية نجم", 400, 16, "يحقق الأمنيات"),
                (26, "📖 كتاب التخفي", 500, 20, "يخفي فريقك 30 دقيقة")
            ]
            await قاعدة.executemany("INSERT INTO المتجر VALUES (?,?,?,?,?)", العناصر)
        
        # تعبئة السوق السوداء (50 سلعة)
        المؤشر = await قاعدة.execute("SELECT COUNT(*) FROM السوق_السوداء")
        if (await المؤشر.fetchone())[0] == 0:
            عناصر_سوداء = []
            اسماء = [
                "🔫 AK-47", "💣 RPG", "🔪 سكين قتال", "🔫 مسدس كاتم", "💣 قنبلة يدوية",
                "🔫 رشاش", "💣 قنبلة دخان", "🔫 مسدس رشاش", "💣 قنبلة مسيلة", "🔪 خنجر مسموم",
                "🔫 بندقية قنص", "💣 عبوة ناسفة", "🔫 مسدس ذهبي", "💣 قنبلة عنقودية", "🔪 سيف ياباني",
                "🔫 كلاشنكوف", "💣 مولوتوف", "🔫 مسدس كهربائي", "💣 لغم أرضي", "🔪 رمح",
                "🔫 بازوكا", "💣 قنبلة نووية", "🔪 فأس", "🔫 رشاش ثقيل", "💣 قنبلة غاز",
                "🔫 مسدس سيلينيوم", "💣 ديناميت", "🔪 منجل", "🔫 رشاش خفيف", "💣 قنبلة فلاش",
                "🔫 مسدس فضة", "💣 قنبلة حرارية", "🔪 ساطور", "🔫 بندقية صيد", "💣 قنبلة كيميائية",
                "🔫 مسدس بلاتينيوم", "💣 قنبلة بلاستيكية", "🔪 خنجر فضة", "🔫 رشاش ذهبي", "💣 قنبلة مغناطيسية",
                "🔫 مسدس نحاس", "💣 قنبلة زمنية", "🔪 سيف فضة", "🔫 بندقية فضة", "💣 قنبلة صوت",
                "🔫 مسدس هيدروجين", "💣 قنبلة ضوئية", "🔪 رمح فضة", "🔫 رشاش نحاس", "💣 قنبلة متطورة"
            ]
            for i in range(1, 51):
                الصفحة = (i-1)//10 + 1
                السعر = i * 150
                الرصيد = i // 5
                عناصر_سوداء.append((i, اسماء[i-1], السعر, الرصيد, f"سلاح من الصفحة {الصفحة}", الصفحة))
            await قاعدة.executemany("INSERT INTO السوق_السوداء VALUES (?,?,?,?,?,?)", عناصر_سوداء)
        
        await قاعدة.commit()

async def احصل_على_مستخدم(المعرف):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute("SELECT عملات, رصيد, اخر_يومي, اخر_ساعي, الفريق_النشط, اخر_سرقة FROM المستخدمين WHERE user_id = ?", (المعرف,)) as مؤشر:
            الصف = await مؤشر.fetchone()
            if الصف is None:
                await قاعدة.execute("INSERT INTO المستخدمين (user_id, عملات, رصيد) VALUES (?, ?, ?)", (المعرف, عملات_البداية, رصيد_البداية))
                await قاعدة.execute("INSERT OR IGNORE INTO الفرق (user_id, slot, الصحة) VALUES (?, 0, ?), (?, 1, ?)", (المعرف, صحة_الفريق_البدائية, المعرف, صحة_الفريق_البدائية))
                await قاعدة.commit()
                return {"عملات": عملات_البداية, "رصيد": رصيد_البداية, "اخر_يومي": 0, "اخر_ساعي": 0, "الفريق_النشط": 0, "اخر_سرقة": 0}
            return {"عملات": الصف[0], "رصيد": الصف[1], "اخر_يومي": الصف[2], "اخر_ساعي": الصف[3], "الفريق_النشط": الصف[4], "اخر_سرقة": الصف[5] if len(الصف) > 5 else 0}

async def تحديث_مستخدم(المعرف, **kwargs):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        for مفتاح, قيمة in kwargs.items():
            await قاعدة.execute(f"UPDATE المستخدمين SET {مفتاح} = ? WHERE user_id = ?", (قيمة, المعرف))
        await قاعدة.commit()

async def احصل_على_فريق(المعرف, الرقم, مع_الصحة=False):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        if مع_الصحة:
            async with قاعدة.execute("SELECT الاسم, الصحة, مخفي_حتى FROM الفرق WHERE user_id = ? AND slot = ?", (المعرف, الرقم)) as مؤشر:
                الصف = await مؤشر.fetchone()
                return (الصف[0], الصف[1], الصف[2]) if الصف else ("", صحة_الفريق_البدائية, 0)
        else:
            async with قاعدة.execute("SELECT الاسم FROM الفرق WHERE user_id = ? AND slot = ?", (المعرف, الرقم)) as مؤشر:
                الصف = await مؤشر.fetchone()
                return الصف[0] if الصف else ""

async def تعيين_فريق(المعرف, الرقم, الاسم):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        await قاعدة.execute("INSERT OR REPLACE INTO الفرق (user_id, slot, الاسم, الصحة) VALUES (?, ?, ?, COALESCE((SELECT الصحة FROM الفرق WHERE user_id=? AND slot=?), ?))",
                            (المعرف, الرقم, الاسم, المعرف, الرقم, صحة_الفريق_البدائية))
        await قاعدة.commit()

async def تحديث_صحة_الفريق(المعرف, الرقم, صحة_جديدة):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        await قاعدة.execute("UPDATE الفرق SET الصحة = ? WHERE user_id = ? AND slot = ?", (صحة_جديدة, المعرف, الرقم))
        await قاعدة.commit()

async def تحديث_اختفاء_الفريق(المعرف, الرقم, حتى):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        await قاعدة.execute("UPDATE الفرق SET مخفي_حتى = ? WHERE user_id = ? AND slot = ?", (حتى, المعرف, الرقم))
        await قاعدة.commit()

async def احصل_على_كل_المستخدمين():
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute("SELECT user_id, عملات FROM المستخدمين") as مؤشر:
            return await مؤشر.fetchall()

async def أضف_إلى_المخزون(المعرف, رقم_السلعة, كمية):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        await قاعدة.execute("INSERT INTO المخزون (user_id, item_id, الكمية) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET الكمية = الكمية + ?",
                            (المعرف, رقم_السلعة, كمية, كمية))
        await قاعدة.commit()

async def احذف_من_المخزون(المعرف, رقم_السلعة, كمية):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        await قاعدة.execute("UPDATE المخزون SET الكمية = الكمية - ? WHERE user_id = ? AND item_id = ?", (كمية, المعرف, رقم_السلعة))
        await قاعدة.commit()

async def احصل_على_المخزون(المعرف):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute("SELECT item_id, الكمية FROM المخزون WHERE user_id = ?", (المعرف,)) as مؤشر:
            return await مؤشر.fetchall()

async def احصل_على_سلعة_من_المتجر(رقم_السلعة):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute("SELECT item_id, الاسم, سعر_عملات, سعر_رصيد, الوصف FROM المتجر WHERE item_id = ?", (رقم_السلعة,)) as مؤشر:
            الصف = await مؤشر.fetchone()
            return {"id": الصف[0], "name": الصف[1], "coinPrice": الصف[2], "creditPrice": الصف[3], "desc": الصف[4]} if الصف else None

async def احصل_على_كل_المتجر():
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute("SELECT item_id, الاسم, سعر_عملات, سعر_رصيد, الوصف FROM المتجر ORDER BY item_id") as مؤشر:
            الصفوف = await مؤشر.fetchall()
            return [{"id": ص[0], "name": ص[1], "coinPrice": ص[2], "creditPrice": ص[3], "desc": ص[4]} for ص in الصفوف]

async def احصل_على_سلع_السوق_السوداء(الصفحة):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute("SELECT item_id, الاسم, سعر_عملات, سعر_رصيد, الوصف FROM السوق_السوداء WHERE الصفحة = ? ORDER BY item_id", (الصفحة,)) as مؤشر:
            الصفوف = await مؤشر.fetchall()
            return [{"id": ص[0], "name": ص[1], "coinPrice": ص[2], "creditPrice": ص[3], "desc": ص[4]} for ص in الصفوف]

async def احصل_على_سلعة_من_السوق_السوداء(رقم_السلعة):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute("SELECT item_id, الاسم, سعر_عملات, سعر_رصيد, الوصف FROM السوق_السوداء WHERE item_id = ?", (رقم_السلعة,)) as مؤشر:
            الصف = await مؤشر.fetchone()
            return {"id": الصف[0], "name": الصف[1], "coinPrice": الصف[2], "creditPrice": الصف[3], "desc": الصف[4]} if الصف else None

async def احصل_على_أفضل_سلاح(المعرف):
    المخزون = await احصل_على_المخزون(المعرف)
    افضل = ضرر_اللكمة_الأساسي
    for رقم_السلعة, كمية in المخزون:
        if كمية > 0 and رقم_السلعة in أضرار_الأسلحة:
            افضل = max(افضل, أضرار_الأسلحة[رقم_السلعة])
    return افضل

async def يمتلك_سلعة(المعرف, رقم_السلعة):
    المخزون = await احصل_على_المخزون(المعرف)
    for رقم, كمية in المخزون:
        if رقم == رقم_السلعة and كمية > 0:
            return True
    return False

async def ارسال_تسجيل(البوت, العنوان, الوصف, اللون=0xFF4500):
    if قناة_التسجيل:
        القناة = البوت.get_channel(قناة_التسجيل)
        if القناة:
            تضمين = discord.Embed(title=العنوان, description=الوصف, color=اللون, timestamp=datetime.now())
            await القناة.send(embed=تضمين)

# ========== إعداد البوت ==========
الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True

البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

# ========== كلاس مخصص للسوق السوداء ==========
class السوق_السوداء_View(discord.ui.View):
    def __init__(self, الصفحة_الحالية: int = 1):
        super().__init__(timeout=120)
        self.الصفحة_الحالية = الصفحة_الحالية
        self.تحديث_الأزرار()
    
    def تحديث_الأزرار(self):
        self.clear_items()
        زر_السابق = discord.ui.Button(label="◀ السابقة", style=discord.ButtonStyle.secondary)
        زر_التالي = discord.ui.Button(label="التالي ▶", style=discord.ButtonStyle.secondary)
        زر_السابق.callback = self.السابق_callback
        زر_التالي.callback = self.التالي_callback
        self.add_item(زر_السابق)
        self.add_item(زر_التالي)
    
    async def السابق_callback(self, التفاعل: discord.Interaction):
        if self.الصفحة_الحالية > 1:
            self.الصفحة_الحالية -= 1
            العناصر = await احصل_على_سلع_السوق_السوداء(self.الصفحة_الحالية)
            تضمين = discord.Embed(title=f"🔫 السوق السوداء - الصفحة {self.الصفحة_الحالية}/5", color=0xFF0000)
            for عنصر in العناصر:
                تضمين.add_field(name=f"{عنصر['id']}. {عنصر['name']}", value=f"🪙 {عنصر['coinPrice']} | 💎 {عنصر['creditPrice']}", inline=True)
            await التفاعل.response.edit_message(embed=تضمين, view=self)
        else:
            await التفاعل.response.send_message("أنت في الصفحة الأولى", ephemeral=True)
    
    async def التالي_callback(self, التفاعل: discord.Interaction):
        if self.الصفحة_الحالية < 5:
            self.الصفحة_الحالية += 1
            العناصر = await احصل_على_سلع_السوق_السوداء(self.الصفحة_الحالية)
            تضمين = discord.Embed(title=f"🔫 السوق السوداء - الصفحة {self.الصفحة_الحالية}/5", color=0xFF0000)
            for عنصر in العناصر:
                تضمين.add_field(name=f"{عنصر['id']}. {عنصر['name']}", value=f"🪙 {عنصر['coinPrice']} | 💎 {عنصر['creditPrice']}", inline=True)
            await التفاعل.response.edit_message(embed=تضمين, view=self)
        else:
            await التفاعل.response.send_message("أنت في الصفحة الخامسة", ephemeral=True)