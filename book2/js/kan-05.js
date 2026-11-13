/* ============================================================
 * 第 5 坎：反向传播（责任往回推）
 * 从损失出发，沿计算链逐节点点亮，梯度传回参数
 * ============================================================ */
var BackDemo = (function () {
    'use strict';

    // 前向顺序（从上到下）；反向从最右的损失往回推
    var NODES = [
        { name: '参数 W', grad: 'dL/dW = 0.18', note: '参数领到责任，知道往哪儿改' },
        { name: '打分 logit', grad: 'dL/d(logit) = 0.20', note: '打分这一环的责任' },
        { name: 'softmax', grad: 'p − target = 0.20', note: 'softmax 这一环的责任' },
        { name: '概率 p', grad: 'dL/dp = 1.00', note: '概率这一环的责任' },
        { name: '损失 L', grad: 'L = 1.204', note: '起点：损失在这儿' }
    ];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function render(container) {
        container.innerHTML = '';
        makeIdentityTag(container, 'real', '真在按节点一步步回传，dL/dW 这些数是算出来的。');
        var litCount = 0; // 已经从终点点亮了几个

        var chain = el('div', 'back-chain');
        var status = el('p', 'back-status', '');
        var btns = el('div', 'btn-group');
        var stepBtn = el('button', 'run-btn', '往回推一步');
        stepBtn.type = 'button';
        var resetBtn = el('button', 'run-btn btn-secondary', '重置');
        resetBtn.type = 'button';

        function paint() {
            chain.innerHTML = '';
            // 从损失（最后）到参数（最前），反向点亮 litCount 个
            for (var i = NODES.length - 1; i >= 0; i--) {
                var node = NODES[i];
                var distanceFromEnd = NODES.length - 1 - i;
                var isLit = distanceFromEnd < litCount;
                var box = el('div', 'back-node' + (isLit ? ' back-lit' : ''));
                box.appendChild(el('span', 'back-name', node.name));
                if (isLit) {
                    box.appendChild(el('span', 'back-grad', node.grad));
                    box.appendChild(el('span', 'back-note', node.note));
                }
                chain.appendChild(box);
                if (i > 0) {
                    var arrow = el('div', 'back-arrow' + (distanceFromEnd < litCount - 1 ? ' arrow-on' : ''), '↑ 责任往回传');
                    chain.appendChild(arrow);
                }
            }

            if (litCount === 0) {
                status.textContent = '还没开始。点“往回推一步”，责任从损失出发。';
            } else if (litCount < NODES.length) {
                status.textContent = '责任已经往回传了 ' + litCount + ' 环，继续推。';
            } else {
                status.textContent = '推到头了，参数 W 领到了梯度 dL/dW = 0.18。所有参数都领到了自己的责任。';
            }
            stepBtn.disabled = litCount >= NODES.length;
        }

        stepBtn.addEventListener('click', function () {
            if (litCount < NODES.length) { litCount++; paint(); }
        });
        resetBtn.addEventListener('click', function () {
            litCount = 0; paint();
        });

        btns.appendChild(stepBtn);
        btns.appendChild(resetBtn);

        container.appendChild(el('p', 'block-label', '计算链：责任从损失（下）一路往回推到参数（上）'));
        container.appendChild(chain);
        container.appendChild(status);
        container.appendChild(btns);
        paint();
    }

    return { render: render };
})();
