const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { footerIcon } = require('D:/Armour Studios/Tournabot/Tournabot/functions.js');
require('dotenv').config();

const { DISCORDTOKEN, DISCORD_TOKEN, CLIENT_ID } = process.env;
const token = DISCORDTOKEN || DISCORD_TOKEN;
const clientId = CLIENT_ID || Buffer.from(token.split('.')[0], 'base64').toString();

const commands = require('./deploy_commands_list'); // I'll extract the list to a separate file for easier testing if needed, but for now I'll just check deploy_commands.js directly

console.log('--- DIAGNOSTIC START ---');
console.log('Footer Icon URL:', footerIcon);
console.log('Client ID:', clientId);

try {
    const deployScript = require('fs').readFileSync('D:/Armour Studios/Tournabot/Tournabot/deploy_commands.js', 'utf8');
    const match = deployScript.match(/const commands = \[(.*?)\]\s+\.map/s);
    if (match) {
        console.log('Found commands array in deploy_commands.js');
        // We can't easily eval it safely here without risks, but we can count occurrences of ".setName('"
        const count = (deployScript.match(/\.setName\('/g) || []).length;
        console.log('Estimated number of commands (by .setName count):', count);

        // Let's actually check for 'podium'
        if (deployScript.includes("setName('podium')")) {
            console.log("Command 'podium' IS present in deploy_commands.js");
        } else {
            console.log("Command 'podium' IS NOT present in deploy_commands.js");
        }
    }
} catch (e) {
    console.error('Error reading deploy_commands.js:', e);
}

// Check what Discord currently has registered
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Fetching global application commands from Discord...');
        const data = await rest.get(Routes.applicationCommands(clientId));
        console.log(`Discord has ${data.length} global commands registered.`);
        console.log('Command names:', data.map(c => c.name).join(', '));

        if (data.some(c => c.name === 'podium')) {
            console.log("Command 'podium' IS registered with Discord.");
        } else {
            console.log("Command 'podium' IS NOT registered with Discord.");
        }
    } catch (error) {
        console.error('Error fetching commands from Discord:', error);
    }
})();
