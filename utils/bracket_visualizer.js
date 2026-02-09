const { createCanvas, registerFont } = require('canvas');
const { AttachmentBuilder } = require('discord.js');

// Constants for drawing
const BOX_WIDTH = 220;
const BOX_HEIGHT = 60;
const COLUMN_GAP = 80;
const ROUND_MARGIN = 50;
const CARD_PADDING = 10;
const FONT_FAMILY = 'Sans'; // Default system font

/**
 * Generates an image of the bracket.
 * @param {Array} sets - Array of set objects from Start.gg API
 * @param {String} title - Title of the bracket view
 * @returns {AttachmentBuilder} Discord attachment
 */
async function generateBracketImage(sets, title) {
    // 1. Group sets by round
    // rounds will be an object: { "1": [set, set], "2": [set] }
    // We assume sets are already filtered to be just Winners or just Losers for cleaner drawing
    const roundsMap = {};
    sets.forEach(set => {
        const r = set.round;
        if (!roundsMap[r]) roundsMap[r] = [];
        roundsMap[r].push(set);
    });

    const roundNumbers = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);
    const numRounds = roundNumbers.length;

    // Determine max matches in a single round for height calculation
    let maxMatchesInRound = 0;
    Object.values(roundsMap).forEach(roundSets => {
        // Sort sets by identifier if available to keep bracket order? 
        // Start.gg API often returns them in order or has an identifier. 
        // For simple visualization, assuming API order or ID order usually works for small brackets.
        // Let's sort by ID as a proxy for "top to bottom" if they were created sequentially
        roundSets.sort((a, b) => a.id - b.id);
        if (roundSets.length > maxMatchesInRound) maxMatchesInRound = roundSets.length;
    });

    // 2. Calculate Canvas Size
    const canvasWidth = ROUND_MARGIN * 2 + (numRounds * BOX_WIDTH) + ((numRounds - 1) * COLUMN_GAP);
    // Height needs to accommodate spacing. 
    // Standard bracket spacing: R1 has N items. R2 items are centered between R1 parents.
    // Simplification: Calculate height based on the "densest" round (usually the first one drawn)
    // and assume uniform vertical spacing for that round.
    const verticalGap = 20;
    const canvasHeight = ROUND_MARGIN * 2 + (maxMatchesInRound * (BOX_HEIGHT + verticalGap));

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // 3. Draw Background
    ctx.fillStyle = '#2F3136'; // Discord Dark Mode background
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px ' + FONT_FAMILY;
    ctx.fillText(title, ROUND_MARGIN, 35);

    // 4. Draw Rounds
    // We need to track the Y-position of each match to draw connection lines.
    // Map<SetID, {x, y, width, height}>
    const matchPositions = new Map();

    // Helper: Calculate Y position
    // For a binary tree (Winners), matches in Round R are positioned based on Round R-1?
    // Or simpler: Just render them spaced out.
    // If it's a visualizer, we want the "tree" look.
    // Strategy: 
    // - Determine the "slots" for the first round. 
    // - Subsequent rounds, place matches equidistant between their "feeds".
    // - THIS IS HARD without knowing the exact lineage (feeders).
    // - FALLBACK STRATEGY: Isolate spacing.
    //   - R1: Spacing = 1 unit.
    //   - R2: Spacing = 2 units.
    //   - R3: Spacing = 4 units.

    // Let's try to infer if it's a standard bracket (Winners).
    // The "densest" round is usually the first one (e.g. Round 1 or Round -1).
    // We'll assign "slots" to the densest round and propagate spacing.

    const firstRoundNum = roundNumbers[0];
    const initialRoundSets = roundsMap[firstRoundNum];

    // We'll iterate columns (Rounds)
    roundNumbers.forEach((rNum, colIndex) => {
        const roundSets = roundsMap[rNum];
        // Calculate X
        const x = ROUND_MARGIN + colIndex * (BOX_WIDTH + COLUMN_GAP);

        // Calculate Y spacing factory
        // If it's the first column, simple spacing.
        // If it's later columns, we inherently have fewer matches.
        // Simple tree spacing: 2^colIndex * spacing
        const spacingMultiplier = Math.pow(2, colIndex);

        // Initial offset to center the first item properly relative to the previous column's two items
        // R1: offset 0 (relative)
        // R2: offset usually half of R1's item height + gap

        const effectiveHeight = BOX_HEIGHT + verticalGap;

        // Center logic:
        // The total drawing area height is mostly constant.
        // Each match in colIndex is centered in a "block" of height (totalHeight / itemsInCol).
        const blockHeight = canvasHeight / roundSets.length; // Approximate

        // Better tree logic:
        // y = startY + i * (effectiveHeight * multiplier)

        // Let's use flexible layouting: just stack them centered if we don't assume tree connections.
        // User requested "arrows". Arrows imply connections.
        // Without clear "PrereqMatchID", perfectly connecting lines is guess work.
        // We will assume Set[i] in Round[R] connects to Set[floor(i/2)] in Round[R+1].

        roundSets.forEach((set, i) => {
            // Basic Tree Spacing
            // For standard top 8:
            // R1 (4 matches): y = 0, 1, 2, 3 * unit
            // R2 (2 matches): y = 0.5, 2.5 * unit
            // R3 (1 match): y = 1.5 * unit
            // unit = space needed for one R1 match.

            // Base unit height based on max density
            const unitHeight = (BOX_HEIGHT + verticalGap);

            // Vertical center of the "slot" in the grid
            // Slot index in the theoretical full grid depends on power of 2
            // This assumes strictly binary tree which might break for Losers or weird brackets.
            // BUT for a "Visual Graphic" requested by user, clean alignment is key.

            // let geometricIndex = i * Math.pow(2, colIndex) + (Math.pow(2, colIndex) - 1) / 2;
            // This places R2-0 between R1-0 and R2-1.

            // Check if we are in Losers (rounds < 0) - layout is linear or different.
            // If Losers, just stack them cleanly.

            let y = 0;
            if (rNum < 0) {
                // Losers bracket logic: just stack
                y = ROUND_MARGIN + i * (BOX_HEIGHT + verticalGap) + 40;
            } else {
                // Winners bracket tree logic
                const geometricOffset = (Math.pow(2, colIndex) - 1) / 2;
                const geometricGap = Math.pow(2, colIndex);
                const gridPos = i * geometricGap + geometricOffset;
                y = ROUND_MARGIN + gridPos * unitHeight + 40; // +40 for title
            }

            // Store position
            matchPositions.set(set.id, { x, y, w: BOX_WIDTH, h: BOX_HEIGHT });

            // Draw Match Box
            drawMatch(ctx, x, y, set);
        });
    });

    // 5. Draw Connections (Lines)
    // Try to guess connections if reasonable
    if (roundNumbers.every(r => r > 0)) { // Only try to draw smart arrows for Winners
        roundNumbers.forEach((rNum, colIndex) => {
            if (colIndex === roundNumbers.length - 1) return; // Last round has no next match drawn

            const currentSets = roundsMap[rNum];
            const nextRoundSets = roundsMap[roundNumbers[colIndex + 1]];

            currentSets.forEach((set, i) => {
                // Guess parent: index i maps to floor(i/2) in next round
                const predictedParentIndex = Math.floor(i / 2);
                const targetSet = nextRoundSets[predictedParentIndex];

                if (targetSet) {
                    const start = matchPositions.get(set.id);
                    const end = matchPositions.get(targetSet.id);

                    if (start && end) {
                        drawArrow(ctx, start.x + start.w, start.y + start.h / 2, end.x, end.y + end.h / 2);
                    }
                }
            });
        });
    }

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'bracket.png' });
}

function drawMatch(ctx, x, y, set) {
    // Box
    ctx.fillStyle = '#202225';
    ctx.beginPath();
    ctx.roundRect(x, y, BOX_WIDTH, BOX_HEIGHT, 10);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#40444B';
    ctx.stroke();

    // Scores bg
    ctx.fillStyle = '#292B2F';
    ctx.beginPath();
    ctx.roundRect(x + BOX_WIDTH - 40, y, 40, BOX_HEIGHT, { topRight: 10, bottomRight: 10 });
    ctx.fill();

    // Players
    const p1 = set.slots[0]?.entrant?.name || 'TBD';
    const p2 = set.slots[1]?.entrant?.name || 'TBD';

    // Parse score string "2 - 1" or similar
    // Start.gg displayScore is often "Tag 2 - Tag 1" or just "DQ"
    // We'll try to extract numbers if possible, or just parse displayScore
    /* 
       displayScore examples: 
       "EntrantA 3 - EntrantB 0"
       "EntrantA W - EntrantB L"
       "DQ"
    */
    let s1 = '-';
    let s2 = '-';

    if (set.displayScore && set.displayScore !== 'DQ') {
        const parts = set.displayScore.match(/(-?\d+)\s*-\s*(-?\d+)/);
        if (parts) {
            // Usually displayScore order matches slot order? Use names to identify score if possible?
            // Actually Start.gg displayScore puts Winner score first usually? Nontrivial.
            // Simplification: Check if the string ends with digits.
            // Let's just put placeholders or basic regex logic.
            // Assuming "Name1 Score - Name2 Score" format logic is complex to parsing.
            // We'll leave scores blank for now or just generic if we can't parse easily.

            // Quick hack: if set has winnerId, bold that name
        }
    }

    ctx.font = 'bold 14px ' + FONT_FAMILY;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(truncate(p1, 18), x + 10, y + 22);
    ctx.fillText(truncate(p2, 18), x + 10, y + 48);

    // Winner Highlight
    if (set.winnerId) {
        ctx.fillStyle = '#3BA55C'; // Green indicator
        if (set.slots[0]?.entrant?.id === set.winnerId) {
            ctx.fillRect(x, y + 5, 4, 20);
        } else if (set.slots[1]?.entrant?.id === set.winnerId) {
            ctx.fillRect(x, y + 35, 4, 20);
        }
    }
}

function drawArrow(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#72767D';

    // Elbow connector
    const midX = (x1 + x2) / 2;

    ctx.moveTo(x1, y1);
    ctx.lineTo(midX, y1);
    ctx.lineTo(midX, y2);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function truncate(str, len) {
    if (str.length > len) return str.substring(0, len) + '..';
    return str;
}

module.exports = { generateBracketImage };
