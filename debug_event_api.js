const { queryAPI } = require('./functions');

async function test() {
    // Correctly formatted event slug based on user's URL
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

// I'll manually set the token for this test if it's missing from env
if (!process.env.SMASHGGTOKEN) {
    require('dotenv').config();
}

test();
