import discord
from discord.ext import commands, tasks
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
from datetime import datetime, date, timedelta

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

رتبة_التذاكر_المسموح_لها = 0

الرسائل_التلقائية = [
    "🎮 هل جربت استخدام /اعمل لكسب عملات إضافية اليوم؟",
    "🛒 لا تنسى زيارة المتجر /المتجر وشراء الأسلحة القوية!",
    "⚔️ يمكنك مهاجمة اللاعبين الآخرين باستخدام /هجوم @لاعب",
    "💰 السرقة متاحة كل 10 دقائق! استخدم /سرقة @لاعب",
    "👥 قم بتعيين فريقك باستخدام /تعيين_فريق",
    "🔫 السوق السوداء تحتوي على أسلحة نادرة! استخدم /بلاك_ماركت",
    "📋 تحقق من مهامك اليومية باستخدام /مهامي",
    "💎 الرصيد المميز يعطيك ضعف الكمية عند الشراء من المتجر!",
]

async def init_all_dbs():
    async with aiosqlite.connect("game_data.db") as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS المستخدمين (
            user_id TEXT PRIMARY KEY,
            عملات INTEGER DEFAULT 1000,
            رصيد INTEGER DEFAULT 0,
            اخر_يومي INTEGER DEFAULT 0,
            اخر_ساعي INTEGER DEFAULT 0,
            الفريق_النشط INTEGER DEFAULT 0,
            اخر_سرقة INTEGER DEFAULT 0
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS الفرق (
            user_id TEXT,
            slot INTEGER,
            الاسم TEXT DEFAULT '',
            الصحة INTEGER DEFAULT 200,
            مخفي_حتى INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, slot)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS المخزون (
            user_id TEXT,
            item_id INTEGER,
            الكمية INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, item_id)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS المتجر (
            item_id INTEGER PRIMARY KEY,
            الاسم TEXT,
            سعر_عملات INTEGER,
            سعر_رصيد INTEGER,
            الوصف TEXT
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS السوق_السوداء (
            item_id INTEGER PRIMARY KEY,
            الاسم TEXT,
            سعر_عملات INTEGER,
            سعر_رصيد INTEGER,
            الوصف TEXT,
            الصفحة INTEGER
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS المهام (
            user_id TEXT PRIMARY KEY,
            مهمة1 TEXT, مهمة2 TEXT, مهمة3 TEXT,
            تقدم1 INTEGER, تقدم2 INTEGER, تقدم3 INTEGER,
            مكتمل1 INTEGER, مكتمل2 INTEGER, مكتمل3 INTEGER,
            اخر_تصفير INTEGER
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS رسائل_اللاعبين (
            user_id TEXT PRIMARY KEY,
            اليوم INTEGER DEFAULT 0,
            الاسبوع INTEGER DEFAULT 0,
            الشهر INTEGER DEFAULT 0,
            المجموع INTEGER DEFAULT 0,
            اخر_تحديث_اليوم TEXT,
            اخر_تحديث_الاسبوع TEXT,
            اخر_تحديث_الشهر TEXT
        )''')
        
        cursor = await db.execute("SELECT COUNT(*) FROM المتجر")
        if (await cursor.fetchone())[0] == 0:
            عناصر = [
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
            await db.executemany("INSERT INTO المتجر VALUES (?,?,?,?,?)", عناصر)
        
        cursor = await db.execute("SELECT COUNT(*) FROM السوق_السوداء")
        if (await cursor.fetchone())[0] == 0:
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
            await db.executemany("INSERT INTO السوق_السوداء VALUES (?,?,?,?,?,?)", عناصر_سوداء)
        
        await db.commit()
    
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS اعدادات_السيرفر (
            guild_id TEXT PRIMARY KEY,
            رتبة_التذاكر TEXT,
            قناة_البانل TEXT,
            قناة_الرسائل_التلقائية TEXT,
            تم_الاعداد BOOLEAN DEFAULT 0
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS تذاكر (
            channel_id TEXT PRIMARY KEY,
            guild_id TEXT,
            creator_id TEXT,
            creator_name TEXT,
            status TEXT,
            created_at INTEGER
        )''')
        await db.commit()

async def update_message_count(user_id):
    اليوم = date.today().isoformat()
    الاسبوع = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    الشهر = date.today().replace(day=1).isoformat()
    
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT اليوم, الاسبوع, الشهر, المجموع, اخر_تحديث_اليوم, اخر_تحديث_الاسبوع, اخر_تحديث_الشهر FROM رسائل_اللاعبين WHERE user_id = ?", (str(user_id),))
        row = await cursor.fetchone()
        
        if row is None:
            await db.execute("INSERT INTO رسائل_اللاعبين (user_id, اليوم, الاسبوع, الشهر, المجموع, اخر_تحديث_اليوم, اخر_تحديث_الاسبوع, اخر_تحديث_الشهر) VALUES (?, 1, 1, 1, 1, ?, ?, ?)",
                            (str(user_id), اليوم, الاسبوع, الشهر))
        else:
            اليوم_قديم, الاسبوع_قديم, الشهر_قديم, المجموع, تاريخ_اليوم, تاريخ_الاسبوع, تاريخ_الشهر = row
            اليوم_جديد = اليوم_قديم + 1 if تاريخ_اليوم == اليوم else 1
            الاسبوع_جديد = الاسبوع_قديم + 1 if تاريخ_الاسبوع == الاسبوع else 1
            الشهر_جديد = الشهر_قديم + 1 if تاريخ_الشهر == الشهر else 1
            await db.execute("UPDATE رسائل_اللاعبين SET اليوم = ?, الاسبوع = ?, الشهر = ?, المجموع = ?, اخر_تحديث_اليوم = ?, اخر_تحديث_الاسبوع = ?, اخر_تحديث_الشهر = ? WHERE user_id = ?",
                            (اليوم_جديد, الاسبوع_جديد, الشهر_جديد, المجموع + 1, اليوم, الاسبوع, الشهر, str(user_id)))
        await db.commit()

async def is_authorized_staff(member):
    if member.guild_permissions.administrator:
        return True
    if رتبة_التذاكر_المسموح_لها and member.guild.get_role(رتبة_التذاكر_المسموح_لها) in member.roles:
        return True
    async with aiosqlite.connect("ticket_data.db") as db:
        cursor = await db.execute("SELECT رتبة_التذاكر FROM اعدادات_السيرفر WHERE guild_id = ?", (str(member.guild.id),))
        row = await cursor.fetchone()
        if row and row[0]:
            role = member.guild.get_role(int(row[0]))
            if role and role in member.roles:
                return True
    return False

class تأكيد_الإغلاق(discord.ui.View):
    def __init__(self, channel, user):
        super().__init__(timeout=60)
        self.channel = channel
        self.user = user
    
    @discord.ui.button(label="نعم، أغلق التذكرة", style=discord.ButtonStyle.danger)
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user != self.user:
            await interaction.response.send_message("❌ هذا التأكيد ليس لك!", ephemeral=True)
            return
        await interaction.response.send_message("🔒 جاري حذف التذكرة...")
        async with aiosqlite.connect("ticket_data.db") as db:
            await db.execute("DELETE FROM تذاكر WHERE channel_id = ?", (str(self.channel.id),))
            await db.commit()
        await self.channel.delete()
    
    @discord.ui.button(label="لا، إلغاء", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user != self.user:
            await interaction.response.send_message("❌ هذا التأكيد ليس لك!", ephemeral=True)
            return
        await interaction.response.send_message("✅ تم إلغاء العملية", ephemeral=True)
        self.stop()

class TicketControl(discord.ui.View):
    def __init__(self, creator_id):
        super().__init__(timeout=None)
        self.creator_id = creator_id
    
    @discord.ui.button(label="📌 استلام التذكرة", style=discord.ButtonStyle.success)
    async def claim(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not await is_authorized_staff(interaction.user):
            await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
            return
        await interaction.response.send_message(f"✅ تم استلام التذكرة بواسطة {interaction.user.mention}")
    
    @discord.ui.button(label="🔒 إغلاق التذكرة", style=discord.ButtonStyle.danger)
    async def close(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not await is_authorized_staff(interaction.user) and str(interaction.user.id) != self.creator_id:
            await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
            return
        view = تأكيد_الإغلاق(interaction.channel, interaction.user)
        embed = discord.Embed(title="⚠️ تأكيد الإغلاق", description="هل أنت متأكد؟ هذا الإجراء لا يمكن التراجع عنه.", color=0xFFA500)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

class TicketButton(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
    
    @discord.ui.button(label="🎫 فتح تذكرة", style=discord.ButtonStyle.primary)
    async def create(self, interaction: discord.Interaction, button: discord.ui.Button):
        async with aiosqlite.connect("ticket_data.db") as db:
            cursor = await db.execute("SELECT channel_id FROM تذاكر WHERE creator_id = ? AND status = 'open'", (str(interaction.user.id),))
            if await cursor.fetchone():
                await interaction.response.send_message("❌ لديك تذكرة مفتوحة بالفعل!", ephemeral=True)
                return
        
        category = discord.utils.get(interaction.guild.categories, name="تذاكر")
        if not category:
            category = await interaction.guild.create_category("تذاكر")
        
        channel = await interaction.guild.create_text_channel(
            name=f"تذكرة-{interaction.user.name}",
            category=category,
            overwrites={
                interaction.guild.default_role: discord.PermissionOverwrite(read_messages=False),
                interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True),
                interaction.guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True)
            }
        )
        
        async with aiosqlite.connect("ticket_data.db") as db:
            await db.execute("INSERT INTO تذاكر (channel_id, guild_id, creator_id, creator_name, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)",
                            (str(channel.id), str(interaction.guild_id), str(interaction.user.id), interaction.user.display_name, int(time.time())))
            await db.commit()
        
        embed = discord.Embed(title="🎫 تذكرة جديدة", description=f"مرحباً {interaction.user.mention}\nيرجى شرح مشكلتك.", color=0x00FF00)
        view = TicketControl(str(interaction.user.id))
        await channel.send(embed=embed, view=view)
        await interaction.response.send_message(f"✅ تم فتح تذكرة: {channel.mention}", ephemeral=True)

class السوق_السوداء_View(discord.ui.View):
    def __init__(self, الصفحة_الحالية: int = 1):
        super().__init__(timeout=120)
        self.الصفحة_الحالية = الصفحة_الحالية
    
    @discord.ui.button(label="◀ السابقة", style=discord.ButtonStyle.secondary)
    async def السابق(self, interaction: discord.Interaction):
        if self.الصفحة_الحالية > 1:
            self.الصفحة_الحالية -= 1
            await self.تحديث_الرسالة(interaction)
        else:
            await interaction.response.send_message("❌ أنت في الصفحة الأولى!", ephemeral=True)
    
    @discord.ui.button(label="التالي ▶", style=discord.ButtonStyle.secondary)
    async def التالي(self, interaction: discord.Interaction):
        if self.الصفحة_الحالية < 5:
            self.الصفحة_الحالية += 1
            await self.تحديث_الرسالة(interaction)
        else:
            await interaction.response.send_message("❌ أنت في الصفحة الخامسة!", ephemeral=True)
    
    async def تحديث_الرسالة(self, interaction):
        async with aiosqlite.connect("game_data.db") as db:
            cursor = await db.execute("SELECT item_id, الاسم, سعر_عملات, سعر_رصيد, الوصف FROM السوق_السوداء WHERE الصفحة = ? ORDER BY item_id", (self.الصفحة_الحالية,))
            عناصر = await cursor.fetchall()
        
        embed = discord.Embed(title=f"🔫 السوق السوداء - الصفحة {self.الصفحة_الحالية}/5", color=0xFF0000)
        for عنصر in عناصر:
            embed.add_field(name=f"{عنصر[0]}. {عنصر[1]}", value=f"🪙 {عنصر[2]} | 💎 {عنصر[3]}\n{عنصر[4]}", inline=True)
        await interaction.response.edit_message(embed=embed, view=self)

class قائمة_اختيار_السلاح(discord.ui.Select):
    def __init__(self, المهاجم_id, الخصم, الأسلحة):
        self.المهاجم_id = المهاجم_id
        self.الخصم = الخصم
        self.الأسلحة = الأسلحة
        options = [discord.SelectOption(label=س["name"], value=str(س["id"]), description=f"💥 ضرر: {س['damage']}") for س in الأسلحة]
        super().__init__(placeholder="اختر سلاحك...", options=options)
    
    async def callback(self, interaction: discord.Interaction):
        سلاح_id = int(self.values[0])
        السلاح = next((س for س in self.الأسلحة if س["id"] == سلاح_id), None)
        if not السلاح:
            await interaction.response.send_message("❌ حدث خطأ!", ephemeral=True)
            return
        
        async with aiosqlite.connect("game_data.db") as db:
            cursor = await db.execute("SELECT الصحة FROM الفرق WHERE user_id = ? AND slot = (SELECT الفريق_النشط FROM المستخدمين WHERE user_id = ?)", (str(self.الخصم.id), str(self.الخصم.id)))
            row = await cursor.fetchone()
            if not row:
                await interaction.response.send_message("❌ حدث خطأ!", ephemeral=True)
                return
            صحة_جديدة = max(0, row[0] - السلاح["damage"])
            await db.execute("UPDATE الفرق SET الصحة = ? WHERE user_id = ? AND slot = (SELECT الفريق_النشط FROM المستخدمين WHERE user_id = ?)", (صحة_جديدة, str(self.الخصم.id), str(self.الخصم.id)))
            await db.commit()
        
        await interaction.response.send_message(f"⚔️ هاجمت {self.الخصم.display_name} بـ {السلاح['name']} وتسببت بـ {السلاح['damage']} ضرر!", ephemeral=False)

async def ارسال_البانل_والرسائل():
    await البوت.wait_until_ready()
    while not البوت.is_closed():
        try:
            async with aiosqlite.connect("ticket_data.db") as db:
                cursor = await db.execute("SELECT guild_id, قناة_البانل, قناة_الرسائل_التلقائية FROM اعدادات_السيرفر WHERE تم_الاعداد = 1")
                rows = await cursor.fetchall()
            
            for guild_id, panel_channel_id, auto_channel_id in rows:
                guild = البوت.get_guild(int(guild_id))
                if not guild:
                    continue
                
                if panel_channel_id:
                    channel = guild.get_channel(int(panel_channel_id))
                    if channel:
                        embed = discord.Embed(title="🛡️ نظام التذاكر", description="اضغط الزر لفتح تذكرة", color=0x5865F2)
                        view = TicketButton()
                        async for msg in channel.history(limit=5):
                            if msg.author == البوت.user and msg.embeds:
                                await msg.edit(embed=embed, view=view)
                                break
                        else:
                            await channel.send(embed=embed, view=view)
                
                if auto_channel_id:
                    channel = guild.get_channel(int(auto_channel_id))
                    if channel:
                        رسالة = random.choice(الرسائل_التلقائية)
                        await channel.send(رسالة)
        except:
            pass
        await asyncio.sleep(300)

async def احصل_على_مستخدم(user_id):
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT عملات, رصيد, اخر_يومي, اخر_ساعي, الفريق_النشط, اخر_سرقة FROM المستخدمين WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        if row is None:
            await db.execute("INSERT INTO المستخدمين (user_id, عملات, رصيد) VALUES (?, 1000, 0)", (user_id,))
            await db.execute("INSERT INTO الفرق (user_id, slot, الصحة) VALUES (?, 0, 200), (?, 1, 200)", (user_id, user_id))
            await db.commit()
            return {"عملات": 1000, "رصيد": 0, "اخر_يومي": 0, "اخر_ساعي": 0, "الفريق_النشط": 0, "اخر_سرقة": 0}
        return {"عملات": row[0], "رصيد": row[1], "اخر_يومي": row[2], "اخر_ساعي": row[3], "الفريق_النشط": row[4], "اخر_سرقة": row[5] if len(row) > 5 else 0}

async def تحديث_مستخدم(user_id, **kwargs):
    async with aiosqlite.connect("game_data.db") as db:
        for key, val in kwargs.items():
            await db.execute(f"UPDATE المستخدمين SET {key} = ? WHERE user_id = ?", (val, user_id))
        await db.commit()

async def احصل_على_فريق(user_id, slot, مع_الصحة=False):
    async with aiosqlite.connect("game_data.db") as db:
        if مع_الصحة:
            cursor = await db.execute("SELECT الاسم, الصحة, مخفي_حتى FROM الفرق WHERE user_id = ? AND slot = ?", (user_id, slot))
            row = await cursor.fetchone()
            return (row[0], row[1], row[2]) if row else ("", 200, 0)
        else:
            cursor = await db.execute("SELECT الاسم FROM الفرق WHERE user_id = ? AND slot = ?", (user_id, slot))
            row = await cursor.fetchone()
            return row[0] if row else ""

async def تعيين_فريق(user_id, slot, name):
    async with aiosqlite.connect("game_data.db") as db:
        await db.execute("INSERT OR REPLACE INTO الفرق (user_id, slot, الاسم, الصحة) VALUES (?, ?, ?, COALESCE((SELECT الصحة FROM الفرق WHERE user_id=? AND slot=?), 200))", (user_id, slot, name, user_id, slot))
        await db.commit()

async def تحديث_صحة_الفريق(user_id, slot, new_health):
    async with aiosqlite.connect("game_data.db") as db:
        await db.execute("UPDATE الفرق SET الصحة = ? WHERE user_id = ? AND slot = ?", (new_health, user_id, slot))
        await db.commit()

async def تحديث_اختفاء_الفريق(user_id, slot, until):
    async with aiosqlite.connect("game_data.db") as db:
        await db.execute("UPDATE الفرق SET مخفي_حتى = ? WHERE user_id = ? AND slot = ?", (until, user_id, slot))
        await db.commit()

async def احصل_على_كل_المستخدمين():
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT user_id, عملات FROM المستخدمين")
        return await cursor.fetchall()

async def أضف_إلى_المخزون(user_id, item_id, qty):
    async with aiosqlite.connect("game_data.db") as db:
        await db.execute("INSERT INTO المخزون (user_id, item_id, الكمية) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET الكمية = الكمية + ?", (user_id, item_id, qty, qty))
        await db.commit()

async def احذف_من_المخزون(user_id, item_id, qty):
    async with aiosqlite.connect("game_data.db") as db:
        await db.execute("UPDATE المخزون SET الكمية = الكمية - ? WHERE user_id = ? AND item_id = ?", (qty, user_id, item_id))
        await db.commit()

async def احصل_على_المخزون(user_id):
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT item_id, الكمية FROM المخزون WHERE user_id = ?", (user_id,))
        return await cursor.fetchall()

async def احصل_على_سلعة_من_المتجر(item_id):
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT item_id, الاسم, سعر_عملات, سعر_رصيد, الوصف FROM المتجر WHERE item_id = ?", (item_id,))
        row = await cursor.fetchone()
        return {"id": row[0], "name": row[1], "coinPrice": row[2], "creditPrice": row[3], "desc": row[4]} if row else None

async def احصل_على_كل_المتجر():
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT item_id, الاسم, سعر_عملات, سعر_رصيد, الوصف FROM المتجر ORDER BY item_id")
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "coinPrice": r[2], "creditPrice": r[3], "desc": r[4]} for r in rows]

async def احصل_على_سلع_السوق_السوداء(page):
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT item_id, الاسم, سعر_عملات, سعر_رصيد, الوصف FROM السوق_السوداء WHERE الصفحة = ? ORDER BY item_id", (page,))
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "coinPrice": r[2], "creditPrice": r[3], "desc": r[4]} for r in rows]

async def احصل_على_سلعة_من_السوق_السوداء(item_id):
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT item_id, الاسم, سعر_عملات, سعر_رصيد, الوصف FROM السوق_السوداء WHERE item_id = ?", (item_id,))
        row = await cursor.fetchone()
        return {"id": row[0], "name": row[1], "coinPrice": row[2], "creditPrice": row[3], "desc": row[4]} if row else None

async def احصل_على_الأسلحة_المتاحة(user_id):
    inv = await احصل_على_المخزون(user_id)
    weapons = []
    weapon_data = {2: ("🗡️ سيف حديدي", 25), 7: ("🐉 ناب تنين", 50), 9: ("⚡ حذاء البرق", 20), 12: ("🏹 قوس إلف", 35), 16: ("🐺 رفيق ذئب", 45), 23: ("🔥 عصا النار", 40)}
    for item_id, qty in inv:
        if qty > 0 and item_id in weapon_data:
            name, damage = weapon_data[item_id]
            weapons.append({"id": item_id, "name": name, "damage": damage})
        elif 1 <= item_id <= 50:
            item = await احصل_على_سلعة_من_السوق_السوداء(item_id)
            if item:
                weapons.append({"id": item_id, "name": item["name"], "damage": 15 + (item_id * 2)})
    return weapons

async def يمتلك_سلعة(user_id, item_id):
    inv = await احصل_على_المخزون(user_id)
    for iid, qty in inv:
        if iid == item_id and qty > 0:
            return True
    return False

async def ارسال_تسجيل(bot, title, desc, color=0xFF4500):
    pass

الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True

البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

@البوت.event
async def on_ready():
    print(f"✅ البوت دخل باسم: {البوت.user}")
    await init_all_dbs()
    try:
        await البوت.tree.sync()
        print(f"🔄 تم مزامنة الأوامر")
    except Exception as e:
        print(f"❌ فشل المزامنة: {e}")
    asyncio.create_task(ارسال_البانل_والرسائل())

@البوت.event
async def on_message(message):
    if message.author.bot:
        return
    await update_message_count(message.author.id)
    await البوت.process_commands(message)

@البوت.tree.command(name="اعدادات", description="إعداد البوت في السيرفر")
@app_commands.describe(role="الرتبة المسؤولة عن التذاكر", panel_channel="قناة البانل", auto_channel="قناة الرسائل التلقائية")
async def اعدادات_البوت(interaction: discord.Interaction, role: discord.Role, panel_channel: discord.TextChannel, auto_channel: discord.TextChannel):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ للأونر فقط!", ephemeral=True)
        return
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("INSERT OR REPLACE INTO اعدادات_السيرفر (guild_id, رتبة_التذاكر, قناة_البانل, قناة_الرسائل_التلقائية, تم_الاعداد) VALUES (?, ?, ?, ?, 1)", (str(interaction.guild_id), str(role.id), str(panel_channel.id), str(auto_channel.id)))
        await db.commit()
    await interaction.response.send_message(f"✅ تم الإعداد!\nالرتبة: {role.mention}\nقناة البانل: {panel_channel.mention}\nقناة الرسائل: {auto_channel.mention}", ephemeral=True)

@البوت.tree.command(name="اعداد_التذاكر", description="إعداد نظام التذاكر")
@app_commands.describe(category="الفئة", log_channel="قناة السجلات")
async def اعداد_التذاكر(interaction: discord.Interaction, category: discord.CategoryChannel, log_channel: discord.TextChannel = None):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ للأونر فقط!", ephemeral=True)
        return
    await interaction.response.send_message(f"✅ تم إعداد الفئة: {category.mention}", ephemeral=True)

@البوت.tree.command(name="تعيين_رتبة_التذاكر", description="تعيين رتبة التذاكر")
async def تعيين_رتبة_التذاكر(interaction: discord.Interaction, role: discord.Role):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ للأونر فقط!", ephemeral=True)
        return
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("INSERT OR REPLACE INTO اعدادات_السيرفر (guild_id, رتبة_التذاكر, تم_الاعداد) VALUES (?, ?, 1)", (str(interaction.guild_id), str(role.id)))
        await db.commit()
    await interaction.response.send_message(f"✅ تم تعيين رتبة {role.mention}", ephemeral=True)

@البوت.tree.command(name="تعيين_قناة_البانل", description="تعيين قناة البانل")
async def تعيين_قناة_البانل(interaction: discord.Interaction, channel: discord.TextChannel):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ للأونر فقط!", ephemeral=True)
        return
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("INSERT OR REPLACE INTO اعدادات_السيرفر (guild_id, قناة_البانل, تم_الاعداد) VALUES (?, ?, 1)", (str(interaction.guild_id), str(channel.id)))
        await db.commit()
    await interaction.response.send_message(f"✅ تم تعيين قناة البانل: {channel.mention}", ephemeral=True)

@البوت.tree.command(name="تعيين_قناة_الرسائل", description="تعيين قناة الرسائل التلقائية")
async def تعيين_قناة_الرسائل(interaction: discord.Interaction, channel: discord.TextChannel):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ للأونر فقط!", ephemeral=True)
        return
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("INSERT OR REPLACE INTO اعدادات_السيرفر (guild_id, قناة_الرسائل_التلقائية, تم_الاعداد) VALUES (?, ?, 1)", (str(interaction.guild_id), str(channel.id)))
        await db.commit()
    await interaction.response.send_message(f"✅ تم تعيين قناة الرسائل: {channel.mention}", ephemeral=True)

@البوت.tree.command(name="brq", description="إحصائيات رسائلك")
async def brq(interaction: discord.Interaction):
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT اليوم, الاسبوع, الشهر, المجموع FROM رسائل_اللاعبين WHERE user_id = ?", (str(interaction.user.id),))
        row = await cursor.fetchone()
    today, week, month, total = row if row else (0, 0, 0, 0)
    embed = discord.Embed(title=f"📊 إحصائيات {interaction.user.display_name}", color=0x00FF00)
    embed.add_field(name="📅 اليوم", value=str(today), inline=True)
    embed.add_field(name="📆 الأسبوع", value=str(week), inline=True)
    embed.add_field(name="📅 الشهر", value=str(month), inline=True)
    embed.add_field(name="📊 المجموع", value=str(total), inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="help", description="قائمة الأوامر")
async def help_cmd(interaction: discord.Interaction):
    embed = discord.Embed(title="🤖 الأوامر", color=0x5865F2)
    embed.add_field(name="💰 الاقتصاد", value="`/رصيدي` `/يومي` `/ساعي` `/اعمل` `/الاغنياء`", inline=False)
    embed.add_field(name="🛒 المتجر", value="`/المتجر` `/اشتري` `/مخزني`", inline=False)
    embed.add_field(name="🔫 السوق السوداء", value="`/بلاك_ماركت` `/شراء_بلاك`", inline=False)
    embed.add_field(name="👥 الفرق", value="`/تعيين_فريق` `/تفعيل_فريق` `/فرقي` `/دخول_فريق`", inline=False)
    embed.add_field(name="⚔️ القتال", value="`/هجوم`", inline=False)
    embed.add_field(name="💰 السرقة", value="`/سرقة`", inline=False)
    embed.add_field(name="📋 المهام", value="`/مهامي` `/تسليم_مهمة`", inline=False)
    embed.add_field(name="🎫 التذاكر", value="`/اعدادات` `/تعيين_رتبة_التذاكر` `/تعيين_قناة_البانل`", inline=False)
    embed.add_field(name="📊 الإحصائيات", value="`/brq`", inline=False)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="رصيدي", description="رصيدك")
async def رصيدي(interaction: discord.Interaction):
    u = await احصل_على_مستخدم(str(interaction.user.id))
    embed = discord.Embed(title=f"محفظة {interaction.user.display_name}", color=0x00AE86)
    embed.add_field(name="🪙 عملات", value=u["عملات"], inline=True)
    embed.add_field(name="💎 رصيد مميز", value=u["رصيد"], inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="يومي", description="مكافأة يومية")
async def يومي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    u = await احصل_على_مستخدم(uid)
    now = int(time.time())
    if now - u["اخر_يومي"] < 86400:
        await interaction.response.send_message("⏳ انتظر 24 ساعة", ephemeral=True)
        return
    await تحديث_مستخدم(uid, اخر_يومي=now, عملات=u["عملات"]+500, رصيد=u["رصيد"]+10)
    await interaction.response.send_message("🎁 +500 عملة و +10 رصيد")

@البوت.tree.command(name="ساعي", description="مكافأة كل ساعة")
async def ساعي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    u = await احصل_على_مستخدم(uid)
    now = int(time.time())
    if now - u["اخر_ساعي"] < 3600:
        await interaction.response.send_message("⏳ انتظر ساعة", ephemeral=True)
        return
    await تحديث_مستخدم(uid, اخر_ساعي=now, عملات=u["عملات"]+100)
    await interaction.response.send_message("⏲️ +100 عملة")

@البوت.tree.command(name="اعمل", description="اكسب عملات")
async def اعمل(interaction: discord.Interaction):
    earn = random.randint(50, 200)
    uid = str(interaction.user.id)
    u = await احصل_على_مستخدم(uid)
    await تحديث_مستخدم(uid, عملات=u["عملات"]+earn)
    await interaction.response.send_message(f"💼 كسبت {earn} عملة")

@البوت.tree.command(name="الاغنياء", description="أغنى 10 لاعبين")
async def الاغنياء(interaction: discord.Interaction):
    rows = await احصل_على_كل_المستخدمين()
    sorted_rows = sorted(rows, key=lambda x: x[1], reverse=True)[:10]
    if not sorted_rows:
        await interaction.response.send_message("لا يوجد مستخدمون")
        return
    desc = ""
    for i, (uid, coins) in enumerate(sorted_rows):
        user = await البوت.fetch_user(int(uid))
        name = user.display_name if user else "مجهول"
        desc += f"{i+1}. **{name}** — {coins} 🪙\n"
    embed = discord.Embed(title="🏆 قائمة الأغنياء", description=desc, color=0xFFD700)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="المتجر", description="المتجر العادي")
async def المتجر(interaction: discord.Interaction):
    items = await احصل_على_كل_المتجر()
    embed = discord.Embed(title="🛒 المتجر", color=0x3498db)
    for item in items[:13]:
        embed.add_field(name=f"{item['id']}. {item['name']}", value=f"🪙 {item['coinPrice']} | 💎 {item['creditPrice']}", inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="مخزني", description="مخزونك")
async def مخزني(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    inv = await احصل_على_المخزون(uid)
    if not inv:
        await interaction.response.send_message("📦 فارغ", ephemeral=True)
        return
    desc = ""
    for iid, qty in inv[:10]:
        item = await احصل_على_سلعة_من_المتجر(iid)
        if item:
            desc += f"• {item['name']} x{qty}\n"
    embed = discord.Embed(title=f"مخزون {interaction.user.display_name}", description=desc, color=0x2ecc71)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="بلاك_ماركت", description="السوق السوداء")
async def بلاك_ماركت(interaction: discord.Interaction):
    items = await احصل_على_سلع_السوق_السوداء(1)
    embed = discord.Embed(title="🔫 السوق السوداء - الصفحة 1/5", color=0xFF0000)
    for item in items:
        embed.add_field(name=f"{item['id']}. {item['name']}", value=f"🪙 {item['coinPrice']} | 💎 {item['creditPrice']}", inline=True)
    view = السوق_السوداء_View(1)
    await interaction.response.send_message(embed=embed, view=view)

@البوت.tree.command(name="شراء_بلاك", description="شراء من السوق السوداء")
@app_commands.choices(currency=[app_commands.Choice(name="عملات", value="coins"), app_commands.Choice(name="رصيد مميز", value="credits")])
async def شراء_بلاك(interaction: discord.Interaction, item_id: int, currency: str):
    item = await احصل_على_سلعة_من_السوق_السوداء(item_id)
    if not item:
        await interaction.response.send_message("❌ رقم خاطئ", ephemeral=True)
        return
    uid = str(interaction.user.id)
    u = await احصل_على_مستخدم(uid)
    price = item["coinPrice"] if currency == "coins" else item["creditPrice"]
    if currency == "coins":
        if u["عملات"] < price:
            await interaction.response.send_message(f"❌ تحتاج {price} عملة", ephemeral=True)
            return
        await تحديث_مستخدم(uid, عملات=u["عملات"]-price)
    else:
        if u["رصيد"] < price:
            await interaction.response.send_message(f"❌ تحتاج {price} رصيد", ephemeral=True)
            return
        await تحديث_مستخدم(uid, رصيد=u["رصيد"]-price)
    await أضف_إلى_المخزون(uid, item_id, 1)
    await interaction.response.send_message(f"✅ اشتريت {item['name']}")

@البوت.tree.command(name="اشتري", description="شراء من المتجر العادي")
@app_commands.choices(currency=[app_commands.Choice(name="عملات", value="coins"), app_commands.Choice(name="رصيد مميز", value="credits")])
async def اشتري(interaction: discord.Interaction, item_id: int, currency: str, quantity: int = 1):
    if quantity < 1:
        quantity = 1
    item = await احصل_على_سلعة_من_المتجر(item_id)
    if not item:
        await interaction.response.send_message("❌ رقم خاطئ", ephemeral=True)
        return
    uid = str(interaction.user.id)
    u = await احصل_على_مستخدم(uid)
    if currency == "coins":
        price = item["coinPrice"]
        multiplier = 1
    else:
        price = item["creditPrice"]
        multiplier = 2
    cost = price * quantity
    if currency == "coins":
        if u["عملات"] < cost:
            await interaction.response.send_message(f"❌ تحتاج {cost} عملة", ephemeral=True)
            return
        await تحديث_مستخدم(uid, عملات=u["عملات"]-cost)
    else:
        if u["رصيد"] < cost:
            await interaction.response.send_message(f"❌ تحتاج {cost} رصيد", ephemeral=True)
            return
        await تحديث_مستخدم(uid, رصيد=u["رصيد"]-cost)
    
    if item_id in [1, 5]:
        heal = 20 if item_id == 1 else 50
        total_heal = heal * quantity * multiplier
        active = u["الفريق_النشط"]
        _, current_hp, _ = await احصل_على_فريق(uid, active, True)
        if current_hp >= 200:
            await interaction.response.send_message("❌ صحتك كاملة!", ephemeral=True)
            return
        new_hp = min(200, current_hp + total_heal)
        await تحديث_صحة_الفريق(uid, active, new_hp)
        await interaction.response.send_message(f"❤️ تم الشفاء! +{total_heal} صحة")
    else:
        received = quantity * multiplier
        await أضف_إلى_المخزون(uid, item_id, received)
        await interaction.response.send_message(f"✅ اشتريت {received} × {item['name']}")

@البوت.tree.command(name="تعيين_فريق", description="تسمية فريقك")
@app_commands.choices(slot=[app_commands.Choice(name="الفريق الأول", value=1), app_commands.Choice(name="الفريق الثاني", value=2)])
async def تعيين_فريق_امر(interaction: discord.Interaction, slot: int, name: str):
    if len(name) > 20:
        name = name[:20]
    await تعيين_فريق(str(interaction.user.id), slot-1, name)
    await interaction.response.send_message(f"✅ الفريق {slot} ← {name}")

@البوت.tree.command(name="تفعيل_فريق", description="تفعيل فريق")
@app_commands.choices(slot=[app_commands.Choice(name="الفريق الأول", value=1), app_commands.Choice(name="الفريق الثاني", value=2)])
async def تفعيل_فريق(interaction: discord.Interaction, slot: int):
    await تحديث_مستخدم(str(interaction.user.id), الفريق_النشط=slot-1)
    await interaction.response.send_message(f"🔁 تم تفعيل الفريق {slot}")

@البوت.tree.command(name="فرقي", description="عرض فرقك")
async def فرقي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    n1, h1, i1 = await احصل_على_فريق(uid, 0, True)
    n2, h2, i2 = await احصل_على_فريق(uid, 1, True)
    u = await احصل_على_مستخدم(uid)
    embed = discord.Embed(title=f"فرق {interaction.user.display_name}", color=0x9b59b6)
    embed.add_field(name="الفريق الأول", value=f"{n1 or 'غير محدد'}\n❤️ {h1}\n👻 {'مخفي' if i1 > time.time() else 'ظاهر'}", inline=False)
    embed.add_field(name="الفريق الثاني", value=f"{n2 or 'غير محدد'}\n❤️ {h2}\n👻 {'مخفي' if i2 > time.time() else 'ظاهر'}", inline=False)
    embed.add_field(name="النشط", value=f"الفريق {u['الفريق_النشط']+1}", inline=False)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="دخول_فريق", description="الانضمام لفريق")
async def دخول_فريق(interaction: discord.Interaction):
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT user_id, slot, الاسم FROM الفرق WHERE الاسم != '' LIMIT 25")
        teams = await cursor.fetchall()
    if not teams:
        await interaction.response.send_message("لا توجد فرق", ephemeral=True)
        return
    view = discord.ui.View()
    select = discord.ui.Select(placeholder="اختر فريقاً...")
    for team in teams:
        user = await البوت.fetch_user(int(team[0]))
        name = user.display_name if user else "مجهول"
        select.add_option(label=team[2], description=f"{name}", value=f"{team[0]}|{team[1]}")
    async def select_callback(inter):
        val = inter.data["values"][0]
        owner, slot = val.split("|")
        await تحديث_مستخدم(str(inter.user.id), الفريق_النشط=int(slot))
        await inter.response.send_message("✅ تم الانضمام!", ephemeral=True)
    select.callback = select_callback
    view.add_item(select)
    await interaction.response.send_message("📋 اختر فريقاً:", view=view, ephemeral=True)

@البوت.tree.command(name="هجوم", description="مهاجمة لاعب")
async def هجوم(interaction: discord.Interaction, target: discord.Member):
    if target.id == interaction.user.id:
        await interaction.response.send_message("❌ لا يمكنك مهاجمة نفسك", ephemeral=True)
        return
    weapons = await احصل_على_الأسلحة_المتاحة(str(interaction.user.id))
    if not weapons:
        await interaction.response.send_message("❌ لا تملك أسلحة!", ephemeral=True)
        return
    view = discord.ui.View()
    select = قائمة_اختيار_السلاح(str(interaction.user.id), target, weapons)
    view.add_item(select)
    await interaction.response.send_message("⚔️ اختر سلاحك:", view=view, ephemeral=True)

@البوت.tree.command(name="سرقة", description="سرقة لاعب")
async def سرقة(interaction: discord.Interaction, target: discord.Member):
    if target.id == interaction.user.id:
        await interaction.response.send_message("❌ لا يمكنك سرقة نفسك", ephemeral=True)
        return
    uid = str(interaction.user.id)
    tid = str(target.id)
    u = await احصل_على_مستخدم(uid)
    t = await احصل_على_مستخدم(tid)
    now = int(time.time())
    if now - u["اخر_سرقة"] < 600:
        await interaction.response.send_message("⏳ انتظر 10 دقائق", ephemeral=True)
        return
    stolen = max(10, int(t["عملات"] * 0.2))
    await تحديث_مستخدم(tid, عملات=t["عملات"]-stolen)
    await تحديث_مستخدم(uid, عملات=u["عملات"]+stolen, اخر_سرقة=now)
    await interaction.response.send_message(f"💰 سرقت {stolen} عملة من {target.display_name}")

@البوت.tree.command(name="تخفي", description="إخفاء فريقك")
async def تخفي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    if not await يمتلك_سلعة(uid, 26):
        await interaction.response.send_message("❌ لا تملك كتاب التخفي!", ephemeral=True)
        return
    u = await احصل_على_مستخدم(uid)
    until = int(time.time()) + 1800
    await تحديث_اختفاء_الفريق(uid, u["الفريق_النشط"], until)
    await احذف_من_المخزون(uid, 26, 1)
    await interaction.response.send_message("👻 تم إخفاء فريقك 30 دقيقة")

@البوت.tree.command(name="مهامي", description="مهامك")
async def مهامي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute("SELECT مهمة1, مهمة2, مهمة3, تقدم1, تقدم2, تقدم3, اخر_تصفير FROM المهام WHERE user_id = ?", (uid,))
        row = await cursor.fetchone()
    now = int(time.time())
    if row is None or now - (row[6] if row[6] else 0) > 259200:
        missions = ["اعمل 5 مرات", "اهاجم 3 لاعبين", "اجمع 500 عملة", "اشترِ سلاحاً", "اسرق لاعباً", "استخدم تخفي"]
        selected = random.sample(missions, 3)
        async with aiosqlite.connect("game_data.db") as db:
            await db.execute("INSERT OR REPLACE INTO المهام VALUES (?,?,?,?,0,0,0,0,0,0,?)", (uid, selected[0], selected[1], selected[2], now))
        row = (selected[0], selected[1], selected[2], 0, 0, 0, now)
    embed = discord.Embed(title="📋 مهامك", color=0xF1C40F)
    embed.add_field(name="1️⃣ " + row[0], value=f"تقدم: {row[3]}", inline=False)
    embed.add_field(name="2️⃣ " + row[1], value=f"تقدم: {row[4]}", inline=False)
    embed.add_field(name="3️⃣ " + row[2], value=f"تقدم: {row[5]}", inline=False)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="تسليم_مهمة", description="تسليم مهمة")
async def تسليم_مهمة(interaction: discord.Interaction, mission_number: int):
    if mission_number not in [1,2,3]:
        await interaction.response.send_message("❌ رقم 1 أو 2 أو 3", ephemeral=True)
        return
    uid = str(interaction.user.id)
    field = f"مهمة{mission_number}"
    progress_field = f"تقدم{mission_number}"
    completed_field = f"مكتمل{mission_number}"
    async with aiosqlite.connect("game_data.db") as db:
        cursor = await db.execute(f"SELECT {field}, {progress_field}, {completed_field} FROM المهام WHERE user_id = ?", (uid,))
        row = await cursor.fetchone()
        if not row:
            await interaction.response.send_message("❌ لا توجد مهام", ephemeral=True)
            return
        name, progress, completed = row
        target = 5 if "5" in name else (3 if "3" in name else 1)
        if completed == 1:
            await interaction.response.send_message("❌ تم التسليم سابقاً", ephemeral=True)
            return
        if progress < target:
            await interaction.response.send_message(f"⏳ تقدمك: {progress}/{target}", ephemeral=True)
            return
        await db.execute(f"UPDATE المهام SET {completed_field} = 1 WHERE user_id = ?", (uid,))
        await db.commit()
    u = await احصل_على_مستخدم(uid)
    await تحديث_مستخدم(uid, عملات=u["عملات"]+300, رصيد=u["رصيد"]+5)
    await interaction.response.send_message(f"🎉 سلمت المهمة! +300 عملة و +5 رصيد")

@البوت.tree.command(name="اعطاء_فلوس", description="منح أموال (للأونر)")
async def اعطاء_فلوس(interaction: discord.Interaction, user: discord.User, coins: int = 0, credits: int = 0):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ للأونر فقط!", ephemeral=True)
        return
    u = await احصل_على_مستخدم(str(user.id))
    await تحديث_مستخدم(str(user.id), عملات=u["عملات"]+coins, رصيد=u["رصيد"]+credits)
    await interaction.response.send_message(f"✅ أعطيت {user.mention} {coins} عملة و {credits} رصيد")

@البوت.tree.command(name="حذف_فريق", description="حذف فريق لاعب (للأونر)")
async def حذف_فريق(interaction: discord.Interaction, user: discord.User, team_number: int):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ للأونر فقط!", ephemeral=True)
        return
    if team_number not in [1,2]:
        await interaction.response.send_message("❌ رقم 1 أو 2", ephemeral=True)
        return
    await تعيين_فريق(str(user.id), team_number-1, "")
    await interaction.response.send_message(f"✅ حذف الفريق {team_number} لـ {user.mention}")

@البوت.tree.command(name="اذاعة", description="إرسال إشعار للجميع (للأونر)")
async def اذاعة(interaction: discord.Interaction, message: str):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ للأونر فقط!", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    users = await احصل_على_كل_المستخدمين()
    count = 0
    for uid, _ in users:
        try:
            user = await البوت.fetch_user(int(uid))
            if user:
                await user.send(f"📢 {message}")
                count += 1
                await asyncio.sleep(0.5)
        except:
            pass
    await interaction.followup.send(f"✅ أرسلت إلى {count} مستخدم")

@البوت.tree.command(name="وصف", description="معلومات البوت")
async def وصف(interaction: discord.Interaction):
    embed = discord.Embed(title="ℹ️ معلومات البوت", color=0x00FFFF)
    embed.add_field(name="👑 المطور", value=f"{اسم_المطور} ({معرف_المطور})", inline=True)
    embed.add_field(name="🔗 السيرفر", value=f"[دعم]({رابط_السيرفر})", inline=True)
    await interaction.response.send_message(embed=embed)

if __name__ == "__main__":
    خيط_الويب = threading.Thread(target=تشغيل_الخادم)
    خيط_الويب.daemon = True
    خيط_الويب.start()
    try:
        البوت.run(التوكن)
    except Exception as e:
        print(f"❌ خطأ: {e}")
        traceback.print_exc()