const { queryAPI } = require('./functions');

async function test() {
    // A recent set ID from previous logs
    const setId = 88476412; // Example ID from previous output, or I can fetch a new one
    // Let's fetch a few sets from the known phaseGroup to be safe
    const groupId = 3145833;

    console.log(`Fetching sets from Group ${groupId} to inspect fields...`);

    const query = `query InspectSet($id: ID) {
        phaseGroup(id: $id) {
            sets(perPage: 5) {
                nodes {
                    id
                    state
                    hasPlaceholder
                    wPlacement lPlacement
                    startedAt completedAt
                    totalGames discriminatorType
                    slots { entrant { name } }
                    # Checking for any mod related fields - these are guesses based on common naming
                    # real schema needed. 
                    # Start.gg API doesn't seem to document "mod requested" on Set directly in public docs easily.
                }
            }
        }
    }`;

    const data = await queryAPI(query, { id: groupId });
    const sets = data?.data?.phaseGroup?.sets?.nodes || [];

    if (sets.length > 0) {
        console.log('Set Fields:', Object.keys(sets[0]));
        console.log('Sample Set:', JSON.stringify(sets[0], null, 2));
    }
}

test();
