const mongoose = require('mongoose');

const scrimMatchSchema = new mongoose.Schema({
    matchId: { type: String, required: true, unique: true },
    game: String,
    guildIds: [String], // Servers involved
    teamIds: [String], // If it's a team vs team match
    teamNames: [String],
    players: [{
        userId: String,
        team: Number, // 0 for Blue, 1 for Orange (Rocket League style)
        eloAtStart: Number
    }],
    state: { type: String, default: 'pending' }, // 'pending', 'ongoing', 'completed', 'cancelled'
    winnerTeam: Number,
    resultSubmittedBy: String,
    verified: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ScrimMatch', scrimMatchSchema);
