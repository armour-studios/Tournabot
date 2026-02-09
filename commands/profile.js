const { EmbedBuilder } = require('discord.js');
const { queryAPI, footerIcon, convertEpoch } = require('../functions');

module.exports = {
    name: 'profile',
    description: 'View a player\'s tournament history and career stats',
    async executeSlash(interaction, client) {
        const input = interaction.options.getString('user');
        if (!input) return interaction.reply({ content: 'Please provide a player tag or slug.', ephemeral: true });

        await interaction.deferReply();

        try {
            // 1. Fetch Player/User Data
            const query = `query PlayerProfile($slug: String) {
                user(slug: $slug) {
                    player {
                        id
                        gamerTag
                        prefix
                        images { url type }
                    }
                    images { url type }
                    tournaments(query: { perPage: 5, filter: { past: true } }) {
                        nodes {
                            name
                            startAt
                            slug
                            events {
                                name
                                standings(query: { perPage: 1 }) {
                                    nodes { placement entrant { name } }
                                }
                            }
                        }
                    }
                }
            }`;

            const data = await queryAPI(query, { slug: input });
            if (!data || !data.data || !data.data.user) {
                return interaction.editReply(`Could not find profile for **${input}**. Try using their start.gg slug.`);
            }

            const user = data.data.user;
            const player = user.player;
            const mainImg = user.images?.find(i => i.type === 'profile')?.url || player.images?.[0]?.url || footerIcon;

            // 2. Process Tournaments
            const tourneyList = user.tournaments.nodes.map(t => {
                const event = t.events[0];
                const placement = event?.standings?.nodes?.[0]?.placement || 'N/A';
                return `**${t.name}**: ${placement}`;
            }).join('\n');

            // 3. Build Embed
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Start.gg Player Profile', iconURL: footerIcon })
                .setTitle(`${player.prefix ? player.prefix + ' | ' : ''}${player.gamerTag}`)
                .setURL(`https://start.gg/user/${input}`)
                .setThumbnail(mainImg)
                .setColor('#FF3399')
                .addFields(
                    { name: '🎮 ID', value: player.id.toString(), inline: true },
                    { name: '🌍 Profile Status', value: 'Verified', inline: true },
                    { name: '🏆 Recent Results', value: tourneyList || 'No recent tournaments found.', inline: false }
                )
                .setFooter({ text: 'Powered by Armour Studios', iconURL: footerIcon })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('An error occurred while fetching the profile.');
        }
    }
};
