// Dependencies
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js');
const { generateHelpSelection, generateAccountsEmbed, generateReminderEmbed, generateResultsEmbed, generateDQPingingEmbed, generateAnnounceEmbed, generateLocalizationEmbed, generateMatchmakingEmbed, generateSearchEmbed, generatePrefixEmbed, generateInfoEmbed } = require('./help_embeds/help_embeds.js');
const { sendMessage } = require('../functions.js');

module.exports = {
  name: 'help',
  description: 'Help command.',
  async execute(message, client) {
    // Legacy message execution (converted to v14 compatible)
    return this.executeSlash(message, client);
  },
  async executeSlash(interaction, client) {
    let currentIndex = 0;

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('next')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Secondary),
      );

    const helpMessage = await (interaction.reply ?
      interaction.reply({ embeds: [generateHelpSelection(currentIndex)], components: [row], fetchReply: true }) :
      interaction.channel.send({ embeds: [generateHelpSelection(currentIndex)], components: [row] }));

    const collector = helpMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

    collector.on('collect', async i => {
      if (i.user.id !== (interaction.user ? interaction.user.id : interaction.author.id)) {
        return i.reply({ content: 'Only the user who requested help can use these buttons.', ephemeral: true });
      }

      if (i.customId === 'next') {
        if (currentIndex < 1) currentIndex++;
      } else if (i.customId === 'prev') {
        if (currentIndex > 0) currentIndex--;
      }

      await i.update({ embeds: [generateHelpSelection(currentIndex)], components: [row] });
    });
  }
};
