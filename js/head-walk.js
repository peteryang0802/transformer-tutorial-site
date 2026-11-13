/* ============================================================
 * 多头交叉注意力分步播放器 HeadWalk
 * 用法：HeadWalk.render(容器, {
 *   base: '..',
 *   staticData: window.CH17_DATA.twoHeads   // 预计算数据，秒开
 * })
 * 跟着“了”这一行，分 6 幕看两个头各做啥、最后汇总。
 * ============================================================ */
(function (global) {
    'use strict';

    var TITLES = [
        '起点：“了”要回原句查 31 处',
        '分头：各算各的 Q、K、V',
        '打分：算出对 31 处的比例',
        '取回：每头给“了”2 格',
        '拼接：两头结果并成 4 格',
        '交回：乘 <span class="mi">W<sub>O</sub></span>，还给“了”'
    ];
    var TOTAL = TITLES.length;

    // 每幕属于哪一段原理图（段 1/2/3）
    var PART_OF_STEP = [1, 1, 2, 2, 3, 3];
    var PART_LABELS = ['输入 · 分头', '打分 · 取回', '拼接 · 交回'];

    function partImage(base, part) {
        return base + '/assets/images/flow-part' + part + '.webp';
    }

    // 极简全程导航：三段，当前段高亮
    function nav(step, base) {
        var current = PART_OF_STEP[step];
        var h = '<div class="hw-nav">';
        for (var p = 1; p <= 3; p++) {
            h += '<span class="hw-nav-item' + (p === current ? ' hw-nav-on' : '') + '">' +
                PART_LABELS[p - 1] + '</span>';
        }
        return h + '</div>';
    }

    function cells(arr, cls) {
        return arr.map(function (v) {
            return '<span class="hw-cell ' + (cls || '') + '">' + v + '</span>';
        }).join('');
    }

    function miniBars(aRow) {
        var zeroCount = 0;
        var h = aRow.map(function (v, i) {
            var pct = (v * 100).toFixed(1);
            if (pct === '0.0') { zeroCount++; return ''; }
            var pos = i + 1;
            var tok = global.SentenceData ? global.SentenceData.tokenAt(pos) : '';
            return '<div class="hw-mini">' +
                '<span class="hw-mini-lab">' + pos + ' ' + tok + '</span>' +
                '<span class="hw-mini-track"><span class="hw-mini-fill" style="width:' +
                pct + '%"></span></span>' +
                '<span class="hw-mini-num">' + pct + '%</span>' +
                '</div>';
        }).join('');
        if (zeroCount > 0) {
            h += '<p class="hw-mini-zero">另外 ' + zeroCount + ' 处约为 0，就不一条条列了。</p>';
        }
        return h;
    }

    function render(container, opts) {
        // 用预计算静态数据，秒开，不再现场跑 Pyodide
        var data = opts.staticData || null;
        if (!data) {
            container.innerHTML = '<p class="lab-hint">数据没加载好，请刷新页面再试。</p>';
            return;
        }
        var step = 0;

        function dots() {
            var h = '';
            for (var i = 0; i < TOTAL; i++) {
                h += '<span class="hw-dot' + (i === step ? ' hw-dot-on' : '') + '"></span>';
            }
            return '<div class="hw-dots">' + h + '</div>';
        }

        function body() {
            var heads = data.heads;
            if (step === 0) {
                return '<div class="hw-block">' +
                    '<p class="hw-p">“了”这一行手里的 4 个数：</p>' +
                    '<div class="hw-cells">' + cells(data.replyRow) + '</div></div>' +
                    '<div class="hw-block"><p class="hw-p">原句 M：<b>' + data.memoryCount +
                    ' 行 × 4 格</b>（这里只看形状，不展开数字）</p>' +
                    '<div class="hw-memory-ghost"></div></div>' +
                    '<p class="hw-say">这 31 处怎么查？交给两个头，并行干。</p>';
            }
            if (step === 1) {
                return '<div class="hw-heads">' + heads.map(function (h, i) {
                    return '<div class="hw-head hw-head-' + (i + 1) + '">' +
                        '<div class="hw-head-tag">第 ' + (i + 1) + ' 头</div>' +
                        '<p class="hw-p">“了”的 Q（2 格）：</p>' +
                        '<div class="hw-cells">' + cells(h.qRow) + '</div>' +
                        '<p class="hw-sub">K、V 各 31×2，用本头自己的系数算。</p>' +
                        '</div>';
                }).join('') + '</div>' +
                    '<p class="hw-say">两个头做的事一样，但系数不同、数也不同，互相独立。</p>';
            }
            if (step === 2) {
                return '<div class="hw-heads">' + heads.map(function (h, i) {
                    return '<div class="hw-head hw-head-' + (i + 1) + '">' +
                        '<div class="hw-head-tag">第 ' + (i + 1) + ' 头</div>' +
                        '<p class="hw-sub">Q 乘 K 转置、除以 <span class="mi">√2</span>、softmax 后，“了”对 31 处的比例：</p>' +
                        '<div class="hw-minis">' + miniBars(h.aRow) + '</div>' +
                        '</div>';
                }).join('') + '</div>';
            }
            if (step === 3) {
                return '<div class="hw-heads">' + heads.map(function (h, i) {
                    return '<div class="hw-head hw-head-' + (i + 1) + '">' +
                        '<div class="hw-head-tag">第 ' + (i + 1) + ' 头</div>' +
                        '<p class="hw-p">比例乘 V，“了”取回 2 格：</p>' +
                        '<div class="hw-cells">' + cells(h.zRow) + '</div>' +
                        '</div>';
                }).join('') + '</div>';
            }
            if (step === 4) {
                return '<p class="hw-p">把第 2 头的 2 格，移到第 1 头的 2 格旁边：</p>' +
                    '<div class="hw-cells hw-concat">' +
                    '<span class="hw-group">' + cells(heads[0].zRow, 'hw-c1') + '</span>' +
                    '<span class="hw-group">' + cells(heads[1].zRow, 'hw-c2') + '</span>' +
                    '</div>' +
                    '<p class="hw-say">拼起来就是“了”的 4 格：' +
                    data.concatRow.join('、') + '</p>';
            }
            return '<p class="hw-p">4 格乘 <span class="mi">W<sub>O</sub></span>（4×4）重新组合，得到最终 4 个数：</p>' +
                '<div class="hw-cells">' + cells(data.outRow, 'hw-final') + '</div>' +
                '<p class="hw-say">交回“了”，再加回 H、归一化、交给这一层的 FFN。查完了。</p>';
        }

        function draw() {
            var part = PART_OF_STEP[step];
            container.innerHTML =
                nav(step, opts.base) +
                dots() +
                '<h3 class="hw-title">' + TITLES[step] + '</h3>' +
                '<figure class="hw-figure">' +
                '<img src="' + partImage(opts.base, part) + '" alt="这一段的原理图">' +
                '<figcaption>原理图（第 ' + part + ' 段）：' + PART_LABELS[part - 1] + '</figcaption>' +
                '</figure>' +
                '<div class="hw-body">' + body() + '</div>' +
                '<div class="hw-controls">' +
                '<button class="run-btn btn-secondary" id="hwPrev"' + (step === 0 ? ' disabled' : '') +
                '>上一步</button>' +
                '<button class="run-btn" id="hwNext"' + (step === TOTAL - 1 ? ' disabled' : '') +
                '>下一步</button>' +
                '</div>';
            document.getElementById('hwPrev').addEventListener('click', function () {
                if (step > 0) { step--; draw(); }
            });
            document.getElementById('hwNext').addEventListener('click', function () {
                if (step < TOTAL - 1) { step++; draw(); }
            });
        }

        container.classList.add('hw-wrap');
        draw();
    }

    global.HeadWalk = { render: render };
})(window);
