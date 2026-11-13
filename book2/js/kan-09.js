/* ============================================================
 * 第 9 坎：过拟合曲线
 * 训练损失一直降，测试损失先降后升，分叉就是过拟合信号
 * ============================================================ */
var OverfitDemo = (function () {
    'use strict';

    var TRAIN = [1.9, 1.6, 1.35, 1.1, 0.9, 0.72, 0.58, 0.46, 0.36, 0.28, 0.22, 0.17];
    var TEST = [1.9, 1.65, 1.4, 1.2, 1.05, 0.98, 0.97, 1.0, 1.08, 1.2, 1.35, 1.55];
    var FORK = 6; // 从这之后测试损失开始往上走

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function render(container) {
        container.innerHTML = '';
        var shown = 3;

        makeIdentityTag(container, 'sim', '这是预设的示意曲线，帮你看清过拟合时长啥样，不是某次真实训练的记录。');

        var legend = el('div', 'overfit-legend');
        legend.appendChild(el('span', 'legend-dot train-dot', '训练集损失'));
        legend.appendChild(el('span', 'legend-dot test-dot', '测试集损失'));

        var canvas = el('canvas', 'overfit-canvas');
        var status = el('p', 'overfit-status', '');
        var btns = el('div', 'btn-group');
        var nextBtn = el('button', 'run-btn', '继续训练');
        nextBtn.type = 'button';
        var resetBtn = el('button', 'run-btn btn-secondary', '重置');
        resetBtn.type = 'button';

        function draw() {
            var dpr = window.devicePixelRatio || 1;
            var cssW = canvas.clientWidth || 320, cssH = 220;
            canvas.width = cssW * dpr; canvas.height = cssH * dpr;
            var ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, cssW, cssH);

            var n = shown, pad = 24;
            var maxV = 2.0;
            function px(i) { return pad + (cssW - 2 * pad) * i / (TRAIN.length - 1); }
            function py(v) { return cssH - pad - (cssH - 2 * pad) * v / maxV; }

            // 网格
            ctx.strokeStyle = '#e5e7eb';
            for (var g = 1; g <= 4; g++) {
                var y = cssH * g / 5;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cssW, y); ctx.stroke();
            }

            function line(data, color) {
                ctx.beginPath();
                ctx.moveTo(px(0), py(data[0]));
                for (var i = 1; i < n; i++) ctx.lineTo(px(i), py(data[i]));
                ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
                ctx.beginPath();
                ctx.arc(px(n - 1), py(data[n - 1]), 4, 0, Math.PI * 2);
                ctx.fillStyle = color; ctx.fill();
            }
            line(TRAIN, '#2563eb');
            line(TEST, '#ea580c');

            // 分叉标记
            if (n > FORK) {
                ctx.fillStyle = '#dc2626';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('← 分叉：测试损失开始往上走', px(FORK) + 4, py(TEST[FORK]) - 8);
            }
        }

        function paint() {
            draw();
            if (shown <= FORK) {
                status.textContent = '两条线都在往下走，它学到的是真规律，测试题也做得越来越好。';
            } else {
                status.textContent = '训练损失还在降，测试损失却掉头往上——它开始背题了，这就是过拟合。';
            }
            nextBtn.disabled = shown >= TRAIN.length;
        }

        nextBtn.addEventListener('click', function () {
            if (shown < TRAIN.length) { shown++; paint(); }
        });
        resetBtn.addEventListener('click', function () { shown = 3; paint(); });

        btns.appendChild(nextBtn);
        btns.appendChild(resetBtn);

        container.appendChild(legend);
        container.appendChild(canvas);
        container.appendChild(status);
        container.appendChild(btns);
        setTimeout(paint, 50);
    }

    return { render: render };
})();
