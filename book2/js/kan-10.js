/* ============================================================
 * 第 10 坎：批量演示
 * 1) 几道题的梯度平均  2) 长短句子 padding 补齐 + 填充掩码
 * ============================================================ */
var BatchDemo = (function () {
    'use strict';

    var GRADS = [0.30, -0.10, 0.20]; // 三道题对同一个参数的梯度
    var SENTENCES = [
        ['BOS', '小女孩', '擦亮', '火柴', 'EOS'],
        ['BOS', '雪', '下', 'EOS'],
        ['BOS', '奶奶', 'EOS']
    ];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function render(container) {
        container.innerHTML = '';
        makeIdentityTag(container, 'real', '真在把几个梯度平均、给短句补 padding 再打掩码。');

        // ---------- 第一部分：梯度平均 ----------
        container.appendChild(el('p', 'block-label', '① 三道题各自的梯度，平均成一个'));
        var gradBox = el('div', 'grad-box');
        var avg = GRADS.reduce(function (a, b) { return a + b; }, 0) / GRADS.length;

        GRADS.forEach(function (g, i) {
            var row = el('div', 'grad-row');
            row.appendChild(el('span', 'grad-name', '第' + (i + 1) + '题'));
            var track = el('div', 'grad-track');
            var fill = el('div', 'grad-fill ' + (g >= 0 ? 'g-pos' : 'g-neg'));
            if (g >= 0) { fill.style.left = '50%'; fill.style.width = (g * 100) + '%'; }
            else { fill.style.right = '50%'; fill.style.width = (Math.abs(g) * 100) + '%'; }
            track.appendChild(fill);
            row.appendChild(track);
            row.appendChild(el('span', 'grad-num', g.toFixed(2)));
            gradBox.appendChild(row);
        });

        var avgRow = el('div', 'grad-row avg-row');
        avgRow.appendChild(el('span', 'grad-name', '平均'));
        var avgTrack = el('div', 'grad-track');
        var avgFill = el('div', 'grad-fill g-avg');
        avgFill.style.left = '50%';
        avgFill.style.width = (avg * 100) + '%';
        avgTrack.appendChild(avgFill);
        avgRow.appendChild(avgTrack);
        avgRow.appendChild(el('span', 'grad-num', avg.toFixed(3)));
        gradBox.appendChild(avgRow);
        container.appendChild(gradBox);

        // ---------- 第二部分：padding ----------
        container.appendChild(el('p', 'block-label', '② 长短不一的句子，补齐到一样长，灰块是填充符 PAD'));
        var padBox = el('div', 'pad-box');
        var maxLen = 5;
        SENTENCES.forEach(function (sent) {
            var line = el('div', 'pad-line');
            var tokens = sent.slice();
            while (tokens.length < maxLen) tokens.push('PAD');
            tokens.forEach(function (t) {
                var isPad = t === 'PAD';
                var chip = el('span', 'pad-token ' + (isPad ? 'is-pad' : 'is-real'), t);
                line.appendChild(chip);
            });
            line.appendChild(el('span', 'pad-mask', '掩码：' +
                sent.map(function () { return '1'; }).concat(
                    new Array(maxLen - sent.length).fill('0')
                ).join(' ')));
            padBox.appendChild(line);
        });
        container.appendChild(padBox);
        container.appendChild(el('p', 'tip-text', '掩码里 1 是真词、0 是填的空位；算的时候 0 那些位置被抹掉，不参与。'));
    }

    return { render: render };
})();
