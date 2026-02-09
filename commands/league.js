const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { queryAPI, footerIcon, extractSlug } = require('../functions');
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
        try {
            if (!interaction.guild) return interaction.reply('This command can only be used in a server.');
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'You do not have the permissions for that :sob:', ephemeral: true });
            }

            const subcommand = interaction.options.getSubcommand();
            const guildID = interaction.guild.id;

            if (subcommand === 'link') {
                const url = interaction.options.getString('url');
                const discoverySlug = extractSlug(url);
                if (!discoverySlug) return interaction.reply({ content: 'Invalid URL. Please provide a valid start.gg URL.', ephemeral: true });

                await interaction.deferReply();

                // Extract core slug
                const coreSlug = discoverySlug;

                // Check if already linked
                const existing = await leagueModel.findOne({ guildid: guildID, slug: coreSlug });
                if (existing) {
                    return interaction.editReply(`**${coreSlug}** is already linked to this server.`);
                }

                // Validation query
                const isLeague = url.includes('/league/');
                const validationQuery = isLeague
                    ? `query L($slug: String) { league(slug: $slug) { id name } }`
                    : `query T($slug: String) { tournament(slug: $slug) { id name } }`;

                try {
                    const data = await queryAPI(validationQuery, { slug: coreSlug });
                    const entity = isLeague ? data?.data?.league : data?.data?.tournament;

                    if (!entity) {
                        return interaction.editReply(`Could not find a valid ${isLeague ? 'league' : 'tournament'} for slug: **${coreSlug}**`);
                    }

                    await new leagueModel({
                        guildid: guildID,
                        slug: coreSlug,
                        name: entity.name,
                        type: isLeague ? 'league' : 'tournament',
                        lastAnnouncedTournamentId: 0
                    }).save();

                    const embed = new EmbedBuilder()
                        .setTitle('✅ League/Tournament Linked')
                        .setDescription(`Successfully linked **${entity.name}**! New tournaments will be announced automatically in the designated channel.`)
                        .setColor('#36FF7D')
                        .setFooter({ text: 'Armour Studios', iconURL: footerIcon });

                    await interaction.editReply({ embeds: [embed] });

                } catch (err) {
                    console.error(err);
                    await interaction.editReply('An error occurred while linking.');
                }

            } else if (subcommand === 'unlink') {
                const urlOrSlug = interaction.options.getString('url_or_slug');
                let slug = urlOrSlug.replace('https://www.start.gg/', '').replace('https://start.gg/', '').split('?')[0];
                slug = slug.replace('league/', '').replace('tournament/', '').split('/')[0];

                const result = await leagueModel.findOneAndDelete({ guildid: guildID, slug: slug });

                if (result) {
                    await interaction.reply(`Successfully unlinked **${result.name || slug}**.`);
                } else {
                    await interaction.reply({ content: `Could not find **${slug}** linked to this server.`, ephemeral: true });
                }

            } else if (subcommand === 'list') {
                const links = await leagueModel.find({ guildid: guildID });

                if (links.length === 0) {
                    return interaction.reply('No leagues or tournaments are currently linked to this server.');
                }

                const embed = new EmbedBuilder()
                    .setTitle('📋 Linked Leagues & Tournaments')
                    .setColor('#FF3399')
                    .setDescription(links.map(l => `• **${l.name || l.slug}** \`(${l.type})\``).join('\n'))
                    .setFooter({ text: 'Armour Studios', iconURL: footerIcon });

                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('CRITICAL ERROR in league command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(`❌ **Fatal Error:** ${error.message}`);
            } else {
                await interaction.reply({ content: `❌ **Fatal Error:** ${error.message}`, ephemeral: true });
            }
        }
    },
};
