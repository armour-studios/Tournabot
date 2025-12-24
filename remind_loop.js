const { EmbedBuilder } = require('discord.js');
const { Vibrant } = require('node-vibrant/node');
const accurateInterval = require('accurate-interval');
const setAccurateTimeout = require('set-accurate-timeout');
const { convertEpoch, convertEpochToClock, queryAPI } = require('./functions');

// MongoDB Models
const accountModel = require('./database/models/account');

// Map used for tracking reminders
const reminderMap = new Map();

async function remindLoop(client) {
  const loop = accurateInterval(setReminders, 3600000, { immediate: true });

  let loopTracker = 0;
  async function setReminders() {
    loopTracker++;
    console.log(`Iterating through reminder loop ${loopTracker} at ${convertEpochToClock(Date.now() / 1000, 'America/Los_Angeles', true)}`);

    try {
      const users = await accountModel.find({ reminder: true });

      for (let user of users) {
        let discordID = user.discordid;
        if (reminderMap.has(discordID)) continue;

        const slug = user.profileslug;
        const query = `query UserUpcomingTournaments($slug: String) {
          user(slug: $slug) {
            tournaments(query: {filter: { upcoming: true, past: false }}) {
              nodes {
                name
                slug
                numAttendees
                startAt
                isOnline
                images { height width url }
                events {
                  name
                  numEntrants
                  startAt
                  checkInEnabled
                  checkInBuffer
                  checkInDuration
                }
                streams {
                  streamSource
                  streamName
                }
              }
            }
          }
        }`;

        const data = await queryAPI(query, { slug });
        if (!data || !data.data || !data.data.user || !data.data.user.tournaments || !data.data.user.tournaments.nodes) continue;

        let upcomingTournaments = data.data.user.tournaments.nodes;
        // Sort to find the nearest one
        upcomingTournaments.sort((a, b) => a.startAt - b.startAt);

        for (let tournament of upcomingTournaments) {
          let timeDiff = tournament.startAt - Date.now() / 1000;

          // If within 1-2 hours, set reminder for 1 hour before start
          if (timeDiff <= 7200 && timeDiff >= 3600) {
            console.log(`Setting reminder for ${tournament.name} to ${user.discordtag || discordID}`);
            let offset = (tournament.startAt * 1000) - Date.now() - 3600000;

            reminderMap.set(discordID, setAccurateTimeout(() => reminder(discordID, tournament), offset));
            break; // Only set one reminder at a time
          }
        }
      }
    } catch (err) {
      console.error('Error in reminder loop:', err);
    }
  }

  async function reminder(id, tournament) {
    let thumb = '';
    let banner = '';
    if (tournament.images) {
      thumb = tournament.images.find(img => img.height === img.width)?.url || '';
      banner = tournament.images.find(img => img.height !== img.width)?.url || '';
    }

    let sideColor = '#222326';
    if (thumb) {
      try {
        const palette = await Vibrant.from(thumb).getPalette();
        if (palette.Vibrant) sideColor = palette.Vibrant.getHex();
      } catch (err) {
        console.error('Vibrant error:', err);
      }
    }

    const events = tournament.events.slice(0, 3).map(e => {
      let text = `**${e.name}** (${e.numEntrants} entrants)\n*${convertEpoch(e.startAt, 'America/Los_Angeles')}*`;
      if (e.checkInEnabled) {
        text += `\n__Check-in: ${convertEpochToClock(e.startAt - e.checkInBuffer - e.checkInDuration, 'America/Los_Angeles', false)} - ${convertEpochToClock(e.startAt - e.checkInBuffer, 'America/Los_Angeles', false)}__`;
      }
      return text;
    }).join('\n\n');

    const streams = tournament.streams
      .filter(s => s.streamSource === 'TWITCH')
      .map(s => `https://twitch.tv/${s.streamName}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(sideColor)
      .setTitle(tournament.name)
      .setURL(`https://start.gg/${tournament.slug}`)
      .setThumbnail(thumb)
      .setImage(banner)
      .addFields(
        { name: 'Tournament Info', value: `${tournament.numAttendees} Attendees\n${tournament.isOnline ? 'Online' : 'Offline'}\n${convertEpoch(tournament.startAt, 'America/Los_Angeles')}`, inline: true },
        { name: 'Events', value: events || 'N/A', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'TournaBot', iconURL: 'https://cdn.discordapp.com/attachments/719461475848028201/777094320531439636/image.png' });

    if (streams) embed.addFields({ name: 'Streams', value: streams });

    try {
      const user = await client.users.fetch(id);
      await user.send({ content: '**REMINDER:** You have signed up for the following tournament, which begins in an hour:', embeds: [embed] });
      console.log(`Reminder sent to ${user.tag}`);
    } catch (err) {
      console.error(`Could not send reminder to ${id}:`, err);
    } finally {
      reminderMap.delete(id);
    }
  }
}

module.exports = remindLoop;
