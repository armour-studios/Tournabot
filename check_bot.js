const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const { DISCORDTOKEN, DISCORD_TOKEN } = process.env;
const token = DISCORDTOKEN || DISCORD_TOKEN;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}`);
    console.log(`Guilds: ${client.guilds.cache.size}`);
    client.guilds.cache.forEach(g => console.log(` - ${g.name} (${g.id})`));
    process.exit(0);
});

client.login(token).catch(err => {
    console.error('Login failed:', err);
    process.exit(1);
});
