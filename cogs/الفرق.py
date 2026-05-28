import discord
from discord.ext import commands
from discord import app_commands
from database import احصل_على_مستخدم, تحديث_مستخدم, احصل_على_فريق, تعيين_فريق
from config import الحد_الأقصى_لاسم_الفريق

class الفرق(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="تعيين_فريق", description="تعيين اسم لأحد فريقيك")
    @app_commands.describe(الرقم="رقم الفريق (1 أو 2)", الاسم="الاسم الجديد للفريق (حد أقصى 20 حرف)")
    @app_commands.choices(الرقم=[
        app_commands.Choice(name="الفريق الأول", value=1),
        app_commands.Choice(name="الفريق الثاني", value=2)
    ])
    async def تعيين_فريق(self, interaction: discord.Interaction, الرقم: int, الاسم: str):
        if len(الاسم) > الحد_الأقصى_لاسم_الفريق:
            الاسم = الاسم[:الحد_الأقصى_لاسم_الفريق]
        user_id = str(interaction.user.id)
        await تعيين_فريق(user_id, الرقم-1, الاسم)
        await interaction.response.send_message(f"✅ تم تغيير اسم الفريق {الرقم} إلى **{الاسم}**!")

    @app_commands.command(name="تفعيل_فريق", description="تبديل الفريق النشط")
    @app_commands.describe(الرقم="رقم الفريق الذي تريد تفعيله (1 أو 2)")
    @app_commands.choices(الرقم=[
        app_commands.Choice(name="الفريق الأول", value=1),
        app_commands.Choice(name="الفريق الثاني", value=2)
    ])
    async def تفعيل_فريق(self, interaction: discord.Interaction, الرقم: int):
        user_id = str(interaction.user.id)
        await تحديث_مستخدم(user_id, active_team=الرقم-1)
        اسم_الفريق = await احصل_على_فريق(user_id, الرقم-1)
        if not اسم_الفريق:
            اسم_الفريق = "(فارغ)"
        await interaction.response.send_message(f"🔁 تم تفعيل **الفريق {الرقم}** ({اسم_الفريق})")

    @app_commands.command(name="فرقي", description="عرض فريقيك والفريق النشط")
    async def فرقي(self, interaction: discord.Interaction):
        user_id = str(interaction.user.id)
        فريق1 = await احصل_على_فريق(user_id, 0)
        فريق2 = await احصل_على_فريق(user_id, 1)
        if not فريق1:
            فريق1 = "لم يُحدد"
        if not فريق2:
            فريق2 = "لم يُحدد"
        بيانات = await احصل_على_مستخدم(user_id)
        النشط = بيانات["active_team"] + 1
        embed = discord.Embed(title=f"فرق {interaction.user.display_name}", color=0x9b59b6)
        embed.add_field(name="الفريق الأول", value=فريق1, inline=False)
        embed.add_field(name="الفريق الثاني", value=فريق2, inline=False)
        embed.add_field(name="الفريق النشط", value=f"الفريق {النشط}", inline=False)
        await interaction.response.send_message(embed=embed)

async def setup(bot):
    await bot.add_cog(الفرق(bot))