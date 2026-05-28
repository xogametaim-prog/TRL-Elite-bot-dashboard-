import discord
from discord.ext import commands
import asyncio
from config import TOKEN
from database import تهيئة_قاعدة_البيانات

الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

async def تحميل_الأجزاء():
    await البوت.load_extension("cogs.الاقتصاد")
    await البوت.load_extension("cogs.الفرق")

@البوت.event
async def on_ready():
    print(f"✅ البوت دخل باسم {البوت.user}")
    await تحميل_الأجزاء()
    await البوت.tree.sync()
    print("✅ تم مزامنة الأوامر")

async def main():
    await تهيئة_قاعدة_البيانات()  # استدعاء دالة التهيئة
    await البوت.start(TOKEN)

if __name__ == "__main__":
    asyncio.run(main())