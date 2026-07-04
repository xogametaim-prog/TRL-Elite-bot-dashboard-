const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionFlagsBits,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const fs = require('fs');
const { startDashboard } = require('./dashboard.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.Reaction]
});

// Helper function to validate and extract standard or custom emojis to prevent Discord API validation crashes
function parseAndValidateEmoji(emojiInput) {
  if (!emojiInput || typeof emojiInput !== 'string') return null;
  const trimmed = emojiInput.trim();
  if (!trimmed) return null;

  // 1. Capture custom Discord emojis <:name:id> or <a:name:id> and return the raw ID
  const customEmojiRegex = /^<a?:([a-zA-Z0-9_~]+):(\d+)>$/;
  const matchCustom = trimmed.match(customEmojiRegex);
  if (matchCustom) return matchCustom[2];

  // 2. Check if input is a raw numerical ID
  const numericRegex = /^\d+$/;
  if (numericRegex.test(trimmed)) return trimmed;

  // 3. Check if input contains a valid unicode emoji character
  const unicodeEmojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
  if (unicodeEmojiRegex.test(trimmed)) return trimmed;

  return null;
}

// Load config.json safely on startup
let config = { guilds: {} };
if (fs.existsSync('./config.json')) {
  try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
  } catch (e) {
    config = { guilds: {} };
  }
}
client.config = config;

// Global helper to save changes to config.json
client.saveConfig = () => {
  fs.writeFileSync('./config.json', JSON.stringify(client.config, null, 2));
};

client.on('ready', async () => {
  console.log(`[BOT] Logged in as ${client.user.tag}`);
  
  const commands = [
    {
      name: 'setup-ticket',
      description: 'Sends the ticket panel to the current channel.',
    }
  ];

  await client.application.commands.set(commands);
  startDashboard(client);
});

// Logging utility function
async function sendLog(guild, embed) {
  const guildConfig = client.config.guilds[guild.id];
  if (!guildConfig || !guildConfig.general?.logsChannel) return;
  const channel = guild.channels.cache.get(guildConfig.general.logsChannel);
  if (channel) {
    channel.send({ embeds: [embed] }).catch(() => {});
  }
}

// Interval checking system for scheduled announcements (runs every 10 seconds)
setInterval(async () => {
  const now = Date.now();
  for (const guildId in client.config.guilds) {
    const guildConfig = client.config.guilds[guildId];
    if (!guildConfig.autoMessages) continue;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    for (const msg of guildConfig.autoMessages) {
      if (msg.enabled && now >= (msg.lastSent + msg.interval)) {
        msg.lastSent = now;
        client.saveConfig();

        const channel = guild.channels.cache.get(msg.channelId);
        if (channel) {
          try {
            if (msg.format === 'plain') {
              await channel.send({ content: msg.message });
            } else {
              const embed = new EmbedBuilder()
                .setDescription(msg.message)
                .setColor('#d4af37')
                .setTimestamp();
              if (msg.embedTitle) embed.setTitle(msg.embedTitle);
              if (msg.embedImage) embed.setImage(msg.embedImage);
              await channel.send({ embeds: [embed] });
            }
          } catch (err) {
            console.error(`Failed to send scheduled message in guild ${guildId}:`, err);
          }
        }
      }
    }
  }
}, 10000);

// Interval checking system for active giveaways (runs every 15 seconds)
setInterval(async () => {
  const now = Date.now();
  for (const guildId in client.config.guilds) {
    const guildConfig = client.config.guilds[guildId];
    if (!guildConfig.giveaways) continue;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    for (const giveaway of guildConfig.giveaways) {
      if (!giveaway.ended && now >= giveaway.endAt) {
        await endGiveaway(client, guild, giveaway);
      }
    }
  }
}, 15000);

// Handles picking winners and updating giveaway embeds on end
async function endGiveaway(client, guild, giveaway) {
  giveaway.ended = true;
  client.saveConfig();

  const channel = guild.channels.cache.get(giveaway.channelId);
  if (!channel) return;

  try {
    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (!message) return;

    const reaction = message.reactions.cache.get('🎉');
    if (!reaction) {
      return channel.send(`⚠️ Cannot pick a winner due to lack of reactions for giveaway: **${giveaway.prize}**.`);
    }

    const users = await reaction.users.fetch();
    const participants = users.filter(u => !u.bot).map(u => u.id);

    const validParticipants = [];
    for (const userId of participants) {
      try {
        const member = await guild.members.fetch(userId);
        if (!member) continue;

        if (giveaway.requiredRoleId && !member.roles.cache.has(giveaway.requiredRoleId)) {
          continue;
        }

        if (giveaway.requiredServerDays) {
          const joinedAt = member.joinedTimestamp;
          const daysDiff = (Date.now() - joinedAt) / (1000 * 60 * 60 * 24);
          if (daysDiff < giveaway.requiredServerDays) continue;
        }

        validParticipants.push(userId);
      } catch (_) {}
    }

    if (validParticipants.length === 0) {
      const embed = EmbedBuilder.from(message.embeds[0])
        .setDescription(`**Giveaway Ended!**\n\nNo eligible users participated in this draw.`)
        .setColor('#ef4444');
      await message.edit({ embeds: [embed], components: [] });
      return channel.send(`⚠️ Giveaway ended for **${giveaway.prize}**, but no eligible participants were found.`);
    }

    const winners = [];
    const count = Math.min(giveaway.winnersCount || 1, validParticipants.length);
    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * validParticipants.length);
      winners.push(validParticipants.splice(index, 1)[0]);
    }

    const winnersMentions = winners.map(w => `<@${w}>`).join(', ');

    const originalEmbed = message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setTitle(`🎉 Giveaway Ended: ${giveaway.prize} 🎉`)
      .setDescription(`${originalEmbed.description}\n\n**Winners:** ${winnersMentions}`)
      .setColor('#d4af37');
    await message.edit({ embeds: [updatedEmbed], components: [] });

    const template = giveaway.winnerMessageTemplate || "🎉 Congratulations {user}! You won {prize}!";
    const winnerMsg = template
      .replace('{user}', winnersMentions)
      .replace('{prize}', giveaway.prize);

    await channel.send(winnerMsg);
  } catch (err) {
    console.error("Error ending giveaway:", err);
  }
}

// Onboarding events: Welcomer Canvas drawing and Auto-Role assignments
client.on('guildMemberAdd', async (member) => {
  const guildConfig = client.config.guilds[member.guild.id];
  if (!guildConfig) return;

  if (guildConfig.autoRole?.enabled && guildConfig.autoRole?.roleId) {
    const role = member.guild.roles.cache.get(guildConfig.autoRole.roleId);
    if (role) {
      member.roles.add(role).catch(() => {});
    }
  }

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
        const canvas = createCanvas(800, 350);
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 800, 350);
        gradient.addColorStop(0, '#020205');
        gradient.addColorStop(1, '#1c170d');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 350);

        ctx.beginPath();
        ctx.arc(400, 110, 75, 0, Math.PI * 2);
        ctx.fillStyle = '#d4af37';
        ctx.fill();

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
          console.error("Failed to load user avatar, falling back to clean circle:", avatarError);
          ctx.beginPath();
          ctx.arc(400, 110, 60, 0, Math.PI * 2);
          ctx.fillStyle = '#1c170d';
          ctx.fill();
        }

        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`WELCOME TO THE SERVER`, 400, 230);

        ctx.font = '26px sans-serif';
        ctx.fillStyle = '#d4af37';
        ctx.fillText(`${member.user.tag}`, 400, 275);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`Member #${member.guild.memberCount}`, 400, 315);

        const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'welcome.png' });
        payload.files = [attachment];
      } catch (canvasErr) {
        console.error("Canvas generation failed, rendering pure text instead:", canvasErr);
      }

      channel.send(payload).catch((err) => console.error("Error sending welcome message:", err));
    }
  }
});

// Message listener handling automated responses (Auto Replies)
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const guildConfig = client.config.guilds[message.guild.id];
  if (!guildConfig) return;

  if (guildConfig.autoReplies && Array.isArray(guildConfig.autoReplies)) {
    const match = guildConfig.autoReplies.find(r => 
      r.enabled && 
      message.content.trim().toLowerCase() === r.keyword.trim().toLowerCase()
    );
    if (match) {
      if (match.channel === 'all' || match.channel === message.channel.id) {
        message.reply(match.reply).catch(() => {});
      }
    }
  }
});

// Server delete message log event
client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;
  const embed = new EmbedBuilder()
    .setTitle("🗑️ Message Deleted")
    .setColor('#ff4a4a')
    .addFields(
      { name: "User:", value: `<@${message.author.id}> (${message.author.id})` },
      { name: "Channel:", value: `<#${message.channel.id}>` },
      { name: "Content:", value: message.content || "*No text content (image or attachment)*" }
    )
    .setTimestamp();
  sendLog(message.guild, embed);
});

// Server edit message log event
client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
  const embed = new EmbedBuilder()
    .setTitle("📝 Message Edited")
    .setColor('#facc15')
    .addFields(
      { name: "User:", value: `<@${oldMessage.author.id}>` },
      { name: "Channel:", value: `<#${oldMessage.channel.id}>` },
      { name: "Before:", value: oldMessage.content || "*Empty*" },
      { name: "After:", value: newMessage.content || "*Empty*" }
    )
    .setTimestamp();
  sendLog(oldMessage.guild, embed);
});

// Interactive Reactions system (Reaction Roles onboarding)
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('Failed to fetch message reaction partial:', err);
      return;
    }
  }
  const { message } = reaction;
  if (!message.guild) return;

  const guildConfig = client.config.guilds[message.guild.id];
  if (!guildConfig || !guildConfig.reactionRoles) return;

  const emojiName = reaction.emoji.id || reaction.emoji.name;
  const match = guildConfig.reactionRoles.find(rr => 
    rr.messageId === message.id && 
    (rr.emoji === emojiName || rr.emoji.includes(emojiName))
  );

  if (match) {
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const role = message.guild.roles.cache.get(match.roleId);
      if (role) {
        await member.roles.add(role).catch(() => {});
      }
    }
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      return;
    }
  }
  const { message } = reaction;
  if (!message.guild) return;

  const guildConfig = client.config.guilds[message.guild.id];
  if (!guildConfig || !guildConfig.reactionRoles) return;

  const emojiName = reaction.emoji.id || reaction.emoji.name;
  const match = guildConfig.reactionRoles.find(rr => 
    rr.messageId === message.id && 
    (rr.emoji === emojiName || rr.emoji.includes(emojiName))
  );

  if (match) {
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const role = message.guild.roles.cache.get(match.roleId);
      if (role) {
        await member.roles.remove(role).catch(() => {});
      }
    }
  }
});

// Handles modals and button submissions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild) return;
  const guildConfig = client.config.guilds[interaction.guild.id];

  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;

    if (customId === 'modal_add_member') {
      const userId = interaction.fields.getTextInputValue('user_id_input').replace(/[<@!>]/g, '');
      try {
        const member = await interaction.guild.members.fetch(userId);
        await interaction.channel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          SendMessages: true
        });
        await interaction.reply({ content: `✅ Member ${member} has been added to the ticket.` });

        const logEmbed = new EmbedBuilder()
          .setTitle("👤 Member Added to Ticket")
          .setColor('#42f560')
          .addFields(
            { name: "Ticket:", value: `${interaction.channel.name}` },
            { name: "Member Added:", value: `<@${member.id}>` },
            { name: "By:", value: `<@${interaction.user.id}>` }
          ).setTimestamp();
        sendLog(interaction.guild, logEmbed);
      } catch (_) {
        return interaction.reply({ content: '❌ Could not find that member. Please write a valid user ID.', ephemeral: true });
      }
    }

    if (customId === 'modal_remove_member') {
      const userId = interaction.fields.getTextInputValue('user_id_input').replace(/[<@!>]/g, '');
      try {
        const member = await interaction.guild.members.fetch(userId);
        await interaction.channel.permissionOverwrites.delete(member.id);
        await interaction.reply({ content: `✅ Member ${member} has been removed from the ticket.` });

        const logEmbed = new EmbedBuilder()
          .setTitle("👤 Member Removed from Ticket")
          .setColor('#ef4444')
          .addFields(
            { name: "Ticket:", value: `${interaction.channel.name}` },
            { name: "Member Removed:", value: `<@${member.id}>` },
            { name: "By:", value: `<@${interaction.user.id}>` }
          ).setTimestamp();
        sendLog(interaction.guild, logEmbed);
      } catch (_) {
        return interaction.reply({ content: '❌ Could not find that member. Please write a valid user ID.', ephemeral: true });
      }
    }

    if (customId === 'modal_rename') {
      const newName = interaction.fields.getTextInputValue('new_name_input').trim().replace(/\s+/g, '-');
      const oldName = interaction.channel.name;
      await interaction.channel.setName(`ticket-${newName}`);
      await interaction.reply({ content: `✅ Ticket channel renamed from \`${oldName}\` to \`ticket-${newName}\`.` });

      const logEmbed = new EmbedBuilder()
        .setTitle("✏️ Ticket Renamed")
        .setColor('#3b82f6')
        .addFields(
          { name: "Before:", value: `\`${oldName}\`` },
          { name: "After:", value: `\`ticket-${newName}\`` },
          { name: "By:", value: `<@${interaction.user.id}>` }
        ).setTimestamp();
      sendLog(interaction.guild, logEmbed);
    }
  }

  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup-ticket') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Administrator permission is strictly required to execute setup commands.', ephemeral: true });
      }
      return interaction.reply({ content: '💡 Please deploy the ticket panel directly from the web dashboard.', ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const customId = interaction.customId;

    if (customId.startsWith('ticket_open_')) {
      await interaction.deferReply({ ephemeral: true });
      const ticketTypeId = customId.replace('ticket_open_', '');
      const ticketType = guildConfig?.tickets?.find(t => t.id === ticketTypeId);

      if (!ticketType) {
        return interaction.editReply({ content: '❌ Failed to resolve details for this ticket type.' });
      }

      const maxTickets = parseInt(guildConfig.maxTickets || '4');
      const currentTickets = interaction.guild.channels.cache.filter(c => 
        c.name.includes('ticket-') && 
        c.topic && c.topic.includes(`owner:${interaction.user.id}`)
      );

      if (currentTickets.size >= maxTickets) {
        return interaction.editReply({ content: `❌ You reached the limit of active open tickets on this server (${maxTickets} tickets max).` });
      }

      const channelName = (ticketType.channelName || 'ticket-{user}')
        .replace('{user}', interaction.user.username)
        .toLowerCase();

      const permissionOverwrites = [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }
      ];

      if (ticketType.mentionRole) {
        permissionOverwrites.push({
          id: ticketType.mentionRole,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
      }

      const parentCategory = ticketType.category || guildConfig.general?.defaultCategory || null;

      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parentCategory,
        topic: `owner:${interaction.user.id} | type:${ticketTypeId}`,
        permissionOverwrites: permissionOverwrites
      });

      const pingString = ticketType.mentionRole ? `<@&${ticketType.mentionRole}>` : '';
      if (pingString) {
        await ticketChannel.send(pingString).then(m => m.delete().catch(() => {}));
      }

      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`Welcome to Ticket - ${ticketType.name}`)
        .setDescription(ticketType.welcomeMessage || "Please describe your issue here. Our support team will assist you shortly.")
        .setColor('#d4af37')
        .setThumbnail(interaction.user.displayAvatarURL());

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji('🎫').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_add_member_btn').setLabel('Add').setEmoji('➕').setStyle(ButtonStyle.Primary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_remove_member_btn').setLabel('Remove').setEmoji('➖').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_rename_btn').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary)
      );

      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [welcomeEmbed], components: [row1, row2] });
      await interaction.editReply({ content: `✅ Your ticket has been created successfully: <#${ticketChannel.id}>` });

      const logEmbed = new EmbedBuilder()
        .setTitle("🔓 Ticket Opened")
        .setColor('#10b981')
        .addFields(
          { name: "User:", value: `<@${interaction.user.id}>` },
          { name: "Channel:", value: `<#${ticketChannel.id}>` },
          { name: "Type:", value: ticketType.name }
        ).setTimestamp();
      sendLog(interaction.guild, logEmbed);
    }

    if (customId === 'ticket_claim') {
      const topic = interaction.channel.topic || '';
      if (topic.includes('claimed:')) {
        const claimer = topic.split('claimed:')[1]?.trim();
        return interaction.reply({ content: `⚠️ This ticket has already been claimed by: <@${claimer}>`, ephemeral: true });
      }

      await interaction.channel.setTopic(`${topic} | claimed:${interaction.user.id}`);
      await interaction.reply({ content: `✅ This ticket has been claimed by <@${interaction.user.id}>` });

      const logEmbed = new EmbedBuilder()
        .setTitle("🎫 Ticket Claimed")
        .setColor('#d4af37')
        .addFields(
          { name: "Ticket:", value: `<#${interaction.channel.id}>` },
          { name: "By:", value: `<@${interaction.user.id}>` }
        ).setTimestamp();
      sendLog(interaction.guild, logEmbed);
    }

    if (customId === 'ticket_add_member_btn') {
      const modal = new ModalBuilder().setCustomId('modal_add_member').setTitle('Add Member');
      const input = new TextInputBuilder()
        .setCustomId('user_id_input')
        .setLabel('User ID or Mention')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Example: 123456789012345678')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (customId === 'ticket_remove_member_btn') {
      const modal = new ModalBuilder().setCustomId('modal_remove_member').setTitle('Remove Member');
      const input = new TextInputBuilder()
        .setCustomId('user_id_input')
        .setLabel('User ID or Mention')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Example: 123456789012345678')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (customId === 'ticket_rename_btn') {
      const modal = new ModalBuilder().setCustomId('modal_rename').setTitle('Rename Ticket');
      const input = new TextInputBuilder()
        .setCustomId('new_name_input')
        .setLabel('New Ticket Name (No Spaces)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Example: billing-support')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (customId === 'ticket_close_confirm') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close_yes').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_close_no').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({ content: '❓ Are you sure you want to close this ticket?', components: [row] });
    }

    if (customId === 'ticket_close_no') {
      await interaction.message.delete().catch(() => {});
    }

    if (customId === 'ticket_close_yes') {
      await interaction.reply({ content: '⏳ Archiving messages and closing ticket room...' });

      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const sortedMessages = messages.reverse();

      const serverIcon = interaction.guild.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png';
      
      let transcriptHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Transcript Archive - ${interaction.channel.name}</title>
        <style>
          body { background-color: #030303; color: #f1f5f9; font-family: sans-serif; padding: 30px; }
          .container { max-w: 900px; margin: 0 auto; background: rgba(15, 15, 15, 0.9); border: 1px solid rgba(212, 175, 55, 0.2); padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
          .header { display: flex; align-items: center; gap: 20px; padding-bottom: 20px; border-b: 1px solid rgba(212,175,55,0.2); margin-bottom: 30px; }
          .header img { width: 80px; height: 80px; border-radius: 50%; border: 3px solid #d4af37; }
          .header h2 { margin: 0; color: #d4af37; font-size: 24px; text-shadow: 0 0 10px rgba(212,175,55,0.3); }
          .meta-info { font-size: 13px; color: #94a3b8; line-height: 1.6; }
          .message-box { display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px; padding: 15px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(212,175,55,0.05); transition: 0.2s; }
          .message-box:hover { background: rgba(255,255,255,0.04); border-color: rgba(212,175,55,0.15); }
          .avatar { width: 45px; height: 45px; border-radius: 50%; object-fit: cover; }
          .msg-header { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
          .user { font-weight: 700; color: #d4af37; font-size: 15px; }
          .time { font-size: 11px; color: #64748b; }
          .content { font-size: 14px; color: #e2e8f0; line-height: 1.5; word-break: break-word; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${serverIcon}" />
            <div>
              <h2>Ticket Archive: ${interaction.channel.name}</h2>
              <div class="meta-info">
                Guild: <b>${interaction.guild.name}</b><br/>
                Closed At: <b>${new Date().toLocaleString()}</b><br/>
                Closed By: <b>${interaction.user.tag}</b>
              </div>
            </div>
          </div>
          <div class="messages">
      `;

      sortedMessages.forEach(m => {
        const authorAvatar = m.author.displayAvatarURL() || 'https://cdn.discordapp.com/embed/avatars/0.png';
        transcriptHtml += `
          <div class="message-box">
            <img class="avatar" src="${authorAvatar}" />
            <div>
              <div class="msg-header">
                <span class="user">${m.author.tag}</span>
                <span class="time">${m.createdAt.toLocaleString()}</span>
              </div>
              <div class="content">${m.content || "*Media or empty message*"}</div>
            </div>
          </div>
        `;
      });

      transcriptHtml += `
          </div>
        </div>
      </body>
      </html>
      `;

      const attachment = new AttachmentBuilder(Buffer.from(transcriptHtml, 'utf-8'), { name: `transcript-${interaction.channel.name}.html` });

      const logEmbed = new EmbedBuilder()
        .setTitle("🔒 Ticket Closed")
        .setColor('#ef4444')
        .addFields(
          { name: "Channel:", value: `${interaction.channel.name}` },
          { name: "Closed By:", value: `<@${interaction.user.id}>` }
        ).setTimestamp();

      const transChanId = guildConfig?.general?.transcriptChannel || guildConfig?.general?.logsChannel;
      if (transChanId) {
        const transChan = interaction.guild.channels.cache.get(transChanId);
        if (transChan) {
          await transChan.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
        }
      }

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
