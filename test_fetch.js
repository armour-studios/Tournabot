const { fetchEntity, extractSlug } = require('./functions.js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function test() {
    const url = 'https://www.start.gg/tournament/100-3v3-rocket-rush-season-1-week-4-weekly-tournament/details';
    const slug = extractSlug(url);
    console.log('Extracted Slug:', slug);

    const entity = await fetchEntity(slug);
    if (entity) {
        console.log('Success! Found:', entity.name);
    } else {
        console.log('Failed to find tournament.');
    }
}

test();
