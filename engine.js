let layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics;
let dictionary = new Set(), bag = [], placedTiles = [], currentMode = 'dark';
let activeTile = null, targetX = 0, targetY = 0, currentX = 0, currentY = 0;

async function startEngine() {
    try {
        const fetchJson = (url) => fetch(url).then(r => r.json());
        const res = await Promise.all(['layout','board','tiles','theme','ui','rules','play','scoring','wildcard','physics'].map(n => fetchJson(`./lexicon/${n}.json`)));
        [layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics] = res;
        
        const dText = await fetch(playRules.validation.dictionaryUrl).then(r => r.text());
        dictionary = new Set(dText.toUpperCase().match(/[A-Z]+/g));

        renderBaseUI();
        applyLexiconTheme();
        initBag();
        refillRack();
        requestAnimationFrame(updateMotion);
    } catch (e) { console.error("Critical Failure:", e); }
}

function renderBaseUI() {
    document.body.innerHTML = `
        <div id="app">
            <header id="game-header"></header>
            <main id="board-container"><div id="grid"></div></main>
            <div id="ui-controls"></div>
            <footer id="rack"></footer>
        </div>
    `;
}

function applyLexiconTheme() {
    const m = theme.modes[currentMode];
    const style = document.createElement("style");
    style.innerText = `
        body { margin:0; background:#000; color:#fff; font-family:sans-serif; width:100vw; height:100vh; overflow:hidden; touch-action:none; }
        #app { display:flex; flex-direction:column; height:100%; }
        #game-header { height:50px; background:#111; display:flex; justify-content:space-between; padding:0 20px; align-items:center; border-bottom:1px solid #333; }
        #board-container { flex:1; display:flex; align-items:center; justify-content:center; padding:5px; }
        #grid { display:grid; grid-template-columns:repeat(15, 1fr); gap:1px; width:min(98vw, 65vh); aspect-ratio:1/1; background:#333; }
        .cell { background:#0a0a0a; position:relative; display:flex; align-items:center; justify-content:center; font-size:7px; pointer-events: auto !important; }
        .dd { background:#fff !important; color:#000 !important; box-shadow:0 0 10px #fff; }
        #ui-controls { height:50px; display:flex; justify-content:center; gap:10px; padding:5px; }
        #rack { height:80px; background:#111; display:flex; justify-content:center; align-items:center; gap:5px; border-top:1px solid #333; }
        .tile { width:42px; height:42px; background:#d4af37; color:#000; border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.2rem; box-shadow:0 3px 0 #8a6d00; z-index:5; }
        .dragging { position:fixed !important; z-index:99999 !important; pointer-events:none !important; }
        .fixed { opacity:0.8; box-shadow:none; pointer-events:none; }
        button { background:#333; color:#fff; border:1px solid #555; padding:8px 15px; border-radius:4px; font-weight:bold; }
    `;
    document.head.appendChild(style);
    document.getElementById('game-header').innerHTML = `<div>SCORE: <b id="score">0</b></div><div>BAG: <b id="bag-count">0</b></div>`;
    document.getElementById('ui-controls').innerHTML = `<button onclick="recall()">RECALL</button><button onclick="play()" style="background:#d4af37; color:#000;">PLAY</button>`;
    buildGrid();
}

function buildGrid() {
    const g = document.getElementById('grid');
    for(let i=0; i<225; i++) {
        const c = document.createElement('div');
        c.className = 'cell'; c.dataset.index = i;
        if(layout[i]) { c.innerText = layout[i].t; c.classList.add(layout[i].c); }
        g.appendChild(c);
    }
}

function makeDraggable(el) {
    const start = (e) => {
        const t = e.touches ? e.touches[0] : e;
        activeTile = el;
        if(el.parentElement.classList.contains('cell')) placedTiles = placedTiles.filter(p => p.el !== el);
        currentX = t.clientX - 21; currentY = t.clientY - 21;
        targetX = currentX; targetY = currentY;
        el.classList.add('dragging');
        document.body.appendChild(el);
    };
    const move = (e) => {
        if(!activeTile) return;
        const t = e.touches ? e.touches[0] : e;
        targetX = t.clientX - 21; targetY = t.clientY - 21;
    };
    const end = (e) => {
        if(!activeTile) return;
        const t = e.changedTouches ? e.changedTouches[0] : e;
        
        // 🎯 THE TRICK: Make tile invisible so we can see the cell under it
        el.style.display = 'none';
        const dropTarget = document.elementFromPoint(t.clientX, t.clientY);
        el.style.display = 'flex';
        
        const cell = dropTarget?.closest('.cell');
        el.classList.remove('dragging');
        activeTile = null;

        if (cell && !cell.querySelector('.tile')) {
            cell.appendChild(el);
            el.style.position = 'absolute'; el.style.left='0'; el.style.top='0'; el.style.width='100%'; el.style.height='100%'; el.style.transform='none';
            placedTiles.push({el, index: cell.dataset.index});
        } else {
            document.getElementById('rack').appendChild(el);
            el.style.position='relative'; el.style.width='42px'; el.style.height='42px'; el.style.transform='none';
        }
    };
    el.addEventListener('touchstart', start, {passive:false});
    window.addEventListener('touchmove', move, {passive:false});
    window.addEventListener('touchend', end, {passive:false});
}

function updateMotion() { 
    if (activeTile) { 
        currentX += (targetX - currentX) * 0.8; currentY += (targetY - currentY) * 0.8; 
        activeTile.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`; 
    } 
    requestAnimationFrame(updateMotion); 
}

function initBag() { bag = []; tiles.distribution.forEach(d => { for(let i=0; i<d.q; i++) bag.push(d.l); }); bag.sort(()=>Math.random()-0.5); }
function refillRack() { const r = document.getElementById('rack'); while(r.children.length < 7 && bag.length > 0) { const t = document.createElement('div'); t.className='tile'; t.innerText=bag.pop(); r.appendChild(t); makeDraggable(t); } document.getElementById('bag-count').innerText = bag.length; }
function recall() { const r = document.getElementById('rack'); placedTiles.forEach(p => { r.appendChild(p.el); p.el.style.position='relative'; p.el.style.width='42px'; p.el.style.height='42px'; p.el.style.transform='none'; }); placedTiles = []; }
function play() { if(placedTiles.length > 0) { placedTiles.forEach(p => p.el.classList.add('fixed')); placedTiles = []; refillRack(); } }

startEngine();
