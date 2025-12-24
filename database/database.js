const mongoose = require('mongoose');
const { MONGOPASS } = process.env;

const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    poolSize: 10,
    family: 4 // Use IPv4, skip trying IPv6
};

// Handle potential undefined MONGOPASS
if (!MONGOPASS) {
    console.error('CRITICAL: MONGOPASS environment variable is missing!');
} else {
    console.log(`MONGOPASS is set (length: ${MONGOPASS.length}). Starts with: ${MONGOPASS.substring(0, 10)}...`);
}

module.exports = mongoose.connect(MONGOPASS, options);
