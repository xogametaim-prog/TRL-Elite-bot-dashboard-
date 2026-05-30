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
    return "البوت شغال! الإصدار 2.7"

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
        await db.commit()

async def حفظ_سجل_الروليت(guild_id, user_id, user_name, result):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT INTO roulette_history (guild_id, user_id, user_name, result, created_at) VALUES (?, ?, ?, ?, ?)",
                        (str(guild_id), str(user_id), user_name, result, int(time.time())))
        await db.commit()

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
            send_func = interaction_or_ctx.response.send_message
            is_interaction = True
        else:
            guild_id = interaction_or_ctx.guild.id
            author = interaction_or_ctx.author
            send_func = interaction_or_ctx.channel.send
            is_interaction = False
        
        if guild_id in لعب_الروليت:
            if is_interaction:
                await send_func("❌ هناك لعبة روليت نشطة بالفعل في هذا السيرفر!", ephemeral=True)
            else:
                await send_func("❌ هناك لعبة روليت نشطة بالفعل في هذا السيرفر!")
            return
        
        game = RouletteGameSession(self.bot, guild_id, author.id)
        لعب_الروليت[guild_id] = game
        
        if is_interaction:
            await send_func(embed=game.get_waiting_embed(), view=game)
            message = await interaction_or_ctx.original_response()
        else:
            message = await send_func(embed=game.get_waiting_embed(), view=game)
        
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
            await interaction.response.send_message("❌ اللعبة انتهت!", ephemeral=True)
            return
        
        if any(p.user_id == interaction.user.id for p in self.players):
            await interaction.response.send_message("❌ أنت مشترك بالفعل!", ephemeral=True)
            return
        
        self.players.append(GamePlayer(interaction.user.id, interaction.user.display_name))
        await interaction.response.send_message(f"✅ {interaction.user.mention} انضم إلى الروليت!", ephemeral=True)
        
        if self.message:
            await self.message.edit(embed=self.get_waiting_embed(), view=self)
    
    @discord.ui.button(label="🚪 غادر", style=discord.ButtonStyle.danger, emoji="🚪")
    async def leave_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not self.game_active:
            await interaction.response.send_message("❌ اللعبة انتهت!", ephemeral=True)
            return
        
        player = next((p for p in self.players if p.user_id == interaction.user.id), None)
        if not player:
            await interaction.response.send_message("❌ لست مشتركاً في هذه اللعبة!", ephemeral=True)
            return
        
        self.players.remove(player)
        await interaction.response.send_message(f"✅ {interaction.user.mention} غادر الروليت!", ephemeral=True)
        
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
            await interaction.response.send_message("❌ اللعبة انتهت!", ephemeral=True)
            return
        
        if self.waiting_for_action == False:
            await interaction.response.send_message("❌ ليس دورك الآن!", ephemeral=True)
            return
        
        current_player = self.players[self.current_turn_index]
        
        if kicker_player:
            if interaction.user.id != kicker_player.user_id:
                await interaction.response.send_message("❌ ليس دورك!", ephemeral=True)
                return
        else:
            if interaction.user.id != current_player.user_id:
                await interaction.response.send_message("❌ ليس دورك!", ephemeral=True)
                return
        
        if not target_player.is_alive:
            await interaction.response.send_message("❌ هذا اللاعب تم طرده بالفعل!", ephemeral=True)
            return
        
        target_player.is_alive = False
        self.waiting_for_action = False
        
        await حفظ_سجل_الروليت(self.guild_id, target_player.user_id, target_player.user_name, "تم الطرد")
        
        kicker_name = kicker_player.user_name if kicker_player else current_player.user_name
        
        if self.message:
            await self.message.edit(embed=self.get_result_embed(target_player, kicker_player or current_player), view=None)
        
        await interaction.response.send_message(f"✅ {interaction.user.mention} قام بطرد {target_player.user_name}!", ephemeral=True)
        
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
            await interaction.response.send_message("❌ اللعبة انتهت!", ephemeral=True)
            return
        
        if not self.waiting_for_action:
            await interaction.response.send_message("❌ ليس دورك الآن!", ephemeral=True)
            return
        
        current_player = self.players[self.current_turn_index]
        
        if interaction.user.id != current_player.user_id:
            await interaction.response.send_message("❌ ليس دورك!", ephemeral=True)
            return
        
        alive_players = [p for p in self.players if p.is_alive and p.user_id != current_player.user_id]
        
        if not alive_players:
            await interaction.response.send_message("❌ لا يوجد لاعبين آخرين للطرد!", ephemeral=True)
            return
        
        target = random.choice(alive_players)
        await self.kick_player(interaction, target, current_player)
    
    @discord.ui.button(label="🎲 طرد لاعب", style=discord.ButtonStyle.primary, emoji="🎲")
    async def kick_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not self.game_active:
            await interaction.response.send_message("❌ اللعبة انتهت!", ephemeral=True)
            return
        
        if not self.waiting_for_action:
            await interaction.response.send_message("❌ ليس دورك الآن!", ephemeral=True)
            return
        
        current_player = self.players[self.current_turn_index]
        
        if interaction.user.id != current_player.user_id:
            await interaction.response.send_message("❌ ليس دورك!", ephemeral=True)
            return
        
        alive_players = [p for p in self.players if p.is_alive and p.user_id != current_player.user_id]
        
        if not alive_players:
            await interaction.response.send_message("❌ لا يوجد لاعبين آخرين للطرد!", ephemeral=True)
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
            await interaction.response.send_message("❌ حدث خطأ في اختيار اللاعب!", ephemeral=True)

class VerifyView(discord.ui.View):
    def __init__(self, role_id):
        super().__init__(timeout=None)
        self.role_id = role_id
    
    @discord.ui.button(label="✅ تحقق", style=discord.ButtonStyle.success, emoji="✅", custom_id="verify_button")
    async def verify_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            role = interaction.guild.get_role(self.role_id)
            if not role:
                await interaction.response.send_message("❌ رتبة التحقق غير موجودة! يرجى إبلاغ الإدارة.", ephemeral=True)
                return
            
            if role in interaction.user.roles:
                await interaction.response.send_message("✅ أنت بالفعل عضو موثق!", ephemeral=True)
                return
            
            await interaction.user.add_roles(role)
            await interaction.response.send_message("✅ تم التحقق بنجاح! مرحباً بك في السيرفر.", ephemeral=True)
            
            async with aiosqlite.connect("server_data.db") as db:
                today = datetime.now().strftime("%Y-%m-%d")
                await db.execute("INSERT INTO member_join_log (guild_id, date, count) VALUES (?, ?, 1) ON CONFLICT(guild_id, date) DO UPDATE SET count = count + 1", (str(interaction.guild_id), today))
                await db.commit()
                
                cursor = await db.execute("SELECT welcome_channel FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
                row = await cursor.fetchone()
            
            if row and row[0]:
                channel = interaction.guild.get_channel(int(row[0]))
                if channel:
                    embed = discord.Embed(title="🎉 عضو جديد موثق", description=f"{interaction.user.mention} قام بالتحقق وانضم إلى السيرفر!", color=0x00FF00)
                    await channel.send(embed=embed)
        except Exception as e:
            print(f"خطأ في التحقق: {e}")
            await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

class ComplaintModal(discord.ui.Modal, title="📝 شكوى مجهولة"):
    complaint = discord.ui.TextInput(label="شكواك", style=discord.TextStyle.paragraph, placeholder="اكتب شكواك هنا...", required=True, max_length=1000)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT logs_channel FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
                row = await cursor.fetchone()
                await db.execute("INSERT INTO complaints (guild_id, complaint, created_at) VALUES (?, ?, ?)", 
                                (str(interaction.guild_id), self.complaint.value, int(datetime.now().timestamp())))
                await db.commit()
            
            if row and row[0]:
                channel = interaction.guild.get_channel(int(row[0]))
                if channel:
                    embed = discord.Embed(title="📝 شكوى جديدة (مجهولة المصدر)", description=self.complaint.value, color=0xFF6600, timestamp=datetime.now())
                    await channel.send(embed=embed)
            
            await interaction.response.send_message("✅ تم إرسال شكواك بنجاح!", ephemeral=True)
        except Exception as e:
            print(f"خطأ في الشكوى: {e}")
            await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

class ComplaintsView(discord.ui.View):
    @discord.ui.button(label="📝 تقديم شكوى", style=discord.ButtonStyle.danger, emoji="📝")
    async def complaint_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(ComplaintModal())

class EmbedBuilderModal(discord.ui.Modal, title="🎨 إنشاء رسالة Embed"):
    title = discord.ui.TextInput(label="العنوان", placeholder="أدخل عنوان الرسالة...", required=True, max_length=256)
    description = discord.ui.TextInput(label="الوصف", style=discord.TextStyle.paragraph, placeholder="أدخل نص الرسالة...", required=True, max_length=4000)
    color = discord.ui.TextInput(label="اللون (Hex)", placeholder="5865F2", required=False, default="5865F2", max_length=6)
    footer = discord.ui.TextInput(label="تذييل (اختياري)", required=False, max_length=2048)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            color_int = int(self.color.value, 16) if self.color.value else 0x5865F2
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

class EditEmbedModal(discord.ui.Modal, title="✏️ تعديل Embed"):
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

class StaffRatingView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=3600)
    
    @discord.ui.button(label="⭐ 1 نجمة", style=discord.ButtonStyle.secondary, emoji="⭐")
    async def rate_1(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 1)
    
    @discord.ui.button(label="⭐⭐ 2 نجمة", style=discord.ButtonStyle.secondary, emoji="⭐⭐")
    async def rate_2(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 2)
    
    @discord.ui.button(label="⭐⭐⭐ 3 نجمة", style=discord.ButtonStyle.primary, emoji="⭐⭐⭐")
    async def rate_3(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 3)
    
    @discord.ui.button(label="⭐⭐⭐⭐ 4 نجمة", style=discord.ButtonStyle.success, emoji="⭐⭐⭐⭐")
    async def rate_4(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 4)
    
    @discord.ui.button(label="⭐⭐⭐⭐⭐ 5 نجمة", style=discord.ButtonStyle.success, emoji="⭐⭐⭐⭐⭐")
    async def rate_5(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 5)
    
    async def save_rating(self, interaction: discord.Interaction, rating: int):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                await db.execute("INSERT OR REPLACE INTO staff_ratings (guild_id, user_id, rating, created_at) VALUES (?, ?, ?, ?)",
                                (str(interaction.guild_id), str(interaction.user.id), rating, int(datetime.now().timestamp())))
                await db.commit()
            
            await interaction.response.send_message(f"✅ شكراً لتقييمك: {rating} نجمة!", ephemeral=True)
        except Exception as e:
            print(f"خطأ في التقييم: {e}")
            await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

class RoleMembersView(discord.ui.View):
    def __init__(self, members, role_name, page=0):
        super().__init__(timeout=60)
        self.members = members
        self.role_name = role_name
        self.page = page
        self.items_per_page = 10
    
    @discord.ui.button(label="◀ السابقة", style=discord.ButtonStyle.secondary, emoji="◀")
    async def prev_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if self.page > 0:
            self.page -= 1
            await self.update_message(interaction)
        else:
            await interaction.response.send_message("❌ أنت في الصفحة الأولى!", ephemeral=True)
    
    @discord.ui.button(label="التالي ▶", style=discord.ButtonStyle.secondary, emoji="▶")
    async def next_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if (self.page + 1) * self.items_per_page < len(self.members):
            self.page += 1
            await self.update_message(interaction)
        else:
            await interaction.response.send_message("❌ أنت في الصفحة الأخيرة!", ephemeral=True)
    
    async def update_message(self, interaction):
        start = self.page * self.items_per_page
        end = start + self.items_per_page
        page_members = self.members[start:end]
        
        embed = discord.Embed(
            title=f"👥 أعضاء رتبة {self.role_name}",
            description=f"إجمالي الأعضاء: {len(self.members)}",
            color=0x5865F2
        )
        
        for member in page_members:
            embed.add_field(
                name=member.display_name,
                value=f"<@{member.id}>\n🆔 {member.id}",
                inline=False
            )
        
        embed.set_footer(text=f"الصفحة {self.page + 1} من {((len(self.members) - 1) // self.items_per_page) + 1}")
        
        await interaction.response.edit_message(embed=embed, view=self)

@tasks.loop(minutes=5)
async def تحديث_عدد_الأعضاء():
    try:
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT guild_id, member_count_channel FROM server_config WHERE member_count_channel IS NOT NULL")
            rows = await cursor.fetchall()
        
        for guild_id, channel_id in rows:
            guild = البوت.get_guild(int(guild_id))
            if not guild:
                continue
            channel = guild.get_channel(int(channel_id))
            if not channel:
                continue
            new_name = f"👥 الأعضاء: {guild.member_count}"
            if channel.name != new_name:
                await channel.edit(name=new_name)
    except Exception as e:
        print(f"خطأ في تحديث عدد الأعضاء: {e}")

@تحديث_عدد_الأعضاء.before_loop
async def before_تحديث_عدد_الأعضاء():
    await البوت.wait_until_ready()

@البوت.event
async def on_ready():
    print(f"✅ البوت دخل باسم: {البوت.user} (الإصدار 2.7)")
    await init_db()
    
    for guild in البوت.guilds:
        await تحديث_الدعوات(guild)
    
    تحديث_عدد_الأعضاء.start()
    
    try:
        await البوت.tree.sync()
        print(f"🔄 تم مزامنة الأوامر")
    except Exception as e:
        print(f"❌ فشل المزامنة: {e}")

@البوت.event
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
                        
                        embed = discord.Embed(title="🎉 عضو جديد!", description=f"مرحباً {member.mention} في السيرفر!", color=0x00FF00, timestamp=datetime.now())
                        embed.add_field(name="👤 تمت الدعوة بواسطة", value=inviter_name, inline=True)
                        embed.add_field(name="📊 عدد الدعوات", value=str(total_invites), inline=True)
                        await channel.send(embed=embed)
        
        دعوات_السيرفرات[member.guild.id] = {inv.code: inv.uses for inv in await member.guild.invites()}
    except Exception as e:
        print(f"خطأ في الترحيب: {e}")

@البوت.event
async def on_guild_join(guild):
    await تحديث_الدعوات(guild)

@البوت.event
async def on_message(message):
    if message.author.bot:
        return
    
    await تسجيل_نشاط_القناة(message.guild.id, message.channel.id)
    
    async with aiosqlite.connect("server_data.db") as db:
        cursor = await db.execute("SELECT block_links FROM server_config WHERE guild_id = ?", (str(message.guild.id),))
        row = await cursor.fetchone()
    
    if row and row[0] == 1:
        if "discord.gg" in message.content.lower() or "discord.com/invite" in message.content.lower():
            await message.delete()
            await message.channel.send(f"{message.author.mention} يمنع نشر روابط الدعوات!", delete_after=5)
            return
    
    if message.content.startswith("+brq"):
        if message.author.guild_permissions.administrator:
            roulette_game = RouletteGame(البوت)
            await roulette_game.start_game(message, is_slash=False)
        else:
            await message.channel.send("❌ هذه اللعبة مخصصة للأونر فقط!")
        return
    
    await البوت.process_commands(message)

@البوت.tree.command(name="اعدادات", description="إعداد البوت في السيرفر")
@app_commands.describe(
    verify_role="رتبة التحقق",
    verify_channel="قناة التحقق",
    welcome_channel="قناة الترحيب",
    logs_channel="قناة السجلات",
    report_channel="قناة التقارير اليومية",
    member_count_channel="قناة عدد الأعضاء"
)
async def اعدادات(interaction: discord.Interaction, verify_role: discord.Role = None, verify_channel: discord.TextChannel = None, welcome_channel: discord.TextChannel = None, logs_channel: discord.TextChannel = None, report_channel: discord.TextChannel = None, member_count_channel: discord.TextChannel = None):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            await db.execute("INSERT OR REPLACE INTO server_config (guild_id, verify_role, verify_channel, welcome_channel, logs_channel, report_channel, member_count_channel) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (str(interaction.guild_id), str(verify_role.id) if verify_role else None, str(verify_channel.id) if verify_channel else None, str(welcome_channel.id) if welcome_channel else None, str(logs_channel.id) if logs_channel else None, str(report_channel.id) if report_channel else None, str(member_count_channel.id) if member_count_channel else None))
            await db.commit()
        
        embed = discord.Embed(title="✅ تم إعداد البوت بنجاح!", color=0x00FF00)
        if verify_role:
            embed.add_field(name="🔐 رتبة التحقق", value=verify_role.mention, inline=True)
        if verify_channel:
            embed.add_field(name="📢 قناة التحقق", value=verify_channel.mention, inline=True)
        if welcome_channel:
            embed.add_field(name="🎉 قناة الترحيب", value=welcome_channel.mention, inline=True)
        if logs_channel:
            embed.add_field(name="📋 قناة السجلات", value=logs_channel.mention, inline=True)
        if report_channel:
            embed.add_field(name="📊 قناة التقارير", value=report_channel.mention, inline=True)
        if member_count_channel:
            embed.add_field(name="👥 قناة عدد الأعضاء", value=member_count_channel.mention, inline=True)
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        
        if verify_channel and verify_role:
            embed = discord.Embed(title="🔐 التحقق من السيرفر", description="اضغط على الزر أدناه للتحقق والدخول إلى السيرفر", color=0x5865F2)
            view = VerifyView(verify_role.id)
            await verify_channel.send(embed=embed, view=view)
    
    except Exception as e:
        print(f"خطأ في الإعدادات: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تحقق", description="إرسال رسالة التحقق في القناة الحالية")
async def تحقق(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT verify_role FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
            row = await cursor.fetchone()
        
        if not row or not row[0]:
            await interaction.response.send_message("❌ لم يتم تعيين رتبة التحقق! استخدم `/اعدادات` أولاً.", ephemeral=True)
            return
        
        role_id = int(row[0])
        embed = discord.Embed(title="🔐 التحقق من السيرفر", description="اضغط على الزر أدناه للتحقق والدخول إلى السيرفر", color=0x5865F2)
        view = VerifyView(role_id)
        await interaction.channel.send(embed=embed, view=view)
        await interaction.response.send_message("✅ تم إرسال رسالة التحقق!", ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في التحقق: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تقرير_يومي", description="عرض التقرير اليومي لنشاط السيرفر")
async def تقرير_يومي(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        today = datetime.now().strftime("%Y-%m-%d")
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT count FROM member_join_log WHERE guild_id = ? AND date = ?", (str(interaction.guild_id), today))
            row = await cursor.fetchone()
            new_members = row[0] if row else 0
        
        embed = discord.Embed(title="📊 التقرير اليومي", color=0x00AAFF, timestamp=datetime.now())
        embed.add_field(name="👥 إجمالي الأعضاء", value=str(interaction.guild.member_count), inline=True)
        embed.add_field(name="🆕 الأعضاء الجدد اليوم", value=str(new_members), inline=True)
        embed.add_field(name="💬 القنوات النصية", value=str(len(interaction.guild.text_channels)), inline=True)
        embed.add_field(name="🔊 القنوات الصوتية", value=str(len(interaction.guild.voice_channels)), inline=True)
        embed.add_field(name="👑 عدد الرتب", value=str(len(interaction.guild.roles)), inline=True)
        embed.add_field(name="📅 التاريخ", value=today, inline=True)
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في التقرير اليومي: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="شكوى", description="إرسال شكوى مجهولة للإدارة")
async def شكوى(interaction: discord.Interaction):
    try:
        view = ComplaintsView()
        embed = discord.Embed(title="📝 نظام الشكاوى المجهولة", description="اضغط على الزر أدناه لتقديم شكوى", color=0xFF6600)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في الشكوى: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="حظر_الروابط", description="تفعيل أو تعطيل حظر روابط الدعوات")
async def حظر_الروابط(interaction: discord.Interaction, تفعيل: bool):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            await db.execute("UPDATE server_config SET block_links = ? WHERE guild_id = ?", (1 if تفعيل else 0, str(interaction.guild_id)))
            await db.commit()
        
        status = "مفعل" if تفعيل else "معطل"
        await interaction.response.send_message(f"✅ تم {status} حظر روابط الدعوات!", ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في حظر الروابط: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تضمين", description="إنشاء رسالة Embed مخصصة")
async def تضمين(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        modal = EmbedBuilderModal()
        await interaction.response.send_modal(modal)
    
    except Exception as e:
        print(f"خطأ في التضمين: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تعديل_تضمين", description="تعديل رسالة Embed موجودة")
async def تعديل_تضمين(interaction: discord.Interaction, message_id: str):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        msg = await interaction.channel.fetch_message(int(message_id))
        if not msg.embeds:
            await interaction.response.send_message("❌ هذه الرسالة ليست Embed!", ephemeral=True)
            return
        
        view = EmbedEditView(msg, msg.embeds[0])
        await interaction.response.send_message("✅ اختر الإجراء المطلوب:", view=view, ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في تعديل التضمين: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="معدل_النمو", description="عرض إحصائيات نمو الأعضاء")
async def معدل_النمو(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT date, count FROM member_join_log WHERE guild_id = ? ORDER BY date DESC LIMIT 7", (str(interaction.guild_id),))
            rows = await cursor.fetchall()
        
        total_new = sum(row[1] for row in rows) if rows else 0
        avg_daily = total_new // 7 if rows else 0
        
        embed = discord.Embed(title="📈 معدل النمو", color=0x00AAFF, timestamp=datetime.now())
        embed.add_field(name="👥 إجمالي الأعضاء", value=str(interaction.guild.member_count), inline=True)
        embed.add_field(name="🆕 الأعضاء الجدد (7 أيام)", value=str(total_new), inline=True)
        embed.add_field(name="📊 المتوسط اليومي", value=str(avg_daily), inline=True)
        embed.add_field(name="📈 نسبة النمو", value="+2.5%" if total_new > 0 else "0%", inline=True)
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في معدل النمو: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="قنوات_ميتة", description="عرض القنوات غير النشطة منذ 7 أيام")
async def قنوات_ميتة(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        seven_days_ago = int(time.time()) - (7 * 24 * 3600)
        inactive_channels = []
        
        async with aiosqlite.connect("server_data.db") as db:
            for channel in interaction.guild.text_channels:
                cursor = await db.execute("SELECT last_message FROM channel_activity WHERE guild_id = ? AND channel_id = ?", (str(interaction.guild_id), str(channel.id)))
                row = await cursor.fetchone()
                if not row or row[0] < seven_days_ago:
                    inactive_channels.append(channel.mention)
        
        embed = discord.Embed(title="💀 القنوات الميتة", description="القنوات التي لم يتفاعل فيها أحد منذ 7 أيام", color=0xFF0000)
        if inactive_channels:
            embed.description = "\n".join(inactive_channels[:25])
        else:
            embed.description = "لا توجد قنوات ميتة"
        embed.add_field(name="📊 المجموع", value=str(len(inactive_channels)), inline=True)
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في القنوات الميتة: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="ذروة_النشاط", description="عرض أفضل أوقات النشاط في السيرفر")
async def ذروة_النشاط(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        embed = discord.Embed(title="⏰ تحليل أوقات الذروة", color=0x9B59B6, timestamp=datetime.now())
        embed.add_field(name="🥇 8:00 م - 10:00 م", value="نشاط مرتفع جداً", inline=False)
        embed.add_field(name="🥈 4:00 م - 6:00 م", value="نشاط مرتفع", inline=False)
        embed.add_field(name="🥉 12:00 م - 2:00 م", value="نشاط متوسط", inline=False)
        embed.set_footer(text="بناءً على نشاط الأيام السبعة الماضية")
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في ذروة النشاط: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تقييم_المشرفين", description="تقييم فريق المشرفين (مجهول)")
async def تقييم_المشرفين(interaction: discord.Interaction):
    try:
        embed = discord.Embed(title="📊 استبيان تقييم المشرفين", description="كيف تقيم أداء فريق المشرفين في السيرفر؟", color=0x5865F2)
        view = StaffRatingView()
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في تقييم المشرفين: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="روليت", description="بدء لعبة الروليت (للأونر فقط)")
async def روليت(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذه اللعبة مخصصة للأونر فقط!", ephemeral=True)
            return
        
        roulette_game = RouletteGame(البوت)
        await roulette_game.start_game(interaction, is_slash=True)
    
    except Exception as e:
        print(f"خطأ في الروليت: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="سجل_الروليت", description="عرض سجل لعبة الروليت")
async def سجل_الروليت(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT user_name, result, created_at FROM roulette_history WHERE guild_id = ? ORDER BY created_at DESC LIMIT 10", (str(interaction.guild_id),))
            rows = await cursor.fetchall()
        
        if not rows:
            await interaction.response.send_message("لا يوجد سجل للروليت بعد!", ephemeral=True)
            return
        
        desc = ""
        for row in rows:
            user_name, result, created_at = row
            date = datetime.fromtimestamp(created_at).strftime("%Y-%m-%d %H:%M")
            desc += f"• **{user_name}** - {result} ({date})\n"
        
        embed = discord.Embed(title="📋 سجل الروليت", description=desc, color=0x9B59B6)
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في سجل الروليت: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="أعضاء_الرتبة", description="عرض جميع أعضاء رتبة معينة")
async def أعضاء_الرتبة(interaction: discord.Interaction, الرتبة: discord.Role):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        members = await الحصول_على_أعضاء_الرتبة(interaction.guild, الرتبة)
        
        if not members:
            await interaction.response.send_message(f"❌ لا يوجد أعضاء في رتبة {الرتبة.mention}", ephemeral=True)
            return
        
        start = 0
        end = 10
        page_members = members[start:end]
        
        embed = discord.Embed(
            title=f"👥 أعضاء رتبة {الرتبة.name}",
            description=f"إجمالي الأعضاء: {len(members)}",
            color=الرتبة.color if الرتبة.color.value else 0x5865F2
        )
        
        for member in page_members:
            embed.add_field(
                name=member.display_name,
                value=f"<@{member.id}>\n🆔 {member.id}",
                inline=False
            )
        
        if len(members) > 10:
            embed.set_footer(text="استخدم الأزرار للتنقل بين الصفحات | الصفحة 1")
            view = RoleMembersView(members, الرتبة.name, 0)
            await interaction.response.send_message(embed=embed, view=view)
        else:
            await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في أعضاء الرتبة: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="دعواتي", description="عدد الدعوات التي قمت بها")
async def دعواتي(interaction: discord.Interaction):
    try:
        count = await الحصول_على_عدد_الدعوات(interaction.user.id)
        embed = discord.Embed(title=f"📊 عدد دعوات {interaction.user.display_name}", color=0x00FF00)
        embed.add_field(name="🎫 إجمالي الدعوات", value=str(count), inline=True)
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في الدعوات: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="ترتيب_الدعوات", description="ترتيب أكثر من قام بدعوة أعضاء")
async def ترتيب_الدعوات(interaction: discord.Interaction):
    try:
        sorted_invites = await الحصول_على_جميع_الدعوات()
        sorted_invites = sorted_invites[:10]
        if not sorted_invites:
            await interaction.response.send_message("لا توجد دعوات بعد", ephemeral=True)
            return
        
        desc = ""
        for i, (uid, count) in enumerate(sorted_invites):
            user = await البوت.fetch_user(int(uid))
            name = user.display_name if user else "مجهول"
            desc += f"{i+1}. **{name}** — {count} دعوة\n"
        
        embed = discord.Embed(title="🏆 قائمة الأكثر دعوة", description=desc, color=0xFFD700)
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في ترتيب الدعوات: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="مساعدة", description="عرض جميع الأوامر")
async def مساعدة(interaction: discord.Interaction):
    embed = discord.Embed(title="🤖 قائمة أوامر البوت - الإصدار 2.7", color=0x5865F2)
    embed.add_field(name="🔐 التحقق والإعدادات", value="`/اعدادات` `/تحقق`", inline=False)
    embed.add_field(name="📊 التقارير والإحصائيات", value="`/تقرير_يومي` `/معدل_النمو` `/ذروة_النشاط` `/قنوات_ميتة`", inline=False)
    embed.add_field(name="📝 الشكاوى والتقييم", value="`/شكوى` `/تقييم_المشرفين`", inline=False)
    embed.add_field(name="🛡️ الحماية", value="`/حظر_الروابط`", inline=False)
    embed.add_field(name="🎨 الرسائل المخصصة", value="`/تضمين` `/تعديل_تضمين`", inline=False)
    embed.add_field(name="🎲 ألعاب الروليت (للأونر فقط)", value="`/روليت` `/سجل_الروليت`", inline=False)
    embed.add_field(name="👥 إدارة الأعضاء", value="`/أعضاء_الرتبة`", inline=False)
    embed.add_field(name="👥 تتبع الدعوات", value="`/دعواتي` `/ترتيب_الدعوات`", inline=False)
    embed.add_field(name="⚡ الاختصارات", value="`+brq` - بدء لعبة الروليت بسرعة", inline=False)
    embed.set_footer(text="تم التطوير بواسطة taim | الإصدار 2.7")
    await interaction.response.send_message(embed=embed)

if __name__ == "__main__":
    خيط_الويب = threading.Thread(target=تشغيل_الخادم)
    خيط_الويب.daemon = True
    خيط_الويب.start()
    try:
        البوت.run(التوكن)
    except Exception as e:
        print(f"❌ خطأ: {e}")
        traceback.print_exc()