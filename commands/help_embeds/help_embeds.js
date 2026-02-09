const { EmbedBuilder } = require('discord.js');
const { footerIcon } = require('../../functions');

const generateHelpSelection = index => {
  const descriptions = [`
➡ **Accounts**
Armour Studios handles account linking between start.gg and Discord.

➡ **Teams & Scrims**
Create a team, join scrims, and climb the global leaderboards.

➡ **Global Broadcasts**
Share your tournament updates across the Armour Studios network.

➡ **Tournament Reminders**
Automatic reminders for your tournaments an hour before they begin.

➡ **Match Calling (DQ Pinging)**
Pings users in a specified channel when their set is called.
`, `
➡ **Tournament Announcing**
Announces tournaments with registration/event times and info.

➡ **Leagues**
Link entire Start.gg leagues or standalone tournaments for tracking.

➡ **Localization**
Access complete localization through timezones and languages.

➡ **Tournament Searching**
Search for start.gg tournaments by game directly in your server.

➡ **More Info**
Support server, developer contact, and open-source info.
`];
  const helpSelectionEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(descriptions[index])
    .setFooter({ text: `Page ${index + 1} of 2`, iconURL: footerIcon });

  return helpSelectionEmbed;
}

const generateAccountsEmbed = index => {
  const label = '**Accounts**';
  const descriptions = [`
> \`/account link <smash.gg profile URL>\`

Links your smash.gg account and Discord account together, allowing Armour Studios to do tasks between Discord and smash.gg. All information stored is public (Discord tag, Discord ID, and URL slug).

Please read [this](https://help.smash.gg/en/articles/4100961-user-profiles) if you do not know how/where to find your profile.
`, `
> \`/account unlink\`

Unlinks your smash.gg account and Discord account.
`, `
> \`/account status <Discord tag with/without @ OR tournament URL/short URL>\`

Checks if a user as linked their accounts OR checks whether each attendee has linked their accounts for a given tournament. Providing no arguments will give you your own account status.
`];
  const examples = ['https://i.imgur.com/uvWQE1R.png', 'https://i.imgur.com/LqgWaWn.png', 'https://i.imgur.com/mnWZwki.png'];

  const accountsEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`
${label}
${descriptions[index]}`)
    .setImage(examples[index])
    .setFooter({ text: `Command ${index + 1} of 3`, iconURL: 'https://i.imgur.com/gUwhkw3.png' });

  if (index === 2) accountsEmbed.setThumbnail(footerIcon);

  return accountsEmbed;
}

const generateReminderEmbed = index => {
  const label = '**Tournament Reminders**';
  const descriptions = [`
> \`/remind\`

Toggles your tournament reminders. As long as your accounts are linked prior to toggling on, you will always be automatically messaged an hour before any tournament you sign-up for. You can go to the next page to see what the reminders look like.

*PLEASE NOTE: By toggling on tournament reminders, you consent to Armour Studios direct messaging you on Discord automatically.*
`, `
Tournament reminders include basic tournament/event information, all stored in a singular embed. Keep in mind that if you are not in at least one server with Armour Studios, it cannot message you.
`];
  const examples = ['https://i.imgur.com/XNFHbeJ.png', 'https://i.imgur.com/noJpDgz.png'];

  const reminderEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`
${label}
${descriptions[index]}`)
    .setImage(examples[index])
    .setFooter({ text: `Page ${index + 1} of 2`, iconURL: footerIcon });

  return reminderEmbed;
}

const generateResultsEmbed = index => {
  const accountsEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`
**User Tournament Results**

> \`/results <user (optional)>\`

Details and sets from a user's three latest tournaments. Providing no arguments will give you your own results. A user must have their accounts linked to see their results (see **Accounts**).

Please keep in mind that the search algorithm will find up to 15 tournaments, including admined/spectated tournaments. It may not show three tournaments if a user has admined/spectated multiple tournaments.
`)
    .setImage('https://i.imgur.com/G4LzGzX.png')
    .setFooter({ text: `Command 1 of 1`, iconURL: footerIcon });
  return accountsEmbed;
}

const generateDQPingingEmbed = index => {
  const label = '**Automatic Match Calling (DQ Pinging)**';
  const descriptions = [`
> \`/set dqpingchannel <#channel>\`

Before beginning DQ pinging, you need to set the channel that Armour Studios will ping users in. This allows you to run \`/dq ping\` in a separate channel.
`, `
> \`/dq ping <tournament URL/start.gg short URL> <event_number (optional)> <event_name (optional)>\`

Pings users in the DQ pinging channel a minute after their set is called (a minute after DQ timer has started). Specifying the event name or number as the second argument will ping only for that event, otherwise pinging will happen across all events (check example on the right to see how events are numbered). Pinging will automatically stop after six hours or when the tournament has ended.

If your Discord account is not public on your start.gg profile and your accounts have not been linked through Armour Studios, your start.gg username will be shown in bold instead.
`, `
> \`/dq stop\`

Stops DQ pinging.
`];
  const examples = ['https://i.imgur.com/5swyvDE.png', 'https://i.imgur.com/PttOLYc.png', 'https://i.imgur.com/KeVuRDW.png'];

  const DQPingingEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`
${label}
${descriptions[index]}`)
    .setImage(examples[index])
    .setFooter({ text: `Command ${index + 1} of 3`, iconURL: footerIcon });

  if (index === 1) DQPingingEmbed.setThumbnail('https://i.imgur.com/Br9Vcmo.png');

  return DQPingingEmbed;
}

const generateAnnounceEmbed = index => {
  const label = '**Tournament Announcing**';
  const descriptions = [`
> \`/set announcechannel <#channel>\`

Before announcing a tournament, you need to set the channel that Armour Studios will announce in. This allows you to run \`/announce\` in a separate channel.
`, `
> \`/set announcemessage <message (optional)>\`

Sets the message shown in the announcement. Providing no arguments will reset the message to default.

Default message: \`The registration for <tournament name> is up:\`

Announcements are formatted as such: 
\`\`\`<announce message> <URL>

<registration end time>

<event name and start time>
<check-in time (if enabled)>

<streams>\`\`\`
Keep in mind that \`<announce message>\` is the message that YOU specify. The rest is of the announcement is automatically done by Armour Studios.
`, `
> \`/set pingrole <@role/role name (optional)>\`

Sets the role to ping when announcing a tournament. Providing no arguments will reset the role to default, which is @everyone.
`, `
> \`/announce <tournament URL/start.gg short URL> <ping (optional)>\`

Announces a given tournament with registration/event times, streams, and additional info. Using the short URL will always send the latest tournament linked to the URL. 
`];
  const examples = ['https://i.imgur.com/6L75GCI.png', 'https://i.imgur.com/YVDnWo0.png', 'https://i.imgur.com/IH6PZjD.png', 'https://i.imgur.com/TXZYBZD.png'];
  const thumbnails = ['https://i.imgur.com/wZ9IbTf.png', 'https://i.imgur.com/TO7tlrA.png', 'https://i.imgur.com/OpbRMIM.png'];

  const announceEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`
${label}
${descriptions[index]}`)
    .setImage(examples[index])
    .setFooter({ text: `Command ${index + 1} of 4`, iconURL: footerIcon });

  if (index > 0) announceEmbed.setThumbnail(thumbnails[index - 1]);

  return announceEmbed;
}

const generateLocalizationEmbed = index => {
  const label = '**Localization**';
  const descriptions = [`
> \`/set timezone <city (optional)>\`

Sets the timezone that Armour Studios uses, altering the timestamps shown in tournament reminders, \`/results\`, and \`/announce\`. Providing no arguments will reset the timezone to \`America/Los_Angeles\` (PST/PDT).

Currently supported cities: \`America/Los_Angeles\`, \`America/Phoenix\`, \`America/Denver\`, \`America/Regina\`, \`America/Chicago\`, \`America/New_York\`, \`Pacific/Honolulu\`
`, `
> \`/set language <code (optional)>\`

Sets the language that Armour Studios uses. Language localization does not apply to DQ Pinging, User Tournament Results, and some other messages due to formatting issues and restrictions. Providing no arguments will reset the language to \`en\`.
`];
  const examples = ['https://i.imgur.com/OOFBH0O.png', 'https://i.imgur.com/TEpnXU0.png'];

  const localizationEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`
${label}
${descriptions[index]}`)
    .setImage(examples[index])
    .setFooter({ text: `Command ${index + 1} of 2`, iconURL: footerIcon });

  return localizationEmbed;
}


const generateSearchEmbed = index => {
  const searchEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`
**Tournament Searching**

> \`/search <game>\`

Searches for upcoming tournaments by game. The \`<game>\` argument is not case-sensitive.

Currently supported games: \`Super Smash Bros. Ultimate\`, \`Valorant\`
`)
    .setImage('https://i.imgur.com/nesqtNb.png')
    .setFooter({ text: `Command 1 of 1`, iconURL: footerIcon });

  return searchEmbed;
}

const generatePrefixEmbed = index => {
  const prefixEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`
**Custom Prefix**

> \`t!set prefix <prefix (optional)>\`

Assign a custom prefix for Armour Studios legacy commands. Please note that prefixes cannot contain any spaces. Providing no arguments will reset the prefix to \`t!\`.

\`t!set prefix <prefix (optional)>\` and \`t!help\` can always be run with the original prefix, \`t!\`.
`)
    .setImage('https://i.imgur.com/uLWYdgM.png')
    .setFooter({ text: `Command 1 of 1`, iconURL: footerIcon });
  return prefixEmbed;
}

const generateInfoEmbed = index => {
  const infoEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`Armour Studios is your all-in-one tournament management solution powered by Start.gg. Built by Armour Studios for the competitive gaming community.`)
    .setFooter({ text: `Armour Studios`, iconURL: footerIcon });

  return infoEmbed;
}

const generateScrimEmbed = index => {
  const label = '➡ **Teams & Scrims**';
  const descriptions = [`
> \`/scrim team create <name>\`
Create a new scrim team for your server or organization.

> \`/scrim team invite <@user>\`
Invite a player to your team.

> \`/scrim team join <name>\`
Join a team you were invited to.
`, `
> \`/scrim queue join\`
Queue your team for a scrimmage against other teams.

> \`/scrim queue status\`
Check who is currently in the scrimmage queue.

> \`/scrim leaderboard\`
View the global team ELO leaderboard.
`];
  const scrimEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`${label}\n${descriptions[index]}`)
    .setFooter({ text: `Page ${index + 1} of 2`, iconURL: footerIcon });
  return scrimEmbed;
}

const generateBroadcastEmbed = index => {
  const label = '➡ **Global Broadcasts**';
  const descriptions = [`
> \`/broadcast toggle\`
Enable or disable cross-server announcements for your tournaments.

When enabled, your tournament starts and major updates will be broadcasted to other servers in the Armour Studios network.
`];
  const broadcastEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`${label}\n${descriptions[index]}`)
    .setFooter({ text: `Command 1 of 1`, iconURL: footerIcon });
  return broadcastEmbed;
}

const generateLeagueHelpEmbed = index => {
  const label = '➡ **Leagues & Tracking**';
  const descriptions = [`
> \`/league link <URL>\`
Link a Start.gg league or standalone tournament for automated tracking and scheduled reminders.

> \`/league unlink\`
Stop tracking the currently linked league or tournament.
`];
  const leagueEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`${label}\n${descriptions[index]}`)
    .setFooter({ text: `Command 1 of 1`, iconURL: footerIcon });
  return leagueEmbed;
}

module.exports = {
  generateHelpSelection,
  generateAccountsEmbed,
  generateReminderEmbed,
  generateResultsEmbed,
  generateDQPingingEmbed,
  generateAnnounceEmbed,
  generateLocalizationEmbed,
  generateSearchEmbed,
  generatePrefixEmbed,
  generateInfoEmbed,
  generateScrimEmbed,
  generateBroadcastEmbed,
  generateLeagueHelpEmbed
};
