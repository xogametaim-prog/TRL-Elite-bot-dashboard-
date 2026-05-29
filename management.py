# ==================== management.py ====================
import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import asyncio
import time
from datetime import datetime, timedelta

class Management:
    def __init__(self, bot):
        self.bot = bot
        self.activity_data = {}
    
    async def init_db(self):
        async with aiosqlite.connect("server_data.db") as db:
            await db.execute('''CREATE TABLE IF NOT EXISTS server_config (
                guild_id TEXT PRIMARY KEY,
                welcome_channel TEXT,
                logs_channel TEXT,
                report_channel TEXT,
                member_count_channel TEXT
            )''')
            await db.execute('''CREATE TABLE IF NOT EXISTS faq_messages (
                guild_id TEXT,
                trigger TEXT,
                response TEXT,
                PRIMARY KEY (guild_id, trigger)
            )''')
            await db.commit()
    
    async def log_event(self, guild_id, event_type, details, color=0xFFA500):
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT logs_channel FROM server_config WHERE guild_id = ?", (str(guild_id),))
            row = await cursor.fetchone()
        
        if row and row[0]:
            channel = self.bot.get_channel(int(row[0]))
            if channel:
                embed = discord.Embed(title=f"📋 {event_type}", description=details, color=color, timestamp=datetime.now())
                await channel.send(embed=embed)
    
    @tasks.loop(hours=24)
    async def daily_report(self):
        await self.bot.wait_until_ready()
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT guild_id, report_channel FROM server_config WHERE report_channel IS NOT NULL")
            rows = await cursor.fetchall()
        
        for guild_id, channel_id in rows:
            guild = self.bot.get_guild(int(guild_id))
            if not guild:
                continue
            channel = guild.get_channel(int(channel_id))
            if not channel:
                continue
            
            embed = discord.Embed(title="📊 التقرير اليومي", description=f"تقرير نشاط {guild.name}", color=0x00AAFF, timestamp=datetime.now())
            embed.add_field(name="👥 إجمالي الأعضاء", value=str(guild.member_count), inline=True)
            embed.add_field(name="📅 التاريخ", value=datetime.now().strftime("%Y-%m-%d"), inline=True)
            await channel.send(embed=embed)
    
    @daily_report.before_loop
    async def before_daily_report(self):
        await self.bot.wait_until_ready()

class EmbedBuilder(discord.ui.Modal, title="إنشاء رسالة Embed"):
    title = discord.ui.TextInput(label="العنوان", placeholder="أدخل عنوان الرسالة...", required=True, max_length=256)
    description = discord.ui.TextInput(label="الوصف", placeholder="أدخل نص الرسالة...", style=discord.TextStyle.paragraph, required=True, max_length=4000)
    color = discord.ui.TextInput(label="اللون (Hex)", placeholder="مثال: 5865F2", required=False, default="5865F2", max_length=6)
    footer = discord.ui.TextInput(label="تذييل (اختياري)", placeholder="نص التذييل", required=False, max_length=2048)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            color_int = int(self.color.value, 16)
        except:
            color_int = 0x5865F2
        embed = discord.Embed(title=self.title.value, description=self.description.value, color=color_int)
        if self.footer.value:
            embed.set_footer(text=self.footer.value)
        await interaction.response.send_message(embed=embed)

class EmbedEditView(discord.ui.View):
    def __init__(self, message, original_embed):
        super().__init__(timeout=60)
        self.message = message
        self.original_embed = original_embed
    
    @discord.ui.button(label="✏️ تعديل", style=discord.ButtonStyle.primary, emoji="✏️")
    async def edit_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EditEmbedModal(self.message, self.original_embed)
        await interaction.response.send_modal(modal)
    
    @discord.ui.button(label="🗑️ حذف", style=discord.ButtonStyle.danger, emoji="🗑️")
    async def delete_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.message.delete()
        await interaction.response.send_message("✅ تم حذف الرسالة", ephemeral=True)
    
    @discord.ui.button(label="📋 نسخ", style=discord.ButtonStyle.secondary, emoji="📋")
    async def copy_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(f"```json\n{self.original_embed.to_dict()}\n```", ephemeral=True)

class EditEmbedModal(discord.ui.Modal, title="تعديل الرسالة"):
    title = discord.ui.TextInput(label="العنوان", required=False)
    description = discord.ui.TextInput(label="الوصف", style=discord.TextStyle.paragraph, required=False)
    color = discord.ui.TextInput(label="اللون (Hex)", required=False)
    footer = discord.ui.TextInput(label="تذييل", required=False)
    
    def __init__(self, message, original_embed):
        super().__init__()
        self.message = message
        self.original_embed = original_embed
        self.title.default = original_embed.title or ""
        self.description.default = original_embed.description or ""
        self.color.default = hex(original_embed.color.value)[2:] if original_embed.color else "5865F2"
        self.footer.default = original_embed.footer.text if original_embed.footer else ""
    
    async def on_submit(self, interaction: discord.Interaction):
        new_title = self.title.value or self.original_embed.title
        new_desc = self.description.value or self.original_embed.description
        try:
            color_int = int(self.color.value, 16) if self.color.value else self.original_embed.color.value
        except:
            color_int = self.original_embed.color.value or 0x5865F2
        new_embed = discord.Embed(title=new_title, description=new_desc, color=color_int)
        if self.footer.value:
            new_embed.set_footer(text=self.footer.value)
        await self.message.edit(embed=new_embed)
        await interaction.response.send_message("✅ تم تعديل الرسالة", ephemeral=True)

class HelpButtons(discord.ui.View):
    def __init__(self, invite_link):
        super().__init__(timeout=None)
        self.invite_link = invite_link
    
    @discord.ui.button(label="📊 الإحصائيات", style=discord.ButtonStyle.primary, emoji="📊")
    async def stats_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        embed = discord.Embed(title="📊 إحصائيات البوت", color=0x5865F2)
        embed.add_field(name="📦 الإصدار", value="2.0", inline=True)
        embed.add_field(name="👑 المطور", value="taim", inline=True)
        embed.add_field(name="📞 التواصل", value="ta_im1@", inline=True)
        await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @discord.ui.button(label="🔗 دعوة البوت", style=discord.ButtonStyle.success, emoji="🔗")
    async def invite_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        embed = discord.Embed(title="🔗 رابط دعوة البوت", description=f"[اضغط هنا لدعوة البوت]({self.invite_link})", color=0x5865F2)
        await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @discord.ui.button(label="ℹ️ معلومات", style=discord.ButtonStyle.secondary, emoji="ℹ️")
    async def about_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        embed = discord.Embed(title="ℹ️ معلومات البوت", description="بوت إدارة سيرفر متكامل", color=0x5865F2)
        embed.add_field(name="🛠️ الميزات", value="• سجل إداري\n• تقارير يومية\n• تحليل نشاط\n• ردود تلقائية\n• تحديث عدد الأعضاء\n• رسائل Embed مخصصة\n• تتبع الدعوات", inline=False)
        await interaction.response.send_message(embed=embed, ephemeral=True)

class ConfirmView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=30)
        self.value = None
    
    @discord.ui.button(label="✅ تأكيد", style=discord.ButtonStyle.success, emoji="✅")
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.value = True
        self.stop()
        await interaction.response.send_message("✅ تم التأكيد", ephemeral=True)
    
    @discord.ui.button(label="❌ إلغاء", style=discord.ButtonStyle.danger, emoji="❌")
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.value = False
        self.stop()
        await interaction.response.send_message("❌ تم الإلغاء", ephemeral=True)

class RolesSelect(discord.ui.Select):
    def __init__(self, roles):
        options = []
        for role in roles[:25]:
            options.append(discord.SelectOption(label=role.name[:100], value=str(role.id)))
        super().__init__(placeholder="📋 اختر الرتب...", options=options, min_values=1, max_values=len(options))
    
    async def callback(self, interaction: discord.Interaction):
        selected_roles = [interaction.guild.get_role(int(val)) for val in self.values]
        roles_text = "\n".join([f"• {role.mention}" for role in selected_roles if role])
        embed = discord.Embed(title="👑 الرتب المختارة", description=roles_text or "لا توجد رتب", color=0x00FF00)
        await interaction.response.send_message(embed=embed, ephemeral=True)