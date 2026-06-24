const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// قراءة التوكن والأيدي من متغيرات البيئة في ريندر (Render Env Vars)
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error("❌ خطأ: لم يتم العثور على DISCORD_TOKEN أو CLIENT_ID في إعدادات Render!");
  process.exit(1);
}

const commands = [
  // أمر إعداد نظام التيكت
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('إعداد نظام التذاكر الاحترافي')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option => option.setName('title').setDescription('عنوان رسالة التيكت').setRequired(true))
    .addStringOption(option => option.setName('description').setDescription('الوصف داخل رسالة التيكت').setRequired(true))
    .addStringOption(option => option.setName('button_text').setDescription('النص الذي يظهر داخل قائمة الاختيار').setRequired(true))
    .addRoleOption(option => option.setName('staff_role').setDescription('الرتبة التي ستستلم التذاكر وتتحكم بها').setRequired(true)),

  // أمر الإمبد المخصص مع الصور
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('إنشاء رسالة إمبد مخصصة مع صورة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option => option.setName('title').setDescription('عنوان الإمبد').setRequired(true))
    .addStringOption(option => option.setName('description').setDescription('محتوى الإمبد').setRequired(true))
    .addStringOption(option => option.setName('image_url').setDescription('رابط الصورة للإمبد (اختياري)').setRequired(false))
    .addStringOption(option => option.setName('color').setDescription('لون الإمبد بالـ Hex مثل #00ff00 (اختياري)').setRequired(false))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('⏳ جاري تسجيل أوامر السلاش في ديسكورد...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('✅ تم تسجيل الأوامر بنجاح وجاهزة للاستخدام بالسيرفر!');
  } catch (error) {
    console.error('حدث خطأ أثناء تسجيل الأوامر:', error);
  }
})();
