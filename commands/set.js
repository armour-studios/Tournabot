const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// MongoDB Models
const channelModel = require('../database/models/channel');
const announcemessageModel = require('../database/models/announcemessage');
const pingroleModel = require('../database/models/pingrole');
const timezoneModel = require('../database/models/timezone');
const languageModel = require('../database/models/language');

module.exports = {
  name: 'set',
  description: 'Configure bot settings for the server.',
  async execute(message, client) {
    // Basic legacy wrapper
    const args = message.content.split(' ').slice(1);
    const mockInteraction = {
      options: {
        getSubcommand: () => args[0],
        getString: () => args.slice(1).join(' '),
        getChannel: () => message.mentions.channels.first(),
        getRole: () => message.mentions.roles.first()
      },
      user: message.author,
      guild: message.guild,
      member: message.member,
      channel: message.channel,
      reply: async (content) => message.reply(content),
      isChatInputCommand: () => false
    };
    return this.executeSlash(mockInteraction, client);
  },
  async executeSlash(interaction, client) {
    if (!interaction.guild) return interaction.reply('Settings can only be configured in a server.');
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'You do not have the permissions for that :sob:', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildID = interaction.guild.id;

    switch (subcommand) {
      case 'announcemessage':
        const msg = interaction.options.getString('message');
        try {
          if (!msg) {
            await announcemessageModel.findOneAndDelete({ guildid: guildID });
            await interaction.reply('Announcement message has been reset to default.');
          } else {
            await announcemessageModel.findOneAndUpdate({ guildid: guildID }, { announcemessage: msg }, { upsert: true });
            await interaction.reply(`Announcement message updated to: \n> ${msg}`);
          }
        } catch (err) {
          console.error(err);
          await interaction.reply('Error updating announcement message.');
        }
        break;

      case 'announcechannel':
        const channel = interaction.options.getChannel('channel');
        if (!channel) return interaction.reply('Please specify a channel.');
        try {
          await channelModel.findOneAndUpdate({ guildid: guildID }, { channelid: channel.id }, { upsert: true });
          await interaction.reply(`Announcement channel set to ${channel} :white_check_mark:`);
        } catch (err) {
          console.error(err);
          await interaction.reply('Error setting announcement channel.');
        }
        break;

        break;

      case 'dqpingchannel':
        const dqChannel = interaction.options.getChannel('channel');
        if (!dqChannel) return interaction.reply('Please specify a channel.');
        try {
          await channelModel.findOneAndUpdate({ guildid: `${guildID}dq` }, { channelid: dqChannel.id }, { upsert: true });
          await interaction.reply(`DQ pinging channel set to ${dqChannel} :white_check_mark:`);
        } catch (err) {
          console.error(err);
          await interaction.reply('Error setting DQ pinging channel.');
        }
        break;

      case 'matchfeed':
        const mfChannel = interaction.options.getChannel('channel');
        if (!mfChannel) return interaction.reply('Please specify a channel.');
        try {
          await channelModel.findOneAndUpdate({ guildid: guildID }, { matchfeedchannel: mfChannel.id }, { upsert: true });
          await interaction.reply(`Live Match Feed channel set to ${mfChannel} :white_check_mark:`);
        } catch (err) {
          console.error(err);
          await interaction.reply('Error setting Match Feed channel.');
        }
        break;

      case 'standingschannel':
        const stChannel = interaction.options.getChannel('channel');
        if (!stChannel) return interaction.reply('Please specify a channel.');
        try {
          await channelModel.findOneAndUpdate({ guildid: guildID }, { standingschannel: stChannel.id }, { upsert: true });
          await interaction.reply(`Auto-Standings channel set to ${stChannel} :white_check_mark:`);
        } catch (err) {
          console.error(err);
          await interaction.reply('Error setting Standings channel.');
        }
        break;

      case 'pingrole':
        const role = interaction.options.getRole('role');
        try {
          if (!role) {
            await pingroleModel.findOneAndDelete({ guildid: guildID });
            await interaction.reply('Announcement ping role has been reset (defaults to @everyone).');
          } else {
            await pingroleModel.findOneAndUpdate({ guildid: guildID }, { role: role.id }, { upsert: true });
            await interaction.reply(`Announcement ping role set to ${role} :white_check_mark:`);
          }
        } catch (err) {
          console.error(err);
          await interaction.reply('Error updating ping role.');
        }
        break;

      case 'timezone':
        const tz = interaction.options.getString('city');
        const supported = ['America/Los_Angeles', 'America/Phoenix', 'America/Denver', 'America/Regina', 'America/Chicago', 'America/New_York', 'Pacific/Honolulu'];
        if (tz && !supported.includes(tz)) {
          return interaction.reply(`Unsupported timezone. Supported: \`${supported.join(', ')}\``);
        }
        try {
          if (!tz) {
            await timezoneModel.findOneAndDelete({ guildid: guildID });
            await interaction.reply('Timezone reset to default (America/Los_Angeles).');
          } else {
            await timezoneModel.findOneAndUpdate({ guildid: guildID }, { timezone: tz }, { upsert: true });
            await interaction.reply(`Timezone set to **${tz}** :white_check_mark:`);
          }
        } catch (err) {
          console.error(err);
          await interaction.reply('Error updating timezone.');
        }
        break;

      case 'language':
        const lang = interaction.options.getString('code');
        if (lang && lang.length !== 2) return interaction.reply('Please use a 2-letter ISO-639-1 language code (e.g., `es`, `fr`).');
        try {
          if (!lang) {
            await languageModel.findOneAndDelete({ guildid: guildID });
            await interaction.reply('Language reset to English.');
          } else {
            await languageModel.findOneAndUpdate({ guildid: guildID }, { language: lang }, { upsert: true });
            await interaction.reply(`Language set to **${lang}** :white_check_mark:`);
          }
        } catch (err) {
          console.error(err);
          await interaction.reply('Error updating language.');
        }
        break;

      default:
        await interaction.reply('Unknown setting. Use one of the subcommands.');
    }
  },
};
