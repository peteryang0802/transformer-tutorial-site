/* ============================================================
 * 第 8 坎：层归一化演示
 * 一组乱数，归一化到均值 0、标准差 1
 * ============================================================ */
var NormDemo = (function () {
    'use strict';

    var RAW = [2.0, -1.5, 3.2, 0.1, -0.8];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }
    function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
    function std(a, mu) {
        var v = a.reduce(function (acc, x) { return acc + (x - mu) * (x - mu); }, 0) / a.length;
        return Math.sqrt(v);
    }

    function render(container) {
        container.innerHTML = '';
        makeIdentityTag(container, 'real', '真在算均值、标准差，再把每个数归一化。');
        var normalized = false;

        var box = el('div', 'norm-box');
        var stat = el('p', 'norm-stat', '');
        var btns = el('div', 'btn-group');
        var btn = el('button', 'run-btn', '归一化');
        btn.type = 'button';
        var resetBtn = el('button', 'run-btn btn-secondary', '重置');
        resetBtn.type = 'button';

        function paint() {
            var data = RAW;
            if (normalized) {
                var mu = mean(RAW), sd = std(RAW, mu);
                data = RAW.map(function (x) { return (x - mu) / sd; });
            }
            var mu2 = mean(data), sd2 = std(data, mu2);
            var maxAbs = Math.max.apply(null, data.map(Math.abs));

            box.innerHTML = '';
            data.forEach(function (x) {
                var row = el('div', 'norm-row');
                row.appendChild(el('span', 'norm-label', x.toFixed(2)));
                var track = el('div', 'norm-bar-track');
                var fill = el('div', 'norm-bar-fill ' + (x >= 0 ? 'norm-pos' : 'norm-neg'));
                var pct = Math.abs(x) / maxAbs * 50;
                if (x >= 0) {
                    fill.style.left = '50%';
                    fill.style.width = pct + '%';
                } else {
                    fill.style.right = '50%';
                    fill.style.width = pct + '%';
                }
                track.appendChild(fill);
                row.appendChild(track);
                box.appendChild(row);
            });

            stat.textContent = (normalized ? '归一化后' : '原始数据') +
                '：均值 ' + mu2.toFixed(3) + '，标准差 ' + sd2.toFixed(3);
            btn.textContent = normalized ? '已归一化' : '归一化';
            btn.disabled = normalized;
        }

        btn.addEventListener('click', function () { normalized = true; paint(); });
        resetBtn.addEventListener('click', function () { normalized = false; paint(); });

        btns.appendChild(btn);
        btns.appendChild(resetBtn);

        container.appendChild(el('p', 'block-label', '一组忽大忽小的数（蓝正红负，以 0 为中心）'));
        container.appendChild(box);
        container.appendChild(stat);
        container.appendChild(btns);
        paint();
    }

    return { render: render };
})();
