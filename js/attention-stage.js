/* 第7章注意力剧场（聚光灯主视觉）
 * 当前词“她”举着灯照两个候选：光束照到谁、多亮，就是 softmax 给出的注意力权重。
 * 温度让光收束（聚焦）或散开（平均）；候选卡上的“得票率”是同一比例的投票说法；
 * 底部混合色块把两份向量按权重相加，颜色跟着变——加权求和一眼能看见。
 * 自包含，坐标用 getBoundingClientRect 实测，resize/显示后重算。
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

    function fmt(n) {
        if (Math.abs(n) < 0.005) n = 0;
        return Number(n.toFixed(2)).toString();
    }

    function mix(c1, c2, w) {
        return [
            Math.round(c1[0] * w + c2[0] * (1 - w)),
            Math.round(c1[1] * w + c2[1] * (1 - w)),
            Math.round(c1[2] * w + c2[2] * (1 - w))
        ];
    }

    function renderAttentionStage(container) {
        container.classList.add('demo-lab', 'as-stage');

        var QUERY = { word: '她', vec: [1, 0] };
        var CANDS = [
            { word: '妹妹', vec: [4, 0], score: 4, color: [245, 158, 11], rgb: '#f59e0b', freq: 392 },
            { word: '封面', vec: [0, 4], score: 0, color: [99, 102, 241], rgb: '#6366f1', freq: 523.25 }
        ];
        var T = 1;

        container.appendChild(el('p', 'lab-hint',
            '拧温度，看她手里的灯怎么照。温度小，光收成一束；温度大，光散成一片。'));

        /* 举灯的当前词 */
        var queryCard = el('div', 'as-query');
        queryCard.appendChild(el('span', 'as-lamp', '💡'));
        var qtext = el('div', 'as-qtext');
        qtext.appendChild(el('div', 'as-qword', QUERY.word + '（举灯）'));
        qtext.appendChild(el('div', 'as-qvec', '[' + QUERY.vec.join(', ') + ']'));
        queryCard.appendChild(qtext);
        container.appendChild(queryCard);

        /* 光束 SVG：源点在上方 query 底部，终点在下方候选 */
        var svg = document.createElementNS(NS, 'svg');
        svg.classList.add('beam-svg');
        container.appendChild(svg);
        var beams = CANDS.map(function () {
            var p = document.createElementNS(NS, 'path');
            p.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(p);
            return p;
        });

        /* 候选卡，带得票率 */
        var candWrap = el('div', 'as-cands');
        var candCards = CANDS.map(function (c) {
            var card = el('div', 'as-cand');
            card.appendChild(el('div', 'as-cword', c.word));
            card.appendChild(el('div', 'as-cvec', '[' + c.vec.join(', ') + ']'));
            card.appendChild(el('div', 'as-vote', '得票 0%'));
            candWrap.appendChild(card);
            return card;
        });
        container.appendChild(candWrap);

        /* 温度滑块 */
        var range = document.createElement('input');
        range.type = 'range';
        range.min = 0.2;
        range.max = 3;
        range.step = 0.1;
        range.value = 1;
        range.className = 'as-range';
        range.addEventListener('input', function () {
            T = parseFloat(range.value);
            paint();
            markDone();
        });
        var rangeLabel = el('p', 'as-tlabel', '温度 ' + fmt(T));
        container.appendChild(rangeLabel);
        container.appendChild(range);

        /* 加权结果 + 混合色块 */
        var resultBox = el('div', 'as-result');
        var swatch = el('div', 'as-swatch');
        var rtext = el('div', 'as-rtext');
        resultBox.appendChild(swatch);
        resultBox.appendChild(rtext);
        container.appendChild(resultBox);

        /* 声音混音：点喇叭才响，音量跟着权重走 */
        var mixer = window.SoundMix ? window.SoundMix.attach(container, function () {
            var w = softmax();
            return {
                tracks: CANDS.map(function (c, i) {
                    return { label: c.word, freq: c.freq, weight: w[i] };
                })
            };
        }) : null;

        function markDone() {
            var ch = container.dataset.chapter, st = container.dataset.station;
            if (ch && st != null && typeof markStationDone === 'function') {
                markStationDone(ch, Number(st));
            }
        }

        function softmax() {
            var ex = CANDS.map(function (c) { return Math.exp(c.score / T); });
            var sum = ex.reduce(function (a, b) { return a + b; }, 0);
            return ex.map(function (e) { return e / sum; });
        }

        function layoutBeams(weights) {
            var svgRect = svg.getBoundingClientRect();
            if (svgRect.width < 2 || svgRect.height < 2) return;
            var h = svgRect.height;
            svg.setAttribute('viewBox', '0 0 ' + svgRect.width + ' ' + h);

            var qr = queryCard.getBoundingClientRect();
            var sx = qr.left + qr.width / 2 - svgRect.left;
            var sy = qr.bottom - svgRect.top;

            candCards.forEach(function (card, i) {
                var cr = card.getBoundingClientRect();
                var cx = cr.left + cr.width / 2 - svgRect.left;
                var topY = cr.top - svgRect.top;
                var halfW = Math.max(8, cr.width * 0.42);
                var d = 'M ' + sx + ' ' + sy +
                    ' L ' + (cx - halfW) + ' ' + topY +
                    ' L ' + (cx + halfW) + ' ' + topY + ' Z';
                beams[i].setAttribute('d', d);
                beams[i].setAttribute('fill', CANDS[i].rgb);
                beams[i].setAttribute('opacity', 0.22 + weights[i] * 0.62);
            });
        }

        function paint() {
            var w = softmax();
            rangeLabel.textContent = '温度 ' + fmt(T);
            candCards.forEach(function (card, i) {
                card.querySelector('.as-vote').textContent =
                    '得票 ' + Math.round(w[i] * 100) + '%';
                card.style.borderColor = CANDS[i].rgb;
            });
            layoutBeams(w);

            var r = [0, 0];
            CANDS.forEach(function (c, i) {
                r[0] += w[i] * c.vec[0];
                r[1] += w[i] * c.vec[1];
            });
            var mc = mix(CANDS[0].color, CANDS[1].color, w[0]);
            swatch.style.background = 'rgb(' + mc.join(',') + ')';
            rtext.innerHTML =
                '<div class="as-rlabel">按权重加回来</div>' +
                '<div class="as-rvec">[' + fmt(r[0]) + ', ' + fmt(r[1]) + ']</div>';
            if (mixer) mixer.sync();
        }

        requestAnimationFrame(paint);
        var timer = null;
        window.addEventListener('resize', function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(paint, 150);
        });
    }

    window.renderAttentionStage = renderAttentionStage;
})();
