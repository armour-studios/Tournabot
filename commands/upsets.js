const { EmbedBuilder } = require('discord.js');
const { queryAPI, footerIcon } = require('../functions');
const upsetTrackerModel = require('../database/models/upset_tracker');

module.exports = {
    name: 'upsets',
    description: 'Show the biggest upsets for a tournament or event',
    async executeSlash(interaction, client) {
        const url = interaction.options.getString('url');
        if (!url) return interaction.reply('Please provide a tournament or event URL.');

        let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').split('?')[0];
        if (slug.endsWith('/')) slug = slug.slice(0, -1);

        // Strip common browser suffixes
        const suffixes = ['/details', '/overview', '/standings', '/brackets', '/attendees', '/register', '/events', '/results'];
        for (const s of suffixes) {
            if (slug.endsWith(s)) {
                slug = slug.replace(s, '');
                break;
            }
        }

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
                .setDescription(`The biggest upsets recorded by Armour Studios.`)
                .setFooter({ text: 'Powered by Armour Studios', iconURL: footerIcon })
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
};
