let layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics;
let dictionary = new Set(), dictArray = null, bag = [], placedTiles = [], currentMode = 'dark';
let scores = { player: 0, bot: 0 }, currentPlayer = 'player';
let activeTile = null, targetX = 0, targetY = 0, currentX = 0, currentY = 0, wildTarget = null;

const urlParams = new URLSearchParams(window.location.search);
let gameId = urlParams.get('id') || `game_${Date.now()}`;
if (gameId === 'new') { gameId = `game_${Date.now()}`; window.history.replaceState(null, '', `game.html?id=${gameId}`); }

async function startEngine() {
    try {
        const fetchJson = (url) => fetch(url).then(r => r.ok ? r.json() : null);
        const res = await Promise.all([
            fetchJson('./lexicon/layout.json'), fetchJson('./lexicon/board.json'),
            fetchJson('./lexicon/tiles.json'), fetchJson('./lexicon/theme.json'),
            fetchJson('./lexicon/ui.json'), fetchJson('./lexicon/rules.json'),
            fetchJson('./lexicon/play.json'), fetchJson('./lexicon/scoring.json'), 
            fetchJson('./lexicon/wildcard.json'), fetchJson('./lexicon/physics.json')
        ]);
        [layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics] = res;
        currentMode = theme?.active || 'dark';
        
        if(playRules && playRules.validation.dictionaryUrl) {
            const dText = await fetch(playRules.validation.dictionaryUrl).then(r => r.text());
            dictionary = new Set(dText.toUpperCase().match(/[A-Z]+/g));
        }
        
        if (!document.getElementById('bot-rack')) {
            const br = document.createElement('div'); br.id = 'bot-rack'; br.style.display = 'none'; document.body.appendChild(br);
        }
        
        applyLexiconTheme(); buildHeader(); buildGrid(); buildUI(); setupWildcard();
        if (!loadGameState()) { initBag(); refillRack('rack'); refillRack('bot-rack'); }
        requestAnimationFrame(updateMotion);
    } catch (e) { console.error("Engine Error:", e); }
}

function saveGameState() {
    const state = { id: gameId, scores: scores, currentPlayer: currentPlayer, bag: bag, board: [], rack: [], botRack: [], opponent: 'Engine v1', status: currentPlayer === 'player' ? 'YOUR TURN' : 'BOT TURN', updatedAt: Date.now() };
    document.querySelectorAll('.tile.fixed').forEach(t => { state.board.push({ index: parseInt(t.parentElement.dataset.index), l: t.dataset.letter, v: t.dataset.value, raw: t.dataset.raw }); });
    document.querySelectorAll('#rack .tile').forEach(t => { state.rack.push({ l: t.dataset.letter, v: t.dataset.value, raw: t.dataset.raw }); });
    document.querySelectorAll('#bot-rack .tile').forEach(t => { state.botRack.push({ l: t.dataset.letter, v: t.dataset.value, raw: t.dataset.raw }); });
    localStorage.setItem(`glyphs_save_${gameId}`, JSON.stringify(state));
}

function loadGameState() {
    const saved = localStorage.getItem(`glyphs_save_${gameId}`);
    if (saved) {
        const state = JSON.parse(saved);
        scores = state.scores || { player: state.score || 0, bot: 0 };
        currentPlayer = state.currentPlayer || 'player';
        document.getElementById('score-player').innerText = scores.player.toString().padStart(3, '0');
        document.getElementById('score-bot').innerText = scores.bot.toString().padStart(3, '0');
        bag = state.bag;
        state.board.forEach(item => {
            const cell = document.querySelector(`.cell[data-index="${item.index}"]`);
            if(cell) {
                const t = document.createElement('div'); t.className = 'tile fixed on-board';
                const dVal = item.raw === '?' ? '?' : item.v;
                t.innerHTML = `<span>${item.l}</span><span class="val">${dVal}</span>`;
                t.dataset.letter = item.l; t.dataset.raw = item.raw; t.dataset.value = item.v;
                cell.appendChild(t);
            }
        });
        const r = document.getElementById('rack');
        state.rack.forEach(item => {
            const t = document.createElement('div'); t.className = 'tile';
            const dVal = item.raw === '?' ? '?' : item.v;
            t.innerHTML = `<span>${item.l}</span><span class="val">${dVal}</span>`;
            t.dataset.letter = item.l; t.dataset.raw = item.raw; t.dataset.value = item.v;
            r.appendChild(t); makeDraggable(t);
        });
        const br = document.getElementById('bot-rack');
        if (state.botRack) {
            state.botRack.forEach(item => {
                const t = document.createElement('div'); t.className = 'tile';
                t.dataset.letter = item.l; t.dataset.raw = item.raw; t.dataset.value = item.v;
                br.appendChild(t);
            });
        }
        updateClusterOutlines();
        switchTurn(currentPlayer);
        return true; 
    }
    return false;
}

function buildHeader() { 
    document.getElementById('game-header').innerHTML = `
    <div style="display:flex; justify-content:space-between; width:100%; align-items:center; padding: 0 10px;">
        <div style="text-align:left"><div style="font-size:0.6rem; color:#888; letter-spacing:1px">PLAYER</div><div id="score-player" style="color:var(--gold); font-weight:900; font-size:1.6rem">000</div></div>
        <div id="turn-status" style="font-size:0.75rem; font-weight:900; color:var(--dl); letter-spacing:2px; text-align:center">YOUR TURN</div>
        <div style="text-align:right"><div style="font-size:0.6rem; color:#888; letter-spacing:1px">ENGINE v1</div><div id="score-bot" style="color:var(--tw); font-weight:900; font-size:1.6rem">000</div></div>
    </div>`; 
}

function applyLexiconTheme() {
    if (!theme || !theme.modes[currentMode] || !board) return; const m = theme.modes[currentMode]; const root = document.documentElement.style; Object.keys(m.colors).forEach(k => root.setProperty(`--${k}`, m.colors[k]));
    const style = document.getElementById('lexicon-styles') || document.createElement("style"); style.id = 'lexicon-styles';
    style.innerText = `.grid { grid-template-columns: repeat(${board.cols}, 1fr); grid-auto-rows: 1fr; gap: ${board.gap || '2px'}; border: 1px solid var(--gridLine); } .cell { background: var(--obsidian); backdrop-filter: blur(${m.effects.blur}); -webkit-backdrop-filter: blur(${m.effects.blur}); box-shadow: ${m.effects.bevel}; position: relative; } .dl { color: var(--dl); box-shadow: inset 0 0 ${m.effects.glow} var(--dl); } .tl { color: var(--tl); box-shadow: inset 0 0 ${m.effects.glow} var(--tl); } .dw { color: var(--dw); box-shadow: inset 0 0 ${m.effects.glow} var(--dw); } .tw { color: var(--tw); box-shadow: inset 0 0 ${m.effects.glow} var(--tw); } .dd { color: var(--dd); box-shadow: inset 0 0 ${m.effects.glow} var(--dd); } .live-score-badge { position: absolute; background: var(--dl); color: #000; font-size: 0.65rem; font-weight: 900; padding: 2px 6px; border-radius: 6px; z-index: 1000; box-shadow: 0 4px 10px rgba(0,0,0,0.8); pointer-events: none; border: 1px solid #000; transition: top 0.2s, left 0.2s; } .tile.fixed { box-sizing: border-box; transition: border-radius 0.2s ease, border 0.2s ease; } .tile.fixed.edge-t { border-top: 2px solid var(--gold); } .tile.fixed.edge-r { border-right: 2px solid var(--gold); } .tile.fixed.edge-b { border-bottom: 2px solid var(--gold); } .tile.fixed.edge-l { border-left: 2px solid var(--gold); } .tile.fixed.corner-tl { border-top-left-radius: 8px !important; } .tile.fixed.corner-tr { border-top-right-radius: 8px !important; } .tile.fixed.corner-bl { border-bottom-left-radius: 8px !important; } .tile.fixed.corner-br { border-bottom-right-radius: 8px !important; }`;
    document.head.appendChild(style);
}

function buildGrid() { const g = document.getElementById('grid'); g.innerHTML = ''; if(!board) return; for(let i=0; i<board.size; i++) { const c = document.createElement('div'); c.className = 'cell'; c.dataset.index = i; if(layout && layout[i]) { c.innerText = layout[i].t; c.classList.add(layout[i].c); } g.appendChild(c); } }
function buildUI() { if(!ui) return; const ctrl = document.getElementById('ui-controls'); ctrl.innerHTML = ''; ui.buttons.forEach(btn => { const b = document.createElement('button'); b.className = btn.class; b.innerText = btn.text; if(btn.action === 'shuffleRack') b.onclick = shuffleRack; if(btn.action === 'recallTiles') b.onclick = recallTiles; if(btn.action === 'toggleTheme') b.onclick = () => { currentMode = currentMode === 'dark' ? 'light' : 'dark'; applyLexiconTheme(); }; if(btn.action === 'playWord') b.onclick = () => handlePlayWord(false); if(btn.action === 'goHome') b.onclick = () => window.location.href='index.html'; ctrl.appendChild(b); }); }

function updateMotion() { if (activeTile && physics) { const lerp = physics.motion.lerp || 0.4; currentX += (targetX - currentX) * lerp; currentY += (targetY - currentY) * lerp; activeTile.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${physics.motion.dragScale})`; } requestAnimationFrame(updateMotion); }

function makeDraggable(el) {
    let ox, oy, gRect; const dragLayer = document.getElementById('drag-layer');
    const start = (e) => {
        if(el.classList.contains('fixed') || !physics || currentPlayer !== 'player') return;
        const t = e.touches ? e.touches[0] : e; ox = physics.tile.centerOffset; oy = physics.tile.centerOffset; gRect = document.getElementById('grid').getBoundingClientRect();
        if(el.parentElement.classList.contains('cell')) { placedTiles = placedTiles.filter(p => p.el !== el); el.classList.remove('on-board'); updateLiveScore(); }
        activeTile = el; el.style.width = `${physics.tile.size}px`; el.style.height = `${physics.tile.size}px`; el.style.position = 'absolute'; el.style.margin = '0px'; el.style.left = '0px'; el.style.top = '0px';
        dragLayer.appendChild(el); el.classList.add('dragging');
        currentX = t.clientX - ox; currentY = t.clientY - oy; targetX = currentX; targetY = currentY; el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${physics.motion.dragScale})`;
        if(e.cancelable) e.preventDefault(); e.stopPropagation();
    };
    const move = (e) => {
        if(!activeTile || activeTile !== el || !physics) return; const t = e.touches ? e.touches[0] : e; targetX = t.clientX - ox; targetY = t.clientY - oy;
        document.querySelectorAll('.cell.hover').forEach(c => c.classList.remove('hover'));
        const col = Math.floor((t.clientX - gRect.left) / (gRect.width / board.cols)), row = Math.floor((t.clientY - gRect.top) / (gRect.height / (board.size / board.cols))), idx = (row * board.cols) + col;
        if (idx >= 0 && idx < board.size && t.clientX >= gRect.left && t.clientX <= gRect.right) { const targetCell = document.querySelector(`.cell[data-index="${idx}"]`); if(targetCell && !targetCell.querySelector('.tile')) targetCell.classList.add('hover'); }
    };
    const end = (e) => {
        if(!activeTile || activeTile !== el || !physics) return;
        el.classList.remove('dragging'); activeTile = null; const t = e.changedTouches ? e.changedTouches[0] : e; const slop = physics.bounds.hitSlop;
        if (t.clientX >= (gRect.left - slop) && t.clientX <= (gRect.right + slop) && t.clientY >= (gRect.top - slop) && t.clientY <= (gRect.bottom + slop)) {
            const col = Math.floor((t.clientX - gRect.left) / (gRect.width / board.cols)), row = Math.floor((t.clientY - gRect.top) / (gRect.height / (board.size / board.cols))), idx = (row * board.cols) + col;
            const target = document.querySelector(`.cell[data-index="${idx}"]`);
            if (target && !target.querySelector('.tile')) {
                target.appendChild(el); el.classList.add('on-board'); el.style.width = '100%'; el.style.height = '100%'; el.style.position = 'absolute'; el.style.left = '0'; el.style.top = '0'; el.style.transform = 'none'; placedTiles.push({el, index: idx}); updateLiveScore();
                if (el.dataset.raw === '?') { wildTarget = el; document.getElementById('wildcard-modal').style.display = 'flex'; } return;
            }
        }
        document.getElementById('rack').appendChild(el); el.style.width = `${physics.tile.size}px`; el.style.height = `${physics.tile.size}px`; el.style.position = 'relative'; el.style.left = 'auto'; el.style.top = 'auto'; el.style.transform = 'none'; updateLiveScore();
    };
    el.addEventListener('touchstart', start, { passive: false }); window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', end, { passive: false });
}

function initBag() { if(!tiles) return; tiles.distribution.forEach(d => { for(let i=0; i<d.q; i++) bag.push({...d}); }); bag.sort(() => Math.random() - 0.5); }

function refillRack(rackId) { 
    const r = document.getElementById(rackId); let currentTiles = Array.from(r.querySelectorAll('.tile')); let needed = 7 - currentTiles.length; if (needed <= 0 || bag.length === 0) return;
    const isVowel = (l) => ['A','E','I','O','U','?'].includes(l); let vowelCount = currentTiles.filter(t => isVowel(t.dataset.raw)).length; const MAX_VOWELS = 4;
    for (let i = 0; i < needed && bag.length > 0; i++) {
        let data = null;
        if (vowelCount === 0 && i === needed - 1) { const vIdx = bag.findIndex(t => isVowel(t.l)); if (vIdx !== -1) data = bag.splice(vIdx, 1)[0]; } 
        else if (vowelCount >= MAX_VOWELS) { const cIdx = bag.findIndex(t => !isVowel(t.l)); if (cIdx !== -1) data = bag.splice(cIdx, 1)[0]; }
        if (!data) data = bag.pop(); if (isVowel(data.l)) vowelCount++;
        const t = document.createElement('div'); t.className = 'tile'; const displayVal = data.l === '?' ? '?' : data.v;
        t.innerHTML = `<span>${data.l}</span><span class="val">${displayVal}</span>`; t.dataset.letter = data.l; t.dataset.raw = data.l; t.dataset.value = data.v; 
        r.appendChild(t); if (rackId === 'rack') makeDraggable(t); 
    } 
}

function validatePlacement() {
    if (!placedTiles.length) return false; if (!rules || !rules.validation) return true;
    const r0 = Math.floor(placedTiles[0].index / board.cols), c0 = placedTiles[0].index % board.cols;
    const sameRow = placedTiles.every(p => Math.floor(p.index / board.cols) === r0), sameCol = placedTiles.every(p => p.index % board.cols === c0);
    if (!sameRow && !sameCol) return false; placedTiles.sort((a,b) => a.index - b.index);
    const step = sameRow ? 1 : board.cols, minIdx = placedTiles[0].index, maxIdx = placedTiles[placedTiles.length - 1].index;
    for (let i = minIdx; i <= maxIdx; i += step) { if (!getTileAt(i)) return false; }
    const hasFixed = document.querySelector('.tile.fixed');
    if (!hasFixed) { const centerIdx = rules.validation.centerIndex || Math.floor(board.size / 2); return placedTiles.some(p => p.index === centerIdx); } 
    else { let touchesFixed = false; placedTiles.forEach(p => { const adj = [p.index - 1, p.index + 1, p.index - board.cols, p.index + board.cols]; adj.forEach(a => { const t = getTileAt(a); if (t && t.classList.contains('fixed')) touchesFixed = true; }); }); return touchesFixed; }
}

function updateClusterOutlines() {
    document.querySelectorAll('.tile.fixed').forEach(t => {
        const idx = parseInt(t.parentElement.dataset.index), r = Math.floor(idx / board.cols), c = idx % board.cols;
        const hasT = r > 0 && getTileAt(idx - board.cols)?.classList.contains('fixed'), hasB = r < (board.size/board.cols - 1) && getTileAt(idx + board.cols)?.classList.contains('fixed');
        const hasL = c > 0 && getTileAt(idx - 1)?.classList.contains('fixed'), hasR = c < (board.cols - 1) && getTileAt(idx + 1)?.classList.contains('fixed');
        t.classList.toggle('edge-t', !hasT); t.classList.toggle('edge-b', !hasB); t.classList.toggle('edge-l', !hasL); t.classList.toggle('edge-r', !hasR);
        t.classList.toggle('corner-tl', !hasT && !hasL); t.classList.toggle('corner-tr', !hasT && !hasR); t.classList.toggle('corner-bl', !hasB && !hasL); t.classList.toggle('corner-br', !hasB && !hasR);
    });
}

function updateLiveScore() {
    document.querySelectorAll('.live-score-badge').forEach(e => e.remove());
    if (!placedTiles.length || currentPlayer !== 'player') return;
    placedTiles.sort((a,b)=>a.index-b.index);
    let isH = true; if (placedTiles.length > 1) { isH = (placedTiles[1].index - placedTiles[0].index === 1); } else { const idx = placedTiles[0].index; if (getTileAt(idx - board.cols) || getTileAt(idx + board.cols)) isH = false; }
    const step = isH ? 1 : board.cols; let full = [], curr = placedTiles[0].index;
    while(curr >= 0 && getTileAt(curr-step)) curr -= step; while(curr < board.size && getTileAt(curr)) { full.push(curr); curr += step; }
    let total = 0, mult = 1;
    full.forEach(idx => {
        const v = parseInt(getTileAt(idx).dataset.value) || 0; const isNew = placedTiles.find(p => p.index === idx);
        const bonusType = (isNew && layout[idx]) ? layout[idx].c : null; const bonus = (bonusType && scoring?.multipliers) ? scoring.multipliers[bonusType] : null;
        if(bonus && bonus.type === "letter") total += (v * bonus.value); else total += v; if(bonus && bonus.type === "word") mult *= bonus.value;
    });
    let finalScore = total * mult; if(scoring?.bonuses && placedTiles.length >= scoring.bonuses.bingoThreshold) { finalScore += scoring.bonuses.bingo; }
    const lastCellEl = document.querySelector(`.cell[data-index="${full[full.length - 1]}"]`);
    if (lastCellEl) {
        const rect = lastCellEl.getBoundingClientRect(), gRect = document.getElementById('grid').getBoundingClientRect();
        const badge = document.createElement('div'); badge.className = 'live-score-badge'; badge.innerText = finalScore;
        badge.style.left = `${(rect.left - gRect.left) + rect.width - 12}px`; badge.style.top = isH ? `${(rect.top - gRect.top) - 12}px` : `${(rect.top - gRect.top) + rect.height - 12}px`;
        document.getElementById('grid').appendChild(badge);
    }
}

function handlePlayWord(isBot = false) {
    document.querySelectorAll('.feedback-node').forEach(n => n.remove());
    if(!isBot && currentPlayer !== 'player') return;
    if(!placedTiles.length) return;
    if (!validatePlacement()) { showFeedback(placedTiles[placedTiles.length-1].index, '❌ INVALID', 'feedback-node invalid-x'); if(!isBot) setTimeout(recallTiles, 1200); return false; }
    
    placedTiles.sort((a,b)=>a.index-b.index);
    let isH = true; if (placedTiles.length > 1) { isH = (placedTiles[1].index - placedTiles[0].index === 1); } else { const idx = placedTiles[0].index; if (getTileAt(idx - board.cols) || getTileAt(idx + board.cols)) isH = false; }
    const step = isH ? 1 : board.cols; let full = [], curr = placedTiles[0].index;
    while(curr >= 0 && getTileAt(curr-step)) curr -= step; while(curr < board.size && getTileAt(curr)) { full.push(curr); curr += step; }
    const word = full.map(idx => getTileAt(idx).dataset.letter).join('');
    
    if(dictionary.has(word)) {
        let total = 0, mult = 1;
        full.forEach(idx => {
            const v = parseInt(getTileAt(idx).dataset.value) || 0; const isNew = placedTiles.find(p => p.index === idx);
            const bonusType = (isNew && layout[idx]) ? layout[idx].c : null; const bonus = (bonusType && scoring?.multipliers) ? scoring.multipliers[bonusType] : null;
            if(bonus && bonus.type === "letter") total += (v * bonus.value); else total += v; if(bonus && bonus.type === "word") mult *= bonus.value;
        });
        let finalScore = total * mult; if(scoring?.bonuses && placedTiles.length >= scoring.bonuses.bingoThreshold) { finalScore += scoring.bonuses.bingo; }
        showFeedback(full[full.length-1], `+${finalScore}`, 'feedback-node');
        
        if (isBot) { scores.bot += finalScore; document.getElementById('score-bot').innerText = scores.bot.toString().padStart(3, '0'); } 
        else { scores.player += finalScore; document.getElementById('score-player').innerText = scores.player.toString().padStart(3, '0'); }
        
        placedTiles.forEach(p => p.el.classList.add('fixed')); placedTiles = [];
        updateLiveScore(); updateClusterOutlines();
        setTimeout(() => { refillRack(isBot ? 'bot-rack' : 'rack'); switchTurn(isBot ? 'player' : 'bot'); }, 600);
        return true;
    } else {
        if(!isBot) { showFeedback(full[full.length-1], '❌ NO WORD', 'feedback-node invalid-x'); setTimeout(recallTiles, 1200); }
        return false;
    }
}

function showFeedback(idx, txt, cls) { const cell = document.querySelector(`.cell[data-index="${idx}"]`); if(!cell) return; const rect = cell.getBoundingClientRect(), gRect = document.getElementById('grid').getBoundingClientRect(); const node = document.createElement('div'); node.className = cls; node.innerText = txt; node.style.left = `${(rect.left - gRect.left) + (rect.width/2) - 15}px`; node.style.top = `${(rect.top - gRect.top) - 30}px`; document.getElementById('grid').appendChild(node); }
function getTileAt(index) { return document.querySelector(`.cell[data-index="${index}"] .tile`); }
function shuffleRack() { if(currentPlayer !== 'player') return; const rack = document.getElementById('rack'); const t = Array.from(rack.querySelectorAll('.tile')); t.sort(() => Math.random() - 0.5); t.forEach(tile => { tile.style.transform = 'scale(0.8)'; rack.appendChild(tile); setTimeout(() => tile.style.transform = 'none', 50); }); }
function recallTiles() { if(currentPlayer !== 'player') return; const rack = document.getElementById('rack'); placedTiles.forEach(p => { p.el.classList.remove('on-board'); p.el.style.width = '44px'; p.el.style.height = '44px'; p.el.style.margin = '0'; p.el.style.left = 'auto'; p.el.style.top = 'auto'; p.el.style.position = 'relative'; p.el.style.transform = 'none'; rack.appendChild(p.el); }); placedTiles = []; updateLiveScore(); }

function setupWildcard() {
    if(!wildLex) return; document.getElementById('wild-title').innerText = wildLex.ui?.title || "SELECT GLYPH"; const container = document.getElementById('wild-grid');
    wildLex.options.split('').forEach(l => { const b = document.createElement('div'); b.className = 'wild-btn'; b.innerText = l; b.onclick = () => { if(!wildTarget) return; const stdTile = tiles.distribution.find(t => t.l === l); const letterValue = stdTile ? stdTile.v : 0; wildTarget.dataset.letter = l; wildTarget.dataset.value = letterValue; wildTarget.querySelector('span').innerText = l; wildTarget.querySelector('.val').innerText = letterValue; wildTarget.classList.add('wild'); document.getElementById('wildcard-modal').style.display = 'none'; wildTarget = null; updateLiveScore(); }; container.appendChild(b); });
}

/* ⚡ THE TURN CONTROLLER */
function switchTurn(nextPlayer) {
    currentPlayer = nextPlayer;
    const status = document.getElementById('turn-status');
    saveGameState();
    if (currentPlayer === 'bot') {
        status.innerText = "🤖 COMPUTING..."; status.style.color = "var(--tw)";
        document.getElementById('rack').style.opacity = '0.5'; document.getElementById('rack').style.pointerEvents = 'none';
        setTimeout(playBotTurn, 800);
    } else {
        status.innerText = "YOUR TURN"; status.style.color = "var(--dl)";
        document.getElementById('rack').style.opacity = '1'; document.getElementById('rack').style.pointerEvents = 'auto';
    }
}

/* ⚡ THE AI BOT LOGIC */
async function playBotTurn() {
    if (!dictArray) dictArray = Array.from(dictionary);
    const anchors = Array.from(document.querySelectorAll('.tile.fixed'));
    const rackTiles = Array.from(document.getElementById('bot-rack').querySelectorAll('.tile'));
    const rackLetters = rackTiles.map(t => t.dataset.letter);
    let moveFound = false;

    // Fast-sample 4000 words to prevent mobile browser freeze
    const sampleSize = 4000;
    const startIdx = Math.floor(Math.random() * Math.max(0, dictArray.length - sampleSize));
    const sampleDict = dictArray.slice(startIdx, startIdx + sampleSize);

    if (anchors.length === 0) {
        const centerIdx = rules.validation.centerIndex || Math.floor(board.size / 2);
        for (let word of sampleDict) {
            if (word.length < 2 || word.length > 7) continue;
            if (testBotPlacement(word, centerIdx, 1, rackTiles)) { moveFound = true; break; }
        }
    } else {
        anchors.sort(() => Math.random() - 0.5); // randomize play styles
        for (let anchor of anchors) {
            const aIdx = parseInt(anchor.parentElement.dataset.index); const aLet = anchor.dataset.letter;
            for (let word of sampleDict) {
                if (!word.includes(aLet) || word.length < 2) continue;
                let tempRack = [...rackLetters], canMake = true, usedAnchor = false;
                for (let char of word) {
                    if (char === aLet && !usedAnchor) { usedAnchor = true; continue; }
                    const rIdx = tempRack.indexOf(char);
                    if (rIdx > -1) { tempRack.splice(rIdx, 1); } else if (tempRack.includes('?')) { tempRack.splice(tempRack.indexOf('?'), 1); } else { canMake = false; break; }
                }
                if (!canMake) continue;
                const aPosInWord = word.indexOf(aLet), startIdxH = aIdx - aPosInWord;
                if (Math.floor(startIdxH / board.cols) === Math.floor(aIdx / board.cols)) { if (testBotPlacement(word, startIdxH, 1, rackTiles)) { moveFound = true; break; } }
                const startIdxV = aIdx - (aPosInWord * board.cols);
                if (startIdxV >= 0) { if (testBotPlacement(word, startIdxV, board.cols, rackTiles)) { moveFound = true; break; } }
            }
            if (moveFound) break;
        }
    }

    if (!moveFound) {
        document.getElementById('turn-status').innerText = "🤖 PASSES";
        rackTiles.forEach(t => t.remove()); refillRack('bot-rack');
        setTimeout(() => { switchTurn('player'); }, 1500);
    }
}

function testBotPlacement(word, startIdx, step, rackTiles) {
    placedTiles = []; let usedRackTiles = [], valid = true;
    for (let i = 0; i < word.length; i++) {
        const cellIdx = startIdx + (i * step);
        if (cellIdx < 0 || cellIdx >= board.size) { valid = false; break; }
        if (step === 1 && Math.floor(cellIdx / board.cols) !== Math.floor(startIdx / board.cols)) { valid = false; break; }
        const cell = document.querySelector(`.cell[data-index="${cellIdx}"]`), existingTile = cell.querySelector('.tile');
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

startEngine();
