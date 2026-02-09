require('dotenv').config();
const mongoose = require('mongoose');
const leagueModel = require('./database/models/league');
const channelModel = require('./database/models/channel');

async function check() {
    try {
        const uris = process.env.MONGOPASS || process.env.MONGO_URI;
        if (!uris) throw new Error('No MONGOPASS found in .env');
        await mongoose.connect(uris, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to MongoDB');

        const leagues = await leagueModel.find({});
        console.log(`Found ${leagues.length} linked entries:`);
        for (const l of leagues) {
            console.log(`- Slug: ${l.slug}, Type: ${l.type}, Guild: ${l.guildid}, Name: ${l.name}`);
        }

        const channels = await channelModel.find({});
        console.log(`\nFound ${channels.length} channel configs:`);
        for (const c of channels) {
            console.log(`- Guild: ${c.guildid}, Matchfeed: ${c.matchfeedchannel}, Announce: ${c.channelid}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
