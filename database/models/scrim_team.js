const mongoose = require('mongoose');

const scrimTeamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    memberIds: [{ type: String }],
    pendingInvites: [{ type: String }],
    stats: {
        rocket_league: {
            elo: { type: Number, default: 1000 },
            wins: { type: Number, default: 0 },
            losses: { type: Number, default: 0 },
            rank: { type: String, default: 'Rank E' }
        }
    },
    h2h: {
        type: Map,
        of: {
            wins: { type: Number, default: 0 },
            losses: { type: Number, default: 0 }
        }
    },
    history: [{
        matchId: String,
        opponentName: String,
        result: String, // 'win' or 'loss'
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ScrimTeam', scrimTeamSchema);
