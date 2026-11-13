/* ============================================================
 * 第 2 坎：出题器
 * 看前面、猜下一个；窗口一格格挪，答案高亮，后面的锁灰
 * ============================================================ */
var QuizDemo = (function () {
    'use strict';

    var SEQ = ['BOS', '小女孩', '擦亮', '火柴', 'EOS'];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function render(container) {
        container.innerHTML = '';
        makeIdentityTag(container, 'real', '真在这条序列上划答案、上下文和不许偷看的位置。');
        var ansIdx = 1; // 答案位置，从第一个真实词开始
        var total = SEQ.length - 1; // 共 4 道

        var strip = el('div', 'quiz-strip');
        var status = el('p', 'quiz-status');
        var btns = el('div', 'btn-group');
        var nextBtn = el('button', 'run-btn', '出下一道');
        nextBtn.type = 'button';
        var resetBtn = el('button', 'run-btn btn-secondary', '重置');
        resetBtn.type = 'button';

        function paint() {
            strip.innerHTML = '';
            SEQ.forEach(function (t, i) {
                var cls = 'quiz-word';
                if (i === ansIdx) cls += ' is-answer';
                else if (i < ansIdx) cls += ' is-context';
                else cls += ' is-locked';
                var chip = el('span', cls, t);
                strip.appendChild(chip);
            });

            var context = SEQ.slice(0, ansIdx).join(' ');
            var answer = SEQ[ansIdx];
            status.innerHTML = '第 <strong>' + ansIdx + '</strong> 道 / 共 ' + total + ' 道　｜　题目：' +
                context + '　<strong>答案：' + answer + '</strong>';

            nextBtn.disabled = ansIdx >= SEQ.length - 1;
        }

        nextBtn.addEventListener('click', function () {
            if (ansIdx < SEQ.length - 1) { ansIdx++; paint(); }
        });
        resetBtn.addEventListener('click', function () {
            ansIdx = 1; paint();
        });

        btns.appendChild(nextBtn);
        btns.appendChild(resetBtn);

        container.appendChild(el('p', 'block-label', '一句话加上头尾，窗口往后挪：亮橙是答案，蓝的是题目，灰的还没轮到（不许偷看）'));
        container.appendChild(strip);
        container.appendChild(status);
        container.appendChild(btns);
        paint();
    }

    return { render: render };
})();
