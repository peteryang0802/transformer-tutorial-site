// 通用 UI 组件：站进度条、先猜后验、阅读位置自动记录。

// 渲染顶部站进度条，并和实际点亮状态同步。
function renderStationProgress(container, chapterId, totalStations) {
    container.classList.add('station-progress');
    function paint() {
        container.innerHTML = '';
        for (let i = 0; i < totalStations; i++) {
            const dot = document.createElement('button');
            dot.className = 'station-dot' + (isLit(chapterId, i) ? ' lit' : '');
            dot.dataset.station = i;
            dot.title = `第 ${i + 1} 站`;
            dot.setAttribute('aria-label', `跳到第 ${i + 1} 站，共 ${totalStations} 站`);
            dot.addEventListener('click', () => {
                const target = document.getElementById(`station-${i}`);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            container.appendChild(dot);
        }
    }
    paint();
    // 暴露刷新方法，点亮后调用
    container.refresh = paint;
    return container;
}

// 先猜后验组件。
// opts: { question, options:[字符串...], correctIndex, explanation, chapterId, stationIndex }
function makeGuess(container, opts) {
    const { question, options, correctIndex, explanation, chapterId, stationIndex } = opts;
    container.classList.add('guess-box');
    container.innerHTML = `
        <p class="guess-question">先猜一下：${question}</p>
        <div class="guess-options"></div>
        <div class="guess-result" style="display:none;"></div>
    `;
    const optionsEl = container.querySelector('.guess-options');
    const resultEl = container.querySelector('.guess-result');

    options.forEach((text, i) => {
        const btn = document.createElement('button');
        btn.className = 'guess-option';
        btn.textContent = text;
        btn.addEventListener('click', () => reveal(i));
        optionsEl.appendChild(btn);
    });

    function resetGuess() {
        resultEl.style.display = 'none';
        resultEl.innerHTML = '';
        optionsEl.querySelectorAll('.guess-option').forEach((b) => {
            b.disabled = false;
            b.classList.remove('correct', 'wrong');
        });
    }

    function reveal(chosen) {
        const buttons = optionsEl.querySelectorAll('.guess-option');
        buttons.forEach((b, i) => {
            b.disabled = true;
            if (i === correctIndex) b.classList.add('correct');
            if (i === chosen && chosen !== correctIndex) b.classList.add('wrong');
        });

        const correct = chosen === correctIndex;
        resultEl.style.display = 'block';
        resultEl.innerHTML = correct
            ? `<p class="guess-ok">猜对了。${explanation}</p>`
            : `<p class="guess-no">没猜对。正确答案是“${options[correctIndex]}”。${explanation}</p>
               <div class="guess-actions">
                 <button class="run-btn btn-secondary guess-retry">再试一次</button>
                 <button class="run-btn guess-confirm">我懂了，点亮这一站</button>
               </div>`;

        if (correct) {
            lightUp(chapterId, stationIndex);
            refreshProgress(chapterId);
        } else {
            resultEl.querySelector('.guess-retry').addEventListener('click', resetGuess);
            resultEl.querySelector('.guess-confirm').addEventListener('click', () => {
                lightUp(chapterId, stationIndex);
                refreshProgress(chapterId);
                resultEl.querySelector('.guess-confirm').disabled = true;
                const retryBtn = resultEl.querySelector('.guess-retry');
                if (retryBtn) retryBtn.disabled = true;
            });
        }
    }
}

// 点亮后同步顶部进度条（页面里进度条容器约定 id="stationProgress"）
function refreshProgress(chapterId) {
    const bar = document.getElementById('stationProgress');
    if (bar && typeof bar.refresh === 'function') bar.refresh();
}

// 监听各站进入视口，自动记录当前阅读位置。
function observeStations(chapterId) {
    const stations = document.querySelectorAll('.station');
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
        const visible = entries
            .filter(e => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) {
            const idx = Number(visible[0].target.dataset.stationIndex);
            setLastStation(chapterId, idx);
        }
    }, { root: null, threshold: [0.25, 0.5, 0.75] });
    stations.forEach(s => observer.observe(s));
}

// 手动点亮某站（用于演示型交互完成后），并同步进度条。
function markStationDone(chapterId, stationIndex) {
    lightUp(chapterId, stationIndex);
    refreshProgress(chapterId);
}

// 软点亮（骨架阶段用）：放一个“标记这站已读”按钮，读完手动点亮，不锁路。
function makeSoftMark(container, chapterId, stationIndex) {
    container.classList.add('soft-mark');
    function paintDone() {
        container.innerHTML = '<span class="soft-done">这一站已读</span>';
    }
    if (isLit(chapterId, stationIndex)) {
        paintDone();
        return;
    }
    container.innerHTML = '<button class="run-btn btn-secondary soft-btn">标记这站已读</button>';
    container.querySelector('.soft-btn').addEventListener('click', () => {
        lightUp(chapterId, stationIndex);
        refreshProgress(chapterId);
        paintDone();
    });
}

// 通用标签切换：容器内 .tbl-tab[data-i] 与 .tbl-panel[data-i] 按序号配对，点标签切面板。
function bindTabSwitch(container) {
    const tabs = container.querySelectorAll('.tbl-tab');
    const panels = container.querySelectorAll('.tbl-panel');
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const i = tab.dataset.i;
            tabs.forEach((t) => t.classList.toggle('active', t === tab));
            panels.forEach((p) => p.classList.toggle('active', p.dataset.i === i));
        });
    });
}
