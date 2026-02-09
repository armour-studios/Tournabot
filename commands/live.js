const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { queryAPI, footerIcon, extractSlug } = require('../functions');
const leagueModel = require('../database/models/league');

module.exports = {
    name: 'live',
    description: 'Manage and view live match updates',
    async executeSlash(interaction, client) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const guildID = interaction.guild.id;

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'You do not have the permissions for that :sob:', ephemeral: true });
            }

            if (subcommand === 'link') {
                const url = interaction.options.getString('url');
                const slug = extractSlug(url);
                if (!slug) return interaction.reply({ content: 'Invalid URL. Please provide a valid start.gg URL.', ephemeral: true });

                const isLeague = url.includes('/league/');
                const isEvent = url.toLowerCase().includes('/event/') || url.toLowerCase().includes('/events/');
                const typeHint = isLeague ? 'league' : (isEvent ? 'event' : 'tournament');

                await interaction.deferReply();

                // Extract core slug
                const coreSlug = slug;

                // Check if matchfeed channel is set
                const channelModel = require('../database/models/channel');
                const channels = await channelModel.findOne({ guildid: guildID });
                if (!channels || !channels.matchfeedchannel) {
                    return interaction.editReply(`⚠️ **Warning:** You haven't set a match feed channel yet. Use \`/set matchfeed\` to choose where live scores and dashboards will be posted.`);
                }

                // Check if already linked
                const existing = await leagueModel.findOne({ guildid: guildID, slug: coreSlug });
                if (existing) {
                    return interaction.editReply(`**${coreSlug}** is already linked to this server for live updates.`);
                }

                // Validation query
                let validationQuery = '';
                let type = 'league';

                if (isLeague) {
                    validationQuery = `query L($slug: String) { league(slug: $slug) { id name } }`;
                    type = 'league';
                } else if (isEvent) {
                    validationQuery = `query E($slug: String) { event(slug: $slug) { id name } }`;
                    type = 'event';
                } else {
                    validationQuery = `query T($slug: String) { tournament(slug: $slug) { id name } }`;
                    type = 'tournament';
                }

                try {
                    const data = await queryAPI(validationQuery, { slug: coreSlug });
                    const entity = isLeague ? data?.data?.league : (isEvent ? data?.data?.event : data?.data?.tournament);

                    if (!entity) {
                        return interaction.editReply(`Could not find a ${type} with that URL.`);
                    }

                    await new leagueModel({
                        guildid: guildID,
                        slug: coreSlug,
                        name: entity.name,
                        type: type,
                        lastAnnouncedTournamentId: 0
                    }).save();

                    const embed = new EmbedBuilder()
                        .setTitle('📡 Live Feed Activated')
                        .setDescription(`Successfully linked **${entity.name}**!`)
                        .addFields(
                            { name: '🎙️ Caster Dashboard', value: 'Automatically pinned to the bottom of the feed.' },
                            { name: '🔴 Now Playing', value: 'Live match alerts with real-time scores.' },
                            { name: '✅ Match Results', value: 'Instant results when games finish.' },
                            { name: '🔥 Upset Tracker', value: 'High-upset match highlighting.' }
                        )
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
                    await interaction.reply(`Successfully unlinked **${result.name || slug}**. Live updates and the dashboard have been deactivated.`);
                } else {
                    await interaction.reply({ content: `Could not find **${slug}** linked to this server.`, ephemeral: true });
                }

            } else if (subcommand === 'list') {
                const links = await leagueModel.find({ guildid: guildID });

                if (links.length === 0) {
                    return interaction.reply('No live updates are currently linked to this server.');
                }

                const embed = new EmbedBuilder()
                    .setTitle('📡 Linked Live Updates')
                    .setColor('#FF3399')
                    .setDescription(links.map(l => {
                        const icon = l.type === 'league' ? '🏆' : (l.type === 'event' ? '🎯' : '🎮');
                        return `• ${icon} **${l.name || l.slug}** \`(${l.type})\``;
                    }).join('\n'))
                    .setFooter({ text: 'Armour Studios', iconURL: footerIcon });

                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('CRITICAL ERROR in live command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(`❌ **Fatal Error:** ${error.message}`);
            } else {
                await interaction.reply({ content: `❌ **Fatal Error:** ${error.message}`, ephemeral: true });
            }
        }
    }
};
