const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const { DISCORDTOKEN, DISCORD_TOKEN, CLIENT_ID } = process.env;
const token = DISCORDTOKEN || DISCORD_TOKEN;

if (!token) {
    console.error('CRITICAL: No token found in environment.');
    process.exit(1);
}

const clientId = CLIENT_ID || Buffer.from(token.split('.')[0], 'base64').toString();

const commands = [
    new SlashCommandBuilder().setName('help').setDescription('List all commands or info about a specific command'),

    // Account Management (Keep Separate)
    new SlashCommandBuilder().setName('account').setDescription('User account linking and status checks')
        .addSubcommand(subcommand =>
            subcommand.setName('link').setDescription('Link your start.gg account')
                .addStringOption(option => option.setName('url').setDescription('Your start.gg profile URL').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('unlink').setDescription('Unlink your start.gg account'))
        .addSubcommand(subcommand =>
            subcommand.setName('status').setDescription('Check your registration status for a tournament')
                .addStringOption(option => option.setName('url').setDescription('Tournament/Event URL'))),

    // Unified Event Command
    new SlashCommandBuilder().setName('event').setDescription('View event info, brackets, streams, and more')
        .addSubcommand(sub => sub.setName('entrants').setDescription('List seeded entrants').addStringOption(opt => opt.setName('url').setDescription('Event URL').setRequired(true)))
        .addSubcommand(sub => sub.setName('streams').setDescription('List active streams').addStringOption(opt => opt.setName('url').setDescription('Tournament/League URL').setRequired(true)))
        .addSubcommand(sub => sub.setName('upsets').setDescription('Show top upsets').addStringOption(opt => opt.setName('url').setDescription('Event URL').setRequired(true)))
        .addSubcommand(sub => sub.setName('bracket').setDescription('View tournament bracket').addStringOption(opt => opt.setName('url').setDescription('Event URL').setRequired(true)))
        .addSubcommand(sub => sub.setName('upcoming').setDescription('Show upcoming sets').addStringOption(opt => opt.setName('url').setDescription('Event URL').setRequired(true)))
        .addSubcommand(sub => sub.setName('search').setDescription('Search for upcoming tournaments').addStringOption(opt => opt.setName('game').setDescription('Game Name').setRequired(true).setAutocomplete(true))),

    // Unified Player Command
    new SlashCommandBuilder().setName('player').setDescription('View player stats, results, and history')
        .addSubcommand(sub => sub.setName('profile').setDescription('View player profile').addStringOption(opt => opt.setName('user').setDescription('Player tag or slug').setRequired(true)))
        .addSubcommand(sub => sub.setName('results').setDescription('View recent tournament results').addStringOption(opt => opt.setName('user').setDescription('Player (Linked account by default)')))
        .addSubcommand(sub => sub.setName('head2head').setDescription('Compare match history between two players').addStringOption(opt => opt.setName('player1').setDescription('First player').setRequired(true)).addStringOption(opt => opt.setName('player2').setDescription('Second player').setRequired(true))),

    // Preserved Top-Level Commands
    new SlashCommandBuilder().setName('standings').setDescription('Fetch tournament standings')
        .addStringOption(option => option.setName('url').setDescription('Tournament standings URL').setRequired(true)),

    new SlashCommandBuilder().setName('podium').setDescription('Show top 3 placements for an event')
        .addStringOption(option => option.setName('url').setDescription('Event URL').setRequired(true)),

    new SlashCommandBuilder().setName('announce').setDescription('Announce tournaments (Manual)')
        .addStringOption(option => option.setName('url').setDescription('Tournament URL').setRequired(true))
        .addStringOption(option => option.setName('ping').setDescription('Whether to ping the role').addChoices({ name: 'Ping', value: 'ping' }, { name: 'No Ping', value: 'no' })),

    new SlashCommandBuilder().setName('remind').setDescription('Toggle tournament reminders'),

    new SlashCommandBuilder().setName('live').setDescription('Manage and view live match updates')
        .addSubcommand(subcommand =>
            subcommand.setName('scores').setDescription('Show live match scores for an ongoing event')
                .addStringOption(option => option.setName('url').setDescription('Event URL').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('link').setDescription('Link a tournament or event for automatic updates')
                .addStringOption(option => option.setName('url').setDescription('Tournament or Event URL').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('unlink').setDescription('Unlink an event from live updates')
                .addStringOption(option => option.setName('url_or_slug').setDescription('The URL or Slug').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('list').setDescription('List all linked live updates')),

    // Scrim System (Team Scrims & Queue)
    new SlashCommandBuilder().setName('scrim').setDescription('Report scrim results and view rankings')
        .addSubcommand(sub => sub.setName('report').setDescription('Report match result').addStringOption(opt => opt.setName('match_id').setDescription('Match ID').setRequired(true).setAutocomplete(true)).addIntegerOption(opt => opt.setName('winner').setDescription('Winner').setRequired(true).addChoices({ name: 'Blue', value: 0 }, { name: 'Orange', value: 1 })))
        .addSubcommand(sub => sub.setName('profile').setDescription('View player scrim profile').addUserOption(opt => opt.setName('user').setDescription('User')))
        .addSubcommand(sub => sub.setName('leaderboard').setDescription('View player leaderboard').addStringOption(opt => opt.setName('game').setDescription('Game').addChoices({ name: 'Rocket League', value: 'rocket_league' })))
        .addSubcommand(sub => sub.setName('team-leaderboard').setDescription('View team leaderboard').addStringOption(opt => opt.setName('game').setDescription('Game').addChoices({ name: 'Rocket League', value: 'rocket_league' })))
        .addSubcommand(sub => sub.setName('queue').setDescription('Queue for a scrim').addStringOption(opt => opt.setName('team_name').setDescription('Team Name').setRequired(true).setAutocomplete(true)).addStringOption(opt => opt.setName('game').setDescription('Game').addChoices({ name: 'Rocket League', value: 'rocket_league' })))
        .addSubcommand(sub => sub.setName('status').setDescription('Check queue status'))
        .addSubcommand(sub => sub.setName('seeking').setDescription('Broadcast LFS alert').addStringOption(opt => opt.setName('game').setDescription('Game').addChoices({ name: 'Rocket League', value: 'rocket_league' }).setRequired(true)).addStringOption(opt => opt.setName('time').setDescription('Time').setRequired(true)).addStringOption(opt => opt.setName('rank').setDescription('Rank').setRequired(true)).addStringOption(opt => opt.setName('mmr').setDescription('MMR').setRequired(true)).addStringOption(opt => opt.setName('notes').setDescription('Notes')).addUserOption(opt => opt.setName('contact').setDescription('Contact')))
        .addSubcommandGroup(group => group.setName('debug').setDescription('Debug tools')
            .addSubcommand(sub => sub.setName('queue-add').setDescription('Add fake team').addStringOption(opt => opt.setName('name').setDescription('Team Name').setRequired(true)))
            .addSubcommand(sub => sub.setName('queue-clear').setDescription('Clear queue')))
        .addSubcommandGroup(group => group.setName('team').setDescription('Manage scrim team')
            .addSubcommand(sub => sub.setName('create').setDescription('Create team').addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true)))
            .addSubcommand(sub => sub.setName('view').setDescription('View team').addStringOption(opt => opt.setName('name').setDescription('Name').setAutocomplete(true)))
            .addSubcommand(sub => sub.setName('invite').setDescription('Invite player').addUserOption(opt => opt.setName('user').setDescription('Player').setRequired(true)))
            .addSubcommand(sub => sub.setName('join').setDescription('Join team').addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true).setAutocomplete(true)))
            .addSubcommand(sub => sub.setName('remove').setDescription('Remove player').addUserOption(opt => opt.setName('user').setDescription('Player').setRequired(true)))
            .addSubcommand(sub => sub.setName('disband').setDescription('Delete team'))),

    new SlashCommandBuilder().setName('broadcast').setDescription('Global cross-server announcements')
        .addSubcommand(sub =>
            sub.setName('ad')
                .setDescription('Broadcast a custom advertisement or announcement')
                .addStringOption(opt => opt.setName('title').setDescription('The title').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('The content').setRequired(true))
                .addStringOption(opt => opt.setName('image_url').setDescription('Optional image URL'))
                .addStringOption(opt => opt.setName('link').setDescription('Optional link URL'))
        )
        .addSubcommand(sub =>
            sub.setName('tournament')
                .setDescription('Broadcast a tournament or league from Start.gg')
                .addStringOption(opt => opt.setName('url').setDescription('Start.gg Tournament or League URL').setRequired(true))
        ),

    new SlashCommandBuilder().setName('queue').setDescription('Join the rank-locked 6-man queue')
        .addSubcommand(sub =>
            sub.setName('join')
                .setDescription('Join the queue for your current rank')
                .addStringOption(opt => opt.setName('game').setDescription('The game to queue for').addChoices({ name: 'Rocket League', value: 'rocket_league' }))
        )
        .addSubcommand(sub =>
            sub.setName('leave')
                .setDescription('Leave the current queue')
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Check how many players are in your rank queue')
                .addStringOption(opt => opt.setName('game').setDescription('The game to check').addChoices({ name: 'Rocket League', value: 'rocket_league' }))
        ),

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
        .addSubcommand(subcommand => subcommand.setName('matchfeed').setDescription('Set the Live Match Feed channel').addChannelOption(option => option.setName('channel').setDescription('The channel').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('standingschannel').setDescription('Set the Auto-Standings channel').addChannelOption(option => option.setName('channel').setDescription('The channel').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('seedchannel').setDescription('Set the Seed Generator output channel').addChannelOption(option => option.setName('channel').setDescription('The channel').setRequired(true)))
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
        .addSubcommand(subcommand => subcommand.setName('language').setDescription('Set the server language').addStringOption(option => option.setName('code').setDescription('ISO-639-1 code (e.g. es, fr)')))
        .addSubcommand(subcommand => subcommand.setName('promotionchannel').setDescription('Set the channel for cross-server promotion').addChannelOption(option => option.setName('channel').setDescription('The channel').setRequired(true))),

    new SlashCommandBuilder().setName('league').setDescription('Manage automated tournament & league announcements')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('link').setDescription('Link a tournament or league to track').addStringOption(option => option.setName('url').setDescription('The URL').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('unlink').setDescription('Unlink a tournament or league').addStringOption(option => option.setName('url_or_slug').setDescription('The URL or Slug').setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand => subcommand.setName('schedule').setDescription('Set announcement schedule').addStringOption(option => option.setName('url_or_slug').setDescription('Slug').setRequired(true).setAutocomplete(true)).addStringOption(option => option.setName('hours_before').setDescription('Comma-separated hours before start (e.g. "24, 1")').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('list').setDescription('List linked tournaments & leagues')),

    new SlashCommandBuilder().setName('test').setDescription('Admin testing commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('livefeed').setDescription('Test live match feed embeds').addStringOption(option => option.setName('url').setDescription('Tournament URL').setRequired(true))),

    new SlashCommandBuilder().setName('seed').setDescription('Generate tournament seeds for Rocket League')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('generate').setDescription('Generate seeds for an event').addStringOption(option => option.setName('url').setDescription('Start.gg event URL').setRequired(true))),

    // Bracket (Still standalone for quick visualizer? No, moving to /event bracket as per plan)
    // Wait, plan said /event bracket. But user asked to keep "standings, podium, announcements".
    // I moved "bracket" to /event bracket.

    // Help & Setup
    new SlashCommandBuilder().setName('setup').setDescription('Automated server setup with channel creation')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
