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

module.exports = {
  convertEpoch: convertEpoch,
  convertEpochToClock: convertEpochToClock,
  sendMessage: sendMessage,
  queryAPI: queryAPI
};
