const mongoose = require('mongoose');

const processedSetSchema = new mongoose.Schema({
    setKey: { type: String, required: true, unique: true }, // Format: eventId-setId
    eventId: Number,
    state: { type: Number, required: true }, // 2 = InProgress, 3 = Complete
    summary: String, // e.g., "Winner def. Loser" or "P1 vs P2"
    guildMessages: [{
        guildId: String,
        channelId: String,
        messageId: String
    }],
    timestamp: { type: Date, default: Date.now, expires: 604800 } // Auto-delete after 7 days
});

module.exports = mongoose.model('ProcessedSet', processedSetSchema);
