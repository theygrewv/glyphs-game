let layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics;
let dictionary = new Set(), bag = [], placedTiles = [], currentMode = 'dark';
let scores = { player: 0, bot: 0 }, currentPlayer = 'player';
let activeTile = null, targetX = 0, targetY = 0, currentX = 0, currentY = 0, wildTarget = null;

async function startEngine() {
    try {
        const fetchJson = (url) => fetch(url).then(r => r.json());
        const res = await Promise.all(['layout','board','tiles','theme','ui','rules','play','scoring','wildcard','physics'].map(n => fetchJson(`./lexicon/${n}.json`)));
        [layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics] = res;
        
        if(playRules.validation.dictionaryUrl) {
            const dText = await fetch(playRules.validation.dictionaryUrl).then(r => r.text());
            dictionary = new Set(dText.toUpperCase().match(/[A-Z]+/g));
        }

        ['bot.js', 'referee.js'].forEach(src => {
            const s = document.createElement('script'); s.src = src; document.head.appendChild(s);
        });

        applyLexiconTheme(); buildHeader(); buildGrid(); buildUI(); 
        if (!loadGameState()) { initBag(); refillRack('rack'); refillRack('bot-rack'); }
        requestAnimationFrame(updateMotion);
    } catch (e) { console.error("Engine Crash:", e); }
}

function applyLexiconTheme() {
    const m = theme.modes[currentMode];
    const root = document.documentElement.style;
    Object.keys(m.colors).forEach(k => root.setProperty(`--${k}`, m.colors[k]));
    const style = document.getElementById('lexicon-styles') || document.createElement("style");
    style.id = 'lexicon-styles';
    style.innerText = `
        .grid{grid-template-columns:repeat(${board.cols},1fr);gap:${board.gap}} 
        .nav-back{position:absolute;top:15px;left:15px;z-index:2000;background:rgba(0,0,0,0.5);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--gridLine);font-size:1.2rem;}
        .cell { background: var(--obsidian); box-shadow: ${m.effects.bevel}; position: relative; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 900; color: rgba(255,255,255,0.2); }
        .dl { color: var(--dl) !important; box-shadow: inset 0 0 ${m.effects.glow} var(--dl) !important; }
        .tl { color: var(--tl) !important; box-shadow: inset 0 0 ${m.effects.glow} var(--tl) !important; }
        .dw { color: var(--dw) !important; box-shadow: inset 0 0 ${m.effects.glow} var(--dw) !important; }
        .tw { color: var(--tw) !important; box-shadow: inset 0 0 ${m.effects.glow} var(--tw) !important; }
        .dd { color: var(--dd) !important; box-shadow: inset 0 0 ${m.effects.glow} var(--dd) !important; }
        .search-bar { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-bottom: 1px solid var(--gridLine); background: rgba(0,0,0,0.2); }
        #word-checker { background: #000; border: 1px solid var(--gridLine); color: var(--gold); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; width: 100px; outline: none; }
        #checker-result { font-size: 0.6rem; font-weight: 900; }
        .valid { color: #4CAF50; } .invalid { color: #FF5252; }
    `;
    document.head.appendChild(style);
}

function buildHeader() {
    const header = document.getElementById('game-header');
    header.innerHTML = `
        <div class="search-bar">
            <input type="text" id="word-checker" placeholder="CHECK WORD..." maxlength="15">
            <div id="checker-result"></div>
        </div>
        <div style="display:flex; justify-content:space-between; padding: 10px; align-items:center;">
            <div><small>YOU</small><div id="score-player" style="color:var(--gold); font-size:1.5rem; font-weight:900;">000</div></div>
            <div id="turn-status" style="font-size:0.7rem; letter-spacing:1px;">YOUR TURN</div>
            <div style="text-align:right"><small>BOT</small><div id="score-bot" style="color:var(--tw); font-size:1.5rem; font-weight:900;">000</div></div>
        </div>
    `;
    const input = document.getElementById('word-checker');
    input.oninput = (e) => {
        const val = e.target.value.toUpperCase();
        const res = document.getElementById('checker-result');
        if (val.length < 2) { res.innerText = ''; return; }
        if (typeof checkWordInDictionary === 'function') {
            const check = checkWordInDictionary(val);
            res.innerText = check.msg;
            res.className = check.valid ? 'valid' : 'invalid';
        }
    };
}

function buildGrid() {
    const g = document.getElementById('grid');
    g.innerHTML = '';
    for(let i=0; i<board.size; i++) {
        const c = document.createElement('div');
        c.className = 'cell';
        c.dataset.index = i;
        if(layout[i]) {
            c.innerText = layout[i].t;
            c.classList.add(layout[i].c);
        }
        g.appendChild(c);
    }
}

function buildUI() {
    if (!document.querySelector('.nav-back')) {
        const nav = document.createElement('div');
        nav.className = 'nav-back'; nav.innerText = '◀';
        nav.onclick = () => window.location.href = 'index.html';
        document.body.appendChild(nav);
    }

    const ctrl = document.getElementById('ui-controls');
    ctrl.innerHTML = '';
    ui.buttons.forEach(btn => {
        const b = document.createElement('button');
        b.className = btn.class; b.innerText = btn.text;
        b.onclick = () => {
            if(btn.action === 'shuffleRack') shuffleRack();
            if(btn.action === 'recallTiles') recallTiles();
            if(btn.action === 'swapTiles') swapTiles();
            if(btn.action === 'playWord') handlePlayWord(false);
            if(btn.action === 'passTurn') { recallTiles(); switchTurn('bot'); }
        };
        ctrl.appendChild(b);
    });
}

function initBag() {
    bag = [];
    tiles.distribution.forEach(d => { for(let i=0; i<d.q; i++) bag.push({...d}); });
    bag.sort(() => Math.random() - 0.5);
}

function refillRack(rackId) {
    const r = document.getElementById(rackId);
    let needed = 7 - r.querySelectorAll('.tile').length;
    for (let i = 0; i < needed && bag.length > 0; i++) {
        let data = bag.pop();
        const t = document.createElement('div');
        t.className = 'tile';
        t.innerHTML = `<span>${data.l}</span><span class="val">${data.l === '?' ? '?' : data.v}</span>`;
        t.dataset.letter = data.l; t.dataset.raw = data.l; t.dataset.value = data.v;
        r.appendChild(t);
        if (rackId === 'rack') makeDraggable(t);
    }
}

function swapTiles() {
    if (currentPlayer !== 'player' || bag.length < 7) return;
    recallTiles();
    const rack = document.getElementById('rack');
    Array.from(rack.querySelectorAll('.tile')).forEach(t => {
        bag.push({ l: t.dataset.raw, v: parseInt(t.dataset.value) });
        t.remove();
    });
    bag.sort(() => Math.random() - 0.5);
    refillRack('rack');
    switchTurn('bot');
}

function switchTurn(next) {
    currentPlayer = next;
    document.getElementById('turn-status').innerText = next === 'bot' ? "🤖 COMPUTING..." : "YOUR TURN";
    if (next === 'bot' && typeof playBotTurn === 'function') setTimeout(playBotTurn, 1000);
}

function updateMotion() { 
    if (activeTile && physics) { 
        currentX += (targetX - currentX) * (physics.motion.lerp || 0.4); 
        currentY += (targetY - currentY) * (physics.motion.lerp || 0.4); 
        activeTile.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${physics.motion.dragScale})`; 
    } 
    requestAnimationFrame(updateMotion); 
}

function recallTiles() {
    const r = document.getElementById('rack');
    placedTiles.forEach(p => {
        p.el.classList.remove('on-board');
        p.el.style.position = 'relative'; p.el.style.transform = 'none';
        r.appendChild(p.el);
    });
    placedTiles = [];
}

function shuffleRack() {
    const r = document.getElementById('rack');
    const t = Array.from(r.querySelectorAll('.tile')).sort(() => Math.random() - 0.5);
    t.forEach(tile => r.appendChild(tile));
}

function getTileAt(i) { return document.querySelector(`.cell[data-index="${i}"] .tile`); }
function loadGameState() { return false; }
function setupWildcard() {}
function makeDraggable(el) { /* Re-add your draggable logic here if needed */ }

startEngine();
