import discord
from discord.ext import commands
from discord import app_commands
import random
import time
from database import (
    احصل_على_مستخدم, تحديث_مستخدم, أضف_إلى_المخزون, احصل_على_المخزون,
    احصل_على_سلعة_من_المتجر, احصل_على_كل_سلع_المتجر, احصل_على_كل_المستخدمين_للترتيب
)
from config import (
    مكافأة_يومية_عملات, مكافأة_يومية_رصيد, مكافأة_ساعية_عملات,
    الحد_الأدنى_للعمل, الحد_الأقصى_للعمل, ثواني_اليوم, ثواني_الساعة
)

class الاقتصاد(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="رصيدي", description="عرض رصيدك من العملات والرصيد المميز")
    async def رصيدي(self, interaction: discord.Interaction):
        بيانات = await احصل_على_مستخدم(str(interaction.user.id))
        تضمين = discord.Embed(title=f"محفظة {interaction.user.display_name}", color=0x00AE86)
        تضمين.add_field(name="🪙 العملات", value=بيانات["coins"], inline=True)
        تضمين.add_field(name="💎 الرصيد المميز", value=بيانات["credits"], inline=True)
        تضمين.set_footer(text="اشتري من /المتجر | الرصيد المميز يعطي ضعف الكمية")
        await interaction.response.send_message(embed=تضمين)

    @app_commands.command(name="يومي", description="احصل على مكافأتك اليومية (مرة كل 24 ساعة)")
    async def يومي(self, interaction: discord.Interaction):
        uid = str(interaction.user.id)
        بيانات = await احصل_على_مستخدم(uid)
        الآن = int(time.time())
        if الآن - بيانات["last_daily"] < ثواني_اليوم:
            باقي = ثواني_اليوم - (الآن - بيانات["last_daily"])
            ساعات = باقي // 3600
            دقائق = (باقي % 3600) // 60
            await interaction.response.send_message(f"⏳ لقد حصلت على مكافأتك اليومية بالفعل! انتظر {ساعات} ساعة و {دقائق} دقيقة.", ephemeral=True)
            return
        await تحديث_مستخدم(uid, last_daily=الآن, coins=بيانات["coins"]+مكافأة_يومية_عملات, credits=بيانات["credits"]+مكافأة_يومية_رصيد)
        await interaction.response.send_message(f"🎁 مكافأة يومية: +{مكافأة_يومية_عملات} عملة و +{مكافأة_يومية_رصيد} رصيد مميز")

    @app_commands.command(name="ساعي", description="احصل على مكافأة كل ساعة")
    async def ساعي(self, interaction: discord.Interaction):
        uid = str(interaction.user.id)
        بيانات = await احصل_على_مستخدم(uid)
        الآن = int(time.time())
        if الآن - بيانات["last_hourly"] < ثواني_الساعة:
            باقي = ثواني_الساعة - (الآن - بيانات["last_hourly"])
            دقائق = باقي // 60
            await interaction.response.send_message(f"⏳ يمكنك الحصول على المكافأة الساعية بعد {دقائق} دقيقة.", ephemeral=True)
            return
        await تحديث_مستخدم(uid, last_hourly=الآن, coins=بيانات["coins"]+مكافأة_ساعية_عملات)
        await interaction.response.send_message(f"⏲️ مكافأة ساعية: +{مكافأة_ساعية_عملات} عملة")

    @app_commands.command(name="اعمل", description="اعمل لكسب عملات إضافية")
    async def اعمل(self, interaction: discord.Interaction):
        earnings = random.randint(الحد_الأدنى_للعمل, الحد_الأقصى_للعمل)
        uid = str(interaction.user.id)
        بيانات = await احصل_على_مستخدم(uid)
        await تحديث_مستخدم(uid, coins=بيانات["coins"]+earnings)
        await interaction.response.send_message(f"💼 لقد عملت بجد وكسبت {earnings} عملة")

    @app_commands.command(name="الاغنياء", description="عرض أغنى 10 لاعبين")
    async def الاغنياء(self, interaction: discord.Interaction):
        rows = await احصل_على_كل_المستخدمين_للترتيب()
        مرتبة = sorted(rows, key=lambda x: x[1], reverse=True)[:10]
        if not مرتبة:
            await interaction.response.send_message("لا يوجد مستخدمون بعد.")
            return
        الوصف = ""
        for i, (uid, عملات) in enumerate(مرتبة):
            المستخدم = await self.bot.fetch_user(int(uid))
            الاسم = المستخدم.display_name if المستخدم else "مجهول"
            الوصف += f"{i+1}. **{الاسم}** — {عملات} 🪙\n"
        تضمين = discord.Embed(title="🏆 قائمة الأغنياء", description=الوصف, color=0xFFD700)
        await interaction.response.send_message(embed=تضمين)

    @app_commands.command(name="المتجر", description="عرض جميع السلع (25 سلعة)")
    async def المتجر(self, interaction: discord.Interaction):
        السلع = await احصل_على_كل_سلع_المتجر()
        تضمين = discord.Embed(title="🛒 المتجر", description="استخدم `/اشتري [رقم السلعة] [عملات/رصيد] [الكمية]`\n**الشراء بالرصيد المميز يعطي ضعف الكمية**", color=0x3498db)
        for س in السلع:
            تضمين.add_field(name=f"{س['id']}. {س['name']}", value=f"🪙 {س['coinPrice']} | 💎 {س['creditPrice']}\n*{س['desc']}*", inline=True)
        await interaction.response.send_message(embed=تضمين)

    @app_commands.command(name="اشتري", description="شراء سلعة من المتجر")
    @app_commands.describe(رقم_السلعة="رقم السلعة", العملة="عملات أو رصيد", الكمية="الكمية (افتراضي 1)")
    @app_commands.choices(العملة=[
        app_commands.Choice(name="عملات", value="coins"),
        app_commands.Choice(name="رصيد مميز", value="credits")
    ])
    async def اشتري(self, interaction: discord.Interaction, رقم_السلعة: int, العملة: str, الكمية: int = 1):
        if الكمية < 1:
            الكمية = 1
        السلعة = await احصل_على_سلعة_من_المتجر(رقم_السلعة)
        if not السلعة:
            await interaction.response.send_message("❌ رقم سلعة غير صحيح. استخدم `/المتجر` لمعرفة الأرقام.", ephemeral=True)
            return
        uid = str(interaction.user.id)
        بيانات = await احصل_على_مستخدم(uid)
        if العملة == "coins":
            السعر = السلعة["coinPrice"]
            المضاعف = 1
        else:
            السعر = السلعة["creditPrice"]
            المضاعف = 2
        التكلفة_الكاملة = السعر * الكمية
        if العملة == "coins":
            if بيانات["coins"] < التكلفة_الكاملة:
                await interaction.response.send_message(f"❌ ليس لديك عملات كافية. تحتاج {التكلفة_الكاملة} عملة.", ephemeral=True)
                return
            await تحديث_مستخدم(uid, coins=بيانات["coins"] - التكلفة_الكاملة)
        else:
            if بيانات["credits"] < التكلفة_الكاملة:
                await interaction.response.send_message(f"❌ ليس لديك رصيد مميز كافٍ. تحتاج {التكلفة_الكاملة} رصيد.", ephemeral=True)
                return
            await تحديث_مستخدم(uid, credits=بيانات["credits"] - التكلفة_الكاملة)
        الكمية_المستلمة = الكمية * المضاعف
        await أضف_إلى_المخزون(uid, رقم_السلعة, الكمية_المستلمة)
        await interaction.response.send_message(f"✅ اشتريت **{الكمية_المستلمة}** × **{السلعة['name']}** مقابل {التكلفة_الكاملة} {('عملة' if العملة=='coins' else 'رصيد مميز')}.")

    @app_commands.command(name="مخزني", description="عرض العناصر التي تمتلكها")
    async def مخزني(self, interaction: discord.Interaction):
        uid = str(interaction.user.id)
        المخزون = await احصل_على_المخزون(uid)
        if not المخزون:
            await interaction.response.send_message("📦 مخزونك فارغ. قم بشراء شيء من المتجر.", ephemeral=True)
            return
        الوصف = ""
        for item_id, كمية in المخزون:
            السلعة = await احصل_على_سلعة_من_المتجر(item_id)
            if السلعة:
                الوصف += f"• {السلعة['name']} x{كمية}\n"
        تضمين = discord.Embed(title=f"مخزون {interaction.user.display_name}", description=الوصف, color=0x2ecc71)
        await interaction.response.send_message(embed=تضمين)

async def setup(bot):
    await bot.add_cog(الاقتصاد(bot))