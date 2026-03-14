/* 🤖 ENGINE v1 - AI BRAIN MODULE */
async function playBotTurn() {
    if (!dictArray) dictArray = Array.from(dictionary);
    const anchors = Array.from(document.querySelectorAll('.tile.fixed'));
    const rackTiles = Array.from(document.getElementById('bot-rack').querySelectorAll('.tile'));
    const rackLetters = rackTiles.map(t => t.dataset.letter);
    let moveFound = false;

    // RULE 1: FIRST TURN (No anchors)
    if (anchors.length === 0) {
        const centerIdx = rules.validation.centerIndex || Math.floor(board.size / 2);
        for (let word of dictArray) {
            if (word.length < 2 || word.length > 7) continue;
            if (canMakeWord(word, rackLetters)) {
                if (testBotPlacement(word, centerIdx, 1, rackTiles)) { moveFound = true; break; }
            }
        }
    } 
    // RULE 2: TARGETED ANCHOR SEARCH
    else {
        anchors.sort(() => Math.random() - 0.5); // Randomize play styles
        for (let anchor of anchors) {
            const aIdx = parseInt(anchor.parentElement.dataset.index);
            const aLet = anchor.dataset.letter;
            
            // ⚡ SMART FILTER: Only search words containing this exact board letter
            let possibleWords = dictArray.filter(w => w.includes(aLet) && w.length >= 2 && w.length <= 8);
            possibleWords.sort(() => Math.random() - 0.5); 
            possibleWords = possibleWords.slice(0, 1500); // Prevent browser freezing

            for (let word of possibleWords) {
                if (!canMakeWordWithAnchor(word, aLet, rackLetters)) continue;
                
                const aPosInWord = word.indexOf(aLet);
                
                // Try Horizontal Fit
                const startIdxH = aIdx - aPosInWord;
                if (Math.floor(startIdxH / board.cols) === Math.floor(aIdx / board.cols)) { 
                    if (testBotPlacement(word, startIdxH, 1, rackTiles)) { moveFound = true; break; } 
                }
                
                // Try Vertical Fit
                const startIdxV = aIdx - (aPosInWord * board.cols);
                if (startIdxV >= 0) { 
                    if (testBotPlacement(word, startIdxV, board.cols, rackTiles)) { moveFound = true; break; } 
                }
            }
            if (moveFound) break;
        }
    }

    if (!moveFound) {
        document.getElementById('turn-status').innerText = "🤖 PASSES";
        rackTiles.forEach(t => t.remove()); // Dump bad hand
        refillRack('bot-rack');
        setTimeout(() => { switchTurn('player'); }, 1500);
    }
}

// Math checkers for the Bot's Rack
function canMakeWord(word, rack) {
    let tempRack = [...rack];
    for (let char of word) {
        const rIdx = tempRack.indexOf(char);
        if (rIdx > -1) tempRack.splice(rIdx, 1);
        else if (tempRack.includes('?')) tempRack.splice(tempRack.indexOf('?'), 1);
        else return false;
    }
    return true;
}

function canMakeWordWithAnchor(word, anchorLetter, rack) {
    let tempRack = [...rack];
    let usedAnchor = false;
    for (let char of word) {
        if (char === anchorLetter && !usedAnchor) { usedAnchor = true; continue; }
        const rIdx = tempRack.indexOf(char);
        if (rIdx > -1) tempRack.splice(rIdx, 1);
        else if (tempRack.includes('?')) tempRack.splice(tempRack.indexOf('?'), 1);
        else return false;
    }
    return true;
}

// Physics simulator for Bot Placements
function testBotPlacement(word, startIdx, step, rackTiles) {
    placedTiles = []; let usedRackTiles = [], valid = true;
    for (let i = 0; i < word.length; i++) {
        const cellIdx = startIdx + (i * step);
        if (cellIdx < 0 || cellIdx >= board.size) { valid = false; break; }
        if (step === 1 && Math.floor(cellIdx / board.cols) !== Math.floor(startIdx / board.cols)) { valid = false; break; }
        const cell = document.querySelector(`.cell[data-index="${cellIdx}"]`);
        if (!cell) { valid = false; break; }
        const existingTile = cell.querySelector('.tile');
        
        if (existingTile) {
            if (existingTile.dataset.letter !== word[i]) { valid = false; break; }
        } else {
            let rTile = rackTiles.find(t => t.dataset.letter === word[i] && !usedRackTiles.includes(t));
            if (!rTile) rTile = rackTiles.find(t => t.dataset.raw === '?' && !usedRackTiles.includes(t));
            if (!rTile) { valid = false; break; }
            usedRackTiles.push(rTile); cell.appendChild(rTile); rTile.classList.add('on-board');
            rTile.style.width = '100%'; rTile.style.height = '100%'; rTile.style.position = 'absolute'; rTile.style.transform = 'none';
            if(rTile.dataset.raw === '?') { rTile.dataset.letter = word[i]; rTile.dataset.value = (tiles.distribution.find(x=>x.l===word[i])?.v || 0); rTile.querySelector('span').innerText = word[i]; rTile.classList.add('wild'); }
            placedTiles.push({el: rTile, index: cellIdx});
        }
    }
    if (valid && placedTiles.length > 0 && handlePlayWord(true)) { return true; } 
    else {
        placedTiles.forEach(p => {
            const r = document.getElementById('bot-rack'); p.el.classList.remove('on-board'); p.el.style.position = 'relative'; p.el.style.width = `${physics.tile.size}px`; p.el.style.height = `${physics.tile.size}px`;
            if(p.el.dataset.raw === '?') { p.el.dataset.letter = '?'; p.el.dataset.value = 0; p.el.querySelector('span').innerText = '?'; p.el.classList.remove('wild'); }
            r.appendChild(p.el);
        });
        placedTiles = []; return false;
    }
}
