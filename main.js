const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const {
Client,
GatewayIntentBits,
Events,
ActionRowBuilder,
StringSelectMenuBuilder,
EmbedBuilder,
PermissionFlagsBits
} = require("discord.js");

// ================= WEB SERVER =================

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

db.run(`
CREATE TABLE IF NOT EXISTS guilds (
guildId TEXT PRIMARY KEY,
language TEXT NOT NULL
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS leaderboard (
userId TEXT PRIMARY KEY,
points INTEGER DEFAULT 0
)
`);

// ================= LANGUAGES =================

const texts = {

ar: {

help: "📖 قائمة الأوامر",

worldcup:
"🏆 كأس العالم 2026 سيقام في أمريكا وكندا والمكسيك",

pick:
"⚽ اختر منتخبك المفضل",

alreadyPicked:
"❌ لقد اخترت منتخباً بالفعل",

myTeam:
"🏆 منتخبك هو",

noTeam:
"❌ لم تختر منتخباً بعد",

guess:
"🎮 خمن المنتخب",

languageSaved:
"✅ تم حفظ اللغة العربية",

broadcastDone:
"✅ تم إرسال الرسالة",

leaderboard:
"🏅 ترتيب اللاعبين"

},

en: {

help: "📖 Commands List",

worldcup:
"🏆 FIFA World Cup 2026 will be hosted by USA, Canada and Mexico",

pick:
"⚽ Choose your favourite team",

alreadyPicked:
"❌ You already selected a team",

myTeam:
"🏆 Your team is",

noTeam:
"❌ No team selected",

guess:
"🎮 Guess The Team",

languageSaved:
"✅ English language saved",

broadcastDone:
"✅ Message sent",

leaderboard:
"🏅 Leaderboard"

}

};

// ================= CLIENT =================

const client = new Client({
intents: [GatewayIntentBits.Guilds]
});

client.once(
Events.ClientReady,
(clientReady) => {

console.log(
`Logged in as ${clientReady.user.tag}`
);

}
);

// ================= GET LANGUAGE =================

function getLanguage(guildId) {

return new Promise((resolve) => {

db.get(
"SELECT language FROM guilds WHERE guildId = ?",
[guildId],
(err, row) => {

resolve(row?.language || "ar");

}
);

});

}
// ================= TEAMS =================

const teams = [

"USA",
"Mexico",
"Canada",
"Algeria",
"Argentina",
"Australia",
"Austria",
"Belgium",
"Bosnia",
"Brazil",
"Cape Verde",
"Colombia",
"DR Congo",
"Cote d'Ivoire",
"Croatia",
"Curacao",
"Czech Republic",
"Ecuador",
"Egypt",
"England",
"France",
"Germany",
"Ghana",
"Haiti",

"Iran",
"Iraq",
"Japan",
"Jordan",
"South Korea",
"Morocco",
"Netherlands",
"New Zealand",
"Norway",
"Panama",
"Paraguay",
"Portugal",
"Qatar",
"Saudi Arabia",
"Scotland",
"Senegal",
"South Africa",
"Spain",
"Sweden",
"Switzerland",
"Tunisia",
"Turkey",
"Uruguay",
"Uzbekistan"

];

// ================= TEAM FLAGS =================

const teamFlags = {

"USA":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513905212201846392/USA.png",

"Mexico":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513905218029617182/MEX.png",

"Canada":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513904410798063696/CAN.png",

"Algeria":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906087617626242/ALG.png",

"Argentina":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906313787215932/ARG.png",

"Australia":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906551180492971/AUS.png",

"Austria":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906667237019679/AUT.png",

"Belgium":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906790348226712/BEL.png",

"Bosnia":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906992207630427/BIH.png",

"Brazil":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513908176137748613/BRA.png",

"Cape Verde":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513908274368348200/CPV.png",

"Colombia":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513908455994429512/COL.png",

"DR Congo":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513908591680294962/COD.png",

"Cote d'Ivoire":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513908707686224002/CIV.png",

"Croatia":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513909283111178390/CRO.png",

"Curacao":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513909401457659934/CUW.png",

"Czech Republic":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513910724903043335/CZE.png",

"Ecuador":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911000250843337/ECU.png",

"Egypt":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911250739007549/EGY.png",

"England":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911313422880788/ENG.png",

"France":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911401448603809/FRA.png",

"Germany":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911493530484807/GER.png",

"Ghana":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911571179638876/GHA.png",

"Haiti":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911750888784072/HAI.png"

};
