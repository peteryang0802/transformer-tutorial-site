/* 电路板隐喻（第13-16章硬结构，统一视觉）
 * 残差 = 两条并联电路（原数直达 + 绕路加工，加回时两条都通、覆盖时直达被剪断）
 * ReLU  = 只允许单向通过的二极管（正输入导通、负输入截止）
 * 掩码  = 通往未来位置的导线被剪断（断路，那几格分到 0）
 * 通电导线用流动虚线表现电流，断电导线变暗、留缺口。
 */
(function () {
    'use strict';
    var NS = 'http://www.w3.org/2000/svg';

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }
    function svgEl(name, attrs) {
        var node = document.createElementNS(NS, name);
        attrs = attrs || {};
        Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
        return node;
    }
    function fmt(n) {
        if (Math.abs(n) < 0.005) n = 0;
        return Number(n.toFixed(2)).toString();
    }
    function markDone(container) {
        var ch = container.dataset.chapter, st = container.dataset.station;
        if (ch && st != null && typeof markStationDone === 'function') {
            markStationDone(ch, Number(st));
        }
    }
    function makeSvg(vb, cls) {
        var s = svgEl('svg', { viewBox: vb, preserveAspectRatio: 'xMidYMid meet' });
        s.classList.add('circuit-svg');
        if (cls) s.classList.add(cls);
        return s;
    }

    /* ---------- 第13章：残差并联 ---------- */
    function renderResidual(container) {
        container.classList.add('demo-lab', 'cb-stage');
        container.appendChild(el('p', 'lab-hint',
            '看成两条并联的电路：一条原数直达，一条绕路加工。切“覆盖/加回”，看直达那条线通不通。'));

        var original = [1, 1, 0, 0];
        var change = [0, 0, 1, 1];
        var addBack = false;

        var svg = makeSvg('0 0 360 175');
        container.appendChild(svg);

        /* 固定导线：输入、分叉、汇合、输出、下支路 */
        svg.appendChild(svgEl('path', {
            d: 'M24 85 L60 85 M60 45 L60 125 M300 45 L300 125 M300 85 L336 85',
            class: 'wire'
        }));
        /* 上支路两段（开关在中间） */
        var swLeft = svgEl('path', { d: 'M60 45 L145 45', class: 'wire' });
        var swRight = svgEl('path', { d: 'M155 45 L300 45', class: 'wire' });
        var swArm = svgEl('line', { x1: 145, y1: 45, x2: 158, y2: 45, class: 'wire switch-arm' });
        svg.appendChild(swLeft); svg.appendChild(swRight); svg.appendChild(swArm);
        /* 下支路 + 加工框 */
        svg.appendChild(svgEl('path', { d: 'M60 125 L140 125 M180 125 L300 125', class: 'wire live' }));
        svg.appendChild(svgEl('rect', { x: 140, y: 110, width: 40, height: 30, rx: 5, class: 'chip' }));
        svg.appendChild(svgEl('text', { x: 160, y: 129, class: 'cb-text chip-text' })).textContent = '加工';

        svg.appendChild(svgEl('text', { x: 180, y: 28, class: 'cb-text' })).textContent = '原数直达';
        svg.appendChild(svgEl('text', { x: 205, y: 158, class: 'cb-text' })).textContent = '绕路加工';

        /* 节点 */
        [24, 336].forEach(function (x) {
            svg.appendChild(svgEl('circle', { cx: x, cy: 85, r: 5, class: 'node' }));
        });

        var modeBox = el('div', 'btn-group');
        ['覆盖', '加回'].forEach(function (text, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', text);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                addBack = i === 1; paint(); markDone(container);
            });
            modeBox.appendChild(b);
        });
        container.appendChild(modeBox);
        var out = el('p', 'cb-out');
        container.appendChild(out);

        function paint() {
            swArm.setAttribute('y2', addBack ? 45 : 32);
            swRight.classList.toggle('live', addBack);
            swRight.classList.toggle('dead', !addBack);
            var result = addBack
                ? original.map(function (v, i) { return v + change[i]; })
                : change.slice();
            out.innerHTML =
                (addBack ? '两条线都通，原数保住：' : '直达线断了，原数被顶替：') +
                '<b>[' + result.join(', ') + ']</b>';
        }
        paint();
    }

    /* ---------- 第14章：ReLU 二极管 ---------- */
    function renderReLU(container) {
        container.classList.add('demo-lab', 'cb-stage');
        container.appendChild(el('p', 'lab-hint',
            '中间这个元件叫二极管，只让电流朝一个方向过。正数它导通，负数它截止，输出就是 0。'));

        var x = 1;
        var svg = makeSvg('0 0 360 120');
        container.appendChild(svg);

        svg.appendChild(svgEl('path', { d: 'M20 60 L140 60', class: 'wire live' }));
        /* 二极管：三角形 + 竖线 */
        svg.appendChild(svgEl('polygon', { points: '140,45 140,75 170,60', class: 'diode' }));
        svg.appendChild(svgEl('line', { x1: 178, y1: 45, x2: 178, y2: 75, class: 'diode-bar' }));
        var outWire = svgEl('path', { d: 'M178 60 L340 60', class: 'wire live' });
        svg.appendChild(outWire);

        var range = el('input', 'cb-range');
        range.type = 'range'; range.min = -3; range.max = 3; range.step = 0.1; range.value = 1;
        range.addEventListener('input', function () { x = parseFloat(range.value); paint(); markDone(container); });
        var xlabel = el('p', 'cb-xlabel');
        container.appendChild(xlabel);
        container.appendChild(range);
        var out = el('p', 'cb-out');
        container.appendChild(out);

        function paint() {
            var on = x > 0;
            outWire.classList.toggle('live', on);
            outWire.classList.toggle('dead', !on);
            var y = Math.max(0, x);
            xlabel.textContent = '输入 x = ' + fmt(x) + (on ? '，二极管导通' : '，二极管截止');
            out.innerHTML = 'ReLU(' + fmt(x) + ') = <b>' + fmt(y) + '</b>';
        }
        paint();
    }

    /* ---------- 第16章：掩码断路 ---------- */
    function renderMask(container) {
        container.classList.add('demo-lab', 'cb-stage');
        container.appendChild(el('p', 'lab-hint',
            '通往后面位置的导线整根剪断，电流到不了。选行看哪些线还通，再送 softmax。'));

        var labels = ['〈起〉', '书', '借给', '了'];
        var scores = [[1, 0, 0, 0], [1, 2, 0, 0], [1, 2, 1, 0], [1, 2, 1, 2]];
        var row = 0, soft = false;

        var svg = makeSvg('0 0 360 185');
        container.appendChild(svg);
        var wires = [], cuts = [];
        labels.forEach(function (lab, i) {
            var y = 32 + i * 38;
            var w = svgEl('path', { d: 'M40 ' + y + ' L175 ' + y + ' M185 ' + y + ' L320 ' + y, class: 'wire' });
            var cut = svgEl('g');
            cut.appendChild(svgEl('line', { x1: 178, y1: y - 6, x2: 182, y2: y + 6, class: 'cut-mark' }));
            cut.appendChild(svgEl('line', { x1: 182, y1: y - 6, x2: 178, y2: y + 6, class: 'cut-mark' }));
            svg.appendChild(w); svg.appendChild(cut);
            wires.push(w); cuts.push(cut);
            var t = svgEl('text', { x: 44, y: y - 10, class: 'cb-text' });
            t.textContent = lab;
            svg.appendChild(t);
            var prob = svgEl('text', { x: 285, y: y + 5, class: 'cb-text prob-text' });
            prob.textContent = '';
            svg.appendChild(prob);
        });
        svg.appendChild(svgEl('circle', { cx: 40, cy: 107, r: 5, class: 'node' }));

        var rowBox = el('div', 'btn-group');
        labels.forEach(function (lab, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', '第 ' + (i + 1) + ' 行');
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                rowBox.querySelectorAll('.group-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active'); row = i; soft = false; paint();
            });
            rowBox.appendChild(b);
        });
        var softBtn = el('button', 'run-btn', '送 softmax');
        softBtn.addEventListener('click', function () { soft = true; paint(); markDone(container); });
        var ctr = el('div', 'demo-controls'); ctr.appendChild(softBtn);
        container.appendChild(rowBox); container.appendChild(ctr);

        function paint() {
            var visible = [];
            for (var c = 0; c < 4; c++) {
                var on = c <= row;
                wires[c].classList.toggle('live', on);
                wires[c].classList.toggle('dead', !on);
                cuts[c].style.display = on ? 'none' : '';
                if (on) visible.push({ c: c, s: scores[row][c] });
            }
            var probs = {};
            if (soft) {
                var ex = visible.map(function (v) { return Math.exp(v.s); });
                var sum = ex.reduce(function (a, b) { return a + b; }, 0);
                visible.forEach(function (v, i) { probs[v.c] = ex[i] / sum; });
            }
            wires.forEach(function (w, i) {
                var node = svg.querySelectorAll('.prob-text')[i];
                node.textContent = soft ? (probs[i] != null ? fmt(probs[i]) : '0') : '';
            });
        }
        paint();
    }

    window.CircuitBoard = {
        renderResidual: renderResidual,
        renderReLU: renderReLU,
        renderMask: renderMask
    };
})();
