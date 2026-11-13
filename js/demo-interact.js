/* ============================================================
 * 演示型交互合集 DemoInteract（纯 JS，不依赖 Pyodide）
 * 各章把预告占位卡换成一个带 id 的容器，再调用对应 renderXxx。
 * 尽量复用 style.css 里已有的 .math-lab / .data-cell / .step-line / .run-btn。
 * ============================================================ */
(function (global) {
    'use strict';

    // ---------- 小工具 ----------
    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function fmt(x) {
        if (Math.abs(x) < 0.005) x = 0;
        return Number(x.toFixed(2)).toString();
    }

    // 一行滑块：左边文字，右边 range，下面实时值
    function makeRange(container, label, min, max, step, value, onInput) {
        var row = el('div', 'range-row');
        var head = el('div', 'range-head');
        head.appendChild(el('span', 'range-label', label));
        var valNode = el('span', 'range-val', fmt(value));
        head.appendChild(valNode);
        var input = el('input', 'range-input');
        input.type = 'range';
        input.min = min; input.max = max; input.step = step; input.value = value;
        input.addEventListener('input', function () {
            var v = Number(input.value);
            valNode.textContent = fmt(v);
            onInput(v);
        });
        row.appendChild(head);
        row.appendChild(input);
        container.appendChild(row);
        return input;
    }

    // 一组互斥按钮，点哪个哪个高亮
    function makeButtonGroup(container, labels, onPick) {
        var box = el('div', 'btn-group');
        var btns = labels.map(function (text, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', text);
            b.addEventListener('click', function () {
                box.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                onPick(i, text);
            });
            box.appendChild(b);
            return b;
        });
        container.appendChild(box);
        return box;
    }

    // 在 canvas 上画一个从中心出发的向量箭头
    function drawArrow(canvas, vec, color, label) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        var cx = w / 2, cy = h / 2;
        var scale = Math.min(w, h) / 2 * 0.75;
        var ex = cx + vec[0] * scale;
        var ey = cy - vec[1] * scale;
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
        var ang = Math.atan2(ey - cy, ex - cx);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 9 * Math.cos(ang - 0.4), ey - 9 * Math.sin(ang - 0.4));
        ctx.lineTo(ex - 9 * Math.cos(ang + 0.4), ey - 9 * Math.sin(ang + 0.4));
        ctx.closePath(); ctx.fill();
        if (label) {
            ctx.font = '13px sans-serif';
            ctx.fillText(label, ex + 6, ey - 6);
        }
    }

    // 画十字坐标（带网格和轴）
    function drawAxes(canvas) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1;
        for (var g = 1; g <= 3; g++) {
            var off = (Math.min(w, h) / 2) * g / 4;
            ctx.beginPath(); ctx.moveTo(w / 2 - off, 0); ctx.lineTo(w / 2 - off, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(w / 2 + off, 0); ctx.lineTo(w / 2 + off, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, h / 2 - off); ctx.lineTo(w, h / 2 - off); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, h / 2 + off); ctx.lineTo(w, h / 2 + off); ctx.stroke();
        }
        ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    }

    /* ============================================================
     * 第 1 章 · 点 Token，高亮所有同名位置
     * ============================================================ */
    function renderSameToken(container) {
        var SD = global.SentenceData;
        container.classList.add('demo-lab');
        var tip = el('p', 'lab-hint', '点任意一个格子，看看同一个词在句子里出现了几次、都在哪儿。再点一次取消。');
        container.appendChild(tip);
        var strip = el('div', 'ts-strip interactive');
        var selected = null;

        for (var pos = 1; pos <= SD.count; pos++) {
            (function (p) {
                var word = SD.tokenAt(p);
                var cell = el('span', 'ts-token clickable');
                cell.dataset.pos = p;
                cell.appendChild(el('i', 'ts-num', p));
                cell.appendChild(el('b', 'ts-word', word));
                cell.addEventListener('click', function () {
                    if (selected === word) {
                        selected = null;
                    } else {
                        selected = word;
                    }
                    paint();
                    if (selected) markDone(container);
                });
                strip.appendChild(cell);
            })(pos);
        }
        container.appendChild(strip);

        function paint() {
            strip.querySelectorAll('.ts-token').forEach(function (c) {
                var word = SD.tokenAt(Number(c.dataset.pos));
                c.classList.toggle('ts-hl', selected != null && word === selected);
            });
        }
    }

    /* ============================================================
     * 第 1 章 · BPE 切分器（下一轮）
     * ============================================================ */
    function renderBPE(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '材料里“故事书”出现 3 次、“故事会”出现 1 次。点“下一轮”，电脑就把挨得最多的一对合起来。'));

        // 每个片段是一个 token；两条材料各自一组
        var lines = [
            ['故', '事', '书'],
            ['故', '事', '会']
        ];
        var counts = [3, 1];
        var round = 0;
        var maxRounds = 2;

        var view = el('div', 'bpe-view');
        var status = el('p', 'bpe-status');
        var btn = el('button', 'run-btn', '下一轮');
        var resetBtn = el('button', 'run-btn btn-secondary', '重新开始');

        container.appendChild(view);
        container.appendChild(status);
        var controls = el('div', 'demo-controls');
        controls.appendChild(btn);
        controls.appendChild(resetBtn);
        container.appendChild(controls);

        function pairStats() {
            var stats = {};
            lines.forEach(function (line, li) {
                for (var i = 0; i < line.length - 1; i++) {
                    var key = line[i] + '|' + line[i + 1];
                    stats[key] = (stats[key] || 0) + counts[li];
                }
            });
            return stats;
        }

        function paint() {
            view.innerHTML = '';
            lines.forEach(function (line, li) {
                var row = el('div', 'bpe-line');
                row.appendChild(el('span', 'bpe-count', '×' + counts[li]));
                line.forEach(function (tok, i) {
                    row.appendChild(el('span', 'bpe-token', tok));
                    if (i < line.length - 1) row.appendChild(el('span', 'bpe-sep', '｜'));
                });
                view.appendChild(row);
            });
            if (round >= maxRounds) {
                status.textContent = '两轮走完，“故事书”已经合成一个词。';
                btn.disabled = true;
            } else {
                var stats = pairStats();
                var best = null, bestN = -1;
                Object.keys(stats).forEach(function (k) {
                    if (stats[k] > bestN) { bestN = stats[k]; best = k; }
                });
                status.textContent = '第 ' + (round + 1) + '轮：挨最多的是“' + best.split('|').join('') + '”，共 ' + bestN + ' 次。';
            }
        }

        function mergeOnce() {
            var stats = pairStats();
            var best = null, bestN = -1;
            Object.keys(stats).forEach(function (k) {
                if (stats[k] > bestN) { bestN = stats[k]; best = k; }
            });
            var parts = best.split('|');
            lines = lines.map(function (line) {
                var out = [];
                for (var i = 0; i < line.length; i++) {
                    if (i < line.length - 1 && line[i] === parts[0] && line[i + 1] === parts[1]) {
                        out.push(parts[0] + parts[1]);
                        i++;
                    } else {
                        out.push(line[i]);
                    }
                }
                return out;
            });
            round++;
            paint();
            markDone(container);
        }

        btn.addEventListener('click', function () { if (!btn.disabled) mergeOnce(); });
        resetBtn.addEventListener('click', function () {
            lines = [['故', '事', '书'], ['故', '事', '会']];
            round = 0;
            btn.disabled = false;
            paint();
        });
        paint();
    }

    /* ============================================================
     * 第 2 章 · 可调分量 + 坐标图（向量就是一个箭头）
     * ============================================================ */
    function renderVectorArrow(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '点数字两边的小按钮改分量。一格代表 1，x、y 都只能从 −4 调到 4，箭头不会跑出格子。'));
        var state = { v: [1, 2] };
        var numRow = el('div', 'data-row');
        var canvas = el('canvas', 'arrow-canvas');
        canvas.width = 320; canvas.height = 320;
        container.appendChild(numRow);
        container.appendChild(canvas);
        appendStepperCells(numRow, state.v, 'v');
        bindStepper(container, state, -4, 4, function () {
            render();
            markDone(container);
        });

        function formatNum(n) {
            return String(n).replace('-', '−');
        }

        function drawVectorGrid() {
            var ctx = canvas.getContext('2d');
            var left = 28, top = 20, size = 264;
            var unit = size / 8;
            var originX = left + unit * 4;
            var originY = top + unit * 4;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = '#d1d5db';
            ctx.lineWidth = 1;
            for (var n = -4; n <= 4; n++) {
                var x = originX + n * unit;
                var y = originY - n * unit;
                ctx.beginPath();
                ctx.moveTo(x, top);
                ctx.lineTo(x, top + size);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(left, y);
                ctx.lineTo(left + size, y);
                ctx.stroke();
            }

            ctx.strokeStyle = '#6b7280';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(left, originY);
            ctx.lineTo(left + size, originY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(originX, top + size);
            ctx.lineTo(originX, top);
            ctx.stroke();

            ctx.fillStyle = '#6b7280';
            ctx.beginPath();
            ctx.moveTo(left + size, originY);
            ctx.lineTo(left + size - 7, originY - 4);
            ctx.lineTo(left + size - 7, originY + 4);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(originX, top);
            ctx.lineTo(originX - 4, top + 7);
            ctx.lineTo(originX + 4, top + 7);
            ctx.closePath();
            ctx.fill();

            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#6b7280';
            ctx.fillText('x', left + size + 10, originY);
            ctx.fillText('y', originX, top - 9);

            ctx.font = '10px sans-serif';
            ctx.fillStyle = '#6b7280';
            for (var tick = -4; tick <= 4; tick++) {
                var tx = originX + tick * unit;
                var ty = originY - tick * unit;
                ctx.fillText(formatNum(tick), tx, top + size + 12);
                if (tick !== 0) ctx.fillText(formatNum(tick), left - 13, ty);
            }
            ctx.fillText('0', left - 13, originY);
        }

        function drawVectorArrow(vec) {
            var ctx = canvas.getContext('2d');
            var left = 28, top = 20, size = 264;
            var unit = size / 8;
            var originX = left + unit * 4;
            var originY = top + unit * 4;
            var ex = originX + vec[0] * unit;
            var ey = originY - vec[1] * unit;
            var label = '[' + formatNum(vec[0]) + ', ' + formatNum(vec[1]) + ']';

            ctx.strokeStyle = '#2563eb';
            ctx.fillStyle = '#2563eb';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            var ang = Math.atan2(ey - originY, ex - originX);
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - 10 * Math.cos(ang - 0.42), ey - 10 * Math.sin(ang - 0.42));
            ctx.lineTo(ex - 10 * Math.cos(ang + 0.42), ey - 10 * Math.sin(ang + 0.42));
            ctx.closePath();
            ctx.fill();

            ctx.font = '12px sans-serif';
            var labelWidth = ctx.measureText(label).width;
            var lx = ex + 8;
            var ly = ey - 8;
            if (lx + labelWidth > 312) lx = ex - 8 - labelWidth;
            if (lx < 4) lx = 4;
            if (ly < 12) ly = ey + 15;
            if (ly > 304) ly = ey - 15;
            ctx.fillStyle = '#1d4ed8';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, lx, ly);
        }

        function render() {
            syncNums(container, 'v', state.v);
            drawVectorGrid();
            drawVectorArrow(state.v);
        }
        render();
    }

    /* ============================================================
     * 第 2 章 · 词表 → 句子（共用起点、分开存放）
     * ============================================================ */
    function renderEmbeddingMap(container) {
        var SD = global.SentenceData;
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '点词表里的一个词，看它被复制到句子里哪几个位置。同一个词出现几次，就有几处共用它。'));
        var vocab = ['小明', '妹妹', '故事', '封面', '的'];
        var selected = null;
        var vocabBox = el('div', 'btn-group');
        vocab.forEach(function (w) {
            var b = el('button', 'run-btn btn-secondary group-btn', w);
            b.addEventListener('click', function () {
                vocabBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                selected = w; paint(); markDone(container);
            });
            vocabBox.appendChild(b);
        });
        container.appendChild(vocabBox);
        var strip = el('div', 'ts-strip');
        for (var pos = 1; pos <= SD.count; pos++) {
            (function (p) {
                var cell = el('span', 'ts-token');
                cell.dataset.pos = p;
                cell.appendChild(el('i', 'ts-num', p));
                cell.appendChild(el('b', 'ts-word', SD.tokenAt(p)));
                strip.appendChild(cell);
            })(pos);
        }
        container.appendChild(strip);
        function paint() {
            strip.querySelectorAll('.ts-token').forEach(function (c) {
                c.classList.toggle('ts-hl', selected != null && SD.tokenAt(Number(c.dataset.pos)) === selected);
            });
        }
    }

    /* ============================================================
     * 第 3 章 · 拼接 / 相加切换 + 对调两人
     * ============================================================ */
    function renderCombineSwitch(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '先在“拼接、相加”之间切，看结果格数变不变；再点对调，看相加后的数字跟着换位。'));
        var mode = 'add';   // add | concat
        var swapped = false;

        var TOK = { '小明': [1, 0], '妹妹': [1, 2] };
        var POS = { p3: [0, 0], p20: [0, 1] };

        var modeBox = el('div', 'btn-group');
        container.appendChild(modeBox);
        var swapBtn = el('button', 'run-btn', '对调两人');
        var swapBox = el('div', 'demo-controls');
        swapBox.appendChild(swapBtn);
        container.appendChild(swapBox);

        var view = el('div', 'combine-view');
        container.appendChild(view);

        ['相加', '拼接'].forEach(function (text, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', text);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                mode = i === 0 ? 'add' : 'concat';
                paint();
                markDone(container);
            });
            modeBox.appendChild(b);
        });

        swapBtn.addEventListener('click', function () {
            swapped = !swapped;
            swapBtn.textContent = swapped ? '恢复原例' : '对调两人';
            paint();
            markDone(container);
        });

        function combine(a, b) {
            return mode === 'add'
                ? a.map(function (v, i) { return v + b[i]; })
                : a.concat(b);
        }

        function paint() {
            // 每个位置：正常时 p3 坐小明、p20 坐妹妹；对调后互换
            var slots = [
                { label: '第 3 处', who: swapped ? '妹妹' : '小明', pos: POS.p3 },
                { label: '第 20 处', who: swapped ? '小明' : '妹妹', pos: POS.p20 }
            ];
            view.innerHTML = '';
            slots.forEach(function (s) {
                var card = el('div', 'combine-card');
                var head = el('p', 'combine-head', s.label + ' · ' + s.who);
                var tok = TOK[s.who];
                var detail = el('p', 'combine-detail',
                    '起始 ' + '[' + tok.join(',') + ']' +
                    '　位置 ' + '[' + s.pos.join(',') + ']');
                var result = combine(tok, s.pos);
                var res = el('p', 'combine-result', '结果 ' + '[' + result.join(', ') + ']');
                card.appendChild(head);
                card.appendChild(detail);
                card.appendChild(res);
                view.appendChild(card);
            });
        }
        paint();
    }

    /* ============================================================
     * 第 4 章 · “讲 / 读”切换，故事向量跟着变
     * ============================================================ */
    function renderTalkRead(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '在“讲、读”之间切，看前面邻居的平均怎么变，“故事”那一行跟着变。'));
        var isRead = false;
        var modeBox = el('div', 'btn-group');
        var view = el('div', 'combine-view');
        container.appendChild(modeBox);
        container.appendChild(view);

        ['讲', '读'].forEach(function (text, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', text);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                isRead = i === 1;
                paint();
                markDone(container);
            });
            modeBox.appendChild(b);
        });

        var DATA = {
            false: { neighbor: '讲 [2,0]', mean: [3, 0], result: [4, 1] },
            true: { neighbor: '读 [0,2]', mean: [2, 1], result: [3, 2] }
        };
        function paint() {
            var d = DATA[isRead];
            view.innerHTML = '';
            var card = el('div', 'combine-card');
            card.appendChild(el('p', 'combine-head', '前面邻居：' + d.neighbor + '，这个 [4,0]'));
            card.appendChild(el('p', 'combine-detail', '邻居平均 [' + d.mean.join(',') + ']'));
            card.appendChild(el('p', 'combine-result', '故事 [1,1] 加完 → [' + d.result.join(', ') + ']'));
            view.appendChild(card);
        }
        paint();
    }

    /* ============================================================
     * 第 5 章 · 配比滑块，结果实时变
     * ============================================================ */
    function renderMixSlider(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '拖动滑块改“妹妹”占多少，结果向量实时变。同样素材，配比不同，结果就不同。'));
        var w = 0.5;
        var out = el('p', 'combine-result');
        makeRange(container, '妹妹占比（封面占剩下的）', 0, 1, 0.05, 0.5, function (v) {
            w = v; paint(); markDone(container);
        });
        container.appendChild(out);
        function paint() {
            var r = [4 * w, 4 * (1 - w)];
            out.textContent = '妹妹 [' + fmt(r[0]) + ', 0] + 封面 [0, ' + fmt(r[1]) + '] → [' + fmt(r[0]) + ', ' + fmt(r[1]) + ']';
        }
        paint();
    }

    /* ============================================================
     * 第 6 章 · 转动 Q，看夹角和点积
     * ============================================================ */
    function renderQAngle(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '拖动滑块转动 Q 箭头，看它和横轴 K 的夹角怎么变，点积跟着变。夹角越小，点积越大。'));
        var angle = 0;
        var canvas = el('canvas', 'arrow-canvas');
        canvas.width = 320; canvas.height = 320;
        var info = el('p', 'combine-result');
        makeRange(container, 'Q 的角度（K 固定在横轴）', 0, 180, 5, 0, function (v) {
            angle = v; paint(); markDone(container);
        });
        container.appendChild(canvas);
        container.appendChild(info);
        function paint() {
            var rad = angle * Math.PI / 180;
            var q = [Math.cos(rad), -Math.sin(rad)];
            drawAxes(canvas);
            drawArrow(canvas, [1, 0], '#dc2626', 'K');
            drawArrow(canvas, q, '#2563eb', 'Q');
            info.textContent = '夹角 ' + angle + '°，点积 = cos ' + angle + '° = ' + fmt(Math.cos(rad));
        }
        paint();
    }

    /* ============================================================
     * 第 7 章 · 温度旋钮（softmax 温度）
     * ============================================================ */
    function renderTemperature(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '拧温度，看两个分数的比例怎么变。温度大，比例拉平；温度小，往一处集中。'));
        var T = 1;
        var out = el('div', 'combine-view');
        makeRange(container, '温度（小＝更集中，大＝更平均）', 0.1, 3, 0.1, 1, function (v) {
            T = v; paint(); markDone(container);
        });
        container.appendChild(out);
        function softmax(scores) {
            var ex = scores.map(function (s) { return Math.exp(s / T); });
            var sum = ex.reduce(function (a, b) { return a + b; }, 0);
            return ex.map(function (e) { return e / sum; });
        }
        function paint() {
            var p = softmax([4, 0]);
            out.innerHTML = '';
            var card = el('div', 'combine-card');
            card.appendChild(el('p', 'combine-head', '分数 [4, 0]，温度 ' + fmt(T)));
            card.appendChild(el('p', 'combine-result', '比例 [' + fmt(p[0]) + ', ' + fmt(p[1]) + ']'));
            out.appendChild(card);
        }
        paint();
    }

    /* ============================================================
     * 第 8 章 · 正反查（Q/K 角色不同，分数不同）
     * ============================================================ */
    function renderQueryKey(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '先点“小明查借给”，再点“借给查小明”。看谁出 Q、谁出 K，方向反了，分数不一样。'));
        var modeBox = el('div', 'btn-group');
        var view = el('div', 'combine-view');
        container.appendChild(modeBox);
        container.appendChild(view);

        // 数字按正文 K=[b,-a] 规则真实算出：小明[1,0]→K[0,-1]，借给[0,1]→K[1,0]
        var CASES = [
            { label: '小明查借给', q: '小明 Q [1, 0]', k: '借给 K [1, 0]', score: 1 },
            { label: '借给查小明', q: '借给 Q [0, 1]', k: '小明 K [0, -1]', score: -1 }
        ];
        CASES.forEach(function (c, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', c.label);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                paint(i);
                markDone(container);
            });
            modeBox.appendChild(b);
        });
        function paint(i) {
            var c = CASES[i];
            view.innerHTML = '';
            var card = el('div', 'combine-card');
            card.appendChild(el('p', 'combine-head', c.label));
            card.appendChild(el('p', 'combine-detail', c.q + '，' + c.k));
            card.appendChild(el('p', 'combine-result', '点积分数 ' + fmt(c.score)));
            view.appendChild(card);
        }
        paint(0);
    }

    /* ============================================================
     * 第 9 章 · Q/K/V 三表切换（同一行数字，三种用法）
     * ============================================================ */
    function renderQKV(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '点 Q、K、V 切，看“了”这同一行数字，在三件事里各管什么。'));
        var modeBox = el('div', 'btn-group');
        var view = el('div', 'combine-view');
        container.appendChild(modeBox);
        container.appendChild(view);

        // 同一行数字，只是用途换了；正文说这一章 Q、V 用原输入、K 才转，所以先拿同一组示意
        var BASE_VEC = [1, 2];
        var ROLES = [
            { name: 'Q', vec: BASE_VEC, use: '拿这一行去问别人：我该找谁。' },
            { name: 'K', vec: BASE_VEC, use: '别人拿这一行来对：我是不是你要找的。' },
            { name: 'V', vec: BASE_VEC, use: '真对上了，最后交出去的内容是这一行。' }
        ];
        ROLES.forEach(function (r, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', r.name);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                paint(i);
                markDone(container);
            });
            modeBox.appendChild(b);
        });
        function paint(i) {
            var r = ROLES[i];
            view.innerHTML = '';
            var card = el('div', 'combine-card');
            card.appendChild(el('p', 'combine-head', '“了”这一行作为 ' + r.name + '：[' + r.vec.join(', ') + ']'));
            card.appendChild(el('p', 'combine-result', r.use));
            view.appendChild(card);
        }
        paint(0);
    }

    /* ============================================================
     * 第 10 章 · 81 候选筛选器
     * ============================================================ */
    function renderCandidateFilter(container) {
        container.classList.add('demo-lab');

        // ---------- 生成 81 个候选（顺序同 itertools.product：最后一格变最快） ----------
        var CHOICES = [-1, 0, 1];
        var candidates = [];
        CHOICES.forEach(function (a) { CHOICES.forEach(function (b) {
            CHOICES.forEach(function (c) { CHOICES.forEach(function (d) {
                candidates.push([[a, b], [c, d]]);
            }); });
        }); });

        function dot(x, y) { return x.reduce(function (s, v, i) { return s + v * y[i]; }, 0); }
        function mm(A, B) {
            return A.map(function (row) {
                return B[0].map(function (_, c) {
                    return row.reduce(function (s, v, r) { return s + v * B[r][c]; }, 0);
                });
            });
        }
        var X = [[1, 0], [0, 1], [-1, -1]];
        var queries = [[1, 0], [0, 1]];
        var cand = [[4, 0], [0, 4]];
        var targets = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];

        function checkPairs(W) {
            var cK = mm(cand, W);
            var early = [
                [dot(queries[0], cK[0]), dot(queries[0], cK[1])],
                [dot(queries[1], cK[1]), dot(queries[1], cK[0])]
            ];
            var xK = mm(X, W);
            var rows = early.slice();
            targets.forEach(function (t) {
                rows.push([dot(X[t[0]], xK[t[1]]), dot(X[t[0]], xK[t[2]])]);
            });
            return rows;
        }

        // 预计算每个候选的结果
        var results = candidates.map(function (W) {
            var pairs = checkPairs(W);
            var passed = pairs.filter(function (p) { return p[0] > p[1]; }).length;
            return { W: W, pairs: pairs, passed: passed, win: passed === 5 };
        });
        var winIndex = results.findIndex(function (r) { return r.win; });

        // ---------- 状态 ----------
        var phase = 'idle';          // idle | ready | running | done
        var cursor = 0;              // 已检查到的个数（0..81）
        var cellState = candidates.map(function () { return 'pending'; });
        var timer = null;
        var fast = false;

        // ---------- DOM ----------
        container.appendChild(el('p', 'lab-hint', '先猜：81 个候选里，能有几个五道全过？再点生成，看电脑一个个淘汰。'));

        var guessBox = el('div', 'cf-guess btn-group');
        ['一个都没有', '正好 1 个', '不止 1 个'].forEach(function (g) {
            var b = el('button', 'run-btn btn-secondary group-btn', g);
            b.addEventListener('click', function () {
                guessBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
            });
            guessBox.appendChild(b);
        });
        container.appendChild(guessBox);

        var controls = el('div', 'cf-controls');
        container.appendChild(controls);
        var summary = el('p', 'cf-summary');
        container.appendChild(summary);
        var grid = el('div', 'cf-grid');
        container.appendChild(grid);
        var detail = el('div', 'cf-detail');
        container.appendChild(detail);

        // ---------- 渲染 ----------
        function buildGrid() {
            grid.innerHTML = '';
            results.forEach(function (r, i) {
                var cell = el('div', 'cf-cell');
                cell.title = '候选 ' + (i + 1);
                var inner = el('div', 'cf-mat');
                r.W.forEach(function (row) {
                    row.forEach(function (v) { inner.appendChild(el('span', 'cf-num', String(v))); });
                });
                cell.appendChild(inner);
                cell.appendChild(el('span', 'cf-mark'));
                grid.appendChild(cell);
            });
        }

        function refreshGrid() {
            var cells = grid.querySelectorAll('.cf-cell');
            cells.forEach(function (c, i) {
                c.className = 'cf-cell ' + cellState[i];
                var mark = c.querySelector('.cf-mark');
                mark.textContent = cellState[i] === 'out' ? '✗' : (cellState[i] === 'win' ? '✓' : '');
            });
        }

        function refreshSummary() {
            var outN = cellState.filter(function (s) { return s === 'out'; }).length;
            var winN = cellState.filter(function (s) { return s === 'win'; }).length;
            summary.textContent = '已查 ' + cursor + ' / 81　淘汰 ' + outN + '　全过 ' + winN;
        }

        function showDetail(i) {
            if (i == null || i < 0) { detail.innerHTML = ''; return; }
            var r = results[i];
            detail.innerHTML = '';
            var card = el('div', 'combine-card' + (r.win ? ' all-pass' : ''));
            card.appendChild(el('p', 'combine-head',
                '候选 ' + (i + 1) + ' / 81　矩阵 [[' + r.W[0].join(',') + '],[' + r.W[1].join(',') + ']]'));
            r.pairs.forEach(function (p, k) {
                var ok = p[0] > p[1];
                card.appendChild(el('p', 'check-line ' + (ok ? 'pass' : 'fail'),
                    '第 ' + (k + 1) + ' 关 ' + fmt(p[0]) + ' 比 ' + fmt(p[1]) + '　' + (ok ? '✓ 过' : '✗ 不过')));
            });
            card.appendChild(el('p', 'combine-result',
                '过了 ' + r.passed + ' / 5 道' + (r.win ? '，五道全过，留下！' : '')));
            detail.appendChild(card);
        }

        function examine(i) {
            cellState[i] = results[i].win ? 'win' : 'out';
            cursor = i + 1;
            refreshGrid();
            refreshSummary();
            showDetail(i);
        }

        function setChecking(i) {
            if (i < 0 || i >= 81) return;
            cellState[i] = 'checking';
            refreshGrid();
            showDetail(i);
        }

        function stopTimer() { if (timer) { clearTimeout(timer); timer = null; } }

        function tick() {
            if (cursor >= 81) { finish(); return; }
            examine(cursor);
            if (cursor >= 81) { finish(); return; }
            setChecking(cursor);
            timer = setTimeout(tick, fast ? 90 : 300);
        }

        function start() {
            phase = 'running';
            stopTimer();
            setChecking(cursor);
            renderControls();
            timer = setTimeout(tick, fast ? 90 : 300);
        }

        function pause() {
            stopTimer();
            phase = 'ready';
            if (cursor < 81 && cellState[cursor] === 'checking') cellState[cursor] = 'pending';
            refreshGrid();
            renderControls();
        }

        function stepOnce() {
            stopTimer();
            if (phase === 'running') phase = 'ready';
            if (cursor >= 81) { finish(); return; }
            var i = cursor;
            examine(i);
            if (cursor >= 81) { finish(); return; }
            cellState[cursor] = 'checking';
            refreshGrid();
            renderControls();
        }

        function jumpToAnswer() {
            stopTimer();
            for (var i = 0; i < 81; i++) cellState[i] = (i === winIndex) ? 'win' : 'out';
            cursor = 81;
            refreshGrid();
            refreshSummary();
            showDetail(winIndex);
            finish();
        }

        function finish() {
            stopTimer();
            phase = 'done';
            refreshGrid();
            refreshSummary();
            showDetail(winIndex);
            renderControls();
            markDone(container);
        }

        function reset() {
            stopTimer();
            phase = 'ready';
            cursor = 0;
            cellState = candidates.map(function () { return 'pending'; });
            detail.innerHTML = '';
            refreshGrid();
            refreshSummary();
            renderControls();
        }

        function generate() {
            buildGrid();
            phase = 'ready';
            cursor = 0;
            refreshGrid();
            refreshSummary();
            renderControls();
            setTimeout(function () { grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
        }

        function renderControls() {
            controls.innerHTML = '';
            function btn(label, cls, fn) {
                var b = el('button', cls || 'run-btn', label);
                b.addEventListener('click', fn);
                controls.appendChild(b);
            }
            if (phase === 'idle') {
                btn('生成 81 个候选', 'run-btn', generate);
            } else if (phase === 'ready') {
                btn('开始筛选', 'run-btn', start);
                btn('单步检查', 'run-btn btn-secondary', stepOnce);
                btn('跳到答案', 'run-btn btn-secondary', jumpToAnswer);
            } else if (phase === 'running') {
                btn('暂停', 'run-btn', pause);
                btn(fast ? '常速' : '加速', 'run-btn btn-secondary', function () {
                    fast = !fast;
                    stopTimer();
                    if (phase === 'running') timer = setTimeout(tick, fast ? 90 : 300);
                    renderControls();
                });
                btn('跳到答案', 'run-btn btn-secondary', jumpToAnswer);
            } else {
                btn('重新来一遍', 'run-btn', reset);
            }
        }

        refreshSummary();
        renderControls();
    }

    /* ============================================================
     * 第 11 章 · 缩放前 / 后开关
     * ============================================================ */
    function renderScaleSwitch(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '同样的匹配分，在“缩放前、缩放后”之间切，看比例从极端变柔和。缩放就是除以根号 d。'));
        var scaled = false;
        var modeBox = el('div', 'btn-group');
        var view = el('div', 'combine-view');
        container.appendChild(modeBox);
        container.appendChild(view);

        var scores = [4, 1, 0];
        var d = 4; // 根号 4 = 2

        ['缩放前', '缩放后'].forEach(function (text, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', text);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                scaled = i === 1;
                paint();
                markDone(container);
            });
            modeBox.appendChild(b);
        });

        function softmax(arr) {
            var ex = arr.map(function (v) { return Math.exp(v); });
            var sum = ex.reduce(function (a, b) { return a + b; }, 0);
            return ex.map(function (e) { return e / sum; });
        }
        function paint() {
            var used = scaled ? scores.map(function (v) { return v / Math.sqrt(d); }) : scores;
            var p = softmax(used);
            view.innerHTML = '';
            var card = el('div', 'combine-card');
            card.appendChild(el('p', 'combine-head',
                '三个候选的匹配分 [' + scores.join(',') + ']，Q、K 假设各 ' + d + ' 格' +
                (scaled ? '，除以根号 ' + d + '＝' + Math.sqrt(d) : '')));
            card.appendChild(el('p', 'combine-result', '比例 [' + p.map(fmt).join(', ') + ']'));
            view.appendChild(card);
        }
        paint();
    }

    /* ============================================================
     * 第 12 章 · 两个头切换 + 拼接
     * ============================================================ */
    function renderTwoHeads(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '点第 1 头、第 2 头，看同一行在两头取回的配方不一样；再点拼接，看它们接成一行。'));
        var modeBox = el('div', 'btn-group');
        var view = el('div', 'combine-view');
        container.appendChild(modeBox);
        container.appendChild(view);

        var VIEWS = [
            { name: '第 1 头', vec: [0.94, 0.06], note: '偏重“妈妈”，取回两格。' },
            { name: '第 2 头', vec: [0.06, 0.94], note: '偏重“蓝色”，取回两格。' },
            { name: '拼接', vec: [0.94, 0.06, 0.06, 0.94], note: '头 1 放前面、头 2 接后面，四个数都不改。' }
        ];
        VIEWS.forEach(function (v, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', v.name);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                paint(i);
                markDone(container);
            });
            modeBox.appendChild(b);
        });
        function paint(i) {
            var v = VIEWS[i];
            view.innerHTML = '';
            var card = el('div', 'combine-card');
            card.appendChild(el('p', 'combine-head', v.name + '：[' + v.vec.join(', ') + ']'));
            card.appendChild(el('p', 'combine-result', v.note));
            if (i === 2) {
                var detail = el('p', 'combine-detail');
                detail.innerHTML = '接下来再乘 <span class="mi">W<sub>O</sub></span> 组合，最后仍是一行四格。';
                card.appendChild(detail);
            }
            view.appendChild(card);
        }
        paint(0);
    }

    /* ============================================================
     * 第 13 章 · 覆盖 / 加回切换（残差）
     * ============================================================ */
    function renderResidual(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '同一份原数和改动，在“覆盖、加回”之间切。覆盖时前面的信息丢了，加回时保住。'));
        var addBack = false;
        var modeBox = el('div', 'btn-group');
        var view = el('div', 'combine-view');
        container.appendChild(modeBox);
        container.appendChild(view);

        var original = [1, 1, 0, 0];
        var change = [0, 0, 1, 1];

        ['覆盖', '加回'].forEach(function (text, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', text);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                addBack = i === 1;
                paint();
                markDone(container);
            });
            modeBox.appendChild(b);
        });
        function paint() {
            var result = addBack
                ? original.map(function (v, i) { return v + change[i]; })
                : change.slice();
            view.innerHTML = '';
            var card = el('div', 'combine-card');
            card.appendChild(el('p', 'combine-detail', '原数 [' + original.join(',') + ']，改动 [' + change.join(',') + ']'));
            card.appendChild(el('p', 'combine-result',
                (addBack ? '加回' : '覆盖') + ' → [' + result.join(', ') + ']'));
            card.appendChild(el('p', 'check-line ' + (addBack ? 'pass' : 'fail'),
                addBack ? '前两格的 1 保住了。' : '前两格的 1 被顶替成 0，丢了。'));
            view.appendChild(card);
        }
        paint();
    }

    /* ============================================================
     * 第 14 章 · ReLU 小图
     * ============================================================ */
    function renderReLU(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '拖动滑块改输入，看负数怎么被压到 0、正数原样通过。拐点就在 0。'));
        var x = 1;
        var canvas = el('canvas', 'arrow-canvas');
        canvas.width = 320; canvas.height = 320;
        var info = el('p', 'combine-result');
        makeRange(container, '输入 x', -3, 3, 0.1, 1, function (v) {
            x = v; paint(); markDone(container);
        });
        container.appendChild(canvas);
        container.appendChild(info);

        function toPx(xx, yy) {
            var px = (xx + 3) / 6 * canvas.width;
            var py = canvas.height - (yy + 1) / 4 * canvas.height;
            return [px, py];
        }
        function paint() {
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1;
            var h0 = toPx(-3, 0), h1 = toPx(3, 0);
            ctx.beginPath(); ctx.moveTo(h0[0], h0[1]); ctx.lineTo(h1[0], h1[1]); ctx.stroke();
            var v0 = toPx(0, -1), v1 = toPx(0, 3);
            ctx.beginPath(); ctx.moveTo(v0[0], v0[1]); ctx.lineTo(v1[0], v1[1]); ctx.stroke();
            // ReLU 折线
            ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2.5;
            var a = toPx(-3, 0), b = toPx(0, 0), c = toPx(3, 3);
            ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
            // 当前点
            var y = Math.max(0, x);
            var pp = toPx(x, y);
            ctx.fillStyle = '#dc2626';
            ctx.beginPath(); ctx.arc(pp[0], pp[1], 5, 0, Math.PI * 2); ctx.fill();
            info.textContent = 'ReLU(' + fmt(x) + ') = ' + fmt(y);
        }
        paint();
    }

    /* ============================================================
     * 第 15 章 · 抬高 / 放大，看 LN 整理
     * ============================================================ */
    function renderLN(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '原始 A 和抬高放大后的 B，整理前差很多；点切换看 LN 整理后，两排几乎一样。'));
        var showB = false;
        var modeBox = el('div', 'btn-group');
        var view = el('div', 'combine-view');
        container.appendChild(modeBox);
        container.appendChild(view);

        var A = [0, 0, 2, 2];
        var B = A.map(function (v) { return v * 2 + 10; });

        function ln(arr) {
            var mean = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
            var variance = arr.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / arr.length;
            var std = Math.sqrt(variance + 1e-5);
            return { mean: mean, std: std, norm: arr.map(function (v) { return (v - mean) / std; }) };
        }

        ['原始 A', '抬高放大后 B（×2+10）'].forEach(function (text, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', text);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                showB = i === 1;
                paint();
                markDone(container);
            });
            modeBox.appendChild(b);
        });
        function paint() {
            var arr = showB ? B : A;
            var r = ln(arr);
            view.innerHTML = '';
            var card = el('div', 'combine-card');
            card.appendChild(el('p', 'combine-head', '整理前 [' + arr.join(', ') + ']'));
            card.appendChild(el('p', 'combine-detail', '平均数 ' + fmt(r.mean) + '，标准差 ' + fmt(r.std)));
            card.appendChild(el('p', 'combine-result', 'LN 整理后 [' + r.norm.map(fmt).join(', ') + ']'));
            view.appendChild(card);
        }
        paint();
    }

    /* ============================================================
     * 第 16 章 · 下三角掩码
     * ============================================================ */
    function renderMask(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint', '点第几行，只亮它能看的前面几格、其余盖住；再点送 softmax，看被盖住的位置分到 0。'));
        var labels = ['〈起〉', '书', '借给', '了'];
        var scores = [
            [1, 0, 0, 0],
            [1, 2, 0, 0],
            [1, 2, 1, 0],
            [1, 2, 1, 2]
        ];
        var row = 0, soft = false;
        var rowBox = el('div', 'btn-group');
        var softBtn = el('button', 'run-btn', '送 softmax');
        var view = el('div', 'mask-view');
        labels.forEach(function (lab, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', '第 ' + (i + 1) + ' 行');
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                rowBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                row = i; soft = false; paint();
            });
            rowBox.appendChild(b);
        });
        var ctr = el('div', 'demo-controls'); ctr.appendChild(softBtn);
        container.appendChild(rowBox); container.appendChild(ctr); container.appendChild(view);
        softBtn.addEventListener('click', function () { soft = true; paint(); markDone(container); });

        function paint() {
            var visible = [];
            for (var c = 0; c < 4; c++) { if (c <= row) visible.push({ c: c, s: scores[row][c] }); }
            var probs = {};
            if (soft) {
                var ex = visible.map(function (v) { return Math.exp(v.s); });
                var sum = ex.reduce(function (a, b) { return a + b; }, 0);
                visible.forEach(function (v, i) { probs[v.c] = ex[i] / sum; });
            }
            view.innerHTML = '';
            var grid = el('div', 'mask-grid');
            for (var c = 0; c < 4; c++) {
                var isVisible = c <= row;
                var cell = el('div', 'mask-cell ' + (isVisible ? 'visible' : 'hidden'));
                if (isVisible) {
                    cell.appendChild(el('b', 'mask-lab', labels[c]));
                    cell.appendChild(el('span', soft ? 'mask-prob' : 'mask-score',
                        soft ? fmt(probs[c]) : scores[row][c]));
                } else {
                    cell.appendChild(el('b', 'mask-lab', '盖住'));
                    cell.appendChild(el('span', soft ? 'mask-prob zero' : 'mask-score', soft ? '0' : '−∞'));
                }
                grid.appendChild(cell);
            }
            view.appendChild(grid);
        }
        paint();
    }

    /* ============================================================
     * 第 18 章 · 候选打分条形图 + 自回归
     * ============================================================ */
    function renderAutoregressive(container) {
        container.classList.add('demo-lab');
        container.appendChild(el('p', 'lab-hint',
            '先在“未训练、校准后”之间切，再点“选下一个词”，看分最高的怎么被接回开头。这就是自回归。'));
        var WORDS = ['买', '妹妹', '了', '。'];
        var MODES = {
            // 未训练：四步最高分依次 买、了、买、了，接成“买了买了”
            raw: {
                steps: [
                    [2.3, 0.9, 0.4, 0.1],
                    [0.8, 0.5, 2.1, 0.2],
                    [1.9, 0.7, 0.6, 0.3],
                    [0.6, 0.8, 2.0, 0.4]
                ],
                note: '未训练：第一步就选错，接成“买了买了”，一步错、步步错。'
            },
            // 校准后：先接妹妹、再接句号，接成“妹妹。”
            trained: {
                steps: [
                    [0.5, 2.2, 0.4, 0.3],
                    [0.4, 0.6, 0.5, 2.1]
                ],
                note: '校准后：正确的“妹妹”排第一，再接句号，接成“妹妹。”。'
            }
        };
        var modeKey = 'raw';
        var step = 0;
        var generated = ['书', '借给', '了'];

        var modeBox = el('div', 'btn-group');
        var sentence = el('p', 'combine-head');
        var noteLine = el('p', 'lab-hint');
        var barBox = el('div', 'bar-view');
        var pickBtn = el('button', 'run-btn', '选下一个词');
        var resetBtn = el('button', 'run-btn btn-secondary', '重新开始');
        var ctr = el('div', 'demo-controls');
        ctr.appendChild(pickBtn); ctr.appendChild(resetBtn);

        [['未训练', 'raw'], ['校准后', 'trained']].forEach(function (pair, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', pair[0]);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                modeKey = pair[1];
                resetProgress();
                markDone(container);
            });
            modeBox.appendChild(b);
        });

        container.appendChild(modeBox);
        container.appendChild(sentence);
        container.appendChild(noteLine);
        container.appendChild(barBox);
        container.appendChild(ctr);

        function resetProgress() {
            step = 0;
            generated = ['书', '借给', '了'];
            pickBtn.disabled = false;
            paint();
        }

        function paint() {
            var mode = MODES[modeKey];
            sentence.textContent = '已生成：' + generated.join(' ');
            noteLine.textContent = mode.note;
            var sc = mode.steps[Math.min(step, mode.steps.length - 1)];
            var max = Math.max.apply(null, sc);
            barBox.innerHTML = '';
            WORDS.forEach(function (w, i) {
                var row = el('div', 'bar-row');
                row.appendChild(el('span', 'bar-word', w));
                var track = el('div', 'bar-track');
                var fill = el('div', 'bar-fill' + (sc[i] === max ? ' top' : ''));
                fill.style.width = (sc[i] / max * 100) + '%';
                track.appendChild(fill);
                row.appendChild(track);
                row.appendChild(el('span', 'bar-score', fmt(sc[i])));
                barBox.appendChild(row);
            });
        }
        pickBtn.addEventListener('click', function () {
            var mode = MODES[modeKey];
            if (step >= mode.steps.length) return;
            var sc = mode.steps[step];
            var best = sc.indexOf(Math.max.apply(null, sc));
            generated.push(WORDS[best]);
            step++;
            if (step >= mode.steps.length) pickBtn.disabled = true;
            paint();
            markDone(container);
        });
        resetBtn.addEventListener('click', resetProgress);
        paint();
    }

    // 演示交互完成后点亮对应站（chapterId、station 都由容器 dataset 传入，不再硬编码）
    function markDone(container) {
        var chapterId = container.dataset.chapter;
        var stationIndex = container.dataset.station;
        if (chapterId && stationIndex != null && typeof markStationDone === 'function') {
            markStationDone(chapterId, Number(stationIndex));
        }
    }

    global.DemoInteract = {
        renderSameToken: renderSameToken,
        renderBPE: renderBPE,
        renderVectorArrow: renderVectorArrow,
        renderEmbeddingMap: renderEmbeddingMap,
        renderCombineSwitch: renderCombineSwitch,
        renderTalkRead: renderTalkRead,
        renderMixSlider: renderMixSlider,
        renderQAngle: renderQAngle,
        renderTemperature: renderTemperature,
        renderQueryKey: renderQueryKey,
        renderQKV: renderQKV,
        renderCandidateFilter: renderCandidateFilter,
        renderScaleSwitch: renderScaleSwitch,
        renderTwoHeads: renderTwoHeads,
        renderResidual: renderResidual,
        renderReLU: renderReLU,
        renderLN: renderLN,
        renderMask: renderMask,
        renderAutoregressive: renderAutoregressive
    };
})(window);
