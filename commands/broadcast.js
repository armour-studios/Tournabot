const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getBranding, footerIcon, queryAPI, extractSlug, fetchEntity } = require('../functions');
const guildSettingsModel = require('../database/models/guild_settings');

module.exports = {
    name: 'broadcast',
    description: 'Broadcast an announcement or advertisement to all partnered servers',
    data: new SlashCommandBuilder()
        .setName('broadcast')
        .setDescription('Global cross-server announcements')
        .addSubcommand(sub =>
            sub.setName('ad')
                .setDescription('Broadcast a custom advertisement or announcement')
                .addStringOption(opt => opt.setName('title').setDescription('The title').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('The content').setRequired(true))
                .addStringOption(opt => opt.setName('image_url').setDescription('Optional image URL'))
                .addStringOption(opt => opt.setName('link').setDescription('Optional link URL'))
        )
        .addSubcommand(sub =>
            sub.setName('tournament')
                .setDescription('Broadcast a tournament or league from Start.gg')
                .addStringOption(opt => opt.setName('url').setDescription('Start.gg Tournament or League URL').setRequired(true))
        ),

    async executeSlash(interaction, client) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Only server administrators can use global broadcasts.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply();

        let embed;
        const branding = await getBranding(interaction.guild.id);

        if (subcommand === 'ad') {
            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const image = interaction.options.getString('image_url');
            const link = interaction.options.getString('link');

            embed = new EmbedBuilder()
                .setColor(branding.color)
                .setTitle(`📢 Global Broadcast: ${title}`)
                .setAuthor({ name: branding.name, iconURL: branding.icon })
                .setDescription(message)
                .setTimestamp()
                .setFooter({ text: 'Armour Studios Network', iconURL: footerIcon });

            if (image) embed.setImage(image);
            if (link) embed.addFields({ name: '🔗 Link', value: link });

        } else if (subcommand === 'tournament') {
            const url = interaction.options.getString('url');

            // Robust slug extraction using regex to find tournament or league identifier
            const regex = /\/(tournament|league)\/([^\/]+)/;
            const match = url.match(regex);
            let slug = match ? match[2] : url.split('?')[0].split('/').filter(Boolean).pop();

            const isLeagueHint = url.includes('/league/');

            const tournamentQuery = `query TournamentInfo($slug: String!) {
                tournament(slug: $slug) {
                    name url images { url type } numEntrants startAt
                }
            }`;

            const leagueQuery = `query LeagueInfo($slug: String!) {
                league(slug: $slug) {
                    name url images { url type }
                }
            }`;

            // Try hinted query first
            let query = isLeagueHint ? leagueQuery : tournamentQuery;
            let data = await queryAPI(query, { slug });
            let entity = isLeagueHint ? data?.data?.league : data?.data?.tournament;
            let finalIsLeague = isLeagueHint;

            // Fallback: If hinted query fails, try the other one
            if (!entity) {
                query = isLeagueHint ? tournamentQuery : leagueQuery;
                data = await queryAPI(query, { slug });
                entity = isLeagueHint ? data?.data?.tournament : data?.data?.league;
                if (entity) finalIsLeague = !isLeagueHint;
            }

            if (!entity) {
                return interaction.editReply(`Tournament data not found for slug: \`${slug}\`. Please ensure the URL is a valid Start.gg link.`);
            }

            embed = new EmbedBuilder()
                .setColor(branding.color)
                .setTitle(`🏆 Tournament Spotlight: ${entity.name}`)
                .setURL(`https://start.gg/${entity.url}`)
                .setAuthor({ name: branding.name, iconURL: branding.icon })
                .setThumbnail(entity.images?.find(i => i.type === 'profile' || i.type === 'main')?.url || branding.icon)
                .setDescription(`**${branding.name}** is inviting you to check out this ${finalIsLeague ? 'league' : 'tournament'}!`)
                .setFooter({ text: 'Armour Studios Network', iconURL: footerIcon });

            if (!finalIsLeague) {
                embed.addFields(
                    { name: '👥 Entrants', value: `${entity.numEntrants || 0}`, inline: true },
                    { name: '📅 Starts', value: `<t:${entity.startAt}:F>`, inline: true }
                );
            }

            const banner = entity.images?.find(i => i.type === 'banner' || i.type === 'header')?.url;
            if (banner) embed.setImage(banner);
        }

        // Send to partner guilds
        const partneredGuilds = await guildSettingsModel.find({
            promotionChannels: { $exists: true, $not: { $size: 0 } }
        });

        let count = 0;
        for (const guildData of partneredGuilds) {
            const targetGuild = client.guilds.cache.get(guildData.guildId);
            if (!targetGuild) continue;

            for (const channelId of guildData.promotionChannels) {
                const channel = targetGuild.channels.cache.get(channelId);
                if (channel) {
                    try {
                        await channel.send({ embeds: [embed] });
                        count++;
                    } catch (e) { }
                }
            }
        }

        await interaction.editReply(`✅ Broadcast sent to **${count}** channels across the network!`);
    }
};
