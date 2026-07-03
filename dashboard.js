// الفعاليات عند انضمام عضو جديد (Welcome & Auto Role)
client.on('guildMemberAdd', async (member) => {
  const guildConfig = client.config.guilds[member.guild.id];
  if (!guildConfig) return;

  // نظام Auto Role
  if (guildConfig.autoRole?.enabled && guildConfig.autoRole?.roleId) {
    const role = member.guild.roles.cache.get(guildConfig.autoRole.roleId);
    if (role) {
      member.roles.add(role).catch(() => {});
    }
  }

  // نظام Welcome System
  if (guildConfig.welcome?.enabled && guildConfig.welcome?.channelId) {
    const channel = member.guild.channels.cache.get(guildConfig.welcome.channelId);
    if (channel) {
      const welcomeText = (guildConfig.welcome.message || "Welcome to the server, {user}!")
        .replace('{user}', `<@${member.id}>`)
        .replace('{server}', member.guild.name)
        .replace('{count}', member.guild.memberCount);

      let payload = { content: welcomeText };
      if (guildConfig.welcome.mentionUser) {
        payload.content = `<@${member.id}>\n${welcomeText}`;
      }

      try {
        // البدء بمحاولة إنشاء بطاقة الترحيب (Welcome Card) عبر Canvas
        const canvas = createCanvas(800, 350);
        const ctx = canvas.getContext('2d');

        // خلفية داكنة متدرجة
        const gradient = ctx.createLinearGradient(0, 0, 800, 350);
        gradient.addColorStop(0, '#0f172a');
        gradient.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 350);

        // دائرة خلفية للأفاتار
        ctx.beginPath();
        ctx.arc(400, 110, 75, 0, Math.PI * 2);
        ctx.fillStyle = '#4f46e5';
        ctx.fill();

        // رسم صورة الأفاتار مع معالجة الخطأ
        try {
          const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
          const avatar = await loadImage(avatarUrl);
          ctx.save();
          ctx.beginPath();
          ctx.arc(400, 110, 70, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatar, 330, 40, 140, 140);
          ctx.restore();
        } catch (avatarError) {
          console.error("فشل رسم أفاتار المستخدم، استخدام دائرة تجميلية افتراضية:", avatarError);
          ctx.beginPath();
          ctx.arc(400, 110, 60, 0, Math.PI * 2);
          ctx.fillStyle = '#312e81';
          ctx.fill();
        }

        // نصوص البطاقة الترحيبية
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`WELCOME TO THE SERVER`, 400, 230);

        ctx.font = '26px sans-serif';
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText(`${member.user.tag}`, 400, 275);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`Member #${member.guild.memberCount}`, 400, 315);

        const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'welcome.png' });
        payload.files = [attachment];
      } catch (canvasErr) {
        // في حال فشل محرك الـ Canvas لأي سبب، لن يتوقف البوت وسيتم إرسال الترحيب النصي فوراً
        console.error("حدثت مشكلة في توليد الصورة، سيتم الانتقال للترحيب النصي البديل:", canvasErr);
      }

      channel.send(payload).catch((err) => console.error("تعذر إرسال رسالة الترحيب:", err));
    }
  }
});