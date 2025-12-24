const { EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { queryAPI, footerIcon } = require('../functions');
const HybridRLAPI = require('../utils/hybrid_rl_api');
const SeedCalculator = require('../utils/seed_calculator');
const channelModel = require('../database/models/channel');

module.exports = {
    name: 'seed',
    description: 'Generate tournament seeds for Rocket League',
    async executeSlash(interaction, client) {
        // Admin check
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'This command requires Administrator permissions.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'generate') {
            return this.generateSeeds(interaction);
        }
    },

    async generateSeeds(interaction) {
        const url = interaction.options.getString('url');
        if (!url) return interaction.reply({ content: 'Please provide an event URL.', ephemeral: true });

        await interaction.deferReply();

        // Extract event slug from URL
        let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').split('?')[0];
        if (!slug.includes('event/')) {
            return interaction.editReply('Please provide a valid Start.gg **event** URL (not tournament URL).');
        }

        // Query Start.gg for entrants
        const query = `query EventEntrants($slug: String!) {
      event(slug: $slug) {
        name
        tournament {
          name
        }
        numEntrants
        entrants(query: { page: 1, perPage: 500 }) {
          nodes {
            id
            name
            participants {
              gamerTag
              user {
                name
                authorizations(types: [EPIC, STEAM, XBOX, TWITCH]) {
                  type
                  externalUsername
                }
              }
            }
          }
        }
      }
    }`;

        try {
            const data = await queryAPI(query, { slug });
            if (!data || !data.data || !data.data.event) {
                return interaction.editReply('Could not find event. Please check the URL.');
            }

            const event = data.data.event;
            const entrants = event.entrants.nodes;

            if (entrants.length === 0) {
                return interaction.editReply('No entrants found for this event yet.');
            }

            await interaction.editReply(`🔍 **Seed Generation Started**\nFetching stats for **${entrants.length}** players...\n_This may take a few minutes for large tournaments._`);

            // Extract player identifiers
            const players = entrants.map(entrant => {
                const participant = entrant.participants[0];
                const epicAuth = participant.user?.authorizations?.find(a => a.type === 'EPIC');
                const steamAuth = participant.user?.authorizations?.find(a => a.type === 'STEAM');

                let platform = 'epic';
                let playerName = entrant.name;

                if (epicAuth) {
                    platform = 'epic';
                    playerName = epicAuth.externalUsername || entrant.name;
                } else if (steamAuth) {
                    platform = 'steam';
                    playerName = steamAuth.externalUsername || entrant.name;
                }

                return {
                    id: entrant.id,
                    name: entrant.name,
                    platform,
                    playerName
                };
            });

            // Initialize hybrid API (checks for RAPIDAPI_KEY in env)
            const rapidApiKey = process.env.RAPIDAPI_KEY || null;
            const rlApi = new HybridRLAPI(rapidApiKey);

            // Fetch stats with progress updates
            let lastUpdate = Date.now();
            const playerStats = await rlApi.getMultiplePlayerStats(players, (current, total, source, rapidCount, scraperCount) => {
                // Update every 10 players or every 30 seconds
                if (current % 10 === 0 || Date.now() - lastUpdate > 30000) {
                    interaction.editReply(`🔍 **Seed Generation In Progress**\nProcessed: **${current}/${total}** players\nRapidAPI: ${rapidCount} | Web Scraper: ${scraperCount}`).catch(() => { });
                    lastUpdate = Date.now();
                }
            });

            // Calculate seeds
            const calculator = new SeedCalculator();
            const seededPlayers = calculator.generateSeeds(playerStats);
            const summary = calculator.getSummary(seededPlayers);
            const csvContent = calculator.formatAsCSV(seededPlayers);

            // Create CSV attachment
            const csvBuffer = Buffer.from(csvContent, 'utf-8');
            const attachment = new AttachmentBuilder(csvBuffer, {
                name: `${event.name.replace(/[^a-z0-9]/gi, '_')}_seeds.csv`
            });

            // Build result embed
            const topSeedsText = summary.topSeeds.map(p =>
                `**${p.seed}.** ${p.name} (${p.rank} - ${p.mmr} MMR)`
            ).join('\n');

            const usageStats = rlApi.getUsageStats();
            const sourceInfo = usageStats.usingRapidAPI
                ? `RapidAPI: ${usageStats.requestsToday}/${usageStats.dailyLimit} used today`
                : 'Using Web Scraper (no API key)';

            const resultEmbed = new EmbedBuilder()
                .setColor('#36FF7D')
                .setTitle(`🎯 Seeds Generated: ${event.name}`)
                .setDescription(`**Tournament:** ${event.tournament.name}\n**Event:** ${event.name}`)
                .addFields(
                    { name: '📊 Stats', value: `Entrants: ${summary.totalPlayers}\nRanked: ${summary.rankedPlayers}\nUnranked: ${summary.unrankedPlayers}\nAvg MMR: ${summary.avgMMR}`, inline: true },
                    { name: '🔧 Data Source', value: sourceInfo, inline: true },
                    { name: '🥇 Top Seeds', value: topSeedsText, inline: false }
                )
                .setFooter({ text: 'CSV file attached for Start.gg import', iconURL: footerIcon })
                .setTimestamp();

            // Get seed channel if set
            const channelDoc = await channelModel.findOne({ guildid: interaction.guild.id });
            const seedChannel = channelDoc?.seedchannel ? interaction.guild.channels.cache.get(channelDoc.seedchannel) : null;

            // Post to seed channel if configured, otherwise to current channel
            const targetChannel = seedChannel || interaction.channel;

            await targetChannel.send({ embeds: [resultEmbed], files: [attachment] });
            await interaction.editReply(`✅ **Seed generation complete!** Results posted in ${targetChannel}.`);

        } catch (error) {
            console.error('Seed generation error:', error);
            await interaction.editReply(`❌ **Error:** ${error.message}`);
        }
    }
};
