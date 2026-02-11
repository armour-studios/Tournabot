const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { queryAPI, footerIcon, extractSlug, fetchEntity, convertEpoch } = require('../functions');
const upsetTrackerModel = require('../database/models/upset_tracker');

module.exports = {
    name: 'event',
    description: 'View information about an event or tournament',
    async autocomplete(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'search') {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const games = [
                { name: 'Super Smash Bros. Ultimate', value: 'ultimate' },
                { name: 'Super Smash Bros. Melee', value: 'melee' },
                { name: 'Tekken 8', value: 'tekken8' },
                { name: 'Street Fighter 6', value: 'sf6' },
                { name: 'Rocket League', value: 'rl' },
                { name: 'Valorant', value: 'valorant' }
            ];

            const filtered = games.filter(game =>
                game.name.toLowerCase().includes(focusedValue) ||
                game.value.includes(focusedValue)
            );

            await interaction.respond(filtered.slice(0, 25));
        }
    },
    async executeSlash(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'entrants') {
            await handleEntrants(interaction);
        } else if (subcommand === 'streams') {
            await handleStreams(interaction);
        } else if (subcommand === 'upsets') {
            await handleUpsets(interaction);
        } else if (subcommand === 'bracket') {
            await handleBracket(interaction);
        } else if (subcommand === 'upcoming') {
            await handleUpcoming(interaction);
        } else if (subcommand === 'search') {
            await handleSearch(interaction);
        }
    }
};

// --- Subcommand Handlers ---

async function handleEntrants(interaction) {
    const url = interaction.options.getString('url');
    if (!url) return interaction.reply({ content: 'Please provide an event URL.', ephemeral: true });

    await interaction.deferReply();

    const slug = extractSlug(url);
    if (!slug) return interaction.editReply('Invalid event/league URL.');

    try {
        const entity = await fetchEntity(slug);
        if (!entity) return interaction.editReply('Could not find event or league.');

        let targetEvent = null;
        let eventSlug = null;
        if (url.includes('/event/')) {
            eventSlug = url.split('/event/')[1].split('/')[0];
            targetEvent = entity.events.find(e => extractSlug(e.name) === eventSlug || e.name.toLowerCase().includes(eventSlug.toLowerCase()));
        } else if (entity.events && entity.events.length > 0) {
            targetEvent = entity.events[0];
            eventSlug = extractSlug(targetEvent.name) || targetEvent.name.toLowerCase().replace(/\s+/g, '-');
        }

        const query = `query EventEntrants($slug: String!) {
            event(slug: $slug) {
                name
                tournament { name }
                entrants(query: { perPage: 20, page: 1 }) {
                    nodes {
                        name
                        initialSeedNum
                    }
                }
            }
        }`;

        const querySlug = url.includes('/event/') ? slug + '/event/' + eventSlug : slug + '/event/' + (targetEvent?.slug || eventSlug);
        const data = await queryAPI(query, { slug: querySlug });

        if (!data || !data.data || !data.data.event) {
            // Fallback: try just the tournament slug if event lookup failed
            return interaction.editReply('Could not find event. Please ensure you are using a specific event URL.');
        }

        const event = data.data.event;
        const entrants = event.entrants.nodes;

        const embed = new EmbedBuilder()
            .setAuthor({ name: '👥 Entrants List', iconURL: footerIcon })
            .setTitle(event.tournament.name)
            .setDescription(`**Event:** ${event.name}`)
            .setColor('#FF3399')
            .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon })
            .setTimestamp();

        if (entrants.length === 0) {
            embed.addFields({ name: 'Status', value: 'No entrants registered yet.' });
        } else {
            const entrantList = entrants.map(e => `**#${e.initialSeedNum}** ${e.name}`).join('\n');
            embed.addFields({ name: 'Top Seeds', value: entrantList });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching entrants.');
    }
}

async function handleStreams(interaction) {
    const url = interaction.options.getString('url');
    if (!url) return interaction.reply({ content: 'Please provide a tournament or league URL.', ephemeral: true });

    await interaction.deferReply();

    let slug = extractSlug(url); // Use robust extractor
    if (!slug) return interaction.editReply('Invalid URL.');

    // Determine if league or tournament based on slug parts (usually type/slug)
    const isLeague = slug.startsWith('league/');
    const coreSlug = slug.split('/')[1] || slug; // simplified

    try {
        const query = isLeague ? `
            query LeagueStreams($slug: String!) {
                league(slug: $slug) {
                    name
                    tournaments(query: { filter: { upcoming: true, past: false }, perPage: 5 }) {
                        nodes {
                            name
                            streams { streamName streamSource }
                        }
                    }
                }
            }
        ` : `
            query TournamentStreams($slug: String!) {
                tournament(slug: $slug) {
                    name
                    streams { streamName streamSource }
                }
            }
        `;

        const data = await queryAPI(query, { slug: coreSlug });
        const entity = isLeague ? data?.data?.league : data?.data?.tournament;

        if (!entity) return interaction.editReply('Could not find data for that URL.');

        const embed = new EmbedBuilder()
            .setAuthor({ name: '📺 Stream Aggregator', iconURL: footerIcon })
            .setTitle(entity.name)
            .setColor('#6441a5') // Twitch Purple
            .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon })
            .setTimestamp();

        let streams = [];
        if (isLeague) {
            entity.tournaments.nodes.forEach(t => {
                t.streams?.filter(s => s.streamSource === 'TWITCH').forEach(s => {
                    streams.push(`[${s.streamName}](https://twitch.tv/${s.streamName}) (via ${t.name})`);
                });
            });
        } else {
            entity.streams?.filter(s => s.streamSource === 'TWITCH').forEach(s => {
                streams.push(`[${s.streamName}](https://twitch.tv/${s.streamName})`);
            });
        }

        if (streams.length === 0) {
            embed.setDescription('No active streams found.');
        } else {
            embed.setDescription(streams.join('\n'));
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching streams.');
    }
}

async function handleUpsets(interaction) {
    const url = interaction.options.getString('url');
    if (!url) return interaction.reply({ content: 'Please provide a tournament or event URL.', ephemeral: true });

    let slug = extractSlug(url);
    if (!slug) return interaction.reply({ content: 'Invalid URL.', ephemeral: true });

    await interaction.deferReply();

    try {
        // Find event ID first
        const eventQuery = `
        query FindEvent($slug: String!) {
          event(slug: $slug) {
            id
            name
            tournament { name }
          }
        }`;

        const data = await queryAPI(eventQuery, { slug });
        if (!data?.data?.event) {
            return interaction.editReply('Could not find event. Make sure you provide a full event URL.');
        }

        const event = data.data.event;
        const tracker = await upsetTrackerModel.findOne({ eventId: event.id });

        if (!tracker || tracker.upsets.length === 0) {
            return interaction.editReply(`No major upsets recorded yet for **${event.name}**.`);
        }

        const embed = new EmbedBuilder()
            .setColor('#FF3399')
            .setTitle(`🔥 Top Upsets: ${event.name}`)
            .setAuthor({ name: event.tournament.name, iconURL: footerIcon })
            .setDescription(`The biggest upsets recorded by NE Network.`)
            .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon })
            .setTimestamp();

        let upsetList = tracker.upsets.map((u, i) => {
            return `**${i + 1}.** (+${u.diff}) **${u.winnerName}** (Seed ${u.winnerSeed}) def. ${u.loserName} (Seed ${u.loserSeed})\n*${u.round}*`;
        }).join('\n\n');

        embed.addFields({ name: 'Leaderboard', value: upsetList });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        await interaction.editReply('There was an error processing your request.');
    }
}

async function handleBracket(interaction) {
    // Basic visualization link for now, since visualizer is complex
    const url = interaction.options.getString('url');
    const slug = extractSlug(url);

    if (!slug) return interaction.reply({ content: 'Invalid URL.', ephemeral: true });

    await interaction.deferReply();

    try {
        const query = `query BracketLink($slug: String!) {
            event(slug: $slug) {
                id name slug
                tournament { name url }
            }
        }`;

        const data = await queryAPI(query, { slug });
        const event = data?.data?.event;

        if (!event) return interaction.editReply('Could not find event.');

        const embed = new EmbedBuilder()
            .setTitle(`Bracket: ${event.name}`)
            .setURL(`https://start.gg/${event.slug}/brackets`)
            .setDescription(`Click the title to view the full bracket on Start.gg for **${event.tournament.name}**.`)
            .setColor('#FF3399')
            .setFooter({ text: 'Visual brackets coming soon!', iconURL: footerIcon });

        await interaction.editReply({ embeds: [embed] });

    } catch (err) {
        console.error(err);
        await interaction.editReply('Error fetching bracket info.');
    }
}

async function handleUpcoming(interaction) {
    let url = interaction.options.getString('url');
    const slug = extractSlug(url);
    if (!slug) return interaction.reply({ content: 'Invalid URL.', ephemeral: true });

    const query = `
        query EventSets($slug: String!) {
          event(slug: $slug) {
            name
            tournament {
              name
            }
            sets(
              page: 1,
              perPage: 10,
              sortType: CALL_ORDER,
              filters: {
                state: [1, 2]
              }
            ) {
              nodes {
                fullRoundText
                slots {
                  entrant {
                    name
                  }
                }
              }
            }
          }
        }`;

    await interaction.deferReply();

    try {
        const data = await queryAPI(query, { slug });
        if (!data || !data.data || !data.data.event) {
            return interaction.editReply('Could not find event or upcoming sets.');
        }

        const event = data.data.event;
        const sets = event.sets.nodes;

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Upcoming Sets', iconURL: footerIcon })
            .setTitle(`${event.tournament.name} - ${event.name}`)
            .setColor('#FF3636')
            .setURL(`https://start.gg/${slug}`);

        if (sets.length === 0) {
            embed.setDescription('No upcoming or in-progress sets found.');
        } else {
            let description = '';
            sets.forEach(s => {
                const entrants = s.slots.map(sl => sl.entrant ? sl.entrant.name : 'TBD').join(' vs ');
                description += `**${s.fullRoundText}:** ${entrants}\n`;
            });
            embed.setDescription(description);
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error(error);
        await interaction.editReply('There was an error fetching upcoming sets.');
    }
}

async function handleSearch(interaction) {
    const gameNameInput = interaction.options.getString('game');
    let videogameId;
    let gameDisplayName;

    if (!gameNameInput) return interaction.reply('Please specify a game to search for.');

    const lowerInput = gameNameInput.toLowerCase();
    if (lowerInput.includes('ultimate') || lowerInput.includes('smash bros')) {
        videogameId = 1386;
        gameDisplayName = 'Super Smash Bros. Ultimate';
    } else if (lowerInput.includes('melee')) {
        videogameId = 1;
        gameDisplayName = 'Super Smash Bros. Melee';
    } else if (lowerInput.includes('tekken') || lowerInput.includes('t8')) {
        videogameId = 49783;
        gameDisplayName = 'Tekken 8';
    } else if (lowerInput.includes('sf6') || lowerInput.includes('street fighter')) {
        videogameId = 43868;
        gameDisplayName = 'Street Fighter 6';
    } else if (lowerInput.includes('rocket league') || lowerInput.includes('rl')) {
        videogameId = 14;
        gameDisplayName = 'Rocket League';
    } else if (lowerInput.includes('valorant')) {
        videogameId = 34223;
        gameDisplayName = 'Valorant';
    } else {
        return interaction.reply(`I currently support: Ultimate, Melee, Tekken 8, SF6, Rocket League, Valorant.`);
    }

    await interaction.deferReply();

    const query = `query TournamentsByVideogame($videogameId: ID!) {
      tournaments(query: {
        perPage: 10
        page: 1
        sortBy: "startAt asc"
        filter: {
          upcoming: true
          videogameIds: [$videogameId]
        }
      }) {
        nodes {
          name
          slug
          numAttendees
          startAt
          isOnline
          images { height width url }
          events {
            name
            numEntrants
          }
          streams {
            streamSource
            streamName
          }
        }
      }
    }`;

    try {
        const data = await queryAPI(query, { videogameId });
        if (!data || !data.data || !data.data.tournaments || data.data.tournaments.nodes.length === 0) {
            return interaction.editReply(`No upcoming **${gameDisplayName}** tournaments found.`);
        }

        const tournaments = data.data.tournaments.nodes;

        const generateEmbed = (index) => {
            const t = tournaments[index];
            const thumb = t.images.find(img => img.height === img.width)?.url || '';
            const banner = t.images.find(img => img.height !== img.width)?.url || '';

            const embed = new EmbedBuilder()
                .setTitle(t.name)
                .setURL(`https://start.gg/${t.slug}`)
                .setColor('#222326')
                .setThumbnail(thumb)
                .setImage(banner)
                .addFields(
                    { name: 'Info', value: `${t.numAttendees} Attendees\n${t.isOnline ? 'Online' : 'Offline'}\n${convertEpoch(t.startAt, 'America/Los_Angeles')}`, inline: true },
                    { name: 'Events', value: t.events.slice(0, 3).map(e => `\`${e.name}\` (${e.numEntrants} entrants)`).join('\n') || 'N/A', inline: true }
                )
                .setFooter({ text: `Tournament ${index + 1} of ${tournaments.length}`, iconURL: 'https://cdn.discordapp.com/attachments/719461475848028201/777094320531439636/image.png' });

            const twitchStreams = t.streams?.filter(s => s.streamSource === 'TWITCH').map(s => `https://twitch.tv/${s.streamName}`);
            if (twitchStreams && twitchStreams.length > 0) {
                embed.addFields({ name: 'Streams', value: twitchStreams.join('\n') });
            }

            return embed;
        };

        let currentIndex = 0;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(tournaments.length <= 1)
        );

        const response = await interaction.editReply({ embeds: [generateEmbed(currentIndex)], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Not your buttons!', ephemeral: true });
            }

            if (i.customId === 'next') currentIndex++;
            else if (i.customId === 'prev') currentIndex--;

            const updatedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentIndex === 0),
                new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(currentIndex === tournaments.length - 1)
            );

            await i.update({ embeds: [generateEmbed(currentIndex)], components: [updatedRow] });
        });

    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while searching for tournaments.');
    }
}
