# ==================== management.py ====================
import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import asyncio
import random
import time
import json
import os
import logging
from datetime import datetime

logger = logging.getLogger('discord_bot')

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
            return None

class Management(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.db_path = "bots_database.db"
        self.giveaway_tasks = {}

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('''CREATE TABLE IF NOT EXISTS all_bots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_name TEXT NOT NULL,
                bot_category TEXT NOT NULL,
                description_ar TEXT,
                description_en TEXT,
                invite_link TEXT,
                keywords TEXT
            )''')
            await db.execute('CREATE INDEX IF NOT EXISTS idx_keywords ON all_bots(keywords)')
            await db.execute('CREATE INDEX IF NOT EXISTS idx_category ON all_bots(bot_category)')
            await db.execute('CREATE INDEX IF NOT EXISTS idx_name ON all_bots(bot_name)')
            await db.execute('''CREATE TABLE IF NOT EXISTS giveaways (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                channel_id TEXT,
                message_id TEXT,
                prize TEXT,
                language TEXT DEFAULT 'ar',
                emoji TEXT DEFAULT '🎉',
                end_time INTEGER,
                winners_count INTEGER DEFAULT 1,
                is_active BOOLEAN DEFAULT 1
            )''')
            await db.commit()
        logger.info("✅ تم تهيئة قاعدة البيانات")

    async def import_bots_from_json(self, filepath="bots_data.json"):
        if not os.path.exists(filepath):
            logger.warning(f"⚠️ ملف {filepath} غير موجود")
            return
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("SELECT COUNT(*) FROM all_bots")
            if (await cursor.fetchone())[0] > 0:
                logger.info("📊 قاعدة البيانات تحتوي على بوتات مسبقاً")
                return
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            bots = data if isinstance(data, list) else data.get("bots", [])
            for bot in bots:
                await db.execute(
                    "INSERT INTO all_bots (bot_name, bot_category, description_ar, description_en, invite_link, keywords) VALUES (?, ?, ?, ?, ?, ?)",
                    (bot.get("name", ""), bot.get("category", ""), bot.get("desc_ar", ""), bot.get("desc_en", ""), bot.get("link", ""), bot.get("keywords", ""))
                )
            await db.commit()
            logger.info(f"✅ تم استيراد {len(bots)} بوت")

    async def search_bots(self, query, limit=10):
        async with aiosqlite.connect(self.db_path) as db:
            like_query = f"%{query}%"
            cursor = await db.execute(
                "SELECT bot_name, bot_category, description_ar, description_en, invite_link FROM all_bots WHERE bot_name LIKE ? OR keywords LIKE ? OR bot_category LIKE ? OR description_ar LIKE ? OR description_en LIKE ? LIMIT ?",
                (like_query, like_query, like_query, like_query, like_query, limit)
            )
            return await cursor.fetchall()

    async def restore_giveaways(self):
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("SELECT * FROM giveaways WHERE is_active = 1")
            rows = await cursor.fetchall()
        for row in rows:
            gid, cid, mid, prize, lang, emoji, end_time, winners, _ = row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9]
            remaining = end_time - time.time()
            if remaining <= 0:
                await self.end_giveaway(gid, cid, mid, prize, lang, emoji, winners)
            else:
                task = asyncio.create_task(self._schedule_giveaway(gid, cid, mid, prize, lang, emoji, winners, remaining))
                self.giveaway_tasks[f"{gid}-{mid}"] = task

    async def _schedule_giveaway(self, gid, cid, mid, prize, lang, emoji, winners, delay):
        await asyncio.sleep(delay)
        await self.end_giveaway(gid, cid, mid, prize, lang, emoji, winners)

    async def end_giveaway(self, guild_id, channel_id, message_id, prize, lang, emoji, winners_count):
        guild = self.bot.get_guild(int(guild_id))
        if not guild: return
        channel = guild.get_channel(int(channel_id))
        if not channel: return
        try: msg = await channel.fetch_message(int(message_id))
        except: msg = None

        participants = []
        if msg:
            for reaction in msg.reactions:
                if str(reaction.emoji) == emoji:
                    async for user in reaction.users():
                        if not user.bot:
                            participants.append(user)
                    break

        if participants:
            actual = min(winners_count, len(participants))
            winners = random.sample(participants, actual)
        else:
            winners = []

        if lang == "en":
            title = f"🎉 Giveaway Ended: {prize}"
            if winners:
                winners_mentions = " ".join([w.mention for w in winners])
                desc = f"**Congratulations!** {winners_mentions}\nYou won the giveaway for: **{prize}**!"
            else:
                desc = f"No one participated in the giveaway for: **{prize}**!"
        else:
            title = f"🎉 انتهى السحب: {prize}"
            if winners:
                winners_mentions = " ".join([w.mention for w in winners])
                desc = f"**مبروك!** {winners_mentions}\nلقد فزت في سحب: **{prize}**!"
            else:
                desc = f"لم يشارك أحد في سحب: **{prize}**!"

        embed = EmbedHelper.create(title=title, description=desc, color=0xFFD700)
        if msg: await msg.reply(embed=embed)
        else: await channel.send(embed=embed)

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("UPDATE giveaways SET is_active = 0 WHERE guild_id = ? AND message_id = ?", (guild_id, message_id))
            await db.commit()
        if f"{guild_id}-{message_id}" in self.giveaway_tasks:
            del self.giveaway_tasks[f"{guild_id}-{message_id}"]

    @commands.Cog.listener()
    async def on_ready(self):
        await self.init_db()
        await self.import_bots_from_json()
        await self.restore_giveaways()
        logger.info("✅ Management جاهز")

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot or not message.guild: return
        msg = message.content.strip()
        if any(p in msg for p in ["أبي بوت", "بدي بوت", "ابغى بوت", "اقترح بوت", "search bot", "find bot"]):
            embed = EmbedHelper.create(
                title="🤖 Bot Advisor | مستشار البوتات",
                description=f"أهلاً {message.author.mention}!\nاستخدم **/search_bot** للبحث عن أي بوت.\n\nHello! Use **/search_bot** to find any bot.",
                color=0x9B59B6,
                footer_text="Bot Advisor • مستشار البوتات"
            )
            await message.reply(embed=embed, mention_author=False)

    @app_commands.command(name="search_bot", description="البحث عن بوت | Search for a bot")
    @app_commands.describe(query="اسم البوت أو نوعه", language="اللغة (اختياري)")
    @app_commands.choices(language=[
        app_commands.Choice(name="العربية", value="ar"),
        app_commands.Choice(name="English", value="en")
    ])
    async def search_bot(self, interaction: discord.Interaction, query: str, language: str = None):
        await interaction.response.defer()
        try:
            results = await self.search_bots(query.strip())
            if not results:
                if language == "en":
                    title, desc = f"❌ No results: {query}", "No bots found. Try another search!"
                else:
                    title, desc = f"❌ لا نتائج: {query}", "لم أجد بوتات. جرب كلمة أخرى!"
                await interaction.followup.send(embed=EmbedHelper.create(title=title, description=desc, color=0xFF0000))
                return

            if language == "en":
                title, desc = f"🔍 Results: {query}", f"Found **{len(results)}** bots:"
            else:
                title, desc = f"🔍 نتائج: {query}", f"تم العثور على **{len(results)}** بوت:"

            fields = []
            for i, (name, cat, desc_ar, desc_en, link) in enumerate(results, 1):
                bot_desc = (desc_en or desc_ar or "...") if language == "en" else (desc_ar or desc_en or "...")
                fields.append({
                    "name": f"{i}. {name}",
                    "value": f"📂 {cat}\n{bot_desc[:150]}\n[🔗 Invite | دعوة]({link or '#'})",
                    "inline": False
                })

            await interaction.followup.send(embed=EmbedHelper.create(title=title, description=desc, color=0x9B59B6, fields=fields, footer_text="Bot Advisor"))
        except Exception as e:
            logger.error(f"❌ search_bot: {e}")
            await interaction.followup.send(embed=EmbedHelper.create(description="❌ خطأ داخلي!", color=0xFF0000))

    @app_commands.command(name="giveaway", description="إنشاء سحب | Create Giveaway")
    @app_commands.describe(
        prize="الجائزة | Prize",
        duration="المدة بالدقائق | Duration (minutes)",
        language="اللغة | Language",
        winners="عدد الفائزين | Winners (default 1)",
        emoji="إيموجي التفاعل | Emoji (default 🎉)"
    )
    @app_commands.choices(language=[
        app_commands.Choice(name="العربية", value="ar"),
        app_commands.Choice(name="English", value="en")
    ])
    @app_commands.default_permissions(administrator=True)
    async def giveaway(self, interaction: discord.Interaction, prize: str, duration: int, language: str = "ar", winners: int = 1, emoji: str = "🎉"):
        await interaction.response.defer()
        try:
            end = int(time.time() + (duration * 60))
            if language == "en":
                title = f"🎉 Giveaway: {prize}"
                desc = f"**Prize:** {prize}\n**Duration:** {duration} min\n**Winners:** {winners}\n**React with:** {emoji}"
                footer = "React to enter!"
            else:
                title = f"🎉 سحب: {prize}"
                desc = f"**الجائزة:** {prize}\n**المدة:** {duration} دقيقة\n**الفائزين:** {winners}\n**تفاعل بـ:** {emoji}"
                footer = "تفاعل للدخول!"

            embed = EmbedHelper.create(
                title=title,
                description=desc,
                color=0x9B59B6,
                fields=[
                    {"name": "⏰ Ends | ينتهي", "value": f"<t:{end}:R>", "inline": True},
                    {"name": "👤 Host | المستضيف", "value": interaction.user.mention, "inline": True}
                ],
                footer_text=footer
            )
            await interaction.followup.send(embed=embed)
            msg = await interaction.original_response()
            await msg.add_reaction(emoji)

            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "INSERT INTO giveaways (guild_id, channel_id, message_id, prize, language, emoji, end_time, winners_count, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
                    (str(interaction.guild_id), str(interaction.channel_id), str(msg.id), prize, language, emoji, end, winners)
                )
                await db.commit()

            task = asyncio.create_task(self._schedule_giveaway(str(interaction.guild_id), str(interaction.channel_id), str(msg.id), prize, language, emoji, winners, duration * 60))
            self.giveaway_tasks[f"{interaction.guild_id}-{msg.id}"] = task
        except Exception as e:
            logger.error(f"❌ giveaway: {e}")
            await interaction.followup.send(embed=EmbedHelper.create(description="❌ خطأ داخلي!", color=0xFF0000))

    @app_commands.command(name="help", description="المساعدة | Help")
    async def help_command(self, interaction: discord.Interaction):
        embed = EmbedHelper.create(
            title="📚 المساعدة | Help",
            description="بوت مستشار البوتات والقيف أوي",
            color=0x3498db,
            fields=[
                {"name": "🔍 بحث", "value": "`/search_bot` - ابحث عن أي بوت", "inline": False},
                {"name": "🎉 سحب", "value": "`/giveaway` - إنشاء قيف أوي", "inline": False},
                {"name": "💬 شات", "value": "اكتب 'أبي بوت' أو 'find bot'", "inline": False}
            ],
            footer_text="Bot Advisor • شغال 24 ساعة"
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot):
    await bot.add_cog(Management(bot))