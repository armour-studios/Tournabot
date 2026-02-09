try {
    console.log('Testing functions.js load...');
    const functions = require('./functions');
    console.log('functions.js loaded successfully. Exports:', Object.keys(functions));

    console.log('Testing commands/live.js load...');
    const live = require('./commands/live');
    console.log('commands/live.js loaded successfully.');

    console.log('Checking executeSlash presence:', !!live.executeSlash);
} catch (err) {
    console.error('LOAD ERROR:', err);
}
