const fs = require('fs');
const path = require('path');

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
console.log(`Found ${commandFiles.length} files in ./commands`);

for (const file of commandFiles) {
    try {
        const command = require(`./commands/${file}`);
        console.log(`- ${file}: name="${command.name}", hasExecuteSlash=${!!command.executeSlash}, hasData=${!!command.data}`);
    } catch (err) {
        console.error(`- ${file}: ERROR LOADING - ${err.message}`);
    }
}
process.exit(0);
