const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { footerIcon, broadcastAlert } = require('../functions');
const scrimProfileModel = require('../database/models/scrim_profile');
const scrimQueueModel = require('../database/models/scrim_queue');
const scrimMatchModel = require('../database/models/scrim_match');
const scrimTeamModel = require('../database/models/scrim_team');

module.exports = {
    name: 'scrim',
    description: 'Participate in cross-server scrims and rankings',
    data: new SlashCommandBuilder()
        .setName('scrim')
        .setDescription('Report scrim results and view rankings')
        .addSubcommand(sub =>
            sub.setName('report')
                .setDescription('Report the result of a match')
                .addStringOption(opt => opt.setName('match_id').setDescription('The ID provided when the match started').setRequired(true))
                .addIntegerOption(opt => opt.setName('winner').setDescription('The winning team').setRequired(true).addChoices({ name: 'Blue', value: 0 }, { name: 'Orange', value: 1 }))
        )
        .addSubcommand(sub =>
            sub.setName('profile')
                .setDescription('View a player\'s scrim profile')
                .addUserOption(opt => opt.setName('user').setDescription('The user to view'))
        )
        .addSubcommand(sub =>
            sub.setName('leaderboard')
                .setDescription('View the global player leaderboard')
                .addStringOption(opt => opt.setName('game').setDescription('The game to view').addChoices({ name: 'Rocket League', value: 'rocket_league' }))
        )
        .addSubcommand(sub =>
            sub.setName('team-leaderboard')
                .setDescription('View the global team leaderboard')
                .addStringOption(opt => opt.setName('game').setDescription('The game to view').addChoices({ name: 'Rocket League', value: 'rocket_league' }))
        )
        .addSubcommand(sub =>
            sub.setName('queue')
                .setDescription('Queue your team for a scrimmage')
                .addStringOption(opt => opt.setName('team_name').setDescription('The name of your team').setRequired(true))
                .addStringOption(opt => opt.setName('game').setDescription('The game to queue for').addChoices({ name: 'Rocket League', value: 'rocket_league' }))
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Check who is currently in the scrimmage queue')
        )
        .addSubcommand(sub =>
            sub.setName('guide')
                .setDescription('View the scrim system guide')
        )
        .addSubcommandGroup(group =>
            group.setName('team')
                .setDescription('Manage your scrim team')
                .addSubcommand(sub =>
                    sub.setName('create')
                        .setDescription('Create a new scrim team')
                        .addStringOption(opt => opt.setName('name').setDescription('The team name').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('view')
                        .setDescription('View team roster and stats')
                        .addStringOption(opt => opt.setName('name').setDescription('The team name to look up'))
                )
                .addSubcommand(sub =>
                    sub.setName('invite')
                        .setDescription('Invite a player to your team')
                        .addUserOption(opt => opt.setName('user').setDescription('The player to invite').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('join')
                        .setDescription('Join a team you were invited to')
                        .addStringOption(opt => opt.setName('name').setDescription('The team name').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('remove')
                        .setDescription('Remove a player from your team')
                        .addUserOption(opt => opt.setName('user').setDescription('The player to remove').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('disband')
                        .setDescription('Delete your team')
                )
        ),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const userId = interaction.user.id;

        if (subcommand === 'report' || interaction.options.getFocused(true).name === 'match_id') {
            const matches = await scrimMatchModel.find({
                'players.userId': userId,
                state: 'ongoing'
            }).limit(25);

            const choices = matches.map(m => ({ name: `${m.matchId} (${m.game.replace('_', ' ')})`, value: m.matchId }));
            const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
            return interaction.respond(filtered);

        } else if (subcommand === 'queue' || interaction.options.getFocused(true).name === 'team_name') {
            const teams = await scrimTeamModel.find({
                memberIds: userId
            }).limit(25);

            const choices = teams.map(t => ({ name: t.name, value: t.name }));
            const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
            return interaction.respond(filtered);

        } else if (subcommandGroup === 'team') {
            if (subcommand === 'view') {
                const teams = await scrimTeamModel.find({
                    name: new RegExp(focusedValue, 'i')
                }).limit(25);

                const choices = teams.map(t => ({ name: t.name, value: t.name }));
                return interaction.respond(choices);

            } else if (subcommand === 'join') {
                const teams = await scrimTeamModel.find({
                    pendingInvites: userId
                }).limit(25);

                const choices = teams.map(t => ({ name: t.name, value: t.name }));
                const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
                return interaction.respond(filtered);
            }
        }
    },

    async executeSlash(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const userId = interaction.user.id;

        if (subcommand === 'profile') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const profile = await scrimProfileModel.findOne({ userId: targetUser.id });

            if (!profile) {
                return interaction.editReply({ content: 'This user has no scrim profile yet.' });
            }

            if (!profile.stats) profile.stats = {};
            if (!profile.stats.rocket_league) {
                profile.stats.rocket_league = { elo: 1000, wins: 0, losses: 0, rank: 'Rank E' };
                await profile.save();
            }

            const team = await scrimTeamModel.findOne({ memberIds: targetUser.id });

            const embed = new EmbedBuilder()
                .setTitle(`👤 Scrim Profile: ${targetUser.username}`)
                .setColor('#FF3399')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '🚀 Rocket League', value: `**Rank:** ${profile.stats.rocket_league.rank}\n**ELO:** ${profile.stats.rocket_league.elo}\n**W/L:** ${profile.stats.rocket_league.wins}/${profile.stats.rocket_league.losses}`, inline: true },
                    { name: '🛡️ Team', value: team ? `**${team.name}**` : 'No Team', inline: true }
                )
                .setFooter({ text: 'Armour Studios', iconURL: footerIcon });

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'report') {
            await interaction.deferReply({ ephemeral: true });
            const matchId = interaction.options.getString('match_id');
            const winnerTeamIdx = interaction.options.getInteger('winner'); // 0 or 1

            const match = await scrimMatchModel.findOne({ matchId });
            if (!match) return interaction.editReply({ content: 'Match not found.' });

            if (!match.players.find(p => p.userId === userId)) {
                return interaction.editReply({ content: 'You were not a participant in this match.' });
            }

            match.winnerTeam = winnerTeamIdx;
            match.resultSubmittedBy = userId;
            match.state = 'completed';
            await match.save();

            await updateElo(match);

            await interaction.editReply(`✅ Result reported for Match **${matchId}**. Team ${winnerTeamIdx === 0 ? 'Blue' : 'Orange'} wins!`);

        } else if (subcommand === 'leaderboard') {
            await interaction.deferReply();
            const game = interaction.options.getString('game') || 'rocket_league';
            const topPlayers = await scrimProfileModel.find({})
                .sort({ [`stats.${game}.elo`]: -1 })
                .limit(10);

            const embed = new EmbedBuilder()
                .setTitle(`🏆 Player Leaderboard: ${game.replace('_', ' ').toUpperCase()}`)
                .setColor('#36FF7D')
                .setDescription(topPlayers.length ? topPlayers.map((p, i) => {
                    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '• '));
                    const stats = p.stats?.[game] || { elo: 1000, rank: 'Rank E' };
                    return `${medal} <@${p.userId}> - **${stats.elo} ELO** (${stats.rank})`;
                }).join('\n') : 'No ranked players yet.')
                .setFooter({ text: 'Armour Studios Rankings', iconURL: footerIcon });

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'team-leaderboard') {
            await interaction.deferReply();
            const game = interaction.options.getString('game') || 'rocket_league';
            const topTeams = await scrimTeamModel.find({})
                .sort({ [`stats.${game}.elo`]: -1 })
                .limit(10);

            const embed = new EmbedBuilder()
                .setTitle(`🏆 Team Leaderboard: ${game.replace('_', ' ').toUpperCase()}`)
                .setColor('#FFEE58')
                .setDescription(topTeams.length ? topTeams.map((t, i) => {
                    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '• '));
                    const stats = t.stats?.[game] || { elo: 1000, rank: 'Rank E' };
                    return `${medal} **${t.name}** - **${stats.elo} ELO** (${stats.rank})`;
                }).join('\n') : 'No ranked teams yet.')
                .setFooter({ text: 'Armour Studios Team Rankings', iconURL: footerIcon });

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'queue') {
            await interaction.deferReply({ ephemeral: true });
            const teamName = interaction.options.getString('team_name');
            const game = interaction.options.getString('game') || 'rocket_league';

            const team = await scrimTeamModel.findOne({ name: teamName });
            if (!team) return interaction.editReply(`Team **${teamName}** not found.`);
            if (!team.memberIds.includes(userId)) return interaction.editReply(`You are not a member of **${teamName}**.`);

            const inQueue = await scrimQueueModel.findOne({ $or: [{ userId }, { teamName }] });
            if (inQueue) return interaction.editReply(`Your team or one of its members is already in the queue!`);

            await new scrimQueueModel({
                userId,
                guildId: interaction.guild.id,
                game,
                elo: team.stats[game]?.elo || 1000,
                teamName,
                meta: { rank: team.stats[game]?.rank || 'Rank E' }
            }).save();

            await interaction.editReply(`✅ Team **${teamName}** has joined the scrimmage queue!`);
            await broadcastAlert(client, interaction.guild.id, 'scrim', `**Team:** ${teamName}\n**Game:** ${game}\n**ELO:** ${team.stats[game]?.elo || 1000}`);

            await checkMatchmaking(client, game);

        } else if (subcommand === 'status') {
            await interaction.deferReply();
            const queue = await scrimQueueModel.find({});
            const embed = new EmbedBuilder()
                .setTitle('🕒 Scrimmage Queue Status')
                .setColor('#36FF7D')
                .setDescription(queue.length ? queue.map(q => `• **${q.teamName || 'Solo'}** joined <t:${Math.floor(q.joinedAt.getTime() / 1000)}:R> (ELO: ${q.elo || 1000})`).join('\n') : 'The queue is currently empty.')
                .setFooter({ text: 'Armour Studios Scrim Finder', iconURL: footerIcon });

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'guide') {
            const guideEmbed = new EmbedBuilder()
                .setTitle('📖 Scrim System Guide')
                .setColor('#FF3399')
                .setDescription('Welcome to the Armour Studios Scrim System! Here is how it works:')
                .addFields(
                    { name: '🛡️ Teams', value: 'Create a team with `/scrim team create`. Invite players with `/scrim team invite`.' },
                    { name: '🕒 Queuing', value: 'Join the queue with `/scrim queue`. Once an opponent is found, you will be notified via DM/Channel.' },
                    { name: '🔥 Matchmaking', value: 'When a match is found, we provide Discord tags of all players to sync up in VCs.' },
                    { name: '📈 Rankings', value: 'Report your results with `/scrim report`. ELO and Ranks update automatically for both players and teams!' }
                )
                .setFooter({ text: 'Professional Scrim Management', iconURL: footerIcon });

            await interaction.reply({ embeds: [guideEmbed] });

        } else if (subcommandGroup === 'team') {
            if (subcommand === 'create') {
                await interaction.deferReply({ ephemeral: true });
                const name = interaction.options.getString('name');
                const existing = await scrimTeamModel.findOne({ name });
                if (existing) return interaction.editReply('A team with that name already exists.');

                const userTeam = await scrimTeamModel.findOne({ memberIds: userId });
                if (userTeam) return interaction.editReply(`You are already in team **${userTeam.name}**.`);

                await new scrimTeamModel({
                    name,
                    ownerId: userId,
                    memberIds: [userId]
                }).save();

                await interaction.editReply(`✅ Team **${name}** created successfully!`);

            } else if (subcommand === 'view') {
                await interaction.deferReply();
                const name = interaction.options.getString('name');
                let team;
                if (name) team = await scrimTeamModel.findOne({ name });
                else team = await scrimTeamModel.findOne({ memberIds: userId });

                if (!team) return interaction.editReply('Team not found or you are not in a team.');

                const embed = await createTeamEmbed(team, client);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`team_roster_${team._id}`).setLabel('👤 Roster').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`team_history_${team._id}`).setLabel('📜 History').setStyle(ButtonStyle.Secondary)
                );

                const msg = await interaction.editReply({ embeds: [embed], components: [row] });

                // Interaction collector for buttons
                const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
                collector.on('collect', async i => {
                    if (i.customId.startsWith('team_roster')) {
                        const rosterEmbed = await createTeamEmbed(team, client, 'roster');
                        await i.update({ embeds: [rosterEmbed] });
                    } else if (i.customId.startsWith('team_history')) {
                        const historyEmbed = await createTeamEmbed(team, client, 'history');
                        await i.update({ embeds: [historyEmbed] });
                    }
                });

            } else if (subcommand === 'invite') {
                await interaction.deferReply({ ephemeral: true });
                const target = interaction.options.getUser('user');
                const team = await scrimTeamModel.findOne({ ownerId: userId });
                if (!team) return interaction.editReply('You must be the owner of a team to invite players.');

                if (team.memberIds.includes(target.id)) return interaction.editReply('That player is already in your team.');

                team.pendingInvites.push(target.id);
                await team.save();

                await interaction.editReply(`✅ Invite sent to <@${target.id}>!`);
                try {
                    await target.send(`🎮 You have been invited to join team **${team.name}**! Use \`/scrim team join name:${team.name}\` to accept.`);
                } catch (e) { }

            } else if (subcommand === 'join') {
                await interaction.deferReply({ ephemeral: true });
                const name = interaction.options.getString('name');
                const team = await scrimTeamModel.findOne({ name });
                if (!team) return interaction.editReply('Team not found.');

                if (!team.pendingInvites.includes(userId)) return interaction.editReply('You have not been invited to this team.');

                const userTeam = await scrimTeamModel.findOne({ memberIds: userId });
                if (userTeam) return interaction.editReply(`You are already in team **${userTeam.name}**. You must leave it first.`);

                team.memberIds.push(userId);
                team.pendingInvites = team.pendingInvites.filter(id => id !== userId);
                await team.save();

                await interaction.editReply(`✅ You have successfully joined team **${team.name}**!`);

            } else if (subcommand === 'remove') {
                await interaction.deferReply({ ephemeral: true });
                const target = interaction.options.getUser('user');
                const team = await scrimTeamModel.findOne({ ownerId: userId });
                if (!team) return interaction.editReply('Only the team owner can remove players.');
                if (target.id === userId) return interaction.editReply('You cannot remove yourself. Use disband to delete the team.');

                team.memberIds = team.memberIds.filter(id => id !== target.id);
                await team.save();
                await interaction.editReply(`✅ <@${target.id}> removed from team.`);

            } else if (subcommand === 'disband') {
                await interaction.deferReply({ ephemeral: true });
                const team = await scrimTeamModel.findOne({ ownerId: userId });
                if (!team) return interaction.editReply('Only the team owner can disband the team.');

                await scrimTeamModel.deleteOne({ _id: team._id });
                await interaction.editReply('🗑️ Team disbanded.');
            }
        }
    },
};

async function updateElo(match) {
    const K = 32;
    const team0Players = match.players.filter(p => p.team === 0);
    const team1Players = match.players.filter(p => p.team === 1);

    const avgElo0 = team0Players.reduce((a, b) => a + b.eloAtStart, 0) / team0Players.length;
    const avgElo1 = team1Players.reduce((a, b) => a + b.eloAtStart, 0) / team1Players.length;

    const expected0 = 1 / (1 + Math.pow(10, (avgElo1 - avgElo0) / 400));
    const expected1 = 1 - expected0;

    const actual0 = match.winnerTeam === 0 ? 1 : 0;
    const actual1 = match.winnerTeam === 1 ? 1 : 0;

    const eloChange = Math.round(K * (actual0 - expected0));

    // Update individual players
    for (const player of match.players) {
        const change = player.team === 0 ? eloChange : -eloChange;
        const profile = await scrimProfileModel.findOne({ userId: player.userId });
        if (profile) {
            const game = match.game;
            profile.stats[game].elo += change;
            if (change > 0) profile.stats[game].wins += 1;
            else profile.stats[game].losses += 1;
            profile.stats[game].rank = getRankTitle(profile.stats[game].elo);
            await profile.save();
        }
    }

    // Update Team ELO if applicable
    if (match.teamIds && match.teamIds.length === 2) {
        for (let i = 0; i < 2; i++) {
            const team = await scrimTeamModel.findById(match.teamIds[i]);
            if (team) {
                const game = match.game;
                const change = (i === 0 ? eloChange : -eloChange);
                team.stats[game].elo += change;
                if (change > 0) team.stats[game].wins += 1;
                else team.stats[game].losses += 1;
                team.stats[game].rank = getRankTitle(team.stats[game].elo);

                // Update H2H
                const opponentId = match.teamIds[1 - i];
                const opponentName = match.teamNames[1 - i];
                if (!team.h2h) team.h2h = new Map();
                const currentH2H = team.h2h.get(opponentId) || { wins: 0, losses: 0 };
                if (change > 0) currentH2H.wins += 1;
                else currentH2H.losses += 1;
                team.h2h.set(opponentId, currentH2H);

                // Add to history
                team.history.unshift({
                    matchId: match.matchId,
                    opponentName,
                    result: change > 0 ? 'win' : 'loss'
                });
                if (team.history.length > 20) team.history.pop();

                await team.save();
            }
        }
    }
}

function getRankTitle(elo) {
    if (elo < 1200) return 'Rank E';
    if (elo < 1400) return 'Rank D';
    if (elo < 1600) return 'Rank C';
    if (elo < 1800) return 'Rank B';
    if (elo < 2000) return 'Rank A';
    return 'Rank S';
}

async function checkMatchmaking(client, game) {
    const queue = await scrimQueueModel.find({ game }).sort({ joinedAt: 1 });

    if (queue.length >= 2) {
        const q1 = queue[0];
        const q2 = queue[1];

        const matchId = `M-${Date.now()}`;
        const team1Data = q1.teamName ? await scrimTeamModel.findOne({ name: q1.teamName }) : null;
        const team2Data = q2.teamName ? await scrimTeamModel.findOne({ name: q2.teamName }) : null;

        const players = [];
        if (team1Data) {
            team1Data.memberIds.forEach(id => players.push({ userId: id, team: 0, eloAtStart: q1.elo }));
        } else {
            players.push({ userId: q1.userId, team: 0, eloAtStart: q1.elo });
        }

        if (team2Data) {
            team2Data.memberIds.forEach(id => players.push({ userId: id, team: 1, eloAtStart: q2.elo }));
        } else {
            players.push({ userId: q2.userId, team: 1, eloAtStart: q2.elo });
        }

        const newMatch = new scrimMatchModel({
            matchId,
            game,
            guildIds: [q1.guildId, q2.guildId],
            teamIds: [team1Data?._id, team2Data?._id].filter(id => id),
            teamNames: [q1.teamName, q2.teamName].filter(name => name),
            players,
            state: 'ongoing'
        });

        await newMatch.save();
        await scrimQueueModel.deleteMany({ _id: { $in: [q1._id, q2._id] } });

        const notifyEmbed = new EmbedBuilder()
            .setTitle('🔥 SCRIM FOUND!')
            .setColor('#FFEE58')
            .setDescription(`**${q1.teamName || 'Solo'}** vs **${q2.teamName || 'Solo'}**`)
            .addFields(
                { name: '🔵 Blue Team', value: players.filter(p => p.team === 0).map(p => `<@${p.userId}>`).join('\n'), inline: true },
                { name: '🟠 Orange Team', value: players.filter(p => p.team === 1).map(p => `<@${p.userId}>`).join('\n'), inline: true },
                { name: 'Match ID', value: `\`${matchId}\``, inline: false },
                { name: 'VC Coordination', value: 'Use the mentions above to find each other in VC or send a DM!' }
            )
            .setFooter({ text: 'Armour Studios | Use /scrim report to submit results', iconURL: footerIcon });

        for (const p of players) {
            try {
                const user = await client.users.fetch(p.userId);
                await user.send({ embeds: [notifyEmbed] });
            } catch (err) { }
        }
    }
}

async function createTeamEmbed(team, client, type = 'stats') {
    const embed = new EmbedBuilder()
        .setTitle(`🛡️ Team: ${team.name}`)
        .setColor('#FF3399')
        .setFooter({ text: 'Armour Studios Pro Teams', iconURL: footerIcon });

    if (type === 'stats') {
        const stats = team.stats.rocket_league;
        embed.addFields(
            { name: '📊 Stats (Rocket League)', value: `**Rank:** ${stats.rank}\n**ELO:** ${stats.elo}\n**W/L:** ${stats.wins}/${stats.losses}`, inline: true },
            { name: '👑 Owner', value: `<@${team.ownerId}>`, inline: true },
            { name: '👥 Members', value: `${team.memberIds.length}`, inline: true }
        );
    } else if (type === 'roster') {
        const members = await Promise.all(team.memberIds.map(async id => {
            try {
                const u = await client.users.fetch(id);
                return `• ${u.username} (<@${id}>)`;
            } catch (e) { return `• Unknown (<@${id}>)`; }
        }));
        embed.setDescription(`**Roster:**\n${members.join('\n')}`);
    } else if (type === 'history') {
        const history = team.history.slice(0, 5).map(h => {
            const emoji = h.result === 'win' ? '✅' : '❌';
            return `${emoji} vs **${h.opponentName}** (<t:${Math.floor(h.timestamp.getTime() / 1000)}:R>)`;
        });
        embed.setDescription(`**Last 5 Matches:**\n${history.join('\n') || 'No match history yet.'}`);
    }

    return embed;
}
