/* ============================================================
 * 分步交互合集 StepInteract（纯 JS，不依赖 Pyodide）
 * 把静态的高密度计算图/步骤文字，升级成可点、可分步的交互。
 * 复用 style.css 里的 .demo-lab / .run-btn / .btn-group，新增 .sp-* 样式。
 * ============================================================ */
(function (global) {
    'use strict';

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function markDone(container) {
        var chapterId = container.dataset.chapter;
        var stationIndex = container.dataset.station;
        if (chapterId && stationIndex != null && typeof markStationDone === 'function') {
            markStationDone(chapterId, Number(stationIndex));
        }
    }

    // 一组互斥按钮，点哪个哪个高亮，返回当前索引
    function makePicker(container, labels, initial, onPick) {
        var box = el('div', 'btn-group sp-picker');
        var current = initial;
        var btns = labels.map(function (text, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', text);
            if (i === current) b.classList.add('active');
            b.addEventListener('click', function () {
                current = i;
                box.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                onPick(i);
            });
            box.appendChild(b);
            return b;
        });
        container.appendChild(box);
        return {
            el: box,
            get current() { return current; }
        };
    }

    // 一行向量：左边标签，右边若干数字格
    function vecRow(label, arr, cls) {
        var wrap = el('div', 'sp-vec' + (cls ? ' ' + cls : ''));
        if (label) wrap.appendChild(el('span', 'sp-vec-label', label));
        var nums = el('span', 'sp-vec-nums');
        arr.forEach(function (v) { nums.appendChild(el('span', 'sp-num', String(v))); });
        wrap.appendChild(nums);
        return wrap;
    }

    /* ============================================================
     * 通用分步播放器：进度点 + 上一步/下一步，内容由 renderStep 填
     * ============================================================ */
    function makeStepPlayer(container, stepCount, renderStep, onStep) {
        var step = 0;
        var body = el('div', 'sp-body');
        var dots = el('div', 'sp-dots');
        var dotList = [];
        for (var d = 0; d < stepCount; d++) {
            var dot = el('button', 'sp-dot', String(d + 1));
            (function (i) {
                dot.addEventListener('click', function () { go(i); });
            })(d);
            dots.appendChild(dot);
            dotList.push(dot);
        }
        var controls = el('div', 'sp-controls');
        var prev = el('button', 'run-btn btn-secondary sp-prev', '上一步');
        var next = el('button', 'run-btn sp-next', '下一步');
        controls.appendChild(prev);
        controls.appendChild(next);

        function go(i) {
            step = Math.max(0, Math.min(stepCount - 1, i));
            dotList.forEach(function (x, k) { x.classList.toggle('active', k === step); });
            body.innerHTML = '';
            renderStep(body, step);
            prev.disabled = step === 0;
            next.textContent = step === stepCount - 1 ? '从头再看' : '下一步';
            if (onStep) onStep(step);
        }

        prev.addEventListener('click', function () { go(step - 1); });
        next.addEventListener('click', function () {
            if (step === stepCount - 1) go(0);
            else go(step + 1);
        });

        container.appendChild(dots);
        container.appendChild(body);
        container.appendChild(controls);
        go(0);
        return { go: go };
    }

    /* ============================================================
     * 第 3 章 · 位置编码小剧场
     * ============================================================ */
    function renderPositionCode(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '先选排列和要看的位置，再点“下一步”，跟着三步把位置编码加上去。'));

        var TOK = { '小明': [1, 0], '妹妹': [1, 2] };
        var POS = {
            p3: { label: '第 3 处', vec: [0, 0] },
            p20: { label: '第 20 处', vec: [0, 1] }
        };
        var state = { swapped: false, posKey: 'p3' };

        function whoAt(posKey) {
            if (posKey === 'p3') return state.swapped ? '妹妹' : '小明';
            return state.swapped ? '小明' : '妹妹';
        }

        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        makePicker(pickerWrap, ['原排列', '交换两人'], 0, function (i) {
            state.swapped = i === 1;
            paint();
            markDone(container);
        });
        makePicker(pickerWrap, ['看第 3 处', '看第 20 处'], 0, function (i) {
            state.posKey = i === 0 ? 'p3' : 'p20';
            paint();
            markDone(container);
        });

        var playerWrap = el('div', 'sp-player-wrap');
        container.appendChild(playerWrap);
        var player = makeStepPlayer(playerWrap, 3, renderStep, function () { markDone(container); });

        function currentData() {
            var posInfo = POS[state.posKey];
            var who = whoAt(state.posKey);
            var tok = TOK[who];
            var result = tok.map(function (v, i) { return v + posInfo.vec[i]; });
            return { posInfo: posInfo, who: who, tok: tok, pos: posInfo.vec, result: result };
        }

        function renderStep(body, step) {
            var d = currentData();
            if (step === 0) {
                body.appendChild(el('p', 'sp-step-title', '① 看这里是哪个 Token'));
                body.appendChild(el('p', 'sp-big', d.posInfo.label + ' 现在坐的是「' + d.who + '」'));
                body.appendChild(vecRow('按编号查起始向量', d.tok, 'sp-tok'));
            } else if (step === 1) {
                body.appendChild(el('p', 'sp-step-title', '② 看它在第几处'));
                body.appendChild(el('p', 'sp-big', '位置牌留在 ' + d.posInfo.label));
                body.appendChild(vecRow('取出这处的位置向量', d.pos, 'sp-pos'));
            } else {
                body.appendChild(el('p', 'sp-step-title', '③ 两组数对应相加'));
                body.appendChild(vecRow('起始向量', d.tok, 'sp-tok'));
                body.appendChild(vecRow('位置向量', d.pos, 'sp-pos'));
                var calc = el('div', 'sp-calc');
                for (var i = 0; i < d.tok.length; i++) {
                    calc.appendChild(el('span', 'sp-calc-cell',
                        d.tok[i] + ' + ' + d.pos[i] + ' = ' + d.result[i]));
                }
                body.appendChild(calc);
                body.appendChild(vecRow('结果存在这一位置', d.result, 'sp-result'));
            }
        }

        function paint() { player.go(0); }
    }

    /* ============================================================
     * 第 8 章 · 箭头转 90°（Q 不动，只转拿来匹配的箭头）
     * ============================================================ */
    var SVGNS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs) {
        var n = document.createElementNS(SVGNS, tag);
        attrs = attrs || {};
        Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
        return n;
    }

    function renderArrowRotate(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '借给的 Q 不动，点“转动”，看小明、妹妹两支箭头怎么转、分数怎么翻转。'));

        var CX = 160, CY = 150, U = 58;
        var qVec = [0, 1];
        var arrows = [
            { who: '小明', vec: [1, 0], color: '#2563eb', kvec: [0, -1] },
            { who: '妹妹', vec: [-1, -1], color: '#7c3aed', kvec: [-1, 1] }
        ];
        var rotated = false;

        function score(vec) { return qVec[0] * vec[0] + qVec[1] * vec[1]; }
        function curVec(a) { return rotated ? a.kvec : a.vec; }
        function endpoint(vec, isRot) {
            var v = isRot ? [vec[1], -vec[0]] : vec;
            return [CX + v[0] * U, CY - v[1] * U];
        }

        var svg = svgEl('svg', { viewBox: '0 0 320 300', class: 'ar-svg' });

        // 网格
        [100, 220].forEach(function (x) {
            svg.appendChild(svgEl('line', { x1: x, y1: 60, x2: x, y2: 240, class: 'ar-grid' }));
        });
        [92, 208].forEach(function (y) {
            svg.appendChild(svgEl('line', { x1: 70, y1: y, x2: 250, y2: y, class: 'ar-grid' }));
        });
        // 轴
        svg.appendChild(svgEl('line', { x1: 70, y1: CY, x2: 250, y2: CY, class: 'ar-axis' }));
        svg.appendChild(svgEl('line', { x1: CX, y1: 60, x2: CX, y2: 240, class: 'ar-axis' }));
        svg.appendChild(svgEl('text', { x: 246, y: CY + 16, class: 'ar-axis-label' })).textContent = 'x';
        svg.appendChild(svgEl('text', { x: CX + 8, y: 70, class: 'ar-axis-label' })).textContent = 'y';

        // 箭头头 marker（每种颜色一个）
        var defs = svgEl('defs');
        ['#ea580c', '#2563eb', '#7c3aed'].forEach(function (c) {
            var key = c.replace('#', '');
            var marker = svgEl('marker', {
                id: 'ar-head-' + key, markerWidth: 8, markerHeight: 8,
                refX: 6, refY: 3, orient: 'auto', markerUnits: 'userSpaceOnUse'
            });
            marker.appendChild(svgEl('path', { d: 'M0,0 L7,3 L0,6 Z', fill: c }));
            defs.appendChild(marker);
        });
        svg.appendChild(defs);

        // Q 固定箭头
        var qEnd = endpoint(qVec, false);
        svg.appendChild(svgEl('line', {
            x1: CX, y1: CY, x2: qEnd[0], y2: qEnd[1],
            stroke: '#ea580c', 'stroke-width': 3, 'marker-end': 'url(#ar-head-ea580c)'
        }));
        var qLabel = svgEl('text', { x: qEnd[0] + 8, y: qEnd[1] - 6, class: 'ar-label', fill: '#ea580c' });
        qLabel.textContent = '借给的 Q [0,1]';
        svg.appendChild(qLabel);

        // 两支可旋转箭头（线在旋转组里，标签单独不旋转）
        var rotGroups = {};
        var labelNodes = {};
        arrows.forEach(function (a) {
            var g = svgEl('g', { transform: 'rotate(0,' + CX + ',' + CY + ')', class: 'ar-rot' });
            var end = endpoint(a.vec, false);
            g.appendChild(svgEl('line', {
                x1: CX, y1: CY, x2: end[0], y2: end[1],
                stroke: a.color, 'stroke-width': 3,
                'marker-end': 'url(#ar-head-' + a.color.replace('#', '') + ')'
            }));
            svg.appendChild(g);
            rotGroups[a.who] = g;
            var t = svgEl('text', { class: 'ar-label', fill: a.color });
            svg.appendChild(t);
            labelNodes[a.who] = t;
        });

        container.appendChild(svg);

        // 分数面板
        var scorePanel = el('div', 'ar-scores');
        container.appendChild(scorePanel);

        var btn = el('button', 'run-btn ar-turn', '转动 90°');
        container.appendChild(btn);

        function paint() {
            arrows.forEach(function (a) {
                var v = curVec(a);
                var g = rotGroups[a.who];
                g.setAttribute('transform', 'rotate(' + (rotated ? 90 : 0) + ',' + CX + ',' + CY + ')');
                var end = endpoint(a.vec, rotated);
                var t = labelNodes[a.who];
                t.setAttribute('x', end[0] + (end[0] < CX ? -8 : 8));
                t.setAttribute('y', end[1] + (end[1] > CY ? 18 : -8));
                t.setAttribute('text-anchor', end[0] < CX ? 'end' : 'start');
                t.textContent = a.who + ' ' + (rotated ? 'K' : '') + ' [' + v.join(',') + ']';
            });

            scorePanel.innerHTML = '';
            var scores = arrows.map(function (a) {
                return { who: a.who, vec: curVec(a), s: score(curVec(a)), color: a.color };
            });
            var top = Math.max.apply(null, scores.map(function (x) { return x.s; }));
            scores.forEach(function (x) {
                var card = el('div', 'ar-score-card' + (x.s === top ? ' top' : ''));
                card.appendChild(el('p', 'ar-score-name', x.who));
                card.appendChild(el('p', 'ar-score-calc',
                    '0×' + x.vec[0] + ' + 1×' + x.vec[1]));
                card.appendChild(el('p', 'ar-score-val', String(x.s) + ' 分'));
                scorePanel.appendChild(card);
            });
        }

        btn.addEventListener('click', function () {
            rotated = !rotated;
            btn.textContent = rotated ? '转回去' : '转动 90°';
            paint();
            markDone(container);
        });
        paint();
    }

    /* ============================================================
     * 第 14 章 · 真值表：四种情况，点一张看该答什么
     * ============================================================ */
    function renderTruthTable(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '点一张情况卡，看 a、b 对上几条，该答 0 还是 1。'));

        var cases = [
            { a: 0, b: 0 }, { a: 0, b: 1 },
            { a: 1, b: 0 }, { a: 1, b: 1 }
        ];
        var selected = 0;

        var grid = el('div', 'tt-grid');
        var cards = cases.map(function (c, i) {
            var card = el('button', 'tt-card');
            card.appendChild(el('p', 'tt-ab', 'a=' + c.a + '　b=' + c.b));
            card.addEventListener('click', function () {
                selected = i;
                grid.querySelectorAll('.tt-card').forEach(function (x) { x.classList.remove('active'); });
                card.classList.add('active');
                paint();
                markDone(container);
            });
            grid.appendChild(card);
            return card;
        });
        cards[0].classList.add('active');
        container.appendChild(grid);

        var detail = el('div', 'tt-detail');
        container.appendChild(detail);

        function paint() {
            var c = cases[selected];
            var n = c.a + c.b;
            var ans = n === 2 ? 1 : 0;
            detail.innerHTML = '';
            detail.appendChild(el('p', 'tt-line', '妈妈买的 a = ' + c.a + '，蓝封面 b = ' + c.b));
            detail.appendChild(el('p', 'tt-calc', c.a + ' + ' + c.b + ' = 对上 ' + n + ' 条'));
            detail.appendChild(el('p', 'tt-answer ' + (ans === 1 ? 'yes' : 'no'),
                ans === 1 ? '两条都对上，答 1（是）' : '没对上两条，答 0（否）'));
        }
        paint();

        // 先猜后验
        var guess = el('div', 'tt-guess');
        guess.appendChild(el('p', 'tt-guess-q', '先猜：四张卡里，有几张最后答 1？'));
        var gbtns = el('div', 'btn-group');
        var reveal = el('p', 'tt-guess-ans');
        [0, 1, 2, 3].forEach(function (n) {
            var b = el('button', 'run-btn btn-secondary group-btn', String(n));
            b.addEventListener('click', function () {
                gbtns.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                reveal.textContent = '只有 a=1、b=1 那一张答 1，其余三张都答 0。';
                markDone(container);
            });
            gbtns.appendChild(b);
        });
        guess.appendChild(gbtns);
        guess.appendChild(reveal);
        container.appendChild(guess);
    }

    /* ============================================================
     * 第 9 章 · 自注意力三步（31 处里展开 3 处，分步看）
     * ============================================================ */
    function renderAttentionSteps(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '妹妹来查，31 处怎么算。点下一步，三步依次看，每步只看一件事。'));

        var cols = [
            { pos: '第 3 处', who: '小明', num: 3, cls: 'm' },
            { pos: '第 15 处', who: '借给', num: 15, cls: 'j' },
            { pos: '第 20 处', who: '妹妹', num: 20, cls: 's' }
        ];

        var wrap = el('div', 'sp-player-wrap');
        container.appendChild(wrap);
        makeStepPlayer(wrap, 3, function (body, step) {
            if (step === 0) {
                body.appendChild(el('p', 'at-lead', '拿第 20 处「妹妹」的 Q，跟各处的 K 点积'));
                cols.forEach(function (c) {
                    var row = el('div', 'at-row ' + c.cls);
                    row.appendChild(el('span', 'at-pos', c.pos + ' ' + c.who));
                    row.appendChild(el('span', 'at-what', '得到第 ' + c.num + ' 个分数'));
                    body.appendChild(row);
                });
                body.appendChild(el('p', 'at-note', '31 个分数，一起交给 softmax'));
            } else if (step === 1) {
                body.appendChild(el('p', 'at-lead', 'softmax 后，每处分到一个比例'));
                cols.forEach(function (c) {
                    var row = el('div', 'at-row ' + c.cls);
                    row.appendChild(el('span', 'at-pos', c.pos + ' ' + c.who));
                    row.appendChild(el('span', 'at-what', '分到这处的比例'));
                    body.appendChild(row);
                });
                body.appendChild(el('p', 'at-note', '所有比例加起来正好 1'));
            } else {
                body.appendChild(el('p', 'at-lead', '比例乘同一处的 V'));
                cols.forEach(function (c) {
                    var row = el('div', 'at-row ' + c.cls);
                    row.appendChild(el('span', 'at-pos', c.pos + ' ' + c.who));
                    row.appendChild(el('span', 'at-what', '比例 × ' + c.who + '的 V'));
                    body.appendChild(row);
                });
                body.appendChild(el('p', 'at-result', '31 份加起来，记在「妹妹」的第 20 行'));
            }
        }, function () { markDone(container); });
    }

    /* ============================================================
     * 第 16 章 · 一句话出四道接龙题（点题号看开头和答案）
     * ============================================================ */
    function renderFourQuizzes(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '点题号，看这道接龙题给电脑看什么开头、拿哪个词核对。'));
        container.appendChild(el('p', 'fq-sent', '手里已有短句：书 ｜ 借给 ｜ 了 ｜ 妹妹'));

        var quizzes = [
            { head: ['〈起〉'], ans: '书' },
            { head: ['〈起〉', '书'], ans: '借给' },
            { head: ['〈起〉', '书', '借给'], ans: '了' },
            { head: ['〈起〉', '书', '借给', '了'], ans: '妹妹' }
        ];
        var sel = 0;
        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        makePicker(pickerWrap, ['第 1 题', '第 2 题', '第 3 题', '第 4 题'], 0, function (i) {
            sel = i; paint(); markDone(container);
        });

        var detail = el('div', 'fq-detail');
        container.appendChild(detail);

        function paint() {
            var q = quizzes[sel];
            detail.innerHTML = '';
            detail.appendChild(el('p', 'fq-label', '给电脑看的开头'));
            var headBox = el('div', 'fq-tokens');
            q.head.forEach(function (t) { headBox.appendChild(el('span', 'fq-token', t)); });
            detail.appendChild(headBox);
            detail.appendChild(el('p', 'fq-label', '猜完拿什么核对'));
            detail.appendChild(el('p', 'fq-ans', q.ans));
        }
        paint();
    }

    /* ============================================================
     * 第 10 章 · 切换 Q 看分数（同一套系数，Q 一变分数就变）
     * ============================================================ */
    function renderSwitchQ(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '系数没换，切换 Q，看妹妹、封面两处的分数怎么变。'));

        var keys = [
            { who: '妹妹', k: [4, -4] },
            { who: '封面', k: [0, 4] }
        ];
        var qs = [
            { name: '她', q: [1, 0] },
            { name: '蓝色', q: [0, 1] }
        ];
        var qi = 0;
        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        makePicker(pickerWrap, ['她来查 Q=[1,0]', '蓝色来查 Q=[0,1]'], 0, function (i) {
            qi = i; paint(); markDone(container);
        });

        var detail = el('div', 'sq-detail');
        container.appendChild(detail);

        function paint() {
            var q = qs[qi].q;
            detail.innerHTML = '';
            var scored = keys.map(function (k) {
                var s = q[0] * k.k[0] + q[1] * k.k[1];
                return {
                    who: k.who,
                    calc: q[0] + '×' + k.k[0] + ' + ' + q[1] + '×' + k.k[1],
                    s: s
                };
            });
            var top = Math.max.apply(null, scored.map(function (x) { return x.s; }));
            scored.forEach(function (x) {
                var card = el('div', 'sq-card' + (x.s === top ? ' top' : ''));
                card.appendChild(el('p', 'sq-name', x.who));
                card.appendChild(el('p', 'sq-calc', x.calc));
                card.appendChild(el('p', 'sq-val', x.s + ' 分'));
                detail.appendChild(card);
            });
            var winner = scored.filter(function (x) { return x.s === top; })[0].who;
            detail.appendChild(el('p', 'sq-concl', top + ' 分最高，' + winner + ' 排前面'));
        }
        paint();
    }

    /* ============================================================
     * 第 11 章 · K 放大 10 倍（排名照旧，配比大变）
     * ============================================================ */
    function renderScale10(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '小明的 Q 始终是 [1,0]。点放大，看分差和配比怎么变。'));

        var modes = [
            { scores: [0, -1], diff: 1, ratio: [73.1, 26.9] },
            { scores: [0, -10], diff: 10, ratio: [99.9955, 0.0045] }
        ];
        var mi = 0;
        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        makePicker(pickerWrap, ['原矩阵', '放大 10 倍'], 0, function (i) {
            mi = i; paint(); markDone(container);
        });

        var detail = el('div', 'sc-detail');
        container.appendChild(detail);

        function paint() {
            var m = modes[mi];
            detail.innerHTML = '';
            [
                { who: '借给', s: m.scores[0] },
                { who: '妹妹', s: m.scores[1] }
            ].forEach(function (c) {
                var row = el('div', 'sc-row');
                row.appendChild(el('span', 'sc-who', c.who));
                row.appendChild(el('span', 'sc-score', c.s + ' 分'));
                detail.appendChild(row);
            });
            detail.appendChild(el('p', 'sc-diff', '相差 ' + m.diff + ' 分'));
            detail.appendChild(el('p', 'sc-ratio-label', 'softmax 后各取多少'));
            var bar = el('div', 'sc-bar');
            var w1 = el('div', 'sc-bar-a'); w1.style.width = m.ratio[0] + '%';
            var w2 = el('div', 'sc-bar-b'); w2.style.width = m.ratio[1] + '%';
            bar.appendChild(w1); bar.appendChild(w2);
            detail.appendChild(bar);
            var rl = el('div', 'sc-ratio-nums');
            rl.appendChild(el('span', 'sc-ra', '借给 ' + m.ratio[0] + '%'));
            rl.appendChild(el('span', 'sc-rb', '妹妹 ' + m.ratio[1] + '%'));
            detail.appendChild(rl);
            detail.appendChild(el('p', 'sc-concl', '排名照旧，都是借给第一；配比却差很多。'));
        }
        paint();
    }

    /* ============================================================
     * 第 18 章 · 点候选词看那一列怎么打分
     * ============================================================ */
    function renderScoreColumn(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '点候选词，看它那一列系数怎么跟“了”的 4 个数算出一个分。'));

        var words = [
            { who: '买', c4: 0.713, total: 0.929, skip: false },
            { who: '妹妹', c4: 0.073, total: 0.447, skip: false },
            { who: '〈起〉', c4: null, total: null, skip: true }
        ];
        var sel = 0;
        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        makePicker(pickerWrap, ['买', '妹妹', '〈起〉'], 0, function (i) {
            sel = i; paint(); markDone(container);
        });

        var detail = el('div', 'xc-detail');
        container.appendChild(detail);

        function paint() {
            var w = words[sel];
            detail.innerHTML = '';
            if (w.skip) {
                detail.appendChild(el('p', 'xc-line', '〈起〉只用在开头，这回跳过它。'));
                detail.appendChild(el('p', 'xc-note', '在剩下 27 个正文候选里选分最高的。'));
            } else {
                detail.appendChild(el('p', 'xc-line',
                    '“了”的 4 个数，逐个乘上「' + w.who + '」那一列的 4 个系数，再加偏置。'));
                detail.appendChild(el('p', 'xc-c4', '第四项给「' + w.who + '」贡献约 ' + w.c4));
                detail.appendChild(el('p', 'xc-total', '「' + w.who + '」这一列总分约 ' + w.total));
            }
        }
        paint();
        container.appendChild(el('p', 'xc-flow',
            '28 个分一起 softmax，算成 28 个概率，总和为 1。'));
    }

    /* ============================================================
     * 第 5 章 · 接力传话（想法一，两轮把妹妹的线索传到她）
     * ============================================================ */
    function renderRelay(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '点下一步，看妹妹的线索怎么靠接力，两轮传到“她”。'));

        var rows = [
            { n: 20, who: '妹妹' }, { n: 21, who: '逗号' },
            { n: 22, who: '因为' }, { n: 23, who: '她' }
        ];
        var litRow = [0, 2, 3];
        var titles = ['开始时', '第一轮后', '第二轮后'];
        var notes = [
            '妹妹的线索在第 20 行。',
            '因为参考妹妹和逗号，平均加回，线索传到因为。',
            '她参考上一轮算完的因为和逗号，线索传到她。'
        ];

        var wrap = el('div', 'sp-player-wrap');
        container.appendChild(wrap);
        makeStepPlayer(wrap, 3, function (body, step) {
            body.appendChild(el('p', 'rl-title', titles[step]));
            var grid = el('div', 'rl-grid');
            rows.forEach(function (r, i) {
                var row = el('div', 'rl-row' + (i === litRow[step] ? ' lit' : ''));
                row.appendChild(el('span', 'rl-n', '第 ' + r.n + ' 行'));
                row.appendChild(el('span', 'rl-who', r.who));
                grid.appendChild(row);
            });
            body.appendChild(grid);
            body.appendChild(el('p', 'rl-note', notes[step]));
        }, function () { markDone(container); });
    }

    /* ============================================================
     * 第 14 章 · 书这一行在编码器里走完全程（六阶段，多色）
     * ============================================================ */
    function renderEncoderFlow(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '「书」这一行在编码器里怎么走。点下一步，六个阶段依次看，每段一种颜色。'));

        var stages = [
            {
                cls: 'in', title: '① 书的四格输入',
                lines: ['这一行带着四个数进来', '整句 31 行，这是其中第 14 行']
            },
            {
                cls: 'attn', title: '② 多头自注意力',
                heads: [
                    { cls: 'h1', name: '第 1 头', text: '各算本头 Q、K、V，取回两格' },
                    { cls: 'h2', name: '第 2 头', text: '各算本头 Q、K、V，取回两格' }
                ],
                lines: ['两份两格拼成四格，再用输出矩阵组合']
            },
            {
                cls: 'add', title: '③ 第一次加回，再归一化',
                lines: ['逐格加回「书」查找前的四格', '再按本行均值、方差归一化（第 15 篇）']
            },
            {
                cls: 'ffn', title: '④ 交给 FFN 前馈网络',
                flow: ['第一次乘加', '逐格过 ReLU', '第二次乘加'],
                lines: ['算出「书」这一行的四个改变量']
            },
            {
                cls: 'add', title: '⑤ 第二次加回，再归一化',
                lines: ['逐格加回 FFN 收到的那四格', '再归一化一次（第 15 篇）']
            },
            {
                cls: 'out', title: '⑥ 这一层更新后的四格',
                lines: ['「书」走完一层，四格交给下一层']
            }
        ];

        var wrap = el('div', 'sp-player-wrap');
        container.appendChild(wrap);
        makeStepPlayer(wrap, stages.length, function (body, step) {
            var s = stages[step];
            var card = el('div', 'ef-card ' + s.cls);
            card.appendChild(el('p', 'ef-title', s.title));
            if (s.heads) {
                s.heads.forEach(function (h) {
                    var hc = el('div', 'ef-head ' + h.cls);
                    hc.appendChild(el('p', 'ef-head-name', h.name));
                    hc.appendChild(el('p', 'ef-head-text', h.text));
                    card.appendChild(hc);
                });
            }
            if (s.flow) {
                var fc = el('div', 'ef-flow');
                s.flow.forEach(function (f, i) {
                    var stepCls = 'ef-flow-step ' + (f.indexOf('ReLU') >= 0 ? 'red' : 'blue');
                    fc.appendChild(el('span', stepCls, f));
                    if (i < s.flow.length - 1) fc.appendChild(el('span', 'ef-flow-arrow', '→'));
                });
                card.appendChild(fc);
            }
            (s.lines || []).forEach(function (t) { card.appendChild(el('p', 'ef-line', t)); });
            body.appendChild(card);
        }, function () { markDone(container); });
    }

    /* ============================================================
     * 第 15 章 · 走完一层（两次加回、两次层归一化，多色）
     * ============================================================ */
    function renderLayerFlow(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '「书」走完一层，点下一步，看两次加回、两次归一化怎么接。'));

        var stages = [
            { cls: 'in', title: '① 书的四格输入', lines: ['这一行带着四个数进来'] },
            {
                cls: 'attn', title: '② 多头自注意力',
                heads: [
                    { cls: 'h1', name: '第 1 头', text: '各算本头 Q、K、V，取回两格' },
                    { cls: 'h2', name: '第 2 头', text: '各算本头 Q、K、V，取回两格' }
                ],
                lines: ['两份两格拼成四格，输出矩阵组合']
            },
            { cls: 'add', title: '③ 第一次加回', lines: ['逐格加回「书」查找前的四格'] },
            { cls: 'ln', title: '④ 第一次层归一化', lines: ['按本行均值、方差标准化，再逐格乘 γ、加 β'] },
            {
                cls: 'ffn', title: '⑤ 交给 FFN 前馈网络',
                flow: ['第一次乘加', '逐格过 ReLU', '第二次乘加'],
                lines: ['算出「书」这一行的四个改变量']
            },
            { cls: 'add', title: '⑥ 第二次加回', lines: ['逐格加回 FFN 收到的那四格'] },
            { cls: 'ln', title: '⑦ 第二次层归一化', lines: ['再标准化、乘 γ、加 β 一次'] },
            { cls: 'out', title: '⑧ 这一层更新后的四格', lines: ['四格照旧，交给下一层'] }
        ];

        var wrap = el('div', 'sp-player-wrap');
        container.appendChild(wrap);
        makeStepPlayer(wrap, stages.length, function (body, step) {
            var s = stages[step];
            var card = el('div', 'ef-card ' + s.cls);
            card.appendChild(el('p', 'ef-title', s.title));
            if (s.heads) {
                s.heads.forEach(function (h) {
                    var hc = el('div', 'ef-head ' + h.cls);
                    hc.appendChild(el('p', 'ef-head-name', h.name));
                    hc.appendChild(el('p', 'ef-head-text', h.text));
                    card.appendChild(hc);
                });
            }
            if (s.flow) {
                var fc = el('div', 'ef-flow');
                s.flow.forEach(function (f, i) {
                    fc.appendChild(el('span', 'ef-flow-step ' + (f.indexOf('ReLU') >= 0 ? 'red' : 'blue'), f));
                    if (i < s.flow.length - 1) fc.appendChild(el('span', 'ef-flow-arrow', '→'));
                });
                card.appendChild(fc);
            }
            (s.lines || []).forEach(function (t) { card.appendChild(el('p', 'ef-line', t)); });
            body.appendChild(card);
        }, function () { markDone(container); });
    }

    /* ============================================================
     * 第 11 章 · 31 个位置各走同样四步（四环节四色）
     * ============================================================ */
    function renderFourSteps(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '选一行看谁来查，再点下一步，四个环节各走一遍，每环一种颜色。'));

        var rows = [
            { who: '第3处 小明', z: 'Z 第3行' },
            { who: '第20处 妹妹', z: 'Z 第20行' },
            { who: '第31处 句号', z: 'Z 第31行' }
        ];
        var steps = [
            { cls: 'match', title: '① 匹配', text: '用本行 Q 匹配 31 处 K（含自己），得 31 个匹配分数' },
            { cls: 'scale', title: '② 缩放', text: '31 个分数都除以 <span class="mi">√2</span>，把差距收一收' },
            { cls: 'softmax', title: '③ 算比例', text: '逐行 softmax，本行 31 个比例合计为 1' },
            { cls: 'fetch', title: '④ 取回', text: '按比例把 31 处 V 相加，合成这一行' }
        ];

        var rowIdx = 1;
        var zline = el('p', 'fs-zline', '结果存到：' + rows[1].z);
        container.appendChild(zline);
        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        makePicker(pickerWrap, rows.map(function (r) { return r.who; }), 1, function (i) {
            rowIdx = i;
            zline.textContent = '结果存到：' + rows[i].z;
            markDone(container);
        });

        var wrap = el('div', 'sp-player-wrap');
        container.appendChild(wrap);
        makeStepPlayer(wrap, steps.length, function (body, step) {
            var s = steps[step];
            var card = el('div', 'fs-card ' + s.cls);
            card.appendChild(el('p', 'fs-title', s.title));
            var textP = el('p', 'fs-text');
            textP.innerHTML = s.text;
            card.appendChild(textP);
            body.appendChild(card);
        }, function () { markDone(container); });
    }

    /* ============================================================
     * 第 11 章 · 格数越多越容易偏（单回三步 + 两万回统计，替换 img45）
     * ============================================================ */
    function renderGridStat(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '先看一回怎么算、怎么记，再选格数看两万回里“几乎全用一处”出现多少次。'));

        container.appendChild(el('h3', 'gst-part-title', '一、先看一回怎么算、怎么记'));
        var singleSteps = [
            function (body) {
                body.appendChild(el('p', 'gst-text', '这一回随机取数，每格只取 −1、0、1：'));
                var grid = el('div', 'gst-vecgrid');
                grid.innerHTML =
                    '<div class="gst-vrow q"><span class="gst-vtag">Q</span><span class="gst-vnums"><b>1</b><b>1</b></span></div>' +
                    '<div class="gst-vrow k1"><span class="gst-vtag">K<sub>1</sub></span><span class="gst-vnums"><b>1</b><b>0</b></span></div>' +
                    '<div class="gst-vrow k2"><span class="gst-vtag">K<sub>2</sub></span><span class="gst-vnums"><b>−1</b><b>−1</b></span></div>';
                body.appendChild(grid);
            },
            function (body) {
                body.appendChild(el('p', 'gst-text', '对应格相乘再加起来，算两个匹配分：'));
                var calc = el('div', 'gst-calc');
                calc.innerHTML =
                    '<p class="gst-eq"><span class="gst-eqtag k1">Q·K<sub>1</sub></span><span class="gst-eqbody">1×1 + 1×0 = <b class="gst-ans">1</b></span></p>' +
                    '<p class="gst-eq"><span class="gst-eqtag k2">Q·K<sub>2</sub></span><span class="gst-eqbody">1×(−1) + 1×(−1) = <b class="gst-ans">−2</b></span></p>';
                body.appendChild(calc);
            },
            function (body) {
                body.appendChild(el('p', 'gst-text', 'softmax 把两个分换成比例：'));
                var sm = el('div', 'gst-sm');
                sm.innerHTML =
                    '<div class="gst-smrow"><span class="gst-smwho k1">K<sub>1</sub></span><span class="gst-smtrack"><span class="gst-smfill blue" style="width:95.3%"></span></span><b class="gst-smnum">95.3%</b></div>' +
                    '<div class="gst-smrow"><span class="gst-smwho k2">K<sub>2</sub></span><span class="gst-smtrack"><span class="gst-smfill orange" style="width:4.7%"></span></span><b class="gst-smnum">4.7%</b></div>';
                body.appendChild(sm);
                body.appendChild(el('p', 'gst-flag', '第一处超过 95%，这一回记 1 次 ✓'));
            }
        ];
        var playerWrap = el('div', 'sp-player-wrap');
        container.appendChild(playerWrap);
        makeStepPlayer(playerWrap, singleSteps.length, function (body, step) {
            singleSteps[step](body);
        }, function () { markDone(container); });

        container.appendChild(el('h3', 'gst-part-title', '二、每种格数各算 20,000 回'));
        container.appendChild(el('p', 'gst-text',
            '原有格子的数保留，新加的格子仍只取 −1、0、1。选格数，看某一处拿走超过 95% 的次数：'));

        var stats = [
            { g: '2 格', cnt: '1,128 回', pct: 5.6, cls: 'low' },
            { g: '8 格', cnt: '6,899 回', pct: 34.5, cls: 'mid' },
            { g: '128 格', cnt: '16,328 回', pct: 81.6, cls: 'high' }
        ];
        var statWrap = el('div', 'gst-statwrap');
        container.appendChild(statWrap);
        var pickerWrap = el('div', 'sp-picker-wrap');
        statWrap.appendChild(pickerWrap);
        var statBody = el('div', 'gst-statbody');
        statWrap.appendChild(statBody);

        function renderStat(i) {
            var s = stats[i];
            statBody.innerHTML =
                '<div class="gst-statcard ' + s.cls + '">' +
                '<p class="gst-statg">每个向量 ' + s.g + '</p>' +
                '<p class="gst-statcnt">超过 95%：<b>' + s.cnt + '</b></p>' +
                '<div class="gst-bartrack"><span class="gst-barfill" style="width:' + s.pct + '%"></span></div>' +
                '<p class="gst-statpct">占两万回 <b>' + s.pct + '%</b></p></div>';
            markDone(container);
        }
        makePicker(pickerWrap, stats.map(function (s) { return s.g; }), 0, renderStat);
        renderStat(0);

        container.appendChild(el('p', 'gst-concl',
            '格数越多，“几乎全用一处”越常见；这里的百分数统计的是查询次数，不是某一处的取用比例。'));
    }

    /* ============================================================
     * 第 9 章 · X→QKV→加回 完整数据流（跟着妹妹第 20 行走，五步）
     * ============================================================ */
    function renderDataFlow(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '跟着妹妹的第 20 行走一遍：一个 X 怎么派三个用场，最后又怎么加回来。点下一步。'));

        // 五个环节的彩色标签，顶部流水线随步骤高亮
        var stages = [
            { key: 'x', name: '输入 X 分三路', cls: 'df-x' },
            { key: 'dot', name: 'Q 点积 31 处 K', cls: 'df-dot' },
            { key: 'sm', name: 'softmax 出比例', cls: 'df-sm' },
            { key: 'v', name: '按比例合并 V', cls: 'df-v' },
            { key: 'add', name: '加回本行', cls: 'df-add' }
        ];
        var chain = el('div', 'df-chain');
        stages.forEach(function (s, i) {
            var node = el('div', 'df-node ' + s.cls, s.name);
            node.dataset.idx = i;
            chain.appendChild(node);
            if (i < stages.length - 1) chain.appendChild(el('span', 'df-arrow', '→'));
        });
        container.appendChild(chain);

        var wrap = el('div', 'sp-player-wrap');
        container.appendChild(wrap);

        function threeWay(body) {
            body.appendChild(el('p', 'df-text', '妹妹这一行的输入 X，同时派三个用场：'));
            var cards = el('div', 'df-cards');
            var items = [
                { cls: 'q', tag: 'Q', desc: '直接用原数，带去发问' },
                { cls: 'k', tag: 'K', desc: '另算：[a,b] → [b,−a]，供辨认' },
                { cls: 'v', tag: 'V', desc: '直接用原数，留着被取回' }
            ];
            items.forEach(function (it) {
                var c = el('div', 'df-card df-' + it.cls);
                c.appendChild(el('span', 'df-card-tag', it.tag));
                c.appendChild(el('p', 'df-card-desc', it.desc));
                cards.appendChild(c);
            });
            body.appendChild(cards);
        }

        var steps = [
            function (body) {
                threeWay(body);
                body.appendChild(el('p', 'df-note', '同一个 X，没动它，只是分了三条路。'));
            },
            function (body) {
                body.appendChild(el('p', 'df-text', '拿妹妹的 Q，跟 31 处 K 逐个点积：'));
                body.appendChild(el('div', 'df-flowline df-dot', 'Q（蓝） × 31 处 K（紫） → 31 个匹配分'));
                body.appendChild(el('p', 'df-note', '含妹妹自己那一处，一共 31 个分。'));
            },
            function (body) {
                body.appendChild(el('p', 'df-text', '31 个分一起送 softmax：'));
                body.appendChild(el('div', 'df-flowline df-sm', '31 个分 → 31 个比例，全部加起来正好 1'));
                body.appendChild(el('p', 'df-note', '分高的那处，分到的比例大。'));
            },
            function (body) {
                body.appendChild(el('p', 'df-text', '每个比例乘同一处的 V，再全加起来：'));
                body.appendChild(el('div', 'df-flowline df-v', '比例 × 各处 V（绿），31 份合并成一个向量'));
                body.appendChild(el('p', 'df-note', '这就是妹妹这一回查回来的数。'));
            },
            function (body) {
                body.appendChild(el('p', 'df-text', '查回来的向量，加回妹妹原来的输入：'));
                body.appendChild(el('div', 'df-flowline df-add', '原输入 X + 查回向量 → 更新第 20 行'));
                body.appendChild(el('p', 'df-note', '这一步就是残差连接，原数没丢，新线索补进来。'));
            }
        ];

        makeStepPlayer(wrap, steps.length, function (body, step) {
            // 顶部流水线高亮当前环节
            chain.querySelectorAll('.df-node').forEach(function (n, i) {
                n.classList.toggle('on', i === step);
            });
            steps[step](body);
        }, function () { markDone(container); });
    }

    /* ============================================================
     * 第 12 章 · 矩阵地图（点矩阵看名字、形状、用途，也可分步）
     * ============================================================ */
    function renderMatrixMap(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '矩阵一多容易记混。点任意一块，看它的名字、形状（几行几列）和在干嘛。'));

        // 三阶段的矩阵节点，按 E/P→两头→拼接 组织
        var nodes = [
            { id: 'E', name: 'E', shape: '27 × 4', stage: 1, desc: '起始向量表，按 Token 编号查取' },
            { id: 'P', name: 'P', shape: '31 × 4', stage: 1, desc: '位置表，记每个位置的位置编码' },
            { id: 'X', name: 'X', shape: '31 × 4', stage: 1, desc: '输入：查到的起始向量加位置' },
            { id: 'q1', name: 'Q', shape: '31 × 2', stage: 2, head: 1, desc: '头1 的问题，每行两格' },
            { id: 'k1', name: 'K', shape: '31 × 2', stage: 2, head: 1, desc: '头1 供辨认的线索' },
            { id: 'v1', name: 'V', shape: '31 × 2', stage: 2, head: 1, desc: '头1 被取回的资料' },
            { id: 'z1', name: 'Z⁽¹⁾', shape: '31 × 2', stage: 2, head: 1, desc: '头1 查回的结果' },
            { id: 'q2', name: 'Q', shape: '31 × 2', stage: 2, head: 2, desc: '头2 的问题' },
            { id: 'k2', name: 'K', shape: '31 × 2', stage: 2, head: 2, desc: '头2 供辨认的线索' },
            { id: 'v2', name: 'V', shape: '31 × 2', stage: 2, head: 2, desc: '头2 被取回的资料' },
            { id: 'z2', name: 'Z⁽²⁾', shape: '31 × 2', stage: 2, head: 2, desc: '头2 查回的结果' },
            { id: 'WO', name: 'W_O', nameHtml: '<span class="mi">W<sub>O</sub></span>', shape: '4 × 4', stage: 3, desc: '输出系数，把拼接结果重新组合' },
            { id: 'Z', name: 'Z', shape: '31 × 4', stage: 3, desc: '组合后的最终结果，每行四格' }
        ];

        var stageTitles = ['1 · 准备输入', '2 · 两个头各算各的', '3 · 拼接再组合'];
        var map = el('div', 'mm-map');
        for (var st = 1; st <= 3; st++) {
            var block = el('div', 'mm-stage mm-stage-' + st);
            block.appendChild(el('p', 'mm-stage-title', stageTitles[st - 1]));
            var grid = el('div', 'mm-grid');
            nodes.filter(function (n) { return n.stage === st; }).forEach(function (n) {
                var b = el('button', 'mm-node' + (n.head ? ' mm-head-' + n.head : ''));
                var nodeName = el('b', 'mm-node-name');
                if (n.nameHtml) { nodeName.innerHTML = n.nameHtml; } else { nodeName.textContent = n.name; }
                b.appendChild(nodeName);
                b.appendChild(el('span', 'mm-node-shape', n.shape));
                b.addEventListener('click', function () {
                    map.querySelectorAll('.mm-node').forEach(function (x) { x.classList.remove('on'); });
                    b.classList.add('on');
                    info.innerHTML = '';
                    var infoName = el('p', 'mm-info-name');
                    if (n.nameHtml) { infoName.innerHTML = n.nameHtml + '　' + n.shape; }
                    else { infoName.textContent = n.name + '　' + n.shape; }
                    info.appendChild(infoName);
                    info.appendChild(el('p', 'mm-info-desc', n.desc));
                    markDone(container);
                });
                grid.appendChild(b);
            });
            block.appendChild(grid);
            map.appendChild(block);
        }
        container.appendChild(map);

        var info = el('div', 'mm-info');
        info.appendChild(el('p', 'mm-info-empty', '点上面的矩阵块，这里显示它的说明。'));
        container.appendChild(info);
    }

    /* ============================================================
     * 第 7 章 · softmax 计算链（匹配值→取指数→除总和→乘V，四步）
     * ============================================================ */
    function renderSoftmaxChain(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '匹配值怎么一步步变成取回的数？点下一步，四步看全。'));

        var rows = [
            { who: '妹妹', cls: 'm', vals: ['4', '54.5982', '0.9820', '3.928'] },
            { who: '封面', cls: 'c', vals: ['0', '1', '0.0180', '0.072'] }
        ];
        var labels = ['匹配值', '取指数', '除以总和', '乘 V 后'];
        var wrap = el('div', 'sp-player-wrap');
        container.appendChild(wrap);

        makeStepPlayer(wrap, 4, function (body, step) {
            body.appendChild(el('p', 'sx-lead', labels[step]));
            if (step === 0) {
                body.appendChild(el('p', 'sx-note', 'Q 点积得到的两个匹配分，还不是比例。'));
            } else if (step === 1) {
                body.appendChild(el('p', 'sx-note', '各取指数：e⁴≈54.5982，e⁰＝1，都变成正数。'));
            } else if (step === 2) {
                body.appendChild(el('p', 'sx-note', '总和 55.5982，各自除以总和，两个比例加起来 1。'));
            } else {
                body.appendChild(el('p', 'sx-note', '比例乘同一处 V 的两格，再相加，取回 [3.928, 0.072]。'));
            }
            var table = el('div', 'sx-table');
            rows.forEach(function (r) {
                var line = el('div', 'sx-row sx-' + r.cls);
                line.appendChild(el('span', 'sx-who', r.who));
                line.appendChild(el('b', 'sx-val', r.vals[step]));
                table.appendChild(line);
            });
            body.appendChild(table);
            // 最终步显示比例条
            if (step === 2) {
                var bar = el('div', 'sx-bars');
                bar.innerHTML =
                    '<div class="sx-barrow"><span class="sx-barwho m">妹妹</span><span class="sx-bartrack"><span class="sx-barfill m" style="width:98.2%"></span></span><b>98.2%</b></div>' +
                    '<div class="sx-barrow"><span class="sx-barwho c">封面</span><span class="sx-bartrack"><span class="sx-barfill c" style="width:1.8%"></span></span><b>1.8%</b></div>';
                body.appendChild(bar);
            }
        }, function () { markDone(container); });
    }

    /* ============================================================
     * 第 11 章 · 分差起伏 + 缩放前后（picker 切换，替代 img46/47）
     * ============================================================ */
    function renderSpreadScale(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '先看格数多了分差怎么散开，再看缩放怎么把差距压下来。'));

        // 一、分差起伏
        container.appendChild(el('h3', 'ss-part-title', '一、格数越多，分差起伏越大'));
        var spreads = [
            { g: '2 格', mult: '1 倍', width: 18, cls: 'low' },
            { g: '8 格', mult: '约 2 倍', width: 40, cls: 'mid' },
            { g: '128 格', mult: '约 8 倍', width: 86, cls: 'high' }
        ];
        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        var spreadBody = el('div', 'ss-body');
        container.appendChild(spreadBody);

        function paintSpread(i) {
            var s = spreads[i];
            spreadBody.innerHTML =
                '<div class="ss-card ss-' + s.cls + '">' +
                '<p class="ss-g">每个向量 ' + s.g + '</p>' +
                '<p class="ss-mult">整批分差起伏：<b>' + s.mult + '</b></p>' +
                '<div class="ss-track"><span class="ss-fill" style="width:' + s.width + '%"></span></div>' +
                '</div>';
            markDone(container);
        }
        makePicker(pickerWrap, spreads.map(function (s) { return s.g; }), 0, paintSpread);
        paintSpread(0);

        // 二、缩放前后对照
        container.appendChild(el('h3', 'ss-part-title', '二、128 格两万回：缩放前后对照'));
        var scaleNote = el('p', 'ss-note');
        scaleNote.innerHTML = 'QK 数字不动，只把匹配分除以 <span class="mi">√d</span>，看“几乎全用一处”的变化：';
        container.appendChild(scaleNote);
        var beforeAfter = el('div', 'ss-ba');
        beforeAfter.innerHTML =
            '<div class="ss-ba-card before"><b>缩放前</b><p>分差大，容易全用一处</p><span class="ss-ba-num">81.6%</span></div>' +
            '<span class="ss-ba-arrow">→</span>' +
            '<div class="ss-ba-card after"><b>缩放后</b><p>差距压下，配比回到柔和</p><span class="ss-ba-num">明显减少</span></div>';
        container.appendChild(beforeAfter);
    }

    /* ============================================================
     * 第 15 章 · 三排 A/B/C 标准化（picker，突出 C 摆放不同）
     * ============================================================ */
    function renderThreeRow(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '三排的平均数、标准差都一样，只有摆放位置不同。切换看标准化后，A、B 对上、C 仍分得开。'));

        var rows = [
            { label: 'A', before: [0, 0, 2, 2], mean: 1, std: 1, after: [-1, -1, 1, 1], cls: 'a' },
            { label: 'B', before: [10, 10, 14, 14], mean: 12, std: 2, after: [-1, -1, 1, 1], cls: 'b' },
            { label: 'C', before: [0, 2, 0, 2], mean: 1, std: 1, after: [-1, 1, -1, 1], cls: 'c' }
        ];
        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        var body = el('div', 'nr-body');
        container.appendChild(body);

        function nums(arr, cls) {
            var box = el('div', 'nr-nums');
            arr.forEach(function (v) { box.appendChild(el('span', 'nr-num ' + cls, String(v))); });
            return box;
        }
        function paint(i) {
            var r = rows[i];
            body.innerHTML = '';
            var card = el('div', 'nr-card nr-' + r.cls);
            card.appendChild(el('p', 'nr-line-label', '整理前（平均 ' + r.mean + '，标准差 ' + r.std + '）'));
            card.appendChild(nums(r.before, 'before'));
            card.appendChild(el('p', 'nr-line-label', '标准化后'));
            card.appendChild(nums(r.after, 'after'));
            body.appendChild(card);
            if (r.cls === 'c') {
                body.appendChild(el('p', 'nr-flag', 'C 的高低放在不同位置，标准化后和 A、B 不一样，仍分得开。'));
            } else {
                body.appendChild(el('p', 'nr-flag', '标准化后 A、B 都是 [-1,-1,1,1]，整体抬高和放大被剔除了。'));
            }
            markDone(container);
        }
        makePicker(pickerWrap, ['A 排', 'B 排', 'C 排'], 0, paint);
        paint(0);
    }

    /* ============================================================
     * 第 16 章 · 下三角逐行点亮（标准网格，替代 img79）
     * ============================================================ */
    function renderTriangle(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '逐行看：第 i 行只准看自己和前面，允许的格子正好组成一个下三角。'));

        var labels = ['〈起〉', '书', '借给', '了'];
        var nextWord = ['书', '借给', '了', '妹妹'];
        var grid = el('div', 'tg-grid');
        // 左上角占位
        grid.appendChild(el('span', 'tg-corner', '轮到哪行'));
        labels.forEach(function (l) { grid.appendChild(el('span', 'tg-col', l)); });
        var cells = [];
        labels.forEach(function (rowLab, r) {
            grid.appendChild(el('span', 'tg-row', rowLab));
            labels.forEach(function (colLab, c) {
                var cell = el('span', 'tg-cell', c <= r ? '可以看' : '挡住');
                grid.appendChild(cell);
                cells.push({ r: r, c: c, el: cell });
            });
        });
        container.appendChild(grid);

        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        var note = el('p', 'tg-note');
        container.appendChild(note);

        function paint(r) {
            cells.forEach(function (x) {
                var visible = x.c <= r && x.r <= r;
                x.el.classList.toggle('see', x.c <= x.r && x.r === r);
                x.el.classList.toggle('dim', x.r !== r);
            });
            note.textContent = '第 ' + (r + 1) + ' 行（' + labels[r] + '）能看前面 ' + (r + 1) +
                '格，下一块核对：' + nextWord[r];
            markDone(container);
        }
        makePicker(pickerWrap, labels.map(function (l, i) { return '第 ' + (i + 1) + ' 行'; }), 0, paint);
        paint(0);
    }

    /* ============================================================
     * 第 2 章 · 编号查找（点词，表 E 高亮对应行、取出向量）
     * ============================================================ */
    function renderLookupTable(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '点一个词，看它的编号怎么在表 E 里找到对应行，取出那一行数字。'));

        var items = [
            { who: '小明', id: 2, vec: [1, 0] },
            { who: '故事', id: 11, vec: [1, 1] },
            { who: '妹妹', id: 17, vec: [1, 2] }
        ];
        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);

        var table = el('div', 'lk-table');
        table.appendChild(el('p', 'lk-head', '起始向量表 E（这里只画相关行）'));
        var rows = items.map(function (it) {
            var r = el('div', 'lk-row');
            r.appendChild(el('span', 'lk-id', String(it.id)));
            r.appendChild(el('span', 'lk-who', it.who));
            var nums = el('span', 'lk-vec');
            it.vec.forEach(function (v) { nums.appendChild(el('b', 'lk-num', String(v))); });
            r.appendChild(nums);
            table.appendChild(r);
            return r;
        });
        container.appendChild(table);
        var out = el('p', 'lk-out');
        container.appendChild(out);

        function paint(i) {
            rows.forEach(function (r, k) { r.classList.toggle('on', k === i); });
            out.textContent = '编号 ' + items[i].id + ' 找到「' + items[i].who +
                '」，取出 [' + items[i].vec.join(',') + '] 参与计算。';
            markDone(container);
        }
        makePicker(pickerWrap, items.map(function (x) { return x.who; }), 0, paint);
        paint(0);
    }

    /* ============================================================
     * 第 10 章 · 一套系数 31 处共用（点位置，看同一张 W_K）
     * ============================================================ */
    function renderSharedWeight(container) {
        container.classList.add('demo-lab', 'sp-lab');
        var wK = '<span class="mi">W<sub>K</sub></span>';
        var hint = el('p', 'lab-hint');
        hint.innerHTML = '权重矩阵只有一张，31 个位置都用它。点位置，看同一张 ' + wK + ' 怎么轮到谁都不变。';
        container.appendChild(hint);

        // 一张共用的 W_K
        var wbox = el('div', 'sw-weight');
        var label = el('p', 'sw-weight-label');
        label.innerHTML = '共用的 ' + wK + '（2×2）';
        wbox.appendChild(label);
        var wgrid = el('div', 'sw-grid');
        ['1', '−1', '0', '1'].forEach(function (v) {
            wgrid.appendChild(el('span', 'sw-cell', v));
        });
        wbox.appendChild(wgrid);
        container.appendChild(wbox);

        // 位置（只画 5 个代表，实际 31 处）
        var pos = ['第3处', '第10处', '第15处', '第20处', '第27处'];
        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        var note = el('p', 'sw-note');
        container.appendChild(note);

        function writeNote(i) {
            note.innerHTML = pos[i] + ' 用的还是上面这张 ' + wK +
                '，系数没换，只是输入不同、算出的 K 不同。';
        }
        makePicker(pickerWrap, pos, 0, function (i) {
            writeNote(i);
            markDone(container);
        });
        writeNote(0);
    }

    /* ============================================================
     * 第 10 章 · Q/K/V 三矩阵（点一张，看用途，替代 img40）
     * ============================================================ */
    function renderThreeMatrix(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            'Q、K、V 三种用途各配一张系数矩阵，句中所有位置共用。点一张看它管什么。'));

        var mats = [
            { sub: 'Q', cls: 'q', use: '把输入加工成 Query，带着问题去查。' },
            { sub: 'K', cls: 'k', use: '把输入加工成 Key，等着被别人点积匹配。' },
            { sub: 'V', cls: 'v', use: '把输入加工成 Value，最后按比例取用的就是它。' }
        ];
        function wHtml(sub) {
            return '<span class="mi">W<sub>' + sub + '</sub></span>';
        }
        var cards = mats.map(function (m) {
            var c = el('div', 'tm-card tm-' + m.cls);
            var name = el('b', 'tm-name');
            name.innerHTML = wHtml(m.sub);
            c.appendChild(name);
            c.appendChild(el('span', 'tm-mini', '2×2'));
            return c;
        });
        var grid = el('div', 'tm-grid');
        cards.forEach(function (c) { grid.appendChild(c); });
        container.appendChild(grid);
        var info = el('p', 'tm-info');
        container.appendChild(info);

        cards.forEach(function (c, i) {
            c.addEventListener('click', function () {
                cards.forEach(function (x) { x.classList.toggle('on', x === c); });
                info.innerHTML = wHtml(mats[i].sub) + '：' + mats[i].use;
                markDone(container);
            });
        });
        cards[0].classList.add('on');
        info.innerHTML = wHtml(mats[0].sub) + '：' + mats[0].use;
    }

    /* ============================================================
     * 第 13 章 · 顶替 vs 加回（两回对照，替代 img57）
     * ============================================================ */
    function renderResidualAdd(container) {
        container.classList.add('demo-lab', 'sp-lab');
        container.appendChild(el('p', 'lab-hint',
            '两回输入只差第二格，改动量都是 [0,0,1,1]。看顶替和加回，哪个保住了原来的差别。'));

        var rounds = [
            { label: '第 1 回', input: [1, 1, 0, 0] },
            { label: '第 2 回', input: [1, 0, 0, 0] }
        ];
        var delta = [0, 0, 1, 1];
        var pickerWrap = el('div', 'sp-picker-wrap');
        container.appendChild(pickerWrap);
        var body = el('div', 'ra-body');
        container.appendChild(body);

        function numLine(label, arr, cls) {
            var line = el('div', 'ra-line');
            line.appendChild(el('span', 'ra-line-label', label));
            var box = el('span', 'ra-nums');
            arr.forEach(function (v) { box.appendChild(el('b', 'ra-num ' + cls, String(v))); });
            line.appendChild(box);
            return line;
        }
        function paint(i) {
            var r = rounds[i];
            var replace = delta;
            var add = r.input.map(function (v, k) { return v + delta[k]; });
            body.innerHTML = '';
            body.appendChild(numLine('输入', r.input, 'in'));
            body.appendChild(numLine('改动量', delta, 'delta'));
            body.appendChild(numLine('顶替（错）', replace, 'bad'));
            body.appendChild(numLine('加回（对）', add, 'good'));
            body.appendChild(el('p', 'ra-flag',
                '顶替两回第二格都交 1，原来的差别没了；加回第 1 回 2、第 2 回 1，差异保住了。'));
            markDone(container);
        }
        makePicker(pickerWrap, rounds.map(function (x) { return x.label; }), 0, paint);
        paint(0);
    }

    global.StepInteract = {
        renderPositionCode: renderPositionCode,
        renderArrowRotate: renderArrowRotate,
        renderTruthTable: renderTruthTable,
        renderAttentionSteps: renderAttentionSteps,
        renderFourQuizzes: renderFourQuizzes,
        renderSwitchQ: renderSwitchQ,
        renderScale10: renderScale10,
        renderScoreColumn: renderScoreColumn,
        renderRelay: renderRelay,
        renderEncoderFlow: renderEncoderFlow,
        renderLayerFlow: renderLayerFlow,
        renderFourSteps: renderFourSteps,
        renderGridStat: renderGridStat,
        renderDataFlow: renderDataFlow,
        renderMatrixMap: renderMatrixMap,
        renderSoftmaxChain: renderSoftmaxChain,
        renderSpreadScale: renderSpreadScale,
        renderThreeRow: renderThreeRow,
        renderTriangle: renderTriangle,
        renderLookupTable: renderLookupTable,
        renderSharedWeight: renderSharedWeight,
        renderThreeMatrix: renderThreeMatrix,
        renderResidualAdd: renderResidualAdd
    };
})(window);
