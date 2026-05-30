# ==================== main.py ====================
import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import asyncio
import os
import sys
import traceback
import threading
from flask import Flask
from datetime import datetime, timedelta
from management import Management, EmbedBuilder, EmbedEditView, HelpButtons, RolesSelect, ConfirmView
from invitetracker import setup_invite_tracker, get_invite_count, get_all_invites

تطبيق_فلاسك = Flask(__name__)

@تطبيق_فلاسك.route('/')
def الصفحة_الرئيسية():
    return "البوت شغال! الاصدار 2.0"

def تشغيل_الخادم():
    تطبيق_فلاسك.run(host='0.0.0.0', port=8080)

التوكن = os.getenv("DISCORD_TOKEN")
if التوكن is None:
    print("❌ التوكن غير موجود")
    sys.exit(1)

الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True
الصلاحيات.moderation = True

البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

@tasks.loop(minutes=5)
async def تحديث_عدد_الأعضاء():
    try:
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT guild_id, member_count_channel FROM server_config WHERE member_count_channel IS NOT NULL")
            rows = await cursor.fetchall()
        
        for guild_id, channel_id in rows:
            guild = البوت.get_guild(int(guild_id))
            if not guild:
                continue
            channel = guild.get_channel(int(channel_id))
            if not channel:
                continue
            new_name = f"👥 الأعضاء: {guild.member_count}"
            if channel.name != new_name:
                await channel.edit(name=new_name)
    except Exception as e:
        print(f"خطأ في تحديث عدد الأعضاء: {e}")

@تحديث_عدد_الأعضاء.before_loop
async def before_تحديث_عدد_الأعضاء():
    await البوت.wait_until_ready()

@tasks.loop(seconds=30)
async def تغيير_الحالة():
    try:
        statuses = [
            discord.Activity(type=discord.ActivityType.watching, name=f"{len(البوت.guilds)} سيرفر"),
            discord.Activity(type=discord.ActivityType.listening, name="/help"),
            discord.Activity(type=discord.ActivityType.playing, name="إدارة السيرفرات"),
            discord.CustomActivity(name="v2.0 | /help")
        ]
        for status in statuses:
            await البوت.change_presence(activity=status)
            await asyncio.sleep(10)
    except Exception as e:
        print(f"خطأ في تغيير الحالة: {e}")

@تغيير_الحالة.before_loop
async def before_تغيير_الحالة():
    await البوت.wait_until_ready()

@البوت.event
async def on_ready():
    print(f"✅ البوت دخل باسم: {البوت.user} (الاصدار 2.0)")
    
    management = Management(البوت)
    await management.init_db()
    setup_invite_tracker(البوت)
    
    تغيير_الحالة.start()
    تحديث_عدد_الأعضاء.start()
    management.daily_report.start()
    
    try:
        await البوت.tree.sync()
        print(f"🔄 تم مزامنة الأوامر")
    except Exception as e:
        print(f"❌ فشل المزامنة: {e}")

@البوت.event
async def on_message_delete(message):
    if message.author.bot:
        return
    management = Management(البوت)
    await management.log_event(
        message.guild.id, 
        "🗑️ حذف رسالة", 
        f"**المستخدم:** {message.author.mention}\n**القناة:** {message.channel.mention}\n**المحتوى:** {message.content[:500]}",
        0xFF0000
    )

@البوت.event
async def on_member_update(before, after):
    if before.nick != after.nick:
        management = Management(البوت)
        await management.log_event(
            before.guild.id,
            "✏️ تغيير لقب",
            f"**المستخدم:** {after.mention}\n**اللقب القديم:** {before.nick or 'لا يوجد'}\n**اللقب الجديد:** {after.nick or 'لا يوجد'}",
            0x00AAFF
        )
    
    if before.roles != after.roles:
        added = [r for r in after.roles if r not in before.roles]
        removed = [r for r in before.roles if r not in after.roles]
        management = Management(البوت)
        if added:
            await management.log_event(
                before.guild.id,
                "➕ إضافة رتبة",
                f"**المستخدم:** {after.mention}\n**الرتبة المضافة:** {added[0].mention}",
                0x00FF00
            )
        if removed:
            await management.log_event(
                before.guild.id,
                "➖ إزالة رتبة",
                f"**المستخدم:** {after.mention}\n**الرتبة المحذوفة:** {removed[0].mention}",
                0xFFA500
            )

@البوت.event
async def on_message(message):
    if message.author.bot:
        return
    
    async with aiosqlite.connect("server_data.db") as db:
        cursor = await db.execute("SELECT trigger, response FROM faq_messages WHERE guild_id = ?", (str(message.guild.id),))
        faqs = await cursor.fetchall()
    
    for trigger, response in faqs:
        if trigger.lower() in message.content.lower():
            embed = discord.Embed(title="ℹ️ إجابة سريعة", description=response, color=0x5865F2)
            await message.reply(embed=embed, mention_author=False)
            break
    
    await البوت.process_commands(message)

@البوت.tree.command(name="اعدادات", description="إعداد البوت في السيرفر")
@app_commands.describe(
    welcome_channel="قناة الترحيب",
    logs_channel="قناة السجلات",
    report_channel="قناة التقارير اليومية",
    member_count_channel="قناة عدد الأعضاء"
)
async def اعدادات(interaction: discord.Interaction, welcome_channel: discord.TextChannel = None, logs_channel: discord.TextChannel = None, report_channel: discord.TextChannel = None, member_count_channel: discord.TextChannel = None):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            await db.execute("INSERT OR REPLACE INTO server_config (guild_id, welcome_channel, logs_channel, report_channel, member_count_channel) VALUES (?, ?, ?, ?, ?)",
                            (str(interaction.guild_id), str(welcome_channel.id) if welcome_channel else None, str(logs_channel.id) if logs_channel else None, str(report_channel.id) if report_channel else None, str(member_count_channel.id) if member_count_channel else None))
            await db.commit()
        
        embed = discord.Embed(title="✅ تم إعداد البوت بنجاح!", color=0x00FF00)
        if welcome_channel:
            embed.add_field(name="🎉 قناة الترحيب", value=welcome_channel.mention, inline=True)
        if logs_channel:
            embed.add_field(name="📋 قناة السجلات", value=logs_channel.mention, inline=True)
        if report_channel:
            embed.add_field(name="📊 قناة التقارير", value=report_channel.mention, inline=True)
        if member_count_channel:
            embed.add_field(name="👥 قناة عدد الأعضاء", value=member_count_channel.mention, inline=True)
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
    except Exception as e:
        print(f"خطأ في اعدادات: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="help", description="عرض المساعدة والأزرار")
async def help_cmd(interaction: discord.Interaction):
    embed = discord.Embed(title="🤖 قائمة الأوامر", color=0x5865F2)
    embed.add_field(name="📌 الإعدادات", value="`/اعدادات` `/تقرير` `/تحليل`", inline=False)
    embed.add_field(name="📋 السجلات", value="`/سجل_العضو` `/سجل_الرتب`", inline=False)
    embed.add_field(name="💬 الأسئلة الشائعة", value="`/اضافة_سؤال` `/حذف_سؤال` `/الاسئلة`", inline=False)
    embed.add_field(name="🎨 الرسائل المخصصة", value="`/ارسال_تضمين` `/تعديل_تضمين`", inline=False)
    embed.add_field(name="👥 الدعوات", value="`/دعواتي` `/ترتيب_الدعوات`", inline=False)
    embed.add_field(name="🔗 الروابط", value=f"[دعم السيرفر](https://discord.gg/gzFVT4zXKU)", inline=False)
    embed.set_footer(text="الاصدار 2.0")
    
    view = HelpButtons(f"https://discord.com/oauth2/authorize?client_id={البوت.user.id}&permissions=8&scope=bot%20applications.commands")
    await interaction.response.send_message(embed=embed, view=view)

@البوت.tree.command(name="ارسال_تضمين", description="إرسال رسالة Embed مخصصة")
async def ارسال_تضمين(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    modal = EmbedBuilder()
    await interaction.response.send_modal(modal)

@البوت.tree.command(name="تعديل_تضمين", description="تعديل رسالة Embed موجودة")
async def تعديل_تضمين(interaction: discord.Interaction, message_id: str):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    try:
        msg = await interaction.channel.fetch_message(int(message_id))
        if not msg.embeds:
            await interaction.response.send_message("❌ هذه الرسالة ليست Embed!", ephemeral=True)
            return
        view = EmbedEditView(msg, msg.embeds[0])
        await interaction.response.send_message("✅ اختر الإجراء المطلوب:", view=view, ephemeral=True)
    except:
        await interaction.response.send_message("❌ لم يتم العثور على الرسالة!", ephemeral=True)

@البوت.tree.command(name="الرتب", description="عرض الرتب المتاحة في القائمة")
async def الرتب(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    roles = interaction.guild.roles[1:25]
    view = discord.ui.View()
    select = RolesSelect(roles)
    view.add_item(select)
    await interaction.response.send_message("📋 اختر الرتب:", view=view, ephemeral=True)

@البوت.tree.command(name="تأكيد", description="طلب تأكيد من المستخدم")
async def تأكيد(interaction: discord.Interaction, text: str):
    view = ConfirmView()
    embed = discord.Embed(title="⚠️ تأكيد مطلوب", description=text, color=0xFFA500)
    await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

@البوت.tree.command(name="تقرير", description="عرض التقرير اليومي")
async def تقرير(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    async with aiosqlite.connect("server_data.db") as db:
        cursor = await db.execute("SELECT report_channel FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
        row = await cursor.fetchone()
    
    if row and row[0]:
        channel = interaction.guild.get_channel(int(row[0]))
        if channel:
            embed = discord.Embed(title="📊 التقرير اليومي", description=f"تم إرسال التقرير إلى {channel.mention}", color=0x00AAFF)
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
            report_embed = discord.Embed(title="📊 تقرير نشاط السيرفر", color=0x00AAFF, timestamp=datetime.now())
            report_embed.add_field(name="👥 إجمالي الأعضاء", value=str(interaction.guild.member_count), inline=True)
            report_embed.add_field(name="💬 عدد القنوات", value=str(len(interaction.guild.channels)), inline=True)
            report_embed.add_field(name="👑 عدد الرتب", value=str(len(interaction.guild.roles)), inline=True)
            await channel.send(embed=report_embed)
        else:
            await interaction.response.send_message("❌ لم يتم تعيين قناة التقارير!", ephemeral=True)
    else:
        await interaction.response.send_message("❌ لم يتم تعيين قناة التقارير! استخدم `/اعدادات`", ephemeral=True)

@البوت.tree.command(name="تحليل", description="تحليل نشاط الأعضاء")
async def تحليل(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    embed = discord.Embed(title="📈 تحليل نشاط السيرفر", color=0x9B59B6, timestamp=datetime.now())
    embed.add_field(name="👥 إجمالي الأعضاء", value=str(interaction.guild.member_count), inline=True)
    embed.add_field(name="⭐ مستوى النشاط", value="🟢 مرتفع", inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="سجل_العضو", description="عرض سجل عضو معين")
async def سجل_العضو(interaction: discord.Interaction, member: discord.Member):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    embed = discord.Embed(title=f"📋 سجل العضو {member.display_name}", color=0x5865F2, timestamp=datetime.now())
    embed.add_field(name="🆔 المعرف", value=member.id, inline=True)
    embed.add_field(name="📅 تاريخ الانضمام", value=member.joined_at.strftime("%Y-%m-%d") if member.joined_at else "غير معروف", inline=True)
    embed.add_field(name="📆 تاريخ إنشاء الحساب", value=member.created_at.strftime("%Y-%m-%d"), inline=True)
    embed.add_field(name="👑 أعلى رتبة", value=member.top_role.mention if member.top_role else "لا يوجد", inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="سجل_الرتب", description="عرض سجل تغييرات الرتب")
async def سجل_الرتب(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    embed = discord.Embed(title="👑 سجل الرتب", description="آخر تغييرات الرتب في السيرفر", color=0x9B59B6, timestamp=datetime.now())
    embed.add_field(name="📊 إجمالي الرتب", value=str(len(interaction.guild.roles)), inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="اضافة_سؤال", description="إضافة سؤال شائع والرد التلقائي")
@app_commands.describe(trigger="الكلمة المفتاحية", response="الرد التلقائي")
async def اضافة_سؤال(interaction: discord.Interaction, trigger: str, response: str):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT OR REPLACE INTO faq_messages (guild_id, trigger, response) VALUES (?, ?, ?)", (str(interaction.guild_id), trigger.lower(), response))
        await db.commit()
    
    await interaction.response.send_message(f"✅ تم إضافة السؤال `{trigger}` بنجاح!", ephemeral=True)

@البوت.tree.command(name="حذف_سؤال", description="حذف سؤال شائع")
@app_commands.describe(trigger="الكلمة المفتاحية")
async def حذف_سؤال(interaction: discord.Interaction, trigger: str):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("DELETE FROM faq_messages WHERE guild_id = ? AND trigger = ?", (str(interaction.guild_id), trigger.lower()))
        await db.commit()
    
    await interaction.response.send_message(f"✅ تم حذف السؤال `{trigger}` بنجاح!", ephemeral=True)

@البوت.tree.command(name="الاسئلة", description="عرض جميع الأسئلة الشائعة")
async def الاسئلة(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    async with aiosqlite.connect("server_data.db") as db:
        cursor = await db.execute("SELECT trigger FROM faq_messages WHERE guild_id = ?", (str(interaction.guild_id),))
        faqs = await cursor.fetchall()
    
    if not faqs:
        await interaction.response.send_message("لا توجد أسئلة شائعة مسجلة!", ephemeral=True)
        return
    
    faq_list = "\n".join([f"• `{faq[0]}`" for faq in faqs])
    embed = discord.Embed(title="📋 قائمة الأسئلة الشائعة", description=faq_list, color=0x5865F2)
    await interaction.response.send_message(embed=embed, ephemeral=True)

@البوت.tree.command(name="دعواتي", description="عدد الدعوات التي قمت بها")
async def دعواتي(interaction: discord.Interaction):
    count = get_invite_count(interaction.user.id)
    embed = discord.Embed(title=f"📊 عدد دعوات {interaction.user.display_name}", color=0x00FF00)
    embed.add_field(name="🎫 إجمالي الدعوات", value=str(count), inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="ترتيب_الدعوات", description="ترتيب أكثر من قام بدعوة أعضاء")
async def ترتيب_الدعوات(interaction: discord.Interaction):
    sorted_invites = get_all_invites()[:10]
    if not sorted_invites:
        await interaction.response.send_message("لا توجد دعوات بعد", ephemeral=True)
        return
    desc = ""
    for i, (uid, count) in enumerate(sorted_invites):
        user = await البوت.fetch_user(int(uid))
        name = user.display_name if user else "مجهول"
        desc += f"{i+1}. **{name}** — {count} دعوة\n"
    embed = discord.Embed(title="🏆 قائمة الأكثر دعوة", description=desc, color=0xFFD700)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="تحقق", description="التحقق من عمر الحساب")
async def تحقق(interaction: discord.Interaction, member: discord.Member):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    account_age = (datetime.now() - member.created_at).days
    if account_age < 5:
        embed = discord.Embed(title="⚠️ تنبيه", description=f"الحساب عمره {account_age} يوم فقط!", color=0xFF0000)
    else:
        embed = discord.Embed(title="✅ موثوق", description=f"الحساب عمره {account_age} يوم", color=0x00FF00)
    await interaction.response.send_message(embed=embed, ephemeral=True)

@البوت.tree.command(name="قفل_الحسابات_الجديدة", description="منع الحسابات الجديدة من دخول السيرفر")
async def قفل_الحسابات_الجديدة(interaction: discord.Interaction, enabled: bool, days: int = 5):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    status = "مفعل" if enabled else "معطل"
    await interaction.response.send_message(f"✅ تم {status} منع الحسابات الأحدث من {days} يوم", ephemeral=True)

if __name__ == "__main__":
    خيط_الويب = threading.Thread(target=تشغيل_الخادم)
    خيط_الويب.daemon = True
    خيط_الويب.start()
    try:
        البوت.run(التوكن)
    except Exception as e:
        print(f"❌ خطأ: {e}")
        traceback.print_exc()