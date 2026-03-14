let layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics;
let dictionary = new Set(), bag = [], placedTiles = [], currentMode = 'dark';
let scores = { player: 0, bot: 0 }, currentPlayer = 'player';
let activeTile = null, targetX = 0, targetY = 0, currentX = 0, currentY = 0;

async function startEngine() {
    try {
        const fetchJson = (url) => fetch(url).then(r => r.json());
        const res = await Promise.all(['layout','board','tiles','theme','ui','rules','play','scoring','wildcard','physics'].map(n => fetchJson(`./lexicon/${n}.json`)));
        [layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics] = res;
        
        const dText = await fetch(playRules.validation.dictionaryUrl).then(r => r.text());
        dictionary = new Set(dText.toUpperCase().match(/[A-Z]+/g));

        const s = document.createElement('script'); s.src = 'referee.js'; document.head.appendChild(s);

        // 🛑 NUCLEAR RESET
        document.body.innerHTML = '';
        const container = document.createElement('div'); container.id = 'game-container';
        document.body.appendChild(container);

        applyLexiconTheme();
        initBag();
        refillRack('rack');
        requestAnimationFrame(updateMotion);
    } catch (e) { console.error("Engine Crash:", e); }
}

function applyLexiconTheme() {
    const m = theme.modes[currentMode];
    const style = document.createElement("style");
    style.innerText = `
        body, html { margin:0; padding:0; background:#000; height:100%; width:100%; overflow:hidden; touch-action:none; }
        #game-container { display:flex; flex-direction:column; height:100vh; }
        
        #game-header { flex:0 0 60px; background:#111; display:flex; justify-content:space-between; align-items:center; padding:0 20px; border-bottom:1px solid #333; }
        #grid-area { flex:1; display:flex; align-items:center; justify-content:center; background:#000; position:relative; }
        #grid { display:grid; grid-template-columns:repeat(${board.cols}, 1fr); gap:1px; width:min(95vw, 95vh); height:min(95vw, 95vh); background:#333; }
        
        .cell { background:#0a0a0a; position:relative; display:flex; align-items:center; justify-content:center; }
        .dd { background:#fff !important; box-shadow:0 0 15px #fff !important; z-index:1; }
        
        #ui-controls { flex:0 0 50px; display:flex; justify-content:center; gap:10px; padding:10px; background:#111; }
        #rack { flex:0 0 70px; display:flex; justify-content:center; align-items:center; gap:5px; background:#000; border-top:1px solid #333; }
        
        .tile { width:40px; height:40px; background:var(--gold); color:#000; border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.2rem; cursor:pointer; user-select:none; }
        
        /* 🎯 FIX: LOCK THE SIZE DURING DRAG */
        .dragging { position:fixed !important; width:45px !important; height:45px !important; z-index:9999 !important; pointer-events:none !important; transform-origin:center; }
        
        button { background:#333; color:#fff; border:none; padding:8px 15px; border-radius:4px; font-weight:bold; }
    `;
    document.head.appendChild(style);
    Object.keys(m.colors).forEach(k => document.documentElement.style.setProperty(`--${k}`, m.colors[k]));

    const gc = document.getElementById('game-container');
    gc.innerHTML = `
        <div id="game-header">
            <div><small>SCORE</small><div id="score-player" style="color:var(--gold)">000</div></div>
            <div id="turn-status">YOUR TURN</div>
            <div style="text-align:right"><small>BAG</small><div id="bag-count">0</div></div>
        </div>
        <div id="grid-area"><div id="grid"></div></div>
        <div id="ui-controls">
            <button onclick="recallTiles()">RECALL</button>
            <button onclick="handlePlayWord()" style="background:var(--gold); color:#000">PLAY</button>
        </div>
        <div id="rack"></div>
    `;
    buildGrid();
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
            const row = Math.floor((t.clientY - r.top) / (r.height / (board.size / board.cols)));
            const idx = (row * board.cols) + col;
            const cell = document.querySelector(`.cell[data-index="${idx}"]`);

            if (cell && !cell.querySelector('.tile')) {
                cell.appendChild(el);
                el.style.position = 'absolute'; el.style.left='0'; el.style.top='0'; el.style.width='100%'; el.style.height='100%'; el.style.transform='none';
                placedTiles.push({el, index: idx});
                return;
            }
        }
        document.getElementById('rack').appendChild(el);
        el.style.position='relative'; el.style.transform='none'; el.style.width='40px'; el.style.height='40px';
    };
    el.addEventListener('touchstart', start);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', end);
}

function updateMotion() { 
    if (activeTile) { 
        currentX += (targetX - currentX) * 0.85; 
        currentY += (targetY - currentY) * 0.85; 
        activeTile.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`; 
    } 
    requestAnimationFrame(updateMotion); 
}

function buildGrid() { const g = document.getElementById('grid'); for(let i=0; i<board.size; i++) { const c = document.createElement('div'); c.className = 'cell'; c.dataset.index = i; if(layout[i]) { c.classList.add(layout[i].c); } g.appendChild(c); } }
function initBag() { bag = []; tiles.distribution.forEach(d => { for(let i=0; i<d.q; i++) bag.push({...d}); }); bag.sort(() => Math.random() - 0.5); }
function refillRack(rId) { const r = document.getElementById(rId); while(r.children.length < 7 && bag.length > 0) { const d = bag.pop(); const t = document.createElement('div'); t.className='tile'; t.innerText=d.l; t.dataset.raw=d.l; r.appendChild(t); makeDraggable(t); } document.getElementById('bag-count').innerText = bag.length; }
function recallTiles() { const r = document.getElementById('rack'); placedTiles.forEach(p => { r.appendChild(p.el); p.el.style.position='relative'; p.el.style.transform='none'; p.el.style.width='40px'; p.el.style.height='40px'; }); placedTiles = []; }
function handlePlayWord() { if (typeof validatePlacement === 'function' && validatePlacement()) { placedTiles.forEach(p => { p.el.style.pointerEvents = 'none'; p.el.classList.add('fixed'); }); placedTiles = []; refillRack('rack'); } else { alert("Check placement!"); recallTiles(); } }

startEngine();
