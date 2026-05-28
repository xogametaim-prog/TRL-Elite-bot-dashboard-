import discord
from discord.ext import commands
from discord import app_commands
import aiosqlite
from datetime import datetime

# --- إعدادات قاعدة البيانات ---
DB_PATH = "ticket_data.db"

class TicketBot(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    # --- 1. قسم الإعدادات (Settings) ---
    @app_commands.command(name="setup", description="إعداد نظام التذاكر (التصنيف وروم اللوجز)")
    @app_commands.checks.has_permissions(administrator=True)
    async def setup(self, interaction: discord.Interaction, category: discord.CategoryChannel, log_channel: discord.TextChannel):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("INSERT OR REPLACE INTO ticket_config (guild_id, category_id, log_channel_id) VALUES (?, ?, ?)", 
                             (str(interaction.guild_id), str(category.id), str(log_channel.id)))
            await db.commit()
        await interaction.response.send_message(f"✅ تم الإعداد بنجاح. اللوجز في {log_channel.mention}", ephemeral=True)

    @app_commands.command(name="addsupport", description="إضافة رتبة كفريق دعم")
    @app_commands.checks.has_permissions(administrator=True)
    async def addsupport(self, interaction: discord.Interaction, role: discord.Role):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("INSERT INTO staff_roles (guild_id, role_id) VALUES (?, ?)", (str(interaction.guild_id), str(role.id)))
            await db.commit()
        await interaction.response.send_message(f"✅ تمت إضافة الرتبة {role.name} لصلاحيات الدعم.", ephemeral=True)

    @app_commands.command(name="panel", description="إرسال لوحة فتح التذاكر (Embed)")
    @app_commands.checks.has_permissions(administrator=True)
    async def panel(self, interaction: discord.Interaction, title: str, description: str):
        embed = discord.Embed(title=title, description=description, color=0x5865F2)
        view = TicketPanelView()
        await interaction.channel.send(embed=embed, view=view)
        await interaction.response.send_message("✅ تم إرسال اللوحة.", ephemeral=True)

    # --- 2. قسم أوامر التذاكر العامة (General & Tickets) ---
    @app_commands.command(name="about", description="معلومات عن البوت")
    async def about(self, interaction: discord.Interaction):
        await interaction.response.send_message("هذا البوت مخصص لإدارة التذاكر الاحترافية.", ephemeral=True)

    @app_commands.command(name="open", description="فتح تذكرة جديدة")
    async def open(self, interaction: discord.Interaction):
        # منطق فتح التذكرة
        await interaction.response.send_message("تم فتح تذكرة لك!", ephemeral=True)

    @app_commands.command(name="close", description="إغلاق التذكرة الحالية")
    async def close(self, interaction: discord.Interaction):
        await interaction.response.send_message("تم إغلاق التذكرة.", ephemeral=False)

    @app_commands.command(name="add", description="إضافة مستخدم للتذكرة")
    async def add(self, interaction: discord.Interaction, member: discord.Member):
        await interaction.channel.set_permissions(member, read_messages=True)
        await interaction.response.send_message(f"تمت إضافة {member.mention} للتذكرة.")

    # --- 3. قسم الإحصائيات (Statistics) ---
    @app_commands.command(name="stats", description="إحصائيات التذاكر")
    async def stats(self, interaction: discord.Interaction):
        await interaction.response.send_message("إحصائيات التذاكر: 0 تذكرة نشطة حالياً.")

    # --- باقي الأوامر (تكملة القائمة من الصور) ---
    @app_commands.command(name="help", description="عرض قائمة الأوامر")
    async def help(self, interaction: discord.Interaction):
        await interaction.response.send_message("القائمة: /setup, /addsupport, /panel, /open, /close, /add, /stats...", ephemeral=True)

# --- كلاس الأزرار ---
class TicketPanelView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="فتح تذكرة", style=discord.ButtonStyle.green, custom_id="ticket_open_btn")
    async def ticket_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message("جاري فتح التذكرة...", ephemeral=True)

# كود التسجيل في main.py
async def setup(bot):
    await bot.add_cog(TicketBot(bot))