require('dotenv').config();
const { queryAPI } = require('./functions');

async function findPlayers() {
    const query = `query RecentTournaments {
        tournaments(query: { perPage: 1, filter: { past: true } }) {
            nodes {
                name
                events {
                    name
                    entrants(query: { perPage: 10 }) {
                        nodes {
                            id
                            name
                            participants {
                                player {
                                    id
                                    gamerTag
                                }
                            }
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

findPlayers();
