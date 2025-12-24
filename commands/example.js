const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { queryAPI, sendMessage } = require('../functions');

module.exports = {
  name: 'example',
  description: 'An example slash command template',
  // Standard execute for legacy prefix support (optional)
  async execute(message, client) {
    // You can call executeSlash by mocking an interaction if needed
    // return this.executeSlash(mockInteraction, client);
    message.reply('This command only supports slash commands!');
  },
  // Modern executeSlash for Discord v14 Slash Commands
  async executeSlash(interaction, client) {
    // Example of getting an option
    // const value = interaction.options.getString('input');

    await interaction.reply({
      content: 'This is an example slash command response.',
      ephemeral: true
    });
  },
};
