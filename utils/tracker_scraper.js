const fetch = require('node-fetch');

/**
 * Tracker.gg Web Scraper for Rocket League Player Stats
 * Completely free - no API key required
 */

class TrackerScraper {
    constructor() {
        this.baseUrl = 'https://rocketleague.tracker.network/rocket-league/profile';
        this.requestDelay = 500; // ms between requests to be respectful
    }

    /**
     * Fetch player stats from Tracker.gg
     * @param {string} platform - 'epic', 'steam', 'psn', 'xbl'
     * @param {string} playerName - Player's username
     * @returns {Promise<Object>} Player stats including MMR and rank
     */
    async getPlayerStats(platform, playerName) {
        // URL encode the player name
        const encodedName = encodeURIComponent(playerName);
        const url = `${this.baseUrl}/${platform}/${encodedName}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return { error: 'Player not found', playerName };
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            return this.parsePlayerData(html, playerName);

        } catch (error) {
            console.error(`Failed to fetch ${playerName}:`, error.message);
            return { error: error.message, playerName };
        }
    }

    /**
     * Parse HTML to extract player stats
     * @param {string} html - Raw HTML from Tracker.gg
     * @param {string} playerName - Player name for reference
     * @returns {Object} Parsed stats
     */
    parsePlayerData(html, playerName) {
        try {
            // Extract MMR from the playlist stats
            // Tracker.gg shows MMR in the format "1547 MMR" or "Rating: 1547"
            const mmrMatch = html.match(/(\d{3,4})\s*(?:MMR|Rating)/i);
            const mmr = mmrMatch ? parseInt(mmrMatch[1]) : 0;

            // Extract rank (e.g., "Champion II", "Grand Champion I")
            const rankMatch = html.match(/(Supersonic Legend|Grand Champion [I]{1,3}|Champion [I]{1,3}|Diamond [I]{1,3}|Platinum [I]{1,3}|Gold [I]{1,3}|Silver [I]{1,3}|Bronze [I]{1,3}|Unranked)/i);
            const rank = rankMatch ? rankMatch[1] : 'Unranked';

            // Extract win rate if available
            const winRateMatch = html.match(/(\d+(?:\.\d+)?)%\s*Win/i);
            const winRate = winRateMatch ? parseFloat(winRateMatch[1]) : null;

            // Extract games played
            const gamesMatch = html.match(/(\d+)\s*(?:Matches|Games)/i);
            const gamesPlayed = gamesMatch ? parseInt(gamesMatch[1]) : 0;

            return {
                playerName,
                mmr,
                rank,
                winRate,
                gamesPlayed,
                success: true
            };

        } catch (error) {
            console.error(`Failed to parse data for ${playerName}:`, error.message);
            return {
                playerName,
                mmr: 0,
                rank: 'Unknown',
                winRate: null,
                gamesPlayed: 0,
                success: false,
                error: 'Parse error'
            };
        }
    }

    /**
     * Fetch stats for multiple players with rate limiting
     * @param {Array} players - Array of {platform, name} objects
     * @param {Function} progressCallback - Called with (current, total)
     * @returns {Promise<Array>} Array of player stats
     */
    async getMultiplePlayerStats(players, progressCallback = null) {
        const results = [];

        for (let i = 0; i < players.length; i++) {
            const player = players[i];

            // Progress update
            if (progressCallback) {
                progressCallback(i + 1, players.length);
            }

            // Fetch stats
            const stats = await this.getPlayerStats(player.platform, player.name);
            results.push({
                ...player,
                ...stats
            });

            // Rate limiting - wait between requests
            if (i < players.length - 1) {
                await new Promise(resolve => setTimeout(resolve, this.requestDelay));
            }
        }

        return results;
    }

    /**
     * Detect platform from player identifier
     * @param {string} identifier - Epic ID, Steam ID, etc.
     * @returns {string} Platform code
     */
    detectPlatform(identifier) {
        // Epic Games IDs are typically alphanumeric
        // Steam IDs are numeric (17 digits)
        // PSN/XBL are usernames

        if (/^\d{17}$/.test(identifier)) {
            return 'steam';
        }

        // Default to Epic (most common for RL now)
        return 'epic';
    }
}

module.exports = TrackerScraper;
