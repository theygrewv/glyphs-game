import os

file_path = 'index.html'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Fix CSS for the grey board issue
old_cell_css = ".cell { background: var(--bg); display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; position: relative; border: 0.1px solid rgba(255,255,255,0.05); }"
new_cell_css = ".cell { background: #000; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; position: relative; border: 0.1px solid rgba(255,255,255,0.05); width: 100%; height: 100%; }"
content = content.replace(old_cell_css, new_cell_css)

# 2. Add High Score Initialization
high_score_init = "let totalScore = 0;\n        let highScore = localStorage.getItem('glyphs_pb') || 0;"
content = content.replace("let totalScore = 0;", high_score_init)

# 3. Inject High Score check into the play logic
old_play_logic = "totalScoreEl.innerText = totalScore.toString().padStart(3, '0');"
new_play_logic = """totalScoreEl.innerText = totalScore.toString().padStart(3, '0');
            if (totalScore > highScore) {
                highScore = totalScore;
                localStorage.setItem('glyphs_pb', highScore);
                alert('NEW PERSONAL BEST: ' + highScore);
            }"""
content = content.replace(old_play_logic, new_play_logic)

with open(file_path, 'w') as f:
    f.write(content)
