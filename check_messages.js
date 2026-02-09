const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const { DISCORDTOKEN, DISCORD_TOKEN } = process.env;
const token = DISCORDTOKEN || DISCORD_TOKEN;
const channelModel = require('./database/models/channel');
const database = require('./database/database');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once('ready', async () => {
    console.log(`Ready as ${client.user.tag}`);
    await database;

    // Check all channels in DB
    const allChannels = await channelModel.find({});
    for (const c of allChannels) {
        console.log(`Guild: ${c.guildid} | Match Feed: ${c.matchfeedchannel}`);
        if (c.matchfeedchannel) {
            try {
                const channel = await client.channels.fetch(c.matchfeedchannel);
                if (channel) {
                    const messages = await channel.messages.fetch({ limit: 3 });
                    console.log(`--- Last 3 Messages in ${channel.name} (${c.guildid}) ---`);
                    messages.forEach(m => {
                        console.log(`[${m.createdAt.toISOString()}] ${m.author.username}: ${m.embeds.length ? 'EMBED' : 'TEXT'}`);
                        if (m.embeds.length) {
                            console.log(` - Title: ${m.embeds[0].title}`);
                            console.log(` - Description: ${m.embeds[0].description}`);
                        }
                    });
                }
            } catch (e) {
                console.log(`Could not fetch channel ${c.matchfeedchannel}: ${e.message}`);
            }
        }
    }
    process.exit(0);
});

client.login(token);
