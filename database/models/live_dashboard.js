const mongoose = require('mongoose');

const liveDashboardSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    eventId: { type: Number, required: true },
    channelId: { type: String, required: true },
    dashboardMessageId: String,
    lastContent: String,
    lastUpdate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LiveDashboard', liveDashboardSchema);
