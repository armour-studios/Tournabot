const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const channelModel = require('../database/models/channel');
const { footerIcon } = require('../functions');

module.exports = {
    name: 'setup',
    description: 'Automated server setup with channel creation',
    async executeSlash(interaction, client) {
        // Admin check
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'This command requires Administrator permissions.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const guild = interaction.guild;

            // Create main category
            const tournamentCategory = await guild.channels.create({
                name: '🏆 TOURNAMENT HUB',
                type: ChannelType.GuildCategory,
                position: 0
            });

            // Create channels under tournament category
            const channels = {
                announcements: await guild.channels.create({
                    name: '📢┃announcements',
                    type: ChannelType.GuildText,
                    parent: tournamentCategory.id,
                    topic: 'Tournament announcements and upcoming events'
                }),
                matchFeed: await guild.channels.create({
                    name: '🔴┃live-matches',
                    type: ChannelType.GuildText,
                    parent: tournamentCategory.id,
                    topic: 'Live match updates and results'
                }),
                upsets: await guild.channels.create({
                    name: '🔥┃upsets',
                    type: ChannelType.GuildText,
                    parent: tournamentCategory.id,
                    topic: 'High-impact upsets and big seed differences'
                }),
                standings: await guild.channels.create({
                    name: '🏅┃standings',
                    type: ChannelType.GuildText,
                    parent: tournamentCategory.id,
                    topic: 'Final tournament standings'
                }),
                dqPings: await guild.channels.create({
                    name: '⚠️┃dq-pings',
                    type: ChannelType.GuildText,
                    parent: tournamentCategory.id,
                    topic: 'DQ warnings and pings'
                }),
                seeds: await guild.channels.create({
                    name: '🎯┃seeds',
                    type: ChannelType.GuildText,
                    parent: tournamentCategory.id,
                    topic: 'Tournament seeding and brackets'
                })
            };

            // Auto-configure bot settings
            const guildID = guild.id;
            await channelModel.findOneAndUpdate(
                { guildid: guildID },
                {
                    channelid: channels.announcements.id,
                    matchfeedchannel: channels.matchFeed.id,
                    upsetchannel: channels.upsets.id,
                    standingschannel: channels.standings.id,
                    seedchannel: channels.seeds.id
                },
                { upsert: true }
            );

            await channelModel.findOneAndUpdate(
                { guildid: `${guildID}dq` },
                { channelid: channels.dqPings.id },
                { upsert: true }
            );

            // Create success embed
            const setupEmbed = new EmbedBuilder()
                .setColor('#36FF7D')
                .setTitle('✅ Server Setup Complete!')
                .setDescription('NE Network has created and configured all tournament channels.')
                .addFields(
                    {
                        name: '📢 Announcements',
                        value: `${channels.announcements}\nConfigured for /announce and league posts`,
                        inline: true
                    },
                    {
                        name: '🔴 Live Matches',
                        value: `${channels.matchFeed}`,
                        inline: true
                    },
                    {
                        name: '🔥 Upsets',
                        value: `${channels.upsets}`,
                        inline: true
                    },
                    {
                        name: '🏅 Standings',
                        value: `${channels.standings}`,
                        inline: true
                    },
                    {
                        name: '⚠️ DQ Pings',
                        value: `${channels.dqPings}\nDQ warnings and reminders`,
                        inline: true
                    },
                    {
                        name: '🎯 Seeds',
                        value: `${channels.seeds}\nTournament seeding output`,
                        inline: true
                    }
                )
                .addFields({
                    name: '🚀 Quick Start Guide',
                    value: `**1.** Link a league: \`/league link <url>\`\n**2.** Announce a tournament: \`/announce <url>\`\n**3.** Generate seeds: \`/seed generate <event-url>\`\n**4.** Search upcoming: \`/search <game>\`\n\n📚 Full commands: \`/help\``,
                    inline: false
                })
                .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon })
                .setTimestamp();

            await interaction.editReply({ embeds: [setupEmbed] });

            // Send welcome message to announcements channel
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#FF3399')
                .setTitle('👋 Welcome to NE Network!')
                .setDescription('Your all-in-one tournament management solution for competitive gaming.')
                .addFields(
                    { name: '🎮 Features', value: '• Automated league tracking\n• Tournament announcements\n• Live match feeds\n• DQ management\n• Seed generation (Rocket League)\n• Results tracking', inline: true },
                    { name: '⚙️ Getting Started', value: '• All channels are configured\n• Use `/help` for command list\n• Set ping role with `/set pingrole`\n• Customize timezone with `/set timezone`', inline: true }
                )
                .setFooter({ text: 'Built by NE Network', iconURL: footerIcon })
                .setTimestamp();

            await channels.announcements.send({ embeds: [welcomeEmbed] });

        } catch (error) {
            console.error('Setup error:', error);
            await interaction.editReply(`❌ Setup failed: ${error.message}\n\nMake sure the bot has \`Manage Channels\` permission.`);
        }
    }
};
