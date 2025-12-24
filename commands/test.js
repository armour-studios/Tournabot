const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { queryAPI, footerIcon, startggIcon } = require('../functions');

module.exports = {
    name: 'test',
    description: 'Admin-only testing commands',
    async executeSlash(interaction, client) {
        // Admin check
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'This command requires Administrator permissions.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'livefeed') {
            return this.testLiveFeed(interaction);
        }
    },

    async testLiveFeed(interaction) {
        const url = interaction.options.getString('url');
        if (!url) return interaction.reply({ content: 'Please provide a tournament URL.', ephemeral: true });

        await interaction.deferReply();

        // Extract slug
        let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').split('?')[0];
        if (!slug.includes('tournament/')) {
            slug = 'tournament/' + slug;
        }

        // Query tournament data
        const query = `query TestTournament($slug: String!) {
      tournament(slug: $slug) {
        name
        url
        events {
          id
          name
          slug
          standings(query: { page: 1, perPage: 8 }) {
            nodes {
              placement
              entrant {
                name
                initialSeedNum
                participants {
                  user {
                    images { url }
                  }
                }
              }
            }
          }
          sets(page: 1, perPage: 5, sortType: RECENT) {
            nodes {
              id
              fullRoundText
              slots {
                entrant {
                  id
                  name
                  initialSeedNum
                  participants {
                    user {
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
    }`;

        try {
            const data = await queryAPI(query, { slug });
            if (!data || !data.data || !data.data.tournament) {
                return interaction.editReply('Could not find tournament. Please check the URL.');
            }

            const tournament = data.data.tournament;
            const event = tournament.events[0]; // Use first event for demo

            if (!event) {
                return interaction.editReply('This tournament has no events yet.');
            }

            await interaction.editReply(`🧪 **Test Mode: Live Feed Simulation**\nPosting sample embeds for **${tournament.name}**...\n_(These are test embeds to show what live coverage looks like)_`);

            // Simulate different types of embeds
            await this.postTestEmbeds(interaction.channel, tournament, event);

        } catch (error) {
            console.error(error);
            await interaction.editReply('Error fetching tournament data.');
        }
    },

    async postTestEmbeds(channel, tournament, event) {
        const sets = event.sets?.nodes || [];
        const standings = event.standings?.nodes || [];

        // 1. Match Start Embed (🔴 LIVE)
        if (sets.length >= 1) {
            const set = sets[0];
            const p1 = set.slots[0]?.entrant;
            const p2 = set.slots[1]?.entrant;

            if (p1 && p2) {
                const p1Name = await this.formatEntrantName(p1);
                const p2Name = await this.formatEntrantName(p2);

                const liveEmbed = new EmbedBuilder()
                    .setColor('#FFFF00')
                    .setTitle(`🔴 Now Playing: ${event.name}`)
                    .setDescription(`${set.fullRoundText}\n${p1Name} vs ${p2Name}`)
                    .setFooter({ text: tournament.name, iconURL: footerIcon })
                    .setTimestamp();

                await channel.send({ content: '**Example: Match Start**', embeds: [liveEmbed] });
                await new Promise(resolve => setTimeout(resolve, 1500)); // Delay for readability
            }
        }

        // 2. Match Result Embed (✅ RESULT)
        if (sets.length >= 2) {
            const set = sets[1];
            const p1 = set.slots[0]?.entrant;
            const p2 = set.slots[1]?.entrant;

            if (p1 && p2) {
                const p1Name = await this.formatEntrantName(p1);
                const p2Name = await this.formatEntrantName(p2);
                const winner = p1; // Assume p1 wins for demo

                const resultEmbed = new EmbedBuilder()
                    .setColor('#36FF7D')
                    .setTitle(`✅ Match Result: ${event.name}`)
                    .setDescription(`${set.fullRoundText}\n${p1Name} vs ${p2Name}\n\n**Winner:** ${winner.name}`)
                    .setFooter({ text: tournament.name, iconURL: footerIcon })
                    .setTimestamp();

                await channel.send({ content: '**Example: Match Result**', embeds: [resultEmbed] });
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        // 3. Upset Alert Embed (🔥 UPSET)
        if (sets.length >= 3) {
            const set = sets[2];
            const p1 = set.slots[0]?.entrant;
            const p2 = set.slots[1]?.entrant;

            if (p1 && p2 && p1.initialSeedNum && p2.initialSeedNum) {
                const p1Name = await this.formatEntrantName(p1);
                const p2Name = await this.formatEntrantName(p2);
                // Simulate upset: lower seed beats higher seed
                const winner = p1.initialSeedNum > p2.initialSeedNum ? p1 : p2;
                const loser = winner === p1 ? p2 : p1;
                const diff = Math.abs(p1.initialSeedNum - p2.initialSeedNum);

                const upsetEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`🔥 UPSET ALERT: ${event.name}`)
                    .setDescription(`${set.fullRoundText}\n${p1Name} vs ${p2Name}\n\n**Winner:** ${winner.name}`)
                    .addFields({ name: 'Upset Factor', value: `Seed ${winner.initialSeedNum} def. Seed ${loser.initialSeedNum} (+${diff})` })
                    .setFooter({ text: tournament.name, iconURL: footerIcon })
                    .setTimestamp();

                await channel.send({ content: '**Example: Upset Alert**', embeds: [upsetEmbed] });
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        // 4. Final Standings Embed (🏆)
        if (standings.length > 0) {
            const medals = ['🥇', '🥈', '🥉'];
            let podiumList = '';
            let runnerUpList = '';

            standings.forEach(s => {
                const name = s.entrant.name;
                const placement = s.placement;

                if (placement <= 3) {
                    podiumList += `${medals[placement - 1]} **${name}**\n`;
                } else {
                    runnerUpList += `**${placement}.** ${name}\n`;
                }
            });

            const standingsEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Tournament Standings', iconURL: footerIcon })
                .setTitle(`🏆 Event Complete: ${tournament.name}`)
                .setDescription(`**Event:** ${event.name}`)
                .setColor('#FF3636')
                .setURL(`https://start.gg/${tournament.url}/event/${event.slug}`)
                .setTimestamp();

            if (podiumList) standingsEmbed.addFields({ name: '🏆 Podium', value: podiumList, inline: false });
            if (runnerUpList) standingsEmbed.addFields({ name: '🌟 Top 8', value: runnerUpList, inline: false });

            await channel.send({ content: '**Example: Final Standings (Auto-Posted)**', embeds: [standingsEmbed] });
        }

        await channel.send('✅ **Test complete!** This is what your live coverage will look like.');
    },

    async formatEntrantName(entrant) {
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
};
