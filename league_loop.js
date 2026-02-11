const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { convertEpoch, convertEpochToClock, queryAPI, footerIcon, startggIcon } = require('./functions');

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
    const leagues = await leagueModel.find({});
    if (leagues.length === 0) return;

    // Filter distinctive slugs to query API once per league
    const uniqueSlugs = [...new Set(leagues.map(l => l.slug))];

    for (const record of uniqueSlugs) {
        try {
            const leagueDocs = leagues.filter(l => l.slug === record);
            const type = leagueDocs[0].type; // Unified type check

            const rangeStart = Math.floor(Date.now() / 1000);
            const rangeEnd = rangeStart + (8 * 24 * 60 * 60);

            const leagueQuery = `query LeagueUpcoming($slug: String, $after: Timestamp, $before: Timestamp) {
                league(slug: $slug) {
                    name
                    tournaments(query: { filter: { afterDate: $after, beforeDate: $before }, perPage: 15, sort: "startAt" }) {
                        nodes {
                            id name slug startAt registrationClosesAt url images { url type }
                            events { name startAt checkInEnabled checkInBuffer checkInDuration }
                            streams { streamSource streamName }
                        }
                    }
                }
            }`;

            const tournamentQuery = `query TournamentUpcoming($slug: String) {
                tournament(slug: $slug) {
                    id name slug startAt registrationClosesAt url images { url type }
                    events { name startAt checkInEnabled checkInBuffer checkInDuration }
                    streams { streamSource streamName }
                }
            }`;

            const data = await queryAPI(type === 'league' ? leagueQuery : tournamentQuery, { slug: record, after: rangeStart, before: rangeEnd });

            if (!data || !data.data) continue;

            let tournaments = [];
            let leagueName = '';

            if (type === 'league' && data.data.league) {
                tournaments = data.data.league.tournaments.nodes;
                leagueName = data.data.league.name;
            } else if (type === 'tournament' && data.data.tournament) {
                tournaments = [data.data.tournament];
                leagueName = data.data.tournament.name;
            } else {
                continue;
            }

            // Process each guild linked to this league
            const relevantLeagues = leagues.filter(l => l.slug === record);

            for (const leagueDoc of relevantLeagues) {
                // Initialize map if missing (for legacy docs)
                if (!leagueDoc.announcedTournaments) {
                    leagueDoc.announcedTournaments = new Map();
                }

                // Default settings: 7 days, 3 days, 1 day, 1 hour
                const intervals = leagueDoc.announcementSettings && leagueDoc.announcementSettings.length > 0
                    ? leagueDoc.announcementSettings : [168, 72, 24, 1];

                let docModified = false;

                for (const tournament of tournaments) {
                    const now = Math.floor(Date.now() / 1000);
                    const timeUntilStart = tournament.startAt - now;
                    const hoursUntilStart = timeUntilStart / 3600;

                    // Skip if tournament already started
                    if (hoursUntilStart < 0) continue;

                    let sentIntervals = leagueDoc.announcedTournaments.get(tournament.id.toString()) || [];

                    for (const interval of intervals) {
                        // Check if we already sent this interval
                        if (sentIntervals.includes(interval)) continue;

                        // Check if we are within the window
                        // Window is: [Interval] down to [Interval - 10%] or -1h 
                        // e.g. for 24h, if it's 23.5h away, trigger. If it's 25h away, don't.
                        // But also handling missed polls: strictly less than interval
                        if (hoursUntilStart <= interval) {
                            // Avoid announcing archaic intervals (e.g. don't send "7 Days left" if it's 1 hour away)
                            // Only send if it's reasonably close to that interval, e.g., within half the interval or 12h
                            // Actually, simplification: If it's < interval and > next smaller interval? 
                            // Let's just say: only send if we haven't sent it, and it's time.

                            // Determine Hype Text
                            let hypeText = '';
                            if (interval >= 24) {
                                const days = Math.floor(interval / 24);
                                hypeText = `📅 **${days} Days Left!**`;
                            } else {
                                hypeText = `🚨 **Starting in ${Math.ceil(hoursUntilStart)} Hour(s)!**`;
                            }

                            // If it's extremely close (e.g. < 10 mins) and interval is big, maybe skip?
                            // For now, let's just send it.

                            await announceTournament(client, leagueDoc.guildid, tournament, leagueName, hypeText);
                            console.log(`Announced ${tournament.name} (${interval}h) for ${leagueDoc.guildid}`);

                            sentIntervals.push(interval);
                            leagueDoc.announcedTournaments.set(tournament.id.toString(), sentIntervals);
                            docModified = true;
                        }
                    }
                }

                if (docModified) {
                    await leagueDoc.save();
                }
            }

        } catch (err) {
            console.error(`Error checking league ${record}:`, err);
        }
    }
}

async function announceTournament(client, guildID, tournament, leagueName, hypeText = '') {
    try {
        const channelResult = await channelModel.findOne({ guildid: guildID });
        if (!channelResult) return; // No announce channel set

        const announceChannel = client.channels.cache.get(channelResult.channelid);
        if (!announceChannel) return; // Channel not found/bot can't see

        // Get Guild Settings
        const tzResult = await timezoneModel.findOne({ guildid: guildID });
        const cityTimezone = tzResult ? tzResult.timezone : 'America/Los_Angeles';

        const announceMessageResult = await announcemessageModel.findOne({ guildid: guildID });
        let announceText = announceMessageResult ? announceMessageResult.announcemessage : `New tournament in **${leagueName}**:`;

        // Prepend Hype Text if available
        if (hypeText) {
            announceText = `${hypeText}\n\n${announceText}`;
        }

        const pingRoleResult = await pingroleModel.findOne({ guildid: guildID });
        const pingingRole = pingRoleResult ? `<@&${pingRoleResult.role}>` : '';

        // Format Description
        const eventsInfo = tournament.events.map(event => {
            let info = `**${event.name}** - <t:${event.startAt}:F>`;
            if (event.checkInEnabled) {
                const openTime = event.startAt - event.checkInBuffer - event.checkInDuration;
                const closeTime = event.startAt - event.checkInBuffer;
                info += `\nCheck-in: <t:${openTime}:t> - <t:${closeTime}:t>`;
            }
            return info;
        }).join('\n\n');

        const streams = tournament.streams
            .filter(s => s.streamSource === 'TWITCH')
            .map(s => `https://twitch.tv/${s.streamName}`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle(tournament.name)
            .setURL(`https://start.gg/${tournament.url || 'tournament/' + tournament.slug}`)
            .setColor('#FF3399')
            .setDescription(`${announceText}`)
            .addFields(
                { name: '📅 Registration Closes', value: `<t:${tournament.registrationClosesAt}:F> (<t:${tournament.registrationClosesAt}:R>)`, inline: true },
                { name: '📍 Status', value: 'Open', inline: true },
                { name: '🏆 Events', value: eventsInfo }
            )
            .setImage(tournament.images?.find(i => i.type === 'banner')?.url)
            .setFooter({ text: `Powered by NE Network | ${tournament.name}`, iconURL: footerIcon })
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
