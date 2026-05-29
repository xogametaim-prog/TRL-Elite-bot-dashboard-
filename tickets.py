# ==================== tickets.py ====================
import discord
from discord.ext import commands
import asyncio

رتبة_التذاكر_المسموح_لها = 0

async def is_authorized(user):
    if user.guild_permissions.administrator:
        return True
    if رتبة_التذاكر_المسموح_لها:
        role = user.guild.get_role(رتبة_التذاكر_المسموح_لها)
        if role and role in user.roles:
            return True
    return False

class تأكيد_الإغلاق(discord.ui.View):
    def __init__(self, channel, user):
        super().__init__(timeout=60)
        self.channel = channel
        self.user = user
    
    @discord.ui.button(label="نعم، أغلق التذكرة", style=discord.ButtonStyle.danger)
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user != self.user:
            await interaction.response.send_message("❌ هذا التأكيد ليس لك!", ephemeral=True)
            return
        await interaction.response.send_message("🔒 جاري حذف التذكرة...")
        await asyncio.sleep(1)
        await self.channel.delete()
    
    @discord.ui.button(label="لا، إلغاء", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user != self.user:
            await interaction.response.send_message("❌ هذا التأكيد ليس لك!", ephemeral=True)
            return
        await interaction.response.send_message("✅ تم إلغاء العملية", ephemeral=True)
        self.stop()

class TicketControlView(discord.ui.View):
    def __init__(self, creator_id, creator_name):
        super().__init__(timeout=None)
        self.creator_id = creator_id
        self.creator_name = creator_name
    
    @discord.ui.button(label="📌 استلام التذكرة", style=discord.ButtonStyle.success)
    async def claim(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not await is_authorized(interaction.user):
            await interaction.response.send_message("❌ ليس لديك صلاحية لاستلام هذه التذكرة!", ephemeral=True)
            return
        await interaction.response.send_message(f"✅ تم استلام التذكرة بواسطة {interaction.user.mention}")
    
    @discord.ui.button(label="🔒 إغلاق التذكرة", style=discord.ButtonStyle.danger)
    async def close(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not await is_authorized(interaction.user) and str(interaction.user.id) != self.creator_id:
            await interaction.response.send_message("❌ ليس لديك صلاحية لإغلاق هذه التذكرة!", ephemeral=True)
            return
        view = تأكيد_الإغلاق(interaction.channel, interaction.user)
        embed = discord.Embed(
            title="⚠️ تأكيد إغلاق التذكرة",
            description="هل أنت متأكد أنك تريد إغلاق وحذف هذه التذكرة؟ هذا الإجراء لا يمكن التراجع عنه.",
            color=0xFFA500
        )
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

class TicketButton(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
    
    @discord.ui.button(label="🎫 فتح تذكرة", style=discord.ButtonStyle.primary)
    async def create(self, interaction: discord.Interaction, button: discord.ui.Button):
        category = discord.utils.get(interaction.guild.categories, name="تذاكر")
        if not category:
            category = await interaction.guild.create_category("تذاكر")
        
        channel = await interaction.guild.create_text_channel(
            name=f"تذكرة-{interaction.user.name}",
            category=category,
            overwrites={
                interaction.guild.default_role: discord.PermissionOverwrite(read_messages=False),
                interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True),
                interaction.guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True)
            }
        )
        
        embed = discord.Embed(
            title="🎫 تذكرة جديدة",
            description=f"مرحباً {interaction.user.mention}\n\nيرجى شرح مشكلتك بالتفصيل وسيقوم فريق الدعم بالرد عليك قريباً.",
            color=0x00FF00
        )
        view = TicketControlView(str(interaction.user.id), interaction.user.display_name)
        await channel.send(embed=embed, view=view)
        await interaction.response.send_message(f"✅ تم فتح تذكرة: {channel.mention}", ephemeral=True)