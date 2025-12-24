const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const { DISCORDTOKEN, DISCORD_TOKEN, CLIENT_ID } = process.env;
const token = DISCORDTOKEN || DISCORD_TOKEN;

console.log('--- DEPLOYMENT SCRIPT START ---');
console.log(`Environment Checks:`);
console.log(`- DISCORDTOKEN present: ${!!DISCORDTOKEN}`);
console.log(`- DISCORD_TOKEN present: ${!!DISCORD_TOKEN}`);
console.log(`- CLIENT_ID in env: ${!!CLIENT_ID}`);

if (!token) {
    console.error('CRITICAL: No token found in environment. Please create a .env file with DISCORDTOKEN=your_token_here');
    process.exit(1);
}

// Use CLIENT_ID from env, or extract from token as fallback
const clientId = CLIENT_ID || Buffer.from(token.split('.')[0], 'base64').toString();
console.log(`- Using Client ID: ${clientId}`);

const commands = [
    new SlashCommandBuilder().setName('help').setDescription('List all commands or info about a specific command'),
    new SlashCommandBuilder().setName('account').setDescription('User account linking and status checks')
        .addSubcommand(subcommand =>
            subcommand.setName('link').setDescription('Link your smash.gg account')
                .addStringOption(option => option.setName('url').setDescription('Your smash.gg profile URL').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('unlink').setDescription('Unlink your smash.gg account'))
        .addSubcommand(subcommand =>
            subcommand.setName('status').setDescription('Check your registration status for a tournament')
                .addStringOption(option => option.setName('url').setDescription('Tournament/Event URL'))),
    new SlashCommandBuilder().setName('results').setDescription('Fetch tournament results for a user')
        .addStringOption(option => option.setName('user').setDescription('The user to check (ID, mention, or tag)')),
    new SlashCommandBuilder().setName('standings').setDescription('Fetch tournament standings')
        .addStringOption(option => option.setName('url').setDescription('Tournament standings URL').setRequired(true)),
    new SlashCommandBuilder().setName('upcoming').setDescription('Fetch upcoming tournament sets')
        .addStringOption(option => option.setName('url').setDescription('Tournament URL').setRequired(true)),
    new SlashCommandBuilder().setName('announce').setDescription('Announce tournaments with event information')
        .addStringOption(option => option.setName('url').setDescription('Tournament URL').setRequired(true))
        .addStringOption(option => option.setName('ping').setDescription('Whether to ping the role').addChoices({ name: 'Ping', value: 'ping' }, { name: 'No Ping', value: 'no' })),
    new SlashCommandBuilder().setName('mm').setDescription('Improved role-based matchmaking')
        .addSubcommand(subcommand => subcommand.setName('set').setDescription('Set the matchmaking role').addRoleOption(option => option.setName('role').setDescription('The role to use').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('on').setDescription('Go online for matchmaking'))
        .addSubcommand(subcommand => subcommand.setName('off').setDescription('Go offline for matchmaking'))
        .addSubcommand(subcommand => subcommand.setName('list').setDescription('List users online for matchmaking'))
        .addSubcommand(subcommand => subcommand.setName('ping').setDescription('Ping online users for matchmaking')),
    new SlashCommandBuilder().setName('remind').setDescription('Toggle tournament reminders'),
    new SlashCommandBuilder().setName('search').setDescription('Search for upcoming tournaments by game')
        .addStringOption(option => option.setName('game').setDescription('The game to search for (Ultimate/Valorant)').setRequired(true)),
    new SlashCommandBuilder().setName('dq').setDescription('Manage DQ pinging for tournaments')
        .addSubcommand(subcommand =>
            subcommand.setName('ping').setDescription('Start DQ pinging for a tournament')
                .addStringOption(option => option.setName('url').setDescription('Tournament URL').setRequired(true))
                .addIntegerOption(option => option.setName('event_number').setDescription('Specific event number (optional)'))
                .addStringOption(option => option.setName('event_name').setDescription('Specific event name (optional)')))
        .addSubcommand(subcommand => subcommand.setName('stop').setDescription('Stop DQ pinging')),
    new SlashCommandBuilder().setName('set').setDescription('Configure bot settings for the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('announcemessage').setDescription('Set the tournament announcement message').addStringOption(option => option.setName('message').setDescription('The message (leave empty to reset)')))
        .addSubcommand(subcommand => subcommand.setName('announcechannel').setDescription('Set the announcement channel').addChannelOption(option => option.setName('channel').setDescription('The channel').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('dqpingchannel').setDescription('Set the DQ pinging channel').addChannelOption(option => option.setName('channel').setDescription('The channel').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('pingrole').setDescription('Set the announcement ping role').addRoleOption(option => option.setName('role').setDescription('The role (leave empty to reset)')))
        .addSubcommand(subcommand => subcommand.setName('timezone').setDescription('Set the server timezone').addStringOption(option => option.setName('city').setDescription('Select a city').addChoices(
            { name: 'Los Angeles (PT)', value: 'America/Los_Angeles' },
            { name: 'Phoenix (MST)', value: 'America/Phoenix' },
            { name: 'Denver (MT)', value: 'America/Denver' },
            { name: 'Regina (CST)', value: 'America/Regina' },
            { name: 'Chicago (CT)', value: 'America/Chicago' },
            { name: 'New York (ET)', value: 'America/New_York' },
            { name: 'Honolulu (HST)', value: 'Pacific/Honolulu' }
        )))
        .addSubcommand(subcommand => subcommand.setName('language').setDescription('Set the server language').addStringOption(option => option.setName('code').setDescription('ISO-639-1 code (e.g. es, fr)'))),
    new SlashCommandBuilder().setName('league').setDescription('Manage automated league announcements')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('link').setDescription('Link a league to track').addStringOption(option => option.setName('url').setDescription('The League URL').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('unlink').setDescription('Unlink a league').addStringOption(option => option.setName('url').setDescription('The League URL or Slug').setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand => subcommand.setName('list').setDescription('List linked leagues'))
]
    .map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
