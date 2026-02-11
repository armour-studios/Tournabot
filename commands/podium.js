const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { queryAPI, footerIcon } = require('../functions');

async function getPodiumEmbed(entity, url, isLeague = false) {
  const standings = entity.standings.nodes;

  if (standings.length === 0) {
    return new EmbedBuilder()
      .setColor('#FF3399')
      .setDescription(isLeague ? 'No standings found for this league.' : 'No standings found for this event yet.')
      .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon });
  }

  const medals = ['🥇', '🥈', '🥉'];
  let podiumList = '';

  standings.forEach(s => {
    if (s.placement <= 3) {
      podiumList += `${medals[s.placement - 1]} **(${s.placement}) ${s.entrant.name}**\n`;
    }
  });

  // Determine Thumbnail
  let thumbUrl = footerIcon;
  if (isLeague) {
    thumbUrl = entity.images?.find(i => i.type === 'logo' || i.type === 'profile')?.url || footerIcon;
  } else {
    const tournamentImage = entity.tournament.images?.find(i => i.type === 'profile')?.url;
    const winnerImage = standings[0]?.entrant?.participants?.[0]?.user?.images?.[0]?.url;
    thumbUrl = tournamentImage || winnerImage || footerIcon;
  }

  return new EmbedBuilder()
    .setAuthor({ name: isLeague ? 'League Podium' : 'Tournament Podium', iconURL: footerIcon })
    .setTitle(isLeague ? entity.name : entity.tournament.name)
    .setURL(url)
    .setDescription(`${!isLeague ? `**Event:** ${entity.name}\n\n` : ''}${podiumList}`)
    .setColor('#FF3399')
    .setThumbnail(thumbUrl)
    .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon })
    .setTimestamp();
}

async function showPodium(interaction, slug, isLeague = false) {
  const eventQuery = `
    query EventPodium($slug: String!) {
      event(slug: $slug) {
        name
        tournament {
          name
          images { url type }
        }
        standings(query: { page: 1, perPage: 3 }) {
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
    query LeaguePodium($slug: String!) {
      league(slug: $slug) {
        name
        images { url type }
        standings(query: { page: 1, perPage: 3 }) {
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

  const embed = await getPodiumEmbed(isLeague ? data.data.league : data.data.event, `https://start.gg/${slug}`, isLeague);
  await interaction.editReply({ content: null, embeds: [embed], components: [] });
}

module.exports = {
  name: 'podium',
  description: 'Show only the top 3 placements for an event',
  async executeSlash(interaction, client) {
    const url = interaction.options.getString('url');
    if (!url) return interaction.reply('Please provide an event or league URL.');

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
          return await showPodium(interaction, slug, isLeague);
        }

        const events = isLeague
          ? discoveryData.data.league.events.nodes
          : discoveryData.data.tournament.events;

        if (events.length === 0) {
          return await showPodium(interaction, slug, isLeague);
        }

        if (events.length === 1 && !isLeague) {
          return showPodium(interaction, events[0].slug, false);
        }

        const options = events.slice(0, 24).map(e => ({
          label: e.name.slice(0, 100),
          value: e.slug
        }));

        // For Leagues, add "Overall League Rankings"
        if (isLeague) {
          options.unshift({
            label: '🏆 Overall League Rankings',
            value: `LEAGUE:${discoverySlug}`
          });
        }

        const row = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('select_podium_event')
              .setPlaceholder('Select an event to view podium')
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
            await showPodium(interaction, i.values[0].split(':')[1], true);
          } else {
            await showPodium(interaction, i.values[0], false);
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

      await showPodium(interaction, slug, isLeague);

    } catch (error) {
      console.error(error);
      await interaction.editReply('There was an error processing your request.');
    }
  }
};
