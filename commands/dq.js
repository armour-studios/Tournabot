const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const urllib = require('urllib');
const replaceall = require('replaceall');
const accurateInterval = require('accurate-interval');
const { queryAPI, sendMessage } = require('../functions');

// MongoDB Models
const channelModel = require('../database/models/channel');
const accountModel = require('../database/models/account');

// Maps used for tracking DQ pinging (moved from index.js)
const dqReminderMap = new Map();
const dqPingingMap = new Map();

module.exports = {
    name: 'dq',
    description: 'Manage DQ pinging for tournaments',
    async executeSlash(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You don\'t have permissions for that!', ephemeral: true });
        }

        if (subcommand === 'ping') {
            const url = interaction.options.getString('url');
            const eventNumber = interaction.options.getInteger('event_number');
            const eventName = interaction.options.getString('event_name');

            if (dqPingingMap.has(guildId)) {
                return interaction.reply({ content: 'DQ pinging is already running for this server.', ephemeral: true });
            }

            await interaction.deferReply();

            try {
                let urlSlug = '';
                if (url.includes('smash.gg/') || url.includes('start.gg/')) {
                    const cleanUrl = url.replace('https://', '').replace('http://', '');

                    // Handle short URLs or direct tournament URLs
                    if (cleanUrl.startsWith('smash.gg/') || cleanUrl.startsWith('start.gg/')) {
                        // If it's a short URL, we might need to resolve it. 
                        // Simplest is to check if it's /tournament/ first
                        if (cleanUrl.includes('/tournament/')) {
                            urlSlug = cleanUrl.split('/tournament/')[1].split('/')[0];
                            await startDQPinging(urlSlug, eventNumber, eventName, interaction, client);
                        } else {
                            // Short URL resolution
                            urllib.request('https://' + cleanUrl, async (err, data, res) => {
                                if (err) {
                                    console.error(err);
                                    return interaction.editReply('Error resolving tournament URL.');
                                }
                                if (res.headers.location) {
                                    const resolvedSlug = res.headers.location.split('/tournament/')[1].split('/')[0];
                                    await startDQPinging(resolvedSlug, eventNumber, eventName, interaction, client);
                                } else {
                                    return interaction.editReply('Could not find tournament from the provided URL.');
                                }
                            });
                        }
                    } else {
                        return interaction.editReply('Invalid tournament URL format.');
                    }
                } else {
                    return interaction.editReply('Invalid tournament URL format.');
                }
            } catch (err) {
                console.error(err);
                await interaction.editReply('An error occurred while starting DQ pinging.');
            }
        } else if (subcommand === 'stop') {
            const dqLoop = dqPingingMap.get(guildId);
            const dqReminderLoop = dqReminderMap.get(guildId);

            if (dqLoop) dqLoop.clear();
            if (dqReminderLoop) dqReminderLoop.clear();

            if (dqPingingMap.delete(guildId) && dqReminderMap.delete(guildId)) {
                await interaction.reply('DQ Pinging has stopped! :white_check_mark:');
            } else {
                await interaction.reply({ content: 'There is no active DQ pinging currently.', ephemeral: true });
            }
        }
    },
};

async function startDQPinging(slug, eventNumber, eventName, interaction, client) {
    const guildId = interaction.guild.id;

    try {
        const channelRecord = await channelModel.findOne({ guildid: `${guildId}dq` });
        if (!channelRecord) {
            return interaction.editReply('No DQ pinging channel set. Use `/set dqpingchannel` first.');
        }

        const dqChannel = client.channels.cache.get(channelRecord.channelid);
        if (!dqChannel) {
            return interaction.editReply('The configured DQ pinging channel no longer exists or I cannot see it.');
        }

        const query = `query TournamentStartAndEnd($slug: String) {
      tournament(slug: $slug) {
        name
        endAt
        events {
          startAt
          name
        } 
      }
    }`;

        const data = await queryAPI(query, { slug });
        if (!data || !data.data || !data.data.tournament) {
            return interaction.editReply('Could not find tournament data for the provided URL.');
        }

        const tournament = data.data.tournament;
        const tournamentEnd = tournament.endAt * 1000;
        const autoStop = Date.now() + 21600000; // 6 hours

        let indexEvent = eventNumber ? eventNumber - 1 : null;
        let filterByName = !!eventName;
        let tournamentStarted = tournament.events.some(e => Date.now() >= e.startAt * 1000);

        if (!tournamentStarted) {
            return interaction.editReply('DQ pinging cannot start yet - the tournament has not started.');
        }

        await interaction.editReply('Starting DQ pinging...');
        console.log(`Starting DQ pinging in ${interaction.guild.name} for ${tournament.name}`);

        // DQ Logic Loop
        let messagesSent = 20;
        let setsPinged = new Set();

        const reminderEmbed = new EmbedBuilder()
            .setColor('#222326')
            .setDescription(`If your username shows up in **bold**, make sure to link your account via \`/account link\` in order to get pinged!\n\nYou can also get pinged by going to **Connected Accounts** on start.gg and displaying your Discord account on your profile.`);

        dqReminderMap.set(guildId, accurateInterval(() => {
            if (messagesSent >= 20) {
                messagesSent = 0;
                dqChannel.send({ embeds: [reminderEmbed] }).catch(console.error);
            }
        }, 3600000, { immediate: true }));

        dqPingingMap.set(guildId, accurateInterval(async () => {
            if (Date.now() >= tournamentEnd || Date.now() >= autoStop) {
                stopDQPinging(guildId, dqChannel, Date.now() >= tournamentEnd ? 'tournament ended' : 'six hour limit');
                return;
            }

            const setsQuery = `query EventSets($slug: String) {
        tournament(slug: $slug) {
          events {
            name
            sets(sortType: RECENT, filters: {state: 6}) {
              nodes {
                id
                fullRoundText
                slots {
                  entrant {
                    name
                    participants {
                      gamerTag
                      user {
                        slug
                        authorizations(types: [DISCORD]) {
                          type
                          externalId
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } 
      }`;

            const setsData = await queryAPI(setsQuery, { slug });
            if (!setsData || !setsData.data || !setsData.data.tournament) return;

            const activeEvents = setsData.data.tournament.events;

            for (let i = 0; i < activeEvents.length; i++) {
                const event = activeEvents[i];

                // Filter logic
                if (indexEvent !== null && i !== indexEvent) continue;
                if (filterByName && event.name.toLowerCase() !== eventName.toLowerCase()) continue;

                const sets = event.sets.nodes;
                if (!sets) continue;

                for (const set of sets) {
                    if (!setsPinged.has(set.id)) {
                        setsPinged.add(set.id);

                        const quips = ['Please check-in on start.gg!', 'Get ready to rumble!', 'Round 1, FIGHT!', '3.. 2.. 1.. GO!', 'Choose your character!', 'Start battle!'];
                        const roundText = `\`${set.fullRoundText}\` in **${event.name}** has been called. ${quips[Math.floor(Math.random() * quips.length)]}`;

                        await pingUser(set, roundText, dqChannel);
                        messagesSent++;
                    }
                }
            }
        }, 10000, { immediate: true }));

    } catch (err) {
        console.error(err);
        await interaction.editReply('An error occurred during DQ pinging setup.');
    }
}

async function pingUser(set, roundText, dqChannel) {
    let entrantMentions = ['', ''];
    let entrantSlugs = ['', ''];

    for (let i = 0; i < 2; i++) {
        const slot = set.slots[i];
        if (!slot || !slot.entrant) continue;

        const participant = slot.entrant.participants[0];
        let tag = participant.gamerTag.replace(/\*/g, '\\*').replace(/_/g, '\\_');
        entrantMentions[i] = `**${tag}**`;

        if (participant.user) {
            entrantSlugs[i] = participant.user.slug.replace('user/', '');
            const discordAuth = participant.user.authorizations?.find(a => a.type === 'DISCORD');
            if (discordAuth?.externalId) {
                entrantMentions[i] = `<@${discordAuth.externalId}>`;
            }
        }
    }

    try {
        const linkedAccounts = await accountModel.find({ profileslug: { $in: entrantSlugs.filter(s => s) } });
        for (const account of linkedAccounts) {
            const index = entrantSlugs.indexOf(account.profileslug);
            if (index !== -1) {
                entrantMentions[index] = `<@${account.discordid}>`;
            }
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

        const matchEmbed = new EmbedBuilder()
            .setTitle('⚔️ Match Called')
            .setColor('#FF3636')
            .setDescription(`${entrantMentions[0]} vs ${entrantMentions[1]}\n${roundText}`)
            .setFooter({ text: 'Powered by TournaBot', iconURL: 'https://i.imgur.com/gUwhkw3.png' })
            .setTimestamp();

        const modButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`requestmod_${set.id}`)
                .setLabel('Request Moderator')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('👮')
        );

        await dqChannel.send({ content: `${entrantMentions[0]} ${entrantMentions[1]}`, embeds: [matchEmbed], components: [modButton] });
    } catch (err) {
        console.error('Error in pingUser:', err);
    }
}

function stopDQPinging(guildId, channel, reason) {
    const dqLoop = dqPingingMap.get(guildId);
    const dqReminderLoop = dqReminderMap.get(guildId);
    if (dqLoop) dqLoop.clear();
    if (dqReminderLoop) dqReminderLoop.clear();
    dqPingingMap.delete(guildId);
    dqReminderMap.delete(guildId);

    if (channel) {
        channel.send(`Stopping DQ pinging - ${reason}.`).catch(console.error);
    }
    console.log(`DQ pinging stopped in guild ${guildId} due to ${reason}`);
}
