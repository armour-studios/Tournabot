require('dotenv').config();
const { queryAPI } = require('./functions');

const slug = '100-3v3-rocket-rush-season-1-week-3-weekly-tournament-league';

(async () => {
    const query = `query MinTournament($slug: String!) {
        tournament(slug: $slug) {
            id
            name
        }
    }`;
    try {
        const data = await queryAPI(query, { slug });
        console.log('Result:', JSON.stringify(data));
    } catch (err) {
        console.error('Crash:', err);
    }
})();
