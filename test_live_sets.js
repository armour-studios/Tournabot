const { queryAPI } = require('./functions');

async function test() {
    const eventId = '1526347';

    console.log('Fetching PENDING sets (state=0, no winner, etc)...');
    const query = `query EventSets($id: ID) {
        event(id: $id) {
            id name state
            sets(page: 1, perPage: 30, sortType: STANDARD) {
                nodes {
                    id state fullRoundText displayScore winnerId completedAt
                    slots { entrant { name } }
                }
            }
        }
    }`;

    const result = await queryAPI(query, { id: eventId });
    console.log('Event:', result?.data?.event?.name, 'State:', result?.data?.event?.state);

    const sets = result?.data?.event?.sets?.nodes || [];
    console.log(`Found ${sets.length} sets total:`);

    const pending = sets.filter(s => !s.winnerId && s.state !== 3);
    const inProgress = sets.filter(s => !s.winnerId && s.slots[0]?.entrant && s.slots[1]?.entrant);

    console.log('\n--- PENDING (no winner, not state 3):');
    pending.forEach(s => {
        const p1 = s.slots[0]?.entrant?.name || 'TBD';
        const p2 = s.slots[1]?.entrant?.name || 'TBD';
        console.log(`  Set ${s.id}: state=${s.state}, ${s.fullRoundText}: ${p1} vs ${p2}`);
    });

    console.log('\n--- CALLABLE (no winner, both players assigned):');
    inProgress.forEach(s => {
        const p1 = s.slots[0]?.entrant?.name || 'TBD';
        const p2 = s.slots[1]?.entrant?.name || 'TBD';
        console.log(`  Set ${s.id}: state=${s.state}, ${s.fullRoundText}: ${p1} vs ${p2}`);
    });
}

test();
