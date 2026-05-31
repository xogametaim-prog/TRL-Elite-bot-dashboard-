# ==================== invitetracker.py ====================
import discord
from discord.ext import commands
import aiosqlite
from datetime import datetime

بيانات_الدعوات = {}
دعوات_السيرفرات = {}

async def تحديث_الدعوات(guild):
    try:
        دعوات_السيرفرات[guild.id] = {inv.code: inv.uses for inv in await guild.invites()}
    except:
        pass

async def create_embed(interaction_or_channel, title=None, description=None, color=None, image_url=None, fields=None, footer_text=None, is_ephemeral=False, view=None):
    try:
        if color is None:
            color = 0x3498db
        if isinstance(color, str):
            color = int(color.replace("#", ""), 16)
        
        embed = discord.Embed(
            title=title,
            description=description,
            color=color
        )
        
        if image_url:
            embed.set_image(url=image_url)
        
        if fields:
            for field in fields:
                embed.add_field(
                    name=field.get("name", ""),
                    value=field.get("value", ""),
                    inline=field.get("inline", True)
                )
        
        if footer_text:
            embed.set_footer(text=footer_text)
        
        embed.timestamp = datetime.utcnow()
        
        if hasattr(interaction_or_channel, 'response'):
            if interaction_or_channel.response.is_done():
                await interaction_or_channel.followup.send(embed=embed, ephemeral=is_ephemeral, view=view)
            else:
                await interaction_or_channel.response.send_message(embed=embed, ephemeral=is_ephemeral, view=view)
        else:
            await interaction_or_channel.send(embed=embed, view=view)
        
        return embed
    except Exception as e:
        print(f"❌ خطأ في دالة create_embed: {e}")
        try:
            fallback_embed = discord.Embed(
                description="حدث خطأ أثناء إنشاء الرسالة. يرجى إبلاغ الإدارة.",
                color=0xFF0000
            )
            if hasattr(interaction_or_channel, 'response'):
                if interaction_or_channel.response.is_done():
                    await interaction_or_channel.followup.send(embed=fallback_embed, ephemeral=True)
                else:
                    await interaction_or_channel.response.send_message(embed=fallback_embed, ephemeral=True)
            else:
                await interaction_or_channel.send(embed=fallback_embed)
        except:
            print("❌ فشل إرسال رسالة الخطأ الاحتياطية")
        return None

def setup_invite_tracker(bot):
    @bot.event
    async def on_member_join(member):
        try:
            invites_before = دعوات_السيرفرات.get(member.guild.id, {})
            invites_after = {inv.code: inv.uses for inv in await member.guild.invites()}
            
            inviter = None
            for code, uses in invites_after.items():
                if code in invites_before and uses > invites_before[code]:
                    inviter = code
                    break
            
            if inviter:
                async with aiosqlite.connect("server_data.db") as db:
                    cursor = await db.execute("SELECT welcome_channel FROM server_config WHERE guild_id = ?", (str(member.guild.id),))
                    row = await cursor.fetchone()
                
                if row and row[0]:
                    channel = member.guild.get_channel(int(row[0]))
                    if channel:
                        invite = await member.guild.fetch_invite(inviter)
                        if invite and invite.inviter:
                            inviter_name = invite.inviter.display_name
                            بيانات_الدعوات[invite.inviter.id] = بيانات_الدعوات.get(invite.inviter.id, 0) + 1
                            total_invites = بيانات_الدعوات[invite.inviter.id]
                            
                            await create_embed(
                                channel,
                                title="🎉 عضو جديد!",
                                description=f"مرحباً {member.mention} في السيرفر!",
                                color=0x00FF00,
                                fields=[
                                    {"name": "👤 الداعي", "value": inviter_name, "inline": True},
                                    {"name": "📊 إجمالي الدعوات", "value": str(total_invites), "inline": True}
                                ]
                            )
            
            دعوات_السيرفرات[member.guild.id] = {inv.code: inv.uses for inv in await member.guild.invites()}
        except Exception as e:
            print(f"خطأ في الترحيب: {e}")
    
    @bot.event
    async def on_guild_join(guild):
        await تحديث_الدعوات(guild)
    
    return bot

def get_invite_count(user_id):
    return بيانات_الدعوات.get(str(user_id), 0)

def get_all_invites():
    return sorted(بيانات_الدعوات.items(), key=lambda x: x[1], reverse=True)