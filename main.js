const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("World Cup 2026 Bot Online");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ================= DATABASE =================
const db = new sqlite3.Database("./worldcup.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
  userId TEXT PRIMARY KEY,
  team TEXT NOT NULL
)
`);

// ================= TEAMS =================
const teams = [
"Argentina","Brazil","France","Spain","Germany","England","Portugal","Netherlands",
"Belgium","Croatia","Morocco","Japan","South Korea","Mexico","USA","Canada",
"Uruguay","Italy","Turkey","Saudi Arabia"
];

// ================= SLASH COMMANDS AUTO DEPLOY =================
async function deployCommands() {
  const commands = [
    new SlashCommandBuilder().setName("worldcup").setDescription("معلومات كأس العالم 2026"),
    new SlashCommandBuilder().setName("teams").setDescription("عرض المنتخبات"),
    new SlashCommandBuilder().setName("schedule").setDescription("جدول المباريات"),
    new SlashCommandBuilder().setName("stadiums").setDescription("الملاعب"),
    new SlashCommandBuilder().setName("pick_team").setDescription("اختيار منتخب"),
    new SlashCommandBuilder().setName("my_team").setDescription("منتخبك"),
    new SlashCommandBuilder().setName("guess_team").setDescription("لعبة التخمين"),
    new SlashCommandBuilder().setName("leaderboard").setDescription("الترتيب")
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("🚀 Updating slash commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Slash commands updated successfully");
  } catch (err) {
    console.error("❌ Error deploying commands:", err);
  }
}

// ================= DISCORD CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  // 🔥 أهم سطر: تحديث تلقائي عند التشغيل
  await deployCommands();
});

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async (interaction) => {

  // ===== SLASH COMMANDS =====
  if (interaction.isChatInputCommand()) {

    switch (interaction.commandName) {

      case "worldcup":
        return interaction.reply("🏆 كأس العالم 2026 في أمريكا وكندا والمكسيك.");

      case "teams":
        return interaction.reply("🌍 المنتخبات: " + teams.join(", "));

      case "schedule":
        return interaction.reply("📅 سيتم جلب الجدول من API Football لاحقًا.");

      case "stadiums":
        return interaction.reply("🏟️ ملاعب البطولة سيتم إضافتها قريبًا.");

      case "pick_team":

        db.get("SELECT * FROM users WHERE userId = ?", [interaction.user.id], async (err, row) => {

          if (row) {
            return interaction.reply({
              content: `❌ أنت اخترت مسبقًا: ${row.team}`,
              ephemeral: true
            });
          }

          const menu = new StringSelectMenuBuilder()
            .setCustomId("team_select")
            .setPlaceholder("اختر منتخبك")
            .addOptions(
              teams.map(t => ({ label: t, value: t }))
            );

          const rowMenu = new ActionRowBuilder().addComponents(menu);

          interaction.reply({
            content: "⚽ اختر منتخبك (مرة واحدة فقط)",
            components: [rowMenu],
            ephemeral: true
          });
        });

        break;

      case "my_team":

        db.get("SELECT * FROM users WHERE userId = ?", [interaction.user.id], (err, row) => {

          if (!row) {
            return interaction.reply({
              content: "❌ لم تختار أي منتخب بعد",
              ephemeral: true
            });
          }

          interaction.reply(`🏆 منتخبك: ${row.team}`);
        });

        break;

      case "guess_team":
        return interaction.reply("🎮 لعبة التخمين قريبًا");

      case "leaderboard":
        return interaction.reply("🏅 اللوحة قريبًا");

    }
  }

  // ===== SELECT MENU =====
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "team_select") {

      const team = interaction.values[0];

      db.get("SELECT * FROM users WHERE userId = ?", [interaction.user.id], (err, row) => {

        if (row) {
          return interaction.reply({
            content: "❌ لا يمكنك تغيير منتخبك",
            ephemeral: true
          });
        }

        db.run(
          "INSERT INTO users(userId, team) VALUES(?, ?)",
          [interaction.user.id, team]
        );

        interaction.reply({
          content: `✅ تم اختيار ${team} بنجاح!`,
          ephemeral: true
        });

      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);