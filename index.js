// Dependencies
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, ActivityType } = require('discord.js');
require('dotenv').config();
const { PREFIX, DISCORDTOKEN, DISCORD_TOKEN, ALTDISCORDTOKEN } = process.env;
const token = DISCORDTOKEN || DISCORD_TOKEN;

if (!token) {
  console.error('CRITICAL: Discord Token is missing! Please make sure DISCORDTOKEN is set in your environment variables.');
}

const database = require('./database/database');
const accurateInterval = require('accurate-interval');
const { closest } = require('fastest-levenshtein');
const { convertEpochToClock, sendMessage, queryAPI } = require('./functions');
const remindLoop = require('./remind_loop');
const leagueLoop = require('./league_loop');
const fs = require('fs');
const http = require('http');

// Create a dummy server for Render's health check
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TournaBot is online!\n');
}).listen(port, () => {
  console.log(`Health check server listening on port ${port} `);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});
client.commands = new Collection();

// Log every single message event for debugging
client.on('raw', packet => {
  if (packet.t === 'MESSAGE_CREATE') {
    console.log('RAW MESSAGE_CREATE event received');
  }
});

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

// MongoDB Models
// On interaction received (Slash Commands)
client.on('interactionCreate', async interaction => {
  if (interaction.isButton() && interaction.customId.startsWith('requestmod_')) {
    const setId = interaction.customId.split('_')[1];

    await interaction.deferReply({ ephemeral: true });

    try {
      // Query set info
      const query = `query SetQuery($id: ID!) {
        set(id: $id) {
          fullRoundText
          event { name tournament { name url slug } }
          slots { entrant { name participants { user { id } } } }
        }
      }`;
      const { queryAPI } = require('./functions');
      const data = await queryAPI(query, { id: setId });

      if (!data || !data.data || !data.data.set) {
        return interaction.editReply('Could not find match data.');
      }

      const set = data.data.set;
      const tournamentUrl = `https://start.gg/${set.event.tournament.url || 'tournament/' + set.event.tournament.slug}`;

      const alertEmbed = new EmbedBuilder()
        .setTitle('🚨 Moderator Requested')
        .setColor('#FF0000') // Bright Red
        .setDescription(`**Request by:** ${interaction.user}\n**Match:** ${set.slots[0].entrant.name} vs ${set.slots[1].entrant.name}\n**Round:** ${set.fullRoundText}\n**Event:** ${set.event.name}`)
        .addFields({ name: 'Links', value: `[View Match](${tournamentUrl}) | [Bracket](${tournamentUrl}/event/${set.event.id})` })
        .setTimestamp();

      // Find Mod Channel (Look for #mod-requests or fallback to current)
      const modChannel = interaction.guild.channels.cache.find(c => c.name.includes('mod-request') || c.name.includes('moderator')) || interaction.channel;

      await modChannel.send({ content: '@here', embeds: [alertEmbed] });
      await interaction.editReply('Moderators have been notified! 👮');

    } catch (err) {
      console.error(err);
      await interaction.editReply('Error sending mod request.');
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      if (command.autocomplete) {
        await command.autocomplete(interaction, client);
      }
    } catch (error) {
      console.error(error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ping') {
    await interaction.reply('pong!');
    return;
  }

  const slashCommand = client.commands.get(commandName);
  if (!slashCommand) return;

  try {
    // For legacy commands that expect a 'message' object, we might need a shim
    // but for help/account we'll update them later.
    // For now, let's just log it.
    console.log(`Executing interaction command: ${commandName}`);
    if (slashCommand.executeSlash) {
      await slashCommand.executeSlash(interaction, client);
    } else {
      await interaction.reply({ content: 'This command is not yet fully converted to a native Slash Command, but I am working on it!', ephemeral: true });
    }
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
  }
});

// MongoDB Models
const channelModel = require('./database/models/channel');
const accountModel = require('./database/models/account');
const prefixModel = require('./database/models/prefix');

// Initialize client
client.login(token);
//client.login(ALTDISCORDTOKEN); // Alternate token for testing client

const mongoose = require('mongoose');

// On Discord client ready
client.once('ready', async () => {
  console.log(`Ready at ${convertEpochToClock(Date.now() / 1000, 'America/Los_Angeles', true)} `);

  try {
    console.log('Waiting for MongoDB connection...');
    await database; // Waits for the initial connection promise

    // Additional check to ensure the connection is actually 'open'
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB connection established but not yet open. Waiting for open event...');
      await new Promise((resolve, reject) => {
        mongoose.connection.once('open', resolve);
        mongoose.connection.once('error', reject);
      });
    }

    console.log('Connected to MongoDB and ready for queries.');
    console.log(`Bot loaded with PREFIX: "${PREFIX}"(fallback to t!)`);

    client.user.setActivity('for /help', { type: ActivityType.Watching });

    // Loop for tracking and setting tournament reminders
    remindLoop(client);
    leagueLoop(client);
  } catch (err) {
    console.error('CRITICAL: Failed to connect to MongoDB:', err);
    // Log the readyState to help debug
    console.log('MongoDB ReadyState:', mongoose.connection.readyState);
    process.exit(1);
  }
});

// On bot being invited to a Discord server, send message
client.on('guildCreate', guild => {
  let defaultChannel = '';
  guild.channels.cache.forEach((channel) => {
    if (channel.type == 'text' && defaultChannel == '') {
      if (channel.permissionsFor(guild.me).has('SEND_MESSAGES')) {
        defaultChannel = channel;
      }
    }
  });
  const joinEmbed = new EmbedBuilder()
    .setColor('#222326')
    .setDescription(`Thank you for inviting me to ${guild.name}! You can do \`/help\` to get command info. If you enjoy TournaBot's features, please upvote it on the [top.gg page](https://top.gg/bot/719283403698077708)!`);
  defaultChannel.send({ embeds: [joinEmbed] }).catch(err => console.log(err));
  console.log('Added to: ' + guild.name);
});

// On message received, check for commands
client.on('messageCreate', message => {
  if (message.author.bot) return;

  let prefix = PREFIX || 't!';
  if (message.content.toLowerCase() === 'ping' || message.content === `${prefix}ping`) {
    return message.reply(`pong! (Current Prefix: ${prefix})`).catch(err => console.log(err));
  }

  if (message.content.startsWith(`${prefix}help`) || message.content.startsWith(`${prefix}set prefix`)) {
    const command = message.content.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();
    try {
      console.log(`Executing help/set command: ${command}`);
      client.commands.get(command).execute(message, client, message);
      return;
    } catch (err) {
      console.log(`Error executing ${command}:`, err);
    }
    return;
  }

  let guildID = '';
  !message.guild ? guildID = message.channel.id : guildID = message.guild.id;

  prefixModel.find({
    guildid: guildID
  }, function (err, result) {
    if (result.length) {
      prefix = result[0].prefix;
    }

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const command = message.content.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();

    if (!client.commands.has(command)) {
      if (!command) {
        message.channel.send('You can do `/help` to see command info.');
      } else {
        message.reply(`I could not recognize that command. Did you mean \`${prefix}${closest(command, ['help', 'account', 'results', 'dq', 'set', 'announce', 'mm', 'search'])}\`?`);
      }
      return;
    }

    try {
      client.commands.get(command).execute(message, client, message);
    } catch (err) {
      console.error(`Error executing legacy command ${command}:`, err);
    }
  }).catch(err => console.log(err));
});
