/* ============================================================
 * 第 11 坎：困惑度演示
 * 单位置：困惑度 = 1 / 正确答案概率，相当于几个选项
 * ============================================================ */
var PerplexityDemo = (function () {
    'use strict';

    var SCENES = [
        { name: '很笃定', p: 0.80 },
        { name: '一般', p: 0.33 },
        { name: '很迷糊', p: 0.10 }
    ];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function render(container) {
        container.innerHTML = '';
        makeIdentityTag(container, 'real', '真在按概率算困惑度，同一个数换个说法而已。');
        var idx = 0;

        var tabs = el('div', 'cut-tabs');
        var tabNodes = [];
        SCENES.forEach(function (s, i) {
            var t = el('button', 'tbl-tab', s.name);
            t.type = 'button';
            t.addEventListener('click', function () { idx = i; paint(); });
            tabNodes.push(t);
            tabs.appendChild(t);
        });

        var probTrack = el('div', 'ppl-prob-track');
        var probFill = el('div', 'ppl-prob-fill');
        probTrack.appendChild(probFill);
        var probText = el('p', 'ppl-prob-text', '');
        var big = el('div', 'ppl-big', '');
        var comment = el('p', 'ppl-comment', '');

        function paint() {
            tabNodes.forEach(function (t, i) { t.classList.toggle('active', i === idx); });
            var p = SCENES[idx].p;
            var ppl = 1 / p;
            probFill.style.width = (p * 100) + '%';
            probText.textContent = '正确答案的概率：' + p.toFixed(2);
            big.innerHTML = '困惑度 = <span class="ppl-num">' + ppl.toFixed(2) + '</span>';
            comment.textContent = '相当于它在约 ' + ppl.toFixed(1) + ' 个选项之间犹豫。' +
                (ppl <= 1.5 ? '心里门儿清。' : ppl <= 4 ? '拿不太准。' : '完全没谱。');
        }

        container.appendChild(el('p', 'block-label', '同一个位置，三种把握程度'));
        container.appendChild(tabs);
        container.appendChild(probTrack);
        container.appendChild(probText);
        container.appendChild(big);
        container.appendChild(comment);
        paint();
    }

    return { render: render };
})();
