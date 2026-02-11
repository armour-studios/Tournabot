const { EmbedBuilder } = require('discord.js');
const { queryAPI, footerIcon } = require('./functions');

// Models
const leagueModel = require('./database/models/league');
const channelModel = require('./database/models/channel');
const upsetTrackerModel = require('./database/models/upset_tracker');
const processedSetModel = require('./database/models/processed_set');
const liveDashboardModel = require('./database/models/live_dashboard');

// Re-use logic
const { generateStandingsEmbed } = require('./commands/standings');
const fs = require('fs');

function logToFile(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync('logs_live.txt', `[${timestamp}] ${message}\n`);
}

// Concurrency mutex
let isProcessing = false;

module.exports = async (client) => {
    // Load already processed sets into memory to avoid duplicates on startup
    const earlierSets = await processedSetModel.find({});
    for (const s of earlierSets) {
        processedSets.set(s.setKey, s.state);
    }
    console.log(`[Live Loop] Initialized with ${processedSets.size} processed sets.`);

    // Run immediately and then every minute
    checkLiveEvents(client);
    setInterval(() => checkLiveEvents(client), 60000);
};

// Map to track sent sets to avoid duplicates
// Key: SetID, Value: State (1=Open, 2=Progress, 3=Complete)
const processedSets = new Map();
const announcedStandings = new Set(); // Event IDs

async function checkLiveEvents(client) {
    if (isProcessing) {
        console.log('[Live Loop] Skip: Previous loop still running.');
        return;
    }

    const leagues = await leagueModel.find({});
    if (leagues.length === 0) return;

    isProcessing = true;

    try {
        // Step 1: Deduplicate slugs to avoid redundant API hits and processing
        const uniqueSlugs = [];
        const seen = new Set();
        for (const l of leagues) {
            const key = `${l.slug}||${l.type || ''}`;
            if (!seen.has(key)) {
                uniqueSlugs.push({ slug: l.slug, type: l.type });
                seen.add(key);
            }
        }

        console.log(`[Live Loop] Processing ${leagues.length} guild links. Unique slug/type pairs: ${uniqueSlugs.length}`);
        leagues.forEach(l => {
            console.log(`[Live Loop] League Record: guild=${l.guildid}, slug='${l.slug}', type='${l.type}'`);
        });

        for (const record of uniqueSlugs) {
            try {
                const { slug, type } = record;
                console.log(`[Live Loop] Processing record: slug='${slug}', type='${type}'`);
                const now = Math.floor(Date.now() / 1000);
                const rangeStart = now - 86400; // 24h ago
                const rangeEnd = now + 7200; // 2h future

                let tournaments = [];

                if (type === 'event') {
                    // Granular Event Mode
                    const eventOverviewQuery = `query EventOverview($slug: String!) {
                        event(slug: $slug) {
                            id state name slug
                            tournament { id name slug url state images { url type } }
                        }
                    }`;
                    const data = await queryAPI(eventOverviewQuery, { slug });
                    if (data?.data?.event) {
                        const event = data.data.event;
                        tournaments = [{
                            ...event.tournament,
                            events: [event]
                        }];
                    }
                } else if (type === 'tournament' || !type) {
                    // Standalone Tournament Mode
                    const tournamentOverviewQuery = `query TournamentOverview($slug: String) {
                        tournament(slug: $slug) {
                            id name slug url state images { url type }
                            events { id state name slug }
                        }
                    }`;
                    const data = await queryAPI(tournamentOverviewQuery, { slug });
                    if (data?.data?.tournament) tournaments = [data.data.tournament];
                } else {
                    // League Mode
                    const leagueOverviewQuery = `query LeagueOverview($slug: String) {
                        league(slug: $slug) {
                            id name
                            events(query: { perPage: 15 }) {
                                nodes {
                                    id state name slug startAt
                                    tournament { id name slug url state images { url type } }
                                }
                            }
                        }
                    }`;
                    const data = await queryAPI(leagueOverviewQuery, { slug });
                    if (data?.data?.league?.events?.nodes) {
                        // Filter by date in Javascript to avoid schema errors
                        const tMap = new Map();
                        for (const e of data.data.league.events.nodes) {
                            if (e.startAt >= rangeStart && e.startAt <= rangeEnd) {
                                if (!tMap.has(e.tournament.id)) {
                                    tMap.set(e.tournament.id, { ...e.tournament, events: [] });
                                }
                                tMap.get(e.tournament.id).events.push(e);
                            }
                        }
                        tournaments = Array.from(tMap.values());
                    }
                }

                if (tournaments.length === 0) continue;

                // Group relevant guilds for this slug
                const relevantLeagues = leagues.filter(l => {
                    const match = l.slug === slug && (l.type === type || (!l.type && !type));
                    if (!match && l.slug === slug) {
                        console.log(`[Live Loop] Mismatch for ${l.slug}: l.type='${l.type}', loop.type='${type}'`);
                    }
                    return match;
                });

                for (const tournament of tournaments) {
                    if (tournament.state === 6) {
                        logToFile(`Skipping pending tournament: ${tournament.name}`);
                        continue;
                    }

                    const tImage = tournament.images?.find(i => i.type === 'profile')?.url || null;
                    console.log(`[Live Loop] Processing tournament: ${tournament.name} with ${tournament.events?.length} events.`);

                    for (const event of tournament.events) {
                        console.log(`[Live Loop] Checking event: ${event.name} (ID: ${event.id}, State: ${event.state})`);

                        // STAGE 1: VERY THIN SCAN (Complexity ~100)
                        const thinSetsQuery = `query EventThinSets($id: ID) {
                            event(id: $id) {
                                id state
                                sets(page: 1, perPage: 100, sortType: RECENT, filters: { state: [1, 2, 3] }) {
                                    nodes {
                                        id state fullRoundText displayScore winnerId
                                        slots { entrant { id name initialSeedNum } }
                                        stream { streamName streamSource }
                                    }
                                }
                            }
                        }`;
                        const setsRes = await queryAPI(thinSetsQuery, { id: event.id });
                        if (!setsRes?.data?.event) continue;

                        const setsNodes = setsRes.data.event.sets.nodes || [];
                        console.log(`[Live Loop] Found ${setsNodes.length} sets for event ${event.id}`);

                        const currentNowPlaying = [];
                        for (const set of setsNodes) {
                            console.log(`[Live Loop] Set ${set.id}: state=${set.state}, round=${set.fullRoundText}`);
                            const setKey = `${event.id}-${set.id}`;
                            const lastState = processedSets.get(setKey);

                            const slot1 = set.slots[0];
                            const slot2 = set.slots[1];
                            if (!slot1 || !slot2 || !slot1.entrant || !slot2.entrant) continue;

                            // For dashboard names (no Discord needed yet)
                            if (set.state === 1 || set.state === 2) {
                                const isStreamed = set.stream && set.stream.streamSource === 'TWITCH';
                                const score = set.displayScore && set.displayScore !== '0 - 0' ? ` (${set.displayScore})` : '';
                                currentNowPlaying.push(`${isStreamed ? '🎥 ' : ''}${set.fullRoundText}: ${slot1.entrant.name} vs ${slot2.entrant.name}${score}`);
                            }

                            // STAGE 2: PROCESS UPDATES & ALERTS
                            const currentScore = set.displayScore && set.displayScore !== '0 - 0' ? ` (${set.displayScore})` : '';
                            const thinSummary = set.state === 3
                                ? `✅ **${slot1.entrant.name}** def. **${slot2.entrant.name}** (${set.fullRoundText})`
                                : `🔴 **${slot1.entrant.name}** vs **${slot2.entrant.name}**${currentScore} (${set.fullRoundText})`;

                            let processedSet = await processedSetModel.findOne({ setKey });
                            const lastSummary = processedSet?.summary;

                            const isNewResult = set.state === 3 && lastState !== 3;
                            const isSummaryChange = set.state === 2 && thinSummary !== lastSummary;
                            const isMissingFromAnyGuild = relevantLeagues.some(l => !processedSet?.guildMessages.some(m => m.guildId === l.guildid));

                            if (isNewResult || isSummaryChange || isMissingFromAnyGuild) {
                                console.log(`[Live Loop] Processing matchfeed: ${set.fullRoundText} (${set.id}). NewResult:${isNewResult}, SumChange:${isSummaryChange}, MissingGuilds:${isMissingFromAnyGuild}`);

                                const setDeepQuery = `query SetDeep($id: ID) {
                                    set(id: $id) {
                                        slots {
                                            entrant {
                                                participants { user { id authorizations(types: DISCORD) { externalId } } }
                                            }
                                        }
                                    }
                                }`;
                                const deepSetRes = await queryAPI(setDeepQuery, { id: set.id });
                                const deepSet = deepSetRes?.data?.set;

                                // Helper names with Discord if available from deep fetch
                                const getDeepName = async (slotIdx) => {
                                    const entrant = set.slots[slotIdx].entrant;
                                    const seedText = entrant.initialSeedNum ? ` (${entrant.initialSeedNum})` : '';
                                    const deepEntrant = deepSet?.slots[slotIdx]?.entrant;
                                    if (deepEntrant?.participants) {
                                        for (const p of deepEntrant.participants) {
                                            const discordAuth = p.user?.authorizations?.find(a => a.externalId);
                                            if (discordAuth) return `<@${discordAuth.externalId}> (${entrant.name}${seedText})`;
                                        }
                                    }
                                    return `**${entrant.name}${seedText}**`;
                                };

                                const p1DeepName = await getDeepName(0);
                                const p2DeepName = await getDeepName(1);

                                if (!processedSet) {
                                    processedSet = new processedSetModel({
                                        setKey,
                                        eventId: Number(event.id),
                                        state: set.state,
                                        summary: thinSummary,
                                        guildMessages: []
                                    });
                                } else {
                                    processedSet.state = set.state;
                                    processedSet.summary = thinSummary;
                                }

                                const winner = set.state === 3 ? (set.winnerId === slot1.entrant.id ? slot1.entrant : slot2.entrant) : null;
                                const loser = set.state === 3 ? (set.winnerId === slot1.entrant.id ? slot2.entrant : slot1.entrant) : null;
                                const diff = winner && loser ? loser.initialSeedNum - winner.initialSeedNum : 0;
                                const isUpset = diff >= 3;
                                const isStreamed = set.state === 2 && set.stream && set.stream.streamSource === 'TWITCH';
                                const streamUrl = isStreamed ? `https://twitch.tv/${set.stream.streamName}` : null;

                                const embed = new EmbedBuilder()
                                    .setFooter({ text: `Powered by NE Network | ${tournament.name}`, iconURL: footerIcon })
                                    .setTimestamp();

                                if (tImage) embed.setThumbnail(tImage);

                                if (set.state === 3) {
                                    embed.setColor(isUpset ? '#FF3399' : '#36FF7D')
                                        .setTitle(isUpset ? `🔥 UPSET ALERT: ${event.name}` : `✅ Match Result: ${event.name}`)
                                        .setDescription(`${set.fullRoundText}\n${p1DeepName} vs ${p2DeepName}\n\n**Winner:** ${winner.name}`);
                                    if (isUpset) embed.addFields({ name: 'Upset Factor', value: `Seed ${winner.initialSeedNum} def. Seed ${loser.initialSeedNum} (+${diff})` });
                                } else {
                                    embed.setColor(isStreamed ? '#6441a5' : '#FFFF00')
                                        .setTitle(isStreamed ? `📺 Now Streaming: ${event.name}` : `🔴 Now Playing: ${event.name}`)
                                        .setDescription(`${set.fullRoundText}\n${p1DeepName} vs ${p2DeepName}${isStreamed ? `\n\n**Watch Live:** [${set.stream.streamName}](${streamUrl})` : ''}`);
                                }

                                for (const leagueDoc of relevantLeagues) {
                                    try {
                                        const channels = await channelModel.findOne({ guildid: leagueDoc.guildid });
                                        const targetChannelId = set.state === 3 && isUpset ? (channels?.upsetchannel || channels?.matchfeedchannel) : channels?.matchfeedchannel;

                                        if (targetChannelId) {
                                            console.log(`[Live Loop] Target channel for guild ${leagueDoc.guildid} is ${targetChannelId}`);
                                            let channel = client.channels.cache.get(targetChannelId);
                                            if (!channel) {
                                                try {
                                                    channel = await client.channels.fetch(targetChannelId);
                                                    console.log(`[Live Loop] Fetched channel ${targetChannelId} from API.`);
                                                } catch (e) {
                                                    console.error(`[Live Loop] Could not fetch channel ${targetChannelId}: ${e.message}`);
                                                }
                                            }

                                            if (channel) {
                                                console.log(`[Live Loop] Target channel for guild ${leagueDoc.guildid} is ${targetChannelId}`);
                                                let guildMsg = processedSet.guildMessages.find(m => m.guildId === leagueDoc.guildid);

                                                if (set.state === 3) {
                                                    // For COMPLETED matches, we always want a fresh message at the bottom of the feed
                                                    // EXCEPT if we just posted it in this very process run (to avoid duplicates)
                                                    // Actually, if guildMsg exists and it's already state 3, we might have posted it already.
                                                    const alreadyPostedResult = guildMsg && processedSet.state === 3;

                                                    if (!alreadyPostedResult) {
                                                        // If there was an old "Now Playing" message, we can try to delete it to keep feed clean.
                                                        if (guildMsg && guildMsg.messageId) {
                                                            try {
                                                                const oldMsg = await channel.messages.fetch(guildMsg.messageId);
                                                                if (oldMsg) await oldMsg.delete();
                                                            } catch (e) { }
                                                        }

                                                        const sent = await channel.send({ embeds: [embed] });
                                                        if (guildMsg) {
                                                            guildMsg.messageId = sent.id;
                                                            guildMsg.channelId = targetChannelId;
                                                        } else {
                                                            processedSet.guildMessages.push({
                                                                guildId: leagueDoc.guildid,
                                                                channelId: targetChannelId,
                                                                messageId: sent.id
                                                            });
                                                        }
                                                        console.log(`[Live Loop] Posted final result for ${set.id} to guild ${leagueDoc.guildid}`);
                                                    }
                                                } else {
                                                    // For IN_PROGRESS matches, we edit the existing message to reduce spam
                                                    if (guildMsg && guildMsg.messageId) {
                                                        try {
                                                            const oldMsg = await channel.messages.fetch(guildMsg.messageId);
                                                            if (oldMsg) {
                                                                await oldMsg.edit({ embeds: [embed] });
                                                                console.log(`[Live Loop] Edited 'Now Playing' for ${set.id} in guild ${leagueDoc.guildid}`);
                                                            } else {
                                                                const sent = await channel.send({ embeds: [embed] });
                                                                guildMsg.messageId = sent.id;
                                                                guildMsg.channelId = targetChannelId;
                                                            }
                                                        } catch (e) {
                                                            const sent = await channel.send({ embeds: [embed] });
                                                            guildMsg.messageId = sent.id;
                                                            guildMsg.channelId = targetChannelId;
                                                        }
                                                    } else {
                                                        const sent = await channel.send({ embeds: [embed] });
                                                        processedSet.guildMessages.push({
                                                            guildId: leagueDoc.guildid,
                                                            channelId: targetChannelId,
                                                            messageId: sent.id
                                                        });
                                                    }
                                                }
                                            } else {
                                                console.error(`[Live Loop] Channel ${targetChannelId} could not be resolved for guild ${leagueDoc.guildid}`);
                                            }
                                        } else {
                                            console.log(`[Live Loop] Skip: No matchfeed/upset channel configured for guild ${leagueDoc.guildid}`);
                                        }

                                        if (set.state === 3 && isUpset) {
                                            await updateUpsetTracker(client, leagueDoc.guildid, event, {
                                                setId: set.id,
                                                round: set.fullRoundText,
                                                winnerName: winner.name,
                                                winnerSeed: winner.initialSeedNum,
                                                loserName: loser.name,
                                                loserSeed: loser.initialSeedNum,
                                                diff: diff
                                            }, tImage);
                                        }
                                    } catch (err) {
                                        console.error(`[Live Loop] Failed match feed update for ${leagueDoc.guildid}:`, err);
                                    }
                                }

                                processedSets.set(setKey, set.state);
                                await processedSet.save();
                            }
                        }

                        // STAGE 3: STANDINGS CHECK (Only if not already announced)
                        // STAGE 3: STANDINGS CHECK (Persistent)
                        const isCompleted = event.state === 3 || event.state === 'COMPLETED';
                        const completionKey = `EVENT_COMPLETE_${event.id}`;

                        if (isCompleted && !processedSets.has(completionKey)) {
                            // First check DB to be sure (in case of restart)
                            let completionRecord = await processedSetModel.findOne({ setKey: completionKey });

                            if (!completionRecord) {
                                const standingsQuery = `query EventStandings($id: ID) {
                                    event(id: $id) {
                                        id
                                        standings(query: { page: 1, perPage: 8 }) { nodes { placement entrant { name participants { user { images { url } } } } } }
                                    }
                                }`;
                                const standingsRes = await queryAPI(standingsQuery, { id: event.id });
                                const standings = standingsRes?.data?.event?.standings;

                                if (standings?.nodes?.length > 0) {
                                    const guildMessages = [];

                                    for (const leagueDoc of relevantLeagues) {
                                        const channels = await channelModel.findOne({ guildid: leagueDoc.guildid });
                                        if (channels?.standingschannel) {
                                            const channel = client.channels.cache.get(channels.standingschannel);
                                            if (channel) {
                                                const eventForEmbed = { event: { name: event.name, tournament: { name: tournament.name, images: tournament.images || [] }, standings } };
                                                const embed = await generateStandingsEmbed(eventForEmbed, `https://start.gg/${tournament.url}/event/${event.slug}`);
                                                embed.setTitle(`🏆 Event Complete: ${tournament.name}`);
                                                if (tImage) embed.setThumbnail(tImage);

                                                try {
                                                    const sent = await channel.send({ content: `**${event.name}** has finished!`, embeds: [embed] });
                                                    guildMessages.push({
                                                        guildId: leagueDoc.guildid,
                                                        channelId: channel.id,
                                                        messageId: sent.id
                                                    });
                                                } catch (e) {
                                                    console.error(`[Live Loop] Failed to send standings to ${leagueDoc.guildid}:`, e);
                                                }
                                            }
                                        }
                                    }

                                    // Save completion record
                                    completionRecord = new processedSetModel({
                                        setKey: completionKey,
                                        eventId: Number(event.id),
                                        state: 3,
                                        summary: 'Event Complete',
                                        guildMessages
                                    });
                                    await completionRecord.save();
                                    processedSets.set(completionKey, 3);
                                    console.log(`[Live Loop] Announced completion for event ${event.id}`);
                                }
                            } else {
                                // Already recorded in DB, update memory
                                processedSets.set(completionKey, 3);
                            }
                        }

                        // 3. Update Tournament Overview (ONLY for Active Events)
                        const isActive = event.state === 2 || event.state === 'ACTIVE';
                        if (isActive) {
                            console.log(`[Live Loop] Updating overview. currentNowPlaying has ${currentNowPlaying.length} items: ${JSON.stringify(currentNowPlaying)}`);
                            for (const leagueDoc of relevantLeagues) {
                                await updateTournamentOverview(client, leagueDoc.guildid, event, currentNowPlaying, tImage);
                            }
                        } else {
                            // Cleanup dashboard for now-inactive events
                            for (const leagueDoc of relevantLeagues) {
                                const dashRecord = await liveDashboardModel.findOne({ guildId: leagueDoc.guildid, eventId: Number(event.id) });
                                if (dashRecord?.dashboardMessageId) {
                                    try {
                                        const channels = await channelModel.findOne({ guildid: leagueDoc.guildid });
                                        const channel = client.channels.cache.get(channels?.matchfeedchannel);
                                        if (channel) {
                                            const oldMsg = await channel.messages.fetch(dashRecord.dashboardMessageId);
                                            if (oldMsg) await oldMsg.delete();
                                        }
                                        await liveDashboardModel.deleteOne({ _id: dashRecord._id });
                                    } catch (e) { /* Silently fails if already deleted */ }
                                }
                            }
                        }
                    } // End for event
                } // End for tournament
            } catch (err) {
                console.error(`Error in Live Loop for ${record.slug}:`, err);
            }
        } // End for unique slug
    } finally {
        isProcessing = false;
        console.log('[Live Loop] Cycle complete.');
    }
}

async function formatEntrantName(entrant) {
    if (!entrant) return 'Unknown';
    if (entrant.participants && entrant.participants.length > 0) {
        for (const p of entrant.participants) {
            if (p.user && p.user.authorizations) {
                const discordAuth = p.user.authorizations.find(a => a.externalId);
                if (discordAuth && discordAuth.externalId) {
                    return `<@${discordAuth.externalId}> (${entrant.name})`;
                }
            }
        }
    }
    return `**${entrant.name}**`;
}

async function updateUpsetTracker(client, guildId, event, newUpset, tImage) {
    try {
        let tracker = await upsetTrackerModel.findOne({ guildId, eventId: event.id });
        if (!tracker) {
            tracker = new upsetTrackerModel({
                guildId,
                eventId: Number(event.id),
                upsets: []
            });
        }

        if (tracker.upsets.some(u => u.setId === newUpset.setId)) return;

        tracker.upsets.push(newUpset);
        tracker.upsets.sort((a, b) => b.diff - a.diff);
        tracker.upsets = tracker.upsets.slice(0, 10);
        tracker.lastUpdated = new Date();

        await tracker.save();
        console.log(`[Live Loop] Upset data saved for event ${event.id}`);
    } catch (err) {
        console.error('Error updating Upset Tracker data:', err);
    }
}

async function updateTournamentOverview(client, guildId, event, currentNowPlaying, tImage) {
    try {
        const channels = await channelModel.findOne({ guildid: guildId });
        const targetChannelId = channels?.matchfeedchannel;
        if (!targetChannelId) return;

        let channel = client.channels.cache.get(targetChannelId);
        if (!channel) {
            try {
                channel = await client.channels.fetch(targetChannelId);
            } catch (e) {
                console.error(`[Overview] Could not fetch channel ${targetChannelId}: ${e.message}`);
                return;
            }
        }
        if (!channel) return;

        // 1. Fetch Top Upsets (Limit 5)
        const tracker = await upsetTrackerModel.findOne({ guildId, eventId: event.id });
        const upsetsText = tracker?.upsets?.slice(0, 5).map(u => `🔥 (+${u.diff}) **${u.winnerName}** def. ${u.loserName}`).join('\n') || 'None yet!';

        // 2. Fetch Recent Results (Last 5)
        const recentResults = await processedSetModel.find({ eventId: Number(event.id), state: 3 }).sort({ timestamp: -1 }).limit(5);
        const resultsText = recentResults.map(r => r.summary).join('\n') || 'No results yet.';

        // 3. Fetch Callable Sets from API (sets ready to play, both players assigned, no winner)
        let playingText = 'No active matches.';
        try {
            const callableQuery = `query EventCallable($id: ID) {
                event(id: $id) {
                    sets(page: 1, perPage: 10, sortType: CALL_ORDER, filters: { hideEmpty: true }) {
                        nodes {
                            id fullRoundText displayScore winnerId state
                            slots { entrant { name } }
                            stream { streamName streamSource }
                        }
                    }
                }
            }`;
            const callableRes = await queryAPI(callableQuery, { id: event.id });
            const callableSets = callableRes?.data?.event?.sets?.nodes || [];

            // Filter for sets that are callable (both players assigned, no winner yet)
            const activeSets = callableSets.filter(s =>
                !s.winnerId &&
                s.slots[0]?.entrant &&
                s.slots[1]?.entrant
            ).slice(0, 5);

            if (activeSets.length > 0) {
                playingText = activeSets.map(s => {
                    const isStreamed = s.stream && s.stream.streamSource === 'TWITCH';
                    const score = s.displayScore && s.displayScore !== '0 - 0' ? ` (${s.displayScore})` : '';
                    return `${isStreamed ? '🎥 ' : ''}${s.fullRoundText}: ${s.slots[0].entrant.name} vs ${s.slots[1].entrant.name}${score}`;
                }).join('\n');
            }
        } catch (e) {
            console.error('[Overview] Error fetching callable sets:', e.message);
        }

        const embed = new EmbedBuilder()
            .setColor('#FFEE58')
            .setTitle(`📊 TOURNAMENT OVERVIEW: ${event.name}`)
            .setDescription(`Real-time overview of the event. Pinned to bottom of feed.`)
            .addFields(
                { name: '📺 Live Matches', value: playingText },
                { name: '✅ Recent Results', value: resultsText },
                { name: '🔥 Top Upsets', value: upsetsText }
            )
            .setFooter({ text: 'Powered by NE Network | Updates automatically', iconURL: footerIcon })
            .setTimestamp();

        if (tImage) embed.setThumbnail(tImage);

        let dashRecord = await liveDashboardModel.findOne({ guildId, eventId: Number(event.id) });
        if (!dashRecord) {
            dashRecord = new liveDashboardModel({ guildId, eventId: Number(event.id), channelId: targetChannelId });
        }

        // 4. Check if content changed to avoid unnecessary re-sends
        const combinedContent = playingText + resultsText + upsetsText;
        if (dashRecord.lastContent === combinedContent && dashRecord.dashboardMessageId) {
            // Content hasn't changed, skip update (or just edit if you want to keep it fresh)
            // For now, let's just edit it to update the timestamp without re-sending
            try {
                const oldMsg = await channel.messages.fetch(dashRecord.dashboardMessageId);
                if (oldMsg) {
                    await oldMsg.edit({ embeds: [embed] });
                    dashRecord.lastUpdate = new Date();
                    await dashRecord.save();
                    console.log(`[Live Loop] Tournament Overview EDITED (content same) for event ${event.id}`);
                    return;
                }
            } catch (e) { /* Fall through to re-send if fetch fails */ }
        }

        // Delete old one to stay pinned at bottom
        if (dashRecord.dashboardMessageId) {
            try {
                const oldMsg = await channel.messages.fetch(dashRecord.dashboardMessageId);
                if (oldMsg) await oldMsg.delete();
            } catch (e) { /* Silently fails */ }
        }

        const newMsg = await channel.send({ embeds: [embed] });
        dashRecord.dashboardMessageId = newMsg.id;
        dashRecord.lastUpdate = new Date();
        dashRecord.lastContent = combinedContent;
        await dashRecord.save();
        console.log(`[Live Loop] Tournament Overview RE-SENT (content changed) for event ${event.id}`);
    } catch (err) {
        console.error('Error updating Tournament Overview:', err);
    }
}
