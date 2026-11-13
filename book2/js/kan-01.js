/* ============================================================
 * 第 1 坎：切书工作台
 * 三种切法对比（按字 / 按词 / 子词 BPE）+ BPE 分步合并
 * ============================================================ */
var CutDemo = (function () {
    'use strict';

    var WORD_FREQ = { '小女孩': 2, '火柴': 1, '雪地': 1 };
    var PALETTE = ['#dbeafe', '#cffafe', '#fce7f3', '#ede9fe', '#ffedd5', '#dcfce7', '#e0e7ff', '#fef3c7'];
    var TINT_TEXT = ['#1e40af', '#155e75', '#9d174d', '#5b21b6', '#9a3412', '#166534', '#3730a3', '#92400e'];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    // 给每个不同 token 一个稳定颜色
    function colorMap(tokens) {
        var uniq = [];
        tokens.forEach(function (t) { if (uniq.indexOf(t) === -1) uniq.push(t); });
        var map = {};
        uniq.forEach(function (t, i) {
            map[t] = { bg: PALETTE[i % PALETTE.length], fg: TINT_TEXT[i % TINT_TEXT.length] };
        });
        return map;
    }

    function tokenChip(t, colors) {
        var chip = el('span', 'mini-token', t);
        var c = colors[t] || { bg: '#f3f4f6', fg: '#374151' };
        chip.style.background = c.bg;
        chip.style.color = c.fg;
        return chip;
    }

    // ---------- BPE 核心 ----------
    function initWords() {
        return Object.keys(WORD_FREQ).map(function (w) {
            return { tokens: ['·'].concat(w.split('')), freq: WORD_FREQ[w] };
        });
    }
    function countPairs(words) {
        var counts = {};
        words.forEach(function (w) {
            for (var i = 0; i < w.tokens.length - 1; i++) {
                var key = w.tokens[i] + ' ' + w.tokens[i + 1];
                counts[key] = (counts[key] || 0) + w.freq;
            }
        });
        return counts;
    }
    function bestPair(counts) {
        var best = null, bestN = -1;
        Object.keys(counts).forEach(function (k) {
            if (counts[k] > bestN) { bestN = counts[k]; best = k; }
        });
        return best ? { pair: best.split(' '), n: bestN } : null;
    }
    function merge(words, pair) {
        var a = pair[0], b = pair[1];
        words.forEach(function (w) {
            var t = w.tokens, out = [];
            for (var i = 0; i < t.length; i++) {
                if (i < t.length - 1 && t[i] === a && t[i + 1] === b) {
                    out.push(a + b); i++;
                } else out.push(t[i]);
            }
            w.tokens = out;
        });
    }
    function cloneWords(words) {
        return words.map(function (w) { return { tokens: w.tokens.slice(), freq: w.freq }; });
    }
    // 跑到没有频次大于 1 的对，作为最终子词结果
    function finalBpe() {
        var words = initWords();
        for (var k = 0; k < 50; k++) {
            var bp = bestPair(countPairs(words));
            if (!bp || bp.n < 2) break;
            merge(words, bp.pair);
        }
        return words;
    }

    function flatten(words, withMark) {
        var out = [];
        words.forEach(function (w) {
            w.tokens.forEach(function (t) {
                if (!withMark && t === '·') return;
                out.push(t);
            });
        });
        return out;
    }

    function render(container) {
        container.innerHTML = '';
        makeIdentityTag(container, 'real', '每一步都真在统计相邻对、按 BPE 规则合并，不是放动画。');
        var demo = el('div', 'cut-demo');

        demo.appendChild(el('p', 'block-label', '示例文本（按空格分好的四个词，括号里是出现次数）：小女孩×2，火柴×1，雪地×1'));

        // 三种切法标签
        var tabs = el('div', 'cut-tabs');
        var methods = ['按字切', '按词切', '子词 BPE'];
        var out = el('div', 'cut-out');
        var stat = el('p', 'cut-stat');

        // 预计算三种结果
        var charTokens = flatten(initWords(), false);
        var wordTokens = Object.keys(WORD_FREQ).reduce(function (acc, w) {
            for (var i = 0; i < WORD_FREQ[w]; i++) acc.push(w);
            return acc;
        }, []);
        var subTokens = flatten(finalBpe(), false);

        function showMethod(idx) {
            tabs.querySelectorAll('.tbl-tab').forEach(function (t, i) {
                t.classList.toggle('active', i === idx);
            });
            var data, label;
            if (idx === 0) { data = charTokens; label = '按字切'; }
            else if (idx === 1) { data = wordTokens; label = '按词切'; }
            else { data = subTokens; label = '子词 BPE'; }

            out.innerHTML = '';
            var colors = colorMap(data);
            data.forEach(function (t) { out.appendChild(tokenChip(t, colors)); });
            var uniq = data.filter(function (t, i) { return data.indexOf(t) === i; });
            stat.textContent = label + '：切出 ' + data.length + ' 块，词表要记 ' + uniq.length + ' 个不同单元。';
        }

        methods.forEach(function (m, i) {
            var tab = el('button', 'tbl-tab', m);
            tab.type = 'button';
            tab.addEventListener('click', function () { showMethod(i); });
            tabs.appendChild(tab);
        });
        demo.appendChild(tabs);
        demo.appendChild(out);
        demo.appendChild(stat);

        // ---------- BPE 分步 ----------
        demo.appendChild(el('div', 'cut-divider'));
        demo.appendChild(el('p', 'block-label', 'BPE 分步合并（· 是词头标记，帮机器分清边界）'));
        var bpeBox = el('div', 'bpe-box');
        var bpeStatus = el('p', 'bpe-status');
        var bpeWords = initWords();
        var round = 0;
        var pending = bestPair(countPairs(bpeWords));

        function paintBpe(hotPair) {
            bpeBox.innerHTML = '';
            var allTokens = flatten(bpeWords, true);
            var colors = colorMap(allTokens);
            bpeWords.forEach(function (w) {
                var line = el('div', 'bpe-word');
                line.appendChild(el('span', 'bpe-freq', '×' + w.freq));
                for (var i = 0; i < w.tokens.length; i++) {
                    var t = w.tokens[i];
                    var isHot = hotPair && i < w.tokens.length - 1
                        && t === hotPair.pair[0] && w.tokens[i + 1] === hotPair.pair[1];
                    var chip = tokenChip(t, colors);
                    if (isHot) chip.classList.add('pair-hot');
                    line.appendChild(chip);
                }
                bpeBox.appendChild(line);
            });
        }

        function paintStatus() {
            if (pending) {
                bpeStatus.textContent = '第 ' + round + ' 轮：出现最多的相邻对是「' + pending.pair.join(' + ') +
                    '」，一块儿出现 ' + pending.n + ' 次。点合并下一步。';
            } else {
                bpeStatus.textContent = '没有老一起出现的对了，合并到这儿就停。这就是 BPE 交出来的子词。';
            }
        }

        var nextBtn = el('button', 'run-btn', '合并下一步');
        nextBtn.type = 'button';
        nextBtn.addEventListener('click', function () {
            if (!pending) return;
            round++;
            var hot = pending;
            paintBpe(hot);
            setTimeout(function () {
                merge(bpeWords, hot.pair);
                pending = bestPair(countPairs(bpeWords));
                if (pending && pending.n < 2) pending = null;
                paintBpe(null);
                paintStatus();
                if (!pending) nextBtn.disabled = true;
            }, 1000);
        });
        var resetBtn = el('button', 'run-btn btn-secondary', '重置 BPE');
        resetBtn.type = 'button';
        resetBtn.addEventListener('click', function () {
            bpeWords = initWords();
            round = 0;
            pending = bestPair(countPairs(bpeWords));
            nextBtn.disabled = false;
            paintBpe(null);
            paintStatus();
        });

        var bpeBtns = el('div', 'btn-group');
        bpeBtns.appendChild(nextBtn);
        bpeBtns.appendChild(resetBtn);

        demo.appendChild(bpeBox);
        demo.appendChild(bpeStatus);
        demo.appendChild(bpeBtns);

        container.appendChild(demo);

        // 初始渲染
        showMethod(0);
        paintBpe(null);
        paintStatus();
    }

    return { render: render };
})();
