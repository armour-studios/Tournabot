const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { footerIcon } = require('./functions.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { DISCORDTOKEN, DISCORD_TOKEN, CLIENT_ID } = process.env;
const token = DISCORDTOKEN || DISCORD_TOKEN;

const commands = [];
const commandsFolder = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsFolder).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands.map(cmd => {
                    const builder = new SlashCommandBuilder()
                        .setName(cmd.name)
                        .setDescription(cmd.description);
                    // Basic registration - you might need more complex logic for options
                    return builder.toJSON();
                })
            },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
