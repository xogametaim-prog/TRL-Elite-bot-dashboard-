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

تطبيق_فلاسك = Flask(__name__)

@تطبيق_فلاسك.route('/')
def الصفحة_الرئيسية():
    return "البوت شغال!"

def تشغيل_الخادم():
    تطبيق_فلاسك.run(host='0.0.0.0', port=8080)

التوكن = os.getenv("DISCORD_TOKEN")
if التوكن is None:
    print("❌ التوكن غير موجود")
    sys.exit(1)

رتبة_الأونر = 1507815463172833331
قناة_التسجيل = None

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
اسم_المطور = "taim"
معرف_المطور = "ta_im1@"
مسار_قاعدة_البيانات = "game_data.db"

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
        
        المؤشر = await قاعدة.execute("SELECT COUNT(*) FROM المتجر")
        if (await المؤشر.fetchone())[0] == 0:
            العناصر = [
                (1, "🍎 تفاحة سحرية", 100, 5, "تستعيد 20 صحة فوراً"),
                (2, "🗡️ سيف حديدي", 250, 10, "+25 ضرر"),
                (3, "🛡️ درع فولاذي", 200, 8, "+8 دفاع"),
                (4, "💎 ياقوتة", 500, 20, "حجر كريم"),
                (5, "🧪 جرعة شفاء", 80, 3, "تشفي 50 صحة فوراً"),
                (6, "📜 درع قديم", 300, 12, "مقاومة متوسطة"),
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
                الرصيد_السوق = i // 5
                عناصر_سوداء.append((i, اسماء[i-1], السعر, الرصيد_السوق, f"سلاح من الصفحة {الصفحة}", الصفحة))
            await قاعدة.executemany("INSERT INTO السوق_السوداء VALUES (?,?,?,?,?,?)", عناصر_سوداء)
        
        await قاعدة.commit()

async def احصل_على_مستخدم(المعرف):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute("SELECT عملات, رصيد, اخر_يومي, اخر_ساعي, الفريق_النشط, اخر_سرقة FROM المستخدمين WHERE user_id = ?", (المعرف,)) as مؤشر:
            الصف = await مؤشر.fetchone()
            if الصف is None:
                await قاعدة.execute("INSERT INTO المستخدمين (user_id, عملات, رصيد) VALUES (?, ?, ?)", (المعرف, عملات_البداية, رصيد_البداية))
                await قاعدة.execute("INSERT OR IGNORE INTO الفرق (user_id, slot, الاسم, الصحة) VALUES (?, 0, '', ?), (?, 1, '', ?)", (المعرف, صحة_الفريق_البدائية, المعرف, صحة_الفريق_البدائية))
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

async def احصل_على_الأسلحة_المتاحة(المعرف):
    المخزون = await احصل_على_المخزون(المعرف)
    الأسلحة = []
    
    أسلحة_العادي = {
        2: ("🗡️ سيف حديدي", 25),
        7: ("🐉 ناب تنين", 50),
        9: ("⚡ حذاء البرق", 20),
        12: ("🏹 قوس إلف", 35),
        16: ("🐺 رفيق ذئب", 45),
        23: ("🔥 عصا النار", 40)
    }
    
    for رقم_السلعة, كمية in المخزون:
        if كمية > 0:
            if رقم_السلعة in [1, 5]:
                continue
            if رقم_السلعة in أسلحة_العادي:
                الاسم, الضرر = أسلحة_العادي[رقم_السلعة]
                الأسلحة.append({"id": رقم_السلعة, "name": الاسم, "damage": الضرر})
            elif 1 <= رقم_السلعة <= 50:
                سلعة_بلاك = await احصل_على_سلعة_من_السوق_السوداء(رقم_السلعة)
                if سلعة_بلاك:
                    الضرر = 15 + (رقم_السلعة * 2)
                    الأسلحة.append({"id": رقم_السلعة, "name": سلعة_بلاك["name"], "damage": الضرر})
    
    return الأسلحة

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

الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True

البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

class السوق_السوداء_View(discord.ui.View):
    def __init__(self, الصفحة_الحالية: int = 1):
        super().__init__(timeout=120)
        self.الصفحة_الحالية = الصفحة_الحالية

    @discord.ui.button(label="◀ السابقة", style=discord.ButtonStyle.secondary)
    async def السابق_callback(self, التفاعل: discord.Interaction):
        if self.الصفحة_الحالية > 1:
            self.الصفحة_الحالية -= 1
            العناصر = await احصل_على_سلع_السوق_السوداء(self.الصفحة_الحالية)
            تضمين = discord.Embed(title=f"🔫 السوق السوداء - الصفحة {self.الصفحة_الحالية}/5", color=0xFF0000)
            for عنصر in العناصر:
                تضمين.add_field(
                    name=f"{عنصر['id']}. {عنصر['name']}", 
                    value=f"🪙 {عنصر['coinPrice']} عملة\n💎 {عنصر['creditPrice']} رصيد\n📝 *{عنصر['desc']}*", 
                    inline=True
                )
            await التفاعل.response.edit_message(embed=تضمين, view=self)
        else:
            await التفاعل.response.send_message("❌ أنت في الصفحة الأولى بالفعل!", ephemeral=True)
    
    @discord.ui.button(label="التالي ▶", style=discord.ButtonStyle.secondary)
    async def التالي_callback(self, التفاعل: discord.Interaction):
        if self.الصفحة_الحالية < 5:
            self.الصفحة_الحالية += 1
            العناصر = await احصل_على_سلع_السوق_السوداء(self.الصفحة_الحالية)
            تضمين = discord.Embed(title=f"🔫 السوق السوداء - الصفحة {self.الصفحة_الحالية}/5", color=0xFF0000)
            for عنصر in العناصر:
                تضمين.add_field(
                    name=f"{عنصر['id']}. {عنصر['name']}", 
                    value=f"🪙 {عنصر['coinPrice']} عملة\n💎 {عنصر['creditPrice']} رصيد\n📝 *{عنصر['desc']}*", 
                    inline=True
                )
            await التفاعل.response.edit_message(embed=تضمين, view=self)
        else:
            await التفاعل.response.send_message("❌ أنت في الصفحة الأخيرة (الخامسة) بالفعل!", ephemeral=True)

from ticket_bot_commands import setup_ticket_commands

@البوت.tree.command(name="help", description="عرض جميع الأوامر")
async def مساعدة(التفاعل: discord.Interaction):
    تضمين = discord.Embed(title="🤖 قائمة أوامر البوت", color=0x5865F2)
    تضمين.add_field(name="💰 الاقتصاد", value="`/رصيدي` `/يومي` `/ساعي` `/اعمل` `/الاغنياء`", inline=False)
    تضمين.add_field(name="🛒 المتجر العادي", value="`/المتجر` `/اشتري` `/مخزني`", inline=False)
    تضمين.add_field(name="🔫 السوق السوداء", value="`/بلاك_ماركت` `/شراء_بلاك`", inline=False)
    تضمين.add_field(name="👥 الفرق", value="`/تعيين_فريق` `/تفعيل_فريق` `/فرقي` `/دخول_فريق`", inline=False)
    تضمين.add_field(name="⚔️ القتال", value="`/هجوم @لاعب` (اختر سلاحك من المخزون)", inline=False)
    تضمين.add_field(name="💰 السرقة", value="`/سرقة @لاعب` (كل 10 دقائق)", inline=False)
    تضمين.add_field(name="📋 المهام", value="`/مهامي` `/تسليم_مهمة`", inline=False)
    تضمين.add_field(name="ℹ️ معلومات البوت", value="`/وصف` (روابط المطور وسيرفر الدعم)", inline=False)
    تضمين.add_field(name="👑 الإدارة", value="`/اعطاء_فلوس` `/حذف_فريق` `/اذاعة` (للأونر فقط)", inline=False)
    تضمين.add_field(name="🔗 روابط", value=f"[دعم السيرفر]({رابط_السيرفر})", inline=False)
    تضمين.set_footer(text=f"تم تطوير هذا البوت بواسطة {اسم_المطور} | {معرف_المطور}")
    await التفاعل.response.send_message(embed=تضمين)

@البوت.tree.command(name="رصيدي", description="عرض رصيدك")
async def رصيدي(التفاعل: discord.Interaction):
    المستخدم = await احصل_على_مستخدم(str(التفاعل.user.id))
    تضمين = discord.Embed(title=f"محفظة {التفاعل.user.display_name}", color=0x00AE86)
    تضمين.add_field(name="🪙 العملات", value=المستخدم["عملات"], inline=True)
    تضمين.add_field(name="💎 الرصيد المميز", value=المستخدم["رصيد"], inline=True)
    await التفاعل.response.send_message(embed=تضمين)

@البوت.tree.command(name="يومي", description="مكافأة يومية")
async def يومي(التفاعل: discord.Interaction):
    المعرف = str(التفاعل.user.id)
    المستخدم = await احصل_على_مستخدم(المعرف)
    الآن = int(time.time())
    if الآن - المستخدم["اخر_يومي"] < ثواني_اليوم:
        الباقي = ثواني_اليوم - (الآن - المستخدم["اخر_يومي"])
        await التفاعل.response.send_message(f"⏳ انتظر {الباقي//3600} ساعة", ephemeral=True)
        return
    await تحديث_مستخدم(المعرف, اخر_يومي=الآن, عملات=المستخدم["عملات"]+مكافأة_يومية_عملات, رصيد=المستخدم["رصيد"]+مكافأة_يومية_رصيد)
    await التفاعل.response.send_message(f"🎁 +{مكافأة_يومية_عملات} عملة و +{مكافأة_يومية_رصيد} رصيد")

@البوت.tree.command(name="ساعي", description="مكافأة كل ساعة")
async def ساعي(التفاعل: discord.Interaction):
    المعرف = str(التفاعل.user.id)
    المستخدم = await احصل_على_مستخدم(المعرف)
    الآن = int(time.time())
    if الآن - المستخدم["اخر_ساعي"] < ثواني_الساعة:
        الباقي = ثواني_الساعة - (الآن - المستخدم["اخر_ساعي"])
        await التفاعل.response.send_message(f"⏳ انتظر {الباقي//60} دقيقة", ephemeral=True)
        return
    await تحديث_مستخدم(المعرف, اخر_ساعي=الآن, عملات=المستخدم["عملات"]+مكافأة_ساعية_عملات)
    await التفاعل.response.send_message(f"⏲️ +{مكافأة_ساعية_عملات} عملة")

@البوت.tree.command(name="اعمل", description="اعمل لكسب عملات")
async def اعمل(التفاعل: discord.Interaction):
    كسب = random.randint(الحد_الأدنى_للعمل, الحد_الأقصى_للعمل)
    المعرف = str(التفاعل.user.id)
    المستخدم = await احصل_على_مستخدم(المعرف)
    await تحديث_مستخدم(المعرف, عملات=المستخدم["عملات"]+كسب)
    await التفاعل.response.send_message(f"💼 كسبت {كسب} عملة")

@البوت.tree.command(name="الاغنياء", description="أغنى 10 لاعبين")
async def الاغنياء(التفاعل: discord.Interaction):
    الصفوف = await احصل_على_كل_المستخدمين()
    مرتبة = sorted(الصفوف, key=lambda x: x[1], reverse=True)[:10]
    if not مرتبة:
        await التفاعل.response.send_message("لا يوجد مستخدمون بعد")
        return
    الوصف = ""
    for i, (المعرف, عملات) in enumerate(مرتبة):
        try:
            المستخدم = await البوت.fetch_user(int(المعرف))
            الاسم = المستخدم.display_name if المستخدم else "مجهول"
        except:
            الاسم = "مجهول"
        الوصف += f"{i+1}. **{الاسم}** — {عملات} 🪙\n"
    تضمين = discord.Embed(title="🏆 قائمة الأغنياء", description=الوصف, color=0xFFD700)
    await التفاعل.response.send_message(embed=تضمين)

@البوت.tree.command(name="المتجر", description="عرض المتجر العادي")
async def المتجر(التفاعل: discord.Interaction):
    العناصر = await احصل_على_كل_المتجر()
    تضمين = discord.Embed(title="🛒 المتجر العادي", color=0x3498db)
    for عنصر in العناصر[:13]:
        تضمين.add_field(name=f"{عنصر['id']}. {عنصر['name']}", value=f"🪙 {عنصر['coinPrice']} | 💎 {عنصر['creditPrice']}", inline=True)
    await التفاعل.response.send_message(embed=تضمين)

@البوت.tree.command(name="مخزني", description="عرض مخزونك")
async def مخزني(التفاعل: discord.Interaction):
    المعرف = str(التفاعل.user.id)
    المخزون = await احصل_على_المخزون(المعرف)
    if not المخزون:
        await التفاعل.response.send_message("📦 مخزونك فارغ", ephemeral=True)
        return
    الوصف = ""
    for رقم, كمية in المخزون[:10]:
        السلعة = await احصل_على_سلعة_من_المتجر(رقم)
        if السلعة:
            الوصف += f"• {السلعة['name']} x{كمية}\n"
    تضمين = discord.Embed(title=f"مخزون {التفاعل.user.display_name}", description=الوصف, color=0x2ecc71)
    await التفاعل.response.send_message(embed=تضمين)

@البوت.tree.command(name="بلاك_ماركت", description="عرض السوق السوداء (50 سلعة)")
async def بلاك_ماركت(التفاعل: discord.Interaction):
    العناصر = await احصل_على_سلع_السوق_السوداء(1)
    تضمين = discord.Embed(title="🔫 السوق السوداء - الصفحة 1/5", color=0xFF0000)
    for عنصر in العناصر:
        تضمين.add_field(name=f"{عنصر['id']}. {عنصر['name']}", value=f"🪙 {عنصر['coinPrice']} | 💎 {عنصر['creditPrice']}", inline=True)
    
    العرض = السوق_السوداء_View(1)
    await التفاعل.response.send_message(embed=تضمين, view=العرض)

@البوت.tree.command(name="شراء_بلاك", description="شراء سلعة من السوق السوداء")
@app_commands.choices(العملة=[
    app_commands.Choice(name="عملات", value="coins"), 
    app_commands.Choice(name="رصيد مميز", value="credits")
])
async def شراء_بلاك(التفاعل: discord.Interaction, رقم_السلعة: int, العملة: str):
    السلعة = await احصل_على_سلعة_من_السوق_السوداء(رقم_السلعة)
    if not السلعة:
        await التفاعل.response.send_message("❌ رقم سلعة خاطئ", ephemeral=True)
        return
    المعرف = str(التفاعل.user.id)
    المستخدم = await احصل_على_مستخدم(المعرف)
    if العملة == "coins":
        السعر = السلعة["coinPrice"]
    else:
        السعر = السلعة["creditPrice"]
        
    if العملة == "coins":
        if المستخدم["عملات"] < السعر:
            await التفاعل.response.send_message(f"❌ تحتاج {السعر} عملة", ephemeral=True)
            return
        await تحديث_مستخدم(المعرف, عملات=المستخدم["عملات"] - السعر)
    else:
        if المستخدم["رصيد"] < السعر:
            await التفاعل.response.send_message(f"❌ تحتاج {السعر} رصيد", ephemeral=True)
            return
        await تحديث_مستخدم(المعرف, رصيد=المستخدم["رصيد"] - السعر)
        
    await أضف_إلى_المخزون(المعرف, رقم_السلعة, 1)
    await التفاعل.response.send_message(f"✅ اشتريت {السلعة['name']} من السوق السوداء")

@البوت.tree.command(name="تعيين_فريق", description="تسمية فريقك")
@app_commands.choices(الرقم=[
    app_commands.Choice(name="الفريق الأول", value=1), 
    app_commands.Choice(name="الفريق الثاني", value=2)
])
async def تعيين_فريق_امر(التفاعل: discord.Interaction, الرقم: int, الاسم: str):
    if len(الاسم) > الحد_الأقصى_لاسم_الفريق:
        الاسم = الاسم[:الحد_الأقصى_لاسم_الفريق]
    await تعيين_فريق(str(التفاعل.user.id), الرقم-1, الاسم)
    await التفاعل.response.send_message(f"✅ تم تسمية الفريق {الرقم} ← {الاسم}")

@البوت.tree.command(name="تفعيل_فريق", description="تفعيل فريق")
@app_commands.choices(الرقم=[
    app_commands.Choice(name="الفريق الأول", value=1), 
    app_commands.Choice(name="الفريق الثاني", value=2)
])
async def تفعيل_فريق(التفاعل: discord.Interaction, الرقم: int):
    المعرف = str(التفاعل.user.id)
    await تحديث_مستخدم(المعرف, الفريق_النشط=الرقم-1)
    await التفاعل.response.send_message(f"🔁 تم تفعيل الفريق {الرقم}")

@البوت.tree.command(name="فرقي", description="عرض فرقك")
async def فرقي(التفاعل: discord.Interaction):
    المعرف = str(التفاعل.user.id)
    اسم1, صحة1, تخفي1 = await احصل_على_فريق(المعرف, 0, True)
    اسم2, صحة2, تخفي2 = await احصل_على_فريق(المعرف, 1, True)
    المستخدم = await احصل_على_مستخدم(المعرف)
    تضمين = discord.Embed(title=f"فرق {التفاعل.user.display_name}", color=0x9b59b6)
    تضمين.add_field(name="الفريق الأول", value=f"{اسم1 or 'غير محدد'}\n❤️ الصحة: {صحة1}\n👻 مخفي: {'نعم' if تخفي1 > time.time() else 'لا'}", inline=False)
    تضمين.add_field(name="الفريق الثاني", value=f"{اسم2 or 'غير محدد'}\n❤️ الصحة: {صحة2}\n👻 مخفي: {'نعم' if تخفي2 > time.time() else 'لا'}", inline=False)
    تضمين.add_field(name="الفريق النشط", value=f"الفريق {المستخدم['الفريق_النشط']+1}", inline=False)
    await التفاعل.response.send_message(embed=تضمين)

@البوت.tree.command(name="دخول_فريق", description="اختيار فريق من القائمة")
async def دخول_فريق(التفاعل: discord.Interaction):
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute("SELECT user_id, slot, الاسم FROM الفرق WHERE الاسم != '' LIMIT 25") as مؤشر:
            الفرق = await مؤشر.fetchall()
    if not الفرق:
        await التفاعل.response.send_message("لا توجد فرق متاحة للانضمام", ephemeral=True)
        return
    العرض = discord.ui.View()
    القائمة = discord.ui.Select(placeholder="اختر فريقاً للانضمام...")
    for فريق in الفرق:
        try:
            المستخدم = await البوت.fetch_user(int(فريق[0]))
            الاسم = المستخدم.display_name if المستخدم else "مجهول"
        except:
            الاسم = "مجهول"
        القائمة.add_option(label=فريق[2], description=f"بواسطة {الاسم}", value=f"{فريق[0]}|{فريق[1]}")
    async def رد_القائمة(تفاعل_الزر):
        القيمة = تفاعل_الزر.data["values"][0]
        المالك, الرقم = القيمة.split("|")
        await تحديث_مستخدم(str(تفاعل_الزر.user.id), الفريق_النشط=int(الرقم))
        await تفاعل_الزر.response.send_message("✅ تم الانضمام للفريق!", ephemeral=True)
    القائمة.callback = رد_القائمة
    العرض.add_item(القائمة)
    await التفاعل.response.send_message("📋 اختر فريقاً:", view=العرض, ephemeral=True)

class قائمة_اختيار_السلاح(discord.ui.Select):
    def __init__(self, المهاجم_id, الخصم_member, الأسلحة_المتاحة, البوت_instance):
        self.المهاجم_id = المهاجم_id
        self.الخصم = الخصم_member
        self.الأسلحة = الأسلحة_المتاحة
        self.البوت = البوت_instance
        
        خيارات = []
        for سلاح in الأسلحة_المتاحة:
            خيارات.append(discord.SelectOption(
                label=سلاح["name"], 
                value=str(سلاح["id"]), 
                description=f"💥 الضرر: {سلاح['damage']}"
            ))
        super().__init__(placeholder="اختر السلاح الذي تريد الهجوم به...", options=خيارات)

    async def callback(self, التفاعل: discord.Interaction):
        معرف_الخصم = str(self.الخصم.id)
        بيانات_المهاجم = await احصل_على_مستخدم(self.المهاجم_id)
        بيانات_الخصم = await احصل_على_مستخدم(معرف_الخصم)
        
        فريق_المهاجم = بيانات_المهاجم["الفريق_النشط"]
        فريق_الخصم = بيانات_الخصم["الفريق_النشط"]
        
        اسم_المهاجم, _, _ = await احصل_على_فريق(self.المهاجم_id, فريق_المهاجم, True)
        اسم_الخصم, صحة_الخصم, تخفي_الخصم = await احصل_على_فريق(معرف_الخصم, فريق_الخصم, True)
        
        if تخفي_الخصم > time.time():
            await التفاعل.response.send_message(f"❌ فريق {self.الخصم.display_name} في حالة تخفي حالياً!", ephemeral=True)
            return
        if صحة_الخصم <= 0:
            await التفاعل.response.send_message(f"❌ فريق {self.الخصم.display_name} هُزم بالفعل!", ephemeral=True)
            return

        سلاح_id = int(self.values[0])
        السلاح_المختار = next((س for س in self.الأسلحة if س["id"] == سلاح_id), None)
        
        if not السلاح_المختار:
            await التفاعل.response.send_message("❌ حدث خطأ في تحديد السلاح المختار.", ephemeral=True)
            return
            
        الضرر = السلاح_المختار["damage"]
        الصحة_الجديدة = max(0, صحة_الخصم - الضرر)
        
        await تحديث_صحة_الفريق(معرف_الخصم, فريق_الخصم, الصحة_الجديدة)
        
        self.disabled = True
        عرض = discord.ui.View()
        عرض.add_item(self)
        await التفاعل.response.edit_message(content=f"⚔️ تم تنفيذ الهجوم باستخدام {السلاح_المختار['name']}!", view=عرض)
        
        try:
            await self.الخصم.send(f"⚔️ فريقك `{اسم_الخصم}` هوجم من {التفاعل.user.display_name} باستخدام {السلاح_المختار['name']}!\n💥 الضرر: {الضرر}\n❤️ الصحة المتبقية: {الصحة_الجديدة}")
        except:
            pass
            
        await ارسال_تسجيل(self.البوت, "⚔️ هجوم مخصص", f"المهاجم: {التفاعل.user.display_name}\nالهدف: {self.الخصم.display_name}\nالسلاح: {السلاح_المختار['name']}\nالضرر: {الضرر}")
        await التفاعل.followup.send(f"⚔️ هاجمت {self.الخصم.display_name} بـ {الضرر} ضرر! الصحة المتبقية: {الصحة_الجديدة}")

@البوت.tree.command(name="هجوم", description="مهاجمة فريق خصم باختيار سلاح من مخزونك")
async def هجوم(التفاعل: discord.Interaction, الخصم: discord.Member):
    if الخصم.id == التفاعل.user.id:
        await التفاعل.response.send_message("❌ لا يمكنك مهاجمة نفسك", ephemeral=True)
        return
        
    معرف_المهاجم = str(التفاعل.user.id)
    الأسلحة_المتاحة = await احصل_على_الأسلحة_المتاحة(معرف_المهاجم)
    
    if not الأسلحة_المتاحة:
        await التفاعل.response.send_message("❌ لا تمتلك أي أسلحة في مخزونك للهجوم بها! اذهب للمتجر أو السوق السوداء لشراء سلاح.", ephemeral=True)
        return
        
    معرف_الخصم = str(الخصم.id)
    بيانات_الخصم = await احصل_على_مستخدم(معرف_الخصم)
    فريق_الخصم = بيانات_الخصم["الفريق_النشط"]
    _, صحة_الخصم, تخفي_الخصم = await احصل_على_فريق(معرف_الخصم, فريق_الخصم, True)
    
    if تخفي_الخصم > time.time():
        await التفاعل.response.send_message(f"❌ فريق {الخصم.display_name} في حالة تخفي!", ephemeral=True)
        return
    if صحة_الخصم <= 0:
        await التفاعل.response.send_message(f"❌ فريق {الخصم.display_name} هُزم ومستبعد من القتال حالياً!", ephemeral=True)
        return

    عرض = discord.ui.View()
    قائمة_الأسلحة = قائمة_اختيار_السلاح(معرف_المهاجم, الخصم, الأسلحة_المتاحة, البوت)
    عرض.add_item(قائمة_الأسلحة)
    
    await التفاعل.response.send_message("⚔️ تم العثور على أسلحة في مخزونك. الرجاء اختيار السلاح لبدء الهجوم:", view=عرض, ephemeral=True)

@البوت.tree.command(name="سرقة", description="سرقة أموال من فريق خصم")
async def سرقة(التفاعل: discord.Interaction, الخصم: discord.Member):
    if الخصم.id == التفاعل.user.id:
        await التفاعل.response.send_message("❌ لا يمكنك سرقة نفسك", ephemeral=True)
        return
    معرف_السارق = str(التفاعل.user.id)
    معرف_الضحية = str(الخصم.id)
    بيانات_السارق = await احصل_على_مستخدم(معرف_السارق)
    بيانات_الضحية = await احصل_على_مستخدم(معرف_الضحية)
    الآن = int(time.time())
    if الآن - بيانات_السارق["اخر_سرقة"] < مدة_السرقة:
        المتبقي = مدة_السرقة - (الآن - بيانات_السارق["اخر_سرقة"])
        await التفاعل.response.send_message(f"⏳ يمكنك السرقة مرة أخرى بعد {المتبقي//60} دقيقة", ephemeral=True)
        return
    فريق_الضحية = بيانات_الضحية["الفريق_النشط"]
    _, _, تخفي_الضحية = await احصل_على_فريق(معرف_الضحية, فريق_الضحية, True)
    if تخفي_الضحية > time.time():
        await التفاعل.response.send_message(f"❌ فريق {الخصم.display_name} في حالة تخفي!", ephemeral=True)
        return
    المبلغ_المسروق = max(10, int(بيانات_الضحية["عملات"] * نسبة_السرقة))
    await تحديث_مستخدم(معرف_الضحية, عملات=بيانات_الضحية["عملات"] - المبلغ_المسروق)
    await تحديث_مستخدم(معرف_السارق, عملات=بيانات_السارق["عملات"] + المبلغ_المسروق, اخر_سرقة=الآن)
    await ارسال_تسجيل(البوت, "💰 سرقة جديدة", f"السارق: {التفاعل.user.display_name}\nالضحية: {الخصم.display_name}\nالمبلغ: {المبلغ_المسروق} عملة")
    await التفاعل.response.send_message(f"💰 نجحت في سرقة **{المبلغ_المسروق} عملة** من {الخصم.display_name}!")

@البوت.tree.command(name="تخفي", description="إخفاء فريقك 30 دقيقة")
async def تخفي(التفاعل: discord.Interaction):
    المعرف = str(التفاعل.user.id)
    if not await يمتلك_سلعة(المعرف, 26):
        await التفاعل.response.send_message("❌ لا تمتلك كتاب التخفي!", ephemeral=True)
        return
    المستخدم = await احصل_على_مستخدم(المعرف)
    حتى = int(time.time()) + مدة_التخفي
    await تحديث_اختفاء_الفريق(المعرف, المستخدم["الفريق_النشط"], حتى)
    await احذف_من_المخزون(المعرف, 26, 1)
    await التفاعل.response.send_message("👻 تم إخفاء فريقك لمدة 30 دقيقة! لن يتمكن أحد من مهاجمتك أو سرقتك.")

@البوت.tree.command(name="مهامي", description="عرض مهامك")
async def مهامي(التفاعل: discord.Interaction):
    المعرف = str(التفاعل.user.id)
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute("SELECT مهمة1, مهمة2, مهمة3, تقدم1, تقدم2, تقدم3, اخر_تصفير FROM المهام WHERE user_id = ?", (المعرف,)) as مؤشر:
            الصف = await مؤشر.fetchone()
    الآن = int(time.time())
    if الصف is None or الآن - (الصف[6] if الصف[6] else 0) > 3 * ثواني_اليوم:
        قائمة_المهام = ["اعمل 5 مرات", "اهاجم 3 لاعبين", "اجمع 500 عملة", "اشترِ سلاحاً", "اسرق لاعباً", "استخدم تخفي"]
        مختارة = random.sample(قائمة_المهام, 3)
        async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
            await قاعدة.execute("INSERT OR REPLACE INTO المهام (user_id, مهمة1, مهمة2, مهمة3, تقدم1, تقدم2, تقدم3, مكتمل1, مكتمل2, مكتمل3, اخر_تصفير) VALUES (?,?,?,?,0,0,0,0,0,0,?)", 
                                (المعرف, مختارة[0], مختارة[1], مختارة[2], الآن))
        الصف = (مختارة[0], مختارة[1], مختارة[2], 0, 0, 0, الآن)
    تضمين = discord.Embed(title="📋 مهامك", color=0xF1C40F)
    تضمين.add_field(name="1️⃣ " + الصف[0], value=f"التقدم: {الصف[3]}", inline=False)
    تضمين.add_field(name="2️⃣ " + الصف[1], value=f"التقدم: {الصف[4]}", inline=False)
    تضمين.add_field(name="3️⃣ " + الصف[2], value=f"التقدم: {الصف[5]}", inline=False)
    await التفاعل.response.send_message(embed=تضمين)

@البوت.tree.command(name="تسليم_مهمة", description="تسليم مهمة مكتملة وكسب مكافأة")
async def تسليم_مهمة(التفاعل: discord.Interaction, رقم_المهمة: int):
    if رقم_المهمة not in [1, 2, 3]:
        await التفاعل.response.send_message("❌ رقم المهمة يجب أن يكون 1 أو 2 أو 3", ephemeral=True)
        return
    
    المعرف = str(التفاعل.user.id)
    حقل_المهمة = f"مهمة{رقم_المهمة}"
    حقل_التقدم = f"تقدم{رقم_المهمة}"
    حقل_مكتمل = f"مكتمل{رقم_المهمة}"
    
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        async with قاعدة.execute(f"SELECT {حقل_المهمة}, {حقل_التقدم}, {حقل_مكتمل} FROM المهام WHERE user_id = ?", (المعرف,)) as مؤشر:
            الصف = await مؤشر.fetchone()
            
    if not الصف:
        await التفاعل.response.send_message("❌ ليس لديك مهام نشطة حالياً، استخدم `/مهامي` أولاً.", ephemeral=True)
        return
        
    اسم_المهمة, التقدم, مكتمل = الصف
    
    if مكتمل == 1:
        await التفاعل.response.send_message("❌ لقد قمت بتسليم هذه المهمة واستلام جائزتها بالفعل!", ephemeral=True)
        return
        
    الهدف = 5 if "5" in اسم_المهمة else (3 if "3" in اسم_المهمة else 1)
    
    if التقدم < الهدف:
        await التفاعل.response.send_message(f"⏳ لم تكمل المهمة بعد! تقدمك الحالي: ({التقدم}/{الهدف})", ephemeral=True)
        return
        
    جائزة_عملات = 300
    جائزة_رصيد = 5
    
    المستخدم = await احصل_على_مستخدم(المعرف)
    await تحديث_مستخدم(المعرف, عملات=المستخدم["عملات"] + جائزة_عملات, رصيد=المستخدم["رصيد"] + جائزة_رصيد)
    
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        await قاعدة.execute(f"UPDATE المهام SET {حقل_مكتمل} = 1 WHERE user_id = ?", (المعرف,))
        await قاعدة.commit()
        
    await التفاعل.response.send_message(f"🎉 تهانينا! قمت بتسليم مهمة (`{اسم_المهمة}`) بنجاح!\n🎁 المكافأة: +{جائزة_عملات} عملة و +{جائزة_رصيد} رصيد مميز.")
    await ارسال_تسجيل(البوت, "📋 مهمة مكتملة", f"اللاعب: {التفاعل.user.display_name}\nالمهمة: {اسم_المهمة}")

@البوت.tree.command(name="اعطاء_فلوس", description="منح أموال للاعب (للأونر فقط)")
async def اعطاء_فلوس(التفاعل: discord.Interaction, اللاعب: discord.User, العملات: int = 0, الرصيد: int = 0):
    if التفاعل.user.id != رتبة_الأونر:
        await التفاعل.response.send_message("❌ هذا الأمر مخصص لمالك البوت فقط!", ephemeral=True)
        return
    معرف_اللاعب = str(اللاعب.id)
    بيانات = await احصل_على_مستخدم(معرف_اللاعب)
    await تحديث_مستخدم(معرف_اللاعب, عملات=بيانات["عملات"] + العملات, رصيد=بيانات["رصيد"] + الرصيد)
    await التفاعل.response.send_message(f"✅ تم منح {اللاعب.display_name}:\n🪙 {العملات} عملة\n💎 {الرصيد} رصيد مميز.")

@البوت.tree.command(name="حذف_فريق", description="تصفير بيانات فريق لاعب (للأونر فقط)")
async def حذف_فريق(التفاعل: discord.Interaction, اللاعب: discord.User):
    if التفاعل.user.id != رتبة_الأونر:
        await التفاعل.response.send_message("❌ هذا الأمر مخصص لمالك البوت فقط!", ephemeral=True)
        return
    معرف_اللاعب = str(اللاعب.id)
    async with aiosqlite.connect(مسار_قاعدة_البيانات) as قاعدة:
        await قاعدة.execute("DELETE FROM الفرق WHERE user_id = ?", (معرف_اللاعب,))
        await قاعدة.execute("INSERT OR IGNORE INTO الفرق (user_id, slot, الاسم, الصحة) VALUES (?, 0, '', ?), (?, 1, '', ?)", 
                            (معرف_اللاعب, صحة_الفريق_البدائية, معرف_اللاعب, صحة_الفريق_البدائية))
        await قاعدة.commit()
    await التفاعل.response.send_message(f"✅ تم حذف وتصفير جميع فرق اللاعب {اللاعب.display_name} بنجاح.")

@البوت.tree.command(name="اذاعة", description="إرسال رسالة لجميع مستخدمي البوت (للأونر فقط)")
async def اذاعة(التفاعل: discord.Interaction, الرسالة: str):
    if التفاعل.user.id != رتبة_الأونر:
        await التفاعل.response.send_message("❌ هذا الأمر مخصص لمالك البوت فقط!", ephemeral=True)
        return
    await التفاعل.response.defer(ephemeral=True)
    المستخدمين = await احصل_على_كل_المستخدمين()
    عداد = 0
    for عضو in المستخدمين:
        try:
            مستخدم_ديسكورد = await البوت.fetch_user(int(عضو[0]))
            if مستخدم_ديسكورد:
                await مستخدم_ديسكورد.send(f"📢 **إشعار إداري من إدارة اللعبة:**\n\n{الرسالة}")
                عداد += 1
                await asyncio.sleep(0.5)
        except:
            continue
    await التفاعل.followup.send(f"✅ تم إرسال الإذاعة بنجاح إلى {عداد} لاعب.")

@البوت.tree.command(name="وصف", description="روابط الدعم ومعلومات المطور")
async def وصف(التفاعل: discord.Interaction):
    تضمين = discord.Embed(title="ℹ️ معلومات حول نظام اللعبة", color=0x00FFFF)
    تضمين.add_field(name="👑 المطور الأساسي", value=f"{اسم_المطور} ({معرف_المطور})", inline=True)
    تضمين.add_field(name="🔗 سيرفر الدعم والمجتمع", value=f"[اضغط هنا للانضمام للـ BRQ]({رابط_السيرفر})", inline=True)
    تضمين.set_footer(text="صنع بكل حب لتطوير مجتمع الألعاب")
    await التفاعل.response.send_message(embed=تضمين)

@البوت.tree.command(name="اشتري", description="شراء سلعة (العناصر العلاجية تشفيك فوراً!)")
@app_commands.choices(العملة=[
    app_commands.Choice(name="عملات", value="coins"), 
    app_commands.Choice(name="رصيد مميز", value="credits")
])
async def اشتري(التفاعل: discord.Interaction, رقم_السلعة: int, العملة: str, الكمية: int = 1):
    if الكمية < 1:
        الكمية = 1
        
    السلعة = await احصل_على_سلعة_من_المتجر(رقم_السلعة)
    if not السلعة:
        await التفاعل.response.send_message("❌ رقم سلعة خاطئ", ephemeral=True)
        return
        
    المعرف = str(التفاعل.user.id)
    المستخدم = await احصل_على_مستخدم(المعرف)
    
    if العملة == "coins":
        السعر = السلعة["coinPrice"]
        المضاعف = 1
    else:
        السعر = السلعة["creditPrice"]
        المضاعف = 2
        
    التكلفة = السعر * الكمية
    العدد_النهائي = الكمية * المضاعف
    
    if العملة == "coins":
        if المستخدم["عملات"] < التكلفة:
            await التفاعل.response.send_message(f"❌ تحتاج {التكلفة} عملة لشراء هذا العدد", ephemeral=True)
            return
    else:
        if المستخدم["رصيد"] < التكلفة:
            await التفاعل.response.send_message(f"❌ تحتاج {التكلفة} رصيد لشراء هذا العدد", ephemeral=True)
            return

    if رقم_السلعة in [1, 5]:
        مقدار_الشفاء_للوحدة = 20 if رقم_السلعة == 1 else 50
        إجمالي_الشفاء = مقدار_الشفاء_للوحدة * العدد_النهائي
        
        فريق_نشط = المستخدم["الفريق_النشط"]
        اسم_الفريق, صحة_الحالية, _ = await احصل_على_فريق(المعرف, فريق_نشط, True)
        
        if صحة_الحالية >= 200:
            await التفاعل.response.send_message(f"❌ صحة فريقك النشط `{اسم_الفريق or f'الفريق {فريق_نشط+1}'}` كاملة بالفعل (200/200)! تم إلغاء العملية ولم يخصم شيء.", ephemeral=True)
            return
            
        if العملة == "coins":
            await تحديث_مستخدم(المعرف, عملات=المستخدم["عملات"] - التكلفة)
        else:
            await تحديث_مستخدم(المعرف, رصيد=المستخدم["رصيد"] - التكلفة)

        صحة_جديدة = min(200, صحة_الحالية + إجمالي_الشفاء)
        await تحديث_صحة_الفريق(المعرف, فريق_نشط, صحة_جديدة)
        
        await التفاعل.response.send_message(f"❤️ تم شراء {العدد_النهائي} × {السلعة['name']} وتفعيل العلاج فوراً على فريقك!\n➕ مقدار الشفاء المحتسب: +{إجمالي_الشفاء}\n🩺 صحة الفريق الحالية: **{صحة_جديدة}/200**")
        await ارسال_تسجيل(البوت, "🩺 علاج فوري", f"اللاعب: {التفاعل.user.display_name}\nالسلعة: {السلعة['name']}\nالكمية: {العدد_النهائي}\nالصحة الجديدة: {صحة_جديدة}")
        return

    if العملة == "coins":
        await تحديث_مستخدم(المعرف, عملات=المستخدم["عملات"] - التكلفة)
    else:
        await تحديث_مستخدم(المعرف, رصيد=المستخدم["رصيد"] - التكلفة)

    await أضف_إلى_المخزون(المعرف, رقم_السلعة, العدد_النهائي)
    await التفاعل.response.send_message(f"✅ اشتريت {العدد_النهائي} × {السلعة['name']} وتم إضافتها بنجاح إلى مخزنك.")

@البوت.event
async def on_ready():
    print(f"✅ تم تشغيل البوت بنجاح باسم: {البوت.user}")
    await تهيئة_قاعدة_البيانات()
    await setup_ticket_commands(البوت)
    try:
        المزامنة = await البوت.tree.sync()
        print(f"🔄 تم مزامنة {len(المزامنة)} من الأوامر المائلة Slash Commands!")
    except Exception as e:
        print(f"❌ فشل مزامنة الأوامر المائلة: {e}")

if __name__ == "__main__":
    خيط_الويب = threading.Thread(target=تشغيل_الخادم)
    خيط_الويب.daemon = True
    خيط_الويب.start()
    
    try:
        البوت.run(التوكن)
    except Exception as خطأ:
        print(f"❌ حدث خطأ فادح أثناء تشغيل البوت: {خطأ}")
        traceback.print_exc()