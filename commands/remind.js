const { EmbedBuilder } = require('discord.js');
const { footerIcon } = require('../functions');

// MongoDB Models
const accountModel = require('../database/models/account');

module.exports = {
  name: 'remind',
  description: 'Toggle tournament reminders.',
  async execute(message, client) {
    const mockInteraction = {
      user: message.author,
      channel: message.channel,
      reply: async (content) => message.reply(content),
      isChatInputCommand: () => false
    };
    return this.executeSlash(mockInteraction, client);
  },
  async executeSlash(interaction, client) {
    const user = interaction.user || interaction.author;

    try {
      const result = await accountModel.findOne({ discordid: user.id });
      if (!result) {
        return interaction.reply({
          content: 'Tournament reminders require you to have your Discord and start.gg account linked. Link your account with `/account link url:<your-profile-url>`.',
          ephemeral: true
        });
      }

      const newStatus = !result.reminder;
      await accountModel.updateOne({ discordid: user.id }, { reminder: newStatus });

      const embed = new EmbedBuilder()
        .setColor(newStatus ? '#43b581' : '#f04747')
        .setTitle('Tournament Reminders')
        .setDescription(`Your tournament reminders have been toggled **${newStatus ? 'ON' : 'OFF'}**!`)
        .setFooter({ text: 'NE Network', iconURL: footerIcon });

      await interaction.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'There was an error updating your reminder status.', ephemeral: true });
    }
  },
};
