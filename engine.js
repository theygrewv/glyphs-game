// ... (Keep your top-level variables)
let layout, board, tiles, theme, ui, rules, playRules, scoring, wildLex, physics;
let dictionary = new Set(), bag = [], placedTiles = [], currentMode = 'dark';
let scores = { player: 0, bot: 0 }, currentPlayer = 'player';
let activeTile = null, targetX = 0, targetY = 0, currentX = 0, currentY = 0;

// ... (StartEngine and Load logic remains the same)

function makeDraggable(el) {
    let gRect;
    const dragLayer = document.getElementById('drag-layer') || (()=>{
        const d = document.createElement('div'); d.id='drag-layer'; document.body.appendChild(d); return d;
    })();

    const start = (e) => {
        if(el.classList.contains('fixed') || currentPlayer !== 'player') return;
        const t = e.touches ? e.touches[0] : e;
        gRect = document.getElementById('grid').getBoundingClientRect();
        
        if(el.parentElement.classList.contains('cell')) {
            placedTiles = placedTiles.filter(p => p.el !== el);
        }
        
        activeTile = el;
        // 🎯 SNAP TO CENTER: 22px is half of the 44px tile size
        const offset = 22; 
        
        el.style.width = '44px'; el.style.height = '44px';
        el.style.position = 'fixed';
        el.style.zIndex = '5000';
        dragLayer.appendChild(el);
        el.classList.add('dragging');
        
        // Immediate positioning to prevent the "jump"
        currentX = t.clientX - offset;
        currentY = t.clientY - offset;
        targetX = currentX;
        targetY = currentY;
        
        if(e.cancelable) e.preventDefault();
    };

    const move = (e) => {
        if(!activeTile || activeTile !== el) return;
        const t = e.touches ? e.touches[0] : e;
        // Keep the target centered under the finger
        targetX = t.clientX - 22; 
        targetY = t.clientY - 22;
    };

    const end = (e) => {
        if(!activeTile || activeTile !== el) return;
        el.classList.remove('dragging');
        activeTile = null;
        const t = e.changedTouches ? e.changedTouches[0] : e;
        
        if (t.clientX >= gRect.left && t.clientX <= gRect.right && t.clientY >= gRect.top && t.clientY <= gRect.bottom) {
            const col = Math.floor((t.clientX - gRect.left) / (gRect.width / board.cols));
            const row = Math.floor((t.clientY - gRect.top) / (gRect.height / (board.size / board.cols)));
            const idx = (row * board.cols) + col;
            const targetCell = document.querySelector(`.cell[data-index="${idx}"]`);
            
            if (targetCell && !targetCell.querySelector('.tile')) {
                targetCell.appendChild(el);
                el.style.position = 'absolute'; el.style.left = '0'; el.style.top = '0';
                el.style.width = '100%'; el.style.height = '100%';
                el.style.transform = 'none';
                placedTiles.push({el, index: idx});
                return;
            }
        }
        
        const rack = document.getElementById('rack');
        rack.appendChild(el);
        el.style.position = 'relative'; el.style.left = 'auto'; el.style.top = 'auto';
        el.style.width = '44px'; el.style.height = '44px'; el.style.transform = 'none';
    };

    el.addEventListener('touchstart', start, {passive: false});
    window.addEventListener('touchmove', move, {passive: false});
    window.addEventListener('touchend', end, {passive: false});
}

function updateMotion() { 
    if (activeTile) { 
        // 🚀 HIGHER LERP = TIGHTER TRACKING
        // 0.6 is snappier than 0.4. Use 1.0 for zero lag.
        const speed = 0.75; 
        currentX += (targetX - currentX) * speed; 
        currentY += (targetY - currentY) * speed; 
        activeTile.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(1.15)`; 
    } 
    requestAnimationFrame(updateMotion); 
}

// ... (Rest of your helper functions: buildUI, buildGrid, etc.)
