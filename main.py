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
مسار_تذاكر_البيانات = "ticket_data.db"

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

async def init_ticket_db():
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS ticket_config (
            guild_id TEXT PRIMARY KEY,
            category_id TEXT,
            log_channel_id TEXT,
            panel_channel_id TEXT,
            panel_message_id TEXT,
            embed_title TEXT DEFAULT '🛡️ فتح تذكرة جديدة',
            embed_description TEXT DEFAULT 'اضغط على الزر أدناه لفتح تذكرة وسيقوم فريق الدعم بالتواصل معك قريباً.',
            embed_color TEXT DEFAULT '5865F2',
            auto_close_hours INTEGER DEFAULT 24
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS tickets (
            ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            channel_id TEXT,
            creator_id TEXT,
            creator_name TEXT,
            claimer_id TEXT,
            status TEXT DEFAULT 'open',
            created_at INTEGER,
            closed_at INTEGER,
            closed_by TEXT,
            reason TEXT
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS staff_roles (
            guild_id TEXT,
            role_id TEXT,
            role_type TEXT,
            PRIMARY KEY (guild_id, role_id)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS blacklist (
            guild_id TEXT,
            user_id TEXT,
            reason TEXT,
            banned_at INTEGER,
            PRIMARY KEY (guild_id, user_id)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS tags (
            guild_id TEXT,
            tag_name TEXT,
            tag_content TEXT,
            created_by TEXT,
            PRIMARY KEY (guild_id, tag_name)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS auto_close_settings (
            guild_id TEXT PRIMARY KEY,
            enabled INTEGER DEFAULT 0,
            hours INTEGER DEFAULT 24
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS language_settings (
            guild_id TEXT PRIMARY KEY,
            language TEXT DEFAULT 'en'
        )''')
        await db.commit()

async def get_ticket_config(guild_id):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        async with db.execute("SELECT category_id, log_channel_id, panel_channel_id, panel_message_id, embed_title, embed_description, embed_color, auto_close_hours FROM ticket_config WHERE guild_id = ?", (str(guild_id),)) as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    "category_id": row[0],
                    "log_channel_id": row[1],
                    "panel_channel_id": row[2],
                    "panel_message_id": row[3],
                    "embed_title": row[4],
                    "embed_description": row[5],
                    "embed_color": row[6],
                    "auto_close_hours": row[7]
                }
            return None

async def save_ticket_config(guild_id, category_id=None, log_channel_id=None, panel_channel_id=None, panel_message_id=None, embed_title=None, embed_description=None, embed_color=None, auto_close_hours=None):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        existing = await get_ticket_config(guild_id)
        if existing:
            await db.execute("UPDATE ticket_config SET category_id = COALESCE(?, category_id), log_channel_id = COALESCE(?, log_channel_id), panel_channel_id = COALESCE(?, panel_channel_id), panel_message_id = COALESCE(?, panel_message_id), embed_title = COALESCE(?, embed_title), embed_description = COALESCE(?, embed_description), embed_color = COALESCE(?, embed_color), auto_close_hours = COALESCE(?, auto_close_hours) WHERE guild_id = ?",
                            (category_id, log_channel_id, panel_channel_id, panel_message_id, embed_title, embed_description, embed_color, auto_close_hours, str(guild_id)))
        else:
            await db.execute("INSERT INTO ticket_config (guild_id, category_id, log_channel_id, panel_channel_id, panel_message_id, embed_title, embed_description, embed_color, auto_close_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            (str(guild_id), category_id, log_channel_id, panel_channel_id, panel_message_id, embed_title or '🛡️ فتح تذكرة جديدة', embed_description or 'اضغط على الزر أدناه لفتح تذكرة وسيقوم فريق الدعم بالتواصل معك قريباً.', embed_color or '5865F2', auto_close_hours or 24))
        await db.commit()

async def create_ticket_channel(guild, creator, category_id):
    ticket_number = 1
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        async with db.execute("SELECT COUNT(*) FROM tickets WHERE guild_id = ?", (str(guild.id),)) as cursor:
            count = (await cursor.fetchone())[0]
            ticket_number = count + 1
    
    channel_name = f"ticket-{creator.name}-{ticket_number}"
    category = guild.get_channel(int(category_id)) if category_id else None
    
    overwrites = {
        guild.default_role: discord.PermissionOverwrite(read_messages=False),
        creator: discord.PermissionOverwrite(read_messages=True, send_messages=True, attach_files=True, embed_links=True, add_reactions=True)
    }
    
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        async with db.execute("SELECT role_id FROM staff_roles WHERE guild_id = ? AND role_type = 'support'", (str(guild.id),)) as cursor:
            support_roles = await cursor.fetchall()
            for role_id in support_roles:
                role = guild.get_role(int(role_id[0]))
                if role:
                    overwrites[role] = discord.PermissionOverwrite(read_messages=True, send_messages=True, attach_files=True, embed_links=True, add_reactions=True)
    
    channel = await guild.create_text_channel(name=channel_name, category=category, overwrites=overwrites)
    return channel

async def log_ticket_event(bot, guild_id, event_type, details):
    config = await get_ticket_config(guild_id)
    if not config or not config["log_channel_id"]:
        return
    
    log_channel = bot.get_channel(int(config["log_channel_id"]))
    if not log_channel:
        return
    
    embed = discord.Embed(title=f"📋 {event_type}", description=details, color=0x5865F2, timestamp=datetime.now())
    await log_channel.send(embed=embed)

async def is_staff(member, guild_id):
    if member.guild_permissions.administrator:
        return True
    
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        async with db.execute("SELECT role_id FROM staff_roles WHERE guild_id = ? AND role_type = 'support'", (str(guild_id),)) as cursor:
            support_roles = await cursor.fetchall()
            for role_id in support_roles:
                role = member.guild.get_role(int(role_id[0]))
                if role and role in member.roles:
                    return True
    return False

async def is_blacklisted(guild_id, user_id):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        async with db.execute("SELECT * FROM blacklist WHERE guild_id = ? AND user_id = ?", (str(guild_id), str(user_id))) as cursor:
            return await cursor.fetchone() is not None

async def add_to_blacklist(guild_id, user_id, reason, banned_by):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        await db.execute("INSERT OR REPLACE INTO blacklist (guild_id, user_id, reason, banned_at) VALUES (?, ?, ?, ?)",
                        (str(guild_id), str(user_id), reason, int(datetime.now().timestamp())))
        await db.commit()

async def remove_from_blacklist(guild_id, user_id):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        await db.execute("DELETE FROM blacklist WHERE guild_id = ? AND user_id = ?", (str(guild_id), str(user_id)))
        await db.commit()

async def get_ticket_info(channel_id):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        async with db.execute("SELECT ticket_id, creator_id, creator_name, claimer_id, status, created_at FROM tickets WHERE channel_id = ?", (str(channel_id),)) as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    "ticket_id": row[0],
                    "creator_id": row[1],
                    "creator_name": row[2],
                    "claimer_id": row[3],
                    "status": row[4],
                    "created_at": row[5]
                }
            return None

async def update_ticket_status(channel_id, status, claimer_id=None, closed_by=None, reason=None):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        if status == "claimed":
            await db.execute("UPDATE tickets SET status = ?, claimer_id = ? WHERE channel_id = ?", (status, claimer_id, str(channel_id)))
        elif status == "closed":
            await db.execute("UPDATE tickets SET status = ?, closed_at = ?, closed_by = ?, reason = ? WHERE channel_id = ?", 
                            (status, int(datetime.now().timestamp()), closed_by, reason, str(channel_id)))
        elif status == "reopened":
            await db.execute("UPDATE tickets SET status = ?, closed_at = NULL, closed_by = NULL, reason = NULL WHERE channel_id = ?", (status, str(channel_id)))
        else:
            await db.execute("UPDATE tickets SET status = ? WHERE channel_id = ?", (status, str(channel_id)))
        await db.commit()

async def create_ticket_record(guild_id, channel_id, creator_id, creator_name):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        await db.execute("INSERT INTO tickets (guild_id, channel_id, creator_id, creator_name, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)",
                        (str(guild_id), str(channel_id), str(creator_id), creator_name, int(datetime.now().timestamp())))
        await db.commit()

async def add_staff_role(guild_id, role_id, role_type):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        await db.execute("INSERT OR REPLACE INTO staff_roles (guild_id, role_id, role_type) VALUES (?, ?, ?)", (str(guild_id), str(role_id), role_type))
        await db.commit()

async def remove_staff_role(guild_id, role_id):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        await db.execute("DELETE FROM staff_roles WHERE guild_id = ? AND role_id = ?", (str(guild_id), str(role_id)))
        await db.commit()

async def get_all_staff_roles(guild_id):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        async with db.execute("SELECT role_id, role_type FROM staff_roles WHERE guild_id = ?", (str(guild_id),)) as cursor:
            return await cursor.fetchall()

class TicketButton(discord.ui.View):
    def __init__(self, config):
        super().__init__(timeout=None)
        self.config = config
    
    @discord.ui.button(label="🎫 فتح تذكرة", style=discord.ButtonStyle.primary, custom_id="create_ticket")
    async def create_ticket_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if await is_blacklisted(interaction.guild_id, interaction.user.id):
            await interaction.response.send_message("❌ لقد تم حظرك من استخدام نظام التذاكر!", ephemeral=True)
            return
        
        async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
            async with db.execute("SELECT channel_id FROM tickets WHERE guild_id = ? AND creator_id = ? AND status IN ('open', 'claimed')", 
                                  (str(interaction.guild_id), str(interaction.user.id))) as cursor:
                existing = await cursor.fetchone()
                if existing:
                    await interaction.response.send_message(f"❌ لديك تذكرة مفتوحة بالفعل! <#{existing[0]}>", ephemeral=True)
                    return
        
        config = await get_ticket_config(interaction.guild_id)
        if not config or not config["category_id"]:
            await interaction.response.send_message("❌ نظام التذاكر لم يتم إعداده بشكل صحيح بعد!", ephemeral=True)
            return
        
        await interaction.response.defer(ephemeral=True)
        
        channel = await create_ticket_channel(interaction.guild, interaction.user, config["category_id"])
        await create_ticket_record(interaction.guild_id, channel.id, interaction.user.id, interaction.user.display_name)
        
        embed = discord.Embed(
            title="🎫 تذكرة جديدة",
            description=f"مرحباً {interaction.user.mention},\n\nيرجى شرح مشكلتك بالتفصيل وسيقوم فريق الدعم بالرد عليك في أقرب وقت ممكن.\n\n**لتجنب إغلاق التذكرة، يرجى الرد خلال 24 ساعة.**",
            color=0x00FF00
        )
        
        view = TicketControlView()
        await channel.send(f"{interaction.user.mention}", embed=embed, view=view)
        
        await interaction.followup.send(f"✅ تم فتح تذكرة جديدة! {channel.mention}", ephemeral=True)
        
        await log_ticket_event(interaction.client, interaction.guild_id, "تذكرة جديدة", f"المستخدم: {interaction.user.mention}\nالقناة: {channel.mention}")

class TicketControlView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
    
    @discord.ui.button(label="📌 استلام التذكرة", style=discord.ButtonStyle.success, custom_id="claim_ticket")
    async def claim_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not await is_staff(interaction.user, interaction.guild_id):
            await interaction.response.send_message("❌ ليس لديك صلاحية لاستلام هذه التذكرة!", ephemeral=True)
            return
        
        ticket_info = await get_ticket_info(interaction.channel.id)
        if not ticket_info:
            await interaction.response.send_message("❌ حدث خطأ في التذكرة!", ephemeral=True)
            return
        
        if ticket_info["status"] == "claimed":
            await interaction.response.send_message(f"❌ هذه التذكرة تم استلامها بالفعل بواسطة <@{ticket_info['claimer_id']}>", ephemeral=True)
            return
        
        await update_ticket_status(interaction.channel.id, "claimed", str(interaction.user.id))
        
        embed = discord.Embed(
            title="📌 تم استلام التذكرة",
            description=f"تم استلام هذه التذكرة بواسطة {interaction.user.mention}\nسيتم الرد عليك قريباً.",
            color=0xFFFF00
        )
        await interaction.response.send_message(embed=embed)
        
        await log_ticket_event(interaction.client, interaction.guild_id, "استلام تذكرة", f"الموظف: {interaction.user.mention}\nالقناة: {interaction.channel.mention}\nصاحب التذكرة: <@{ticket_info['creator_id']}>")
    
    @discord.ui.button(label="🔒 إغلاق التذكرة", style=discord.ButtonStyle.danger, custom_id="close_ticket")
    async def close_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not await is_staff(interaction.user, interaction.guild_id) and str(interaction.user.id) != (await get_ticket_info(interaction.channel.id))["creator_id"]:
            await interaction.response.send_message("❌ ليس لديك صلاحية لإغلاق هذه التذكرة!", ephemeral=True)
            return
        
        ticket_info = await get_ticket_info(interaction.channel.id)
        if ticket_info["status"] == "closed":
            await interaction.response.send_message("❌ هذه التذكرة مغلقة بالفعل!", ephemeral=True)
            return
        
        await update_ticket_status(interaction.channel.id, "closed", closed_by=str(interaction.user.id))
        
        embed = discord.Embed(
            title="🔒 تم إغلاق التذكرة",
            description=f"تم إغلاق هذه التذكرة بواسطة {interaction.user.mention}\nيمكنك استخدام `/reopen` لإعادة فتحها إذا لزم الأمر.",
            color=0xFF0000
        )
        await interaction.response.send_message(embed=embed)
        
        overwrite = interaction.channel.overwrites_for(interaction.guild.default_role)
        overwrite.send_messages = False
        await interaction.channel.set_permissions(interaction.guild.default_role, overwrite=overwrite)
        
        if ticket_info["creator_id"]:
            creator = interaction.guild.get_member(int(ticket_info["creator_id"]))
            if creator:
                overwrite_creator = interaction.channel.overwrites_for(creator)
                overwrite_creator.send_messages = False
                await interaction.channel.set_permissions(creator, overwrite=overwrite_creator)
        
        await log_ticket_event(interaction.client, interaction.guild_id, "إغلاق تذكرة", f"بواسطة: {interaction.user.mention}\nالقناة: {interaction.channel.mention}")

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
    تضمين.add_field(name="🎫 نظام التذاكر", value="`/setup` `/panel` `/addadmin` `/addsupport` `/removesupport` `/blacklist` `/stats`", inline=False)
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

@البوت.tree.command(name="setup", description="إعداد نظام التذاكر (الأونر فقط)")
@app_commands.describe(category="الفئة التي ستُنشأ بها التذاكر", log_channel="قناة السجلات", auto_close_hours="عدد ساعات الإغلاق التلقائي")
async def setup_ticket(interaction: discord.Interaction, category: discord.CategoryChannel, log_channel: discord.TextChannel = None, auto_close_hours: int = 24):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    await save_ticket_config(interaction.guild_id, category_id=str(category.id), log_channel_id=str(log_channel.id) if log_channel else None, auto_close_hours=auto_close_hours)
    
    embed = discord.Embed(
        title="🛡️ فتح تذكرة جديدة",
        description="اضغط على الزر أدناه لفتح تذكرة وسيقوم فريق الدعم بالتواصل معك قريباً.",
        color=0x5865F2
    )
    config = await get_ticket_config(interaction.guild_id)
    view = TicketButton(config)
    
    panel_msg = await interaction.channel.send(embed=embed, view=view)
    await save_ticket_config(interaction.guild_id, panel_channel_id=str(interaction.channel.id), panel_message_id=str(panel_msg.id))
    
    await interaction.response.send_message(f"✅ تم إعداد نظام التذاكر بنجاح!\n- الفئة: {category.mention}\n- قناة السجلات: {log_channel.mention if log_channel else 'لم يتم تعيينها'}\n- الإغلاق التلقائي: {auto_close_hours} ساعة", ephemeral=True)

@البوت.tree.command(name="panel", description="إعادة إرسال لوحة التذاكر")
async def panel(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    config = await get_ticket_config(interaction.guild_id)
    if not config:
        await interaction.response.send_message("❌ يرجى تشغيل `/setup` أولاً!", ephemeral=True)
        return
    
    embed = discord.Embed(
        title=config["embed_title"],
        description=config["embed_description"],
        color=int(config["embed_color"], 16)
    )
    view = TicketButton(config)
    
    panel_msg = await interaction.channel.send(embed=embed, view=view)
    await save_ticket_config(interaction.guild_id, panel_channel_id=str(interaction.channel.id), panel_message_id=str(panel_msg.id))
    await interaction.response.send_message("✅ تم إرسال لوحة التذاكر!", ephemeral=True)

@البوت.tree.command(name="addadmin", description="إضافة رتبة أونر مساعد")
@app_commands.describe(role="الرتبة المراد إضافتها")
async def add_admin(interaction: discord.Interaction, role: discord.Role):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    await add_staff_role(interaction.guild_id, role.id, "admin")
    await interaction.response.send_message(f"✅ تم إضافة رتبة {role.mention} كمساعد أونر")

@البوت.tree.command(name="removeadmin", description="إزالة رتبة أونر مساعد")
@app_commands.describe(role="الرتبة المراد إزالتها")
async def remove_admin(interaction: discord.Interaction, role: discord.Role):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    await remove_staff_role(interaction.guild_id, role.id)
    await interaction.response.send_message(f"✅ تم إزالة رتبة {role.mention} من مساعدي الأونر")

@البوت.tree.command(name="addsupport", description="إضافة رتبة دعم")
@app_commands.describe(role="الرتبة المراد إضافتها")
async def add_support(interaction: discord.Interaction, role: discord.Role):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    await add_staff_role(interaction.guild_id, role.id, "support")
    await interaction.response.send_message(f"✅ تم إضافة رتبة {role.mention} كفريق دعم")

@البوت.tree.command(name="removesupport", description="إزالة رتبة دعم")
@app_commands.describe(role="الرتبة المراد إزالتها")
async def remove_support(interaction: discord.Interaction, role: discord.Role):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    await remove_staff_role(interaction.guild_id, role.id)
    await interaction.response.send_message(f"✅ تم إزالة رتبة {role.mention} من فريق الدعم")

@البوت.tree.command(name="viewstaff", description="عرض قائمة الموظفين")
async def view_staff(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    staff_roles = await get_all_staff_roles(interaction.guild_id)
    if not staff_roles:
        await interaction.response.send_message("لا يوجد موظفين مسجلين!", ephemeral=True)
        return
    
    admins = []
    supports = []
    for role_id, role_type in staff_roles:
        role = interaction.guild.get_role(int(role_id))
        if role:
            if role_type == "admin":
                admins.append(role.mention)
            else:
                supports.append(role.mention)
    
    embed = discord.Embed(title="👥 قائمة الموظفين", color=0x5865F2)
    embed.add_field(name="👑 المساعدين", value="\n".join(admins) or "لا يوجد", inline=False)
    embed.add_field(name="🛡️ فريق الدعم", value="\n".join(supports) or "لا يوجد", inline=False)
    await interaction.response.send_message(embed=embed, ephemeral=True)

@البوت.tree.command(name="blacklist", description="حظر مستخدم من استخدام التذاكر")
@app_commands.describe(user="المستخدم المراد حظره", reason="سبب الحظر")
async def blacklist_user(interaction: discord.Interaction, user: discord.User, reason: str = "لا يوجد سبب"):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    await add_to_blacklist(interaction.guild_id, user.id, reason, interaction.user.id)
    await interaction.response.send_message(f"✅ تم حظر {user.mention} من استخدام نظام التذاكر\n**السبب:** {reason}")

@البوت.tree.command(name="unblacklist", description="إلغاء حظر مستخدم من التذاكر")
@app_commands.describe(user="المستخدم المراد إلغاء حظره")
async def unblacklist_user(interaction: discord.Interaction, user: discord.User):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    await remove_from_blacklist(interaction.guild_id, user.id)
    await interaction.response.send_message(f"✅ تم إلغاء حظر {user.mention} من استخدام نظام التذاكر")

@البوت.tree.command(name="stats", description="إحصائيات نظام التذاكر")
async def stats_ticket(interaction: discord.Interaction):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        async with db.execute("SELECT COUNT(*) FROM tickets WHERE guild_id = ?", (str(interaction.guild_id),)) as cursor:
            total = (await cursor.fetchone())[0]
        
        async with db.execute("SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND status = 'open'", (str(interaction.guild_id),)) as cursor:
            open_tickets = (await cursor.fetchone())[0]
        
        async with db.execute("SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND status = 'claimed'", (str(interaction.guild_id),)) as cursor:
            claimed = (await cursor.fetchone())[0]
        
        async with db.execute("SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND status = 'closed'", (str(interaction.guild_id),)) as cursor:
            closed = (await cursor.fetchone())[0]
    
    embed = discord.Embed(title="📊 إحصائيات التذاكر", color=0x5865F2)
    embed.add_field(name="📋 إجمالي التذاكر", value=str(total), inline=True)
    embed.add_field(name="🟢 مفتوحة", value=str(open_tickets), inline=True)
    embed.add_field(name="🟡 مستلمة", value=str(claimed), inline=True)
    embed.add_field(name="🔴 مغلقة", value=str(closed), inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="add", description="إضافة مستخدم إلى التذكرة")
@app_commands.describe(user="المستخدم المراد إضافته")
async def add_user(interaction: discord.Interaction, user: discord.Member):
    if not await is_staff(interaction.user, interaction.guild_id) and str(interaction.user.id) != (await get_ticket_info(interaction.channel.id))["creator_id"]:
        await interaction.response.send_message("❌ ليس لديك صلاحية لإضافة مستخدمين!", ephemeral=True)
        return
    
    overwrite = interaction.channel.overwrites_for(user)
    overwrite.read_messages = True
    overwrite.send_messages = True
    await interaction.channel.set_permissions(user, overwrite=overwrite)
    await interaction.response.send_message(f"✅ تم إضافة {user.mention} إلى هذه التذكرة")

@البوت.tree.command(name="remove", description="إزالة مستخدم من التذكرة")
@app_commands.describe(user="المستخدم المراد إزالته")
async def remove_user(interaction: discord.Interaction, user: discord.Member):
    if not await is_staff(interaction.user, interaction.guild_id) and str(interaction.user.id) != (await get_ticket_info(interaction.channel.id))["creator_id"]:
        await interaction.response.send_message("❌ ليس لديك صلاحية لإزالة مستخدمين!", ephemeral=True)
        return
    
    await interaction.channel.set_permissions(user, overwrite=None)
    await interaction.response.send_message(f"✅ تم إزالة {user.mention} من هذه التذكرة")

@البوت.tree.command(name="rename", description="تغيير اسم التذكرة")
@app_commands.describe(new_name="الاسم الجديد للتذكرة")
async def rename_ticket(interaction: discord.Interaction, new_name: str):
    if not await is_staff(interaction.user, interaction.guild_id):
        await interaction.response.send_message("❌ ليس لديك صلاحية لتغيير اسم التذكرة!", ephemeral=True)
        return
    
    await interaction.channel.edit(name=new_name[:100])
    await interaction.response.send_message(f"✅ تم تغيير اسم التذكرة إلى: {new_name}")

@البوت.tree.command(name="reopen", description="إعادة فتح تذكرة مغلقة")
async def reopen_ticket(interaction: discord.Interaction):
    if not await is_staff(interaction.user, interaction.guild_id):
        await interaction.response.send_message("❌ ليس لديك صلاحية لإعادة فتح التذكرة!", ephemeral=True)
        return
    
    ticket_info = await get_ticket_info(interaction.channel.id)
    if not ticket_info or ticket_info["status"] != "closed":
        await interaction.response.send_message("❌ هذه التذكرة غير مغلقة أو غير موجودة!", ephemeral=True)
        return
    
    await update_ticket_status(interaction.channel.id, "reopened")
    
    overwrite = interaction.channel.overwrites_for(interaction.guild.default_role)
    overwrite.send_messages = True
    await interaction.channel.set_permissions(interaction.guild.default_role, overwrite=overwrite)
    
    if ticket_info["creator_id"]:
        creator = interaction.guild.get_member(int(ticket_info["creator_id"]))
        if creator:
            overwrite_creator = interaction.channel.overwrites_for(creator)
            overwrite_creator.send_messages = True
            await interaction.channel.set_permissions(creator, overwrite=overwrite_creator)
    
    embed = discord.Embed(title="🔄 تم إعادة فتح التذكرة", color=0x00FF00)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="claim", description="استلام تذكرة")
async def claim_ticket(interaction: discord.Interaction):
    if not await is_staff(interaction.user, interaction.guild_id):
        await interaction.response.send_message("❌ ليس لديك صلاحية لاستلام التذكرة!", ephemeral=True)
        return
    
    ticket_info = await get_ticket_info(interaction.channel.id)
    if not ticket_info:
        await interaction.response.send_message("❌ حدث خطأ في التذكرة!", ephemeral=True)
        return
    
    if ticket_info["status"] == "claimed":
        await interaction.response.send_message(f"❌ هذه التذكرة تم استلامها بالفعل بواسطة <@{ticket_info['claimer_id']}>", ephemeral=True)
        return
    
    await update_ticket_status(interaction.channel.id, "claimed", str(interaction.user.id))
    await interaction.response.send_message(f"✅ تم استلام التذكرة بواسطة {interaction.user.mention}")

@البوت.tree.command(name="unclaim", description="إلغاء استلام التذكرة")
async def unclaim_ticket(interaction: discord.Interaction):
    if not await is_staff(interaction.user, interaction.guild_id):
        await interaction.response.send_message("❌ ليس لديك صلاحية لإلغاء استلام التذكرة!", ephemeral=True)
        return
    
    ticket_info = await get_ticket_info(interaction.channel.id)
    if not ticket_info or ticket_info["status"] != "claimed" or ticket_info["claimer_id"] != str(interaction.user.id):
        await interaction.response.send_message("❌ لم تقم باستلام هذه التذكرة!", ephemeral=True)
        return
    
    await update_ticket_status(interaction.channel.id, "open")
    await interaction.response.send_message(f"✅ تم إلغاء استلام التذكرة بواسطة {interaction.user.mention}")

@البوت.tree.command(name="close", description="إغلاق التذكرة الحالية")
async def close_ticket(interaction: discord.Interaction, reason: str = None):
    if not await is_staff(interaction.user, interaction.guild_id) and str(interaction.user.id) != (await get_ticket_info(interaction.channel.id))["creator_id"]:
        await interaction.response.send_message("❌ ليس لديك صلاحية لإغلاق هذه التذكرة!", ephemeral=True)
        return
    
    ticket_info = await get_ticket_info(interaction.channel.id)
    if ticket_info["status"] == "closed":
        await interaction.response.send_message("❌ هذه التذكرة مغلقة بالفعل!", ephemeral=True)
        return
    
    await update_ticket_status(interaction.channel.id, "closed", closed_by=str(interaction.user.id), reason=reason)
    
    overwrite = interaction.channel.overwrites_for(interaction.guild.default_role)
    overwrite.send_messages = False
    await interaction.channel.set_permissions(interaction.guild.default_role, overwrite=overwrite)
    
    if ticket_info["creator_id"]:
        creator = interaction.guild.get_member(int(ticket_info["creator_id"]))
        if creator:
            overwrite_creator = interaction.channel.overwrites_for(creator)
            overwrite_creator.send_messages = False
            await interaction.channel.set_permissions(creator, overwrite=overwrite_creator)
    
    reason_text = f"\n**السبب:** {reason}" if reason else ""
    embed = discord.Embed(title="🔒 تم إغلاق التذكرة", description=f"تم الإغلاق بواسطة {interaction.user.mention}{reason_text}", color=0xFF0000)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="closerequest", description="طلب إغلاق التذكرة من فريق الدعم")
async def closerequest(interaction: discord.Interaction, reason: str = None):
    ticket_info = await get_ticket_info(interaction.channel.id)
    if not ticket_info or ticket_info["creator_id"] != str(interaction.user.id):
        await interaction.response.send_message("❌ هذه التذكرة ليست ملكك!", ephemeral=True)
        return
    
    reason_text = f"**السبب:** {reason}" if reason else ""
    embed = discord.Embed(title="🔒 طلب إغلاق", description=f"صاحب التذكرة {interaction.user.mention} يطلب إغلاق التذكرة.\n{reason_text}", color=0xFFA500)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="notes", description="عرض ملاحظات التذكرة")
async def notes_ticket(interaction: discord.Interaction):
    if not await is_staff(interaction.user, interaction.guild_id):
        await interaction.response.send_message("❌ ليس لديك صلاحية لعرض الملاحظات!", ephemeral=True)
        return
    
    await interaction.response.send_message("📝 **الملاحظات:**\n*سيتم عرض الملاحظات هنا.*", ephemeral=True)

@البوت.tree.command(name="on-call", description="عرض الموظفين المتاحين")
async def on_call(interaction: discord.Interaction):
    staff_roles = await get_all_staff_roles(interaction.guild_id)
    if not staff_roles:
        await interaction.response.send_message("لا يوجد موظفين مسجلين!", ephemeral=True)
        return
    
    staff_list = []
    for role_id, role_type in staff_roles:
        role = interaction.guild.get_role(int(role_id))
        if role:
            staff_list.append(f"{role.mention} ({role_type})")
    
    embed = discord.Embed(title="👥 قائمة الموظفين", description="\n".join(staff_list) or "لا يوجد موظفين", color=0x5865F2)
    await interaction.response.send_message(embed=embed, ephemeral=True)

@البوت.tree.command(name="open", description="فتح تذكرة جديدة")
async def open_ticket(interaction: discord.Interaction):
    config = await get_ticket_config(interaction.guild_id)
    if not config or not config["panel_channel_id"]:
        await interaction.response.send_message("❌ نظام التذاكر لم يتم إعداده بعد!", ephemeral=True)
        return
    
    panel_channel = interaction.guild.get_channel(int(config["panel_channel_id"]))
    if not panel_channel:
        await interaction.response.send_message("❌ قناة لوحة التذاكر غير موجودة!", ephemeral=True)
        return
    
    await panel_channel.send("🎫 **فتح تذكرة جديدة**\nاستخدم الزر أدناه", view=TicketButton(config))
    await interaction.response.send_message("✅ تم إرسال زر فتح التذكرة!", ephemeral=True)

@البوت.tree.command(name="switchpanel", description="تبديل لوحة التذاكر")
@app_commands.describe(channel="القناة الجديدة للوحة")
async def switchpanel(interaction: discord.Interaction, channel: discord.TextChannel):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    await save_ticket_config(interaction.guild_id, panel_channel_id=str(channel.id))
    await interaction.response.send_message(f"✅ تم تبديل لوحة التذاكر إلى {channel.mention}")

@البوت.tree.command(name="transfer", description="نقل التذكرة إلى موظف آخر")
@app_commands.describe(user="الموظف المستهدف")
async def transfer_ticket(interaction: discord.Interaction, user: discord.Member):
    if not await is_staff(interaction.user, interaction.guild_id):
        await interaction.response.send_message("❌ ليس لديك صلاحية لنقل التذكرة!", ephemeral=True)
        return
    
    if not await is_staff(user, interaction.guild_id):
        await interaction.response.send_message("❌ المستخدم المستهدف ليس موظفاً!", ephemeral=True)
        return
    
    await update_ticket_status(interaction.channel.id, "claimed", str(user.id))
    await interaction.response.send_message(f"✅ تم نقل التذكرة إلى {user.mention}")

@البوت.tree.command(name="edit", description="تعديل رسالة الإعدادات")
@app_commands.describe(title="العنوان الجديد", description="الوصف الجديد", color="اللون (Hex)")
async def edit_panel(interaction: discord.Interaction, title: str = None, description: str = None, color: str = None):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    config = await get_ticket_config(interaction.guild_id)
    if not config:
        await interaction.response.send_message("❌ لم يتم إعداد البوت بعد!", ephemeral=True)
        return
    
    new_title = title or config["embed_title"]
    new_desc = description or config["embed_description"]
    new_color = color or config["embed_color"]
    
    await save_ticket_config(interaction.guild_id, embed_title=new_title, embed_description=new_desc, embed_color=new_color)
    
    if config["panel_channel_id"] and config["panel_message_id"]:
        panel_channel = interaction.guild.get_channel(int(config["panel_channel_id"]))
        if panel_channel:
            try:
                panel_msg = await panel_channel.fetch_message(int(config["panel_message_id"]))
                embed = discord.Embed(title=new_title, description=new_desc, color=int(new_color, 16))
                await panel_msg.edit(embed=embed)
            except:
                pass
    
    await interaction.response.send_message("✅ تم تحديث رسالة الإعدادات بنجاح!")

@البوت.tree.command(name="about", description="معلومات عن البوت")
async def about(interaction: discord.Interaction):
    embed = discord.Embed(
        title="🤖 معلومات عن البوت",
        description="بوت متخصص في إدارة التذاكر لدعم السيرفرات",
        color=0x5865F2
    )
    embed.add_field(name="📦 الإصدار", value="1.0.0", inline=True)
    embed.add_field(name="👑 المطور", value=اسم_المطور, inline=True)
    embed.add_field(name="📞 التواصل", value=معرف_المطور, inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="gdpr", description="إدارة بياناتك (حذف بيانات التذاكر)")
async def gdpr(interaction: discord.Interaction):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        await db.execute("DELETE FROM tickets WHERE creator_id = ?", (str(interaction.user.id),))
        await db.commit()
    await interaction.response.send_message("✅ تم حذف جميع بيانات تذاكرك بنجاح!", ephemeral=True)

@البوت.tree.command(name="invite", description="رابط دعوة البوت")
async def invite(interaction: discord.Interaction):
    embed = discord.Embed(
        title="🔗 رابط دعوة البوت",
        description=f"[اضغط هنا لدعوة البوت](https://discord.com/oauth2/authorize?client_id={البوت.user.id}&permissions=8&scope=bot%20applications.commands)",
        color=0x5865F2
    )
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="jumptotop", description="الانتقال إلى أعلى التذكرة")
async def jumptotop(interaction: discord.Interaction):
    await interaction.response.send_message("⬆️ انتقل إلى أعلى", ephemeral=True)
    messages = [message async for message in interaction.channel.history(limit=1, oldest_first=True)]
    if messages:
        await interaction.followup.send(f"انتقل إلى [أول رسالة]({messages[0].jump_url})", ephemeral=True)

@البوت.tree.command(name="autoclose", description="إعداد الإغلاق التلقائي للتذاكر")
@app_commands.describe(enabled="تفعيل/تعطيل", hours="عدد الساعات")
async def auto_close(interaction: discord.Interaction, enabled: bool, hours: int = 24):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    await save_ticket_config(interaction.guild_id, auto_close_hours=hours if enabled else 0)
    await interaction.response.send_message(f"✅ تم {'تفعيل' if enabled else 'تعطيل'} الإغلاق التلقائي لمدة {hours} ساعة")

@البوت.tree.command(name="language", description="تغيير لغة البوت")
@app_commands.choices(lang=[
    app_commands.Choice(name="العربية", value="ar"),
    app_commands.Choice(name="English", value="en")
])
async def set_language(interaction: discord.Interaction, lang: str):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        await db.execute("INSERT OR REPLACE INTO language_settings (guild_id, language) VALUES (?, ?)", (str(interaction.guild_id), lang))
        await db.commit()
    
    await interaction.response.send_message(f"✅ تم تغيير اللغة إلى {'العربية' if lang == 'ar' else 'English'}")

@البوت.tree.command(name="managetags", description="إدارة العلامات السريعة")
@app_commands.choices(action=[
    app_commands.Choice(name="إضافة", value="add"),
    app_commands.Choice(name="حذف", value="remove"),
    app_commands.Choice(name="عرض", value="list")
])
@app_commands.describe(action="الإجراء", name="اسم العلامة", content="محتوى العلامة")
async def manage_tags(interaction: discord.Interaction, action: str, name: str = None, content: str = None):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    if action == "add":
        if not name or not content:
            await interaction.response.send_message("❌ يرجى إدخال اسم العلامة والمحتوى!", ephemeral=True)
            return
        async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
            await db.execute("INSERT OR REPLACE INTO tags (guild_id, tag_name, tag_content, created_by) VALUES (?, ?, ?, ?)", 
                            (str(interaction.guild_id), name.lower(), content, str(interaction.user.id)))
            await db.commit()
        await interaction.response.send_message(f"✅ تم إضافة العلامة `{name}`")
    
    elif action == "remove":
        if not name:
            await interaction.response.send_message("❌ يرجى إدخال اسم العلامة!", ephemeral=True)
            return
        async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
            await db.execute("DELETE FROM tags WHERE guild_id = ? AND tag_name = ?", (str(interaction.guild_id), name.lower()))
            await db.commit()
        await interaction.response.send_message(f"✅ تم حذف العلامة `{name}`")
    
    elif action == "list":
        async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
            async with db.execute("SELECT tag_name FROM tags WHERE guild_id = ?", (str(interaction.guild_id),)) as cursor:
                tags = await cursor.fetchall()
        if not tags:
            await interaction.response.send_message("لا توجد علامات محفوظة!", ephemeral=True)
            return
        tag_list = "\n".join([f"• `{tag[0]}`" for tag in tags])
        await interaction.response.send_message(f"**📋 قائمة العلامات:**\n{tag_list}", ephemeral=True)

@البوت.tree.command(name="tag", description="استخدام علامة سريعة")
@app_commands.describe(name="اسم العلامة")
async def use_tag(interaction: discord.Interaction, name: str):
    async with aiosqlite.connect(مسار_تذاكر_البيانات) as db:
        async with db.execute("SELECT tag_content FROM tags WHERE guild_id = ? AND tag_name = ?", (str(interaction.guild_id), name.lower())) as cursor:
            row = await cursor.fetchone()
    
    if not row:
        await interaction.response.send_message(f"❌ العلامة `{name}` غير موجودة!", ephemeral=True)
        return
    
    embed = discord.Embed(title=f"🏷️ {name}", description=row[0], color=0x5865F2)
    await interaction.response.send_message(embed=embed)

@البوت.event
async def on_ready():
    print(f"✅ تم تشغيل البوت بنجاح باسم: {البوت.user}")
    await تهيئة_قاعدة_البيانات()
    await init_ticket_db()
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