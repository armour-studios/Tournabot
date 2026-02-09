const { EmbedBuilder } = require('discord.js');
const { queryAPI, footerIcon, getBranding } = require('../functions');
const guildSettingsModel = require('../database/models/guild_settings');

module.exports = {
    name: 'promote',
    description: 'Promote a tournament across all partnered servers',
    async executeSlash(interaction, client) {
        const url = interaction.options.getString('url');
        if (!url) return interaction.reply('Please provide a tournament URL.');

        let slug = url.replace('https://www.start.gg/', '').replace('https://start.gg/', '').split('?')[0];
        if (slug.endsWith('/')) slug = slug.slice(0, -1);

        await interaction.deferReply();

        try {
            const query = `query TournamentInfo($slug: String!) {
        tournament(slug: $slug) {
          name
          url
          images { url type }
          numEntrants
          startAt
          events { name numEntrants }
        }
      }`;

            const data = await queryAPI(query, { slug });
            if (!data?.data?.tournament) {
                return interaction.editReply('Could not find tournament. Make sure you provide a valid Start.gg URL.');
            }

            const tournament = data.data.tournament;
            const branding = await getBranding(interaction.guild.id);

            const promoEmbed = new EmbedBuilder()
                .setColor(branding.color)
                .setTitle(`📢 Partnered Promotion: ${tournament.name}`)
                .setURL(`https://start.gg/${tournament.url}`)
                .setAuthor({ name: branding.name, iconURL: branding.icon })
                .setThumbnail(tournament.images?.find(i => i.type === 'profile')?.url || branding.icon)
                .setDescription(`**${branding.name}** is inviting you to join their upcoming tournament!`)
                .addFields(
                    { name: '👥 Entrants', value: `${tournament.numEntrants || 0}`, inline: true },
                    { name: '📅 Starts At', value: `<t:${tournament.startAt}:F>`, inline: true },
                    { name: '🎮 Events', value: tournament.events.map(e => e.name).join(', ') || 'N/A' }
                )
                .setFooter({ text: `Promoted via Armour Studios Network`, iconURL: footerIcon })
                .setTimestamp();

            // Find all servers with a promotion channel
            const partneredGuilds = await guildSettingsModel.find({ promotionChannels: { $exists: true, $not: { $size: 0 } } });
            let count = 0;

            for (const guildData of partneredGuilds) {
                if (guildData.guildId === interaction.guild.id) continue; // Don't promote to yourself

                const targetGuild = client.guilds.cache.get(guildData.guildId);
                if (!targetGuild) continue;

                for (const channelId of guildData.promotionChannels) {
                    const channel = targetGuild.channels.cache.get(channelId);
                    if (channel) {
                        try {
                            await channel.send({ embeds: [promoEmbed] });
                            count++;
                        } catch (err) {
                            console.error(`Failed to send promo to channel ${channelId} in guild ${targetGuild.name}`);
                        }
                    }
                }
            }

            await interaction.editReply(`🚀 Successfully promoted **${tournament.name}** to **${count}** partnered servers!`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('An error occurred while promoting the tournament.');
        }
    }
};
