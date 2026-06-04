# ==================== management.py ====================
import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import asyncio
import random
import time
import logging
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger('discord_bot')

# ==================== EmbedHelper (نسخة محلية للـ Cog) ====================
class EmbedHelper:
    @staticmethod
    def create(title=None, description=None, color=None, fields=None, footer_text=None, image_url=None, thumbnail_url=None, author_name=None, author_icon=None):
        try:
            if color is None: color = 0x3498db
            if isinstance(color, str): color = int(color.replace("#", ""), 16)
            embed = discord.Embed(title=title, description=description, color=color)
            if image_url: embed.set_image(url=image_url)
            if thumbnail_url: embed.set_thumbnail(url=thumbnail_url)
            if author_name: embed.set_author(name=author_name, icon_url=author_icon)
            if fields:
                for f in fields: embed.add_field(name=f.get("name", ""), value=f.get("value", ""), inline=f.get("inline", True))
            if footer_text: embed.set_footer(text=footer_text)
            embed.timestamp = datetime.utcnow()
            return embed
        except Exception as e:
            logger.error(f"❌ EmbedHelper.create: {e}")
            return discord.Embed(description="حدث خطأ.", color=0xFF0000)

    @staticmethod
    async def send(target, title=None, description=None, color=None, fields=None, footer_text=None, image_url=None, thumbnail_url=None, author_name=None, author_icon=None, is_ephemeral=False, view=None):
        try:
            embed = EmbedHelper.create(title=title, description=description, color=color, fields=fields, footer_text=footer_text, image_url=image_url, thumbnail_url=thumbnail_url, author_name=author_name, author_icon=author_icon)
            if hasattr(target, 'response'):
                if target.response.is_done(): await target.followup.send(embed=embed, ephemeral=is_ephemeral, view=view)
                else: await target.response.send_message(embed=embed, ephemeral=is_ephemeral, view=view)
            else: await target.send(embed=embed, view=view)
            return embed
        except Exception as e:
            logger.error(f"❌ EmbedHelper.send: {e}")
            try:
                fb = discord.Embed(description="حدث خطأ.", color=0xFF0000)
                if hasattr(target, 'response'):
                    if target.response.is_done(): await target.followup.send(embed=fb, ephemeral=True)
                    else: await target.response.send_message(embed=fb, ephemeral=True)
                else: await target.send(embed=fb)
            except: pass
            return None

# ==================== ConfirmView للاستخدام العام ====================
class ConfirmView(discord.ui.View):
    def __init__(self, user_id):
        super().__init__(timeout=30)
        self.user_id = user_id
        self.value = None

    @discord.ui.button(label="✅ تأكيد", style=discord.ButtonStyle.success)
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ هذا الزر ليس لك!", ephemeral=True)
            return
        self.value = True
        self.stop()

    @discord.ui.button(label="❌ إلغاء", style=discord.ButtonStyle.danger)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ هذا الزر ليس لك!", ephemeral=True)
            return
        self.value = False
        self.stop()

# ==================== الـ Cog الرئيسي ====================
class Management(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.giveaway_tasks = {}

    # ========== قاعدة البيانات ==========
    async def init_db(self):
        async with aiosqlite.connect("server_data.db") as db:
            # إنشاء جميع الجداول المطلوبة
            await db.execute('''CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id TEXT PRIMARY KEY,
                welcome_channel_id TEXT
            )''')
            await db.execute('''CREATE TABLE IF NOT EXISTS warnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                user_id TEXT,
                warn_count INTEGER DEFAULT 0,
                reason TEXT
            )''')
            await db.execute('''CREATE TABLE IF NOT EXISTS auto_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                trigger_word TEXT,
                response_text TEXT
            )''')
            await db.execute('''CREATE TABLE IF NOT EXISTS giveaways (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                channel_id TEXT,
                message_id TEXT,
                title TEXT,
                description TEXT,
                emoji TEXT,
                end_time INTEGER,
                winners_count INTEGER DEFAULT 1,
                is_active BOOLEAN DEFAULT 1
            )''')
            await db.commit()
        logger.info("✅ تم تهيئة قاعدة البيانات (تم إنشاء جميع الجداول)")

    @commands.Cog.listener()
    async def on_ready(self):
        await self.init_db()
        await self.restore_giveaways()
        logger.info("✅ Management جاهز")

    # ========== استعادة القيف أوي بعد إعادة التشغيل ==========
    async def restore_giveaways(self):
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT * FROM giveaways WHERE is_active = 1")
            rows = await cursor.fetchall()
        for row in rows:
            gid, cid, mid, title, desc, emoji, end_time, winners, _ = row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9]
            remaining = end_time - time.time()
            if remaining <= 0:
                await self.end_giveaway(gid, cid, mid, title, emoji, winners)
            else:
                task = asyncio.create_task(self._schedule_giveaway(gid, cid, mid, title, emoji, winners, remaining))
                self.giveaway_tasks[f"{gid}-{mid}"] = task

    async def _schedule_giveaway(self, gid, cid, mid, title, emoji, winners, delay):
        await asyncio.sleep(delay)
        await self.end_giveaway(gid, cid, mid, title, emoji, winners)

    async def end_giveaway(self, guild_id, channel_id, message_id, title, emoji, winners_count):
        guild = self.bot.get_guild(int(guild_id))
        if not guild: return
        channel = guild.get_channel(int(channel_id))
        if not channel: return
        try:
            msg = await channel.fetch_message(int(message_id))
        except:
            msg = None

        participants = []
        if msg:
            for reaction in msg.reactions:
                if str(reaction.emoji) == emoji:
                    async for user in reaction.users():
                        if not user.bot:
                            participants.append(user)
                    break

        winners_list = []
        if participants:
            actual_winners = min(winners_count, len(participants))
            winners_list = random.sample(participants, actual_winners)

        winners_text = "\n".join([w.mention for w in winners_list]) if winners_list else "لا يوجد فائزين"
        embed = EmbedHelper.create(
            title=f"🎉 انتهى القيف أوي: {title}",
            description=f"**الفائزين:**\n{winners_text}",
            color=0xFFD700
        )
        if msg:
            await msg.reply(embed=embed)
        else:
            await channel.send(embed=embed)

        async with aiosqlite.connect("server_data.db") as db:
            await db.execute("UPDATE giveaways SET is_active = 0 WHERE guild_id = ? AND message_id = ?", (guild_id, message_id))
            await db.commit()
        key = f"{guild_id}-{message_id}"
        if key in self.giveaway_tasks:
            del self.giveaway_tasks[key]

    # ========== حدث دخول البوت لسيرفر جديد ==========
    @commands.Cog.listener()
    async def on_guild_join(self, guild):
        try:
            target_channel = None
            for channel in guild.text_channels:
                if channel.permissions_for(guild.me).send_messages:
                    target_channel = channel
                    break
            if target_channel:
                embed = EmbedHelper.create(
                    title="👋 شكراً لإضافتي!",
                    description=f"أهلاً بك في سيرفر **{guild.name}**!\n\nلإعداد قناة الترحيب، استخدم الأمر:\n**/set_welcome**",
                    color=0x00AAFF,
                    thumbnail_url=guild.icon.url if guild.icon else None,
                    author_name=guild.name,
                    author_icon=guild.icon.url if guild.icon else None
                )
                await target_channel.send(embed=embed)
                logger.info(f"📥 دخلت سيرفر جديد: {guild.name}")
        except Exception as e:
            logger.error(f"❌ on_guild_join: {e}")

    # ========== حدث دخول عضو جديد ==========
    @commands.Cog.listener()
    async def on_member_join(self, member):
        try:
            if member.bot: return
            guild = member.guild
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT welcome_channel_id FROM guild_settings WHERE guild_id = ?", (str(guild.id),))
                row = await cursor.fetchone()
            if row and row[0]:
                channel = guild.get_channel(int(row[0]))
                if channel:
                    members_before = guild.member_count - 1
                    members_now = guild.member_count
                    embed = EmbedHelper.create(
                        title="🎉 عضو جديد!",
                        description=f"أهلاً بك {member.mention} في سيرفر **{guild.name}**!",
                        color=0x00FF00,
                        fields=[
                            {"name": "👥 عدد الأعضاء قبل دخولك", "value": str(members_before), "inline": True},
                            {"name": "👥 عدد الأعضاء بعد دخولك", "value": str(members_now), "inline": True}
                        ],
                        thumbnail_url=member.display_avatar.url,
                        author_name=member.display_name,
                        author_icon=member.display_avatar.url
                    )
                    await channel.send(embed=embed)
        except Exception as e:
            logger.error(f"❌ on_member_join: {e}")

    # ========== الردود التلقائية ==========
    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot: return
        if not message.guild: return

        try:
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT response_text FROM auto_responses WHERE guild_id = ? AND LOWER(trigger_word) = LOWER(?)",
                                          (str(message.guild.id), message.content.strip()))
                row = await cursor.fetchone()
            if row:
                await message.reply(row[0], mention_author=False)
        except Exception as e:
            logger.error(f"❌ auto_response: {e}")

    # ========== أمر إعداد قناة الترحيب ==========
    @app_commands.command(name="set_welcome", description="تحديد قناة الترحيب")
    @app_commands.describe(channel="قناة الترحيب")
    @app_commands.default_permissions(administrator=True)
    async def set_welcome(self, interaction: discord.Interaction, channel: discord.TextChannel):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                await db.execute("INSERT OR REPLACE INTO guild_settings (guild_id, welcome_channel_id) VALUES (?, ?)",
                                 (str(interaction.guild_id), str(channel.id)))
                await db.commit()
            await EmbedHelper.send(interaction, description=f"✅ تم تعيين {channel.mention} كقناة ترحيب!", color=0x00FF00, is_ephemeral=True)
        except Exception as e:
            logger.error(f"❌ set_welcome: {e}")

    # ========== نظام الاختصارات ==========
    @app_commands.command(name="اضافة_اختصار", description="إضافة رد تلقائي")
    @app_commands.describe(trigger="الكلمة المفتاحية", response="الرد")
    @app_commands.default_permissions(administrator=True)
    async def add_response(self, interaction: discord.Interaction, trigger: str, response: str):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                await db.execute("INSERT INTO auto_responses (guild_id, trigger_word, response_text) VALUES (?, ?, ?)",
                                 (str(interaction.guild_id), trigger.strip(), response))
                await db.commit()
            await EmbedHelper.send(interaction, description=f"✅ تم إضافة الاختصار: `{trigger}`", color=0x00FF00, is_ephemeral=True)
        except Exception as e:
            logger.error(f"❌ add_response: {e}")

    @app_commands.command(name="حذف_اختصار", description="حذف رد تلقائي")
    @app_commands.describe(trigger="الكلمة المفتاحية")
    @app_commands.default_permissions(administrator=True)
    async def remove_response(self, interaction: discord.Interaction, trigger: str):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                await db.execute("DELETE FROM auto_responses WHERE guild_id = ? AND trigger_word = ?",
                                 (str(interaction.guild_id), trigger.strip()))
                await db.commit()
            await EmbedHelper.send(interaction, description=f"✅ تم حذف الاختصار: `{trigger}`", color=0x00FF00, is_ephemeral=True)
        except Exception as e:
            logger.error(f"❌ remove_response: {e}")

    @app_commands.command(name="الاختصارات", description="عرض جميع الاختصارات")
    async def list_responses(self, interaction: discord.Interaction):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT trigger_word, response_text FROM auto_responses WHERE guild_id = ?",
                                          (str(interaction.guild_id),))
                rows = await cursor.fetchall()
            if not rows:
                await EmbedHelper.send(interaction, description="لا توجد اختصارات مضافة.", color=0xFFA500, is_ephemeral=True)
                return
            text = ""
            for trigger, response in rows:
                text += f"**{trigger}** → {response}\n"
            await EmbedHelper.send(interaction, title="📋 قائمة الاختصارات", description=text, color=0x3498db, is_ephemeral=True)
        except Exception as e:
            logger.error(f"❌ list_responses: {e}")

    # ========== نظام التحذيرات ==========
    @commands.command(name="ت", aliases=["warn"])
    @commands.has_permissions(moderate_members=True)
    async def warn_user(self, ctx, member: discord.Member, *, reason="بدون سبب"):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT warn_count FROM warnings WHERE guild_id = ? AND user_id = ?",
                                          (str(ctx.guild.id), str(member.id)))
                row = await cursor.fetchone()
                if row:
                    new_count = row[0] + 1
                    await db.execute("UPDATE warnings SET warn_count = ?, reason = ? WHERE guild_id = ? AND user_id = ?",
                                     (new_count, reason, str(ctx.guild.id), str(member.id)))
                else:
                    new_count = 1
                    await db.execute("INSERT INTO warnings (guild_id, user_id, warn_count, reason) VALUES (?, ?, ?, ?)",
                                     (str(ctx.guild.id), str(member.id), 1, reason))
                await db.commit()

            embed = EmbedHelper.create(
                title="⚠️ تحذير",
                description=f"تم تحذير {member.mention}",
                color=0xFFA500,
                fields=[
                    {"name": "📋 السبب", "value": reason, "inline": False},
                    {"name": "🔢 عدد التحذيرات", "value": str(new_count), "inline": True},
                    {"name": "👮 بواسطة", "value": ctx.author.mention, "inline": True}
                ]
            )
            await ctx.send(embed=embed)

            try:
                dm_embed = EmbedHelper.create(
                    title=f"⚠️ تم تحذيرك في {ctx.guild.name}",
                    description=f"**السبب:** {reason}\n**عدد التحذيرات:** {new_count}",
                    color=0xFFA500
                )
                await member.send(embed=dm_embed)
            except:
                pass
        except Exception as e:
            logger.error(f"❌ warn: {e}")

    @commands.command(name="شيلت", aliases=["unwarn"])
    @commands.has_permissions(moderate_members=True)
    async def unwarn_user(self, ctx, member: discord.Member):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT warn_count FROM warnings WHERE guild_id = ? AND user_id = ?",
                                          (str(ctx.guild.id), str(member.id)))
                row = await cursor.fetchone()
                if not row or row[0] <= 0:
                    await EmbedHelper.send(ctx, description=f"❌ {member.mention} ليس لديه تحذيرات!", color=0xFF0000)
                    return
                new_count = row[0] - 1
                if new_count <= 0:
                    await db.execute("DELETE FROM warnings WHERE guild_id = ? AND user_id = ?",
                                     (str(ctx.guild.id), str(member.id)))
                else:
                    await db.execute("UPDATE warnings SET warn_count = ? WHERE guild_id = ? AND user_id = ?",
                                     (new_count, str(ctx.guild.id), str(member.id)))
                await db.commit()

            await EmbedHelper.send(ctx, description=f"✅ تم إزالة تحذير من {member.mention} (المتبقي: {max(0, new_count)})", color=0x00FF00)
        except Exception as e:
            logger.error(f"❌ unwarn: {e}")

    @app_commands.command(name="تحذيرات", description="عرض قائمة المحذرين")
    async def list_warnings(self, interaction: discord.Interaction):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT user_id, warn_count, reason FROM warnings WHERE guild_id = ? AND warn_count > 0 ORDER BY warn_count DESC",
                                          (str(interaction.guild_id),))
                rows = await cursor.fetchall()
            if not rows:
                await EmbedHelper.send(interaction, description="✅ لا يوجد أعضاء محذرين!", color=0x00FF00, is_ephemeral=True)
                return
            text = ""
            for user_id, count, reason in rows:
                member = interaction.guild.get_member(int(user_id))
                name = member.mention if member else f"<@{user_id}>"
                text += f"{name} - **{count}** تحذيرات - {reason}\n"
            await EmbedHelper.send(interaction, title="📋 قائمة المحذرين", description=text, color=0xFFA500, is_ephemeral=True)
        except Exception as e:
            logger.error(f"❌ list_warnings: {e}")

    # ========== نظام القيف أوي ==========
    @app_commands.command(name="giveaway", description="إنشاء قيف أوي")
    @app_commands.describe(
        title="عنوان القيف أوي",
        description="وصف القيف أوي",
        duration="المدة بالدقائق",
        winners="عدد الفائزين (افتراضي 1)",
        emoji="إيموجي التفاعل (افتراضي 🎉)"
    )
    @app_commands.default_permissions(administrator=True)
    async def giveaway(self, interaction: discord.Interaction, title: str, description: str, duration: int, winners: int = 1, emoji: str = "🎉"):
        try:
            end_time = int(time.time() + (duration * 60))
            embed = EmbedHelper.create(
                title=f"🎉 {title}",
                description=f"{description}\n\n**المدة:** {duration} دقيقة\n**عدد الفائزين:** {winners}\n**للاشتراك:** تفاعل بـ {emoji}",
                color=0x9B59B6,
                fields=[
                    {"name": "⏰ ينتهي", "value": f"<t:{end_time}:R>", "inline": True},
                    {"name": "👤 بواسطة", "value": interaction.user.mention, "inline": True}
                ],
                footer_text="تفاعل للإشتراك!"
            )
            await interaction.response.send_message(embed=embed)
            msg = await interaction.original_response()
            await msg.add_reaction(emoji)

            async with aiosqlite.connect("server_data.db") as db:
                await db.execute("INSERT INTO giveaways (guild_id, channel_id, message_id, title, description, emoji, end_time, winners_count, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
                                 (str(interaction.guild_id), str(interaction.channel_id), str(msg.id), title, description, emoji, end_time, winners))
                await db.commit()

            task = asyncio.create_task(self._schedule_giveaway(str(interaction.guild_id), str(interaction.channel_id), str(msg.id), title, emoji, winners, duration * 60))
            self.giveaway_tasks[f"{interaction.guild_id}-{msg.id}"] = task
        except Exception as e:
            logger.error(f"❌ giveaway: {e}")

    # ========== نظام الصوتيات ==========
    @app_commands.command(name="join", description="انضمام البوت للروم الصوتي")
    async def join_voice(self, interaction: discord.Interaction):
        try:
            if not interaction.user.voice:
                await EmbedHelper.send(interaction, description="❌ يجب أن تكون في روم صوتي!", color=0xFF0000, is_ephemeral=True)
                return
            channel = interaction.user.voice.channel
            if interaction.guild.voice_client:
                if interaction.guild.voice_client.channel == channel:
                    await EmbedHelper.send(interaction, description="✅ البوت موجود بالفعل في رومك!", color=0x00FF00, is_ephemeral=True)
                    return
                await interaction.guild.voice_client.disconnect()
            await channel.connect()
            await EmbedHelper.send(interaction, description=f"✅ تم الانضمام إلى {channel.mention}", color=0x00FF00)
        except Exception as e:
            logger.error(f"❌ join_voice: {e}")
            await EmbedHelper.send(interaction, description="❌ فشل الانضمام للروم الصوتي", color=0xFF0000, is_ephemeral=True)

    @app_commands.command(name="leave", description="مغادرة البوت للروم الصوتي")
    async def leave_voice(self, interaction: discord.Interaction):
        try:
            if interaction.guild.voice_client:
                await interaction.guild.voice_client.disconnect()
                await EmbedHelper.send(interaction, description="✅ تم مغادرة الروم الصوتي", color=0x00FF00)
            else:
                await EmbedHelper.send(interaction, description="❌ البوت ليس في روم صوتي!", color=0xFF0000, is_ephemeral=True)
        except Exception as e:
            logger.error(f"❌ leave_voice: {e}")

    # ========== أمر المساعدة ==========
    @app_commands.command(name="help", description="عرض قائمة المساعدة")
    async def help_command(self, interaction: discord.Interaction):
        embed = EmbedHelper.create(
            title="📚 قائمة المساعدة",
            description="مرحباً بك في بوت الخدمي الشامل!",
            color=0x3498db,
            fields=[
                {"name": "⚙️ الإدارة", "value": "`/set_welcome` `/اضافة_اختصار` `/حذف_اختصار` `/الاختصارات`", "inline": False},
                {"name": "⚠️ التحذيرات", "value": "`+ت @عضو [سبب]` `+شيلت @عضو` `/تحذيرات`", "inline": False},
                {"name": "🎉 القيف أوي", "value": "`/giveaway`", "inline": False},
                {"name": "🔊 الصوتيات", "value": "`/join` `/leave`", "inline": False}
            ],
            footer_text="بوت خدمي متكامل"
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot):
    await bot.add_cog(Management(bot))