require('dotenv').config();
const { queryAPI } = require('./functions');

async function checkSetStream() {
    const query = `query RecentTournamentSets {
        tournaments(query: { perPage: 1, filter: { past: false, upcoming: false } }) {
            nodes {
                events {
                    sets(perPage: 10, filters: { hideEmpty: true }) {
                        nodes {
                            id
                            stream {
                                streamName
                                streamSource
                            }
                            slots { entrant { name } }
                        }
                    }
                }
            }
        }
    }`;

    try {
        const data = await queryAPI(query, {});
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(err);
    }
}

checkSetStream();
