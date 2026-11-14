/* ============================================================
 * 第 12 坎：规模成本计算器
 * 显存 ≈ 参数 × 16 字节；算力 ≈ 6 × 参数 × 数据块数
 * ============================================================ */
var ScaleDemo = (function () {
    'use strict';

    var DATA_TOKENS = 3e11; // 假设喂 3000 亿块数据
    var MODELS = [
        { name: '教学模型', n: 5696 },
        { name: '小模型', n: 1e8 },
        { name: '大模型', n: 1e9 },
        { name: '超大模型', n: 1e12 }
    ];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }
    function fmtInt(n) {
        if (n < 1e4) return n.toLocaleString('zh-CN');
        var units = [
            { v: 1e12, s: '万亿' }, { v: 1e8, s: '亿' }, { v: 1e4, s: '万' }
        ];
        for (var i = 0; i < units.length; i++) {
            if (n >= units[i].v) return (n / units[i].v).toFixed(n >= 1e12 ? 1 : 2) + units[i].s;
        }
        return String(n);
    }
    function fmtBytes(b) {
        var u = ['B', 'KB', 'MB', 'GB', 'TB'];
        var i = 0, x = b;
        while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; }
        return x.toFixed(x < 10 ? 1 : 0) + ' ' + u[i];
    }
    function fmtSci(x) {
        var e = Math.floor(Math.log10(x));
        var m = x / Math.pow(10, e);
        return m.toFixed(1) + ' × 10^' + e;
    }

    function render(container) {
        container.innerHTML = '';
        makeIdentityTag(container, 'real', '显存、6ND 这些是按真实公式估的，数量级是真的，具体数会随实现浮动。');
        var idx = 0;

        var tabs = el('div', 'cut-tabs');
        var tabNodes = [];
        MODELS.forEach(function (m, i) {
            var t = el('button', 'tbl-tab', m.name);
            t.type = 'button';
            t.addEventListener('click', function () { idx = i; paint(); });
            tabNodes.push(t);
            tabs.appendChild(t);
        });

        var paramRow = el('div', 'scale-row');
        var memRow = el('div', 'scale-row');
        var flopRow = el('div', 'scale-row');
        var note = el('p', 'scale-note', '');

        function paint() {
            tabNodes.forEach(function (t, i) { t.classList.toggle('active', i === idx); });
            var n = MODELS[idx].n;
            var mem = n * 16;
            var flop = 6 * n * DATA_TOKENS;

            paramRow.innerHTML = '<span class="scale-k">参数总数</span><span class="scale-v">' + fmtInt(n) + ' 个</span>';
            memRow.innerHTML = '<span class="scale-k">训练显存（约16字节/参数）</span><span class="scale-v mem-v">' + fmtBytes(mem) + '</span>';
            flopRow.innerHTML = '<span class="scale-k">训练算力（6ND，3000亿块）</span><span class="scale-v">' + fmtSci(flop) + ' 次运算</span>';
            note.textContent = idx === 0
                ? '咱们的小不点，一张纸的大小，CPU 就装得下。'
                : '个头一上来，显存和算力都是天文数字，得堆一大堆专门的芯片。';
        }

        container.appendChild(el('p', 'block-label', '点不同规模，看“大”的代价'));
        container.appendChild(tabs);
        container.appendChild(paramRow);
        container.appendChild(memRow);
        container.appendChild(flopRow);
        container.appendChild(note);
        paint();
    }

    return { render: render };
})();
