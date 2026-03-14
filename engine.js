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

        applyLexiconTheme(); buildHeader(); buildGrid(); buildUI(); setupWildcard();
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
        .cell { background: var(--obsidian); box-shadow: ${m.effects.bevel}; position: relative; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 900; }
        
        /* ✨ THE GLOW RETURNS */
        .dl { color: var(--dl); box-shadow: inset 0 0 ${m.effects.glow} var(--dl); }
        .tl { color: var(--tl); box-shadow: inset 0 0 ${m.effects.glow} var(--tl); }
        .dw { color: var(--dw); box-shadow: inset 0 0 ${m.effects.glow} var(--dw); }
        .tw { color: var(--tw); box-shadow: inset 0 0 ${m.effects.glow} var(--tw); }
        .dd { color: var(--dd); box-shadow: inset 0 0 ${m.effects.glow} var(--dd); }

        .search-bar { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-bottom: 1px solid var(--gridLine); background: rgba(0,0,0,0.2); }
        #word-checker { background: #000; border: 1px solid var(--gridLine); color: var(--gold); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; width: 100px; outline: none; }
        #checker-result { font-size: 0.6rem; font-weight: 900; }
        .valid { color: #4CAF50; } .invalid { color: #FF5252; }
    `;
    document.head.appendChild(style);
}

function initBag() { 
    if(!tiles) return; 
    bag = [];
    tiles.distribution.forEach(d => { 
        for(let i=0; i<d.q; i++) bag.push({...d}); 
    }); 
    // Super shuffle to avoid vowel clumps
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
}

/* ... existing helper functions (buildGrid, buildUI, etc) ... */
startEngine();
