const mongoose = require('mongoose');
require('dotenv').config();

async function cleanup() {
    try {
        const uri = process.env.MONGOPASS || process.env.MONGODB_URI;
        if (!uri) {
            console.error('No database URI found in environment variables (tried MONGOPASS and MONGODB_URI).');
            process.exit(1);
        }

        await mongoose.connect(uri);
        console.log('Connected to MongoDB.');

        // Delete collections that might have inaccurate legacy data
        const collections = ['processedsets', 'upsettrackers', 'livedashboards'];
        for (const col of collections) {
            try {
                await mongoose.connection.collection(col).deleteMany({});
                console.log(`Cleared ${col}.`);
            } catch (err) {
                console.log(`Note: Collection ${col} might not exist yet, skipping delete.`);
            }
        }

        console.log('Cleanup complete. Bot will now rebuild data with correct types and deduplication.');
        process.exit(0);
    } catch (err) {
        console.error('Cleanup failed:', err);
        process.exit(1);
    }
}

cleanup();
