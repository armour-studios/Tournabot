const { EmbedBuilder } = require('discord.js');
const { queryAPI, footerIcon, extractSlug, fetchEntity } = require('../functions');

module.exports = {
    name: 'entrants',
    description: 'List seeded entrants for an upcoming event',
    async executeSlash(interaction, client) {
        const url = interaction.options.getString('url');
        if (!url) return interaction.reply({ content: 'Please provide an event URL.', ephemeral: true });

        await interaction.deferReply();

        const slug = extractSlug(url);
        if (!slug) return interaction.editReply('Invalid event/league URL.');

        try {
            const entity = await fetchEntity(slug);
            if (!entity) return interaction.editReply('Could not find event or league.');

            // If it's a direct league link, we might want to show all events or just the most recent.
            // But usually users provide specific event links even in leagues.
            // If they provided a league slug, we fetch the first event.
            let targetEvent = null;
            let eventSlug = null;
            if (url.includes('/event/')) {
                eventSlug = url.split('/event/')[1].split('/')[0];
                targetEvent = entity.events.find(e => extractSlug(e.name) === eventSlug || e.name.toLowerCase().includes(eventSlug.toLowerCase()));
            } else if (entity.events && entity.events.length > 0) {
                // If no event in URL, take the first one
                targetEvent = entity.events[0];
                eventSlug = extractSlug(targetEvent.name) || targetEvent.name.toLowerCase().replace(/\s+/g, '-');
            }

            // Fallback to searching by slug if no explicit event found
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
                return interaction.editReply('Could not find event. Please ensure you are using a specific event URL (e.g. `start.gg/tournament/slug/event/slug`).');
            }

            const event = data.data.event;
            const entrants = event.entrants.nodes;

            const embed = new EmbedBuilder()
                .setAuthor({ name: '👥 Entrants List', iconURL: footerIcon })
                .setTitle(event.tournament.name)
                .setDescription(`**Event:** ${event.name}`)
                .setColor('#FF3399')
                .setFooter({ text: 'Powered by Armour Studios', iconURL: footerIcon })
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
};
