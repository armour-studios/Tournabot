const mongoose = require('mongoose');

const guildSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    customName: String,
    customLogo: String,
    brandingColor: String,
    scrimSettings: {
        enabled: { type: Boolean, default: true },
        autoChannel: String,
        ranksEnabled: { type: Boolean, default: true }
    },
    promotionChannels: [String], // Channels to broadcast other guild's events
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GuildSettings', guildSettingsSchema);
