# ==================== main.py (محدث) ====================
import discord
from discord.ext import commands, tasks
from discord import app_commands
import asyncio
import random
import time
import os
import sys
import traceback
import threading
from flask import Flask
from tickets import TicketButton, رتبة_التذاكر_المسموح_لها, is_authorized
from shop_data import *

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

الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True

البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

@tasks.loop(minutes=5)
async def رسائل_تلقائية():
    async with aiosqlite.connect("ticket_data.db") as db:
        cursor = await db.execute("SELECT قناة_الرسائل_التلقائية FROM اعدادات_السيرفر WHERE تم_الاعداد = 1")
        rows = await cursor.fetchall()
    
    for row in rows:
        channel_id = row[0]
        if channel_id:
            channel = البوت.get_channel(int(channel_id))
            if channel:
                رسالة = random.choice(الرسائل_التلقائية)
                await channel.send(رسالة)

@رسائل_تلقائية.before_loop
async def before_رسائل_تلقائية():
    await البوت.wait_until_ready()

@البوت.event
async def on_ready():
    print(f"✅ البوت دخل باسم: {البوت.user}")
    رسائل_تلقائية.start()
    try:
        await البوت.tree.sync()
        print(f"🔄 تم مزامنة الأوامر")
    except Exception as e:
        print(f"❌ فشل المزامنة: {e}")

@البوت.event
async def on_message(message):
    if message.author.bot:
        return
    update_message_count(str(message.author.id))
    mission_text = None
    if "اعمل" in str(message.content):
        mission_text = "اعمل"
    elif "هجوم" in str(message.content) or "attack" in str(message.content).lower():
        mission_text = "اهاجم"
    elif "سرقة" in str(message.content) or "rob" in str(message.content).lower():
        mission_text = "اسرق"
    if mission_text:
        advance_mission_progress(str(message.author.id), mission_text)
    await البوت.process_commands(message)

@البوت.event
async def on_guild_join(guild):
    embed = discord.Embed(
        title="⚙️ إعداد البوت",
        description="مرحباً! لإعداد البوت في سيرفرك، يرجى استخدام الأمر `/اعدادات` لتحديد:\n- الرتبة المسؤولة عن التذاكر\n- قناة لوحة التذاكر\n- قناة الرسائل التلقائية",
        color=0x5865F2
    )
    for channel in guild.text_channels:
        if channel.permissions_for(guild.me).send_messages:
            await channel.send(embed=embed)
            break

@البوت.tree.command(name="اعدادات", description="إعداد البوت في السيرفر")
@app_commands.describe(role="الرتبة المسؤولة عن التذاكر", panel_channel="قناة لوحة التذاكر", auto_channel="قناة الرسائل التلقائية")
async def اعدادات_البوت(interaction: discord.Interaction, role: discord.Role, panel_channel: discord.TextChannel, auto_channel: discord.TextChannel):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS اعدادات_السيرفر (
            guild_id TEXT PRIMARY KEY,
            رتبة_التذاكر TEXT,
            قناة_البانل TEXT,
            قناة_الرسائل_التلقائية TEXT,
            تم_الاعداد BOOLEAN DEFAULT 0
        )''')
        await db.execute("INSERT OR REPLACE INTO اعدادات_السيرفر (guild_id, رتبة_التذاكر, قناة_البانل, قناة_الرسائل_التلقائية, تم_الاعداد) VALUES (?, ?, ?, ?, 1)",
                        (str(interaction.guild_id), str(role.id), str(panel_channel.id), str(auto_channel.id)))
        await db.commit()
    
    global رتبة_التذاكر_المسموح_لها
    رتبة_التذاكر_المسموح_لها = role.id
    
    embed = discord.Embed(title="🛡️ نظام التذاكر", description="اضغط الزر لفتح تذكرة", color=0x5865F2)
    view = TicketButton()
    await panel_channel.send(embed=embed, view=view)
    
    await interaction.response.send_message(f"✅ تم إعداد البوت بنجاح!\nالرتبة: {role.mention}\nقناة البانل: {panel_channel.mention}\nقناة الرسائل: {auto_channel.mention}", ephemeral=True)

@البوت.tree.command(name="بنل", description="إرسال لوحة التذاكر")
async def بنل(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    embed = discord.Embed(title="🛡️ نظام التذاكر", description="اضغط الزر لفتح تذكرة", color=0x5865F2)
    view = TicketButton()
    await interaction.channel.send(embed=embed, view=view)
    await interaction.response.send_message("✅ تم إرسال لوحة التذاكر!", ephemeral=True)

@البوت.tree.command(name="تعيين_رتبة_التذاكر", description="تعيين الرتبة المسؤولة عن التذاكر")
async def تعيين_رتبة_التذاكر(interaction: discord.Interaction, role: discord.Role):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    global رتبة_التذاكر_المسموح_لها
    رتبة_التذاكر_المسموح_لها = role.id
    await interaction.response.send_message(f"✅ تم تعيين رتبة {role.mention} كرتبة مسؤولة عن التذاكر")

@البوت.tree.command(name="help", description="عرض جميع الأوامر")
async def help_cmd(interaction: discord.Interaction):
    embed = discord.Embed(title="🤖 قائمة الأوامر", color=0x5865F2)
    embed.add_field(name="💰 الاقتصاد", value="`/رصيدي` `/يومي` `/ساعي` `/اعمل` `/الاغنياء`", inline=False)
    embed.add_field(name="🛒 المتجر العادي", value="`/المتجر` `/اشتري` `/مخزني`", inline=False)
    embed.add_field(name="🔫 السوق السوداء", value="`/بلاك_ماركت` `/شراء_بلاك`", inline=False)
    embed.add_field(name="👥 الفرق", value="`/تعيين_فريق` `/تفعيل_فريق` `/فرقي` `/دخول_فريق`", inline=False)
    embed.add_field(name="⚔️ القتال", value="`/هجوم @لاعب`", inline=False)
    embed.add_field(name="💰 السرقة", value="`/سرقة @لاعب`", inline=False)
    embed.add_field(name="📋 المهام", value="`/مهامي` `/تسليم_مهمة`", inline=False)
    embed.add_field(name="🎫 التذاكر", value="`/اعدادات` `/بنل` `/تعيين_رتبة_التذاكر`", inline=False)
    embed.add_field(name="📊 الإحصائيات", value="`/brq`", inline=False)
    embed.add_field(name="🔗 روابط", value=f"[دعم السيرفر]({رابط_السيرفر})", inline=False)
    embed.set_footer(text=f"تم تطوير هذا البوت بواسطة {اسم_المطور} | {معرف_المطور}")
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="رصيدي", description="عرض رصيدك")
async def رصيدي(interaction: discord.Interaction):
    u = init_user(str(interaction.user.id))
    embed = discord.Embed(title=f"محفظة {interaction.user.display_name}", color=0x00AE86)
    embed.add_field(name="🪙 العملات", value=u["coins"], inline=True)
    embed.add_field(name="💎 الرصيد المميز", value=u["credits"], inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="يومي", description="مكافأة يومية")
async def يومي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    u = init_user(uid)
    now = int(time.time())
    if now - u["last_daily"] < ثواني_اليوم:
        remaining = ثواني_اليوم - (now - u["last_daily"])
        h = remaining // 3600
        m = (remaining % 3600) // 60
        await interaction.response.send_message(f"⏳ انتظر {h} ساعة {m} دقيقة", ephemeral=True)
        return
    update_user(uid, last_daily=now, coins=u["coins"]+مكافأة_يومية_عملات, credits=u["credits"]+مكافأة_يومية_رصيد)
    await interaction.response.send_message(f"🎁 +{مكافأة_يومية_عملات} عملة و +{مكافأة_يومية_رصيد} رصيد")

@البوت.tree.command(name="ساعي", description="مكافأة كل ساعة")
async def ساعي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    u = init_user(uid)
    now = int(time.time())
    if now - u["last_hourly"] < ثواني_الساعة:
        remaining = ثواني_الساعة - (now - u["last_hourly"])
        m = remaining // 60
        await interaction.response.send_message(f"⏳ انتظر {m} دقيقة", ephemeral=True)
        return
    update_user(uid, last_hourly=now, coins=u["coins"]+مكافأة_ساعية_عملات)
    await interaction.response.send_message(f"⏲️ +{مكافأة_ساعية_عملات} عملة")

@البوت.tree.command(name="اعمل", description="اعمل لكسب عملات")
async def اعمل(interaction: discord.Interaction):
    earn = random.randint(الحد_الأدنى_للعمل, الحد_الأقصى_للعمل)
    uid = str(interaction.user.id)
    u = init_user(uid)
    update_user(uid, coins=u["coins"]+earn)
    advance_mission_progress(uid, "اعمل")
    await interaction.response.send_message(f"💼 كسبت {earn} عملة")

@البوت.tree.command(name="الاغنياء", description="أغنى 10 لاعبين")
async def الاغنياء(interaction: discord.Interaction):
    rows = get_all_users()
    sorted_rows = sorted(rows, key=lambda x: x[1], reverse=True)[:10]
    if not sorted_rows:
        await interaction.response.send_message("لا يوجد مستخدمون بعد")
        return
    desc = ""
    for i, (uid, coins) in enumerate(sorted_rows):
        user = await البوت.fetch_user(int(uid))
        name = user.display_name if user else "مجهول"
        desc += f"{i+1}. **{name}** — {coins} 🪙\n"
    embed = discord.Embed(title="🏆 قائمة الأغنياء", description=desc, color=0xFFD700)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="المتجر", description="عرض المتجر العادي")
async def المتجر(interaction: discord.Interaction):
    embed = discord.Embed(title="🛒 المتجر العادي", color=0x3498db)
    for i in range(1, 14):
        item = المتجر_العادي[i]
        embed.add_field(name=f"{i}. {item['name']}", value=f"🪙 {item['coinPrice']} | 💎 {item['creditPrice']}", inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="مخزني", description="عرض مخزونك")
async def مخزني(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    inv = get_inventory(uid)
    if not inv:
        await interaction.response.send_message("📦 مخزونك فارغ", ephemeral=True)
        return
    desc = ""
    for item_id, qty in inv[:10]:
        item = المتجر_العادي.get(item_id) or السوق_السوداء_سلع.get(item_id)
        if item:
            desc += f"• {item['name']} x{qty}\n"
    embed = discord.Embed(title=f"مخزون {interaction.user.display_name}", description=desc, color=0x2ecc71)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="بلاك_ماركت", description="عرض السوق السوداء (50 سلعة)")
async def بلاك_ماركت(interaction: discord.Interaction):
    embed = discord.Embed(title="🔫 السوق السوداء - الصفحة 1/5", color=0xFF0000)
    for i in range(1, 11):
        item = السوق_السوداء_سلع[i]
        embed.add_field(name=f"{item['id']}. {item['name']}", value=f"🪙 {item['coinPrice']} | 💎 {item['creditPrice']}", inline=True)
    
    view = discord.ui.View()
    class BlackMarketView(discord.ui.View):
        def __init__(self, page=1):
            super().__init__(timeout=120)
            self.page = page
        
        @discord.ui.button(label="◀ السابقة", style=discord.ButtonStyle.secondary)
        async def prev(self, inter, btn):
            if self.page > 1:
                self.page -= 1
                await self.update(inter)
            else:
                await inter.response.send_message("❌ أنت في الصفحة الأولى!", ephemeral=True)
        
        @discord.ui.button(label="التالي ▶", style=discord.ButtonStyle.secondary)
        async def next(self, inter, btn):
            if self.page < 5:
                self.page += 1
                await self.update(inter)
            else:
                await inter.response.send_message("❌ أنت في الصفحة الخامسة!", ephemeral=True)
        
        async def update(self, inter):
            start = (self.page - 1) * 10 + 1
            end = min(start + 9, 50)
            embed = discord.Embed(title=f"🔫 السوق السوداء - الصفحة {self.page}/5", color=0xFF0000)
            for i in range(start, end + 1):
                item = السوق_السوداء_سلع[i]
                embed.add_field(name=f"{item['id']}. {item['name']}", value=f"🪙 {item['coinPrice']} | 💎 {item['creditPrice']}", inline=True)
            await inter.response.edit_message(embed=embed, view=self)
    
    await interaction.response.send_message(embed=embed, view=BlackMarketView())

@البوت.tree.command(name="شراء_بلاك", description="شراء سلعة من السوق السوداء")
@app_commands.choices(currency=[app_commands.Choice(name="عملات", value="coins"), app_commands.Choice(name="رصيد مميز", value="credits")])
async def شراء_بلاك(interaction: discord.Interaction, item_id: int, currency: str):
    item = السوق_السوداء_سلع.get(item_id)
    if not item:
        await interaction.response.send_message("❌ رقم سلعة خاطئ", ephemeral=True)
        return
    uid = str(interaction.user.id)
    u = init_user(uid)
    price = item["coinPrice"] if currency == "coins" else item["creditPrice"]
    if currency == "coins":
        if u["coins"] < price:
            await interaction.response.send_message(f"❌ تحتاج {price} عملة", ephemeral=True)
            return
        update_user(uid, coins=u["coins"]-price)
    else:
        if u["credits"] < price:
            await interaction.response.send_message(f"❌ تحتاج {price} رصيد", ephemeral=True)
            return
        update_user(uid, credits=u["credits"]-price)
    add_inventory(uid, item_id, 1)
    await interaction.response.send_message(f"✅ اشتريت {item['name']}")

@البوت.tree.command(name="اشتري", description="شراء سلعة من المتجر العادي")
@app_commands.choices(currency=[app_commands.Choice(name="عملات", value="coins"), app_commands.Choice(name="رصيد مميز", value="credits")])
async def اشتري(interaction: discord.Interaction, item_id: int, currency: str, quantity: int = 1):
    if quantity < 1:
        quantity = 1
    item = المتجر_العادي.get(item_id)
    if not item:
        await interaction.response.send_message("❌ رقم سلعة خاطئ", ephemeral=True)
        return
    uid = str(interaction.user.id)
    u = init_user(uid)
    if currency == "coins":
        price = item["coinPrice"]
        multiplier = 1
    else:
        price = item["creditPrice"]
        multiplier = 2
    cost = price * quantity
    if currency == "coins":
        if u["coins"] < cost:
            await interaction.response.send_message(f"❌ تحتاج {cost} عملة", ephemeral=True)
            return
        update_user(uid, coins=u["coins"]-cost)
    else:
        if u["credits"] < cost:
            await interaction.response.send_message(f"❌ تحتاج {cost} رصيد", ephemeral=True)
            return
        update_user(uid, credits=u["credits"]-cost)
    
    if item_id in [1, 5]:
        heal = 20 if item_id == 1 else 50
        total_heal = heal * quantity * multiplier
        active = u["active_team"]
        _, current_hp, _ = get_team(uid, active, True)
        if current_hp >= 200:
            await interaction.response.send_message("❌ صحة فريقك كاملة!", ephemeral=True)
            return
        new_hp = min(200, current_hp + total_heal)
        update_team_health(uid, active, new_hp)
        await interaction.response.send_message(f"❤️ تم شفاء فريقك! +{total_heal} صحة")
        advance_mission_progress(uid, "اشترِ سلاحاً")
    else:
        received = quantity * multiplier
        add_inventory(uid, item_id, received)
        await interaction.response.send_message(f"✅ اشتريت {received} × {item['name']}")
        if item_id in أضرار_الأسلحة or 1 <= item_id <= 50:
            advance_mission_progress(uid, "اشترِ سلاحاً")

@البوت.tree.command(name="تعيين_فريق", description="تسمية فريقك")
@app_commands.choices(slot=[app_commands.Choice(name="الفريق الأول", value=1), app_commands.Choice(name="الفريق الثاني", value=2)])
async def تعيين_فريق_امر(interaction: discord.Interaction, slot: int, name: str):
    if len(name) > الحد_الأقصى_لاسم_الفريق:
        name = name[:الحد_الأقصى_لاسم_الفريق]
    set_team(str(interaction.user.id), slot-1, name)
    await interaction.response.send_message(f"✅ تم تسمية الفريق {slot} → {name}")

@البوت.tree.command(name="تفعيل_فريق", description="تفعيل فريق")
@app_commands.choices(slot=[app_commands.Choice(name="الفريق الأول", value=1), app_commands.Choice(name="الفريق الثاني", value=2)])
async def تفعيل_فريق(interaction: discord.Interaction, slot: int):
    update_user(str(interaction.user.id), active_team=slot-1)
    await interaction.response.send_message(f"🔁 تم تفعيل الفريق {slot}")

@البوت.tree.command(name="فرقي", description="عرض فرقك")
async def فرقي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    n1, h1, i1 = get_team(uid, 0, True)
    n2, h2, i2 = get_team(uid, 1, True)
    u = init_user(uid)
    embed = discord.Embed(title=f"فرق {interaction.user.display_name}", color=0x9b59b6)
    embed.add_field(name="الفريق الأول", value=f"{n1 or 'غير محدد'}\n❤️ HP: {h1}\n👻 مخفي: {'نعم' if i1 > time.time() else 'لا'}", inline=False)
    embed.add_field(name="الفريق الثاني", value=f"{n2 or 'غير محدد'}\n❤️ HP: {h2}\n👻 مخفي: {'نعم' if i2 > time.time() else 'لا'}", inline=False)
    embed.add_field(name="الفريق النشط", value=f"الفريق {u['active_team']+1}", inline=False)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="دخول_فريق", description="اختيار فريق من القائمة")
async def دخول_فريق(interaction: discord.Interaction):
    teams = []
    for uid, teams_data in بيانات_الفرق.items():
        for slot, team in teams_data.items():
            if team["name"]:
                teams.append((uid, slot, team["name"]))
    if not teams:
        await interaction.response.send_message("لا توجد فرق متاحة للانضمام", ephemeral=True)
        return
    
    view = discord.ui.View()
    select = discord.ui.Select(placeholder="اختر فريقاً للانضمام...")
    for uid, slot, name in teams[:25]:
        user = await البوت.fetch_user(int(uid))
        display = user.display_name if user else "مجهول"
        select.add_option(label=name, description=f"بواسطة {display}", value=f"{uid}|{slot}")
    
    async def select_callback(inter):
        val = inter.data["values"][0]
        owner, slot = val.split("|")
        update_user(str(inter.user.id), active_team=int(slot))
        await inter.response.send_message("✅ تم الانضمام للفريق!", ephemeral=True)
    
    select.callback = select_callback
    view.add_item(select)
    await interaction.response.send_message("📋 اختر فريقاً:", view=view, ephemeral=True)

class WeaponSelect(discord.ui.Select):
    def __init__(self, attacker_id, target, weapons):
        self.attacker_id = attacker_id
        self.target = target
        self.weapons = weapons
        options = [discord.SelectOption(label=w["name"], value=str(w["id"]), description=f"💥 ضرر: {w['damage']}") for w in weapons]
        super().__init__(placeholder="اختر سلاحك...", options=options)
    
    async def callback(self, interaction: discord.Interaction):
        weapon_id = int(self.values[0])
        weapon = next((w for w in self.weapons if w["id"] == weapon_id), None)
        if not weapon:
            await interaction.response.send_message("❌ حدث خطأ!", ephemeral=True)
            return
        
        attacker = str(self.attacker_id)
        target_id = str(self.target.id)
        
        attacker_data = init_user(attacker)
        target_data = init_user(target_id)
        
        attacker_team = attacker_data["active_team"]
        target_team = target_data["active_team"]
        
        _, target_hp, target_inv = get_team(target_id, target_team, True)
        
        if target_inv > time.time():
            await interaction.response.send_message(f"❌ فريق {self.target.display_name} في حالة تخفي!", ephemeral=True)
            return
        if target_hp <= 0:
            await interaction.response.send_message(f"❌ فريق {self.target.display_name} هُزم!", ephemeral=True)
            return
        
        new_hp = max(0, target_hp - weapon["damage"])
        update_team_health(target_id, target_team, new_hp)
        advance_mission_progress(attacker, "اهاجم")
        
        embed = discord.Embed(title="⚔️ نتيجة الهجوم", color=0xFF4500)
        embed.add_field(name="المهاجم", value=f"{interaction.user.display_name}", inline=False)
        embed.add_field(name="الخصم", value=f"{self.target.display_name}", inline=False)
        embed.add_field(name="السلاح", value=weapon["name"], inline=True)
        embed.add_field(name="الضرر", value=str(weapon["damage"]), inline=True)
        embed.add_field(name="HP المتبقية", value=str(new_hp), inline=True)
        if new_hp == 0:
            embed.add_field(name="💀 النتيجة", value="تم هزيمة الفريق!", inline=False)
        
        try:
            await self.target.send(f"⚔️ تعرض فريقك للهجوم من {interaction.user.display_name} باستخدام {weapon['name']}!\n💥 الضرر: {weapon['damage']}\n❤️ HP المتبقي: {new_hp}")
        except:
            pass
        
        await interaction.response.send_message(embed=embed, ephemeral=False)

@البوت.tree.command(name="هجوم", description="مهاجمة لاعب آخر")
async def هجوم(interaction: discord.Interaction, target: discord.Member):
    if target.id == interaction.user.id:
        await interaction.response.send_message("❌ لا يمكنك مهاجمة نفسك", ephemeral=True)
        return
    
    weapons = get_available_weapons(str(interaction.user.id))
    if not weapons:
        await interaction.response.send_message("❌ لا تملك أي أسلحة للهجوم!", ephemeral=True)
        return
    
    view = discord.ui.View()
    select = WeaponSelect(interaction.user.id, target, weapons)
    view.add_item(select)
    await interaction.response.send_message("⚔️ اختر سلاحك:", view=view, ephemeral=True)

@البوت.tree.command(name="سرقة", description="سرقة أموال من لاعب")
async def سرقة(interaction: discord.Interaction, target: discord.Member):
    if target.id == interaction.user.id:
        await interaction.response.send_message("❌ لا يمكنك سرقة نفسك", ephemeral=True)
        return
    
    uid = str(interaction.user.id)
    tid = str(target.id)
    u = init_user(uid)
    t = init_user(tid)
    now = int(time.time())
    
    if now - u["last_robbery"] < مدة_السرقة:
        remaining = مدة_السرقة - (now - u["last_robbery"])
        await interaction.response.send_message(f"⏳ يمكنك السرقة بعد {remaining//60} دقيقة", ephemeral=True)
        return
    
    active_team = t["active_team"]
    _, _, target_inv = get_team(tid, active_team, True)
    if target_inv > time.time():
        await interaction.response.send_message(f"❌ فريق {target.display_name} في حالة تخفي!", ephemeral=True)
        return
    
    stolen = max(10, int(t["coins"] * نسبة_السرقة))
    update_user(tid, coins=t["coins"]-stolen)
    update_user(uid, coins=u["coins"]+stolen, last_robbery=now)
    advance_mission_progress(uid, "اسرق")
    await interaction.response.send_message(f"💰 سرقت {stolen} عملة من {target.display_name}!")

@البوت.tree.command(name="تخفي", description="إخفاء فريقك 30 دقيقة")
async def تخفي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    if not has_item(uid, 26):
        await interaction.response.send_message("❌ لا تمتلك كتاب التخفي!", ephemeral=True)
        return
    u = init_user(uid)
    until = int(time.time()) + مدة_التخفي
    update_team_invisible(uid, u["active_team"], until)
    remove_inventory(uid, 26, 1)
    advance_mission_progress(uid, "استخدم تخفي")
    await interaction.response.send_message("👻 تم إخفاء فريقك لمدة 30 دقيقة!")

@البوت.tree.command(name="مهامي", description="عرض مهامك")
async def مهامي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    mission = get_mission(uid)
    embed = discord.Embed(title="📋 مهامك", color=0xF1C40F)
    embed.add_field(name="1️⃣ " + mission["m1"], value=f"التقدم: {mission['p1']}", inline=False)
    embed.add_field(name="2️⃣ " + mission["m2"], value=f"التقدم: {mission['p2']}", inline=False)
    embed.add_field(name="3️⃣ " + mission["m3"], value=f"التقدم: {mission['p3']}", inline=False)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="تسليم_مهمة", description="تسليم مهمة مكتملة")
async def تسليم_مهمة(interaction: discord.Interaction, mission_number: int):
    if mission_number not in [1,2,3]:
        await interaction.response.send_message("❌ رقم المهمة 1 أو 2 أو 3", ephemeral=True)
        return
    uid = str(interaction.user.id)
    success, result = complete_mission(uid, mission_number)
    if not success:
        if result == "completed":
            await interaction.response.send_message("❌ هذه المهمة تم تسليمها بالفعل!", ephemeral=True)
        else:
            await interaction.response.send_message("⏳ لم تكمل المهمة بعد!", ephemeral=True)
        return
    u = init_user(uid)
    reward_coins = 300
    reward_credits = 5
    update_user(uid, coins=u["coins"]+reward_coins, credits=u["credits"]+reward_credits)
    await interaction.response.send_message(f"🎉 تم تسليم المهمة! حصلت على {reward_coins} عملة و {reward_credits} رصيد مميز")

@البوت.tree.command(name="اعطاء_فلوس", description="منح أموال للاعب (للأونر فقط)")
async def اعطاء_فلوس(interaction: discord.Interaction, user: discord.User, coins: int = 0, credits: int = 0):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    u = init_user(str(user.id))
    update_user(str(user.id), coins=u["coins"]+coins, credits=u["credits"]+credits)
    await interaction.response.send_message(f"✅ أعطيت {user.mention} {coins} عملة و {credits} رصيد")

@البوت.tree.command(name="حذف_فريق", description="حذف فريق لاعب (للأونر فقط)")
async def حذف_فريق(interaction: discord.Interaction, user: discord.User, team_number: int):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    if team_number not in [1,2]:
        await interaction.response.send_message("❌ رقم الفريق 1 أو 2", ephemeral=True)
        return
    set_team(str(user.id), team_number-1, "")
    await interaction.response.send_message(f"✅ تم حذف الفريق {team_number} لـ {user.mention}")

@البوت.tree.command(name="اذاعة", description="إرسال رسالة لجميع المستخدمين (للأونر فقط)")
async def اذاعة(interaction: discord.Interaction, message: str):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    users = get_all_users()
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
    await interaction.followup.send(f"✅ تم إرسال الإذاعة إلى {count} مستخدم")

@البوت.tree.command(name="وصف", description="معلومات عن البوت")
async def وصف(interaction: discord.Interaction):
    embed = discord.Embed(title="ℹ️ معلومات البوت", color=0x00FFFF)
    embed.add_field(name="👑 المطور", value=f"{اسم_المطور} ({معرف_المطور})", inline=True)
    embed.add_field(name="🔗 رابط الدعم", value=f"[اضغط هنا]({رابط_السيرفر})", inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="brq", description="عرض إحصائيات رسائلك")
async def brq(interaction: discord.Interaction):
    today, week, month, total = get_message_stats(str(interaction.user.id))
    embed = discord.Embed(title=f"📊 إحصائيات رسائل {interaction.user.display_name}", color=0x00FF00)
    embed.add_field(name="📅 اليوم", value=str(today), inline=True)
    embed.add_field(name="📆 الأسبوع", value=str(week), inline=True)
    embed.add_field(name="📅 الشهر", value=str(month), inline=True)
    embed.add_field(name="📊 المجموع", value=str(total), inline=True)
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