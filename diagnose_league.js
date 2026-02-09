const fetch = require('node-fetch');
require('dotenv').config();

const { SMASHGGTOKEN } = process.env;

async function queryAPI(query, variables) {
  const res = await fetch('https://api.start.gg/gql/alpha', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SMASHGGTOKEN}`
    },
    body: JSON.stringify({ query, variables })
  });
  return res.json();
}

const discoveryQuery = `
          query LeagueDiscovery($slug: String!) {
            league(slug: $slug) {
              name
              events {
                nodes {
                  id name slug startAt
                }
              }
            }
          }
        `;

async function run() {
  const slug = "100-3v3-weekly-rocket-rush-season-1";
  console.log(`--- TESTING LEAGUE EVENTS DISCOVERY: "${slug}" ---`);

  const data = await queryAPI(discoveryQuery, { slug });
  console.log('Result:', JSON.stringify(data, null, 2));
}

run();
