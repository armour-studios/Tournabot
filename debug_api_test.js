const { queryAPI } = require('./functions');

async function test() {
    const slug = '100-3v3-rocket-rush-season-1-week-3-weekly-tournament-league';
    console.log('Testing Tournament Query for slug:', slug);
    const query = `query T($slug: String) { tournament(slug: $slug) { id name } }`;
    const data = await queryAPI(query, { slug });
    console.log('API Response:', JSON.stringify(data, null, 2));
}

test();
