const processedSetModel = require('./database/models/processed_set');
const database = require('./database/database');

async function check() {
    await database;
    const count = await processedSetModel.countDocuments({});
    const upsets = await processedSetModel.find({ summary: /UPSET/ }).countDocuments();
    console.log(`Total processed sets: ${count}`);
    console.log(`Total upsets found: ${upsets}`);
    process.exit(0);
}
check();
