const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
new SlashCommandBuilder()
.setName("worldcup")
.setDescription("معلومات كأس العالم 2026"),

new SlashCommandBuilder()
.setName("teams")
.setDescription("عرض المنتخبات المشاركة"),

new SlashCommandBuilder()
.setName("schedule")
.setDescription("عرض جدول المباريات"),

new SlashCommandBuilder()
.setName("stadiums")
.setDescription("عرض ملاعب البطولة"),

new SlashCommandBuilder()
.setName("pick_team")
.setDescription("اختر منتخبك المفضل"),

new SlashCommandBuilder()
.setName("my_team")
.setDescription("عرض منتخبك المختار"),

new SlashCommandBuilder()
.setName("guess_team")
.setDescription("لعبة خمن المنتخب"),

new SlashCommandBuilder()
.setName("leaderboard")
.setDescription("عرض ترتيب اللاعبين")
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
try {
console.log("Started refreshing application commands.");

await rest.put(
  Routes.applicationCommands(process.env.CLIENT_ID),
  { body: commands }
);

console.log("Successfully reloaded application commands.");

} catch (error) {
console.error(error);
}
})();