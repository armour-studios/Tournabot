const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
    guildid: { type: mongoose.Schema.Types.Mixed },
    channelid: { type: mongoose.Schema.Types.Mixed },
    dqpingchannelid: String,
    matchfeedchannel: String,
    standingschannel: String,
    seedchannel: String
});

const channelModel = module.exports = mongoose.model('channels', channelSchema);