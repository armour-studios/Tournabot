const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { footerIcon, broadcastAlert } = require('../functions');
const scrimProfileModel = require('../database/models/scrim_profile');
const scrimQueueModel = require('../database/models/scrim_queue');
const scrimMatchModel = require('../database/models/scrim_match');

module.exports = {
    name: 'queue',
    description: 'Join the rank-locked 6-man queue',
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Join the rank-locked 6-man queue')
        .addSubcommand(sub =>
            sub.setName('join')
                .setDescription('Join the queue for your current rank')
                .addStringOption(opt => opt.setName('game').setDescription('The game to queue for').addChoices({ name: 'Rocket League', value: 'rocket_league' }))
        )
        .addSubcommand(sub =>
            sub.setName('leave')
                .setDescription('Leave the current queue')
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Check how many players are in your rank queue')
                .addStringOption(opt => opt.setName('game').setDescription('The game to check').addChoices({ name: 'Rocket League', value: 'rocket_league' }))
        ),

    async executeSlash(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        if (subcommand === 'join') {
            await interaction.deferReply({ ephemeral: true });

            // Get or create profile
            let profile = await scrimProfileModel.findOne({ userId });
            if (!profile) {
                profile = await new scrimProfileModel({ userId, guildId }).save();
            }

            const game = interaction.options.getString('game') || 'rocket_league';

            // Ensure stats object exists
            if (!profile.stats) profile.stats = {};
            if (!profile.stats[game]) {
                profile.stats[game] = { elo: 1000, wins: 0, losses: 0, rank: 'Rank E' };
                await profile.save();
            }

            const userRank = profile.stats[game].rank || 'Rank E';
            const elo = profile.stats[game].elo || 1000;

            // Check if already in queue
            const inQueue = await scrimQueueModel.findOne({ userId });
            if (inQueue) {
                return interaction.editReply(`You are already in the **${inQueue.meta?.rank || 'Unknown'}** queue! Use \`/queue leave\` to exit.`);
            }

            await new scrimQueueModel({
                userId,
                guildId,
                game,
                elo,
                meta: { rank: userRank }
            }).save();

            await interaction.editReply(`✅ You've joined the **${userRank}** queue for **${game.replace('_', ' ')}**! Waiting for 6 players...`);

            // Broadcast cross-server
            const details = `**Player:** <@${userId}>\n**Rank:** ${userRank}\n**MMR:** ${elo}`;
            await broadcastAlert(client, interaction.guild.id, 'pro_queue', details);

            // Trigger Matchmaking logic
            await checkRankedMatchmaking(client, game, userRank);

        } else if (subcommand === 'leave') {
            await interaction.deferReply({ ephemeral: true });
            const result = await scrimQueueModel.findOneAndDelete({ userId });
            if (result) {
                await interaction.editReply({ content: 'You have left the queue.' });
            } else {
                await interaction.editReply({ content: 'You were not in the queue.' });
            }

        } else if (subcommand === 'status') {
            await interaction.deferReply();
            const game = interaction.options.getString('game') || 'rocket_league';

            // Get user's rank to show relevant status
            let profile = await scrimProfileModel.findOne({ userId });
            const userRank = profile?.stats?.[game]?.rank || 'Rank E';

            const queue = await scrimQueueModel.find({ game, 'meta.rank': userRank });

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${game.replace('_', ' ').toUpperCase()} Queue: ${userRank}`)
                .setColor('#FF3399')
                .setDescription(`There are currently **${queue.length}/6** players in the **${userRank}** queue.`)
                .setFooter({ text: 'Armour Studios Pro Queue', iconURL: footerIcon })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }
};

async function checkRankedMatchmaking(client, game, rank) {
    const queue = await scrimQueueModel.find({ game, 'meta.rank': rank }).sort({ joinedAt: 1 });

    if (queue.length >= 6) {
        const players = queue.slice(0, 6);

        // Shuffle players for random teams
        const shuffled = players.sort(() => 0.5 - Math.random());
        const teamBlue = shuffled.slice(0, 3);
        const teamOrange = shuffled.slice(3, 6);

        // Create Match
        const matchId = `Q-${Date.now()}`;
        const newMatch = new scrimMatchModel({
            matchId,
            game,
            guildIds: [...new Set(players.map(p => p.guildId))],
            players: [
                ...teamBlue.map(p => ({ userId: p.userId, team: 0, eloAtStart: p.elo })),
                ...teamOrange.map(p => ({ userId: p.userId, team: 1, eloAtStart: p.elo }))
            ],
            state: 'ongoing'
        });

        await newMatch.save();

        // Clear Queue
        await scrimQueueModel.deleteMany({ userId: { $in: players.map(p => p.userId) } });

        // Notify Players
        const notifyEmbed = new EmbedBuilder()
            .setTitle('🔥 PRO QUEUE: Match Found!')
            .setColor('#36FF7D')
            .setDescription(`A **${rank}** match has been found!`)
            .addFields(
                { name: '🔵 Team Blue', value: teamBlue.map(p => `<@${p.userId}>`).join('\n'), inline: true },
                { name: '🟠 Team Orange', value: teamOrange.map(p => `<@${p.userId}>`).join('\n'), inline: true },
                { name: 'Match ID', value: `\`${matchId}\``, inline: false },
                { name: 'Instructions', value: 'Create a private match and invite your teammates. Report the score using `/scrim report` when finished.' }
            )
            .setFooter({ text: 'Armour Studios | Use /scrim report to submit results', iconURL: footerIcon });

        for (const p of players) {
            try {
                const user = await client.users.fetch(p.userId);
                await user.send({ embeds: [notifyEmbed] });
            } catch (err) {
                console.error(`Could not DM user ${p.userId}`);
            }
        }
    }
}
