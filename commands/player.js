const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { queryAPI, footerIcon, convertEpoch } = require('../functions');
const accountModel = require('../database/models/account');
const timezoneModel = require('../database/models/timezone');
const { Vibrant } = require('node-vibrant/node');
const replaceall = require('replaceall');

module.exports = {
    name: 'player',
    description: 'View player statistics and history',
    async executeSlash(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'profile') {
            await handleProfile(interaction);
        } else if (subcommand === 'results') {
            await handleResults(interaction);
        } else if (subcommand === 'head2head') {
            await handleHead2Head(interaction);
        }
    }
};

// --- Subcommand Handlers ---

async function handleProfile(interaction) {
    const input = interaction.options.getString('user');
    if (!input) return interaction.reply({ content: 'Please provide a player tag or slug.', ephemeral: true });

    await interaction.deferReply();

    try {
        const query = `query PlayerProfile($slug: String) {
            user(slug: $slug) {
                player {
                    id
                    gamerTag
                    prefix
                    images { url type }
                }
                images { url type }
                tournaments(query: { perPage: 5, filter: { past: true } }) {
                    nodes {
                        name
                        startAt
                        slug
                        events {
                            name
                            standings(query: { perPage: 1 }) {
                                nodes { placement entrant { name } }
                            }
                        }
                    }
                }
            }
        }`;

        const data = await queryAPI(query, { slug: input });
        if (!data || !data.data || !data.data.user) {
            return interaction.editReply(`Could not find profile for **${input}**. Try using their start.gg slug.`);
        }

        const user = data.data.user;
        const player = user.player;
        const mainImg = user.images?.find(i => i.type === 'profile')?.url || player.images?.[0]?.url || footerIcon;

        const tourneyList = user.tournaments.nodes.map(t => {
            const event = t.events[0];
            const placement = event?.standings?.nodes?.[0]?.placement || 'N/A';
            return `**${t.name}**: ${placement}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Start.gg Player Profile', iconURL: footerIcon })
            .setTitle(`${player.prefix ? player.prefix + ' | ' : ''}${player.gamerTag}`)
            .setURL(`https://start.gg/user/${input}`)
            .setThumbnail(mainImg)
            .setColor('#FF3399')
            .addFields(
                { name: '🎮 ID', value: player.id.toString(), inline: true },
                { name: '🌍 Profile Status', value: 'Verified', inline: true },
                { name: '🏆 Recent Results', value: tourneyList || 'No recent tournaments found.', inline: false }
            )
            .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching the profile.');
    }
}

async function handleResults(interaction) {
    const userInput = interaction.options.getString('user');
    const user = interaction.user;
    let userslug;

    if (userInput) {
        const cleanId = userInput.replace(/[<@!>]/g, '');
        const result = await accountModel.findOne({ $or: [{ discordid: cleanId }, { discordtag: userInput }] });
        if (result) {
            userslug = result.profileslug;
        } else {
            // If checking another user who isn't linked, maybe try to treat input as slug directly?
            // "The user to check (ID, mention, or tag)" implies Discord user usually.
            // But let's assume strict DB lookup for now as per original command.
            return interaction.reply({ content: `I could not find **${userInput}** in my database. They need to link their account first!`, ephemeral: true });
        }
    } else {
        const result = await accountModel.findOne({ discordid: user.id });
        if (result) {
            userslug = result.profileslug;
        } else {
            return interaction.reply({ content: `Your account is not linked! Use \`/account link\` to link it.`, ephemeral: true });
        }
    }

    await interaction.deferReply();

    try {
        const userInfoQuery = `query PlayerInfo($slug: String) {
            user(slug: $slug) {
                images { url height width }
                player { id gamerTag }
            }
        }`;
        const userInfo = await queryAPI(userInfoQuery, { slug: userslug });
        if (!userInfo || !userInfo.data || !userInfo.data.user) {
            return interaction.editReply('Could not find start.gg information for this user.');
        }

        const name = userInfo.data.user.player.gamerTag;
        const playerIds = userInfo.data.user.player.id;
        let imageurl = userInfo.data.user.images[0]?.url || null;

        const guildID = interaction.guildId;
        const tzResult = await timezoneModel.findOne({ guildid: guildID });
        const cityTimezone = tzResult ? tzResult.timezone : 'America/Los_Angeles';

        let tournaments = [];
        let page = 1;

        // Fetch up to 3 recent tournaments with sets
        while (tournaments.length < 3 && page < 5) {
            const resultsQuery = `query Results($page: Int, $slug: String, $playerIds: ID) {
                user(slug: $slug) {
                    tournaments(query: {page: $page, perPage: 3, filter: { past: true }}) {
                        nodes {
                            slug startAt name isOnline numAttendees
                            images { url }
                            events {
                                name numEntrants
                                sets(sortType: RECENT, filters: { playerIds: [$playerIds] }) {
                                    nodes {
                                        id
                                        fullRoundText displayScore winnerId
                                        event { name }
                                        slots(includeByes: true) {
                                            entrant { 
                                                id name 
                                                standing { placement }
                                                participants { gamerTag player { id } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }`;

            const data = await queryAPI(resultsQuery, { page, slug: userslug, playerIds });
            const nodes = data?.data?.user?.tournaments?.nodes;
            if (!nodes) break;

            for (const node of nodes) {
                let setsFound = false;
                let eventInfo = [];
                let setsList = [];

                for (const event of node.events) {
                    if (event.sets.nodes.length > 0) setsFound = true;
                    for (const set of event.sets.nodes) {
                        if (set.displayScore) {
                            let formattedScore = replaceall('*', '\\*', set.displayScore);
                            formattedScore = replaceall('_', '\\_', formattedScore);
                            setsList.push(`**${set.fullRoundText}:** ${formattedScore}`);
                        } else {
                            setsList.push(`**${set.fullRoundText}:** No score found.`);
                        }

                        const mySlot = set.slots.find(s => s.entrant?.participants[0]?.player?.id === playerIds);
                        if (mySlot && !eventInfo.some(e => e.name === event.name)) {
                            eventInfo.push({ name: event.name, placement: mySlot.entrant.standing.placement, total: event.numEntrants });
                        }
                    }
                }

                if (setsFound && tournaments.length < 3) {
                    tournaments.push({
                        name: node.name,
                        url: `https://start.gg/${node.slug}`,
                        date: convertEpoch(node.startAt, cityTimezone),
                        stats: eventInfo,
                        sets: setsList.slice(0, 5),
                        image: node.images && node.images.length > 0 ? node.images[0].url : null
                    });
                }
            }
            page++;
        }

        if (tournaments.length === 0) {
            return interaction.editReply('No recent tournament results found for this user.');
        }

        let sideColor = '#222326';
        if (imageurl) {
            try {
                const vibrant = new Vibrant(imageurl);
                const palette = await vibrant.getPalette();
                if (palette.Vibrant && palette.Vibrant.hex) {
                    sideColor = palette.Vibrant.hex;
                }
            } catch (err) {
                console.error("Error getting vibrant color:", err);
            }
        }

        const generateEmbed = (index) => {
            const t = tournaments[index];
            return new EmbedBuilder()
                .setAuthor({ name: `Tournament Results: ${name}`, iconURL: imageurl || footerIcon })
                .setTitle(t.name)
                .setURL(t.url)
                .setColor(sideColor)
                .setThumbnail(t.image || imageurl)
                .addFields(
                    { name: '📊 Event Placements', value: t.stats.map(e => `**${e.name}**: ${e.placement}/${e.total}`).join('\n') || 'N/A', inline: false },
                    { name: '⚔️ Recent Sets', value: t.sets.join('\n') || 'N/A', inline: false }
                )
                .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon })
                .setTimestamp();
        };

        let currentIndex = 0;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(tournaments.length <= 1)
        );

        const response = await interaction.editReply({ embeds: [generateEmbed(currentIndex)], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== user.id) return i.reply({ content: 'Not your buttons!', ephemeral: true });

            if (i.customId === 'next' && currentIndex < tournaments.length - 1) currentIndex++;
            else if (i.customId === 'prev' && currentIndex > 0) currentIndex--;

            const newRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentIndex === 0),
                new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(currentIndex === tournaments.length - 1)
            );

            await i.update({ embeds: [generateEmbed(currentIndex)], components: [newRow] });
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(true)
            );
            interaction.editReply({ components: [disabledRow] }).catch(() => { });
        });

    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching results.');
    }
}

async function handleHead2Head(interaction) {
    const player1Input = interaction.options.getString('player1');
    const player2Input = interaction.options.getString('player2');

    if (!player1Input || !player2Input) {
        return interaction.reply({ content: 'Please provide two player tags or profile slugs.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const players = [];
        const inputs = [player1Input, player2Input];

        for (const input of inputs) {
            let data = await queryAPI(`query PlayerBySlug($slug: String) { user(slug: $slug) { player { id gamerTag images { url } } } }`, { slug: input });

            if (data?.data?.user?.player) {
                players.push({
                    id: data.data.user.player.id,
                    tag: data.data.user.player.gamerTag,
                    image: data.data.user.player.images?.[0]?.url || null
                });
            } else {
                return interaction.editReply(`Could not find player: **${input}**. Please use their start.gg profile slug.`);
            }
        }

        const setsQuery = `query H2HSets($playerId: ID, $page: Int) {
            player(id: $playerId) {
                sets(perPage: 100, page: $page, filters: { hideEmpty: true }) {
                    nodes {
                        displayScore
                        fullRoundText
                        winnerId
                        event { name tournament { name } }
                        slots { entrant { id name participants { player { id } } } }
                    }
                }
            }
        }`;

        const setsData = await queryAPI(setsQuery, { playerId: players[0].id, page: 1 });
        const allSets = setsData?.data?.player?.sets?.nodes || [];

        const h2hSets = allSets.filter(set =>
            set.slots.some(slot => slot.entrant?.participants?.some(p => p.player?.id == players[1].id))
        );

        if (h2hSets.length === 0) {
            return interaction.editReply(`No recorded matches found between **${players[0].tag}** and **${players[1].tag}** on start.gg.`);
        }

        let p1Wins = 0;
        let p2Wins = 0;
        const history = [];

        h2hSets.forEach(set => {
            const p1Winner = set.winnerId == players[0].id || set.slots.find(s => s.entrant?.id === set.winnerId)?.entrant?.participants?.some(p => p.player?.id == players[0].id);
            const p2Winner = set.winnerId == players[1].id || set.slots.find(s => s.entrant?.id === set.winnerId)?.entrant?.participants?.some(p => p.player?.id == players[1].id);

            if (p1Winner) p1Wins++;
            else if (p2Winner) p2Wins++;

            history.push(`**${set.event.tournament.name}**\n${set.displayScore} (${set.fullRoundText})`);
        });

        const winRate = ((p1Wins / (p1Wins + p2Wins)) * 100).toFixed(1);

        const embed = new EmbedBuilder()
            .setTitle(`⚔️ Head-to-Head: ${players[0].tag} vs ${players[1].tag}`)
            .setColor(p1Wins > p2Wins ? '#36FF7D' : (p2Wins > p1Wins ? '#FF3399' : '#FFFF00'))
            .setThumbnail(players[0].image || players[1].image || footerIcon)
            .addFields(
                { name: '📊 Lifetime Record', value: `**${players[0].tag}** ${p1Wins} - ${p2Wins} **${players[1].tag}**`, inline: false },
                { name: '📈 Win Rate', value: `${winRate}% in favor of ${p1Wins >= p2Wins ? players[0].tag : players[1].tag}`, inline: true },
                { name: '🔥 Total Sets', value: `${h2hSets.length}`, inline: true },
                { name: '🕒 Recent Matchup', value: history[0] || 'N/A', inline: false }
            )
            .setFooter({ text: 'Powered by NE Network', iconURL: footerIcon })
            .setTimestamp();

        if (history.length > 1) {
            embed.addFields({ name: '📜 Match History', value: history.slice(0, 5).join('\n\n') });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while comparing players.');
    }
}
