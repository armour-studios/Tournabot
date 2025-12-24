const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { convertEpoch, convertEpochToClock, queryAPI } = require('../functions');

module.exports = {
  name: 'search',
  description: 'Search for upcoming tournaments by game.',
  async execute(message, client) {
    const args = message.content.split(' ').slice(1);
    const mockInteraction = {
      options: {
        getString: (name) => args.join(' ')
      },
      user: message.author,
      channel: message.channel,
      reply: async (content) => message.reply(content),
      editReply: async (content) => message.edit(content),
      isChatInputCommand: () => false
    };
    return this.executeSlash(mockInteraction, client);
  },
  async executeSlash(interaction, client) {
    const gameNameInput = interaction.options.getString('game');
    let videogameId;
    let gameDisplayName;

    if (!gameNameInput) return interaction.reply('Please specify a game to search for.');

    const lowerInput = gameNameInput.toLowerCase();
    if (lowerInput.includes('ultimate') || lowerInput.includes('smash bros')) {
      videogameId = 1386;
      gameDisplayName = 'Super Smash Bros. Ultimate';
    } else if (lowerInput.includes('valorant')) {
      videogameId = 34223;
      gameDisplayName = 'Valorant';
    } else {
      return interaction.reply(`I currently only support searching for **Super Smash Bros. Ultimate** or **Valorant**.`);
    }

    await (interaction.deferReply ? interaction.deferReply() : Promise.resolve());

    const query = `query TournamentsByVideogame($videogameId: ID!) {
      tournaments(query: {
        perPage: 10
        page: 1
        sortBy: "startAt asc"
        filter: {
          upcoming: true
          videogameIds: [$videogameId]
        }
      }) {
        nodes {
          name
          slug
          numAttendees
          startAt
          isOnline
          images { height width url }
          events {
            name
            numEntrants
            startAt
            checkInEnabled
            checkInBuffer
            checkInDuration
          }
          streams {
            streamSource
            streamName
          }
        }
      }
    }`;

    try {
      const data = await queryAPI(query, { videogameId });
      if (!data || !data.data || !data.data.tournaments || data.data.tournaments.nodes.length === 0) {
        return interaction.editReply(`No upcoming **${gameDisplayName}** tournaments found.`);
      }

      const tournaments = data.data.tournaments.nodes;

      const generateEmbed = (index) => {
        const t = tournaments[index];
        const thumb = t.images.find(img => img.height === img.width)?.url || '';
        const banner = t.images.find(img => img.height !== img.width)?.url || '';

        const embed = new EmbedBuilder()
          .setTitle(t.name)
          .setURL(`https://start.gg/${t.slug}`)
          .setColor('#222326')
          .setThumbnail(thumb)
          .setImage(banner)
          .addFields(
            { name: 'Info', value: `${t.numAttendees} Attendees\n${t.isOnline ? 'Online' : 'Offline'}\n${convertEpoch(t.startAt, 'America/Los_Angeles')}`, inline: true },
            { name: 'Events', value: t.events.slice(0, 3).map(e => `\`${e.name}\` (${e.numEntrants} entrants)`).join('\n') || 'N/A', inline: true }
          )
          .setFooter({ text: `Tournament ${index + 1} of ${tournaments.length}`, iconURL: 'https://cdn.discordapp.com/attachments/719461475848028201/777094320531439636/image.png' });

        const twitchStreams = t.streams.filter(s => s.streamSource === 'TWITCH').map(s => `https://twitch.tv/${s.streamName}`);
        if (twitchStreams.length > 0) {
          embed.addFields({ name: 'Streams', value: twitchStreams.join('\n') });
        }

        return embed;
      };

      let currentIndex = 0;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(tournaments.length <= 1)
      );

      const response = await interaction.editReply({ embeds: [generateEmbed(currentIndex)], components: [row] });

      const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

      collector.on('collect', async i => {
        if (i.user.id !== (interaction.user ? interaction.user.id : interaction.author.id)) {
          return i.reply({ content: 'Not your buttons!', ephemeral: true });
        }

        if (i.customId === 'next') currentIndex++;
        else if (i.customId === 'prev') currentIndex--;

        const updatedRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentIndex === 0),
          new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(currentIndex === tournaments.length - 1)
        );

        await i.update({ embeds: [generateEmbed(currentIndex)], components: [updatedRow] });
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply('An error occurred while searching for tournaments.');
    }
  },
};
