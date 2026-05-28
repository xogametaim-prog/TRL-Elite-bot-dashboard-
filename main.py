import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
import asyncio
import random
import time
import os
import sys
import threading
from flask import Flask

# ========== Flask server for Render ==========
app = Flask(__name__)

@app.route('/')
def home():
    return "Bot is running!"

def run_flask():
    app.run(host='0.0.0.0', port=8080)

# ========== Token from environment ==========
TOKEN = os.getenv("DISCORD_TOKEN")
if TOKEN is None:
    print("❌ DISCORD_TOKEN environment variable not set.")
    sys.exit(1)

# ========== Game settings ==========
START_COINS = 1000
START_CREDITS = 0
DAILY_COINS = 500
DAILY_CREDITS = 10
HOURLY_COINS = 100
WORK_MIN = 50
WORK_MAX = 200
MAX_TEAM_NAME = 20
DAY_SECONDS = 86400
HOUR_SECONDS = 3600

# Base HP for each team
START_TEAM_HP = 100

# Weapon mapping: item_id -> damage
WEAPON_DAMAGE = {
    2: 20,   # Iron Sword
    7: 40,   # Dragon Fang
    9: 15,   # Lightning Boots (attack boost)
    12: 25,  # Elven Bow
    16: 35,  # Wolf Companion
    23: 30,  # Fire Staff
}
DEFAULT_PUNCH_DAMAGE = 5

# ========== Database ==========
DB_PATH = "game_data.db"

def run_sync(func, *args, **kwargs):
    return asyncio.to_thread(func, *args, **kwargs)

def init_db_sync():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        coins INTEGER DEFAULT 1000,
        credits INTEGER DEFAULT 0,
        last_daily INTEGER DEFAULT 0,
        last_hourly INTEGER DEFAULT 0,
        active_team INTEGER DEFAULT 0
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS teams (
        user_id TEXT,
        slot INTEGER,
        name TEXT DEFAULT '',
        health INTEGER DEFAULT ?,
        PRIMARY KEY (user_id, slot)
    )''', (START_TEAM_HP,))
    c.execute('''CREATE TABLE IF NOT EXISTS inventory (
        user_id TEXT,
        item_id INTEGER,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, item_id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS shop (
        item_id INTEGER PRIMARY KEY,
        name TEXT,
        coin_price INTEGER,
        credit_price INTEGER,
        description TEXT
    )''')
    c.execute("SELECT COUNT(*) FROM shop")
    if c.fetchone()[0] == 0:
        items = [
            (1, "🍎 Magic Apple", 100, 5, "Restores 20 HP (healing)"),
            (2, "🗡️ Iron Sword", 250, 10, "+10 Attack damage"),
            (3, "🛡️ Steel Shield", 200, 8, "+8 Defense (reduces damage)"),
            (4, "💎 Ruby", 500, 20, "Precious gem (no combat)"),
            (5, "🧪 Healing Potion", 80, 3, "Heals 50 HP (consumable)"),
            (6, "📜 Ancient Scroll", 300, 12, "Teaches new skill"),
            (7, "🐉 Dragon Fang", 1000, 40, "40 damage weapon"),
            (8, "👑 Crown of Kings", 2000, 80, "Royal authority"),
            (9, "⚡ Lightning Boots", 400, 15, "+15 damage"),
            (10, "🔮 Crystal Ball", 350, 14, "Reveals secrets"),
            (11, "🧥 Cloak of Shadows", 450, 18, "Invisibility"),
            (12, "🏹 Elven Bow", 600, 25, "25 damage ranged"),
            (13, "🍄 Golden Mushroom", 150, 6, "Random effect"),
            (14, "🧙 Wizard's Hat", 700, 28, "+15 Magic"),
            (15, "⛏️ Dwarven Pickaxe", 500, 20, "Mining"),
            (16, "🐺 Wolf Companion", 1200, 50, "35 damage companion"),
            (17, "🕯️ Candle of Truth", 180, 7, "Reveals lies"),
            (18, "🧩 Mysterious Key", 250, 10, "Opens secret doors"),
            (19, "💀 Necronomicon", 1500, 60, "Summons"),
            (20, "🧪 Elixir of Life", 3000, 120, "Extends life"),
            (21, "🎣 Fishing Rod", 200, 8, "Catches rare fish"),
            (22, "🏔️ Frost Armor", 800, 32, "Cold resistance"),
            (23, "🔥 Fire Staff", 900, 36, "30 damage fireballs"),
            (24, "🌀 Wind Talisman", 550, 22, "Wind control"),
            (25, "🌟 Star Fragment", 400, 16, "Makes wishes")
        ]
        c.executemany("INSERT INTO shop VALUES (?,?,?,?,?)", items)
    conn.commit()
    conn.close()

async def init_db():
    await run_sync(init_db_sync)

async def get_user(user_id):
    def _get():
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT coins, credits, last_daily, last_hourly, active_team FROM users WHERE user_id = ?", (user_id,))
        row = c.fetchone()
        if row is None:
            c.execute("INSERT INTO users (user_id, coins, credits) VALUES (?, ?, ?)", (user_id, START_COINS, START_CREDITS))
            c.execute("INSERT OR IGNORE INTO teams (user_id, slot, health) VALUES (?,0,?), (?,1,?)", (user_id, START_TEAM_HP, user_id, START_TEAM_HP))
            conn.commit()
            return {"coins": START_COINS, "credits": START_CREDITS, "last_daily": 0, "last_hourly": 0, "active_team": 0}
        return {"coins": row[0], "credits": row[1], "last_daily": row[2], "last_hourly": row[3], "active_team": row[4]}
    return await run_sync(_get)

async def update_user(user_id, **kwargs):
    def _update():
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        for key, val in kwargs.items():
            c.execute(f"UPDATE users SET {key} = ? WHERE user_id = ?", (val, user_id))
        conn.commit()
        conn.close()
    await run_sync(_update)

async def get_team(user_id, slot, include_health=False):
    def _get():
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        if include_health:
            c.execute("SELECT name, health FROM teams WHERE user_id = ? AND slot = ?", (user_id, slot))
            row = c.fetchone()
            conn.close()
            return (row[0], row[1]) if row else ("", START_TEAM_HP)
        else:
            c.execute("SELECT name FROM teams WHERE user_id = ? AND slot = ?", (user_id, slot))
            row = c.fetchone()
            conn.close()
            return row[0] if row else ""
    return await run_sync(_get)

async def set_team(user_id, slot, name):
    def _set():
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO teams (user_id, slot, name, health) VALUES (?, ?, ?, COALESCE((SELECT health FROM teams WHERE user_id=? AND slot=?), ?))",
                  (user_id, slot, name, user_id, slot, START_TEAM_HP))
        conn.commit()
        conn.close()
    await run_sync(_set)

async def update_team_health(user_id, slot, new_health):
    def _update():
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("UPDATE teams SET health = ? WHERE user_id = ? AND slot = ?", (new_health, user_id, slot))
        conn.commit()
        conn.close()
    await run_sync(_update)

async def get_all_users():
    def _get():
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT user_id, coins FROM users")
        rows = c.fetchall()
        conn.close()
        return rows
    return await run_sync(_get)

async def add_inventory(user_id, item_id, qty):
    def _add():
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + ?",
                  (user_id, item_id, qty, qty))
        conn.commit()
        conn.close()
    await run_sync(_add)

async def get_inventory(user_id):
    def _get():
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT item_id, quantity FROM inventory WHERE user_id = ?", (user_id,))
        rows = c.fetchall()
        conn.close()
        return rows
    return await run_sync(_get)

async def get_shop_item(item_id):
    def _get():
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT item_id, name, coin_price, credit_price, description FROM shop WHERE item_id = ?", (item_id,))
        row = c.fetchone()
        conn.close()
        if row:
            return {"id": row[0], "name": row[1], "coinPrice": row[2], "creditPrice": row[3], "desc": row[4]}
        return None
    return await run_sync(_get)

async def get_all_shop():
    def _get():
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT item_id, name, coin_price, credit_price, description FROM shop ORDER BY item_id")
        rows = c.fetchall()
        conn.close()
        return [{"id": r[0], "name": r[1], "coinPrice": r[2], "creditPrice": r[3], "desc": r[4]} for r in rows]
    return await run_sync(_get)

# ========== Helper: get best weapon damage for user ==========
async def get_best_weapon_damage(user_id):
    inv = await get_inventory(user_id)
    best = DEFAULT_PUNCH_DAMAGE
    for item_id, qty in inv:
        if qty > 0 and item_id in WEAPON_DAMAGE:
            best = max(best, WEAPON_DAMAGE[item_id])
    return best

# ========== Bot setup ==========
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

# ========== Commands ==========
@bot.tree.command(name="help", description="Show all bot commands")
async def help_command(interaction: discord.Interaction):
    embed = discord.Embed(title="🤖 Bot Commands", color=0x5865F2)
    embed.add_field(name="📊 Economy", value="`/balance`, `/daily`, `/hourly`, `/work`, `/leaderboard`", inline=False)
    embed.add_field(name="🛒 Shop", value="`/shop`, `/buy`, `/inventory`", inline=False)
    embed.add_field(name="👥 Teams", value="`/setteam`, `/activeteam`, `/myteam`", inline=False)
    embed.add_field(name="⚔️ Combat", value="`/attack @user` - Attack another player's active team", inline=False)
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="balance", description="Show your coins and credits")
async def balance(interaction: discord.Interaction):
    user = await get_user(str(interaction.user.id))
    embed = discord.Embed(title=f"{interaction.user.display_name}'s Wallet", color=0x00AE86)
    embed.add_field(name="🪙 Coins", value=user["coins"], inline=True)
    embed.add_field(name="💎 Credits", value=user["credits"], inline=True)
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="daily", description="Daily reward")
async def daily(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    user = await get_user(uid)
    now = int(time.time())
    if now - user["last_daily"] < DAY_SECONDS:
        remaining = DAY_SECONDS - (now - user["last_daily"])
        h = remaining // 3600
        m = (remaining % 3600) // 60
        await interaction.response.send_message(f"⏳ Already claimed. Try in {h}h {m}m.", ephemeral=True)
        return
    await update_user(uid, last_daily=now, coins=user["coins"]+DAILY_COINS, credits=user["credits"]+DAILY_CREDITS)
    await interaction.response.send_message(f"🎁 +{DAILY_COINS} coins, +{DAILY_CREDITS} credits")

@bot.tree.command(name="hourly", description="Hourly reward")
async def hourly(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    user = await get_user(uid)
    now = int(time.time())
    if now - user["last_hourly"] < HOUR_SECONDS:
        remaining = HOUR_SECONDS - (now - user["last_hourly"])
        m = remaining // 60
        await interaction.response.send_message(f"⏳ Try again in {m} minutes.", ephemeral=True)
        return
    await update_user(uid, last_hourly=now, coins=user["coins"]+HOURLY_COINS)
    await interaction.response.send_message(f"⏲️ +{HOURLY_COINS} coins")

@bot.tree.command(name="work", description="Work for coins")
async def work(interaction: discord.Interaction):
    earn = random.randint(WORK_MIN, WORK_MAX)
    uid = str(interaction.user.id)
    user = await get_user(uid)
    await update_user(uid, coins=user["coins"]+earn)
    await interaction.response.send_message(f"💼 You earned {earn} coins")

@bot.tree.command(name="leaderboard", description="Top 10 richest players")
async def leaderboard(interaction: discord.Interaction):
    rows = await get_all_users()
    sorted_rows = sorted(rows, key=lambda x: x[1], reverse=True)[:10]
    if not sorted_rows:
        await interaction.response.send_message("No users yet.")
        return
    desc = ""
    for i, (uid, coins) in enumerate(sorted_rows):
        user = await bot.fetch_user(int(uid))
        name = user.display_name if user else "Unknown"
        desc += f"{i+1}. **{name}** — {coins} 🪙\n"
    embed = discord.Embed(title="🏆 Leaderboard", description=desc, color=0xFFD700)
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="shop", description="View shop")
async def shop(interaction: discord.Interaction):
    items = await get_all_shop()
    embed = discord.Embed(title="🛒 Shop", description="Use `/buy [id] [coins/credits] [qty]`", color=0x3498db)
    for item in items[:10]:
        embed.add_field(name=f"{item['id']}. {item['name']}", value=f"🪙 {item['coinPrice']} | 💎 {item['creditPrice']}", inline=True)
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="buy", description="Buy an item")
@app_commands.choices(currency=[
    app_commands.Choice(name="Coins", value="coins"),
    app_commands.Choice(name="Credits", value="credits")
])
async def buy(interaction: discord.Interaction, item_id: int, currency: str, quantity: int = 1):
    if quantity < 1:
        quantity = 1
    item = await get_shop_item(item_id)
    if not item:
        await interaction.response.send_message("❌ Invalid item ID.", ephemeral=True)
        return
    uid = str(interaction.user.id)
    user = await get_user(uid)
    if currency == "coins":
        price = item["coinPrice"]
        multiplier = 1
    else:
        price = item["creditPrice"]
        multiplier = 2
    cost = price * quantity
    if currency == "coins":
        if user["coins"] < cost:
            await interaction.response.send_message(f"❌ Need {cost} coins.", ephemeral=True)
            return
        await update_user(uid, coins=user["coins"] - cost)
    else:
        if user["credits"] < cost:
            await interaction.response.send_message(f"❌ Need {cost} credits.", ephemeral=True)
            return
        await update_user(uid, credits=user["credits"] - cost)
    received = quantity * multiplier
    await add_inventory(uid, item_id, received)
    await interaction.response.send_message(f"✅ Bought {received} × {item['name']}")

@bot.tree.command(name="inventory", description="View your items")
async def inventory(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    inv = await get_inventory(uid)
    if not inv:
        await interaction.response.send_message("📦 Inventory empty.", ephemeral=True)
        return
    desc = ""
    for item_id, qty in inv[:10]:
        item = await get_shop_item(item_id)
        if item:
            desc += f"• {item['name']} x{qty}\n"
    embed = discord.Embed(title=f"{interaction.user.display_name}'s Inventory", description=desc, color=0x2ecc71)
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="setteam", description="Name your team")
@app_commands.choices(slot=[
    app_commands.Choice(name="Team 1", value=1),
    app_commands.Choice(name="Team 2", value=2)
])
async def set_team_cmd(interaction: discord.Interaction, slot: int, name: str):
    if len(name) > MAX_TEAM_NAME:
        name = name[:MAX_TEAM_NAME]
    uid = str(interaction.user.id)
    await set_team(uid, slot-1, name)
    await interaction.response.send_message(f"✅ Team {slot} renamed to **{name}**")

@bot.tree.command(name="activeteam", description="Activate a team")
@app_commands.choices(slot=[
    app_commands.Choice(name="Team 1", value=1),
    app_commands.Choice(name="Team 2", value=2)
])
async def activate_team_cmd(interaction: discord.Interaction, slot: int):
    uid = str(interaction.user.id)
    await update_user(uid, active_team=slot-1)
    team_name = await get_team(uid, slot-1) or "Unnamed"
    await interaction.response.send_message(f"🔁 Activated Team {slot} ({team_name})")

@bot.tree.command(name="myteam", description="Show your teams")
async def my_teams_cmd(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    t1_name, t1_hp = await get_team(uid, 0, include_health=True)
    t2_name, t2_hp = await get_team(uid, 1, include_health=True)
    user = await get_user(uid)
    embed = discord.Embed(title=f"{interaction.user.display_name}'s Teams", color=0x9b59b6)
    embed.add_field(name="Team 1", value=f"Name: {t1_name or 'Not set'}\n❤️ HP: {t1_hp}", inline=False)
    embed.add_field(name="Team 2", value=f"Name: {t2_name or 'Not set'}\n❤️ HP: {t2_hp}", inline=False)
    embed.add_field(name="Active", value=f"Team {user['active_team']+1}", inline=False)
    await interaction.response.send_message(embed=embed)

# ========== Attack System ==========
@bot.tree.command(name="attack", description="Attack another player's active team")
async def attack(interaction: discord.Interaction, target: discord.Member):
    attacker_id = str(interaction.user.id)
    target_id = str(target.id)

    if attacker_id == target_id:
        await interaction.response.send_message("❌ You cannot attack yourself.", ephemeral=True)
        return

    # Get attacker's active team
    attacker_data = await get_user(attacker_id)
    attacker_slot = attacker_data["active_team"]
    attacker_team_name, attacker_team_hp = await get_team(attacker_id, attacker_slot, include_health=True)

    # Get target's active team
    target_data = await get_user(target_id)
    target_slot = target_data["active_team"]
    target_team_name, target_team_hp = await get_team(target_id, target_slot, include_health=True)

    if target_team_hp <= 0:
        await interaction.response.send_message(f"❌ {target.display_name}'s team has already been defeated!", ephemeral=True)
        return

    # Calculate damage based on attacker's weapons
    damage = await get_best_weapon_damage(attacker_id)
    new_hp = max(0, target_team_hp - damage)

    # Update target's team health
    await update_team_health(target_id, target_slot, new_hp)

    # Send notification to target (DM)
    try:
        await target.send(f"⚔️ **Your team `{target_team_name}` was attacked by {interaction.user.display_name}!**\n💥 Damage: {damage}\n❤️ HP left: {new_hp}")
    except:
        pass

    # Response
    embed = discord.Embed(title="⚔️ Attack Result", color=0xFF4500)
    embed.add_field(name="Attacker", value=f"{interaction.user.display_name} (Team: {attacker_team_name})", inline=False)
    embed.add_field(name="Target", value=f"{target.display_name} (Team: {target_team_name})", inline=False)
    embed.add_field(name="Damage Dealt", value=str(damage), inline=True)
    embed.add_field(name="Remaining HP", value=str(new_hp), inline=True)
    if new_hp == 0:
        embed.add_field(name="💀 Result", value="Team has been defeated!", inline=False)
    await interaction.response.send_message(embed=embed)

# ========== Bot startup with Flask thread ==========
@bot.event
async def on_ready():
    print(f"✅ Bot online as {bot.user}")
    await bot.tree.sync()
    print("✅ Commands synced")

async def main():
    print("🚀 Starting bot...")
    await init_db()
    print("✅ Database ready")

    # Start Flask in a background thread
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    print("✅ Flask web server started on port 8080")

    await bot.start(TOKEN)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except discord.LoginFailure:
        print("❌ Invalid token. Check DISCORD_TOKEN")
    except KeyboardInterrupt:
        print("⏹️ Bot stopped")
    except Exception as e:
        print(f"❌ Error: {e}")