const { EmbedBuilder } = require('discord.js');
const { SMASHGGTOKEN } = process.env;
const languageModel = require('./database/models/language');
const fetch = require('node-fetch');

function convertEpoch(epoch, citytimezone) {
  let convertedTime;
  let date = new Date(0);
  date.setUTCSeconds(epoch);
  let year = date.toLocaleString('default', { year: 'numeric', timeZone: citytimezone });
  let month = date.toLocaleString('default', { month: 'long', timeZone: citytimezone });
  let monthDate = date.toLocaleString('default', { day: '2-digit', timeZone: citytimezone });
  let dayOfTheWeek = date.toLocaleString('default', { weekday: 'long', timeZone: citytimezone });
  let hour = date.toLocaleString('default', { hour: '2-digit', timeZone: citytimezone });
  let minutes = date.toLocaleString('default', { minute: '2-digit', timeZone: citytimezone });
  let timezone = date.toLocaleString('default', { timeZoneName: 'short', timeZone: citytimezone });
  let firstTen = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'];
  let ampm;

  if (monthDate.startsWith(0)) monthDate = monthDate.slice(1);

  hour.includes('PM') ? ampm = 'PM' : ampm = 'AM';
  hour = hour.replace(/\D/g, '');
  if (hour.startsWith(0)) hour = hour.slice(1);

  if (minutes.length === 1) minutes = firstTen[minutes];

  timezone = timezone.slice(timezone.length - 3);

  convertedTime = `${dayOfTheWeek}, ${month} ${monthDate}, ${year}, at ${hour}:${minutes} ${ampm} ${timezone}`;
  return convertedTime;
}

function convertEpochToClock(epoch, citytimezone, showSeconds) {
  let convertedTime;
  let date = new Date(0);
  date.setUTCSeconds(epoch);
  let hour = date.toLocaleString('default', { hour: '2-digit', timeZone: citytimezone });
  let minutes = date.toLocaleString('default', { minute: '2-digit', timeZone: citytimezone });
  let firstTen = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'];
  let seconds = '';
  let ampm;

  hour.includes('PM') ? ampm = 'PM' : ampm = 'AM';
  hour = hour.replace(/\D/g, '');
  if (hour.startsWith(0)) hour = hour.slice(1);

  if (minutes.length === 1) minutes = firstTen[minutes];

  if (showSeconds) {
    seconds = `${date.getSeconds()}`;
    seconds.length === 1 ? seconds = `:${firstTen[seconds]}` : seconds = `:${seconds}`;
  }

  convertedTime = `${hour}:${minutes}${seconds} ${ampm}`;
  return convertedTime;
}

async function generateAndSend(finalMessage, target, messageType) {
  const messageEmbed = new EmbedBuilder()
    .setColor('#222326')
    .setDescription(finalMessage);

  try {
    if (target.reply && (messageType === 'REPLY' || !target.channel)) {
      await target.reply({ content: messageType === 'REPLY' ? finalMessage : null, embeds: messageType === 'EMBED' || !messageType ? [messageEmbed] : [] });
    } else if (target.channel) {
      if (messageType === 'EMBED' || !messageType) {
        await target.channel.send({ embeds: [messageEmbed] });
      } else {
        await target.channel.send(finalMessage);
      }
    } else if (target.send) { // User object
      await target.send({ content: messageType === 'REPLY' ? finalMessage : null, embeds: messageType === 'EMBED' || !messageType ? [messageEmbed] : [] });
    }
  } catch (err) {
    console.error('Error in generateAndSend:', err);
  }
}

async function sendMessage(target, specifiedMessage, messageType) {
  let guildID = '';
  if (target.guildId) guildID = target.guildId;
  else if (target.guild) guildID = target.guild.id;
  else if (target.channel) guildID = target.channel.id;

  try {
    const result = await languageModel.findOne({ guildid: guildID });

    if (result && result.language && result.language !== 'en') {
      const encodedMessage = encodeURIComponent(specifiedMessage).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16));
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodedMessage}&langpair=en|${result.language}&de=random@gmail.com`);
      const json = await response.json();

      let translation = json.responseData.translatedText;
      if (translation && translation.toUpperCase() !== translation) {
        return generateAndSend(translation, target, messageType);
      }
    }

    generateAndSend(specifiedMessage, target, messageType);
  } catch (err) {
    console.error('Error in sendMessage:', err);
    generateAndSend(specifiedMessage, target, messageType);
  }
}

async function queryAPI(query, variables) {
  try {
    const response = await fetch('https://api.start.gg/gql/alpha', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + SMASHGGTOKEN
      },
      body: JSON.stringify({ query, variables })
    });
    return await response.json();
  } catch (err) {
    console.error('API Query Error:', err);
    return null;
  }
}

const guildSettingsModel = require('./database/models/guild_settings');

const defaultBranding = {
  name: 'Armour Studios',
  icon: 'https://i.imgur.com/tDN2QeJ.png',
  color: '#FF3399'
};

async function getBranding(guildId) {
  if (!guildId) return defaultBranding;
  try {
    const settings = await guildSettingsModel.findOne({ guildId });
    if (settings) {
      return {
        name: settings.customName || defaultBranding.name,
        icon: settings.customLogo || defaultBranding.icon,
        color: settings.brandingColor || defaultBranding.color
      };
    }
  } catch (err) {
    console.error('Error fetching branding:', err);
  }
  return defaultBranding;
}

async function broadcastAlert(client, sourceGuildId, queueType, details) {
  const branding = await getBranding(sourceGuildId);
  const footerIcon = branding.icon;

  const alertEmbed = new EmbedBuilder()
    .setColor(branding.color)
    .setTitle(`📢 ${queueType === 'scrim' ? 'Scrimmage' : 'Pro Queue'} Alert!`)
    .setAuthor({ name: branding.name, iconURL: branding.icon })
    .setDescription(details)
    .setFooter({ text: 'Armour Studios Cross-Server Network', iconURL: footerIcon })
    .setTimestamp();

  try {
    const partneredGuilds = await guildSettingsModel.find({
      promotionChannels: { $exists: true, $not: { $size: 0 } }
    });

    for (const guildData of partneredGuilds) {
      const targetGuild = client.guilds.cache.get(guildData.guildId);
      if (!targetGuild) continue;

      for (const channelId of guildData.promotionChannels) {
        const channel = targetGuild.channels.cache.get(channelId);
        if (channel) {
          try {
            await channel.send({ embeds: [alertEmbed] });
          } catch (err) {
            console.error(`Failed to broadcast to ${channelId} in ${targetGuild.name}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in broadcastAlert:', err);
  }
}

function extractSlug(url) {
  if (!url) return null;
  // Normalize URL
  const cleanUrl = url.split('?')[0].split('#')[0];
  const parts = cleanUrl.split('/').filter(Boolean);

  // Check for event deep link first (most specific)
  const eventIndex = parts.findIndex(p => p.toLowerCase() === 'event' || p.toLowerCase() === 'events');
  const tournamentIndex = parts.findIndex(p => p.toLowerCase() === 'tournament');

  // Case 1: tournament/xyz/event/abc
  if (tournamentIndex !== -1 && eventIndex !== -1 && parts[eventIndex + 1]) {
    return `tournament/${parts[tournamentIndex + 1]}/event/${parts[eventIndex + 1]}`;
  }

  // Case 2: tournament/xyz/events -> tournament/xyz
  if (tournamentIndex !== -1 && eventIndex !== -1 && !parts[eventIndex + 1]) {
    return `tournament/${parts[tournamentIndex + 1]}`;
  }

  // Case 3: tournament/xyz
  if (tournamentIndex !== -1 && parts[tournamentIndex + 1]) {
    return `tournament/${parts[tournamentIndex + 1]}`;
  }

  // Case 4: league/xyz
  const leagueIndex = parts.findIndex(p => p.toLowerCase() === 'league');
  if (leagueIndex !== -1 && parts[leagueIndex + 1]) {
    return `league/${parts[leagueIndex + 1]}`;
  }

  // Fallback: just return the slug if it looks like one, or the last part
  // Avoid returning 'events' if it's the last part
  let lastPart = parts[parts.length - 1];
  if (lastPart.toLowerCase() === 'events') {
    return parts[parts.length - 2];
  }

  return lastPart;
}

async function fetchEntity(slug, typeHint = null) {
  console.log(`[fetchEntity] Calling fetchEntity with slug: "${slug}", hint: "${typeHint}"`);
  const tournamentQuery = `query TournamentInfo($slug: String!) {
    tournament(slug: $slug) {
      id name url images { url type } startAt registrationClosesAt endAt
      events { name startAt checkInEnabled checkInBuffer checkInDuration }
      streams { streamSource streamName }
    }
  }`;

  const leagueQuery = `query LeagueInfo($slug: String!) {
    league(slug: $slug) {
      id name url images { url type } startAt registrationClosesAt endAt
      events(query: { perPage: 15 }) { 
        nodes {
          name startAt checkInEnabled checkInBuffer checkInDuration
        }
      }
    }
  }`;

  const isLeagueHint = typeHint === 'league';

  // Try hinted query first
  let query = isLeagueHint ? leagueQuery : tournamentQuery;
  let data = await queryAPI(query, { slug });
  let entity = isLeagueHint ? data?.data?.league : data?.data?.tournament;
  let finalType = isLeagueHint ? 'league' : 'tournament';

  // Fallback: If hinted query fails, try the other one
  if (!entity) {
    console.log(`[fetchEntity] Hinted query (${finalType}) failed or returned nothing. Trying fallback...`);
    query = isLeagueHint ? tournamentQuery : leagueQuery;
    data = await queryAPI(query, { slug });
    entity = isLeagueHint ? data?.data?.tournament : data?.data?.league;
    if (entity) finalType = isLeagueHint ? 'tournament' : 'league';
  }

  if (entity) {
    console.log(`[fetchEntity] Found entity: ${entity.name} (${finalType})`);
    entity.type = finalType;

    // Normalize events for leagues
    if (finalType === 'league' && entity.events?.nodes) {
      entity.events = entity.events.nodes;
    }
  } else {
    console.log(`[fetchEntity] No entity found for slug: ${slug}`);
    if (data?.errors) console.log(`[fetchEntity] API Errors:`, JSON.stringify(data.errors, null, 2));
  }

  return entity;
}

module.exports = {
  convertEpoch: convertEpoch,
  convertEpochToClock: convertEpochToClock,
  sendMessage: sendMessage,
  queryAPI: queryAPI,
  getBranding: getBranding,
  broadcastAlert: broadcastAlert,
  extractSlug: extractSlug,
  fetchEntity: fetchEntity,
  footerIcon: defaultBranding.icon,
  startggIcon: 'https://i.imgur.com/P4u3K0j.png'
};
