const mongoose = require('mongoose');

const leagueSchema = new mongoose.Schema({
    guildid: String,
    slug: String,
    lastAnnouncedTournamentId: { type: Number, default: 0 }
});

module.exports = mongoose.model('League', leagueSchema);
