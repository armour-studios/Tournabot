const { extractSlug } = require('./functions');

const url = 'https://www.start.gg/tournament/100-3v3-rocket-rush-season-1-week-3-weekly-tournament-league/events/100-nameless-weekly-rocket-rush/brackets/2161141/3145833/overview';

console.log('URL:', url);
console.log('Extracted Slug:', extractSlug(url));

const isLeague = url.includes('/league/');
const isEvent = url.includes('/event/');
console.log('isLeague:', isLeague);
console.log('isEvent:', isEvent);
