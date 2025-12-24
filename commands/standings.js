const { EmbedBuilder } = require('discord.js');
const { queryAPI } = require('../functions');

module.exports = {
  name: 'standings',
  description: 'Show top placements for an event',
  async executeSlash(interaction, client) {
    let url = interaction.options.getString('url');
    if (!url) return interaction.reply('Please provide an event URL.');

    // Extract slug from URL
    let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').split('?')[0];
    // If it's a tournament URL, we might need to find the first event
    // For simplicity, we assume event URL for now, e.g. tournament/slug/event/slug

    const query = `
        query EventStandings($slug: String!) {
          event(slug: $slug) {
            name
            tournament {
              name
            }
            standings(query: {
              page: 1,
              perPage: 10
            }) {
              nodes {
                placement
                entrant {
                  name
                }
              }
            }
          }
        }`;

    await interaction.deferReply();

    try {
      const data = await queryAPI(query, { slug });
      if (!data || !data.data || !data.data.event) {
        return interaction.editReply('Could not find event or standings. Make sure it is an event URL (e.g., `tournament/slug/event/slug`).');
      }

      const event = data.data.event;
      const standings = event.standings.nodes;

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'Tournament Standings', iconURL: 'https://i.imgur.com/v1hKkQ6.png' })
        .setTitle(`${event.tournament.name} - ${event.name}`)
        .setColor('#FF3636')
        .setURL(url);

      if (standings.length === 0) {
        embed.setDescription('No standings found for this event yet.');
      } else {
        let description = '';
        standings.forEach(s => {
          description += `**${s.placement}.** ${s.entrant.name}\n`;
        });
        embed.setDescription(description);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.editReply('There was an error fetching the standings.');
    }
  }
};
