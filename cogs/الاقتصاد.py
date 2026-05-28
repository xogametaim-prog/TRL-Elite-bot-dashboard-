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
        embed = discord.Embed(title=f"محفظة {interaction.user.display_name}", color=0x00AE86)
        embed.add_field(name="🪙 العملات", value=str(بيانات["coins"]), inline=True)
        embed.add_field(name="💎 الرصيد المميز", value=str(بيانات["credits"]), inline=True)
        embed.set_footer(text="اشتري من /المتجر | الرصيد المميز يعطي ضعف الكمية")
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="يومي", description="احصل على مكافأتك اليومية (مرة كل 24 ساعة)")
    async def يومي(self, interaction: discord.Interaction):
        user_id = str(interaction.user.id)
        بيانات = await احصل_على_مستخدم(user_id)
        الآن = int(time.time())
        if الآن - بيانات["last_daily"] < ثواني_اليوم:
            باقي = ثواني_اليوم - (الآن - بيانات["last_daily"])
            ساعات = باقي // 3600
            دقائق = (باقي % 3600) // 60
            await interaction.response.send_message(f"⏳ لقد حصلت على مكافأتك اليومية بالفعل! انتظر {ساعات} ساعة و {دقائق} دقيقة.", ephemeral=True)
            return
        await تحديث_مستخدم(user_id, last_daily=الآن)
        عملات_جديدة = بيانات["coins"] + مكافأة_يومية_عملات
        رصيد_جديد = بيانات["credits"] + مكافأة_يومية_رصيد
        await تحديث_مستخدم(user_id, coins=عملات_جديدة, credits=رصيد_جديد)
        await interaction.response.send_message(f"🎁 تم صرف المكافأة اليومية! حصلت على **{مكافأة_يومية_عملات} عملة** و **{مكافأة_يومية_رصيد} رصيد مميز**! 🎉")

    @app_commands.command(name="ساعي", description="احصل على مكافأة كل ساعة (مرة كل 60 دقيقة)")
    async def ساعي(self, interaction: discord.Interaction):
        user_id = str(interaction.user.id)
        بيانات = await احصل_على_مستخدم(user_id)
        الآن = int(time.time())
        if الآن - بيانات["last_hourly"] < ثواني_الساعة:
            باقي = ثواني_الساعة - (الآن - بيانات["last_hourly"])
            دقائق = باقي // 60
            await interaction.response.send_message(f"⏳ يمكنك الحصول على المكافأة الساعية بعد {دقائق} دقيقة.", ephemeral=True)
            return
        await تحديث_مستخدم(user_id, last_hourly=الآن)
        عملات_جديدة = بيانات["coins"] + مكافأة_ساعية_عملات
        await تحديث_مستخدم(user_id, coins=عملات_جديدة)
        await interaction.response.send_message(f"⏲️ تم صرف المكافأة الساعية! حصلت على **{مكافأة_ساعية_عملات} عملة**! تعال كل ساعة.")

    @app_commands.command(name="اعمل", description="اعمل لكسب بعض العملات")
    async def اعمل(self, interaction: discord.Interaction):
        earnings = random.randint(الحد_الأدنى_للعمل, الحد_الأقصى_للعمل)
        user_id = str(interaction.user.id)
        بيانات = await احصل_على_مستخدم(user_id)
        عملات_جديدة = بيانات["coins"] + earnings
        await تحديث_مستخدم(user_id, coins=عملات_جديدة)
        await interaction.response.send_message(f"💼 لقد عملت بجد وكسبت **{earnings} عملة**!")

    @app_commands.command(name="الاغنياء", description="عرض أغنى 10 لاعبين حسب العملات")
    async def الاغنياء(self, interaction: discord.Interaction):
        rows = await احصل_على_كل_المستخدمين_للترتيب()
        مصفوفة = sorted(rows, key=lambda x: x[1], reverse=True)[:10]
        if not مصفوفة:
            await interaction.response.send_message("لا يوجد مستخدمون بعد.")
            return
        الوصف = ""
        for i, (uid, عملات) in enumerate(مصفوفة):
            user = await self.bot.fetch_user(int(uid))
            الاسم = user.display_name if user else "مجهول"
            الوصف += f"{i+1}. **{الاسم}** — {عملات} 🪙\n"
        embed = discord.Embed(title="🏆 قائمة الأغنياء", description=الوصف, color=0xFFD700)
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="المتجر", description="عرض المتجر بجميع السلع الـ 25")
    async def المتجر(self, interaction: discord.Interaction):
        السلع = await احصل_على_كل_سلع_المتجر()
        embed = discord.Embed(title="🛒 المتجر - 25 سلعة", description="اشتري بـ `/اشتري [رقم_السلعة] [عملات/رصيد] [الكمية]`\n**الشراء بالرصيد المميز يعطي ضعف الكمية!**", color=0x3498db)
        for س in السلع:
            embed.add_field(name=f"{س['id']}. {س['name']}", value=f"🪙 {س['coinPrice']} | 💎 {س['creditPrice']}\n*{س['desc']}*", inline=True)
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="اشتري", description="شراء سلعة من المتجر")
    @app_commands.describe(رقم_السلعة="رقم السلعة من /المتجر", العملة="ادفع بالعملات أو بالرصيد المميز", الكمية="كم تريد شراء؟ (الافتراضي 1)")
    @app_commands.choices(العملة=[
        app_commands.Choice(name="عملات", value="coins"),
        app_commands.Choice(name="رصيد مميز", value="credits")
    ])
    async def اشتري(self, interaction: discord.Interaction, رقم_السلعة: int, العملة: str, الكمية: int = 1):
        if الكمية < 1:
            الكمية = 1
        السلعة = await احصل_على_سلعة_من_المتجر(رقم_السلعة)
        if not السلعة:
            await interaction.response.send_message("❌ رقم سلعة غير صحيح. استخدم `/المتجر` لعرض الأرقام.", ephemeral=True)
            return
        user_id = str(interaction.user.id)
        بيانات = await احصل_على_مستخدم(user_id)
        if العملة == "coins":
            سعر_الوحدة = السلعة["coinPrice"]
            المضاعف = 1
            التكلفة_الكاملة = سعر_الوحدة * الكمية
            if بيانات["coins"] < التكلفة_الكاملة:
                await interaction.response.send_message(f"❌ ليس لديك عملات كافية! تحتاج {التكلفة_الكاملة} عملة.", ephemeral=True)
                return
            عملات_جديدة = بيانات["coins"] - التكلفة_الكاملة
            await تحديث_مستخدم(user_id, coins=عملات_جديدة)
        else:
            سعر_الوحدة = السلعة["creditPrice"]
            المضاعف = 2
            التكلفة_الكاملة = سعر_الوحدة * الكمية
            if بيانات["credits"] < التكلفة_الكاملة:
                await interaction.response.send_message(f"❌ ليس لديك رصيد مميز كافٍ! تحتاج {التكلفة_الكاملة} رصيد.", ephemeral=True)
                return
            رصيد_جديد = بيانات["credits"] - التكلفة_الكاملة
            await تحديث_مستخدم(user_id, credits=رصيد_جديد)
        الكمية_المستلمة = الكمية * المضاعف
        await أضف_إلى_المخزون(user_id, رقم_السلعة, الكمية_المستلمة)
        await interaction.response.send_message(f"✅ اشتريت **{الكمية_المستلمة}** × **{السلعة['name']}** مقابل {التكلفة_الكاملة} {('عملة' if العملة=='coins' else 'رصيد')}! (الرصيد المميز يعطي ضعف الكمية 🎁)")

    @app_commands.command(name="مخزني", description="عرض العناصر التي تمتلكها")
    async def مخزني(self, interaction: discord.Interaction):
        user_id = str(interaction.user.id)
        المخزون = await احصل_على_المخزون(user_id)
        if not المخزون:
            await interaction.response.send_message("📦 مخزونك فارغ. اشترِ من المتجر!", ephemeral=True)
            return
        الوصف = ""
        for item_id, كمية in المخزون:
            السلعة = await احصل_على_سلعة_من_المتجر(item_id)
            if السلعة:
                الوصف += f"• {السلعة['name']} x{كمية}\n"
        embed = discord.Embed(title=f"مخزون {interaction.user.display_name}", description=الوصف, color=0x2ecc71)
        await interaction.response.send_message(embed=embed)

async def setup(bot):
    await bot.add_cog(الاقتصاد(bot))