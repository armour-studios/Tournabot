const { EmbedBuilder } = require('discord.js');
const { queryAPI, footerIcon } = require('../functions');

module.exports = {
    name: 'h2h',
    description: 'Compare match history between two players (Head-to-Head)',
    async executeSlash(interaction, client) {
        const player1Input = interaction.options.getString('player1');
        const player2Input = interaction.options.getString('player2');

        if (!player1Input || !player2Input) {
            return interaction.reply({ content: 'Please provide two player tags or profile slugs.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // 1. Identify Players
            const players = [];
            const inputs = [player1Input, player2Input];

            for (const input of inputs) {
                // Try as slug first
                let data = await queryAPI(`query PlayerBySlug($slug: String) { user(slug: $slug) { player { id gamerTag images { url } } } }`, { slug: input });

                if (data?.data?.user?.player) {
                    players.push({
                        id: data.data.user.player.id,
                        tag: data.data.user.player.gamerTag,
                        image: data.data.user.player.images?.[0]?.url || null
                    });
                } else {
                    // Try as exact gamerTag search (limit to top results)
                    // Note: If 'players' query fails, we might need a fallback.
                    // For now, if slug fails, we try searching for them in a "recent" context or just return error.
                    // Improving this search is a separate enhancement.
                    return interaction.editReply(`Could not find player: **${input}**. Please use their start.gg profile slug (e.g. from their profile URL).`);
                }
            }

            if (players.length < 2) return; // Should be handled by error above

            // 2. Fetch Sets
            // We fetch sets for Player 1 and filter for sets containing Player 2
            const setsQuery = `query H2HSets($playerId: ID, $page: Int) {
                player(id: $playerId) {
                    sets(perPage: 100, page: $page, filters: { hideEmpty: true }) {
                        nodes {
                            displayScore
                            fullRoundText
                            winnerId
                            completedAt
                            event { name tournament { name } }
                            slots { entrant { id name participants { player { id } } } }
                        }
                    }
                }
            }`;

            const setsData = await queryAPI(setsQuery, { playerId: players[0].id, page: 1 });
            const allSets = setsData?.data?.player?.sets?.nodes || [];

            const h2hSets = allSets.filter(set =>
                set.slots.some(slot => slot.entrant?.participants?.some(p => p.player?.id == players[1].id))
            );

            if (h2hSets.length === 0) {
                return interaction.editReply(`No recorded matches found between **${players[0].tag}** and **${players[1].tag}** on start.gg.`);
            }

            // 3. Calculate Stats
            let p1Wins = 0;
            let p2Wins = 0;
            const history = [];

            h2hSets.forEach(set => {
                const winnerSlot = set.slots.find(slot => slot.entrant?.id === set.winnerId || slot.entrant?.participants?.some(p => p.player?.id === set.winnerId));
                // Note: winnerId can be entrantId or playerId depending on the event setup. 
                // Reliable way is to check if the winnerId matches someone in the slot.

                const p1Winner = set.winnerId == players[0].id || set.slots.find(s => s.entrant?.id === set.winnerId)?.entrant?.participants?.some(p => p.player?.id == players[0].id);
                const p2Winner = set.winnerId == players[1].id || set.slots.find(s => s.entrant?.id === set.winnerId)?.entrant?.participants?.some(p => p.player?.id == players[1].id);

                if (p1Winner) p1Wins++;
                else if (p2Winner) p2Wins++;

                history.push(`**${set.event.tournament.name}**\n${set.displayScore} (${set.fullRoundText})`);
            });

            // 4. Build Embed
            const winRate = ((p1Wins / (p1Wins + p2Wins)) * 100).toFixed(1);

            const embed = new EmbedBuilder()
                .setTitle(`⚔️ Head-to-Head: ${players[0].tag} vs ${players[1].tag}`)
                .setColor(p1Wins > p2Wins ? '#36FF7D' : (p2Wins > p1Wins ? '#FF3399' : '#FFFF00'))
                .setThumbnail(players[0].image || players[1].image || footerIcon)
                .addFields(
                    { name: '📊 Lifetime Record', value: `**${players[0].tag}** ${p1Wins} - ${p2Wins} **${players[1].tag}**`, inline: false },
                    { name: '📈 Win Rate', value: `${winRate}% in favor of ${p1Wins >= p2Wins ? players[0].tag : players[1].tag}`, inline: true },
                    { name: '🔥 Total Sets', value: `${h2hSets.length}`, inline: true },
                    { name: '🕒 Recent Matchup', value: history[0] || 'N/A', inline: false }
                )
                .setFooter({ text: 'Powered by Armour Studios', iconURL: footerIcon })
                .setTimestamp();

            if (history.length > 1) {
                embed.addFields({ name: '📜 Match History', value: history.slice(0, 5).join('\n\n') });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('An error occurred while comparing players.');
        }
    }
};
