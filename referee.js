/* ⚖️ ENGINE v1 - REFEREE MODULE */

function validatePlacement() {
    // 1. Check if any tiles were actually moved
    if (!placedTiles || placedTiles.length === 0) return false;

    // 2. Get the indices of the tiles currently being played
    const indices = placedTiles.map(p => parseInt(p.index));
    
    // 3. Simple Alignment Check: Are they all in the same row or same column?
    const r0 = Math.floor(indices[0] / board.cols);
    const c0 = indices[0] % board.cols;
    
    const sameRow = indices.every(idx => Math.floor(idx / board.cols) === r0);
    const sameCol = indices.every(idx => idx % board.cols === c0);

    if (!sameRow && !sameCol) {
        console.log("Referee: Tiles not aligned in row or column");
        return false;
    }

    // 4. First Move Check: Does one tile hit the center? (Index 112 for 15x15)
    const hasFixed = document.querySelector('.tile.fixed');
    if (!hasFixed) {
        const centerIndex = 112; 
        const hitsCenter = indices.includes(centerIndex);
        if (!hitsCenter) {
            console.log("Referee: First move must touch the center star!");
            return false;
        }
        return true; // First move is valid if aligned and on center
    }

    // 5. Connection Check: Is it touching an existing (fixed) tile?
    const isTouching = indices.some(idx => {
        const neighbors = [idx-1, idx+1, idx-board.cols, idx+board.cols];
        return neighbors.some(n => {
            const neighborTile = document.querySelector(`.cell[data-index="${n}"] .tile.fixed`);
            return neighborTile !== null;
        });
    });

    if (!isTouching) {
        console.log("Referee: Word must connect to existing tiles");
        return false;
    }

    return true;
}

function checkWordInDictionary(word) {
    const cleanWord = word.trim().toUpperCase();
    if (cleanWord.length < 2) return { valid: false, msg: "TOO SHORT" };
    if (dictionary.has(cleanWord)) return { valid: true, msg: "VALID" };
    return { valid: false, msg: "NOT FOUND" };
}
