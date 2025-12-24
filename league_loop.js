const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { convertEpoch, convertEpochToClock, queryAPI } = require('./functions');

// MongoDB Models
const leagueModel = require('./database/models/league');
const channelModel = require('./database/models/channel');
const announcemessageModel = require('./database/models/announcemessage');
const pingroleModel = require('./database/models/pingrole');
const timezoneModel = require('./database/models/timezone');
const languageModel = require('./database/models/language');

module.exports = async (client) => {
    // Run immediately on startup, then interval
    checkLeagues(client);
    setInterval(() => checkLeagues(client), 3600000); // Check every hour
};

async function checkLeagues(client) {
    // console.log('Checking leagues...');
    const leagues = await leagueModel.find({});
    if (leagues.length === 0) return;

    // optimization: group by slug to avoid duplicate API calls
    const uniqueSlugs = [...new Set(leagues.map(l => l.slug))];

    for (const slug of uniqueSlugs) {
        try {
            const query = `query LeagueUpcoming($slug: String) {
                league(slug: $slug) {
                    name
                    tournaments(query: { filter: { upcoming: true }, perPage: 1, sort: "startAt" }) {
                        nodes {
                            id
                            name
                            slug
                            startAt
                            registrationClosesAt
                            url
                            images { url type }
                            events {
                                name
                                startAt
                                checkInEnabled
                                checkInBuffer
                                checkInDuration
                            }
                            streams {
                                streamSource
                                streamName
                            }
                        }
                    }
                }
            }`;

            const data = await queryAPI(query, { slug });
            if (!data || !data.data || !data.data.league || !data.data.league.tournaments.nodes.length) continue;

            const nextTournament = data.data.league.tournaments.nodes[0];
            const leagueName = data.data.league.name;

            // Find all guild correlations for this slug
            const relevantLeagues = leagues.filter(l => l.slug === slug);

            for (const leagueDoc of relevantLeagues) {
                // If this tournament ID is different from the last one announced
                if (leagueDoc.lastAnnouncedTournamentId != nextTournament.id) {
                    await announceTournament(client, leagueDoc.guildid, nextTournament, leagueName);

                    // Update DB
                    leagueDoc.lastAnnouncedTournamentId = nextTournament.id;
                    await leagueDoc.save();
                }
            }

        } catch (err) {
            console.error(`Error checking league ${slug}:`, err);
        }
    }
}

async function announceTournament(client, guildID, tournament, leagueName) {
    try {
        const channelResult = await channelModel.findOne({ guildid: guildID });
        if (!channelResult) return; // No announce channel set

        const announceChannel = client.channels.cache.get(channelResult.channelid);
        if (!announceChannel) return; // Channel not found/bot can't see

        // Get Guild Settings
        const tzResult = await timezoneModel.findOne({ guildid: guildID });
        const cityTimezone = tzResult ? tzResult.timezone : 'America/Los_Angeles';

        const announceMessageResult = await announcemessageModel.findOne({ guildid: guildID });
        const announceText = announceMessageResult ? announceMessageResult.announcemessage : `New tournament in **${leagueName}**:`;

        const pingRoleResult = await pingroleModel.findOne({ guildid: guildID });
        const pingingRole = pingRoleResult ? `<@&${pingRoleResult.role}>` : '';

        // Format Description
        const eventsInfo = tournament.events.map(event => {
            let info = `**${event.name}** - ${convertEpoch(event.startAt, cityTimezone)}`;
            if (event.checkInEnabled) {
                const open = convertEpochToClock(event.startAt - event.checkInBuffer - event.checkInDuration, cityTimezone, false);
                const close = convertEpochToClock(event.startAt - event.checkInBuffer, cityTimezone, false);
                info += `\nCheck-in: ${open} - ${close}`;
            }
            return info;
        }).join('\n\n');

        const streams = tournament.streams
            .filter(s => s.streamSource === 'TWITCH')
            .map(s => `https://twitch.tv/${s.streamName}`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'League Announcement', iconURL: 'https://i.imgur.com/v1hKkQ6.png' })
            .setTitle(tournament.name)
            .setURL(`https://start.gg/${tournament.url || 'tournament/' + tournament.slug}`)
            .setColor('#FF3636')
            .setThumbnail(tournament.images?.find(i => i.type === 'profile')?.url || 'https://i.imgur.com/v1hKkQ6.png')
            .setDescription(`${announceText}`)
            .addFields(
                { name: '📅 Registration Closes', value: convertEpoch(tournament.registrationClosesAt, cityTimezone), inline: true },
                { name: '📍 Status', value: 'Open', inline: true },
                { name: '🏆 Events', value: eventsInfo }
            )
            .setImage(tournament.images?.find(i => i.type === 'banner')?.url)
            .setFooter({ text: 'Powered by TournaBot', iconURL: 'https://i.imgur.com/gUwhkw3.png' })
            .setTimestamp();

        if (streams) embed.addFields({ name: '📺 Streams', value: streams });

        // Localization
        const langResult = await languageModel.findOne({ guildid: guildID });
        if (langResult && langResult.language !== 'en') {
            // Placeholder: Translation logic would go here if needed
        }

        await announceChannel.send({ content: pingingRole, embeds: [embed] });
        console.log(`Auto-announced ${tournament.name} in guild ${guildID}`);

    } catch (error) {
        console.error(`Failed to announce in guild ${guildID}:`, error);
    }
}
