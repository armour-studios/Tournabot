require('dotenv').config();
const { extractSlug, fetchEntity } = require('./functions');

const url = 'https://start.gg//tournament/100-3v3-rocket-rush-season-1-week-3-weekly-tournament-league';
const slug = extractSlug(url);
console.log('Extracted Slug:', slug);

(async () => {
    try {
        const entity = await fetchEntity(slug);
        console.log('Entity Found:', entity ? entity.name : 'NULL');
        if (entity) console.log('Type:', entity.type);
    } catch (err) {
        console.error('Crash in debug script:', err);
    }
})();
