const mongoose = require('mongoose');

const upsetTrackerSchema = new mongoose.Schema({
    guildId: String,
    eventId: Number,
    channelId: String,
    messageId: String,
    upsets: [{
        setId: Number, // Unique ID for deduplication
        round: String,
        winnerName: String,
        winnerSeed: Number,
        loserName: String,
        loserSeed: Number,
        diff: Number,
        timestamp: { type: Date, default: Date.now }
    }],
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UpsetTracker', upsetTrackerSchema);
