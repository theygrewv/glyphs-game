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

        rebuildDocumentStructure();
        applyLexiconTheme();
        initBag();
        refillRack('rack');
        requestAnimationFrame(updateMotion);
    } catch (e) { console.error("Engine Crash:", e); }
}

function rebuildDocumentStructure() {
    document.body.innerHTML = `
        <div id="game-container">
            <div id="game-header"></div>
            <div id="grid-area"><div id="grid"></div></div>
            <div id="ui-controls"></div>
            <div id="rack"></div>
        </div>
        <div class="nav-back">◀</div>
    `;
    document.querySelector('.nav-back').onclick = () => window.location.href = 'index.html';
}

function applyLexiconTheme() {
    const m = theme.modes[currentMode];
    const style = document.createElement("style");
    style.innerText = `
        body { margin:0; padding:0; background:#000; color:#fff; font-family:sans-serif; overflow:hidden; touch-action:none; }
        #game-container { display:flex; flex-direction:column; height:100vh; width:100vw; }
        #game-header { padding:15px; display:flex; justify-content:space-between; background:#111; border-bottom:1px solid #333; }
        #grid-area { flex:1; display:flex; align-items:center; justify-content:center; padding:5px; }
        #grid { display:grid; grid-template-columns:repeat(${board.cols}, 1fr); gap:1px; width:95vw; height:95vw; max-width:500px; max-height:500px; background:#222; position:relative; }
        .cell { background:#0a0a0a; position:relative; display:flex; align-items:center; justify-content:center; font-size:0.5rem; color:rgba(255,255,255,0.1); }
        .dd { background:#fff !important; box-shadow:0 0 15px #fff !important; z-index:2; }
        #rack { height:75px; display:flex; justify-content:center; align-items:center; gap:8px; background:#111; padding-bottom:10px; }
        .tile { width:45px; height:45px; background:var(--gold); color:#000; display:flex; align-items:center; justify-content:center; font-weight:900; border-radius:4px; font-size:1.3rem; box-shadow: 0 4px 0 #8a6d00; }
        .dragging { position:fixed !important; z-index:10000 !important; pointer-events:none !important; }
        .nav-back { position:fixed; top:10px; left:10px; z-index:10001; background:#222; border-radius:50%; width:35px; height:35px; display:flex; align-items:center; justify-content:center; }
        button { background:#333; color:#fff; border:none; padding:10px 20px; border-radius:5px; font-weight:bold; }
    `;
    document.head.appendChild(style);
    Object.keys(m.colors).forEach(k => document.documentElement.style.setProperty(`--${k}`, m.colors[k]));
    buildHeader(); buildGrid(); buildUI();
}

function makeDraggable(el) {
    const start = (e) => {
        if(currentPlayer !== 'player') return;
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

        // 📏 COORDINATE MATH (The Bulletproof Way)
        if (t.clientX > r.left && t.clientX < r.right && t.clientY > r.top && t.clientY < r.bottom) {
            const col = Math.floor((t.clientX - r.left) / (r.width / board.cols));
            const row = Math.floor((t.clientY - r.top) / (r.height / (board.size / board.cols)));
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
        
        // Return to Rack if drop fails
        document.getElementById('rack').appendChild(el);
        el.style.position='relative'; el.style.transform='none'; el.style.width='45px'; el.style.height='45px';
    };
    el.addEventListener('touchstart', start);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', end);
}

function updateMotion() { if (activeTile) { currentX += (targetX - currentX) * 0.8; currentY += (targetY - currentY) * 0.8; activeTile.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(1.1)`; } requestAnimationFrame(updateMotion); }
function buildGrid() { const g = document.getElementById('grid'); for(let i=0; i<board.size; i++) { const c = document.createElement('div'); c.className = 'cell'; c.dataset.index = i; if(layout[i]) { c.innerText = layout[i].t; c.classList.add(layout[i].c); } g.appendChild(c); } }
function buildHeader() { document.getElementById('game-header').innerHTML = `<div><small>SCORE</small><div id="score-player">000</div></div><div>BAG: <span id="bag-count"></span></div>`; }
function buildUI() { document.getElementById('ui-controls').innerHTML = `<button onclick="recallTiles()">RECALL</button> <button onclick="handlePlayWord()" style="background:var(--gold); color:#000;">PLAY</button>`; }
function handlePlayWord() { if (typeof validatePlacement === 'function' && validatePlacement()) { placedTiles.forEach(p => { p.el.style.pointerEvents = 'none'; p.el.classList.add('fixed'); }); placedTiles = []; refillRack('rack'); } else { alert("Check placement!"); recallTiles(); } }
function initBag() { bag = []; tiles.distribution.forEach(d => { for(let i=0; i<d.q; i++) bag.push({...d}); }); bag.sort(() => Math.random() - 0.5); }
function refillRack(rId) { const r = document.getElementById(rId); while(r.children.length < 7 && bag.length > 0) { const d = bag.pop(); const t = document.createElement('div'); t.className='tile'; t.innerText=d.l; t.dataset.raw=d.l; r.appendChild(t); makeDraggable(t); } document.getElementById('bag-count').innerText = bag.length; }
function recallTiles() { const r = document.getElementById('rack'); placedTiles.forEach(p => { r.appendChild(p.el); p.el.style.position='relative'; p.el.style.transform='none'; p.el.style.width='45px'; p.el.style.height='45px'; }); placedTiles = []; }

startEngine();
