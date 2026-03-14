/* ⚖️ ENGINE v1 - REFEREE MODULE */
function validatePlacement() {
    if (!placedTiles.length) return false;
    const r0 = Math.floor(placedTiles[0].index / board.cols);
    const c0 = placedTiles[0].index % board.cols;
    const sameRow = placedTiles.every(p => Math.floor(p.index / board.cols) === r0);
    const sameCol = placedTiles.every(p => p.index % board.cols === c0);
    if (!sameRow && !sameCol) return false;
    placedTiles.sort((a,b) => a.index - b.index);
    const step = sameRow ? 1 : board.cols;
    for (let i = placedTiles[0].index; i <= placedTiles[placedTiles.length-1].index; i += step) {
        if (!getTileAt(i)) return false;
    }
    const hasFixed = document.querySelector('.tile.fixed');
    if (!hasFixed) return placedTiles.some(p => p.index === (rules.validation.centerIndex || 112));
    return placedTiles.some(p => {
        return [p.index-1, p.index+1, p.index-board.cols, p.index+board.cols].some(a => getTileAt(a)?.classList.contains('fixed'));
    });
}

function calculateScore(tilesInWord) {
    let total = 0, mult = 1;
    tilesInWord.forEach(idx => {
        const tile = getTileAt(idx);
        const v = parseInt(tile.dataset.value) || 0;
        const isNew = placedTiles.find(p => p.index === idx);
        const bonus = (isNew && layout[idx]) ? scoring.multipliers[layout[idx].c] : null;
        if (bonus?.type === "letter") total += (v * bonus.value);
        else total += v;
        if (bonus?.type === "word") mult *= bonus.value;
    });
    let final = total * mult;
    if (placedTiles.length >= 7) final += 50; 
    return final;
}

function checkWordInDictionary(word) {
    const cleanWord = word.trim().toUpperCase();
    if (cleanWord.length < 2) return { valid: false, msg: "TOO SHORT" };
    if (dictionary.has(cleanWord)) return { valid: true, msg: "VALID" };
    return { valid: false, msg: "NOT FOUND" };
}
