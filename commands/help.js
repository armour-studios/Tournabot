// Dependencies
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js');
const { generateHelpSelection, generateAccountsEmbed, generateReminderEmbed, generateResultsEmbed, generateDQPingingEmbed, generateAnnounceEmbed, generateLocalizationEmbed, generateMatchmakingEmbed, generateSearchEmbed, generatePrefixEmbed, generateInfoEmbed, generateScrimEmbed, generateBroadcastEmbed, generateLeagueHelpEmbed } = require('./help_embeds/help_embeds.js');
const { sendMessage } = require('../functions.js');

module.exports = {
  name: 'help',
  description: 'Help command.',
  async execute(message, client) {
    // Legacy message execution (converted to v14 compatible)
    return this.executeSlash(message, client);
  },
  async executeSlash(interaction, client) {
    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Select a category to view')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Accounts').setValue('accounts').setDescription('Linking and status commands').setEmoji('👤'),
        new StringSelectMenuOptionBuilder().setLabel('Teams & Scrims').setValue('scrim').setDescription('Team management and matchmaking').setEmoji('🎮'),
        new StringSelectMenuOptionBuilder().setLabel('Global Broadcasts').setValue('broadcast').setDescription('Cross-server announcements').setEmoji('🌐'),
        new StringSelectMenuOptionBuilder().setLabel('Tournament Reminders').setValue('reminders').setDescription('Automatic reminders setup').setEmoji('⏰'),
        new StringSelectMenuOptionBuilder().setLabel('DQ Pinging').setValue('dq').setDescription('Automatic match calling setup').setEmoji('📢'),
        new StringSelectMenuOptionBuilder().setLabel('Tournament Announcing').setValue('announce').setDescription('Announcing tournaments').setEmoji('📣'),
        new StringSelectMenuOptionBuilder().setLabel('Leagues').setValue('league').setDescription('League and tournament tracking').setEmoji('🏆'),
        new StringSelectMenuOptionBuilder().setLabel('Localization').setValue('localization').setDescription('Timezones and languages').setEmoji('🌍'),
        new StringSelectMenuOptionBuilder().setLabel('Tournament Searching').setValue('search').setDescription('Finding tournaments').setEmoji('🔍'),
        new StringSelectMenuOptionBuilder().setLabel('More Info').setValue('info').setDescription('Support and contact info').setEmoji('ℹ️'),
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const linkRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Support Server').setStyle(ButtonStyle.Link).setURL('https://discord.com/invite/G9uMk2N9bY').setEmoji('🆘')
    );

    const helpMessage = await (interaction.reply ?
      interaction.reply({ embeds: [generateHelpSelection(0)], components: [row, linkRow], fetchReply: true, ephemeral: true }) :
      interaction.channel.send({ embeds: [generateHelpSelection(0)], components: [row, linkRow] }));

    const collector = helpMessage.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });

    collector.on('collect', async i => {
      // Check if the user is the one who ran the command
      if (i.user.id !== (interaction.user ? interaction.user.id : interaction.author.id)) {
        return i.reply({ content: 'Only the user who requested help can use this menu.', ephemeral: true });
      }

      const value = i.values[0];
      let embed;

      switch (value) {
        case 'accounts': embed = generateAccountsEmbed(0); break;
        case 'scrim': embed = generateScrimEmbed(0); break;
        case 'broadcast': embed = generateBroadcastEmbed(0); break;
        case 'reminders': embed = generateReminderEmbed(0); break;
        case 'dq': embed = generateDQPingingEmbed(0); break;
        case 'announce': embed = generateAnnounceEmbed(0); break;
        case 'league': embed = generateLeagueHelpEmbed(0); break;
        case 'localization': embed = generateLocalizationEmbed(0); break;
        case 'search': embed = generateSearchEmbed(0); break;
        case 'info': embed = generateInfoEmbed(0); break;
        default: embed = generateHelpSelection(0);
      }

      await i.update({ embeds: [embed], components: [row] });
    });
  }
};
