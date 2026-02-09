const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require('discord.js');
const { queryAPI, footerIcon, extractSlug, fetchEntity } = require('../functions');

module.exports = {
    name: 'bracket',
    description: 'Visualize tournament brackets and find players',
    async executeSlash(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'view') {
            await handleView(interaction);
        } else if (subcommand === 'find') {
            await handleFind(interaction);
        }
    }
};

async function handleView(interaction) {
    const url = interaction.options.getString('url');
    // Phase is auto-selected now
    const phaseIdOp = null;

    await interaction.deferReply();

    const slug = extractSlug(url);
    if (!slug) return interaction.editReply('Invalid tournament/event URL.');

    try {
        // 1. Fetch Event and Phases
        const eventQuery = `query EventPhases($slug: String!) {
            event(slug: $slug) {
                id name
                tournament { name }
                phases {
                    id name groupCount
                    phaseGroups(query: { perPage: 10 }) {
                        nodes { id displayIdentifier }
                    }
                }
            }
        }`;

        const data = await queryAPI(eventQuery, { slug });
        if (!data?.data?.event) {
            // Try fetching as a tournament if event lookup failed
            const tournamentQuery = `query TournamentEvents($slug: String!) {
                tournament(slug: $slug) {
                    id name
                    events { id name slug }
                }
            }`;
            const tData = await queryAPI(tournamentQuery, { slug });
            const tournament = tData?.data?.tournament;

            if (tournament && tournament.events.length > 0) {
                // Determine best event (e.g., matching slug parts or just the first one)
                // For now, let's take the first one or try to string match
                let targetEvent = tournament.events[0];

                // If we found a valid event, fetch its phases now
                const eventQuery = `query EventPhases($slug: String!) {
                    event(slug: $slug) {
                        id name
                        tournament { name }
                        phases {
                            id name groupCount phaseOrder
                            phaseGroups(query: { perPage: 10 }) {
                                nodes { id displayIdentifier }
                            }
                        }
                    }
                }`;
                const eventData = await queryAPI(eventQuery, { slug: targetEvent.slug });

                if (eventData?.data?.event) {
                    // Proceed with this event
                    const event = eventData.data.event;
                    const phases = event.phases || [];
                    if (phases.length === 0) return interaction.editReply('No phases found for this event.');

                    // Auto-select last phase
                    phases.sort((a, b) => a.phaseOrder - b.phaseOrder);
                    return await showBracket(interaction, event, phases[phases.length - 1].id);
                }
            }

            return interaction.editReply('Could not find event or tournament.');
        }

        const event = data.data.event;
        const phases = event.phases || [];

        if (phases.length === 0) return interaction.editReply('No phases found for this event.');

        // If no phase specified, auto-select the last phase (usually Finals/Top 8)
        if (!phaseIdOp) {
            // Sort phases by order just in case
            phases.sort((a, b) => a.phaseOrder - b.phaseOrder);
            const targetPhase = phases[phases.length - 1]; // Last phase is usually the main bracket/finals

            return await showBracket(interaction, event, targetPhase.id);
        } else {
            // Validate phase ID if possible, or just try to show it
            await showBracket(interaction, event, phaseIdOp);
        }

    } catch (error) {
        console.error(error);
        await interaction.editReply('Error fetching bracket data.');
    }
}

async function showBracket(interaction, event, phaseId) {
    // For now, we'll implement a simple top 8 visualization or just list groups if it's pools.
    // Real visualization requires fetching sets and constructing a tree.
    // For this step, let's fetch the sets for the first group of the phase (usually top 8 has 1 group)

    const phase = event.phases.find(p => p.id == phaseId);
    if (!phase) return interaction.editReply('Invalid phase selected.');

    // Get first group ID
    // Note: Start.gg API structure for phaseGroups can be complex.
    // We need to fetch the PhaseGroup sets.

    // Assuming single bracket for Top 8 or taking the first pool
    const group = phase.phaseGroups?.nodes?.[0];
    if (!group) return interaction.editReply('No groups found in this phase.');

    const setsQuery = `query GroupSets($id: ID) {
        phaseGroup(id: $id) {
            displayIdentifier
            sets(perPage: 50, sortType: STANDARD) {
                nodes {
                    id fullRoundText displayScore wPlacement lPlacement round identifier
                    slots { entrant { name id } }
                    winnerId
                }
            }
        }
    }`;

    const setData = await queryAPI(setsQuery, { id: group.id });
    const sets = setData?.data?.phaseGroup?.sets?.nodes || [];

    if (sets.length === 0) return interaction.editReply('No sets found in this bracket.');

    // --- Visualization Logic ---
    // Sort sets by round to determine Upper/Lower
    const upperBracket = sets.filter(s => s.round > 0).sort((a, b) => a.round - b.round);
    const lowerBracket = sets.filter(s => s.round < 0).sort((a, b) => a.round - b.round);
    const grandFinals = sets.filter(s => s.fullRoundText.toLowerCase().includes('grand final'));

    const { generateBracketImage } = require('../utils/bracket_visualizer');

    // Pagination/Navigation State
    const sendBracketView = async (viewType) => {
        let title = `Bracket: ${phase.name} (${viewType})`;
        let setsToDraw = [];

        if (viewType === 'Upper Bracket') setsToDraw = upperBracket;
        else if (viewType === 'Lower Bracket') setsToDraw = lowerBracket;
        else if (viewType === 'Finals') setsToDraw = grandFinals;

        if (setsToDraw.length === 0) {
            return new EmbedBuilder()
                .setTitle(title)
                .setDescription(`No matches found for ${viewType}.`)
                .setColor('#FF3399')
                .setFooter({ text: 'Powered by Armour Studios', iconURL: footerIcon });
        }

        try {
            const attachment = await generateBracketImage(setsToDraw, title);
            return { files: [attachment] };
        } catch (err) {
            console.error('Error generating bracket image:', err);
            return new EmbedBuilder()
                .setTitle(title)
                .setDescription('Error generating visual bracket.')
                .setColor('#FF0000');
        }
    };

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bracket_upper').setLabel('Upper Bracket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bracket_lower').setLabel('Lower Bracket').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('bracket_finals').setLabel('Grand Finals').setStyle(ButtonStyle.Success)
    );

    // Initial view
    const initialView = upperBracket.length > 0 ? 'Upper Bracket' : 'Finals';
    const initialPayload = await sendBracketView(initialView);

    // Check if it's an embed (error/empty) or file (success)
    const responsePayload = { components: [row] };
    if (initialPayload.files) {
        responsePayload.files = initialPayload.files;
        responsePayload.content = `**${phase.name}** - ${initialView}`;
        responsePayload.embeds = [];
    } else {
        responsePayload.embeds = [initialPayload];
        responsePayload.files = [];
    }

    const response = await interaction.editReply(responsePayload);

    const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) return i.reply({ content: 'Not your schematic!', ephemeral: true });

        let newView = 'Upper Bracket';
        if (i.customId === 'bracket_upper') newView = 'Upper Bracket';
        else if (i.customId === 'bracket_lower') newView = 'Lower Bracket';
        else if (i.customId === 'bracket_finals') newView = 'Finals';

        await i.deferUpdate();
        const newPayload = await sendBracketView(newView);

        const updatePayload = { components: [row] };
        if (newPayload.files) {
            updatePayload.files = newPayload.files;
            updatePayload.content = `**${phase.name}** - ${newView}`;
            updatePayload.embeds = [];
        } else {
            updatePayload.embeds = [newPayload];
            updatePayload.files = [];
            updatePayload.content = null;
        }

        await i.editReply(updatePayload);
    });
}

function formatSet(set) {
    const p1 = set.slots[0]?.entrant?.name || 'TBD';
    const p2 = set.slots[1]?.entrant?.name || 'TBD';
    const score = set.displayScore || 'Vs';

    // Bold the winner if known
    let p1Str = p1;
    let p2Str = p2;

    if (set.winnerId) {
        if (set.slots[0]?.entrant?.id === set.winnerId) p1Str = `**${p1}**`;
        else if (set.slots[1]?.entrant?.id === set.winnerId) p2Str = `**${p2}**`;
    }

    return `• ${p1Str} vs ${p2Str} (${score})`;
}

async function handleFind(interaction) {
    const url = interaction.options.getString('url');
    const playerSearch = interaction.options.getString('player');

    await interaction.deferReply();

    const slug = extractSlug(url);
    if (!slug) return interaction.editReply('Invalid tournament/event URL.');

    try {
        // 1. Find Entrant ID
        const entrantQuery = `query FindEntrant($slug: String!, $name: String!) {
            event(slug: $slug) {
                id name
                entrants(query: { filter: { name: $name }, perPage: 5 }) {
                    nodes { id name }
                }
            }
        }`;

        const entrantData = await queryAPI(entrantQuery, { slug, name: playerSearch });
        const entrants = entrantData?.data?.event?.entrants?.nodes || [];

        if (entrants.length === 0) {
            return interaction.editReply(`Could not find entrant "**${playerSearch}**" in this event.`);
        }

        // Use the first match, or refine if multiple
        const targetEntrant = entrants[0];
        // Note: For finding "Armour | Jones" when searching "Jones", API fuzzy search usually works well.

        // 2. Fetch User's Sets
        const setsQuery = `query PlayerSets($eventId: ID!, $entrantId: ID!) {
            event(id: $eventId) {
                sets(page: 1, perPage: 20, filters: { entrantIds: [$entrantId] }) {
                    nodes {
                        id fullRoundText displayScore round state
                        slots { entrant { id name } }
                        winnerId
                    }
                }
            }
        }`;

        const eventId = entrantData.data.event.id;
        const setsResult = await queryAPI(setsQuery, { eventId, entrantId: targetEntrant.id });
        const sets = setsResult?.data?.event?.sets?.nodes || [];

        if (sets.length === 0) {
            return interaction.editReply(`No matches found for **${targetEntrant.name}**.`);
        }

        // 3. Format Response
        const embed = new EmbedBuilder()
            .setTitle(`Run for ${targetEntrant.name}`)
            .setColor('#36FF7D')
            .setFooter({ text: 'Powered by Armour Studios', iconURL: footerIcon });

        let history = '';
        let nextMatch = 'None';

        sets.sort((a, b) => a.id - b.id); // Approximate Chronological order? Or use completedAt if available. 
        // Rounds are negative for Losers, positive for Winners. 
        // Sorting by completed time is best, but we didn't fetch it. ID is a decent proxy usually.

        sets.forEach(s => {
            const isCompleted = s.state === 3; // 3 = Completed from Start.gg constants usually, or rely on winnerId
            const isWinner = s.winnerId === targetEntrant.id;

            const opponentSlot = s.slots.find(slot => slot.entrant?.id !== targetEntrant.id);
            const opponent = opponentSlot?.entrant?.name || 'TBD';

            const score = s.displayScore || 'Vs';

            if (isCompleted) {
                history += `${isWinner ? '✅' : '❌'} **${s.fullRoundText}**: vs ${opponent} (${score})\n`;
            } else {
                nextMatch = `**${s.fullRoundText}**: vs ${opponent}`;
            }
        });

        embed.setDescription(`**Next Match:**\n${nextMatch}\n\n**History:**\n${history || 'No matches played yet.'}`);

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while finding the player.');
    }
}
