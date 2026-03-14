/* ⚖️ REFEREE MODULE - FIXED SYNC */
function validatePlacement() {
    if (!placedTiles || placedTiles.length === 0) return false;

    // Get indices and sort them to check continuity
    const indices = placedTiles.map(p => parseInt(p.index)).sort((a, b) => a - b);
    
    const cols = board.cols;
    const r0 = Math.floor(indices[0] / cols);
    const c0 = indices[0] % cols;
    
    const sameRow = indices.every(idx => Math.floor(idx / cols) === r0);
    const sameCol = indices.every(idx => idx % cols === c0);

    if (!sameRow && !sameCol) return false;

    // Check for gaps between placed tiles
    const step = sameRow ? 1 : cols;
    for (let i = indices[0]; i <= indices[indices.length - 1]; i += step) {
        const cell = document.querySelector(`.cell[data-index="${i}"]`);
        if (!cell.querySelector('.tile')) return false; 
    }

    const hasFixed = document.querySelector('.tile.fixed');
    if (!hasFixed) {
        const centerIndex = Math.floor(board.size / 2); 
        return indices.includes(centerIndex);
    }

    // Connection check
    return indices.some(idx => {
        const neighbors = [idx-1, idx+1, idx-cols, idx+cols];
        return neighbors.some(n => {
            const nb = document.querySelector(`.cell[data-index="${n}"] .tile.fixed`);
            return nb !== null;
        });
    });
}
