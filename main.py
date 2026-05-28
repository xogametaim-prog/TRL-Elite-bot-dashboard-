import discord
from discord.ext import commands
import asyncio
from config import TOKEN
from database import تهيئة_قاعدة_البيانات

# إعداد صلاحيات البوت
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

async def load_cogs():
    await bot.load_extension("cogs.الاقتصاد")
    await bot.load_extension("cogs.الفرق")

@bot.event
async def on_ready():
    print(f"✅ البوت دخل باسم {bot.user}")
    await load_cogs()
    await bot.tree.sync()
    print("✅ تم مزامنة جميع الأوامر")

async def main():
    await تهيئة_قاعدة_البيانات()
    await bot.start(TOKEN)

if __name__ == "__main__":
    asyncio.run(main())