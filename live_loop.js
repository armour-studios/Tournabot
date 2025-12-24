const { EmbedBuilder } = require('discord.js');
const { queryAPI, footerIcon } = require('./functions');

// Models
const leagueModel = require('./database/models/league');
const channelModel = require('./database/models/channel');

// Re-use logic
const { generateStandingsEmbed } = require('./commands/standings');

module.exports = async (client) => {
    // Run immediately and then every 3 minutes
    checkLiveEvents(client);
    setInterval(() => checkLiveEvents(client), 180000);
};

// Map to track sent sets to avoid duplicates
// Key: SetID, Value: State (1=Open, 2=Progress, 3=Complete)
const processedSets = new Map();
const announcedStandings = new Set(); // Event IDs

async function checkLiveEvents(client) {
    const leagues = await leagueModel.find({});
    if (leagues.length === 0) return;

    // Filter distinctive slugs
    const uniqueSlugs = [...new Set(leagues.map(l => l.slug))];

    for (const slug of uniqueSlugs) {
        try {
            // Find active tournaments (Started within last 24h or starting in next 1h)
            // Simpler: Just ask for "upcoming: false" and filter by date locally or optimized query
            // Strategy: Get tournaments that are "Active" state? Start.gg API isn't great for that.
            // Better: Get most recent tournament + upcoming. if diff < 24h, check it.

            const now = Math.floor(Date.now() / 1000);
            const rangeStart = now - 86400; // 24h ago
            const rangeEnd = now + 7200; // 2h future

            const query = `query LeagueLive($slug: String, $after: Timestamp, $before: Timestamp) {
                league(slug: $slug) {
                    tournaments(query: { filter: { afterDate: $after, beforeDate: $before }, perPage: 5 }) {
                        nodes {
                            id
                            name
                            slug
                            url
                            state
                            events {
                                id
                                state
                                name
                                slug
                                standings(query: { page: 1, perPage: 8 }) { nodes { placement entrant { name participants { user { images { url } } } } } }
                                sets(
                                  page: 1,
                                  perPage: 20,
                                  sortType: RECENT,
                                  filters: { state: [2, 3] } 
                                ) {
                                  nodes {
                                    id
                                    fullRoundText
                                    state
                                    winnerId
                                    slots {
                                      entrant {
                                        id
                                        name
                                        initialSeedNum
                                        participants {
                                          user {
                                            id
                                            authorizations(types: DISCORD) {
                                              externalId
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                            }
                        }
                    }
                }
            }`;

            const data = await queryAPI(query, { slug, after: rangeStart, before: rangeEnd });

            if (!data || !data.data || !data.data.league) continue;

            const tournaments = data.data.league.tournaments.nodes;

            // Get channels for relevant guilds
            const relevantLeagues = leagues.filter(l => l.slug === slug);

            for (const tournament of tournaments) {
                if (tournament.state === 6) continue; // Pending

                // Process each event
                for (const event of tournament.events) {

                    // 1. Auto-Standings Check
                    if (event.state === 3 && !announcedStandings.has(event.id)) {
                        // Event Complete!
                        for (const leagueDoc of relevantLeagues) {
                            const channels = await channelModel.findOne({ guildid: leagueDoc.guildid });
                            if (channels && channels.standingschannel) {
                                const channel = client.channels.cache.get(channels.standingschannel);
                                if (channel) {
                                    // Reconstruct event object for the generator
                                    const eventForEmbed = {
                                        name: event.name,
                                        tournament: { name: tournament.name, images: [] }, // Images not easily avail here, usage minimal
                                        standings: event.standings
                                    };
                                    // We might need a fresh fetch for full standings images if not in this query
                                    // But let's try to pass what we have contextually

                                    // Actually, let's fetch full standings to be safe and cleaner
                                    // reuse existing command logic manually? No, circular dep risk or complexity.
                                    // Let's just use the data we have or call a helper.
                                    // The generator needs 'event' structure.
                                    // We'll proceed with basic data.

                                    const embed = await generateStandingsEmbed(eventForEmbed, `https://start.gg/${tournament.url}/event/${event.slug}`);
                                    embed.setTitle(`🏆 Event Complete: ${tournament.name}`);
                                    await channel.send({ content: `**${event.name}** has finished!`, embeds: [embed] });
                                }
                            }
                        }
                        announcedStandings.add(event.id);
                    }

                    // 2. Match Feed
                    if (!event.sets || !event.sets.nodes) continue;

                    for (const set of event.sets.nodes) {
                        const setKey = `${event.id}-${set.id}`;
                        const lastState = processedSets.get(setKey);

                        // If state changed or we haven't seen it (and it's recent enough)
                        // If it's state 3 (Completed) and we haven't processed it as 3
                        if (set.state === 3 && lastState !== 3) {

                            // It's a newly finished match (or one we just found)
                            // To avoid spamming old matches on restart, we could check DB or just memory (limitations exist)
                            // For now, memory map avoids duplicates during runtime.

                            const slot1 = set.slots[0];
                            const slot2 = set.slots[1];
                            if (!slot1 || !slot2 || !slot1.entrant || !slot2.entrant) continue;

                            const winner = set.winnerId === slot1.entrant.id ? slot1.entrant : slot2.entrant;
                            const loser = set.winnerId === slot1.entrant.id ? slot2.entrant : slot1.entrant;

                            // Upset Detection
                            const diff = loser.initialSeedNum - winner.initialSeedNum;
                            const isUpset = diff >= 3; // Arbitrary upset threshold

                            // Format Entrant Names (Auto-Link)
                            const p1Name = await formatEntrantName(slot1.entrant);
                            const p2Name = await formatEntrantName(slot2.entrant);

                            const scoreText = `**${winner.name}** def. ${loser.name}`; // Exact score not always in API summary, need detailed query?
                            // 'displayScore' is usually available but we didn't query it.
                            // State 3 implies done.

                            const embed = new EmbedBuilder()
                                .setColor(isUpset ? '#FF0000' : '#36FF7D') // Red for Upset, Green for Result
                                .setTitle(isUpset ? `🔥 UPSET ALERT: ${event.name}` : `✅ Match Result: ${event.name}`)
                                .setDescription(`${set.fullRoundText}\n${p1Name} vs ${p2Name}\n\n**Winner:** ${winner.name}`)
                                .setFooter({ text: tournament.name, iconURL: footerIcon })
                                .setTimestamp();

                            if (isUpset) {
                                embed.addFields({ name: 'Upset Factor', value: `Seed ${winner.initialSeedNum} def. Seed ${loser.initialSeedNum} (+${diff})` });
                            }

                            // Send to all linked guilds
                            for (const leagueDoc of relevantLeagues) {
                                const channels = await channelModel.findOne({ guildid: leagueDoc.guildid });
                                if (channels && channels.matchfeedchannel) {
                                    const channel = client.channels.cache.get(channels.matchfeedchannel);
                                    if (channel) await channel.send({ embeds: [embed] });
                                }
                            }

                            processedSets.set(setKey, 3);
                        }
                        else if (set.state === 2 && lastState !== 2 && lastState !== 3) {
                            // Newly In-Progress
                            const slot1 = set.slots[0];
                            const slot2 = set.slots[1];
                            if (slot1 && slot2 && slot1.entrant && slot2.entrant) {
                                const p1Name = await formatEntrantName(slot1.entrant);
                                const p2Name = await formatEntrantName(slot2.entrant);

                                const embed = new EmbedBuilder()
                                    .setColor('#FFFF00') // Yellow for Live
                                    .setTitle(`🔴 Now Playing: ${event.name}`)
                                    .setDescription(`${set.fullRoundText}\n${p1Name} vs ${p2Name}`)
                                    .setFooter({ text: tournament.name, iconURL: footerIcon })
                                    .setTimestamp();

                                for (const leagueDoc of relevantLeagues) {
                                    const channels = await channelModel.findOne({ guildid: leagueDoc.guildid });
                                    if (channels && channels.matchfeedchannel) {
                                        const channel = client.channels.cache.get(channels.matchfeedchannel);
                                        if (channel) await channel.send({ embeds: [embed] });
                                    }
                                }
                                processedSets.set(setKey, 2);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`Error in Live Loop for ${slug}:`, err);
        }
    }
}

async function formatEntrantName(entrant) {
    if (!entrant) return 'Unknown';
    // Check for Discord Authorization
    // Usually participants array has user
    if (entrant.participants && entrant.participants.length > 0) {
        // Find one with Discord auth
        for (const p of entrant.participants) {
            if (p.user && p.user.authorizations) {
                const discordAuth = p.user.authorizations.find(a => a.externalId); // Type is implicitly checked by query filter 'types: DISCORD'? 
                // Wait, query needs to be precise. Start.gg API returns all auths if not filtered correctly sometimes.
                // Our query was `authorizations(types: DISCORD) { externalId }`. So checking externalId is enough.
                if (discordAuth && discordAuth.externalId) {
                    return `<@${discordAuth.externalId}> (${entrant.name})`;
                }
            }
        }
    }
    return `**${entrant.name}**`;
}
