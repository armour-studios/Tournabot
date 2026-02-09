require('dotenv').config();
const { queryAPI } = require('./functions');

async function testLeague() {
    const slug = 'capcom-pro-tour-2025';
    const query = `query LeagueStandings($slug: String) {
        league(slug: $slug) {
            name
            images {
                url
                type
            }
            standings(query: { perPage: 10, page: 1 }) {
                nodes {
                    placement
                    entrant {
                        name
                    }
                }
            }
        }
    }`;

    try {
        const data = await queryAPI(query, { slug });
        if (data && data.data && data.data.league) {
            console.log('League:', data.data.league.name);
            const standings = data.data.league.standings;
            if (standings && standings.nodes) {
                console.log('Total nodes:', standings.nodes.length);
                console.log('First node:', JSON.stringify(standings.nodes[0], null, 2));
            } else {
                console.log('No standings found.');
            }
        } else {
            console.log('No league data found or error:', JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error(err);
    }
}

testLeague();
