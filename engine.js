let layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics;
let dictionary = new Set(), bag = [], placedTiles = [], currentMode = 'dark';
let scores = { player: 0, bot: 0 }, currentPlayer = 'player';
let activeTile = null, targetX = 0, targetY = 0, currentX = 0, currentY = 0;

async function startEngine() {
    try {
        const fetchJson = (url) => fetch(url).then(r => r.json());
        const res = await Promise.all([
            fetchJson('./lexicon/layout.json'), fetchJson('./lexicon/board.json'),
            fetchJson('./lexicon/tiles.json'), fetchJson('./lexicon/theme.json'),
            fetchJson('./lexicon/ui.json'), fetchJson('./lexicon/rules.json'),
            fetchJson('./lexicon/play.json'), fetchJson('./lexicon/scoring.json'),
            fetchJson('./lexicon/wildcard.json'), fetchJson('./lexicon/physics.json')
        ]);
        [layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics] = res;
        
        const dText = await fetch(playRules.validation.dictionaryUrl).then(r => r.text());
        dictionary = new Set(dText.toUpperCase().match(/[A-Z]+/g));

        document.body.innerHTML = '<div id="game-container"></div>';
        applyLexiconTheme();
        initBag();
        refillRack('rack');
        requestAnimationFrame(updateMotion);
    } catch (e) { console.error("Initialization Error:", e); }
}

/* ⚖️ REFEREE LOGIC (Moved here to prevent ReferenceErrors) */
function validatePlacement() {
    if (!placedTiles || placedTiles.length === 0) return false;
    const indices = placedTiles.map(p => parseInt(p.index)).sort((a,b)=>a-b);
    const cols = board.cols;
    const r0 = Math.floor(indices[0] / cols);
    const sameRow = indices.every(idx => Math.floor(idx / cols) === r0);
    const sameCol = indices.every(idx => idx % cols === (indices[0] % cols));

    if (!sameRow && !sameCol) return false;

    const hasFixed = document.querySelector('.tile.fixed');
    if (!hasFixed) {
        const center = Math.floor(board.size / 2);
        return indices.includes(center);
    }
    return true; // Simplified for recovery
}

function applyLexiconTheme() {
    const m = theme.modes[currentMode];
    const style = document.createElement("style");
    style.innerText = `
        body, html { margin:0; padding:0; background:#000; height:100vh; width:100vw; overflow:hidden; touch-action:none; }
        #game-container { display:flex; flex-direction:column; height:100%; }
        #game-header { padding:15px; background:#111; border-bottom:1px solid #333; }
        #grid-area { flex:1; display:flex; align-items:center; justify-content:center; }
        #grid { display:grid; grid-template-columns:repeat(${board.cols}, 1fr); gap:1px; width:min(95vw, 70vh); aspect-ratio:1/1; background:#222; }
        .cell { background:#0a0a0a; position:relative; display:flex; align-items:center; justify-content:center; font-size:0.5rem; }
        .dd { background:#fff !important; box-shadow:0 0 15px #fff !important; color:#000 !important; }
        #rack { height:80px; display:flex; justify-content:center; align-items:center; gap:5px; background:#111; border-top:1px solid #333; }
        .tile { width:42px; height:42px; background:var(--gold); color:#000; border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.2rem; box-shadow:0 4px 0 #8a6d00; z-index:10; }
        .dragging { position:fixed !important; width:45px !important; height:45px !important; z-index:9999 !important; pointer-events:none !important; }
        button { background:#222; color:#fff; border:1px solid #444; padding:10px 15px; border-radius:5px; font-weight:bold; }
    `;
    document.head.appendChild(style);
    
    document.getElementById('game-container').innerHTML = `
        <div id="game-header">
            <div style="display:flex; justify-content:space-between;">
                <div>SCORE: <span id="score-player">0</span></div>
                <div>BAG: <span id="bag-count">0</span></div>
            </div>
        </div>
        <div id="grid-area"><div id="grid"></div></div>
        <div id="ui-controls" style="display:flex; justify-content:center; gap:10px; padding:10px;">
            <button onclick="recallTiles()">RECALL</button>
            <button onclick="handlePlayWord()" style="background:var(--gold); color:#000">PLAY</button>
        </div>
        <div id="rack"></div>
    `;
    Object.keys(m.colors).forEach(k => document.documentElement.style.setProperty(`--${k}`, m.colors[k]));
    buildGrid();
}

function buildGrid() {
    const g = document.getElementById('grid');
    for(let i=0; i<board.size; i++) {
        const c = document.createElement('div');
        c.className = 'cell'; c.dataset.index = i;
        if(layout[i]) { c.innerText = layout[i].t || ""; c.classList.add(layout[i].c); }
        g.appendChild(c);
    }
}

function makeDraggable(el) {
    const start = (e) => {
        const t = e.touches ? e.touches[0] : e;
        activeTile = el;
        if(el.parentElement.classList.contains('cell')) placedTiles = placedTiles.filter(p => p.el !== el);
        currentX = t.clientX - 22; currentY = t.clientY - 22;
        targetX = currentX; targetY = currentY;
        el.classList.add('dragging');
        document.body.appendChild(el);
    };
    const move = (e) => {
        if(!activeTile) return;
        const t = e.touches ? e.touches[0] : e;
        targetX = t.clientX - 22; targetY = t.clientY - 22;
    };
    const end = (e) => {
        if(!activeTile) return;
        const t = e.changedTouches ? e.changedTouches[0] : e;
        const g = document.getElementById('grid');
        const r = g.getBoundingClientRect();
        el.classList.remove('dragging');
        activeTile = null;

        if (t.clientX > r.left && t.clientX < r.right && t.clientY > r.top && t.clientY < r.bottom) {
            const col = Math.floor((t.clientX - r.left) / (r.width / board.cols));
            const row = Math.floor((t.clientY - r.top) / (r.height / (board.cols)));
            const idx = (row * board.cols) + col;
            const cell = document.querySelector(`.cell[data-index="${idx}"]`);
            if (cell && !cell.querySelector('.tile')) {
                cell.appendChild(el);
                el.style.position = 'absolute'; el.style.left='0'; el.style.top='0'; 
                el.style.width='100%'; el.style.height='100%'; el.style.transform='none';
                placedTiles.push({el, index: idx});
                return;
            }
        }
        document.getElementById('rack').appendChild(el);
        el.style.position='relative'; el.style.transform='none'; el.style.width='42px'; el.style.height='42px';
    };
    el.addEventListener('touchstart', start);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', end);
}

function updateMotion() { 
    if (activeTile) { 
        currentX += (targetX - currentX) * 0.8; currentY += (targetY - currentY) * 0.8; 
        activeTile.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`; 
    } 
    requestAnimationFrame(updateMotion); 
}

function initBag() { bag = []; tiles.distribution.forEach(d => { for(let i=0; i<d.q; i++) bag.push({...d}); }); bag.sort(() => Math.random() - 0.5); }
function refillRack(rId) { const r = document.getElementById(rId); while(r.children.length < 7 && bag.length > 0) { const d = bag.pop(); const t = document.createElement('div'); t.className='tile'; t.innerText=d.l; t.dataset.raw=d.l; r.appendChild(t); makeDraggable(t); } document.getElementById('bag-count').innerText = bag.length; }
function recallTiles() { const r = document.getElementById('rack'); placedTiles.forEach(p => { r.appendChild(p.el); p.el.style.position='relative'; p.el.style.transform='none'; p.el.style.width='42px'; p.el.style.height='42px'; }); placedTiles = []; }
function handlePlayWord() { if (validatePlacement()) { placedTiles.forEach(p => p.el.classList.add('fixed')); placedTiles = []; refillRack('rack'); } else { alert("INVALID!"); recallTiles(); } }

startEngine();
