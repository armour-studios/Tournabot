require('dotenv').config();
const { queryAPI } = require('./functions');

const slug = '100-3v3-rocket-rush-season-1-week-3-weekly-tournament-league';

(async () => {
    const query = `query TournamentInfo($slug: String!) {
        tournament(slug: $slug) {
            id name url images { url type } numEntrants startAt registrationClosesAt endAt
            events { name startAt checkInEnabled checkInBuffer checkInDuration }
            streams { streamSource streamName }
        }
    }`;
    const data = await queryAPI(query, { slug });
    console.log('Result:', JSON.stringify(data, null, 2));
})();
