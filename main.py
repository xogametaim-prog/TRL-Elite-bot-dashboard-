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

# ========== تسجيل الأخطاء ==========
def log_error(msg, exc=True):
    print(f"\n❌ ERROR: {msg}")
    if exc:
        traceback.print_exc()

print("🚀 Starting bot...")

try:
    # ========== Flask ==========
    flask_app = Flask(__name__)
    @flask_app.route('/')
    def home():
        return "Bot is running!"
    def run_flask():
        flask_app.run(host='0.0.0.0', port=8080)
    
    # ========== Token ==========
    TOKEN = os.getenv("DISCORD_TOKEN")
    if TOKEN is None:
        log_error("DISCORD_TOKEN not set!", False)
        sys.exit(1)
    
    # ========== Game Settings ==========
    START_COINS, START_CREDITS, START_TEAM_HP = 1000, 0, 100
    DAILY_COINS, DAILY_CREDITS = 500, 10
    HOURLY_COINS = 100
    WORK_MIN, WORK_MAX = 50, 200
    DAY_SECONDS, HOUR_SECONDS = 86400, 3600
    MAX_TEAM_NAME = 20
    DEFAULT_PUNCH_DAMAGE = 5
    WEAPON_DAMAGE = {2: 20, 7: 40, 9: 15, 12: 25, 16: 35, 23: 30}
    
    # ========== Database ==========
    DB_PATH = "game_data.db"
    
    async def init_db():
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute('''CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, coins INTEGER DEFAULT 1000,
                credits INTEGER DEFAULT 0, last_daily INTEGER DEFAULT 0,
                last_hourly INTEGER DEFAULT 0, active_team INTEGER DEFAULT 0)''')
            await db.execute('''CREATE TABLE IF NOT EXISTS teams (
                user_id TEXT, slot INTEGER, name TEXT DEFAULT '',
                health INTEGER DEFAULT 100, PRIMARY KEY (user_id, slot))''')
            await db.execute('''CREATE TABLE IF NOT EXISTS inventory (
                user_id TEXT, item_id INTEGER, quantity INTEGER DEFAULT 0,
                PRIMARY KEY (user_id, item_id))''')
            await db.execute('''CREATE TABLE IF NOT EXISTS shop (
                item_id INTEGER PRIMARY KEY, name TEXT, coin_price INTEGER,
                credit_price INTEGER, description TEXT)''')
            cursor = await db.execute("SELECT COUNT(*) FROM shop")
            if (await cursor.fetchone())[0] == 0:
                items = [(i, f"Item {i}", i*100, i//5, f"Desc {i}") for i in range(1, 26)]
                await db.executemany("INSERT INTO shop VALUES (?,?,?,?,?)", items)
            await db.commit()
    
    async def get_user(uid):
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT coins, credits, last_daily, last_hourly, active_team FROM users WHERE user_id=?", (uid,)) as c:
                row = await c.fetchone()
                if row is None:
                    await db.execute("INSERT INTO users (user_id, coins, credits) VALUES (?,?,?)", (uid, START_COINS, START_CREDITS))
                    await db.execute("INSERT OR IGNORE INTO teams VALUES (?,0,'',?), (?,1,'',?)", (uid, START_TEAM_HP, uid, START_TEAM_HP))
                    await db.commit()
                    return {"coins": START_COINS, "credits": START_CREDITS, "last_daily": 0, "last_hourly": 0, "active_team": 0}
                return {"coins": row[0], "credits": row[1], "last_daily": row[2], "last_hourly": row[3], "active_team": row[4]}
    
    async def update_user(uid, **kwargs):
        async with aiosqlite.connect(DB_PATH) as db:
            for k, v in kwargs.items():
                await db.execute(f"UPDATE users SET {k}=? WHERE user_id=?", (v, uid))
            await db.commit()
    
    async def get_team(uid, slot, inc_health=False):
        async with aiosqlite.connect(DB_PATH) as db:
            if inc_health:
                async with db.execute("SELECT name, health FROM teams WHERE user_id=? AND slot=?", (uid, slot)) as c:
                    row = await c.fetchone()
                    return (row[0], row[1]) if row else ("", START_TEAM_HP)
            else:
                async with db.execute("SELECT name FROM teams WHERE user_id=? AND slot=?", (uid, slot)) as c:
                    row = await c.fetchone()
                    return row[0] if row else ""
    
    async def set_team(uid, slot, name):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("INSERT OR REPLACE INTO teams (user_id, slot, name, health) VALUES (?,?,?, COALESCE((SELECT health FROM teams WHERE user_id=? AND slot=?), ?))",
                             (uid, slot, name, uid, slot, START_TEAM_HP))
            await db.commit()
    
    async def update_team_health(uid, slot, hp):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("UPDATE teams SET health=? WHERE user_id=? AND slot=?", (hp, uid, slot))
            await db.commit()
    
    async def get_all_users():
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT user_id, coins FROM users") as c:
                return await c.fetchall()
    
    async def add_inventory(uid, iid, qty):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("INSERT INTO inventory VALUES (?,?,?) ON CONFLICT DO UPDATE SET quantity=quantity+?", (uid, iid, qty, qty))
            await db.commit()
    
    async def get_inventory(uid):
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT item_id, quantity FROM inventory WHERE user_id=?", (uid,)) as c:
                return await c.fetchall()
    
    async def get_shop_item(iid):
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT item_id, name, coin_price, credit_price, description FROM shop WHERE item_id=?", (iid,)) as c:
                row = await c.fetchone()
                return {"id": row[0], "name": row[1], "coinPrice": row[2], "creditPrice": row[3], "desc": row[4]} if row else None
    
    async def get_all_shop():
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT item_id, name, coin_price, credit_price, description FROM shop ORDER BY item_id") as c:
                rows = await c.fetchall()
                return [{"id": r[0], "name": r[1], "coinPrice": r[2], "creditPrice": r[3], "desc": r[4]} for r in rows]
    
    async def get_best_weapon(uid):
        inv = await get_inventory(uid)
        best = DEFAULT_PUNCH_DAMAGE
        for iid, qty in inv:
            if qty > 0 and iid in WEAPON_DAMAGE:
                best = max(best, WEAPON_DAMAGE[iid])
        return best
    
    # ========== Bot Setup ==========
    intents = discord.Intents.default()
    intents.message_content = True
    intents.members = True
    bot = commands.Bot(command_prefix="!", intents=intents)
    
    # ========== Commands ==========
    @bot.tree.command(name="رصيدي", description="عرض رصيدك")
    async def balance(interaction):
        u = await get_user(str(interaction.user.id))
        e = discord.Embed(title=f"محفظة {interaction.user.display_name}", color=0x00AE86)
        e.add_field(name="🪙 عملات", value=u["coins"], inline=True)
        e.add_field(name="💎 رصيد مميز", value=u["credits"], inline=True)
        await interaction.response.send_message(embed=e)
    
    @bot.tree.command(name="يومي", description="مكافأة يومية")
    async def daily(interaction):
        uid = str(interaction.user.id)
        u = await get_user(uid)
        now = int(time.time())
        if now - u["last_daily"] < DAY_SECONDS:
            r = DAY_SECONDS - (now - u["last_daily"])
            await interaction.response.send_message(f"⏳ انتظر {r//3600} ساعة {(r%3600)//60} دقيقة", ephemeral=True)
            return
        await update_user(uid, last_daily=now, coins=u["coins"]+DAILY_COINS, credits=u["credits"]+DAILY_CREDITS)
        await interaction.response.send_message(f"🎁 +{DAILY_COINS} عملة +{DAILY_CREDITS} رصيد")
    
    @bot.tree.command(name="ساعي", description="مكافأة كل ساعة")
    async def hourly(interaction):
        uid = str(interaction.user.id)
        u = await get_user(uid)
        now = int(time.time())
        if now - u["last_hourly"] < HOUR_SECONDS:
            r = HOUR_SECONDS - (now - u["last_hourly"])
            await interaction.response.send_message(f"⏳ انتظر {r//60} دقيقة", ephemeral=True)
            return
        await update_user(uid, last_hourly=now, coins=u["coins"]+HOURLY_COINS)
        await interaction.response.send_message(f"⏲️ +{HOURLY_COINS} عملة")
    
    @bot.tree.command(name="اعمل", description="اعمل لكسب عملات")
    async def work(interaction):
        earn = random.randint(WORK_MIN, WORK_MAX)
        uid = str(interaction.user.id)
        u = await get_user(uid)
        await update_user(uid, coins=u["coins"]+earn)
        await interaction.response.send_message(f"💼 كسبت {earn} عملة")
    
    @bot.tree.command(name="الاغنياء", description="أغنى 10 لاعبين")
    async def leaderboard(interaction):
        rows = await get_all_users()
        sorted_rows = sorted(rows, key=lambda x: x[1], reverse=True)[:10]
        if not sorted_rows:
            await interaction.response.send_message("لا يوجد مستخدمون")
            return
        desc = ""
        for i, (uid, coins) in enumerate(sorted_rows):
            u = await bot.fetch_user(int(uid))
            desc += f"{i+1}. **{u.display_name if u else 'مجهول'}** — {coins} 🪙\n"
        e = discord.Embed(title="🏆 قائمة الأغنياء", description=desc, color=0xFFD700)
        await interaction.response.send_message(embed=e)
    
    @bot.tree.command(name="المتجر", description="عرض المتجر")
    async def shop(interaction):
        items = await get_all_shop()
        e = discord.Embed(title="🛒 المتجر", color=0x3498db)
        for it in items[:12]:
            e.add_field(name=f"{it['id']}. {it['name']}", value=f"🪙 {it['coinPrice']} | 💎 {it['creditPrice']}", inline=True)
        await interaction.response.send_message(embed=e)
    
    @bot.tree.command(name="اشتري", description="شراء سلعة")
    @app_commands.choices(currency=[app_commands.Choice(name="عملات", value="coins"), app_commands.Choice(name="رصيد مميز", value="credits")])
    async def buy(interaction, item_id: int, currency: str, quantity: int = 1):
        if quantity < 1: quantity = 1
        item = await get_shop_item(item_id)
        if not item:
            await interaction.response.send_message("❌ رقم خاطئ", ephemeral=True)
            return
        uid = str(interaction.user.id)
        u = await get_user(uid)
        if currency == "coins":
            price, mult = item["coinPrice"], 1
        else:
            price, mult = item["creditPrice"], 2
        cost = price * quantity
        if currency == "coins":
            if u["coins"] < cost:
                await interaction.response.send_message(f"❌ تحتاج {cost} عملة", ephemeral=True)
                return
            await update_user(uid, coins=u["coins"]-cost)
        else:
            if u["credits"] < cost:
                await interaction.response.send_message(f"❌ تحتاج {cost} رصيد", ephemeral=True)
                return
            await update_user(uid, credits=u["credits"]-cost)
        received = quantity * mult
        await add_inventory(uid, item_id, received)
        await interaction.response.send_message(f"✅ اشتريت {received} × {item['name']}")
    
    @bot.tree.command(name="مخزني", description="عرض مخزونك")
    async def inventory(interaction):
        uid = str(interaction.user.id)
        inv = await get_inventory(uid)
        if not inv:
            await interaction.response.send_message("📦 مخزونك فارغ", ephemeral=True)
            return
        desc = ""
        for iid, qty in inv[:10]:
            it = await get_shop_item(iid)
            if it:
                desc += f"• {it['name']} x{qty}\n"
        e = discord.Embed(title=f"مخزون {interaction.user.display_name}", description=desc, color=0x2ecc71)
        await interaction.response.send_message(embed=e)
    
    @bot.tree.command(name="تعيين_فريق", description="تسمية فريقك")
    @app_commands.choices(slot=[app_commands.Choice(name="الفريق الأول", value=1), app_commands.Choice(name="الفريق الثاني", value=2)])
    async def set_team(interaction, slot: int, name: str):
        if len(name) > MAX_TEAM_NAME: name = name[:MAX_TEAM_NAME]
        await set_team(str(interaction.user.id), slot-1, name)
        await interaction.response.send_message(f"✅ تم تسمية الفريق {slot} → {name}")
    
    @bot.tree.command(name="تفعيل_فريق", description="تفعيل فريق")
    @app_commands.choices(slot=[app_commands.Choice(name="الفريق الأول", value=1), app_commands.Choice(name="الفريق الثاني", value=2)])
    async def activate_team(interaction, slot: int):
        uid = str(interaction.user.id)
        await update_user(uid, active_team=slot-1)
        await interaction.response.send_message(f"🔁 تم تفعيل الفريق {slot}")
    
    @bot.tree.command(name="فرقي", description="عرض فرقك")
    async def my_teams(interaction):
        uid = str(interaction.user.id)
        n1, h1 = await get_team(uid, 0, True)
        n2, h2 = await get_team(uid, 1, True)
        u = await get_user(uid)
        e = discord.Embed(title=f"فرق {interaction.user.display_name}", color=0x9b59b6)
        e.add_field(name="الفريق الأول", value=f"{n1 or 'غير محدد'}\n❤️ HP: {h1}", inline=False)
        e.add_field(name="الفريق الثاني", value=f"{n2 or 'غير محدد'}\n❤️ HP: {h2}", inline=False)
        e.add_field(name="الفريق النشط", value=f"الفريق {u['active_team']+1}", inline=False)
        await interaction.response.send_message(embed=e)
    
    @bot.tree.command(name="هجوم", description="مهاجمة فريق خصم")
    async def attack(interaction, target: discord.Member):
        if target.id == interaction.user.id:
            await interaction.response.send_message("❌ لا يمكنك مهاجمة نفسك", ephemeral=True)
            return
        aid = str(interaction.user.id)
        tid = str(target.id)
        ad = await get_user(aid)
        td = await get_user(tid)
        at, tt = ad["active_team"], td["active_team"]
        an, _ = await get_team(aid, at, True)
        tn, th = await get_team(tid, tt, True)
        if th <= 0:
            await interaction.response.send_message(f"❌ فريق {target.display_name} هُزم", ephemeral=True)
            return
        dmg = await get_best_weapon(aid)
        new_hp = max(0, th - dmg)
        await update_team_health(tid, tt, new_hp)
        try:
            await target.send(f"⚔️ فريقك {tn} هوجم من {interaction.user.display_name}!\n💥 ضرر: {dmg}\n❤️ HP: {new_hp}")
        except: pass
        await interaction.response.send_message(f"⚔️ هاجمت {target.display_name} وتسببت بـ {dmg} ضرر! (HP متبقي: {new_hp})")
    
    @bot.tree.command(name="help", description="عرض الأوامر")
    async def help_cmd(interaction):
        e = discord.Embed(title="🤖 الأوامر", color=0x5865F2)
        e.add_field(name="💰 الاقتصاد", value="/رصيدي, /يومي, /ساعي, /اعمل, /الاغنياء", inline=False)
        e.add_field(name="🛒 المتجر", value="/المتجر, /اشتري, /مخزني", inline=False)
        e.add_field(name="👥 الفرق", value="/تعيين_فريق, /تفعيل_فريق, /فرقي", inline=False)
        e.add_field(name="⚔️ القتال", value="/هجوم @لاعب", inline=False)
        await interaction.response.send_message(embed=e)
    
    # ========== Events ==========
    @bot.event
    async def on_ready():
        print(f"✅ Bot online: {bot.user}")
        synced = await bot.tree.sync()
        print(f"✅ Synced {len(synced)} commands")
    
    async def main():
        await init_db()
        threading.Thread(target=run_flask, daemon=True).start()
        await bot.start(TOKEN)
    
    asyncio.run(main())

except Exception as e:
    log_error(str(e))
    sys.exit(1)