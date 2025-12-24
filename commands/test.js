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

        // Extract slug - works with old and new tournaments
        let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').split('?')[0];
        if (!slug.includes('tournament/')) {
            slug = 'tournament/' + slug;
        }

        // Simple query that works for any tournament
        const query = `query TestTournament($slug: String!) {
      tournament(slug: $slug) {
        name
        url
        events {
          id
          name
          slug
        }
      }
    }`;

        try {
            const data = await queryAPI(query, { slug });
            if (!data || !data.data || !data.data.tournament) {
                return interaction.editReply('Could not find tournament. Please check the URL.');
            }

            const tournament = data.data.tournament;
            const event = tournament.events[0];

            if (!event) {
                return interaction.editReply('This tournament has no events yet.');
            }

            await interaction.editReply(`🧪 **Test Mode: Live Feed Simulation**\nPosting sample embeds for **${tournament.name}**...\n_(These are demo embeds showing what live coverage looks like)_`);

            // Post sample embeds
            await this.postTestEmbeds(interaction.channel, tournament, event);

        } catch (error) {
            console.error(error);
            await interaction.editReply('Error fetching tournament data.');
        }
    },

    async postTestEmbeds(channel, tournament, event) {
        // Sample players for demo
        const samplePlayers = [
            { name: 'Player A', seed: 1 },
            { name: 'Player B', seed: 4 },
            { name: 'Team Alpha', seed: 2 },
            { name: 'Team Bravo', seed: 7 },
            { name: 'Pro Player', seed: 3 },
            { name: 'Underdog Squad', seed: 12 }
        ];

        // 1. Match Start Embed (🔴 LIVE)
        const liveEmbed = new EmbedBuilder()
            .setColor('#FFFF00')
            .setTitle(`🔴 Now Playing: ${event.name}`)
            .setDescription(`Winners Quarter-Final\n**${samplePlayers[0].name}** vs **${samplePlayers[1].name}**`)
            .setFooter({ text: tournament.name, iconURL: footerIcon })
            .setTimestamp();

        await channel.send({ content: '**Example: Match Start**', embeds: [liveEmbed] });
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 2. Match Result Embed (✅ RESULT)
        const resultEmbed = new EmbedBuilder()
            .setColor('#36FF7D')
            .setTitle(`✅ Match Result: ${event.name}`)
            .setDescription(`Losers Round 2\n**${samplePlayers[2].name}** vs **${samplePlayers[3].name}**\n\n**Winner:** ${samplePlayers[2].name}`)
            .setFooter({ text: tournament.name, iconURL: footerIcon })
            .setTimestamp();

        await channel.send({ content: '**Example: Match Result**', embeds: [resultEmbed] });
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 3. Upset Alert Embed (🔥 UPSET)
        const winner = samplePlayers[5]; // Seed 12
        const loser = samplePlayers[4]; // Seed 3
        const diff = Math.abs(winner.seed - loser.seed);

        const upsetEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`🔥 UPSET ALERT: ${event.name}`)
            .setDescription(`Winners Round 1\n**${winner.name}** vs **${loser.name}**\n\n**Winner:** ${winner.name}`)
            .addFields({ name: 'Upset Factor', value: `Seed ${winner.seed} def. Seed ${loser.seed} (+${diff})` })
            .setFooter({ text: tournament.name, iconURL: footerIcon })
            .setTimestamp();

        await channel.send({ content: '**Example: Upset Alert**', embeds: [upsetEmbed] });
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 4. Final Standings Embed (🏆)
        const medals = ['🥇', '🥈', '🥉'];
        const topPlayers = samplePlayers.slice(0, 5);
        let podiumList = '';
        let runnerUpList = '';

        topPlayers.forEach((player, index) => {
            const placement = index + 1;
            if (placement <= 3) {
                podiumList += `${medals[placement - 1]} **${player.name}**\n`;
            } else {
                runnerUpList += `**${placement}.** ${player.name}\n`;
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

        await channel.send('✅ **Test complete!** This is what your live coverage will look like.');
    }
};
