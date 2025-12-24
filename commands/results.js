// Dependencies
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const characters = require('../database/character_codes.json');
const characterfile = new Map(Object.entries(characters));
const { Vibrant } = require('node-vibrant/node');
const replaceall = require('replaceall');
const { convertEpoch, queryAPI } = require('../functions');

// MongoDB Models
const accountModel = require('../database/models/account');
const timezoneModel = require('../database/models/timezone');

module.exports = {
  name: 'results',
  description: 'Show user-specific tournament results.',
  async execute(message, client) {
    const args = message.content.split(' ').slice(1);
    const mockInteraction = {
      options: {
        getString: (name) => args[0] || null
      },
      user: message.author,
      member: message.member,
      channel: message.channel,
      reply: async (content) => message.reply(content),
      editReply: async (content) => message.edit(content),
      deferReply: async () => { },
      isChatInputCommand: () => false,
      guildId: message.guild ? message.guild.id : null,
    };
    return this.executeSlash(mockInteraction, client);
  },
  async executeSlash(interaction, client) {
    const userInput = interaction.options.getString('user');
    const user = interaction.user || interaction.author;
    let userslug;

    if (userInput) {
      const cleanId = userInput.replace(/[<@!>]/g, '');
      const result = await accountModel.findOne({ $or: [{ discordid: cleanId }, { discordtag: userInput }] });
      if (result) {
        userslug = result.profileslug;
      } else {
        return interaction.reply({ content: `I could not find ${userInput} in my database. They need to link their account first!`, ephemeral: true });
      }
    } else {
      const result = await accountModel.findOne({ discordid: user.id });
      if (result) {
        userslug = result.profileslug;
      } else {
        return interaction.reply({ content: `Your account is not linked! Use \`/account link\` to link it.`, ephemeral: true });
      }
    }

    if (interaction.deferReply) await interaction.deferReply();

    try {
      const userInfoQuery = `query PlayerInfo($slug: String) {
                user(slug: $slug) {
                  images { url height width }
                  player { id gamerTag }
                }
            }`;
      const userInfo = await queryAPI(userInfoQuery, { slug: userslug });
      if (!userInfo || !userInfo.data || !userInfo.data.user) {
        const msg = 'Could not find start.gg information for this user.';
        return interaction.editReply ? interaction.editReply(msg) : interaction.reply(msg);
      }

      const name = userInfo.data.user.player.gamerTag;
      const playerIds = userInfo.data.user.player.id;
      let imageurl = userInfo.data.user.images[0]?.url || null;

      const guildID = interaction.guildId || (interaction.channel ? interaction.channel.id : null);
      const tzResult = await timezoneModel.findOne({ guildid: guildID });
      const cityTimezone = tzResult ? tzResult.timezone : 'America/Los_Angeles';

      let tournaments = [];
      let page = 1;

      while (tournaments.length < 3 && page < 5) {
        const resultsQuery = `query Results($page: Int, $slug: String, $playerIds: ID) {
                    user(slug: $slug) {
                      tournaments(query: {page: $page, perPage: 3, filter: { past: true }}) {
                        nodes {
                          slug startAt name isOnline numAttendees
                          images { url }
                          events {
                            name numEntrants
                            sets(sortType: RECENT, filters: { playerIds: [$playerIds] }) {
                              nodes {
                                id
                                fullRoundText displayScore winnerId
                                event { name }
                                slots(includeByes: true) {
                                  entrant { 
                                    id name 
                                    standing { placement }
                                    participants { gamerTag player { id } }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                }`;

        const data = await queryAPI(resultsQuery, { page, slug: userslug, playerIds });
        const nodes = data?.data?.user?.tournaments?.nodes;
        if (!nodes) break;

        for (const node of nodes) {
          let setsFound = false;
          let eventInfo = [];
          let setsList = [];

          for (const event of node.events) {
            if (event.sets.nodes.length > 0) setsFound = true;
            for (const set of event.sets.nodes) {
              if (set.displayScore) {
                let formattedScore = replaceall('*', '\\*', set.displayScore);
                formattedScore = replaceall('_', '\\_', formattedScore);
                setsList.push(`**${set.fullRoundText}:** ${formattedScore}`);
              } else {
                setsList.push(`**${set.fullRoundText}:** No score found.`);
              }

              const mySlot = set.slots.find(s => s.entrant?.participants[0]?.player?.id === playerIds);
              if (mySlot && !eventInfo.some(e => e.name === event.name)) {
                eventInfo.push({ name: event.name, placement: mySlot.entrant.standing.placement, total: event.numEntrants });
              }
            }
          }

          if (setsFound && tournaments.length < 3) {
            tournaments.push({
              name: node.name,
              url: `https://start.gg/${node.slug}`,
              date: convertEpoch(node.startAt, cityTimezone),
              stats: eventInfo,
              sets: setsList.slice(0, 5),
              image: node.images && node.images.length > 0 ? node.images[0].url : null
            });
          }
        }
        page++;
      }

      if (tournaments.length === 0) {
        const msg = 'No recent tournament results found for this user.';
        return interaction.editReply ? interaction.editReply(msg) : interaction.reply(msg);
      }

      let sideColor = '#222326';
      if (imageurl) {
        try {
          const vibrant = new Vibrant(imageurl);
          const palette = await vibrant.getPalette();
          if (palette.Vibrant && palette.Vibrant.hex) {
            sideColor = palette.Vibrant.hex;
          }
        } catch (err) {
          console.error("Error getting vibrant color:", err);
        }
      }

      const generateEmbed = (index) => {
        const t = tournaments[index];
        const embed = new EmbedBuilder()
          .setAuthor({ name: `Tournament Results: ${name}`, iconURL: imageurl || footerIcon })
          .setTitle(t.name)
          .setURL(t.url)
          .setColor(sideColor)
          .setThumbnail(t.image || imageurl) // Use tournament thumb if available, else user image
          .addFields(
            { name: '📊 Event Placements', value: t.stats.map(e => `**${e.name}**: ${e.placement}/${e.total}`).join('\n') || 'N/A', inline: false },
            { name: '⚔️ Recent Sets', value: t.sets.join('\n') || 'N/A', inline: false }
          )
          .setFooter({ text: 'Powered by TournaBot', iconURL: footerIcon })
          .setTimestamp();
        return embed;
      };

      let currentIndex = 0;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(tournaments.length <= 1)
      );

      const response = await interaction.editReply({ embeds: [generateEmbed(currentIndex)], components: [row] });

      const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async i => {
        if (i.user.id !== user.id) return i.reply({ content: 'Not your buttons!', ephemeral: true });

        if (i.customId === 'next' && currentIndex < tournaments.length - 1) currentIndex++;
        else if (i.customId === 'prev' && currentIndex > 0) currentIndex--;

        row.components[0].setDisabled(currentIndex === 0);
        row.components[1].setDisabled(currentIndex === tournaments.length - 1);

        await i.update({ embeds: [generateEmbed(currentIndex)], components: [row] });
      });

      collector.on('end', collected => {
        row.components[0].setDisabled(true);
        row.components[1].setDisabled(true);
        if (response.edit) response.edit({ components: [row] }).catch(console.error);
      });

    } catch (error) {
      console.error(error);
      const errorMsg = 'An error occurred while fetching results.';
      if (interaction.editReply) await interaction.editReply(errorMsg);
      else await interaction.reply(errorMsg);
    }
  },
};
