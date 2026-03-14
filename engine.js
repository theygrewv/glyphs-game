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

        // Inject Referee
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
        body { margin:0; padding:0; background:#000; color:#fff; font-family:sans-serif; overflow:hidden; }
        #game-container { display:flex; flex-direction:column; height:100vh; width:100vw; }
        
        #game-header { padding:15px; display:flex; justify-content:space-between; align-items:center; background:#111; border-bottom:1px solid #333; }
        #grid-area { flex:1; display:flex; align-items:center; justify-content:center; padding:10px; overflow:hidden; }
        #grid { display:grid; grid-template-columns:repeat(${board.cols}, 1fr); gap:1px; width:min(90vw, 90vh); height:min(90vw, 90vh); background:#222; border:2px solid #444; }
        
        .cell { background:#0a0a0a; position:relative; display:flex; align-items:center; justify-content:center; font-size:0.5rem; color:rgba(255,255,255,0.1); }
        .dd { background:#fff !important; color:#000 !important; box-shadow:0 0 15px #fff !important; z-index:2; font-weight:bold; }
        .dl { box-shadow:inset 0 0 8px var(--dl) !important; color:var(--dl) !important; }
        .tl { box-shadow:inset 0 0 8px var(--tl) !important; color:var(--tl) !important; }
        .dw { box-shadow:inset 0 0 8px var(--dw) !important; color:var(--dw) !important; }
        .tw { box-shadow:inset 0 0 8px var(--tw) !important; color:var(--tw) !important; }

        #ui-controls { padding:10px; display:flex; justify-content:center; gap:10px; background:#000; }
        #rack { height:70px; display:flex; justify-content:center; align-items:center; gap:5px; background:#111; border-top:1px solid #333; padding-bottom:10px; }
        
        .tile { width:45px; height:45px; background:var(--gold); color:#000; display:flex; align-items:center; justify-content:center; font-weight:bold; border-radius:4px; font-size:1.2rem; cursor:pointer; }
        .dragging { position:fixed; z-index:10000; pointer-events:none; width:50px !important; height:50px !important; }
        .nav-back { position:fixed; top:10px; left:10px; z-index:10001; background:rgba(0,0,0,0.8); border:1px solid #444; border-radius:50%; width:35px; height:35px; display:flex; align-items:center; justify-content:center; }
        button { background:#222; color:#fff; border:1px solid #444; padding:10px 15px; border-radius:5px; font-size:0.8rem; }
        .primary { background:var(--gold); color:#000; font-weight:bold; }
    `;
    document.head.appendChild(style);
    Object.keys(m.colors).forEach(k => document.documentElement.style.setProperty(`--${k}`, m.colors[k]));

    buildHeader(); buildGrid(); buildUI();
}

function buildHeader() {
    document.getElementById('game-header').innerHTML = `
        <div><small>YOU</small><div id="score-player" style="color:var(--gold); font-size:1.2rem;">000</div></div>
        <div style="text-align:center"><div id="turn-status">YOUR TURN</div><div id="bag-count" style="font-size:0.6rem; opacity:0.5;"></div></div>
        <div style="text-align:right"><small>BOT</small><div id="score-bot" style="color:var(--tw); font-size:1.2rem;">000</div></div>
    `;
}

function buildGrid() {
    const g = document.getElementById('grid');
    for(let i=0; i<board.size; i++) {
        const c = document.createElement('div'); c.className = 'cell'; c.dataset.index = i;
        if(layout[i]) { c.innerText = layout[i].t; c.classList.add(layout[i].c); }
        g.appendChild(c);
    }
}

function buildUI() {
    document.getElementById('ui-controls').innerHTML = `
        <button onclick="recallTiles()">RECALL</button>
        <button class="primary" onclick="handlePlayWord()">PLAY</button>
        <button onclick="swapTiles()">SWAP</button>
    `;
}

function makeDraggable(el) {
    const start = (e) => {
        if(currentPlayer !== 'player') return;
        const t = e.touches ? e.touches[0] : e;
        activeTile = el;
        if(el.parentElement.classList.contains('cell')) placedTiles = placedTiles.filter(p => p.el !== el);
        currentX = t.clientX - 25; currentY = t.clientY - 25;
        targetX = currentX; targetY = currentY;
        el.classList.add('dragging');
        document.body.appendChild(el);
        if(e.cancelable) e.preventDefault();
    };
    const move = (e) => {
        if(!activeTile) return;
        const t = e.touches ? e.touches[0] : e;
        targetX = t.clientX - 25; targetY = t.clientY - 25;
    };
    const end = (e) => {
        if(!activeTile) return;
        el.classList.remove('dragging');
        const t = e.changedTouches ? e.changedTouches[0] : e;
        activeTile = null;
        const cell = document.elementFromPoint(t.clientX, t.clientY)?.closest('.cell');
        if (cell && !cell.querySelector('.tile')) {
            cell.appendChild(el);
            el.style.position = 'absolute'; el.style.left='0'; el.style.top='0'; el.style.width='100%'; el.style.height='100%'; el.style.transform='none';
            placedTiles.push({el, index: parseInt(cell.dataset.index)});
        } else {
            document.getElementById('rack').appendChild(el);
            el.style.position='relative'; el.style.transform='none'; el.style.width='45px'; el.style.height='45px';
        }
    };
    el.addEventListener('touchstart', start, {passive:false});
    window.addEventListener('touchmove', move, {passive:false});
    window.addEventListener('touchend', end, {passive:false});
}

function updateMotion() { 
    if (activeTile) { 
        currentX += (targetX - currentX) * 0.9; currentY += (targetY - currentY) * 0.9; 
        activeTile.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(1.1)`; 
    } 
    requestAnimationFrame(updateMotion); 
}

function handlePlayWord() {
    if (typeof validatePlacement === 'function' && validatePlacement()) {
        placedTiles.forEach(p => { p.el.style.pointerEvents = 'none'; p.el.style.opacity = '0.8'; });
        placedTiles = []; refillRack('rack'); alert("VALID!");
    } else {
        alert("INVALID!"); recallTiles();
    }
}

function initBag() { bag = []; tiles.distribution.forEach(d => { for(let i=0; i<d.q; i++) bag.push({...d}); }); bag.sort(() => Math.random() - 0.5); }
function refillRack(rId) { const r = document.getElementById(rId); while(r.children.length < 7 && bag.length > 0) { const d = bag.pop(); const t = document.createElement('div'); t.className='tile'; t.innerText=d.l; t.dataset.raw=d.l; r.appendChild(t); makeDraggable(t); } document.getElementById('bag-count').innerText = `BAG: ${bag.length}`; }
function recallTiles() { const r = document.getElementById('rack'); placedTiles.forEach(p => { r.appendChild(p.el); p.el.style.position='relative'; p.el.style.transform='none'; p.el.style.width='45px'; p.el.style.height='45px'; }); placedTiles = []; }
function swapTiles() { recallTiles(); const r = document.getElementById('rack'); Array.from(r.children).forEach(c => { bag.push({l: c.dataset.raw}); c.remove(); }); bag.sort(() => Math.random()-0.5); refillRack('rack'); }

startEngine();
