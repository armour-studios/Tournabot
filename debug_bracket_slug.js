const { extractSlug, queryAPI } = require('./functions');

async function test() {
    const url = 'https://www.start.gg/tournament/100-3v3-rocket-rush-season-1-week-3-weekly-tournament-league/events';
    console.log(`Testing URL: ${url}`);

    const slug = extractSlug(url);
    console.log(`Extracted Slug: ${slug}`);

    if (!slug) {
        console.log('Slug extraction failed.');
        return;
    }

    // current code in bracket.js uses this query
    const eventQuery = `query EventPhases($slug: String!) {
        event(slug: $slug) {
            id name
            tournament { name }
            phases {
                id name groupCount
                phaseGroups(query: { perPage: 10 }) {
                    nodes { id displayIdentifier }
                }
            }
        }
    }`;

    console.log('Attempting Event Query...');
    const data = await queryAPI(eventQuery, { slug });

    if (data?.data?.event) {
        console.log('Event found:', data.data.event.name);
    } else {
        console.log('Event NOT found.');
        if (data.errors) console.log('Errors:', JSON.stringify(data.errors));
    }

    // If event failed, maybe it's a tournament slug?
    const tournamentQuery = `query TournamentEvents($slug: String!) {
        tournament(slug: $slug) {
            id name
            events {
                id name slug
            }
        }
    }`;

    console.log('Attempting Tournament Query...');
    const tData = await queryAPI(tournamentQuery, { slug });

    if (tData?.data?.tournament) {
        console.log('Tournament found:', tData.data.tournament.name);
        console.log('Events:', tData.data.tournament.events.map(e => `${e.name} (${e.slug})`).join(', '));
    } else {
        console.log('Tournament NOT found.');
    }
}

test();
