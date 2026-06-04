# ==================== main.py ====================
import sys
import os
import logging
import traceback
import asyncio
import threading
from flask import Flask

# ==================== إعداد السجل ====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('discord_bot')

def handle_exception(exc_type, exc_value, exc_traceback):
    logger.error("خطأ كارثي غير متوقع:")
    logger.error("".join(traceback.format_exception(exc_type, exc_value, exc_traceback)))

sys.excepthook = handle_exception

# ==================== سيرفر وهمي لـ Render ====================
تطبيق_فلاسك = Flask(__name__)

@تطبيق_فلاسك.route('/')
def الصفحة_الرئيسية():
    return "✅ البوت شغال!"

def تشغيل_السيرفر_الوهمي():
    المنفذ = int(os.getenv("PORT", 8080))
    تطبيق_فلاسك.run(host='0.0.0.0', port=المنفذ)

# ==================== استيراد discord.py ====================
try:
    import discord
    from discord.ext import commands
    logger.info("✅ تم استيراد discord.py بنجاح")
except Exception as e:
    logger.error(f"❌ فشل في استيراد discord.py: {e}")
    sys.exit(1)

# ==================== التوكن ====================
التوكن = os.getenv("DISCORD_TOKEN")
if not التوكن:
    logger.error("❌ DISCORD_TOKEN غير موجود في متغيرات البيئة")
    sys.exit(1)

logger.info(f"✅ تم العثور على التوكن (يبدأ بـ: {التوكن[:10]}...)")

# ==================== إنشاء البوت ====================
try:
    الصلاحيات = discord.Intents.default()
    الصلاحيات.message_content = True
    الصلاحيات.members = True
    البوت = commands.Bot(command_prefix="+", intents=الصلاحيات)
    logger.info("✅ تم إنشاء البوت مع الصلاحيات المطلوبة")
except Exception as e:
    logger.error(f"❌ فشل في إنشاء البوت: {e}")
    sys.exit(1)

# ==================== EmbedHelper ====================
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
                for f in fields:
                    embed.add_field(name=f.get("name", ""), value=f.get("value", ""), inline=f.get("inline", True))
            if footer_text: embed.set_footer(text=footer_text)
            embed.timestamp = discord.utils.utcnow()
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

# ==================== تحميل الإضافات ====================
async def load_extensions():
    try:
        await البوت.load_extension("management")
        logger.info("✅ تم تحميل management")
    except Exception as e:
        logger.error(f"❌ فشل تحميل management: {e}")

@البوت.event
async def on_ready():
    logger.info(f"✅ تم تشغيل البوت: {البوت.user}")
    logger.info(f"📊 عدد السيرفرات: {len(البوت.guilds)}")
    await load_extensions()
    try:
        synced = await البوت.tree.sync()
        logger.info(f"📡 تم مزامنة {len(synced)} أمر")
    except Exception as e:
        logger.error(f"❌ خطأ في المزامنة: {e}")
    logger.info("✅ البوت جاهز للعمل!")

async def main():
    try:
        threading.Thread(target=تشغيل_السيرفر_الوهمي, daemon=True).start()
        logger.info("🌐 تم تشغيل السيرفر الوهمي")
        
        logger.info("🚀 بدء تشغيل البوت...")
        await البوت.start(التوكن)
    except discord.LoginFailure:
        logger.error("❌ فشل تسجيل الدخول: التوكن غير صالح")
        sys.exit(1)
    except discord.PrivilegedIntentsRequired:
        logger.error("❌ الصلاحيات المميزة غير مفعلة")
        logger.error("اذهب إلى Discord Developer Portal > Bot > وقم بتفعيل Message Content Intent و Server Members Intent")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ خطأ غير متوقع: {type(e).__name__}: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("⏹️ تم إيقاف البوت يدوياً")
    except Exception as e:
        logger.error(f"❌ خطأ في تشغيل البوت: {type(e).__name__}: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)