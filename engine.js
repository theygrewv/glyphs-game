let layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics;
let dictionary = new Set(), bag = [], placedTiles = [], totalScore = 0, currentMode = 'dark';
let activeTile = null, targetX = 0, targetY = 0, currentX = 0, currentY = 0, wildTarget = null;

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
        
        applyLexiconTheme(); buildHeader(); buildGrid(); buildUI(); initBag(); refillRack(); setupWildcard();
        requestAnimationFrame(updateMotion);
    } catch (e) { console.error("Engine Error:", e); }
}

function updateMotion() {
    if (activeTile && physics) {
        const lerp = physics.motion.lerp || 0.4;
        currentX += (targetX - currentX) * lerp;
        currentY += (targetY - currentY) * lerp;
        activeTile.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${physics.motion.dragScale})`;
    }
    requestAnimationFrame(updateMotion);
}

function makeDraggable(el) {
    let ox, oy, gRect;
    const dragLayer = document.getElementById('drag-layer');

    const start = (e) => {
        if(el.classList.contains('fixed') || !physics) return;
        const t = e.touches ? e.touches[0] : e;
        ox = physics.tile.centerOffset; oy = physics.tile.centerOffset; 
        gRect = document.getElementById('grid').getBoundingClientRect();

        if(el.parentElement.classList.contains('cell')) {
            placedTiles = placedTiles.filter(p => p.el !== el);
            el.classList.remove('on-board'); 
        }
        
        activeTile = el; 
        el.style.width = `${physics.tile.size}px`; el.style.height = `${physics.tile.size}px`;
        el.style.position = 'absolute'; el.style.margin = '0px'; el.style.left = '0px'; el.style.top = '0px';
        
        dragLayer.appendChild(el);
        el.classList.add('dragging');
        
        currentX = t.clientX - ox; currentY = t.clientY - oy;
        targetX = currentX; targetY = currentY;
        el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${physics.motion.dragScale})`;

        if(e.cancelable) e.preventDefault(); e.stopPropagation();
    };

    const move = (e) => {
        if(!activeTile || activeTile !== el || !physics) return;
        const t = e.touches ? e.touches[0] : e;
        targetX = t.clientX - ox; targetY = t.clientY - oy;
        
        document.querySelectorAll('.cell.hover').forEach(c => c.classList.remove('hover'));
        const col = Math.floor((t.clientX - gRect.left) / (gRect.width / board.cols));
        const row = Math.floor((t.clientY - gRect.top) / (gRect.height / (board.size / board.cols)));
        const idx = (row * board.cols) + col;
        if (idx >= 0 && idx < board.size && t.clientX >= gRect.left && t.clientX <= gRect.right) {
            const targetCell = document.querySelector(`.cell[data-index="${idx}"]`);
            if(targetCell && !targetCell.querySelector('.tile')) targetCell.classList.add('hover');
        }
    };

    const end = (e) => {
        if(!activeTile || activeTile !== el || !physics) return;
        el.classList.remove('dragging'); activeTile = null;
        const t = e.changedTouches ? e.changedTouches[0] : e;
        const slop = physics.bounds.hitSlop;

        if (t.clientX >= (gRect.left - slop) && t.clientX <= (gRect.right + slop) && t.clientY >= (gRect.top - slop) && t.clientY <= (gRect.bottom + slop)) {
            const col = Math.floor((t.clientX - gRect.left) / (gRect.width / board.cols));
            const row = Math.floor((t.clientY - gRect.top) / (gRect.height / (board.size / board.cols)));
            const idx = (row * board.cols) + col;
            const target = document.querySelector(`.cell[data-index="${idx}"]`);
            
            if (target && !target.querySelector('.tile')) {
                target.appendChild(el); el.classList.add('on-board');
                el.style.width = '100%'; el.style.height = '100%';
                el.style.position = 'absolute'; el.style.left = '0'; el.style.top = '0';
                el.style.transform = 'none'; 
                placedTiles.push({el, index: idx});
                
                if (el.dataset.raw === '?') { 
                    wildTarget = el; 
                    document.getElementById('wildcard-modal').style.display = 'flex'; 
                }
                return;
            }
        }
        
        document.getElementById('rack').appendChild(el); 
        el.style.width = `${physics.tile.size}px`; el.style.height = `${physics.tile.size}px`;
        el.style.position = 'relative'; el.style.left = 'auto'; el.style.top = 'auto'; 
        el.style.transform = 'none';
    };

    el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: false });
}

function validatePlacement() {
    if (!placedTiles.length) return false;
    if (!rules || !rules.validation) return true;

    const r0 = Math.floor(placedTiles[0].index / board.cols);
    const c0 = placedTiles[0].index % board.cols;
    const sameRow = placedTiles.every(p => Math.floor(p.index / board.cols) === r0);
    const sameCol = placedTiles.every(p => p.index % board.cols === c0);
    
    if (!sameRow && !sameCol) return false;

    placedTiles.sort((a,b) => a.index - b.index);
    const step = sameRow ? 1 : board.cols;
    const minIdx = placedTiles[0].index;
    const maxIdx = placedTiles[placedTiles.length - 1].index;

    for (let i = minIdx; i <= maxIdx; i += step) {
        if (!getTileAt(i)) return false; 
    }

    const hasFixed = document.querySelector('.tile.fixed');
    if (!hasFixed) {
        const centerIdx = rules.validation.centerIndex || Math.floor(board.size / 2);
        return placedTiles.some(p => p.index === centerIdx);
    } else {
        let touchesFixed = false;
        placedTiles.forEach(p => {
            const adj = [p.index - 1, p.index + 1, p.index - board.cols, p.index + board.cols];
            adj.forEach(a => {
                const t = getTileAt(a);
                if (t && t.classList.contains('fixed')) touchesFixed = true;
            });
        });
        return touchesFixed;
    }
}

function handlePlayWord() {
    document.querySelectorAll('.feedback-node').forEach(n => n.remove());
    if(!placedTiles.length) return;

    if (!validatePlacement()) {
        showFeedback(placedTiles[placedTiles.length-1].index, '❌ INVALID PLACEMENT', 'feedback-node invalid-x');
        setTimeout(recallTiles, 1200);
        return;
    }
    
    placedTiles.sort((a,b)=>a.index-b.index);
    const isH = placedTiles.length > 1 ? (placedTiles[1].index - placedTiles[0].index === 1) : true;
    const step = isH ? 1 : board.cols;
    
    let full = [], curr = placedTiles[0].index;
    while(curr >= 0 && getTileAt(curr-step)) curr -= step;
    while(curr < board.size && getTileAt(curr)) { full.push(curr); curr += step; }
    
    const word = full.map(idx => getTileAt(idx).dataset.letter).join('');
    
    if(dictionary.has(word)) {
        let total = 0, mult = 1;
        full.forEach(idx => {
            const v = parseInt(getTileAt(idx).dataset.value) || 0;
            const isNew = placedTiles.find(p => p.index === idx);
            const bonusType = (isNew && layout[idx]) ? layout[idx].c : null;
            const bonus = (bonusType && scoring?.multipliers) ? scoring.multipliers[bonusType] : null;

            if(bonus && bonus.type === "letter") total += (v * bonus.value);
            else total += v;
            
            if(bonus && bonus.type === "word") mult *= bonus.value;
        });
        
        let finalScore = total * mult;
        if(scoring?.bonuses && placedTiles.length >= scoring.bonuses.bingoThreshold) {
            finalScore += scoring.bonuses.bingo;
        }

        showFeedback(full[full.length-1], `+${finalScore}`, 'feedback-node');
        totalScore += finalScore;
        document.getElementById('total-score').innerText = totalScore.toString().padStart(3, '0');
        
        // ⚡ THE PERSISTENT BADGE STAMPER
        const lastTileEl = getTileAt(full[full.length-1]);
        if (lastTileEl) {
            const badge = document.createElement('div');
            badge.className = 'word-score-badge';
            badge.innerText = finalScore;
            
            // If another word ended here, slide the new badge to the left
            const existing = lastTileEl.querySelectorAll('.word-score-badge').length;
            if(existing > 0) badge.style.right = `${-6 + (existing * 22)}px`;
            
            lastTileEl.appendChild(badge);
        }

        placedTiles.forEach(p => p.el.classList.add('fixed'));
        placedTiles = [];
        setTimeout(refillRack, 600);
    } else {
        showFeedback(full[full.length-1], '❌ NOT IN DICTIONARY', 'feedback-node invalid-x');
        setTimeout(recallTiles, 1200);
    }
}

function showFeedback(idx, txt, cls) {
    const cell = document.querySelector(`.cell[data-index="${idx}"]`);
    if(!cell) return;
    const rect = cell.getBoundingClientRect();
    const gRect = document.getElementById('grid').getBoundingClientRect();
    const node = document.createElement('div');
    node.className = cls; node.innerText = txt;
    node.style.left = `${(rect.left - gRect.left) + (rect.width/2) - 15}px`;
    node.style.top = `${(rect.top - gRect.top) - 30}px`;
    document.getElementById('grid').appendChild(node);
}

function setupWildcard() {
    if(!wildLex) return;
    document.getElementById('wild-title').innerText = wildLex.ui?.title || "SELECT GLYPH";
    const container = document.getElementById('wild-grid');
    wildLex.options.split('').forEach(l => {
        const b = document.createElement('div'); b.className = 'wild-btn'; b.innerText = l;
        b.onclick = () => {
            if(!wildTarget) return;
            wildTarget.dataset.letter = l; 
            wildTarget.dataset.value = wildLex.mechanics.pointValue || 0;
            wildTarget.querySelector('span').innerText = l;
            wildTarget.querySelector('.val').innerText = wildTarget.dataset.value;
            wildTarget.classList.add('wild');
            document.getElementById('wildcard-modal').style.display = 'none';
            wildTarget = null;
        };
        container.appendChild(b);
    });
}

function applyLexiconTheme() {
    if (!theme || !theme.modes[currentMode] || !board) return;
    const m = theme.modes[currentMode];
    const root = document.documentElement.style;
    Object.keys(m.colors).forEach(k => root.setProperty(`--${k}`, m.colors[k]));
    const style = document.getElementById('lexicon-styles') || document.createElement("style");
    style.id = 'lexicon-styles';
    style.innerText = `
    .grid { grid-template-columns: repeat(${board.cols}, 1fr); grid-auto-rows: 1fr; gap: ${board.gap || '2px'}; border: 1px solid var(--gridLine); } 
    .cell { background: var(--obsidian); backdrop-filter: blur(${m.effects.blur}); -webkit-backdrop-filter: blur(${m.effects.blur}); box-shadow: ${m.effects.bevel}; position: relative; } 
    .dl { color: var(--dl); box-shadow: inset 0 0 ${m.effects.glow} var(--dl); } 
    .tl { color: var(--tl); box-shadow: inset 0 0 ${m.effects.glow} var(--tl); } 
    .dw { color: var(--dw); box-shadow: inset 0 0 ${m.effects.glow} var(--dw); } 
    .tw { color: var(--tw); box-shadow: inset 0 0 ${m.effects.glow} var(--tw); } 
    .dd { color: var(--dd); box-shadow: inset 0 0 ${m.effects.glow} var(--dd); } 
    #total-score { color: var(--gold); } 
    
    /* ⚡ THE NEW SCORE BADGE STYLING */
    .word-score-badge { position: absolute; bottom: -6px; right: -6px; background: var(--gold); color: #000; font-size: 0.55rem; font-weight: 900; padding: 2px 4px; border-radius: 4px; z-index: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.8); pointer-events: none; border: 1px solid #000; }
    `;
    document.head.appendChild(style);
}

function buildGrid() { const g = document.getElementById('grid'); g.innerHTML = ''; if(!board) return; for(let i=0; i<board.size; i++) { const c = document.createElement('div'); c.className = 'cell'; c.dataset.index = i; if(layout && layout[i]) { c.innerText = layout[i].t; c.classList.add(layout[i].c); } g.appendChild(c); } }
function buildUI() { if(!ui) return; const ctrl = document.getElementById('ui-controls'); ctrl.innerHTML = ''; ui.buttons.forEach(btn => { const b = document.createElement('button'); b.className = btn.class; b.innerText = btn.text; if(btn.action === 'shuffleRack') b.onclick = shuffleRack; if(btn.action === 'recallTiles') b.onclick = recallTiles; if(btn.action === 'toggleTheme') b.onclick = () => { currentMode = currentMode === 'dark' ? 'light' : 'dark'; applyLexiconTheme(); }; if(btn.action === 'playWord') b.onclick = handlePlayWord; ctrl.appendChild(b); }); }
function initBag() { if(!tiles) return; tiles.distribution.forEach(d => { for(let i=0; i<d.q; i++) bag.push({...d}); }); bag.sort(() => Math.random() - 0.5); }
function refillRack() { const r = document.getElementById('rack'); const cur = r.querySelectorAll('.tile').length; for(let i=0; i<(7-cur) && bag.length; i++) { const data = bag.pop(); const t = document.createElement('div'); t.className = 'tile'; t.innerHTML = `<span>${data.l}</span><span class="val">${data.v}</span>`; t.dataset.letter = data.l; t.dataset.raw = data.l; t.dataset.value = data.v; r.appendChild(t); makeDraggable(t); } }
function buildHeader() { document.getElementById('game-header').innerHTML = `<div id="total-score" style="font-size: 2.2rem; font-weight: 900; color:var(--gold)">000</div>`; }
function getTileAt(index) { return document.querySelector(`.cell[data-index="${index}"] .tile`); }

function shuffleRack() { const rack = document.getElementById('rack'); const t = Array.from(rack.querySelectorAll('.tile')); t.sort(() => Math.random() - 0.5); t.forEach(tile => { tile.style.transform = 'scale(0.8)'; rack.appendChild(tile); setTimeout(() => tile.style.transform = 'none', 50); }); }
function recallTiles() { const rack = document.getElementById('rack'); placedTiles.forEach(p => { p.el.classList.remove('on-board'); p.el.style.width = '44px'; p.el.style.height = '44px'; p.el.style.margin = '0'; p.el.style.left = 'auto'; p.el.style.top = 'auto'; p.el.style.position = 'relative'; p.el.style.transform = 'none'; rack.appendChild(p.el); }); placedTiles = []; }

startEngine();
