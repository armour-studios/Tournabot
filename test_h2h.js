require('dotenv').config();
const { queryAPI } = require('./functions');

async function testH2H() {
    const slugs = ['mkleo', 'sparg0'];

    try {
        // 1. Get IDs
        const playerIds = [];
        for (const tag of slugs) {
            console.log(`Searching for tag: ${tag}`);
            const data = await queryAPI(`query PlayerSearch($tag: String) { 
                players(query: { filter: { gamerTag: $tag } }) { 
                    nodes { id gamerTag } 
                } 
            }`, { tag });

            console.log(`API Response for ${tag}:`, JSON.stringify(data, null, 2));

            if (data?.data?.players?.nodes?.length > 0) {
                const player = data.data.players.nodes[0];
                playerIds.push(player.id);
                console.log(`Found ${player.gamerTag}: ${player.id}`);
            } else {
                console.log(`No nodes found for ${tag}`);
            }
        }

        if (playerIds.length < 2) return console.log('Could not find both players.');

        // 2. Query sets
        // We'll search for sets the first player participated in, and then filter for the second player in JS
        // because the API filter 'playerIds' returns sets where ANY of the players participated.
        const query = `query H2H($playerId: ID, $page: Int) {
            player(id: $playerId) {
                sets(perPage: 50, page: $page, filters: { hideEmpty: true }) {
                    nodes {
                        displayScore
                        fullRoundText
                        winnerId
                        event { name tournament { name } }
                        slots { entrant { name participants { player { id } } } }
                    }
                }
            }
        }`;

        const data = await queryAPI(query, { playerId: playerIds[0], page: 1 });
        const nodes = data?.data?.player?.sets?.nodes || [];

        console.log(`Found ${nodes.length} total sets for Player 1.`);

        const h2hSets = nodes.filter(set =>
            set.slots.some(slot => slot.entrant?.participants?.some(p => p.player?.id == playerIds[1]))
        );

        console.log(`Found ${h2hSets.length} H2H sets.`);
        if (h2hSets.length > 0) {
            console.log('Sample H2H set:', JSON.stringify(h2hSets[0], null, 2));
        }

    } catch (err) {
        console.error(err);
    }
}

testH2H();
