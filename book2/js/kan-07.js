/* ============================================================
 * 第 7 坎：残差连接信号演示
 * 无残差：信号逐层衰减；有残差：直道把信号保留
 * ============================================================ */
var ResidualDemo = (function () {
    'use strict';

    var DECAY = 0.55; // 无残差时每层只剩这么多

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function render(container) {
        container.innerHTML = '';
        makeIdentityTag(container, 'real', '真在算信号一层层衰减多少，残差有没有把它接住。');
        var hasRes = false;
        var layerCount = 3;

        var tabs = el('div', 'cut-tabs');
        var tabNo = el('button', 'tbl-tab', '没有残差');
        tabNo.type = 'button';
        var tabYes = el('button', 'tbl-tab', '有残差（直道）');
        tabYes.type = 'button';
        tabs.appendChild(tabNo);
        tabs.appendChild(tabYes);

        var box = el('div', 'res-box');
        var btns = el('div', 'btn-group');
        var addBtn = el('button', 'run-btn', '加一层');
        addBtn.type = 'button';
        var resetBtn = el('button', 'run-btn btn-secondary', '重置层数');
        resetBtn.type = 'button';

        function paint() {
            tabNo.classList.toggle('active', !hasRes);
            tabYes.classList.toggle('active', hasRes);
            box.innerHTML = '';

            var strength = 100;
            for (var i = 0; i < layerCount; i++) {
                if (i > 0) {
                    strength = hasRes ? Math.max(strength, 100) : strength * DECAY;
                }
                var layer = el('div', 'res-layer');
                var head = el('div', 'res-head');
                head.appendChild(el('span', 'res-name', '第 ' + (i + 1) + ' 层'));
                if (hasRes && i > 0) head.appendChild(el('span', 'res-shortcut', '＋直道（原输入）'));
                layer.appendChild(head);

                var track = el('div', 'res-signal-track');
                var fill = el('div', 'res-signal-fill');
                fill.style.width = strength.toFixed(1) + '%';
                track.appendChild(fill);
                layer.appendChild(track);
                layer.appendChild(el('span', 'res-strength', '信号强度 ' + strength.toFixed(0)));
                box.appendChild(layer);
            }
        }

        tabNo.addEventListener('click', function () { hasRes = false; paint(); });
        tabYes.addEventListener('click', function () { hasRes = true; paint(); });
        addBtn.addEventListener('click', function () {
            if (layerCount < 6) { layerCount++; paint(); }
        });
        resetBtn.addEventListener('click', function () {
            layerCount = 3; paint();
        });

        btns.appendChild(addBtn);
        btns.appendChild(resetBtn);

        container.appendChild(el('p', 'block-label', '信号从第一层往下传，看能剩多少'));
        container.appendChild(tabs);
        container.appendChild(box);
        container.appendChild(btns);
        paint();
    }

    return { render: render };
})();
