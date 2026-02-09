const { queryAPI } = require('./functions');

async function test() {
    const groupId = 3145833;
    console.log(`Fetching sets for Group ${groupId}...`);

    // Removed sortType
    const setsQuery = `query GroupSets($id: ID) {
        phaseGroup(id: $id) {
            displayIdentifier
            sets(perPage: 50) {
                nodes {
                    id fullRoundText displayScore round identifier
                    slots { entrant { name } }
                    winnerId
                }
            }
        }
    }`;

    const setData = await queryAPI(setsQuery, { id: groupId });
    const sets = setData?.data?.phaseGroup?.sets?.nodes || [];

    console.log(`Found ${sets.length} sets.`);

    if (sets.length > 0) {
        // Sort by round to see progression
        sets.sort((a, b) => a.round - b.round);

        sets.forEach(s => {
            console.log(`[R${s.round}] ${s.fullRoundText}: ${s.slots[0]?.entrant?.name || 'TBD'} vs ${s.slots[1]?.entrant?.name || 'TBD'} (${s.displayScore})`);
        });
    } else {
        console.log('Still no sets found.');
        if (setData.errors) {
            console.log('Errors:', JSON.stringify(setData.errors, null, 2));
        }
    }
}

test();
