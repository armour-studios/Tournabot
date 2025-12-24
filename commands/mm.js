const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// MongoDB Models
const mmuserModel = require('../database/models/mmuser');
const mmroleModel = require('../database/models/mmrole');

module.exports = {
  name: 'mm',
  description: 'Improved role-based matchmaking.',
  async execute(message, client) {
    const args = message.content.split(' ').slice(1);
    const mockInteraction = {
      options: {
        getSubcommand: () => args[0],
        getRole: (name) => {
          const potentialRole = args[1]?.replace(/[<@&>]/g, '');
          return message.guild.roles.cache.get(potentialRole) || message.guild.roles.cache.find(r => r.name === args.slice(1).join(' '));
        },
        getString: (name) => args[1] // For cases where they might type role name
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
    if (!interaction.guild) return interaction.reply('I cannot run this command in DMs.');
    const subcommand = interaction.options.getSubcommand();
    const guildID = interaction.guild.id;

    switch (subcommand) {
      case 'set':
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'You do not have the permissions for that :sob:', ephemeral: true });
        }
        const role = interaction.options.getRole('role');
        if (!role) return interaction.reply('Please specify a role to set for matchmaking.');

        try {
          await mmroleModel.findOneAndUpdate(
            { guildid: guildID },
            { role: role.id },
            { upsert: true, new: true }
          );
          await interaction.reply(`The matchmaking role has been set to ${role} :white_check_mark:`);
        } catch (err) {
          console.error(err);
          await interaction.reply('There was an error setting the matchmaking role.');
        }
        break;

      case 'on':
        try {
          const mmRoleData = await mmroleModel.findOne({ guildid: guildID });
          if (!mmRoleData) return interaction.reply('There is no matchmaking role set. Admins can use `/mm set` to set one.');

          const mmRole = interaction.guild.roles.cache.get(mmRoleData.role);
          if (!mmRole) return interaction.reply('The configured matchmaking role no longer exists. Please re-set it.');

          if (!interaction.member.roles.cache.has(mmRole.id)) {
            return interaction.reply(`You do not have the **${mmRole.name}** role.`);
          }

          const userData = await mmuserModel.findOne({ roleid: mmRole.id });
          let userList = userData ? userData.activeusers : [];

          if (userList.includes(`<@${interaction.user.id}>`)) {
            return interaction.reply('You are already online for matchmaking.');
          }

          userList.push(`<@${interaction.user.id}>`);
          await mmuserModel.findOneAndUpdate(
            { roleid: mmRole.id },
            { activeusers: userList },
            { upsert: true }
          );

          await interaction.reply(`You are now online for **${mmRole.name}**!`);
        } catch (err) {
          console.error(err);
          await interaction.reply('There was an error going online.');
        }
        break;

      case 'off':
        try {
          const mmRoleData = await mmroleModel.findOne({ guildid: guildID });
          if (!mmRoleData) return interaction.reply('There is no matchmaking role set.');

          const mmRole = interaction.guild.roles.cache.get(mmRoleData.role);
          const userData = await mmuserModel.findOne({ roleid: mmRoleData.role });

          if (!userData || !userData.activeusers.includes(`<@${interaction.user.id}>`)) {
            return interaction.reply(`You are not currently online for matchmaking.`);
          }

          const newList = userData.activeusers.filter(u => u !== `<@${interaction.user.id}>`);
          await mmuserModel.updateOne({ roleid: mmRoleData.role }, { activeusers: newList });

          await interaction.reply(`You are now offline for **${mmRole ? mmRole.name : 'matchmaking'}**!`);
        } catch (err) {
          console.error(err);
          await interaction.reply('There was an error going offline.');
        }
        break;

      case 'list':
        try {
          const mmRoleData = await mmroleModel.findOne({ guildid: guildID });
          if (!mmRoleData) return interaction.reply('There is no matchmaking role set.');

          const mmRole = interaction.guild.roles.cache.get(mmRoleData.role);
          const userData = await mmuserModel.findOne({ roleid: mmRoleData.role });
          const userList = userData ? userData.activeusers : [];

          const embed = new EmbedBuilder()
            .setTitle('Matchmaking')
            .setColor('#222326')
            .setDescription(`**Role:** ${mmRole ? mmRole : 'Deleted Role'}\n**Online for Matchmaking:**\n${userList.length > 0 ? userList.join('\n') : '*None*'}`)
            .setFooter({ text: 'ArmourBot', iconURL: footerIcon });

          await interaction.reply({ embeds: [embed] });
        } catch (err) {
          console.error(err);
          await interaction.reply('There was an error fetching the matchmaking list.');
        }
        break;

      case 'ping':
        try {
          const mmRoleData = await mmroleModel.findOne({ guildid: guildID });
          if (!mmRoleData) return interaction.reply('There is no matchmaking role set.');

          const mmRole = interaction.guild.roles.cache.get(mmRoleData.role);
          if (!mmRole) return interaction.reply('The configured matchmaking role no longer exists.');

          if (!interaction.member.roles.cache.has(mmRole.id)) {
            return interaction.reply(`You do not have the **${mmRole.name}** role.`);
          }

          const userData = await mmuserModel.findOne({ roleid: mmRole.id });
          const userList = userData ? userData.activeusers : [];

          if (userList.length === 0) {
            return interaction.reply(`No one is currently online for **${mmRole.name}**.`);
          }

          await interaction.channel.send(userList.join(' ')).then(m => setTimeout(() => m.delete().catch(() => { }), 1000));
          await interaction.reply(`\`\`\`yaml\n@${mmRole.name}\n\`\`\``);
        } catch (err) {
          console.error(err);
          await interaction.reply('There was an error pinging for matchmaking.');
        }
        break;

      default:
        await interaction.reply('Unknown subcommand. Use `set`, `on`, `off`, `list`, or `ping`.');
    }
  },
};
