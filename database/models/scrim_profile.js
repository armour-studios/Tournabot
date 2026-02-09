const mongoose = require('mongoose');

const scrimProfileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    guildId: String, // Preferred/Home guild
    tags: [String], // e.g., 'Rocket League', 'Tekken'
    stats: {
        rocket_league: {
            elo: { type: Number, default: 1000 },
            wins: { type: Number, default: 0 },
            losses: { type: Number, default: 0 },
            streak: { type: Number, default: 0 },
            rank: { type: String, default: 'Rank E' }
        },
        generic: {
            elo: { type: Number, default: 1000 },
            wins: { type: Number, default: 0 },
            losses: { type: Number, default: 0 }
        }
    },
    lastPlayed: Date,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ScrimProfile', scrimProfileSchema);
