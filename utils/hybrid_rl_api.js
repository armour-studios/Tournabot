const TrackerScraper = require('./tracker_scraper');

/**
 * Hybrid API Manager - Uses RapidAPI first, falls back to web scraping
 * Smart system that tracks usage and automatically switches sources
 */

class HybridRLAPI {
    constructor(rapidApiKey = null) {
        this.rapidApiKey = rapidApiKey;
        this.scraper = new TrackerScraper();
        this.rapidApiUrl = 'https://rocket-league1.p.rapidapi.com/players';
        this.dailyLimit = 100;
        this.requestsToday = 0;
        this.lastResetDate = new Date().toDateString();
    }

    /**
     * Check if we've hit the daily RapidAPI limit
     */
    checkDailyLimit() {
        const today = new Date().toDateString();

        // Reset counter if it's a new day
        if (today !== this.lastResetDate) {
            this.requestsToday = 0;
            this.lastResetDate = today;
        }

        return this.requestsToday >= this.dailyLimit;
    }

    /**
     * Fetch player stats - tries RapidAPI first, falls back to scraping
     * @param {string} platform - 'epic', 'steam', 'psn', 'xbl'
     * @param {string} playerName - Player's username
     * @returns {Promise<Object>} Player stats with source indicator
     */
    async getPlayerStats(platform, playerName) {
        // Try RapidAPI if key exists and we're under limit
        if (this.rapidApiKey && !this.checkDailyLimit()) {
            try {
                const rapidResult = await this.fetchFromRapidAPI(platform, playerName);
                if (rapidResult.success) {
                    this.requestsToday++;
                    return { ...rapidResult, source: 'RapidAPI' };
                }
            } catch (error) {
                console.log(`RapidAPI failed for ${playerName}, falling back to scraper`);
            }
        }

        // Fallback to web scraping
        const scrapedResult = await this.scraper.getPlayerStats(platform, playerName);
        return { ...scrapedResult, source: 'WebScraper' };
    }

    /**
     * Fetch from RapidAPI
     */
    async fetchFromRapidAPI(platform, playerName) {
        const fetch = require('node-fetch');

        // RapidAPI platform codes
        const platformMap = {
            'epic': 'epic',
            'steam': 'steam',
            'psn': 'ps4',
            'xbl': 'xboxone'
        };

        const url = `${this.rapidApiUrl}/${platformMap[platform]}/${encodeURIComponent(playerName)}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'X-RapidAPI-Key': this.rapidApiKey,
                    'X-RapidAPI-Host': 'rocket-league1.p.rapidapi.com'
                }
            });

            if (!response.ok) {
                if (response.status === 429) {
                    // Rate limited - mark as at limit
                    this.requestsToday = this.dailyLimit;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return this.parseRapidAPIResponse(data, playerName);

        } catch (error) {
            console.error(`RapidAPI error for ${playerName}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Parse RapidAPI response
     */
    parseRapidAPIResponse(data, playerName) {
        try {
            // RapidAPI returns playlist data
            // Find the most played competitive playlist
            const playlists = data.data || {};
            let highestMMR = 0;
            let bestRank = 'Unranked';
            let totalGames = 0;
            let wins = 0;

            // Check 3v3, 2v2, 1v1 in order of priority
            const playlistPriority = ['13', '11', '10']; // 3v3, 2v2, 1v1

            for (const playlistId of playlistPriority) {
                const playlist = playlists[playlistId];
                if (playlist && playlist.tier) {
                    highestMMR = Math.max(highestMMR, playlist.rating || 0);
                    if (playlist.tier_name) bestRank = playlist.tier_name;
                    totalGames += playlist.matches_played || 0;
                    wins += playlist.wins || 0;
                }
            }

            const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : null;

            return {
                playerName,
                mmr: highestMMR,
                rank: bestRank,
                winRate: winRate ? parseFloat(winRate) : null,
                gamesPlayed: totalGames,
                success: true
            };

        } catch (error) {
            return {
                playerName,
                success: false,
                error: 'Parse error'
            };
        }
    }

    /**
     * Fetch stats for multiple players with smart switching
     * @param {Array} players - Array of {platform, name} objects
     * @param {Function} progressCallback - Called with (current, total, source)
     * @returns {Promise<Array>} Array of player stats
     */
    async getMultiplePlayerStats(players, progressCallback = null) {
        const results = [];
        let rapidCount = 0;
        let scraperCount = 0;

        for (let i = 0; i < players.length; i++) {
            const player = players[i];

            const stats = await this.getPlayerStats(player.platform, player.name);

            // Track source usage
            if (stats.source === 'RapidAPI') rapidCount++;
            else scraperCount++;

            results.push({
                ...player,
                ...stats
            });

            // Progress update
            if (progressCallback) {
                progressCallback(i + 1, players.length, stats.source, rapidCount, scraperCount);
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        return results;
    }

    /**
     * Get usage statistics
     */
    getUsageStats() {
        return {
            requestsToday: this.requestsToday,
            dailyLimit: this.dailyLimit,
            remaining: this.dailyLimit - this.requestsToday,
            usingRapidAPI: !!this.rapidApiKey,
            hasReachedLimit: this.checkDailyLimit()
        };
    }
}

module.exports = HybridRLAPI;
