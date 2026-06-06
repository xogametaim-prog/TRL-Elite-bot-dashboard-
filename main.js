const express = require("express");
const {
    Client,
    GatewayIntentBits,
    Partials
} = require("discord.js");

const { generateAIResponse } = require("./gemini");

const app = express();
const PORT = process.env.PORT || 3000;

// Web Server for Render
app.get("/", (req, res) => {
    res.send("Bot is online!");
});

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

// Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// AI Chat System
client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;

        const isMentioned = message.mentions.has(client.user);
        const isAiRoom = message.channel.name === "ai-chat";

        if (!isMentioned && !isAiRoom) return;

        await message.channel.sendTyping();

        let prompt = message.content;

        if (isMentioned) {
            prompt = prompt.replace(
                new RegExp(`<@!?${client.user.id}>`, "g"),
                ""
            ).trim();
        }

        if (!prompt.length) {
            prompt = "مرحباً";
        }

        const response = await generateAIResponse(
            message.author.id,
            prompt
        );

        const finalResponse =
            response.length > 2000
                ? response.slice(0, 1997) + "..."
                : response;

        await message.reply(finalResponse);

    } catch (error) {
        console.error(error);

        await message.reply(
            "⚠️ حدث خطأ أثناء معالجة الطلب."
        );
    }
});

client.login(process.env.DISCORD_TOKEN);