/* ============================================================
 * 第 4 坎：损失计算器
 * 拖动正确答案概率，实时看交叉熵 -log(p)
 * ============================================================ */
var LossDemo = (function () {
    'use strict';

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function render(container) {
        container.innerHTML = '';
        makeIdentityTag(container, 'real', '滑块一动，真在算 −log(p)，数字跟着实时变。');

        var p = 0.3; // 正确答案初始概率

        var label = el('label', 'range-label');
        var slider = el('input', 'range-input');
        slider.type = 'range';
        slider.min = 1;
        slider.max = 99;
        slider.value = Math.round(p * 100);
        label.appendChild(el('span', null, '正确答案「火柴」的概率：'));
        var probVal = el('span', 'range-value', '');
        label.appendChild(probVal);

        var track = el('div', 'loss-prob-track');
        var fill = el('div', 'loss-prob-fill');
        track.appendChild(fill);

        var lossNum = el('div', 'loss-big', '');
        var comment = el('p', 'loss-comment', '');

        function paint() {
            p = slider.value / 100;
            var loss = -Math.log(p);
            probVal.textContent = p.toFixed(2);
            fill.style.width = (p * 100) + '%';
            lossNum.innerHTML = '损失 = <span class="loss-num-val">' + loss.toFixed(3) + '</span>';
            if (p >= 0.8) comment.textContent = '把握很大，损失很小，这就对了。';
            else if (p >= 0.4) comment.textContent = '半信半疑，损失中等。';
            else if (p >= 0.15) comment.textContent = '心里没底，损失挺高。';
            else comment.textContent = '几乎没押对，损失冲到天上去了——这就是瞎猜的代价。';
        }

        slider.addEventListener('input', paint);

        container.appendChild(label);
        container.appendChild(slider);
        container.appendChild(track);
        container.appendChild(lossNum);
        container.appendChild(comment);
        paint();
    }

    return { render: render };
})();
