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
            fetchJson('./lexicon/layout.json'), fetchJson('./lexicon/board.json'), fetchJson('./lexicon/tiles.json'), 
            fetchJson('./lexicon/theme.json'), fetchJson('./lexicon/ui.json'), fetchJson('./lexicon/rules.json'),
            fetchJson('./lexicon/play.json'), fetchJson('./lexicon/scoring.json'), fetchJson('./lexicon/wildcard.json'), fetchJson('./lexicon/physics.json')
        ]);
        [layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics] = res;
        currentMode = theme?.active || 'dark';
        
        if(playRules && playRules.validation.dictionaryUrl) {
            const dText = await fetch(playRules.validation.dictionaryUrl).then(r => r.text());
            dictionary = new Set(dText.toUpperCase().match(/[A-Z]+/g));
        }
        
        if (!document.getElementById('bot-script')) {
            const s = document.createElement('script'); s.id = 'bot-script'; s.src = 'bot.js'; document.head.appendChild(s);
        }
        if (!document.getElementById('bot-rack')) {
            const br = document.createElement('div'); br.id = 'bot-rack'; br.style.display = 'none'; document.body.appendChild(br);
        }
        
        applyLexiconTheme(); buildHeader(); buildGrid(); buildUI(); setupWildcard();
        if (!loadGameState()) { initBag(); refillRack('rack'); refillRack('bot-rack'); }
        requestAnimationFrame(updateMotion);
    } catch (e) { console.error("Engine Error:", e); }
}

function applyLexiconTheme() { 
    if (!theme || !theme.modes[currentMode] || !board) return; 
    const m = theme.modes[currentMode]; 
    const root = document.documentElement.style; 
    Object.keys(m.colors).forEach(k => root.setProperty(`--${k}`, m.colors[k])); 
    const style = document.getElementById('lexicon-styles') || document.createElement("style"); 
    style.id = 'lexicon-styles'; 
    style.innerText = `.grid { grid-template-columns: repeat(${board.cols}, 1fr); grid-auto-rows: 1fr; gap: ${board.gap || '2px'}; border: 1px solid var(--gridLine); } .cell { background: var(--obsidian); backdrop-filter: blur(${m.effects.blur}); box-shadow: ${m.effects.bevel}; position: relative; } .nav-back { position: absolute; top: 15px; left: 15px; z-index: 2000; background: rgba(0,0,0,0.5); border: 1px solid var(--gridLine); color: #fff; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: bold; } .tile.fixed { box-sizing: border-box; } .dl { color: var(--dl); box-shadow: inset 0 0 ${m.effects.glow} var(--dl); } .tl { color: var(--tl); box-shadow: inset 0 0 ${m.effects.glow} var(--tl); } .dw { color: var(--dw); box-shadow: inset 0 0 ${m.effects.glow} var(--dw); } .tw { color: var(--tw); box-shadow: inset 0 0 ${m.effects.glow} var(--tw); }`;
    document.head.appendChild(style); 
}

function buildUI() { 
    if(!ui) return; 
    if (ui.nav) {
        let backBtn = document.querySelector('.nav-back');
        if (!backBtn) {
            backBtn = document.createElement('div');
            backBtn.className = ui.nav.class;
            backBtn.innerText = ui.nav.text;
            backBtn.onclick = () => window.location.href = 'index.html';
            document.body.appendChild(backBtn);
        }
    }
    const ctrl = document.getElementById('ui-controls'); 
    ctrl.innerHTML = ''; 
    ui.buttons.forEach(btn => { 
        const b = document.createElement('button'); 
        b.className = btn.class; b.innerText = btn.text; 
        if(btn.action === 'shuffleRack') b.onclick = shuffleRack; 
        if(btn.action === 'recallTiles') b.onclick = recallTiles; 
        if(btn.action === 'toggleTheme') b.onclick = () => { currentMode = currentMode === 'dark' ? 'light' : 'dark'; applyLexiconTheme(); }; 
        if(btn.action === 'playWord') b.onclick = () => handlePlayWord(false); 
        if(btn.action === 'passTurn') b.onclick = () => { recallTiles(); document.getElementById('turn-status').innerText = "YOU PASSED"; setTimeout(() => switchTurn('bot'), 1000); }; 
        ctrl.appendChild(b); 
    }); 
}

/* ... (Remaining helper functions like saveGameState, buildGrid, etc. should follow) ... */
