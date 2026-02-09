const mongoose = require('mongoose');

const leagueSchema = new mongoose.Schema({
    guildid: String,
    slug: String,
    name: String,
    type: { type: String, default: 'league' }, // 'league', 'tournament', or 'event'
    lastAnnouncedTournamentId: { type: Number, default: 0 },
    announcementSettings: { type: [Number], default: [168, 72, 24, 1] }, // Hours before start
    announcedTournaments: { type: Map, of: [Number], default: {} } // Map<TournamentID, Array<HoursSent>>
});

module.exports = mongoose.model('League', leagueSchema);
