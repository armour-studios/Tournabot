const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { queryAPI, footerIcon, extractSlug } = require('../functions');
const leagueModel = require('../database/models/league');

module.exports = {
    name: 'league',
    description: 'Manage automated tournament & league announcements.',
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
                // Use extractSlug for robust parsing
                const discoverySlug = extractSlug(url);

                if (!discoverySlug) return interaction.reply({ content: 'Invalid URL. Please provide a valid start.gg URL.', ephemeral: true });

                await interaction.deferReply();

                // Extract core slug (remove type prefixes if present for consistency, though fetchEntity might handle them)
                // Existing logic stored "league/slug" or "tournament/slug"?
                // Looking at lines 61, it stores 'league' or 'tournament' in distinct field.
                // It stores `slug: coreSlug`.

                // Let's normalize. extractSlug returns "type/slug".
                // We want just the "slug" part for the DB if that's how it was done, 
                // OR we accept "type/slug" if the new functions expect it.
                // Line 46/47 queryAPI uses `slug: coreSlug` with `league(slug: $slug)`. 
                // Start.gg API expects just the slug part (e.g. "rlcs-21-22") NOT "league/rlcs-21-22".

                const parts = discoverySlug.split('/');
                const coreSlug = parts.length > 1 ? parts[1] : parts[0];
                const isLeague = discoverySlug.startsWith('league/') || url.includes('/league/');

                // Check if already linked
                const existing = await leagueModel.findOne({ guildid: guildID, slug: coreSlug });
                if (existing) {
                    return interaction.editReply(`**${coreSlug}** is already linked to this server.`);
                }

                // Validation query
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
                        .setFooter({ text: 'NE Network', iconURL: footerIcon });

                    await interaction.editReply({ embeds: [embed] });

                } catch (err) {
                    console.error(err);
                    await interaction.editReply('An error occurred while linking.');
                }

            } else if (subcommand === 'unlink') {
                const urlOrSlug = interaction.options.getString('url_or_slug');
                const extracted = extractSlug(urlOrSlug);
                // Fallback to raw input if extractSlug returns null (maybe they typed just "slug")
                const rawSlug = extracted || urlOrSlug;

                // Remove prefixes if present to get core slug
                const parts = rawSlug.split('/');
                const coreSlug = parts.length > 1 ? parts[1] : parts[0];

                const result = await leagueModel.findOneAndDelete({ guildid: guildID, slug: coreSlug });

                if (result) {
                    await interaction.reply(`Successfully unlinked **${result.name || coreSlug}**.`);
                } else {
                    await interaction.reply({ content: `Could not find **${coreSlug}** linked to this server.`, ephemeral: true });
                }

            } else if (subcommand === 'schedule') {
                const urlOrSlug = interaction.options.getString('url_or_slug');
                const intervalsStr = interaction.options.getString('hours_before');

                // Parse intervals
                const intervals = intervalsStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0).sort((a, b) => b - a);

                if (intervals.length === 0) {
                    return interaction.reply({ content: 'Please provide valid comma-separated hours (e.g. `24, 1`)', ephemeral: true });
                }

                // Extract slug
                const extracted = extractSlug(urlOrSlug);
                const rawSlug = extracted || urlOrSlug;
                const parts = rawSlug.split('/');
                const coreSlug = parts.length > 1 ? parts[1] : parts[0];

                const leagueDoc = await leagueModel.findOne({ guildid: guildID, slug: coreSlug });
                if (!leagueDoc) {
                    return interaction.reply({ content: `Could not find **${coreSlug}** linked to this server.`, ephemeral: true });
                }

                leagueDoc.announcementSettings = intervals;
                // Reset announced history for this league so new intervals can trigger?
                // Probably safer to keep history, but if they add a new interval (e.g. 0.5h), it should trigger.
                // The loop logic checks `if (sentIntervals.includes(interval)) continue;`
                // So adding new intervals works fine. Removing old ones just stops them.
                await leagueDoc.save();

                const embed = new EmbedBuilder()
                    .setTitle('🕒 Schedule Updated')
                    .setDescription(`Announcement schedule for **${leagueDoc.name || coreSlug}** has been updated.`)
                    .addFields({ name: 'New Intervals', value: intervals.map(h => `${h} hours before`).join('\n') })
                    .setColor('#36FF7D')
                    .setFooter({ text: 'NE Network', iconURL: footerIcon });

                await interaction.reply({ embeds: [embed] });
            } else if (subcommand === 'list') {
                const links = await leagueModel.find({ guildid: guildID });

                if (links.length === 0) {
                    return interaction.reply('No leagues or tournaments are currently linked to this server.');
                }

                const embed = new EmbedBuilder()
                    .setTitle('📋 Linked Leagues & Tournaments')
                    .setColor('#FF3399')
                    .setDescription(links.map(l => {
                        const intervals = l.announcementSettings && l.announcementSettings.length > 0 ? l.announcementSettings.join(', ') + 'h' : 'Default (168, 72, 24, 1h)';
                        return `• **${l.name || l.slug}** \`(${l.type})\`\n  └ Schedule: ${intervals}`;
                    }).join('\n'))
                    .setFooter({ text: 'NE Network', iconURL: footerIcon });

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
