/* 第11章聚光灯讲缩放（复用第7章光束视觉，不新增隐喻）
 * 三束光对应三个候选，匹配分 [4,1,0]。
 * 缩放前：分数差距大，光几乎聚成一束照第一个；
 * 缩放后：每个分数除以根号 d（这里 d=4，除以 2），差距变小，三束光都亮得更均匀。
 * 缩放不改变“看谁”，只让权重从极端变柔和——聚光灯从聚焦变散光。
 */
(function () {
    'use strict';

    var NS = 'http://www.w3.org/2000/svg';

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function pct(n) { return Math.round(n * 100); }

    function renderSpotlightScale(container) {
        container.classList.add('demo-lab', 'as-stage');

        var SCORES = [4, 1, 0];
        var DIV = 2; // 根号 4
        var CANDS = [
            { word: '候选一', rgb: '#f59e0b', color: [245, 158, 11] },
            { word: '候选二', rgb: '#10b981', color: [16, 185, 129] },
            { word: '候选三', rgb: '#6366f1', color: [99, 102, 241] }
        ];
        var scaled = false;

        container.appendChild(el('p', 'lab-hint',
            '切“缩放前/后”，看这束光怎么变。缩放不换看谁，只让光从聚焦变散光。'));

        var queryCard = el('div', 'as-query');
        queryCard.appendChild(el('span', 'as-lamp', '💡'));
        var qtext = el('div', 'as-qtext');
        qtext.appendChild(el('div', 'as-qword', '当前词（举灯）'));
        queryCard.appendChild(qtext);
        container.appendChild(queryCard);

        var svg = document.createElementNS(NS, 'svg');
        svg.classList.add('beam-svg');
        container.appendChild(svg);
        var beams = CANDS.map(function (c) {
            var p = document.createElementNS(NS, 'path');
            p.setAttribute('stroke-linejoin', 'round');
            p.setAttribute('fill', c.rgb);
            svg.appendChild(p);
            return p;
        });

        var candWrap = el('div', 'as-cands');
        var candCards = CANDS.map(function (c) {
            var card = el('div', 'as-cand');
            card.appendChild(el('div', 'as-cword', c.word));
            card.appendChild(el('div', 'as-cvec'));
            card.appendChild(el('div', 'as-vote', '得票 0%'));
            candWrap.appendChild(card);
            return card;
        });
        container.appendChild(candWrap);

        var modeBox = el('div', 'btn-group');
        ['缩放前', '缩放后'].forEach(function (text, i) {
            var b = el('button', 'run-btn btn-secondary group-btn', text);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
                modeBox.querySelectorAll('.group-btn').forEach(function (x) {
                    x.classList.remove('active');
                });
                b.classList.add('active');
                scaled = i === 1;
                paint();
                markDone();
            });
            modeBox.appendChild(b);
        });
        container.appendChild(modeBox);

        var resultBox = el('div', 'as-result');
        var swatch = el('div', 'as-swatch');
        var rtext = el('div', 'as-rtext');
        resultBox.appendChild(swatch);
        resultBox.appendChild(rtext);
        container.appendChild(resultBox);

        function markDone() {
            var ch = container.dataset.chapter, st = container.dataset.station;
            if (ch && st != null && typeof markStationDone === 'function') {
                markStationDone(ch, Number(st));
            }
        }

        function usedScores() {
            return scaled ? SCORES.map(function (v) { return v / DIV; }) : SCORES.slice();
        }
        function softmax(arr) {
            var ex = arr.map(function (v) { return Math.exp(v); });
            var sum = ex.reduce(function (a, b) { return a + b; }, 0);
            return ex.map(function (e) { return e / sum; });
        }

        function layoutBeams(weights) {
            var svgRect = svg.getBoundingClientRect();
            if (svgRect.width < 2) return;
            svg.setAttribute('viewBox', '0 0 ' + svgRect.width + ' ' + svgRect.height);
            var qr = queryCard.getBoundingClientRect();
            var sx = qr.left + qr.width / 2 - svgRect.left;
            var sy = qr.bottom - svgRect.top;
            candCards.forEach(function (card, i) {
                var cr = card.getBoundingClientRect();
                var cx = cr.left + cr.width / 2 - svgRect.left;
                var topY = cr.top - svgRect.top;
                var halfW = Math.max(7, cr.width * 0.4);
                beams[i].setAttribute('d',
                    'M ' + sx + ' ' + sy +
                    ' L ' + (cx - halfW) + ' ' + topY +
                    ' L ' + (cx + halfW) + ' ' + topY + ' Z');
                beams[i].setAttribute('opacity', 0.22 + weights[i] * 0.62);
            });
        }

        function paint() {
            var w = softmax(usedScores());
            candCards.forEach(function (card, i) {
                card.querySelector('.as-cvec').textContent =
                    '匹配分 ' + (scaled ? (SCORES[i] / DIV) : SCORES[i]);
                card.querySelector('.as-vote').textContent = '得票 ' + pct(w[i]) + '%';
                card.style.borderColor = CANDS[i].rgb;
            });
            layoutBeams(w);

            var mc = [0, 0, 0];
            CANDS.forEach(function (c, i) {
                for (var k = 0; k < 3; k++) mc[k] += w[i] * c.color[k];
            });
            swatch.style.background =
                'rgb(' + mc.map(function (x) { return Math.round(x); }).join(',') + ')';
            rtext.innerHTML =
                '<div class="as-rlabel">' + (scaled ? '除以根号 d 后，光更均匀' : '分数差距大，光聚成一束') + '</div>' +
                '<div class="as-rvec">[' + w.map(function (x) { return x.toFixed(2); }).join(', ') + ']</div>';
        }

        requestAnimationFrame(paint);
        var timer = null;
        window.addEventListener('resize', function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(paint, 150);
        });
    }

    window.renderSpotlightScale = renderSpotlightScale;
})();
