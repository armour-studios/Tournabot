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
    new SlashCommandBuilder().setName('results_debug').setDescription('Debug results check'),
    new SlashCommandBuilder().setName('standings').setDescription('Fetch tournament standings')
        .addStringOption(option => option.setName('url').setDescription('Tournament standings URL').setRequired(true)),
    new SlashCommandBuilder().setName('upcoming').setDescription('Fetch upcoming tournament sets')
        .addStringOption(option => option.setName('url').setDescription('Tournament URL').setRequired(true)),
    new SlashCommandBuilder().setName('announce').setDescription('Announce tournaments with event information')
        .addStringOption(option => option.setName('url').setDescription('Tournament URL').setRequired(true))
        .addStringOption(option => option.setName('ping').setDescription('Whether to ping the role').addChoices({ name: 'Ping', value: 'ping' }, { name: 'No Ping', value: 'no' })),
    new SlashCommandBuilder().setName('remind').setDescription('Toggle tournament reminders'),
    new SlashCommandBuilder().setName('search').setDescription('Search for upcoming tournaments by game')
        .addStringOption(option => option.setName('game').setDescription('The game to search for').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('h2h').setDescription('Compare match history between two players')
        .addStringOption(option => option.setName('player1').setDescription('First player (tag or slug)').setRequired(true))
        .addStringOption(option => option.setName('player2').setDescription('Second player (tag or slug)').setRequired(true)),
    new SlashCommandBuilder().setName('profile').setDescription('View a player\'s tournament history')
        .addStringOption(option => option.setName('user').setDescription('Player tag or slug').setRequired(true)),
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
    new SlashCommandBuilder().setName('upsets').setDescription('Show the biggest upsets for a tournament or event')
        .addStringOption(option => option.setName('url').setDescription('Tournament or Event URL').setRequired(true)),
    new SlashCommandBuilder().setName('streams').setDescription('List active streams for an event or league')
        .addStringOption(option => option.setName('url').setDescription('Tournament or League URL').setRequired(true)),
    new SlashCommandBuilder().setName('entrants').setDescription('List seeded entrants for an upcoming event')
        .addStringOption(option => option.setName('url').setDescription('Event URL').setRequired(true)),
    new SlashCommandBuilder().setName('podium').setDescription('Show top 3 placements for an event')
        .addStringOption(option => option.setName('url').setDescription('Event URL').setRequired(true)),
    new SlashCommandBuilder().setName('scrim').setDescription('Report scrim results and view rankings')
        .addSubcommand(sub =>
            sub.setName('report')
                .setDescription('Report the result of a match')
                .addStringOption(opt => opt.setName('match_id').setDescription('The ID provided when the match started').setRequired(true).setAutocomplete(true))
                .addIntegerOption(opt => opt.setName('winner').setDescription('The winning team').setRequired(true).addChoices({ name: 'Blue', value: 0 }, { name: 'Orange', value: 1 }))
        )
        .addSubcommand(sub =>
            sub.setName('profile')
                .setDescription('View a player\'s scrim profile')
                .addUserOption(opt => opt.setName('user').setDescription('The user to view'))
        )
        .addSubcommand(sub =>
            sub.setName('leaderboard')
                .setDescription('View the global player leaderboard')
                .addStringOption(opt => opt.setName('game').setDescription('The game to view').addChoices({ name: 'Rocket League', value: 'rocket_league' }))
        )
        .addSubcommand(sub =>
            sub.setName('team-leaderboard')
                .setDescription('View the global team leaderboard')
                .addStringOption(opt => opt.setName('game').setDescription('The game to view').addChoices({ name: 'Rocket League', value: 'rocket_league' }))
        )
        .addSubcommand(sub =>
            sub.setName('queue')
                .setDescription('Queue your team for a scrimmage')
                .addStringOption(opt => opt.setName('team_name').setDescription('The name of your team').setRequired(true).setAutocomplete(true))
                .addStringOption(opt => opt.setName('game').setDescription('The game to queue for').addChoices({ name: 'Rocket League', value: 'rocket_league' }))
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Check who is currently in the scrimmage queue')
        )
        .addSubcommand(sub =>
            sub.setName('guide')
                .setDescription('View the scrim system guide')
        )
        .addSubcommandGroup(group =>
            group.setName('team')
                .setDescription('Manage your scrim team')
                .addSubcommand(sub =>
                    sub.setName('create')
                        .setDescription('Create a new scrim team')
                        .addStringOption(opt => opt.setName('name').setDescription('The team name').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('view')
                        .setDescription('View team roster and stats')
                        .addStringOption(opt => opt.setName('name').setDescription('The team name to look up').setAutocomplete(true))
                )
                .addSubcommand(sub =>
                    sub.setName('invite')
                        .setDescription('Invite a player to your team')
                        .addUserOption(opt => opt.setName('user').setDescription('The player to invite').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('join')
                        .setDescription('Join a team you were invited to')
                        .addStringOption(opt => opt.setName('name').setDescription('The team name').setRequired(true).setAutocomplete(true))
                )
                .addSubcommand(sub =>
                    sub.setName('remove')
                        .setDescription('Remove a player from your team')
                        .addUserOption(opt => opt.setName('user').setDescription('The player to remove').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('disband')
                        .setDescription('Delete your team')
                )
        ),
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
    new SlashCommandBuilder().setName('league').setDescription('Manage automated league announcements')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('link').setDescription('Link a league to track').addStringOption(option => option.setName('url').setDescription('The League URL').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('unlink').setDescription('Unlink a league').addStringOption(option => option.setName('url').setDescription('The League URL or Slug').setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand => subcommand.setName('list').setDescription('List linked leagues')),
    new SlashCommandBuilder().setName('test').setDescription('Admin testing commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('livefeed').setDescription('Test live match feed embeds').addStringOption(option => option.setName('url').setDescription('Tournament URL').setRequired(true))),
    new SlashCommandBuilder().setName('seed').setDescription('Generate tournament seeds for Rocket League')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('generate').setDescription('Generate seeds for an event').addStringOption(option => option.setName('url').setDescription('Start.gg event URL').setRequired(true))),
    new SlashCommandBuilder().setName('promote').setDescription('Promote a tournament across all partnered servers')
        .addStringOption(option => option.setName('url').setDescription('Tournament URL').setRequired(true)),
    new SlashCommandBuilder().setName('bracket').setDescription('Visualize tournament brackets and find players')
        .addSubcommand(sub => sub.setName('view').setDescription('View a tournament bracket')
            .addStringOption(opt => opt.setName('url').setDescription('Tournament/Event URL').setRequired(true)))
        .addSubcommand(sub => sub.setName('find').setDescription('Find a player in the bracket')
            .addStringOption(opt => opt.setName('url').setDescription('Tournament/Event URL').setRequired(true))
            .addStringOption(opt => opt.setName('player').setDescription('Player tag or slug').setRequired(true))),
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
