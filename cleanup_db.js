const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const guildSettingsModel = require('./database/models/guild_settings');

const dbUri = process.env.MONGOPASS || 'mongodb://127.0.0.1:27017/tournabot';

async function cleanup() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(dbUri);
        console.log('Connected!');

        console.log('Searching for guilds with legacy NE Network branding...');
        const staleGuilds = await guildSettingsModel.find({
            $or: [
                { customName: /Armour Studios/i }
            ]
        });

        console.log(`Found ${staleGuilds.length} guilds with stale branding.`);

        for (const guild of staleGuilds) {
            console.log(`Cleaning up guild: ${guild.guildId}`);
            if (guild.customName && guild.customName.toLowerCase().includes('armour studios')) {
                guild.customName = 'NE Network';
            }
            await guild.save();
        }

        console.log('Cleanup complete!');
        process.exit(0);
    } catch (err) {
        console.error('Cleanup failed:', err);
        process.exit(1);
    }
}

cleanup();
