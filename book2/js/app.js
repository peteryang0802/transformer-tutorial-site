/* ============================================================
 * 训练台交互（纯 JS）
 * 单步状态机：预测 -> 损失 -> 反向 -> 更新，循环上升
 * ============================================================ */
(function () {
    'use strict';

    var WORDS = ['书', '笔', '妹妹', '故事', '。'];
    var BAR_COLORS = ['#2563eb', '#0891b2', '#db2777', '#7c3aed', '#ea580c'];
    var SAMPLES = [
        { x: [0.9, 0.1, 0.2], target: 0 },
        { x: [0.2, 0.8, 0.3], target: 1 },
        { x: [0.3, 0.2, 0.9], target: 3 }
    ];
    var HINTS = [
        '这就是它现在的猜测。正确答案概率还很低——它还没学。',
        '正确答案概率越低，损失越大。这一个数，就是“差多少”。',
        '责怪顺着图往回流，每个参数领到方向和大小。红＝要调小，蓝＝要调大。',
        '参数按责任改了一次，损失降了一点。再单步走，看新的预测。'
    ];

    var model, phase, currentSample, lr, history, playTimer;

    // ---------- DOM 小工具 ----------
    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }
    function fmt3(x) { return Number(x).toFixed(3); }

    // ---------- 初始化 ----------
    function init() {
        lr = Number(document.getElementById('lrRange').value);
        currentSample = 0;
        history = [];
        phase = -1;
        buildModel();
        renderTokenStrip();
        renderProbs();
        renderHeatmap(null);
        setPhase(-1);
        drawCurve();
        bindEvents();
    }

    function buildModel() {
        model = TinyLab.createModel({ d: 3, C: 5, seed: 7, samples: SAMPLES });
    }

    function bindEvents() {
        document.getElementById('stepBtn').addEventListener('click', step);
        document.getElementById('playBtn').addEventListener('click', togglePlay);
        document.getElementById('fastBtn').addEventListener('click', function () { fast(100); });
        document.getElementById('resetBtn').addEventListener('click', reset);
        document.getElementById('lrRange').addEventListener('input', function (e) {
            lr = Number(e.target.value);
            document.getElementById('lrVal').textContent = lr.toFixed(2);
        });
    }

    // ---------- 句子条 ----------
    function renderTokenStrip() {
        var strip = document.getElementById('tokenStrip');
        strip.innerHTML = '';
        SAMPLES.forEach(function (s, i) {
            var chip = el('button', 'token-chip' + (i === currentSample ? ' active' : ''),
                '第' + (i + 1) + '题 → ' + WORDS[s.target]);
            chip.type = 'button';
            chip.addEventListener('click', function () {
                currentSample = i;
                refreshCurrent();
            });
            strip.appendChild(chip);
        });
    }

    // ---------- 概率条 ----------
    function renderProbs() {
        var s = SAMPLES[currentSample];
        var probs = model.forward(s.x).probs;
        var box = document.getElementById('probBars');
        box.innerHTML = '';
        probs.forEach(function (p, j) {
            var row = el('div', 'prob-row' + (j === s.target ? ' is-target' : ''));
            row.appendChild(el('span', 'prob-word', WORDS[j]));
            var track = el('div', 'prob-track');
            var fill = el('div', 'prob-fill');
            fill.style.background = BAR_COLORS[j];
            fill.style.width = (p * 100).toFixed(1) + '%';
            track.appendChild(fill);
            row.appendChild(track);
            row.appendChild(el('span', 'prob-val', p.toFixed(2)));
            box.appendChild(row);
        });
    }

    // ---------- 损失 ----------
    function showLoss(loss) {
        var node = document.getElementById('lossNum');
        node.textContent = fmt3(loss);
        node.classList.remove('good', 'mid', 'bad');
        if (loss < 0.5) node.classList.add('good');
        else if (loss < 1.5) node.classList.add('mid');
        else node.classList.add('bad');
    }

    // ---------- 热力图 ----------
    function renderHeatmap(gW) {
        var heat = document.getElementById('heatmap');
        heat.innerHTML = '';
        for (var i = 0; i < model.d; i++) {
            for (var j = 0; j < model.C; j++) {
                var cell = el('div', 'heat-cell');
                var grad = gW ? gW[i][j] : null;
                if (grad !== null) {
                    var alpha = Math.min(Math.abs(grad) * 1.4, 0.85);
                    cell.style.background = grad > 0
                        ? 'rgba(220,38,38,' + alpha.toFixed(2) + ')'
                        : 'rgba(37,99,235,' + alpha.toFixed(2) + ')';
                    if (alpha > 0.45) cell.style.color = '#fff';
                    cell.appendChild(el('span', 'grad-tag', (grad > 0 ? '↓ ' : '↑ ') + Math.abs(grad).toFixed(2)));
                } else {
                    cell.style.background = '#f3f4f6';
                }
                cell.appendChild(document.createTextNode(fmt3(model.W[i][j])));
                heat.appendChild(cell);
            }
        }
    }

    // ---------- 计算图责怪动画 ----------
    function runBlame() {
        var nodes = document.querySelectorAll('#calcGraph .g-node');
        nodes.forEach(function (n) { n.classList.remove('blame'); });
        for (var k = nodes.length - 1; k >= 0; k--) {
            (function (node, delay) {
                setTimeout(function () { node.classList.add('blame'); }, delay);
            })(nodes[k], (nodes.length - 1 - k) * 350);
        }
    }

    // ---------- 阶段灯 / 提示 / 代码 ----------
    function setPhase(p) {
        phase = p;
        document.querySelectorAll('.phase-dot').forEach(function (dot, i) {
            dot.classList.toggle('active', i === p);
        });
        document.querySelectorAll('.code-line').forEach(function (line, i) {
            line.classList.toggle('active', i === p);
        });
        var hint = document.getElementById('phaseHint');
        hint.textContent = p === -1
            ? '点下面“单步走”，先看它怎么预测。'
            : HINTS[p];
    }

    // ---------- 单步状态机 ----------
    function step() {
        var s = SAMPLES[currentSample];
        if (phase === -1 || phase === 3) {
            renderProbs();
            setPhase(0);
        } else if (phase === 0) {
            showLoss(model.lossGrad(s.x, s.target).loss);
            setPhase(1);
        } else if (phase === 1) {
            runBlame();
            renderHeatmap(model.lossGrad(s.x, s.target).gW);
            setPhase(2);
        } else if (phase === 2) {
            var r = model.trainStep(lr);
            history.push(r.loss);
            drawCurve();
            renderHeatmap(null);
            renderProbs();
            showLoss(model.lossGrad(s.x, s.target).loss);
            setPhase(3);
        }
    }

    // ---------- 慢放 ----------
    function togglePlay() {
        var btn = document.getElementById('playBtn');
        if (playTimer) {
            clearInterval(playTimer);
            playTimer = null;
            btn.classList.remove('playing');
            btn.textContent = '慢放';
        } else {
            btn.classList.add('playing');
            btn.textContent = '暂停';
            playTimer = setInterval(step, 900);
        }
    }

    // ---------- 快跑 ----------
    function fast(n) {
        stopPlay();
        for (var i = 0; i < n; i++) {
            history.push(model.trainStep(lr).loss);
        }
        drawCurve();
        renderHeatmap(null);
        renderProbs();
        showLoss(model.lossGrad(SAMPLES[currentSample].x, SAMPLES[currentSample].target).loss);
        setPhase(3);
    }

    function stopPlay() {
        if (playTimer) {
            clearInterval(playTimer);
            playTimer = null;
            var btn = document.getElementById('playBtn');
            btn.classList.remove('playing');
            btn.textContent = '慢放';
        }
    }

    // ---------- 重置 ----------
    function reset() {
        stopPlay();
        history = [];
        buildModel();
        renderProbs();
        document.getElementById('lossNum').textContent = '–';
        document.getElementById('lossNum').className = 'loss-num';
        renderHeatmap(null);
        document.querySelectorAll('#calcGraph .g-node').forEach(function (n) { n.classList.remove('blame'); });
        setPhase(-1);
        drawCurve();
    }

    // 切换样本时刷新
    function refreshCurrent() {
        renderTokenStrip();
        renderProbs();
        var s = SAMPLES[currentSample];
        if (phase >= 1) showLoss(model.lossGrad(s.x, s.target).loss);
        if (phase === 2) renderHeatmap(model.lossGrad(s.x, s.target).gW);
    }

    // ---------- 损失曲线（高 DPI） ----------
    function drawCurve() {
        var canvas = document.getElementById('lossCanvas');
        var dpr = window.devicePixelRatio || 1;
        var cssW = canvas.clientWidth || 320;
        var cssH = canvas.clientHeight || 220;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cssW, cssH);

        // 网格
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        for (var g = 1; g <= 4; g++) {
            var y = cssH * g / 5;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cssW, y); ctx.stroke();
        }

        if (history.length === 0) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('还没有数据，更新几次后这里会出现下降的曲线', cssW / 2, cssH / 2);
            return;
        }

        var maxV = Math.max.apply(null, history);
        var n = history.length;
        var pad = 8;
        function px(i) { return pad + (cssW - 2 * pad) * (n === 1 ? 0 : i / (n - 1)); }
        function py(v) { return cssH - pad - (cssH - 2 * pad) * (v / (maxV || 1)); }

        // 面积
        ctx.beginPath();
        ctx.moveTo(px(0), py(history[0]));
        history.forEach(function (v, i) { ctx.lineTo(px(i), py(v)); });
        ctx.lineTo(px(n - 1), cssH - pad);
        ctx.lineTo(px(0), cssH - pad);
        ctx.closePath();
        ctx.fillStyle = 'rgba(37,99,235,0.10)';
        ctx.fill();

        // 折线
        ctx.beginPath();
        ctx.moveTo(px(0), py(history[0]));
        history.forEach(function (v, i) { ctx.lineTo(px(i), py(v)); });
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 末点
        ctx.beginPath();
        ctx.arc(px(n - 1), py(history[n - 1]), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#059669';
        ctx.fill();

        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('起点 ' + history[0].toFixed(2), 8, 16);
        ctx.textAlign = 'right';
        ctx.fillText('现在 ' + history[n - 1].toFixed(3), cssW - 8, 16);
    }

    window.addEventListener('resize', function () { drawCurve(); });

    document.addEventListener('DOMContentLoaded', init);
})();
