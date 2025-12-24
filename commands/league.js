const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { queryAPI } = require('../functions');
const leagueModel = require('../database/models/league');

module.exports = {
    name: 'league',
    description: 'Manage automated league announcements.',
    async autocomplete(interaction, client) {
        const focusedValue = interaction.options.getFocused();
        const leagues = await leagueModel.find({ guildid: interaction.guild.id });
        const choices = leagues.map(l => ({ name: l.slug, value: l.slug }));
        const filtered = choices.filter(choice => choice.name.startsWith(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25)
        );
    },
    async executeSlash(interaction, client) {
        if (!interaction.guild) return interaction.reply('This command can only be used in a server.');
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You do not have the permissions for that :sob:', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const guildID = interaction.guild.id;

        if (subcommand === 'link') {
            const url = interaction.options.getString('url');
            let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').replace('league/', '').split('/')[0];

            // Input validation helper (very basic)
            if (!slug) return interaction.reply({ content: 'Invalid URL. Please provide a valid start.gg league URL.', ephemeral: true });

            await interaction.deferReply();

            // Check if already linked
            const existing = await leagueModel.findOne({ guildid: guildID, slug: slug });
            if (existing) {
                return interaction.editReply(`**${slug}** is already linked to this server.`);
            }

            // Verify with Start.gg API
            const query = `query LeagueCheck($slug: String) {
        league(slug: $slug) {
          id
          name
          url
        }
      }`;

            try {
                const data = await queryAPI(query, { slug });
                if (!data || !data.data || !data.data.league) {
                    return interaction.editReply('Could not find a league with that URL. Please make sure it is a valid start.gg League.');
                }

                const leagueName = data.data.league.name;

                // Save to DB
                await new leagueModel({
                    guildid: guildID,
                    slug: slug,
                    lastAnnouncedTournamentId: 0
                }).save();

                await interaction.editReply(`Successfully linked **${leagueName}**! Future tournaments in this league will be automatically announced.`);

            } catch (err) {
                console.error(err);
                await interaction.editReply('An error occurred while linking the league.');
            }

        } else if (subcommand === 'unlink') {
            const url = interaction.options.getString('url');
            let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').replace('league/', '').split('/')[0];

            if (!slug) return interaction.reply({ content: 'Invalid URL or slug.', ephemeral: true });

            const result = await leagueModel.findOneAndDelete({ guildid: guildID, slug: slug });

            if (result) {
                await interaction.reply(`Successfully unlinked **${slug}**.`);
            } else {
                await interaction.reply({ content: `Could not find **${slug}** linked to this server.`, ephemeral: true });
            }

        } else if (subcommand === 'list') {
            const leagues = await leagueModel.find({ guildid: guildID });

            if (leagues.length === 0) {
                return interaction.reply('No leagues are currently linked to this server.');
            }

            const embed = new EmbedBuilder()
                .setTitle('Linked Leagues')
                .setColor('#222326')
                .setDescription(leagues.map(l => `• [${l.slug}](https://start.gg/league/${l.slug})`).join('\n'))
                .setFooter({ text: 'TournaBot', iconURL: 'https://i.imgur.com/gUwhkw3.png' });

            await interaction.reply({ embeds: [embed] });
        }
    },
};
