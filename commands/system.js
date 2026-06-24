  // ==================== [ نظام التذاكر المطور ] ====================
  'setup-ticket': {
    name: 'setup-ticket',
    shortcuts: ['تكت', 'تذاكر'],
    data: new SlashCommandBuilder()
      .setName('setup-ticket')
      .setDescription('إعداد لوحة التذاكر الذكية بالأزرار والرتب المخصصة')
      .addStringOption(o => o.setName('title').setDescription('عنوان لوحة التذاكر الإيمبد').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('وصف لوحة التذاكر').setRequired(true))
      .addStringOption(o => o.setName('buttons').setDescription('أزرار التكت والرتب (مثال: الدعم:@رتبة | الإدارة:@رتبة)').setRequired(true)),
    
    executeSlash: async (interaction) => {
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const buttonsString = interaction.options.getString('buttons');
      
      const db = getDB();
      if (!db.ticketConfig) db.ticketConfig = {};
      if (!db.ticketConfig[interaction.guild.id]) db.ticketConfig[interaction.guild.id] = {};

      const parts = buttonsString.split('|');
      if (parts.length > 5) return interaction.reply({ content: '❌ لا يمكنك إضافة أكثر من 5 أزرار للتذاكر.', ephemeral: true });

      const row = new ActionRowBuilder();
      let count = 1;

      for (const part of parts) {
        const btnInfo = part.split(':');
        if (btnInfo.length < 2) continue;
        
        const btnName = btnInfo[0].trim();
        const roleMention = btnInfo[1].trim();
        const roleId = roleMention.replace(/[^0-9]/g, '');

        const customId = `ticket_btn_${count}_${interaction.guild.id}`;
        
        db.ticketConfig[interaction.guild.id][customId] = { roleId, name: btnName };

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(customId)
            .setLabel(btnName)
            .setStyle(ButtonStyle.Primary)
        );
        count++;
      }

      saveDB(db);

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor('#00ffcc')
        .setFooter({ text: 'نظام التذاكر تلقائي الإدارة' });

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ تم إنشاء لوحة التذاكر وحفظ الإعدادات بنجاح.', ephemeral: true });
    },
    executeMessage: async (message) => {
      message.reply('❌ يرجى استخدام أمر السلاش `/setup-ticket` لتحديد الأزرار والمنشن للرتب بدقة عالية.');
    }
  }
