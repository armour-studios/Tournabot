const mongoose = require('mongoose');
const processedSetModel = require('./database/models/processed_set');
require('dotenv').config();

async function check() {
    await mongoose.connect(process.env.MONGOPASS || 'mongodb://127.0.0.1:27017/tournabot', { useNewUrlParser: true, useUnifiedTopology: true });
    const count = await processedSetModel.countDocuments({ setKey: new RegExp('^1526347-') });
    console.log(`Found ${count} processed sets for event 1526347`);
    mongoose.connection.close();
}

check();
