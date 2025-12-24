const { EmbedBuilder } = require('discord.js');
const { queryAPI, footerIcon } = require('../functions');


async function generateStandingsEmbed(event, url) {
  const standings = event.standings.nodes;

  // Determine Thumbnail: Tournament Profile -> 1st Place User Image -> Default Logo
  const tournamentImage = event.tournament.images.find(i => i.type === 'profile')?.url;
  const winnerImage = standings[0]?.entrant?.participants[0]?.user?.images?.[0]?.url;
  const thumbUrl = tournamentImage || winnerImage || footerIcon;

  const embed = new EmbedBuilder()
    .setAuthor({ name: 'Tournament Standings', iconURL: footerIcon })
    .setTitle(`${event.tournament.name}`)
    .setDescription(`**Event:** ${event.name}`)
    .setColor('#FF3636')
    .setThumbnail(thumbUrl)
    .setURL(url);

  if (standings.length === 0) {
    embed.setDescription('No standings found for this event yet.');
  } else {
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

    if (podiumList) embed.addFields({ name: '🏆 Podium', value: podiumList, inline: false });
    if (runnerUpList) embed.addFields({ name: '🌟 Top 8', value: runnerUpList, inline: false });
  }

  return embed;
}

module.exports = {
  name: 'standings',
  description: 'Show top placements for an event',
  async executeSlash(interaction, client) {
    let url = interaction.options.getString('url');
    if (!url) return interaction.reply('Please provide an event URL.');

    // Extract slug from URL
    let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').split('?')[0];

    const query = `
        query EventStandings($slug: String!) {
          event(slug: $slug) {
            name
            tournament {
              name
              images {
                url
                type
              }
            }
            standings(query: {
              page: 1,
              perPage: 8
            }) {
              nodes {
                placement
                entrant {
                  name
                  participants {
                    user {
                      images {
                        url
                      }
                    }
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
        return interaction.editReply('Could not find event or standings. Make sure it is an event URL (e.g., `tournament/slug/event/slug`).');
      }

      const event = data.data.event;
      const embed = await generateStandingsEmbed(event, url);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.editReply('There was an error fetching the standings.');
    }
  },
  generateStandingsEmbed: generateStandingsEmbed
};
