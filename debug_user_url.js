require('dotenv').config();
const { extractSlug, fetchEntity } = require('./functions');

const url = 'https://www.start.gg/tournament/100-3v3-rocket-rush-season-1-week-3-weekly-tournament-league/details';

(async () => {
    const slug = extractSlug(url);
    console.log('Extracted Slug:', slug);

    const entity = await fetchEntity(slug);
    if (entity) {
        console.log('Entity Found:', entity.name, 'Type:', entity.type);
    } else {
        console.log('No entity found.');
    }
})();
