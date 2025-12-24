const { EmbedBuilder } = require('discord.js');

const generateHelpSelection = index => {
  const descriptions = [`
:small_orange_diamond: **Accounts**

ArmourBot handles account linking between start.gg and Discord. Several commands are account-based.

:small_orange_diamond: **Tournament Reminders**

Automatic reminders for your tournaments an hour before they begin. Requires linked accounts.

:small_orange_diamond: **User Tournament Results**

Details and sets from a user's three latest tournaments. Requires linked accounts.

:small_orange_diamond: **Automatic Match Calling (DQ Pinging)**

Pings users in a specified channel when their set is called.

:small_orange_diamond: **Tournament Announcing**

Announces a given tournament with registration/event times and additional info.
`, `
:small_orange_diamond: **Localization**

Access complete localization through customizable timezones and languages.

:small_orange_diamond: **Tournament Searching**

Search for start.gg tournaments by game directly in your server.

:small_orange_diamond: **Custom Prefix**

Assign a custom prefix for ArmourBot legacy commands.

:small_orange_diamond: **More Info**

Support server, developer contact, and open-source information.
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

Links your smash.gg account and Discord account together, allowing ArmourBot to do tasks between Discord and smash.gg. All information stored is public (Discord tag, Discord ID, and URL slug).

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

*PLEASE NOTE: By toggling on tournament reminders, you consent to ArmourBot direct messaging you on Discord automatically.*
`, `
Tournament reminders include basic tournament/event information, all stored in a singular embed. Keep in mind that if you are not in at least one server with ArmourBot, it cannot message you.
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

Before beginning DQ pinging, you need to set the channel that ArmourBot will ping users in. This allows you to run \`/dq ping\` in a separate channel.
`, `
> \`/dq ping <tournament URL/start.gg short URL> <event_number (optional)> <event_name (optional)>\`

Pings users in the DQ pinging channel a minute after their set is called (a minute after DQ timer has started). Specifying the event name or number as the second argument will ping only for that event, otherwise pinging will happen across all events (check example on the right to see how events are numbered). Pinging will automatically stop after six hours or when the tournament has ended.

If your Discord account is not public on your start.gg profile and your accounts have not been linked through ArmourBot, your start.gg username will be shown in bold instead.
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

Before announcing a tournament, you need to set the channel that ArmourBot will announce in. This allows you to run \`/announce\` in a separate channel.
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
Keep in mind that \`<announce message>\` is the message that YOU specify. The rest is of the announcement is automatically done by ArmourBot.
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

Sets the timezone that ArmourBot uses, altering the timestamps shown in tournament reminders, \`/results\`, and \`/announce\`. Providing no arguments will reset the timezone to \`America/Los_Angeles\` (PST/PDT).

Currently supported cities: \`America/Los_Angeles\`, \`America/Phoenix\`, \`America/Denver\`, \`America/Regina\`, \`America/Chicago\`, \`America/New_York\`, \`Pacific/Honolulu\`
`, `
> \`/set language <code (optional)>\`

Sets the language that ArmourBot uses. Language localization does not apply to DQ Pinging, User Tournament Results, and some other messages due to formatting issues and restrictions. Providing no arguments will reset the language to \`en\`.
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

Assign a custom prefix for ArmourBot legacy commands. Please note that prefixes cannot contain any spaces. Providing no arguments will reset the prefix to \`t!\`.

\`t!set prefix <prefix (optional)>\` and \`t!help\` can always be run with the original prefix, \`t!\`.
`)
    .setImage('https://i.imgur.com/uLWYdgM.png')
    .setFooter({ text: `Command 1 of 1`, iconURL: footerIcon });
  return prefixEmbed;
}

const generateInfoEmbed = index => {
  const infoEmbed = new EmbedBuilder()
    .setColor('#00A3FF')
    .setDescription(`ArmourBot is your all-in-one tournament management solution powered by Start.gg. Built by Armour Studios for the competitive gaming community.`)
    .setFooter({ text: `ArmourBot`, iconURL: footerIcon });

  return infoEmbed;
}

module.exports = {
  generateHelpSelection: generateHelpSelection,
  generateAccountsEmbed: generateAccountsEmbed,
  generateReminderEmbed: generateReminderEmbed,
  generateResultsEmbed: generateResultsEmbed,
  generateDQPingingEmbed: generateDQPingingEmbed,
  generateAnnounceEmbed: generateAnnounceEmbed,
  generateLocalizationEmbed: generateLocalizationEmbed,
  generateSearchEmbed: generateSearchEmbed,
  generatePrefixEmbed: generatePrefixEmbed,
  generateInfoEmbed: generateInfoEmbed
};
