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
  name: 'NE Network Bot',
  icon: 'https://i.imgur.com/ntLntdz.png', // NE Network Logo
  color: '#FF3399'
};

async function getBranding(guildId) {
  return defaultBranding;
}

async function broadcastAlert(client, sourceGuildId, queueType, details) {
  const branding = await getBranding(sourceGuildId);
  const footerIcon = branding.icon;

  const alertEmbed = new EmbedBuilder()
    .setColor(branding.color)
    .setTitle(`📢 ${queueType === 'scrim' ? 'Scrimmage' : 'Pro Queue'} Alert!`)
    .setAuthor({ name: branding.name, iconURL: branding.icon })
    .setDescription(`${details}\n\n[**Join the Scrim Discord**](https://discord.com/invite/G9uMk2N9bY)`)
    .setFooter({ text: 'NE Network Cross-Server System', iconURL: footerIcon })
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

  // 1. Clean URL: remove protocol, www, query params, hash
  let clean = url.replace(/^(?:https?:\/\/)?(?:www\.)?start\.gg\//i, '')
    .replace(/^(?:https?:\/\/)?(?:www\.)?smash\.gg\//i, '')
    .split('?')[0]
    .split('#')[0];

  // Remove trailing slash
  if (clean.endsWith('/')) clean = clean.slice(0, -1);

  // 2. Identify Type (Tournament vs League)
  // Regex to capture type and slug: (tournament|league|hub)/([^/]+)
  // Check for event component: (tournament|league|hub)/([^/]+)/event/([^/]+) or events/([^/]+)
  const eventMatch = clean.match(/^(tournament|league|hub)\/([^/]+)\/(?:event|events)\/([^/]+)/i);
  if (eventMatch) {
    const type = eventMatch[1].toLowerCase();
    const slug = eventMatch[2];
    const eventSlug = eventMatch[3];
    // Return full event path for deep links
    return `${type}/${slug}/event/${eventSlug}`;
  }

  const typeMatch = clean.match(/^(tournament|league|hub)\/([^/]+)/i);
  if (typeMatch) {
    const type = typeMatch[1].toLowerCase();
    const slug = typeMatch[2];

    if (type === 'hub') return `league/${slug}`; // Treat hubs as leagues
    return `${type}/${slug}`;
  }

  // 3. Handle Short/Ambiguous Links (e.g. start.gg/genesis-8)
  // If no type prefix, assume it's a slug directly.
  // We return just the slug, and let fetchEntity try both tournament and league queries.
  // However, `fetchEntity` expects "tournament/slug" or "league/slug" to be safer if we want to be strict,
  // BUT the current fetchEntity logic logic tries based on hint or fallback.
  // Let's look at the parts.
  const parts = clean.split('/');

  // If it's just one part "genesis-8", return it as is -> let fetchEntity decide
  if (parts.length === 1) return parts[0];

  // If complex path but no known prefix, return the first part as a potential slug?
  // e.g. "genesis-8/events/..." -> "genesis-8"
  return parts[0];
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
