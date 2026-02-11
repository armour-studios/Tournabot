const { queryAPI, footerIcon, extractSlug } = require('../functions');


async function generateStandingsEmbed(data, url, type = 'event') {
  const isLeague = type === 'league';
  const entity = isLeague ? data.league : data.event;

  if (!entity || !entity.standings || !entity.standings.nodes) {
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('No Standings Available')
      .setDescription('Standings data is not available for this event yet.')
      .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon });
    return errorEmbed;
  }

  const standings = entity.standings.nodes;
  let thumbUrl = footerIcon;
  if (isLeague) {
    thumbUrl = entity.images?.find(i => i.type === 'logo' || i.type === 'profile')?.url || footerIcon;
  } else {
    const tournamentImage = entity.tournament.images?.find(i => i.type === 'profile')?.url;
    const winnerImage = standings[0]?.entrant?.participants?.[0]?.user?.images?.[0]?.url;
    thumbUrl = tournamentImage || winnerImage || footerIcon;
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: isLeague ? 'League Standings' : 'Tournament Standings', iconURL: footerIcon })
    .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon })
    .setTitle(`${isLeague ? entity.name : entity.tournament.name}`)
    .setColor('#FF3399')
    .setThumbnail(thumbUrl)
    .setURL(url);

  if (!isLeague) embed.setDescription(`**Event:** ${entity.name}`);

  if (standings.length === 0) {
    embed.setDescription(isLeague ? 'No standings found for this league.' : 'No standings found for this event yet.');
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    let podiumList = '';
    let runnerUpList = '';

    let count = 1;
    standings.forEach(s => {
      const name = s.entrant.name;
      const placement = s.placement;

      if (placement <= 3) {
        podiumList += `${medals[placement - 1]} **(${placement}) ${name}**\n`;
      } else if (count <= 16) {
        runnerUpList += `**${count}.** (${placement}) ${name}\n`;
      }
      count++;
    });

    if (podiumList) {
      embed.addFields({
        name: '🏆 Podium',
        value: podiumList + '\u200B',
        inline: false
      });
    }

    if (runnerUpList) {
      embed.addFields({
        name: isLeague ? '📈 Current Rankings' : '🌟 Top 16',
        value: runnerUpList,
        inline: false
      });
    }
  }

  return embed;
}

async function showStandings(interaction, slug, isLeague = false) {
  const eventQuery = `
      query EventStandings($slug: String!) {
        event(slug: $slug) {
          name
          tournament {
            name
            images { url type }
          }
          standings(query: { page: 1, perPage: 16 }) {
            nodes {
              placement
              entrant {
                name
                participants { user { images { url } } }
              }
            }
          }
        }
      }`;

  const leagueQuery = `
      query LeagueStandings($slug: String!) {
        league(slug: $slug) {
          name
          images { url type }
          standings(query: { page: 1, perPage: 16 }) {
            nodes {
              placement
              entrant { name }
            }
          }
        }
      }`;

  const query = isLeague ? leagueQuery : eventQuery;
  const data = await queryAPI(query, { slug });

  if (!data || !data.data || (isLeague ? !data.data.league : !data.data.event)) {
    return interaction.editReply({ content: 'Could not find standings.', components: [] });
  }

  const embed = await generateStandingsEmbed(data.data, `https://start.gg/${slug}`, isLeague ? 'league' : 'event');
  await interaction.editReply({ content: null, embeds: [embed], components: [] });
}

module.exports = {
  name: 'standings',
  description: 'Show top placements for an event',
  async executeSlash(interaction, client) {
    const url = interaction.options.getString('url');
    if (!url) return interaction.reply('Please provide an event or league URL.');

    let slug = extractSlug(url);
    if (!slug) return interaction.reply('Invalid start.gg URL provided.');


    const isLeague = url.includes('/league/');
    const isTournamentOnly = !url.includes('/event/') && !isLeague;

    // Further refine slug: strip 'league/' or 'tournament/' prefixes if present
    let discoverySlug = slug;
    if (isLeague && slug.startsWith('league/')) {
      discoverySlug = slug.replace('league/', '').split('/')[0];
    } else if (slug.startsWith('tournament/')) {
      discoverySlug = slug.replace('tournament/', '');
    }

    await interaction.deferReply();

    try {
      if (isTournamentOnly || isLeague) {
        // Discovery Mode
        const discoveryQuery = isLeague ? `
          query LeagueDiscovery($slug: String!) {
            league(slug: $slug) {
              name
              events(query: { perPage: 20 }) {
                nodes {
                  id name slug startAt
                }
              }
            }
          }
        ` : `
          query TournamentDiscovery($slug: String!) {
            tournament(slug: $slug) {
              name
              events { id name slug startAt }
            }
          }
        `;

        const discoveryData = await queryAPI(discoveryQuery, { slug: discoverySlug });
        if (!discoveryData || !discoveryData.data || (isLeague ? !discoveryData.data.league : !discoveryData.data.tournament)) {
          // Fallback: If discovery failed, try single mode with original slug
          return await showStandings(interaction, slug, isLeague);
        }

        const events = isLeague
          ? discoveryData.data.league.events.nodes
          : discoveryData.data.tournament.events;

        if (events.length === 0) {
          return await showStandings(interaction, slug, isLeague);
        }

        if (events.length === 1 && !isLeague) {
          return showStandings(interaction, events[0].slug, false);
        }

        // Filter events to only those with valid slug and name
        const validEvents = events.filter(e => e && e.slug && e.name);

        const options = validEvents.slice(0, 24).map(e => {
          // Format date if available
          let label = e.name || 'Unknown Event';
          if (e.startAt) {
            const date = new Date(e.startAt * 1000);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            label = `${dateStr} - ${e.name}`;
          }
          return {
            label: label.slice(0, 100),
            value: (e.slug || 'unknown').slice(0, 100)
          };
        }).filter(opt => opt.label && opt.value);

        // For Leagues, add "Overall League Rankings"
        if (isLeague) {
          options.unshift({
            label: '🏆 Overall League Rankings',
            value: `LEAGUE:${discoverySlug}`
          });
        }

        if (options.length === 0) {
          return interaction.editReply('No valid events found for this tournament.');
        }

        const row = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('select_standings_event')
              .setPlaceholder('Select an event to view standings')
              .addOptions(options.slice(0, 25))
          );

        const response = await interaction.editReply({
          content: 'Multiple events found. Please select one:',
          components: [row]
        });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

        collector.on('collect', async i => {
          if (i.user.id !== interaction.user.id) return i.reply({ content: 'Only the command user can select.', ephemeral: true });
          await i.deferUpdate();

          if (i.values[0].startsWith('LEAGUE:')) {
            await showStandings(interaction, i.values[0].split(':')[1], true);
          } else {
            await showStandings(interaction, i.values[0], false);
          }
          collector.stop();
        });

        return;
      }

      // Single Event/Tournament/League Mode
      if (slug.includes('/event/')) {
        const parts = slug.split('/');
        const eventIndex = parts.indexOf('event');
        if (eventIndex !== -1 && parts.length > eventIndex + 1) {
          slug = parts.slice(0, eventIndex + 2).join('/');
        }
      }

      await showStandings(interaction, slug, isLeague);

    } catch (error) {
      console.error('[Standings Command] Error:', error.message, error.stack);
      try {
        await interaction.editReply('There was an error processing your request: ' + error.message);
      } catch (e) {
        console.error('[Standings Command] Failed to editReply:', e.message);
      }
    }
  },
  generateStandingsEmbed: generateStandingsEmbed
};
