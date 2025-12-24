/**
 * Seed Calculator for Rocket League Tournaments
 * Calculates optimal seeding based on MMR, win rate, and experience
 */

class SeedCalculator {
    /**
     * Calculate seed score for a player
     * @param {Object} playerStats - Stats from TrackerScraper
     * @returns {number} Seed score (higher = better seed)
     */
    calculateSeedScore(playerStats) {
        const { mmr = 0, winRate = 50, gamesPlayed = 0 } = playerStats;

        // Weights
        const MMR_WEIGHT = 0.70;      // 70% - Primary ranking factor
        const WIN_RATE_WEIGHT = 0.20; // 20% - Consistency factor
        const EXPERIENCE_WEIGHT = 0.10; // 10% - Experience bonus

        // Normalize win rate to 0-100 scale
        const normalizedWinRate = Math.min(Math.max(winRate || 50, 0), 100);

        // Experience score (capped at 1000 games for max bonus)
        const experienceScore = Math.min(gamesPlayed, 1000);

        // Calculate weighted score
        const score =
            (mmr * MMR_WEIGHT) +
            (normalizedWinRate * WIN_RATE_WEIGHT) +
            (experienceScore * EXPERIENCE_WEIGHT);

        return Math.round(score);
    }

    /**
     * Generate seeds for all players
     * @param {Array} playersWithStats - Array of player objects with stats
     * @returns {Array} Sorted array with seed numbers assigned
     */
    generateSeeds(playersWithStats) {
        // Calculate scores
        const playersWithScores = playersWithStats.map(player => ({
            ...player,
            seedScore: this.calculateSeedScore(player)
        }));

        // Sort by score (descending) then alphabetically by name
        playersWithScores.sort((a, b) => {
            if (b.seedScore !== a.seedScore) {
                return b.seedScore - a.seedScore;
            }
            // Tie-breaker: alphabetical
            return a.name.localeCompare(b.name);
        });

        // Assign seed numbers
        const seededPlayers = playersWithScores.map((player, index) => ({
            ...player,
            seed: index + 1
        }));

        return seededPlayers;
    }

    /**
     * Format seeds as CSV for Start.gg import
     * @param {Array} seededPlayers - Players with assigned seeds
     * @returns {string} CSV content
     */
    formatAsCSV(seededPlayers) {
        const header = 'Seed,Team Name,Platform,MMR,Rank,Win Rate,Games Played,Score\n';

        const rows = seededPlayers.map(player => {
            const winRate = player.winRate !== null ? `${player.winRate}%` : 'N/A';
            return [
                player.seed,
                `"${player.name}"`,  // Quoted in case of special characters
                player.platform,
                player.mmr || 0,
                player.rank || 'Unranked',
                winRate,
                player.gamesPlayed || 0,
                player.seedScore
            ].join(',');
        });

        return header + rows.join('\n');
    }

    /**
     * Get summary stats for Discord embed
     * @param {Array} seededPlayers - Players with assigned seeds
     * @returns {Object} Summary statistics
     */
    getSummary(seededPlayers) {
        const topSeeds = seededPlayers.slice(0, 5);
        const avgMMR = Math.round(
            seededPlayers.reduce((sum, p) => sum + (p.mmr || 0), 0) / seededPlayers.length
        );

        const rankedPlayers = seededPlayers.filter(p => p.mmr > 0).length;
        const unrankedPlayers = seededPlayers.length - rankedPlayers;

        return {
            topSeeds,
            avgMMR,
            rankedPlayers,
            unrankedPlayers,
            totalPlayers: seededPlayers.length
        };
    }
}

module.exports = SeedCalculator;
