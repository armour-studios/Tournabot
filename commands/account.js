// Dependencies
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { SMASHGGTOKEN } = process.env;
const fetch = require('node-fetch');
const urllib = require('urllib');
const replaceall = require('replaceall');
const { sendMessage, queryAPI } = require('../functions');

// MongoDB Models
const accountModel = require('../database/models/account');

module.exports = {
  name: 'account',
  description: 'Linking, unlinking, and status for accounts.',
  async execute(message, client) {
    // Basic legacy wrapper for message-based calls
    const args = message.content.split(' ').slice(1);
    const mockInteraction = {
      options: {
        getString: (name) => {
          if (name === 'action') return args[0];
          if (name === 'url') return args[1];
          return null;
        }
      },
      user: message.author,
      channel: message.channel,
      reply: (content) => message.reply(content),
      editReply: (content) => message.edit(content),
      isChatInputCommand: () => false
    };
    return this.executeSlash(mockInteraction, client);
  },
  async executeSlash(interaction, client) {
    const action = interaction.options.getString('action') || 'status';
    const url = interaction.options.getString('url');

    const user = interaction.user || interaction.author;

    switch (action) {
      case 'link':
        if (!url) {
          return interaction.reply('Please provide your smash.gg profile URL. Format: `/account link url:https://smash.gg/user/your-profile`');
        }
        let accountSlug = url;
        if (accountSlug.startsWith('https://smash.gg/user/')) {
          accountSlug = replaceall('/', '', accountSlug);
          accountSlug = accountSlug.replace('https:smash.gguser', '');
          let discordID = user.id;
          let discordTag = user.tag;

          try {
            const result = await accountModel.find({ discordid: discordID });
            if (result.length) {
              await accountModel.updateOne({ discordid: discordID }, { profileslug: accountSlug });
              await interaction.reply({ content: '**Your accounts have been re-linked!**', ephemeral: true });
            } else {
              await new accountModel({
                discordtag: discordTag,
                discordid: discordID,
                profileslug: accountSlug,
                reminder: false
              }).save();
              await interaction.reply({ content: '**Your Discord account and smash.gg account are now linked!**', ephemeral: true });
            }
            console.log(`linked/re-linked ${discordTag}`);
          } catch (err) {
            console.log(err);
            await interaction.reply({ content: 'There was an error linking your account.', ephemeral: true });
          }
        } else {
          await interaction.reply({ content: 'I could not recognize the profile URL. It should start with `https://smash.gg/user/`', ephemeral: true });
        }
        break;

      case 'unlink':
        try {
          const result = await accountModel.findOneAndDelete({ discordid: user.id });
          if (result) {
            await interaction.reply({ content: '**Your Discord account and smash.gg account have been unlinked.**', ephemeral: true });
            console.log(`unlinked ${user.tag}`);
          } else {
            await interaction.reply({ content: '**Your accounts are not currently linked.**', ephemeral: true });
          }
        } catch (err) {
          console.log(err);
          await interaction.reply({ content: 'There was an error unlinking your account.', ephemeral: true });
        }
        break;

      case 'status':
        const target = url || user.id;

        const checkStatus = async (id, name) => {
          const result = await accountModel.find({ $or: [{ discordid: id }, { discordtag: id }] });
          if (result.length) {
            await interaction.reply(`${name} has linked their accounts! :white_check_mark:`);
          } else {
            await interaction.reply(`${name} does not have their accounts linked :x:`);
          }
        };

        if (!url || (!url.startsWith('https://smash.gg/') && !url.startsWith('https://www.start.gg/') && !url.startsWith('smash.gg/') && !url.startsWith('start.gg/'))) {
          // Assume it's a mention or ID if no URL or not a start.gg URL
          if (!url) {
            await checkStatus(user.id, 'Your Discord account');
          } else {
            const cleanId = url.replace(/[<@!>]/g, '');
            await checkStatus(cleanId, url);
          }
        } else {
          // Tournament/Event status checking
          await interaction.deferReply();

          let slug = url.replace('https://smash.gg/', '').replace('https://www.start.gg/', '').replace('https://start.gg/', '').replace('smash.gg/', '').replace('start.gg/', '').split('?')[0];

          // We need to check if it's a tournament or event slug
          // For simplicity, we'll try to fetch entrants from the event
          // If the link is a tournament link, we might need a different query or user needs to provide event link
          const entrantsQuery = `
          query EventEntrants($slug: String, $page: Int) {
            event(slug: $slug) {
              name
              tournament { name }
              entrants(query: { page: $page, perPage: 50 }) {
                pageInfo { totalPages }
                nodes {
                  name
                  participants {
                    user { slug }
                  }
                }
              }
            }
          }`;

          try {
            const firstPage = await queryAPI(entrantsQuery, { slug, page: 1 });
            if (!firstPage || !firstPage.data || !firstPage.data.event) {
              return interaction.editReply('Could not find event. Make sure you provide a valid event URL (e.g., `https://start.gg/tournament/slug/event/slug`).');
            }

            const event = firstPage.data.event;
            const totalPages = event.entrants.pageInfo.totalPages;
            let allEntrantSlugs = [];

            // Fetch all entrants (limit to 5 pages for safety/performance)
            for (let p = 1; p <= Math.min(totalPages, 5); p++) {
              const pageData = p === 1 ? firstPage : await queryAPI(entrantsQuery, { slug, page: p });
              const nodes = pageData.data.event.entrants.nodes;
              nodes.forEach(node => {
                node.participants.forEach(part => {
                  if (part.user && part.user.slug) {
                    allEntrantSlugs.push(part.user.slug.replace('user/', ''));
                  }
                });
              });
            }

            // Find matching users in database who are also in this server
            // This is a bit expensive if done for every user, so we filter by current guild members' linked accounts
            const linkedAccounts = await accountModel.find({ profileslug: { $in: allEntrantSlugs } });

            // Filter to only include users in the current guild
            let matchingMembers = [];
            if (interaction.guild) {
              for (const acc of linkedAccounts) {
                try {
                  const member = await interaction.guild.members.fetch(acc.discordid);
                  if (member) {
                    matchingMembers.push({ tag: member.user.tag, id: member.id, slug: acc.profileslug });
                  }
                } catch (e) {
                  // Member not in guild
                }
              }
            } else {
              // DM context, just show everyone found
              linkedAccounts.forEach(acc => {
                matchingMembers.push({ tag: acc.discordtag, id: acc.discordid, slug: acc.profileslug });
              });
            }

            if (matchingMembers.length === 0) {
              return interaction.editReply(`No members from this server were found in **${event.tournament.name} - ${event.name}**.`);
            }

            const generateEmbed = (pageIndex) => {
              const itemsPerPage = 10;
              const start = pageIndex * itemsPerPage;
              const end = start + itemsPerPage;
              const pageItems = matchingMembers.slice(start, end);

              const embed = new EmbedBuilder()
                .setTitle(`Members in ${event.name}`)
                .setDescription(`Found ${matchingMembers.length} members from this server:`)
                .setColor('#222326')
                .setURL(url);

              pageItems.forEach(m => {
                embed.addFields({ name: m.tag, value: `[start.gg Profile](https://start.gg/user/${m.slug})`, inline: true });
              });

              embed.setFooter({ text: `Page ${pageIndex + 1} of ${Math.ceil(matchingMembers.length / itemsPerPage)}` });
              return embed;
            };

            let currentPage = 0;
            const maxPages = Math.ceil(matchingMembers.length / 10);

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
              new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(maxPages <= 1)
            );

            const response = await interaction.editReply({ embeds: [generateEmbed(currentPage)], components: [row] });

            if (maxPages > 1) {
              const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

              collector.on('collect', async i => {
                if (i.user.id !== user.id) return i.reply({ content: 'Not your buttons!', ephemeral: true });

                if (i.customId === 'next') currentPage++;
                else if (i.customId === 'prev') currentPage--;

                const newRow = new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                  new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === maxPages - 1)
                );

                await i.update({ embeds: [generateEmbed(currentPage)], components: [newRow] });
              });
            }

          } catch (error) {
            console.error(error);
            await interaction.editReply(`An error occurred while checking tournament status: \`${error.message || error}\``);
          }
        }
        break;

      default:
        await interaction.reply('Unknown action. Use `link`, `unlink`, or `status`.');
    }
  },
};
