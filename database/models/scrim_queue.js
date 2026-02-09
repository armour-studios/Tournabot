const mongoose = require('mongoose');

const scrimQueueSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    game: { type: String, default: 'rocket_league' },
    elo: Number,
    joinedAt: { type: Date, default: Date.now },
    teamName: String,
    meta: mongoose.Schema.Types.Mixed // For roles, region, etc.
});

module.exports = mongoose.model('ScrimQueue', scrimQueueSchema);
