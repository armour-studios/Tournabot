const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } = require('discord.js');
const fetch = require('node-fetch');
const urllib = require('urllib');
const { convertEpoch, convertEpochToClock, fetchEntity, extractSlug, footerIcon, startggIcon } = require('../functions');

// MongoDB Models
const channelModel = require('../database/models/channel');
const announcemessageModel = require('../database/models/announcemessage');
const pingroleModel = require('../database/models/pingrole');
const timezoneModel = require('../database/models/timezone');
const languageModel = require('../database/models/language');

module.exports = {
  name: 'announce',
  description: 'Announce tournaments with event information.',
  async execute(message, client) {
    const args = message.content.split(' ').slice(1);
    const mockInteraction = {
      options: {
        getString: (name) => {
          if (name === 'url') return args[0];
          if (name === 'ping') return args[1];
          return null;
        }
      },
      user: message.author,
      guild: message.guild,
      member: message.member,
      channel: message.channel,
      reply: async (content) => message.reply(content),
      editReply: async (content) => message.edit(content),
      isChatInputCommand: () => false
    };
    return this.executeSlash(mockInteraction, client);
  },
  async executeSlash(interaction, client) {
    if (!interaction.guild) return interaction.reply('I cannot run this command in DMs.');
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'You do not have the permissions for that :sob:', ephemeral: true });
    }

    const tournamentUrl = interaction.options.getString('url');
    const pingOption = interaction.options.getString('ping') || 'no';

    if (!tournamentUrl) return interaction.reply('Please provide a tournament URL.');

    await (interaction.deferReply ? interaction.deferReply() : Promise.resolve());

    const guildID = interaction.guild.id;
    const channelResult = await channelModel.findOne({ guildid: guildID });
    if (!channelResult) return interaction.editReply('There is no announcement channel set. Use `/set announcechannel` to set one.');

    const announceChannel = client.channels.cache.get(channelResult.channelid);
    if (!announceChannel) return interaction.editReply('I could not find the announcement channel. Please re-set it.');

    try {
      const entity = await fetchEntity(extractSlug(tournamentUrl));

      if (!entity || entity.type !== 'tournament') {
        return interaction.editReply('I could not find the specified tournament.');
      }

      const tournament = entity;
      const tzResult = await timezoneModel.findOne({ guildid: guildID });
      const cityTimezone = tzResult ? tzResult.timezone : 'America/Los_Angeles';

      const eventsInfo = tournament.events.map(event => {
        let info = `**${event.name}** - <t:${event.startAt}:F>`;
        if (event.checkInEnabled) {
          const openTime = event.startAt - event.checkInBuffer - event.checkInDuration;
          const closeTime = event.startAt - event.checkInBuffer;
          info += `\nCheck-in: <t:${openTime}:t> - <t:${closeTime}:t>`;
        }
        return info;
      }).join('\n\n');

      const streams = tournament.streams
        ? tournament.streams
          .filter(s => s.streamSource === 'TWITCH')
          .map(s => `https://twitch.tv/${s.streamName}`)
          .join('\n')
        : '';

      const announceMessageResult = await announcemessageModel.findOne({ guildid: guildID });
      let announceText = announceMessageResult ? announceMessageResult.announcemessage : `The registration for **${tournament.name}** is up:`;

      const pingRoleResult = await pingroleModel.findOne({ guildid: guildID });
      const pingingRole = pingRoleResult ? `<@&${pingRoleResult.role}>` : '@everyone';

      const embed = new EmbedBuilder()
        .setTitle(tournament.name)
        .setURL(tournament.url.startsWith('http') ? tournament.url : `https://start.gg/${tournament.url}`)
        .setColor('#FF3399')
        .setDescription(`${announceText}`)
        .addFields(
          { name: '📅 Registration Closes', value: `<t:${tournament.registrationClosesAt}:F> (<t:${tournament.registrationClosesAt}:R>)`, inline: true },
          { name: '📍 Status', value: 'Open', inline: true },
          { name: '🏆 Events', value: eventsInfo || 'No events listed.' }
        )
        .setImage(tournament.images?.find(i => i.type === 'banner')?.url || tournament.images?.[0]?.url)
        .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon })
        .setTimestamp();

      if (streams) embed.addFields({ name: '📺 Streams', value: streams });

      let finalContent = pingOption === 'ping' ? pingingRole : '';

      // Localization Check
      const langResult = await languageModel.findOne({ guildid: guildID });
      if (langResult && langResult.language !== 'en') {
        // Translation logic...
      }

      await announceChannel.send({ content: finalContent, embeds: [embed] });
      await interaction.editReply(`Announced in ${announceChannel}.`);
      console.log(`announced in ${interaction.guild.name}`);

    } catch (error) {
      console.error(error);
      await interaction.editReply('An error occurred while fetching tournament data.');
    }
  },
};
