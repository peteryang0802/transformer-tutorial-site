/* 前言交互：同一句话的两副面孔
 * 人看是文字，电脑看是数字和权重；拖滑块改权重，连线粗细和结果向量实时变。
 * 连线复用通用锚定工具 anchor-lines.js。
 */
(function () {
    'use strict';

    var WORDS = ['小明', '借给', '妹妹'];
    var VECTORS = [[1, 0], [0, 1], [-1, -1]];
    var weights = [0.2, 0.3, 0.5];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function fmt(n) {
        if (Math.abs(n) < 0.005) n = 0;
        return n.toFixed(2);
    }

    function renderTwoFaces(container) {
        container.classList.add('tf-card', 'view-machine');

        /* 1. 视图切换 */
        var toggle = el('div', 'tf-toggle');
        var btnHuman = el('button', 'tf-viewbtn', '人看（文字）');
        var btnMachine = el('button', 'tf-viewbtn active', '电脑看（数字）');
        toggle.appendChild(btnHuman);
        toggle.appendChild(btnMachine);
        container.appendChild(toggle);

        /* 2. 人看提示（仅人看视图出现） */
        container.appendChild(el('p', 'tf-human-hint human-only',
            '你看到的是三个词，读的是字。字本身没有大小，也不能直接拿来算。'));

        /* 3. 词卡 */
        var wordsWrap = el('div', 'tf-words');
        var wordCards = [];
        WORDS.forEach(function (w) {
            var card = el('div', 'tf-word');
            card.appendChild(el('div', 'w', w));
            card.appendChild(el('div', 'v num-only'));
            wordCards.push(card);
            wordsWrap.appendChild(card);
        });
        container.appendChild(wordsWrap);

        /* 4. 连线（仅电脑看，通用锚定工具按词卡真实中心画） */
        var svgWrap = el('div', 'num-only');
        container.appendChild(svgWrap);
        var anchorCtl = AnchorLines.connect({
            host: svgWrap,
            sources: wordCards,
            weights: function () { return weights; },
            color: '#6366f1',
            minWidth: 1,
            maxWidth: 10
        });
        container.appendChild(el('p', 'tf-focus-label',
            '电脑正在读这句话，给每个词分配权重'));

        /* 5. 权重滑块（仅电脑看） */
        var sliders = el('div', 'tf-sliders num-only');
        var ranges = [];
        var pctLabels = [];
        WORDS.forEach(function (w, i) {
            var row = el('div', 'tf-slider-row');
            var top = el('div', 'sr-top');
            top.appendChild(el('span', null, w + ' 的权重'));
            var pct = el('span', 'pct');
            pctLabels.push(pct);
            top.appendChild(pct);
            var range = document.createElement('input');
            range.type = 'range';
            range.min = 0;
            range.max = 1;
            range.step = 0.01;
            ranges.push(range);
            row.appendChild(top);
            row.appendChild(range);
            sliders.appendChild(row);

            range.addEventListener('input', function () {
                setWeight(i, parseFloat(range.value));
                paint();
            });
        });
        container.appendChild(sliders);

        /* 6. 结果向量（仅电脑看） */
        var resultBox = el('div', 'tf-result num-only');
        resultBox.appendChild(el('div', 'r-label', '电脑按权重加出来的结果向量'));
        var rvec = el('div', 'rvec');
        resultBox.appendChild(rvec);
        container.appendChild(resultBox);

        /* 7. 点题 */
        container.appendChild(el('p', 'tf-point',
            '你拨的不是字，是数字。电脑就靠这一堆数字，决定看重谁、忽略谁；人心里的“意思”，到电脑这儿全换成了权重。'));

        /* 视图切换 */
        btnHuman.addEventListener('click', function () {
            container.classList.remove('view-machine');
            container.classList.add('view-human');
            btnHuman.classList.add('active');
            btnMachine.classList.remove('active');
        });
        btnMachine.addEventListener('click', function () {
            container.classList.remove('view-human');
            container.classList.add('view-machine');
            btnMachine.classList.add('active');
            btnHuman.classList.remove('active');
            requestAnimationFrame(function () { anchorCtl.update(); });
        });

        /* 拖一个滑块，其余两个按原比例补足，总和恒为 1 */
        function setWeight(idx, val) {
            val = Math.min(1, Math.max(0, val));
            var sumOthers = 0;
            for (var i = 0; i < 3; i++) {
                if (i !== idx) sumOthers += weights[i];
            }
            var remain = 1 - val;
            if (sumOthers > 0.0001) {
                for (i = 0; i < 3; i++) {
                    if (i !== idx) weights[i] = remain * (weights[i] / sumOthers);
                }
            } else {
                for (i = 0; i < 3; i++) {
                    if (i !== idx) weights[i] = remain / 2;
                }
            }
            weights[idx] = val;
        }

        function paint() {
            wordCards.forEach(function (card, i) {
                card.querySelector('.v').textContent =
                    '[' + VECTORS[i][0] + ', ' + VECTORS[i][1] + ']';
            });
            anchorCtl.update();
            ranges.forEach(function (range, i) { range.value = weights[i]; });
            pctLabels.forEach(function (p, i) {
                p.textContent = Math.round(weights[i] * 100) + '%';
            });
            var r = [0, 0];
            for (var i = 0; i < 3; i++) {
                r[0] += weights[i] * VECTORS[i][0];
                r[1] += weights[i] * VECTORS[i][1];
            }
            rvec.textContent = '[' + fmt(r[0]) + ', ' + fmt(r[1]) + ']';
        }
        paint();
    }

    window.renderTwoFaces = renderTwoFaces;
})();
