import discord
from discord.ext import commands
import asyncio
import logging
import sys
from config import TOKEN
from database import تهيئة_قاعدة_البيانات

# إعداد نظام تسجيل الأخطاء
logging.basicConfig(level=logging.INFO, stream=sys.stdout)

# إعداد الصلاحيات (intents)
الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True

البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

async def تحميل_المجلدات():
    """تحميل ملفات الأوامر من مجلد cogs"""
    await البوت.load_extension("cogs.الاقتصاد")
    await البوت.load_extension("cogs.الفرق")

@البوت.event
async def on_ready():
    print(f"✅ البوت دخل باسم {البوت.user}")
    await تحميل_المجلدات()
    await البوت.tree.sync()
    print("✅ تم مزامنة جميع الأوامر")

async def الرئيسي():
    await تهيئة_قاعدة_البيانات()
    await البوت.start(TOKEN)  # هذا السطر يبقي البوت متصلاً

if __name__ == "__main__":
    try:
        asyncio.run(الرئيسي())
    except discord.LoginFailure:
        print("❌ فشل تسجيل الدخول. تأكد من متغير البيئة DISCORD_TOKEN")
    except Exception as e:
        print(f"❌ خطأ غير متوقع: {e}")