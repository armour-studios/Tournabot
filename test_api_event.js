const { queryAPI } = require('./functions');
require('dotenv').config();

async function test() {
    const slug = 'tournament/100-3v3-rocket-rush-season-1-week-3-weekly-tournament-league/event/100-nameless-weekly-rocket-rush';
    console.log('Testing Event Query for slug:', slug);
    const query = `query EventOverview($slug: String!) {
        event(slug: $slug) {
            id state name slug
            tournament { id name slug url state images { url type } }
        }
    }`;
    const data = await queryAPI(query, { slug });
    console.log('API Response:', JSON.stringify(data, null, 2));
}

test();
