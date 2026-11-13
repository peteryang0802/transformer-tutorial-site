/* ============================================================
 * 第 3 坎：因果掩码演示
 * 行＝当前位置，列＝能不能看那个位置
 * ============================================================ */
var MaskDemo = (function () {
    'use strict';

    var WORDS = ['BOS', '小女孩', '擦亮', '火柴'];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function render(container) {
        container.innerHTML = '';
        makeIdentityTag(container, 'real', '真在算每个位置能看哪些、哪些被挡住。');
        var masked = true;

        var tabs = el('div', 'cut-tabs');
        var tabBlock = el('button', 'tbl-tab', '因果掩码（挡住）');
        tabBlock.type = 'button';
        var tabPeek = el('button', 'tbl-tab', '允许偷看（作弊）');
        tabPeek.type = 'button';
        tabs.appendChild(tabBlock);
        tabs.appendChild(tabPeek);

        var grid = el('div', 'mask-grid');

        function paint() {
            tabBlock.classList.toggle('active', masked);
            tabPeek.classList.toggle('active', !masked);
            grid.innerHTML = '';

            // 角标
            grid.appendChild(el('div', 'mask-corner', '当前位置＼看哪'));
            // 列头
            WORDS.forEach(function (w) {
                grid.appendChild(el('div', 'mask-head', w));
            });
            // 各行
            for (var i = 0; i < WORDS.length; i++) {
                grid.appendChild(el('div', 'mask-head', WORDS[i]));
                for (var j = 0; j < WORDS.length; j++) {
                    var canSee = !masked || j <= i;
                    var cell = el('div', 'mask-cell ' + (canSee ? 'mask-ok' : 'mask-block'),
                        canSee ? '✓' : '✕');
                    grid.appendChild(cell);
                }
            }
        }

        tabBlock.addEventListener('click', function () { masked = true; paint(); });
        tabPeek.addEventListener('click', function () { masked = false; paint(); });

        container.appendChild(el('p', 'block-label', '掩码矩阵：每个位置能看哪些词（4 个位置，4×4）'));
        container.appendChild(tabs);
        container.appendChild(grid);
        container.appendChild(el('p', 'tip-text', '挡住以后，右上角（后面的词）全是红叉，答案漏不过来。'));
        paint();
    }

    return { render: render };
})();
