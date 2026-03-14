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

        ['referee.js'].forEach(src => {
            const s = document.createElement('script'); s.src = src; document.head.appendChild(s);
        });

        applyLexiconTheme(); buildHeader(); buildGrid(); buildUI();
        initBag(); refillRack('rack');
        requestAnimationFrame(updateMotion);
    } catch (e) { console.error(e); }
}

function applyLexiconTheme() {
    const m = theme.modes[currentMode];
    const style = document.createElement("style");
    style.innerText = `
        .grid{grid-template-columns:repeat(${board.cols},1fr); display:grid; width:100vw; height:100vw;}
        .cell{background:var(--obsidian); display:flex; align-items:center; justify-content:center; position:relative; box-shadow:inset 0 0 2px rgba(255,255,255,0.05);}
        .nav-back{position:fixed; top:10px; left:10px; z-index:9999; background:#000; border:1px solid #333; padding:10px; border-radius:50%;}
        
        /* 🌟 CENTER STAR & BONUS GLOW */
        .dd { background: #fff !important; color: #000 !important; box-shadow: 0 0 15px #fff !important; z-index:1; }
        .dl { color: var(--dl) !important; box-shadow: inset 0 0 10px var(--dl) !important; }
        .tl { color: var(--tl) !important; box-shadow: inset 0 0 10px var(--tl) !important; }
        .dw { color: var(--dw) !important; box-shadow: inset 0 0 10px var(--dw) !important; }
        .tw { color: var(--tw) !important; box-shadow: inset 0 0 10px var(--tw) !important; }
        
        .dragging { z-index: 10000 !important; pointer-events: none; }
        .tile { width:44px; height:44px; background:var(--gold); color:#000; display:flex; align-items:center; justify-content:center; font-weight:bold; position:relative; }
    `;
    document.head.appendChild(style);
    Object.keys(m.colors).forEach(k => document.documentElement.style.setProperty(`--${k}`, m.colors[k]));
}

function makeDraggable(el) {
    const start = (e) => {
        if(currentPlayer !== 'player') return;
        const t = e.touches ? e.touches[0] : e;
        const rect = el.getBoundingClientRect();
        
        activeTile = el;
        // Calculate offset so it stays under finger
        currentX = t.clientX - 22;
        currentY = t.clientY - 22;
        targetX = currentX; targetY = currentY;

        el.style.position = 'fixed';
        el.style.left = '0'; el.style.top = '0';
        el.classList.add('dragging');
        if(e.cancelable) e.preventDefault();
    };

    const move = (e) => {
        if(!activeTile || activeTile !== el) return;
        const t = e.touches ? e.touches[0] : e;
        targetX = t.clientX - 22;
        targetY = t.clientY - 22;
    };

    const end = (e) => {
        if(!activeTile || activeTile !== el) return;
        el.classList.remove('dragging');
        activeTile = null;
        const t = e.changedTouches ? e.changedTouches[0] : e;
        const cell = document.elementFromPoint(t.clientX, t.clientY)?.closest('.cell');
        
        if (cell && !cell.querySelector('.tile')) {
            cell.appendChild(el);
            el.style.position = 'absolute'; el.style.left='0'; el.style.top='0';
            el.style.width='100%'; el.style.height='100%'; el.style.transform='none';
            placedTiles.push({el, index: cell.dataset.index});
        } else {
            document.getElementById('rack').appendChild(el);
            el.style.position='relative'; el.style.transform='none';
        }
    };

    el.addEventListener('touchstart', start);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', end);
}

function updateMotion() { 
    if (activeTile) { 
        currentX += (targetX - currentX) * 0.9; 
        currentY += (targetY - currentY) * 0.9; 
        activeTile.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(1.2)`; 
    } 
    requestAnimationFrame(updateMotion); 
}

function handlePlayWord() {
    if (validatePlacement()) {
        placedTiles.forEach(p => p.el.classList.add('fixed'));
        placedTiles = [];
        refillRack('rack');
        alert("Valid Move!");
    } else {
        alert("Invalid Placement!");
    }
}

/* Include basic buildGrid, buildUI, initBag from previous steps */
function buildGrid() { const g = document.getElementById('grid'); g.innerHTML = ''; for(let i=0; i<board.size; i++) { const c = document.createElement('div'); c.className = 'cell'; c.dataset.index = i; if(layout[i]) { c.innerText = layout[i].t; c.classList.add(layout[i].c); } g.appendChild(c); } }
function buildUI() { const ctrl = document.getElementById('ui-controls'); ctrl.innerHTML = '<button onclick="handlePlayWord()">PLAY</button>'; }
function initBag() { bag = []; tiles.distribution.forEach(d => { for(let i=0; i<d.q; i++) bag.push({...d}); }); bag.sort(() => Math.random() - 0.5); }
function refillRack(rId) { const r = document.getElementById(rId); while(r.children.length < 7 && bag.length > 0) { const d = bag.pop(); const t = document.createElement('div'); t.className='tile'; t.innerText=d.l; t.dataset.raw=d.l; r.appendChild(t); makeDraggable(t); } }
function buildHeader() { document.getElementById('game-header').innerHTML = '<div id="bag-count"></div>'; }

startEngine();
