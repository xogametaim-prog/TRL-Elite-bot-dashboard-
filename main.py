# ==================== main.py ====================
import sys
import traceback

def handle_exception(exc_type, exc_value, exc_traceback):
    sys.stderr.write("خطأ غير متوقع: ")
    traceback.print_exception(exc_type, exc_value, exc_traceback, file=sys.stderr)

sys.excepthook = handle_exception

import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import asyncio
import os
import random
import time
import json
import threading
from flask import Flask
from datetime import datetime, timedelta
from collections import defaultdict

تطبيق_فلاسك = Flask(__name__)

@تطبيق_فلاسك.route('/')
def الصفحة_الرئيسية():
    return "البوت شغال! الإصدار 2.8"

def تشغيل_الخادم():
    تطبيق_فلاسك.run(host='0.0.0.0', port=8080)

التوكن = os.getenv("DISCORD_TOKEN")
if التوكن is None:
    print("❌ التوكن غير موجود في متغيرات البيئة")
    sys.exit(1)

الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True
الصلاحيات.moderation = True

البوت = commands.Bot(command_prefix="+", intents=الصلاحيات)

بيانات_الدعوات = {}
دعوات_السيرفرات = {}
لعب_الروليت = {}
سجل_الروليت = {}

صورة_الروليت_الانتظار = "https://cdn.discordapp.com/attachments/1507384858652184737/1510379857845031105/1780172460649.png"
صورة_الروليت_النتيجة = "https://cdn.discordapp.com/attachments/1507384858652184737/1510379865059233923/1780172455105.png"

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

async def init_db():
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS server_config (
            guild_id TEXT PRIMARY KEY,
            verify_role TEXT,
            verify_channel TEXT,
            welcome_channel TEXT,
            logs_channel TEXT,
            report_channel TEXT,
            member_count_channel TEXT,
            block_links BOOLEAN DEFAULT 0
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            complaint TEXT,
            created_at INTEGER
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS staff_ratings (
            guild_id TEXT,
            user_id TEXT,
            rating INTEGER,
            created_at INTEGER,
            PRIMARY KEY (guild_id, user_id)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS member_join_log (
            guild_id TEXT,
            date TEXT,
            count INTEGER DEFAULT 0,
            PRIMARY KEY (guild_id, date)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS channel_activity (
            guild_id TEXT,
            channel_id TEXT,
            last_message INTEGER,
            PRIMARY KEY (guild_id, channel_id)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS roulette_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            user_id TEXT,
            user_name TEXT,
            result TEXT,
            created_at INTEGER
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS game_points (
            guild_id TEXT,
            user_id TEXT,
            points INTEGER DEFAULT 0,
            games_won INTEGER DEFAULT 0,
            PRIMARY KEY (guild_id, user_id)
        )''')
        await db.commit()

async def حفظ_سجل_الروليت(guild_id, user_id, user_name, result):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT INTO roulette_history (guild_id, user_id, user_name, result, created_at) VALUES (?, ?, ?, ?, ?)",
                        (str(guild_id), str(user_id), user_name, result, int(time.time())))
        await db.commit()

async def تحديث_نقاط_اللعبة(guild_id, user_id, user_name, points=1):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT INTO game_points (guild_id, user_id, points, games_won) VALUES (?, ?, ?, 1) ON CONFLICT(guild_id, user_id) DO UPDATE SET points = points + ?, games_won = games_won + 1",
                        (str(guild_id), str(user_id), points, points))
        await db.commit()

async def الحصول_على_نقاط_اللاعب(guild_id, user_id):
    async with aiosqlite.connect("server_data.db") as db:
        cursor = await db.execute("SELECT points, games_won FROM game_points WHERE guild_id = ? AND user_id = ?", (str(guild_id), str(user_id)))
        row = await cursor.fetchone()
        if row:
            return {"points": row[0], "games_won": row[1]}
        return {"points": 0, "games_won": 0}

async def تحديث_الدعوات(guild):
    try:
        دعوات_السيرفرات[guild.id] = {inv.code: inv.uses for inv in await guild.invites()}
    except:
        pass

async def تسجيل_نشاط_القناة(guild_id, channel_id):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT OR REPLACE INTO channel_activity (guild_id, channel_id, last_message) VALUES (?, ?, ?)",
                        (str(guild_id), str(channel_id), int(time.time())))
        await db.commit()

async def الحصول_على_عدد_الدعوات(user_id):
    return بيانات_الدعوات.get(str(user_id), 0)

async def الحصول_على_جميع_الدعوات():
    return sorted(بيانات_الدعوات.items(), key=lambda x: x[1], reverse=True)

async def الحصول_على_أعضاء_الرتبة(guild, role):
    members = []
    for member in guild.members:
        if role in member.roles:
            members.append(member)
    return members

class GamePlayer:
    def __init__(self, user_id, user_name):
        self.user_id = user_id
        self.user_name = user_name
        self.is_alive = True

class RouletteGame:
    def __init__(self, bot):
        self.bot = bot
        self.games = {}
    
    async def start_game(self, interaction_or_ctx, is_slash=False):
        if is_slash:
            guild_id = interaction_or_ctx.guild_id
            author = interaction_or_ctx.user
            is_interaction = True
        else:
            guild_id = interaction_or_ctx.guild.id
            author = interaction_or_ctx.author
            is_interaction = False
        
        if guild_id in لعب_الروليت:
            await create_embed(
                interaction_or_ctx if is_interaction else interaction_or_ctx.channel,
                description="❌ هناك لعبة روليت نشطة بالفعل في هذا السيرفر!",
                color=0xFF0000,
                is_ephemeral=True if is_interaction else False
            )
            return
        
        game = RouletteGameSession(self.bot, guild_id, author.id)
        لعب_الروليت[guild_id] = game
        
        if is_interaction:
            await create_embed(
                interaction_or_ctx,
                title=game.get_waiting_embed().title,
                description=game.get_waiting_embed().description,
                color=game.get_waiting_embed().color.value,
                image_url=صورة_الروليت_الانتظار,
                fields=[{"name": f.name, "value": f.value, "inline": f.inline} for f in game.get_waiting_embed().fields],
                footer_text=game.get_waiting_embed().footer.text,
                view=game
            )
            message = await interaction_or_ctx.original_response()
        else:
            message = await interaction_or_ctx.channel.send(embed=game.get_waiting_embed(), view=game)
        
        game.message = message
        await game.start_countdown()

class RouletteGameSession(discord.ui.View):
    def __init__(self, bot, guild_id, host_id):
        super().__init__(timeout=15)
        self.bot = bot
        self.guild_id = guild_id
        self.host_id = host_id
        self.players = []
        self.current_turn_index = 0
        self.message = None
        self.game_active = True
        self.waiting_for_action = False
    
    def get_waiting_embed(self):
        players_list = "\n".join([f"{i+1}. <@{p.user_id}>" for i, p in enumerate(self.players)]) if self.players else "لا يوجد مشتركين بعد"
        embed = discord.Embed(
            title="🎡 روليت السيرفر",
            description=f"**انضم الآن لتجربة حظك!**\nسيتم اختيار شخص واحد ليواجه المصير المحتوم.\n\n**المشتركين ({len(self.players)}):**\n{players_list}",
            color=0xFF6600
        )
        embed.set_image(url=صورة_الروليت_الانتظار)
        embed.add_field(name="⏰ الوقت المتبقي", value="15 ثانية", inline=True)
        embed.set_footer(text=f"بواسطة {self.bot.get_user(self.host_id).display_name if self.bot.get_user(self.host_id) else 'المشرف'}")
        return embed
    
    def get_turn_embed(self):
        current_player = self.players[self.current_turn_index]
        players_list = "\n".join([f"{i+1}. <@{p.user_id}> {'❤️' if p.is_alive else '💀'}" for i, p in enumerate(self.players)])
        embed = discord.Embed(
            title="🎡 روليت السيرفر - دورك الآن!",
            description=f"**دور اللاعب {current_player.user_name}**\n\nاضغط على زر الطرد لاختيار ضحية!\n\n**اللاعبين:**\n{players_list}",
            color=0xFF6600
        )
        embed.set_image(url=صورة_الروليت_الانتظار)
        embed.add_field(name="⏰ الوقت المتبقي", value="15 ثانية", inline=True)
        embed.set_footer(text=f"بواسطة {current_player.user_name}")
        return embed
    
    def get_result_embed(self, kicked_player, kicked_by=None):
        players_list = "\n".join([f"{i+1}. <@{p.user_id}> {'❤️' if p.is_alive else '💀'}" for i, p in enumerate(self.players)])
        
        if kicked_by:
            description = f"**{kicked_by.user_name} قام بطرد {kicked_player.user_name}!**\n\n{len([p for p in self.players if p.is_alive])} لاعب متبقي."
        else:
            description = f"**{kicked_player.user_name} تم طرده تلقائياً لعدم الرد في الوقت المحدد!**\n\n{len([p for p in self.players if p.is_alive])} لاعب متبقي."
        
        embed = discord.Embed(
            title="🎡 نتيجة الروليت",
            description=description,
            color=0xFF0000
        )
        embed.set_image(url=صورة_الروليت_النتيجة)
        embed.add_field(name="👥 اللاعبين المتبقيين", value=players_list, inline=False)
        return embed
    
    def get_final_embed(self, winner):
        embed = discord.Embed(
            title="🎡 انتهت اللعبة!",
            description=f"**الفائز هو {winner.user_name}!**\nتهانينا!",
            color=0x00FF00
        )
        embed.set_image(url=صورة_الروليت_النتيجة)
        return embed
    
    @discord.ui.button(label="🎲 انضم", style=discord.ButtonStyle.success, emoji="🎲")
    async def join_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not self.game_active:
            await create_embed(interaction, description="❌ اللعبة انتهت!", color=0xFF0000, is_ephemeral=True)
            return
        
        if any(p.user_id == interaction.user.id for p in self.players):
            await create_embed(interaction, description="❌ أنت مشترك بالفعل!", color=0xFF0000, is_ephemeral=True)
            return
        
        self.players.append(GamePlayer(interaction.user.id, interaction.user.display_name))
        await create_embed(interaction, description=f"✅ {interaction.user.mention} انضم إلى الروليت!", color=0x00FF00, is_ephemeral=True)
        
        if self.message:
            await self.message.edit(embed=self.get_waiting_embed(), view=self)
    
    @discord.ui.button(label="🚪 غادر", style=discord.ButtonStyle.danger, emoji="🚪")
    async def leave_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not self.game_active:
            await create_embed(interaction, description="❌ اللعبة انتهت!", color=0xFF0000, is_ephemeral=True)
            return
        
        player = next((p for p in self.players if p.user_id == interaction.user.id), None)
        if not player:
            await create_embed(interaction, description="❌ لست مشتركاً في هذه اللعبة!", color=0xFF0000, is_ephemeral=True)
            return
        
        self.players.remove(player)
        await create_embed(interaction, description=f"✅ {interaction.user.mention} غادر الروليت!", color=0x00FF00, is_ephemeral=True)
        
        if self.message:
            await self.message.edit(embed=self.get_waiting_embed(), view=self)
    
    async def start_countdown(self):
        await asyncio.sleep(15)
        
        if not self.game_active:
            return
        
        if len(self.players) < 2:
            if self.message:
                embed = discord.Embed(
                    title="🎡 روليت السيرفر",
                    description="انتهت اللعبة لعدم وجود مشتركين كافيين (يجب أن يكون هناك لاعبين على الأقل)!",
                    color=0xFFAA00
                )
                embed.set_image(url=صورة_الروليت_الانتظار)
                await self.message.edit(embed=embed, view=None)
            
            if self.guild_id in لعب_الروليت:
                del لعب_الروليت[self.guild_id]
            return
        
        self.game_active = True
        await self.start_turn()
    
    async def start_turn(self):
        if not self.game_active:
            return
        
        alive_players = [p for p in self.players if p.is_alive]
        
        if len(alive_players) <= 1:
            winner = alive_players[0] if alive_players else None
            if winner:
                await حفظ_سجل_الروليت(self.guild_id, winner.user_id, winner.user_name, "فائز")
                if self.message:
                    await self.message.edit(embed=self.get_final_embed(winner), view=None)
            else:
                if self.message:
                    embed = discord.Embed(
                        title="🎡 روليت السيرفر",
                        description="انتهت اللعبة!",
                        color=0xFFAA00
                    )
                    embed.set_image(url=صورة_الروليت_النتيجة)
                    await self.message.edit(embed=embed, view=None)
            
            if self.guild_id in لعب_الروليت:
                del لعب_الروليت[self.guild_id]
            return
        
        if self.current_turn_index >= len(self.players):
            self.current_turn_index = 0
        
        while not self.players[self.current_turn_index].is_alive:
            self.current_turn_index = (self.current_turn_index + 1) % len(self.players)
        
        current_player = self.players[self.current_turn_index]
        
        if self.message:
            await self.message.edit(embed=self.get_turn_embed(), view=self)
        
        self.waiting_for_action = True
        self.timeout = 15
        
        await asyncio.sleep(15)
        
        if self.waiting_for_action and self.game_active:
            await self.auto_kick()
    
    async def kick_player(self, interaction, target_player, kicker_player=None):
        if not self.game_active:
            await create_embed(interaction, description="❌ اللعبة انتهت!", color=0xFF0000, is_ephemeral=True)
            return
        
        if self.waiting_for_action == False:
            await create_embed(interaction, description="❌ ليس دورك الآن!", color=0xFF0000, is_ephemeral=True)
            return
        
        current_player = self.players[self.current_turn_index]
        
        if kicker_player:
            if interaction.user.id != kicker_player.user_id:
                await create_embed(interaction, description="❌ ليس دورك!", color=0xFF0000, is_ephemeral=True)
                return
        else:
            if interaction.user.id != current_player.user_id:
                await create_embed(interaction, description="❌ ليس دورك!", color=0xFF0000, is_ephemeral=True)
                return
        
        if not target_player.is_alive:
            await create_embed(interaction, description="❌ هذا اللاعب تم طرده بالفعل!", color=0xFF0000, is_ephemeral=True)
            return
        
        target_player.is_alive = False
        self.waiting_for_action = False
        
        await حفظ_سجل_الروليت(self.guild_id, target_player.user_id, target_player.user_name, "تم الطرد")
        
        if self.message:
            await self.message.edit(embed=self.get_result_embed(target_player, kicker_player or current_player), view=None)
        
        await create_embed(interaction, description=f"✅ {interaction.user.mention} قام بطرد {target_player.user_name}!", color=0x00FF00, is_ephemeral=True)
        
        await asyncio.sleep(3)
        
        self.current_turn_index = (self.current_turn_index + 1) % len(self.players)
        await self.start_turn()
    
    async def auto_kick(self):
        if not self.game_active:
            return
        
        if not self.waiting_for_action:
            return
        
        current_player = self.players[self.current_turn_index]
        
        if current_player.is_alive:
            current_player.is_alive = False
            await حفظ_سجل_الروليت(self.guild_id, current_player.user_id, current_player.user_name, "تم الطرد تلقائياً")
            
            if self.message:
                await self.message.edit(embed=self.get_result_embed(current_player, None), view=None)
            
            await asyncio.sleep(3)
        
        self.waiting_for_action = False
        self.current_turn_index = (self.current_turn_index + 1) % len(self.players)
        await self.start_turn()
    
    @discord.ui.button(label="🔫 طرد عشوائي", style=discord.ButtonStyle.danger, emoji="🔫")
    async def random_kick_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not self.game_active:
            await create_embed(interaction, description="❌ اللعبة انتهت!", color=0xFF0000, is_ephemeral=True)
            return
        
        if not self.waiting_for_action:
            await create_embed(interaction, description="❌ ليس دورك الآن!", color=0xFF0000, is_ephemeral=True)
            return
        
        current_player = self.players[self.current_turn_index]
        
        if interaction.user.id != current_player.user_id:
            await create_embed(interaction, description="❌ ليس دورك!", color=0xFF0000, is_ephemeral=True)
            return
        
        alive_players = [p for p in self.players if p.is_alive and p.user_id != current_player.user_id]
        
        if not alive_players:
            await create_embed(interaction, description="❌ لا يوجد لاعبين آخرين للطرد!", color=0xFF0000, is_ephemeral=True)
            return
        
        target = random.choice(alive_players)
        await self.kick_player(interaction, target, current_player)
    
    @discord.ui.button(label="🎲 طرد لاعب", style=discord.ButtonStyle.primary, emoji="🎲")
    async def kick_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not self.game_active:
            await create_embed(interaction, description="❌ اللعبة انتهت!", color=0xFF0000, is_ephemeral=True)
            return
        
        if not self.waiting_for_action:
            await create_embed(interaction, description="❌ ليس دورك الآن!", color=0xFF0000, is_ephemeral=True)
            return
        
        current_player = self.players[self.current_turn_index]
        
        if interaction.user.id != current_player.user_id:
            await create_embed(interaction, description="❌ ليس دورك!", color=0xFF0000, is_ephemeral=True)
            return
        
        alive_players = [p for p in self.players if p.is_alive and p.user_id != current_player.user_id]
        
        if not alive_players:
            await create_embed(interaction, description="❌ لا يوجد لاعبين آخرين للطرد!", color=0xFF0000, is_ephemeral=True)
            return
        
        view = PlayerSelectView(self, current_player, alive_players)
        embed = discord.Embed(
            title="🎲 اختر لاعباً لطرده",
            description="اختر اللاعب الذي تريد طرده من القائمة أدناه",
            color=0xFF6600
        )
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

class PlayerSelectView(discord.ui.View):
    def __init__(self, game, current_player, players):
        super().__init__(timeout=30)
        self.game = game
        self.current_player = current_player
        self.players = players
        
        select = discord.ui.Select(
            placeholder="اختر لاعباً لطرده...",
            options=[discord.SelectOption(label=p.user_name, value=str(p.user_id)) for p in players[:25]]
        )
        select.callback = self.select_callback
        self.add_item(select)
    
    async def select_callback(self, interaction: discord.Interaction):
        target_id = int(interaction.data["values"][0])
        target = next((p for p in self.players if p.user_id == target_id), None)
        
        if target:
            await self.game.kick_player(interaction, target, self.current_player)
        else:
            await create_embed(interaction, description="❌ حدث خطأ في اختيار اللاعب!", color=0xFF0000, is_ephemeral=True)

class VerifyView(discord.ui.View):
    def __init__(self, role_id):
        super().__init__(timeout=None)
        self.role_id = role_id
    
    @discord.ui.button(label="✅ تحقق", style=discord.ButtonStyle.success, emoji="✅", custom_id="verify_button")
    async def verify_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            role = interaction.guild.get_role(self.role_id)
            if not role:
                await create_embed(interaction, description="❌ رتبة التحقق غير موجودة! يرجى إبلاغ الإدارة.", color=0xFF0000, is_ephemeral=True)
                return
            
            if role in interaction.user.roles:
                await create_embed(interaction, description="✅ أنت بالفعل عضو موثق!", color=0x00FF00, is_ephemeral=True)
                return
            
            await interaction.user.add_roles(role)
            await create_embed(interaction, description="✅ تم التحقق بنجاح! مرحباً بك في السيرفر.", color=0x00FF00, is_ephemeral=True)
            
            async with aiosqlite.connect("server_data.db") as db:
                today = datetime.now().strftime("%Y-%m-%d")
                await db.execute("INSERT INTO member_join_log (guild_id, date, count) VALUES (?, ?, 1) ON CONFLICT(guild_id, date) DO UPDATE SET count = count + 1",
                                (str(interaction.guild_id), today))
                await db.commit()
        except Exception as e:
            await create_embed(interaction, description=f"❌ حدث خطأ: {str(e)}", color=0xFF0000, is_ephemeral=True)

class Games(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.active_games = {}
        self.game_listeners = {}
    
    @app_commands.command(name="game", description="فتح قائمة ألعاب السرعة")
    async def game_command(self, interaction: discord.Interaction):
        if interaction.guild_id in self.active_games:
            await create_embed(interaction, description="❌ هناك لعبة نشطة بالفعل في هذا السيرفر!", color=0xFF0000, is_ephemeral=True)
            return
        
        view = GameSelectionView(self)
        await create_embed(
            interaction,
            title="🎮 قائمة ألعاب السرعة",
            description="اختر لعبة من القائمة أدناه لبدء التحدي!",
            color=0x9B59B6,
            view=view
        )
    
    async def start_game_session(self, interaction, game_name, game_type):
        if interaction.guild_id in self.active_games:
            await create_embed(interaction, description="❌ هناك لعبة نشطة بالفعل!", color=0xFF0000, is_ephemeral=True)
            return
        
        game_data = self.get_game_data(game_type)
        if not game_data:
            await create_embed(interaction, description="❌ لعبة غير معروفة!", color=0xFF0000, is_ephemeral=True)
            return
        
        self.active_games[interaction.guild_id] = {
            "type": game_type,
            "players": {},
            "start_time": time.time(),
            "channel_id": interaction.channel_id,
            "host_id": interaction.user.id
        }
        
        embed_data = {
            "title": f"🎮 {game_name}",
            "description": game_data["description"],
            "color": game_data["color"],
            "image_url": game_data["image_url"],
            "fields": [
                {"name": "⏰ الوقت", "value": f"{game_data['timeout']} ثانية", "inline": True},
                {"name": "👤 بواسطة", "value": interaction.user.mention, "inline": True},
                {"name": "📋 القوانين", "value": game_data["rules"], "inline": False}
            ],
            "footer_text": "أول إجابة صحيحة تفوز!"
        }
        
        await create_embed(interaction, **embed_data)
        
        if interaction.guild_id in self.game_listeners:
            self.bot.remove_listener(self.game_listeners[interaction.guild_id])
        
        listener = self.create_game_listener(interaction.guild_id, game_type)
        self.game_listeners[interaction.guild_id] = listener
        self.bot.add_listener(listener)
        
        asyncio.create_task(self.end_game_after_timeout(interaction.guild_id, game_data["timeout"]))
    
    def create_game_listener(self, guild_id, game_type):
        async def on_message(message):
            if message.guild is None:
                return
            if message.guild.id != guild_id:
                return
            if message.author.bot:
                return
            if guild_id not in self.active_games:
                return
            if message.channel.id != self.active_games[guild_id]["channel_id"]:
                return
            
            game = self.active_games[guild_id]
            if game["type"] != game_type:
                return
            
            is_correct = False
            
            if game_type == "speed_typing":
                target_text = game.get("target_text", "")
                if message.content.strip().lower() == target_text.strip().lower():
                    is_correct = True
            
            elif game_type == "unscramble":
                correct_word = game.get("correct_word", "")
                if message.content.strip().lower() == correct_word.strip().lower():
                    is_correct = True
            
            elif game_type == "math":
                correct_answer = game.get("correct_answer")
                try:
                    user_answer = int(message.content.strip())
                    if user_answer == correct_answer:
                        is_correct = True
                except:
                    pass
            
            elif game_type == "trivia":
                correct_option = game.get("correct_option", "")
                if message.content.strip().lower() == correct_option.lower():
                    is_correct = True
            
            elif game_type == "word_chain":
                last_letter = game.get("last_letter", "")
                if message.content.strip() and message.content.strip()[0].lower() == last_letter.lower():
                    is_correct = True
                    game["last_letter"] = message.content.strip()[-1]
            
            elif game_type == "emoji_guess":
                correct_answer = game.get("correct_answer", "")
                if message.content.strip().lower() == correct_answer.strip().lower():
                    is_correct = True
            
            elif game_type == "fill_blank":
                correct_answer = game.get("correct_answer", "")
                if message.content.strip().lower() == correct_answer.strip().lower():
                    is_correct = True
            
            elif game_type == "reverse_word":
                correct_answer = game.get("correct_answer", "")
                if message.content.strip().lower() == correct_answer.strip().lower():
                    is_correct = True
            
            elif game_type == "categories":
                if message.content.strip():
                    is_correct = True
            
            elif game_type == "first_to_type":
                is_correct = True
            
            if is_correct:
                await self.declare_winner(message)
        
        return on_message
    
    async def declare_winner(self, message):
        guild_id = message.guild.id
        if guild_id not in self.active_games:
            return
        
        game = self.active_games[guild_id]
        winner_id = message.author.id
        winner_name = message.author.display_name
        
        game["winner"] = winner_id
        
        if guild_id in self.game_listeners:
            self.bot.remove_listener(self.game_listeners[guild_id])
            del self.game_listeners[guild_id]
        
        await تحديث_نقاط_اللعبة(guild_id, winner_id, winner_name)
        player_stats = await الحصول_على_نقاط_اللاعب(guild_id, winner_id)
        
        game_names = {
            "speed_typing": "أسرع كاتب",
            "unscramble": "فكك الكلمة",
            "math": "الحساب السريع",
            "trivia": "معلومات عامة",
            "word_chain": "سلسلة الكلمات",
            "emoji_guess": "خمن الإيموجي",
            "fill_blank": "أكمل الفراغ",
            "reverse_word": "الكلمة المعكوسة",
            "categories": "فئات",
            "first_to_type": "أول من يكتب"
        }
        
        game_name = game_names.get(game["type"], "لعبة")
        
        await create_embed(
            message.channel,
            title="🏆 فائز!",
            description=f"**{message.author.mention} فاز في {game_name}!**\n\n📊 **إحصائيات اللاعب:**\n• النقاط: {player_stats['points']}\n• الألعاب التي فاز بها: {player_stats['games_won']}",
            color=0xFFD700,
            footer_text="استخدم /game للعب مرة أخرى"
        )
        
        del self.active_games[guild_id]
    
    async def end_game_after_timeout(self, guild_id, timeout):
        await asyncio.sleep(timeout)
        
        if guild_id not in self.active_games:
            return
        
        game = self.active_games[guild_id]
        
        if "winner" in game:
            return
        
        channel = self.bot.get_channel(game["channel_id"])
        if channel:
            await create_embed(
                channel,
                title="⏰ انتهى الوقت!",
                description="لم يفز أحد في هذه الجولة. حاول مرة أخرى!",
                color=0xFFA500,
                footer_text="استخدم /game للعب مرة أخرى"
            )
        
        if guild_id in self.game_listeners:
            self.bot.remove_listener(self.game_listeners[guild_id])
            del self.game_listeners[guild_id]
        
        del self.active_games[guild_id]
    
    def get_game_data(self, game_type):
        games = {
            "speed_typing": {
                "description": "اكتب النص المعروض بأسرع وقت ممكن! أول من يكتبه بشكل صحيح يفوز.",
                "color": 0x2ECC71,
                "image_url": "https://cdn.discordapp.com/attachments/1507384858652184737/1510379857845031105/1780172460649.png",
                "timeout": 30,
                "rules": "اكتب النص بالضبط كما يظهر."
            },
            "unscramble": {
                "description": "أعد ترتيب الحروف لتكوين كلمة صحيحة!",
                "color": 0xE74C3C,
                "image_url": "https://cdn.discordapp.com/attachments/1507384858652184737/1510379865059233923/1780172455105.png",
                "timeout": 30,
                "rules": "أرسل الكلمة الصحيحة."
            },
            "math": {
                "description": "أجب عن المسألة الحسابية بسرعة!",
                "color": 0x3498DB,
                "image_url": "https://cdn.discordapp.com/attachments/1507384858652184737/1510379857845031105/1780172460649.png",
                "timeout": 20,
                "rules": "أرسل الرقم الصحيح."
            },
            "trivia": {
                "description": "أجب عن سؤال المعلومات العامة!",
                "color": 0xF39C12,
                "image_url": "https://cdn.discordapp.com/attachments/1507384858652184737/1510379865059233923/1780172455105.png",
                "timeout": 30,
                "rules": "أرسل رقم الخيار الصحيح (1، 2، 3، 4)."
            },
            "word_chain": {
                "description": "اكتب كلمة تبدأ بآخر حرف من الكلمة المعطاة!",
                "color": 0x9B59B6,
                "image_url": "https://cdn.discordapp.com/attachments/1507384858652184737/1510379857845031105/1780172460649.png",
                "timeout": 30,
                "rules": "يجب أن تبدأ الكلمة بالحرف الأخير."
            },
            "emoji_guess": {
                "description": "خمن الكلمة أو العبارة من الإيموجي!",
                "color": 0x1ABC9C,
                "image_url": "https://cdn.discordapp.com/attachments/1507384858652184737/1510379865059233923/1780172455105.png",
                "timeout": 30,
                "rules": "أرسل الكلمة الصحيحة."
            },
            "fill_blank": {
                "description": "أكمل الجملة بالكلمة الناقصة!",
                "color": 0xE67E22,
                "image_url": "https://cdn.discordapp.com/attachments/1507384858652184737/1510379857845031105/1780172460649.png",
                "timeout": 25,
                "rules": "أرسل الكلمة الناقصة."
            },
            "reverse_word": {
                "description": "اقرأ الكلمة المعكوسة واكتبها بشكل صحيح!",
                "color": 0xC0392B,
                "image_url": "https://cdn.discordapp.com/attachments/1507384858652184737/1510379865059233923/1780172455105.png",
                "timeout": 30,
                "rules": "اكتب الكلمة بالترتيب الصحيح."
            },
            "categories": {
                "description": "اكتب كلمة تنتمي للفئة المطلوبة!",
                "color": 0x27AE60,
                "image_url": "https://cdn.discordapp.com/attachments/1507384858652184737/1510379857845031105/1780172460649.png",
                "timeout": 30,
                "rules": "يجب أن تنتمي الكلمة للفئة."
            },
            "first_to_type": {
                "description": "أول من يكتب أي شيء يفوز!",
                "color": 0x8E44AD,
                "image_url": "https://cdn.discordapp.com/attachments/1507384858652184737/1510379865059233923/1780172455105.png",
                "timeout": 20,
                "rules": "أي رسالة تعتبر فوزاً."
            }
        }
        return games.get(game_type)
    
    async def prepare_game_challenge(self, guild_id, game_type, channel):
        if game_type == "speed_typing":
            phrases = ["السرعة في الكتابة مهارة مهمة", "البوت يساعد في تنظيم السيرفر", "مرحباً بكم في لعبة أسرع كاتب"]
            target = random.choice(phrases)
            self.active_games[guild_id]["target_text"] = target
            await channel.send(f"📝 **اكتب النص التالي بأسرع وقت:**\n`{target}`")
        
        elif game_type == "unscramble":
            words = ["تفاحة", "مدرسة", "كمبيوتر", "مكتبة", "سيارة"]
            word = random.choice(words)
            scrambled = ''.join(random.sample(word, len(word)))
            self.active_games[guild_id]["correct_word"] = word
            await channel.send(f"🔤 **أعد ترتيب الحروف لتكوين كلمة:**\n`{scrambled}`")
        
        elif game_type == "math":
            a = random.randint(1, 20)
            b = random.randint(1, 20)
            op = random.choice(['+', '-', '*'])
            if op == '+':
                answer = a + b
            elif op == '-':
                answer = a - b
            else:
                answer = a * b
            self.active_games[guild_id]["correct_answer"] = answer
            await channel.send(f"🧮 **ما ناتج:**\n`{a} {op} {b} = ?`")
        
        elif game_type == "trivia":
            questions = [
                {"q": "ما هو أكبر كوكب في المجموعة الشمسية؟", "options": ["1. الأرض", "2. المشتري", "3. زحل", "4. المريخ"], "answer": "2"},
                {"q": "كم عدد أيام السنة الميلادية؟", "options": ["1. 360", "2. 365", "3. 366", "4. 364"], "answer": "2"},
                {"q": "ما هو لون السماء في النهار؟", "options": ["1. أحمر", "2. أزرق", "3. أخضر", "4. أصفر"], "answer": "2"}
            ]
            q = random.choice(questions)
            self.active_games[guild_id]["correct_option"] = q["answer"]
            options_text = "\n".join(q["options"])
            await channel.send(f"❓ **{q['q']}**\n{options_text}")
        
        elif game_type == "word_chain":
            words = ["كتاب", "باب", "بيت", "تفاح", "حديد"]
            word = random.choice(words)
            self.active_games[guild_id]["last_letter"] = word[-1]
            await channel.send(f"🔗 **اكتب كلمة تبدأ بحرف:** `{word[-1]}`\nالكلمة الأصلية: `{word}`")
        
        elif game_type == "emoji_guess":
            challenges = [
                {"emojis": "🏠🐶", "answer": "بيت الكلب"},
                {"emojis": "📚🏫", "answer": "مكتبة المدرسة"},
                {"emojis": "🍎🌳", "answer": "شجرة التفاح"}
            ]
            c = random.choice(challenges)
            self.active_games[guild_id]["correct_answer"] = c["answer"]
            await channel.send(f"😎 **خمن العبارة:**\n{c['emojis']}")
        
        elif game_type == "fill_blank":
            sentences = [
                {"text": "القاهرة عاصمة _____", "answer": "مصر"},
                {"text": "الشمس تشرق من _____", "answer": "الشرق"},
                {"text": "الماء _____ الحياة", "answer": "سر"}
            ]
            s = random.choice(sentences)
            self.active_games[guild_id]["correct_answer"] = s["answer"]
            await channel.send(f"✍️ **أكمل الفراغ:**\n`{s['text']}`")
        
        elif game_type == "reverse_word":
            words = ["سلام", "مدرسة", "قلم", "كتاب", "شمس"]
            word = random.choice(words)
            reversed_word = word[::-1]
            self.active_games[guild_id]["correct_answer"] = word
            await channel.send(f"🔄 **ما هي الكلمة الصحيحة:**\n`{reversed_word}`")
        
        elif game_type == "categories":
            categories = [
                {"name": "فواكه", "examples": "تفاح، برتقال، موز"},
                {"name": "حيوانات", "examples": "أسد، نمر، فيل"},
                {"name": "ألوان", "examples": "أحمر، أزرق، أخضر"}
            ]
            c = random.choice(categories)
            self.active_games[guild_id]["category"] = c["name"]
            await channel.send(f"📂 **اذكر شيئاً من فئة:** `{c['name']}`\nمثال: {c['examples']}")
        
        elif game_type == "first_to_type":
            await channel.send("⚡ **أول من يكتب أي شيء يفوز!**")

class GameSelectionView(discord.ui.View):
    def __init__(self, games_cog):
        super().__init__(timeout=60)
        self.games_cog = games_cog
        
        options = [
            discord.SelectOption(label="أسرع كاتب", value="speed_typing", description="اكتب النص بأسرع وقت", emoji="⌨️"),
            discord.SelectOption(label="فكك الكلمة", value="unscramble", description="أعد ترتيب الحروف", emoji="🔤"),
            discord.SelectOption(label="الحساب السريع", value="math", description="أجب عن المسألة الحسابية", emoji="🧮"),
            discord.SelectOption(label="معلومات عامة", value="trivia", description="أجب عن سؤال معلومات عامة", emoji="❓"),
            discord.SelectOption(label="سلسلة الكلمات", value="word_chain", description="اكتب كلمة تبدأ بالحرف الأخير", emoji="🔗"),
            discord.SelectOption(label="خمن الإيموجي", value="emoji_guess", description="خمن الكلمة من الإيموجي", emoji="😎"),
            discord.SelectOption(label="أكمل الفراغ", value="fill_blank", description="أكمل الجملة بالكلمة الناقصة", emoji="✍️"),
            discord.SelectOption(label="الكلمة المعكوسة", value="reverse_word", description="اقرأ الكلمة المعكوسة", emoji="🔄"),
            discord.SelectOption(label="فئات", value="categories", description="اذكر شيئاً من الفئة", emoji="📂"),
            discord.SelectOption(label="أول من يكتب", value="first_to_type", description="أول رسالة تفوز", emoji="⚡")
        ]
        
        select = discord.ui.Select(
            placeholder="اختر لعبة...",
            options=options
        )
        select.callback = self.select_callback
        self.add_item(select)
    
    async def select_callback(self, interaction: discord.Interaction):
        game_type = interaction.data["values"][0]
        game_names = {
            "speed_typing": "أسرع كاتب",
            "unscramble": "فكك الكلمة",
            "math": "الحساب السريع",
            "trivia": "معلومات عامة",
            "word_chain": "سلسلة الكلمات",
            "emoji_guess": "خمن الإيموجي",
            "fill_blank": "أكمل الفراغ",
            "reverse_word": "الكلمة المعكوسة",
            "categories": "فئات",
            "first_to_type": "أول من يكتب"
        }
        
        await self.games_cog.start_game_session(interaction, game_names[game_type], game_type)
        await self.games_cog.prepare_game_challenge(interaction.guild_id, game_type, interaction.channel)

class HelpView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=60)
    
    @discord.ui.button(label="🎮 الألعاب", style=discord.ButtonStyle.primary, emoji="🎮")
    async def games_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        embed = discord.Embed(
            title="🎮 قائمة ألعاب السرعة",
            description="**الألعاب المتاحة:**\n\n1. ⌨️ **أسرع كاتب** - اكتب النص بأسرع وقت\n2. 🔤 **فكك الكلمة** - أعد ترتيب الحروف\n3. 🧮 **الحساب السريع** - أجب عن المسألة\n4. ❓ **معلومات عامة** - أجب عن السؤال\n5. 🔗 **سلسلة الكلمات** - اكتب كلمة بالحرف الأخير\n6. 😎 **خمن الإيموجي** - خمن من الإيموجي\n7. ✍️ **أكمل الفراغ** - أكمل الجملة\n8. 🔄 **الكلمة المعكوسة** - اقرأ الكلمة المعكوسة\n9. 📂 **فئات** - اذكر شيئاً من الفئة\n10. ⚡ **أول من يكتب** - أسرع رسالة\n\nاستخدم الأمر **/game** لبدء اللعب!",
            color=0x9B59B6
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @discord.ui.button(label="🎡 الروليت", style=discord.ButtonStyle.danger, emoji="🎡")
    async def roulette_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        embed = discord.Embed(
            title="🎡 نظام الروليت",
            description="**أوامر الروليت:**\n\n• **+روليت** - بدء لعبة روليت\n• انضم عبر زر الانضمام\n• اختر ضحيتك في دورك\n\nآخر لاعب يبقى هو الفائز!",
            color=0xFF6600
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @discord.ui.button(label="⚙️ الإدارة", style=discord.ButtonStyle.success, emoji="⚙️")
    async def admin_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        embed = discord.Embed(
            title="⚙️ أوامر الإدارة",
            description="**أوامر الإدارة:**\n\n• **/setup_verify** - إعداد نظام التحقق\n• **/setup_welcome** - إعداد رسالة الترحيب\n• **/setup_logs** - إعداد سجل المراقبة\n• **/setup_reports** - إعداد نظام البلاغات\n• **/block_links** - منع الروابط\n• **/member_count** - عداد الأعضاء\n\n**للمزيد من المساعدة، راجع الإدارة.**",
            color=0x2ECC71
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.command(name="مساعدة")
async def help_command(ctx):
    view = HelpView()
    embed = discord.Embed(
        title="📚 قائمة المساعدة",
        description="مرحباً بك في بوت إدارة السيرفر!\n\nاختر أحد الأزرار أدناه لعرض الأوامر المتاحة.",
        color=0x3498db
    )
    embed.add_field(name="🎮 الألعاب", value="10 ألعاب سرعة ممتعة", inline=True)
    embed.add_field(name="🎡 الروليت", value="لعبة الروليت الجماعية", inline=True)
    embed.add_field(name="⚙️ الإدارة", value="أوامر إدارة السيرفر", inline=True)
    embed.set_footer(text="استخدم /game لبدء الألعاب")
    await ctx.send(embed=embed, view=view)

@bot.event
async def on_ready():
    print(f"✅ تم تشغيل البوت: {bot.user}")
    print(f"📊 عدد السيرفرات: {len(bot.guilds)}")
    
    try:
        synced = await bot.tree.sync()
        print(f"📡 تم مزامنة {len(synced)} أمر")
    except Exception as e:
        print(f"❌ خطأ في مزامنة الأوامر: {e}")
    
    for guild in bot.guilds:
        await تحديث_الدعوات(guild)
    
    try:
        await bot.add_cog(Games(bot))
        print("✅ تم تحميل نظام الألعاب")
    except Exception as e:
        print(f"❌ خطأ في تحميل الألعاب: {e}")
    
    print("✅ البوت جاهز للعمل!")

@bot.event
async def on_guild_join(guild):
    await تحديث_الدعوات(guild)
    print(f"📥 انضم إلى سيرفر: {guild.name}")

@bot.event
async def on_guild_remove(guild):
    if guild.id in دعوات_السيرفرات:
        del دعوات_السيرفرات[guild.id]
    print(f"📤 غادر سيرفر: {guild.name}")

@bot.event
async def on_invite_create(invite):
    await تحديث_الدعوات(invite.guild)

@bot.event
async def on_invite_delete(invite):
    await تحديث_الدعوات(invite.guild)

@bot.event
async def on_member_join(member):
    guild = member.guild
    
    await تحديث_الدعوات(guild)
    
    try:
        async with aiosqlite.connect("server_data.db") as db:
            today = datetime.now().strftime("%Y-%m-%d")
            await db.execute("INSERT INTO member_join_log (guild_id, date, count) VALUES (?, ?, 1) ON CONFLICT(guild_id, date) DO UPDATE SET count = count + 1",
                            (str(guild.id), today))
            await db.commit()
    except Exception as e:
        print(f"خطأ في تسجيل انضمام العضو: {e}")
    
    try:
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT welcome_channel FROM server_config WHERE guild_id = ?", (str(guild.id),))
            result = await cursor.fetchone()
            if result and result[0]:
                channel = guild.get_channel(int(result[0]))
                if channel:
                    await channel.send(f"👋 مرحباً {member.mention} في سيرفر {guild.name}!")
    except Exception as e:
        print(f"خطأ في رسالة الترحيب: {e}")

@bot.event
async def on_member_remove(member):
    guild = member.guild
    await تحديث_الدعوات(guild)

@bot.event
async def on_message(message):
    if message.author.bot:
        return
    
    await تسجيل_نشاط_القناة(message.guild.id, message.channel.id)
    
    await bot.process_commands(message)

@bot.command(name="روليت")
async def roulette_command(ctx):
    roulette_game = RouletteGame(bot)
    await roulette_game.start_game(ctx, is_slash=False)

@bot.tree.command(name="roulette", description="بدء لعبة الروليت")
async def roulette_slash(interaction: discord.Interaction):
    roulette_game = RouletteGame(bot)
    await roulette_game.start_game(interaction, is_slash=True)

@bot.tree.command(name="setup_verify", description="إعداد نظام التحقق")
@app_commands.describe(role="رتبة التحقق", channel="قناة التحقق")
@app_commands.default_permissions(administrator=True)
async def setup_verify(interaction: discord.Interaction, role: discord.Role, channel: discord.TextChannel):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT OR REPLACE INTO server_config (guild_id, verify_role, verify_channel) VALUES (?, ?, ?)",
                        (str(interaction.guild_id), str(role.id), str(channel.id)))
        await db.commit()
    
    view = VerifyView(role.id)
    embed = discord.Embed(
        title="✅ نظام التحقق",
        description=f"اضغط على الزر أدناه للتحقق والحصول على رتبة {role.mention}",
        color=0x00FF00
    )
    await channel.send(embed=embed, view=view)
    await create_embed(interaction, description=f"✅ تم إعداد نظام التحقق في {channel.mention} مع رتبة {role.mention}", color=0x00FF00, is_ephemeral=True)

@bot.tree.command(name="setup_welcome", description="إعداد قناة الترحيب")
@app_commands.describe(channel="قناة الترحيب")
@app_commands.default_permissions(administrator=True)
async def setup_welcome(interaction: discord.Interaction, channel: discord.TextChannel):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT INTO server_config (guild_id, welcome_channel) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET welcome_channel = ?",
                        (str(interaction.guild_id), str(channel.id), str(channel.id)))
        await db.commit()
    await create_embed(interaction, description=f"✅ تم إعداد قناة الترحيب: {channel.mention}", color=0x00FF00, is_ephemeral=True)

@bot.tree.command(name="setup_logs", description="إعداد قناة السجلات")
@app_commands.describe(channel="قناة السجلات")
@app_commands.default_permissions(administrator=True)
async def setup_logs(interaction: discord.Interaction, channel: discord.TextChannel):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT INTO server_config (guild_id, logs_channel) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET logs_channel = ?",
                        (str(interaction.guild_id), str(channel.id), str(channel.id)))
        await db.commit()
    await create_embed(interaction, description=f"✅ تم إعداد قناة السجلات: {channel.mention}", color=0x00FF00, is_ephemeral=True)

@bot.tree.command(name="setup_reports", description="إعداد قناة البلاغات")
@app_commands.describe(channel="قناة البلاغات")
@app_commands.default_permissions(administrator=True)
async def setup_reports(interaction: discord.Interaction, channel: discord.TextChannel):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT INTO server_config (guild_id, report_channel) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET report_channel = ?",
                        (str(interaction.guild_id), str(channel.id), str(channel.id)))
        await db.commit()
    await create_embed(interaction, description=f"✅ تم إعداد قناة البلاغات: {channel.mention}", color=0x00FF00, is_ephemeral=True)

@bot.tree.command(name="block_links", description="تشغيل/إيقاف منع الروابط")
@app_commands.describe(status="حالة منع الروابط")
@app_commands.choices(status=[app_commands.Choice(name="تشغيل", value="1"), app_commands.Choice(name="إيقاف", value="0")])
@app_commands.default_permissions(administrator=True)
async def block_links(interaction: discord.Interaction, status: str):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT INTO server_config (guild_id, block_links) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET block_links = ?",
                        (str(interaction.guild_id), int(status), int(status)))
        await db.commit()
    state = "تشغيل" if status == "1" else "إيقاف"
    await create_embed(interaction, description=f"✅ تم {state} منع الروابط", color=0x00FF00, is_ephemeral=True)

@bot.tree.command(name="member_count", description="إعداد عداد الأعضاء")
@app_commands.describe(channel="قناة عداد الأعضاء")
@app_commands.default_permissions(administrator=True)
async def member_count(interaction: discord.Interaction, channel: discord.VoiceChannel):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT INTO server_config (guild_id, member_count_channel) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET member_count_channel = ?",
                        (str(interaction.guild_id), str(channel.id), str(channel.id)))
        await db.commit()
    
    member_count_val = len(interaction.guild.members)
    await channel.edit(name=f"👥 الأعضاء: {member_count_val}")
    await create_embed(interaction, description=f"✅ تم إعداد عداد الأعضاء في: {channel.mention}", color=0x00FF00, is_ephemeral=True)

@bot.tree.command(name="points", description="عرض نقاط الألعاب الخاصة بك")
async def points_command(interaction: discord.Interaction):
    stats = await الحصول_على_نقاط_اللاعب(interaction.guild_id, interaction.user.id)
    await create_embed(
        interaction,
        title="📊 إحصائيات الألعاب",
        description=f"**{interaction.user.mention}**\n\n🏆 **النقاط:** {stats['points']}\n🎮 **الألعاب التي فاز بها:** {stats['games_won']}",
        color=0xFFD700,
        is_ephemeral=True
    )

@bot.tree.command(name="leaderboard", description="عرض لوحة صدارة الألعاب")
async def leaderboard_command(interaction: discord.Interaction):
    async with aiosqlite.connect("server_data.db") as db:
        cursor = await db.execute("SELECT user_id, points FROM game_points WHERE guild_id = ? ORDER BY points DESC LIMIT 10", (str(interaction.guild_id),))
        rows = await cursor.fetchall()
    
    if not rows:
        await create_embed(interaction, description="لا توجد بيانات بعد!", color=0xFFA500, is_ephemeral=True)
        return
    
    leaderboard_text = ""
    for i, row in enumerate(rows):
        user = interaction.guild.get_member(int(row[0]))
        user_name = user.display_name if user else "غير معروف"
        leaderboard_text += f"{i+1}. {user_name} - {row[1]} نقطة\n"
    
    await create_embed(
        interaction,
        title="🏆 لوحة صدارة الألعاب",
        description=leaderboard_text,
        color=0xFFD700,
        is_ephemeral=True
    )

if __name__ == "__main__":
    threading.Thread(target=تشغيل_الخادم, daemon=True).start()
    asyncio.run(init_db())
    try:
        bot.run(التوكن)
    except Exception as e:
        print(f"❌ خطأ في تشغيل البوت: {e}")
        sys.exit(1)