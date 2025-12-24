const { EmbedBuilder } = require('discord.js');
const { queryAPI, footerIcon } = require('../functions');

module.exports = {
  name: 'upcoming',
  description: 'Show upcoming sets for an event',
  async executeSlash(interaction, client) {
    let url = interaction.options.getString('url');
    if (!url) return interaction.reply('Please provide an event URL.');

    let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').split('?')[0];

    const query = `
        query EventSets($slug: String!) {
          event(slug: $slug) {
            name
            tournament {
              name
            }
            sets(
              page: 1,
              perPage: 10,
              sortType: CALL_ORDER,
              filters: {
                state: [1, 2]
              }
            ) {
              nodes {
                fullRoundText
                slots {
                  entrant {
                    name
                  }
                }
              }
            }
          }
        }`;

    await interaction.deferReply();

    try {
      const data = await queryAPI(query, { slug });
      if (!data || !data.data || !data.data.event) {
        return interaction.editReply('Could not find event or upcoming sets.');
      }

      const event = data.data.event;
      const sets = event.sets.nodes;

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'Upcoming Sets', iconURL: footerIcon })
        .setTitle(`${event.tournament.name} - ${event.name}`)
        .setColor('#FF3636')
        .setURL(url);

      if (sets.length === 0) {
        embed.setDescription('No upcoming or in-progress sets found.');
      } else {
        let description = '';
        sets.forEach(s => {
          const entrants = s.slots.map(sl => sl.entrant ? sl.entrant.name : 'TBD').join(' vs ');
          description += `**${s.fullRoundText}:** ${entrants}\n`;
        });
        embed.setDescription(description);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.editReply('There was an error fetching upcoming sets.');
    }
  }
};
