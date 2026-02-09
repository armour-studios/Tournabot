const { EmbedBuilder } = require('discord.js');
const { queryAPI, footerIcon } = require('../functions');

module.exports = {
    name: 'streams',
    description: 'List active streams for an event or league',
    async executeSlash(interaction, client) {
        const url = interaction.options.getString('url');
        if (!url) return interaction.reply({ content: 'Please provide a tournament or league URL.', ephemeral: true });

        await interaction.deferReply();

        let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').split('?')[0];
        const isLeague = url.includes('/league/');
        if (isLeague) slug = slug.replace('league/', '').split('/')[0];

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

            const data = await queryAPI(query, { slug });
            const entity = isLeague ? data?.data?.league : data?.data?.tournament;

            if (!entity) return interaction.editReply('Could not find data for that URL.');

            const embed = new EmbedBuilder()
                .setAuthor({ name: '📺 Stream Aggregator', iconURL: footerIcon })
                .setTitle(entity.name)
                .setColor('#6441a5') // Twitch Purple
                .setFooter({ text: 'Powered by Armour Studios', iconURL: footerIcon })
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
};
