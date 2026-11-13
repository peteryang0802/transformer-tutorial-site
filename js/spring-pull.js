/* 第6章弹簧拔河（点积匹配分 = 主动拉力）
 * 中间的小球是“她”，左右两个候选各连一根弹簧：
 * 妹妹点积 4，主动拉力 4；封面点积 0，弹簧松着，不产生拉力。
 * 所以小球一开始贴在妹妹端点；拖走松手后，也会回到妹妹端点。
 * 自包含，SVG 弹簧 + 指针拖动 + 弹簧阻尼动画。
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

    /* 两端点之间画锯齿弹簧 */
    function springPath(x1, x2, y, coils, amp) {
        var lead = 12;
        var d = 'M ' + x1 + ' ' + y + ' L ' + (x1 + lead) + ' ' + y;
        var segs = coils * 2;
        var usable = (x2 - x1) - lead * 2;
        for (var i = 0; i < segs; i++) {
            var x = x1 + lead + usable * (i + 1) / segs;
            d += ' L ' + x.toFixed(1) + ' ' + (y + (i % 2 === 0 ? -amp : amp)).toFixed(1);
        }
        d += ' L ' + x2 + ' ' + y;
        return d;
    }

    function slackPath(x1, x2, y) {
        var gap = Math.max(1, x2 - x1);
        var sag = Math.min(20, Math.max(6, gap / 3));
        var c1x = x1 + gap / 3;
        var c2x = x1 + gap * 2 / 3;
        return 'M ' + x1 + ' ' + y +
            ' C ' + c1x.toFixed(1) + ' ' + (y + sag).toFixed(1) +
            ' ' + c2x.toFixed(1) + ' ' + (y + sag).toFixed(1) +
            ' ' + x2 + ' ' + y;
    }

    function renderSpringPull(container) {
        container.classList.add('demo-lab', 'sp-stage');

        /* 与第6章一致：她[1,0] 对 妹妹[4,0] 点积 4、对 封面[0,4] 点积 0 */
        var ANCHORS = [
            { word: '妹妹', vec: [4, 0], force: 4, side: 'left' },
            { word: '封面', vec: [0, 4], force: 0, side: 'right' }
        ];

        container.appendChild(el('p', 'lab-hint',
            '封面点积是 0，这根弹簧松着，不会拉；妹妹点积是 4。把小球拖走再松手，看它回到妹妹这边。'));

        var svg = document.createElementNS(NS, 'svg');
        svg.classList.add('sp-svg');
        container.appendChild(svg);

        var springs = [0, 1].map(function () {
            var p = document.createElementNS(NS, 'path');
            p.setAttribute('fill', 'none');
            p.setAttribute('stroke-width', '2.5');
            svg.appendChild(p);
            return p;
        });
        var ball = document.createElementNS(NS, 'circle');
        ball.setAttribute('r', 13);
        ball.setAttribute('fill', '#2563eb');
        ball.setAttribute('stroke', '#fff');
        ball.setAttribute('stroke-width', '2');
        ball.style.cursor = 'grab';
        svg.appendChild(ball);

        var anchorNodes = ANCHORS.map(function (a, i) {
            var c = document.createElementNS(NS, 'circle');
            c.setAttribute('r', 7);
            c.setAttribute('fill', i === 0 ? '#f59e0b' : '#9ca3af');
            svg.appendChild(c);
            return c;
        });

        var labels = ANCHORS.map(function (a) {
            var t = document.createElementNS(NS, 'text');
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('class', 'sp-label');
            t.textContent = a.word + ' ' + a.force + '分';
            svg.appendChild(t);
            return t;
        });

        var info = el('p', 'sp-info');
        container.appendChild(info);

        var L, R, xEq, ballX, v, raf;
        var K = 0.06, DAMP = 0.82;
        var dragging = false, marked = false;

        function markDone() {
            if (marked) return;
            var ch = container.dataset.chapter, st = container.dataset.station;
            if (ch && st != null && typeof markStationDone === 'function') {
                markStationDone(ch, Number(st));
                marked = true;
            }
        }

        function computeGeometry() {
            var rect = svg.getBoundingClientRect();
            if (rect.width < 2) return;
            svg.setAttribute('viewBox', '0 0 ' + rect.width + ' ' + rect.height);
            var y = rect.height / 2;
            L = 34;
            R = rect.width - 34;
            /* 封面拉力为0，等于没拉；只有妹妹这边持续拉，平衡位置就是妹妹端点 */
            xEq = L;
            anchorNodes[0].setAttribute('cx', L); anchorNodes[0].setAttribute('cy', y);
            anchorNodes[1].setAttribute('cx', R); anchorNodes[1].setAttribute('cy', y);
            labels[0].setAttribute('x', L); labels[0].setAttribute('y', y - 22);
            labels[1].setAttribute('x', R); labels[1].setAttribute('y', y - 22);
        }

        function render() {
            var rect = svg.getBoundingClientRect();
            var y = rect.height / 2;
            var gapL = ballX - L;
            if (gapL > 4) {
                springs[0].setAttribute('d',
                    springPath(L, ballX, y, Math.max(3, Math.round(gapL / 22)), 7));
            } else {
                springs[0].setAttribute('d', '');
            }
            springs[0].setAttribute('stroke', '#f59e0b');
            springs[1].setAttribute('d', slackPath(ballX, R, y));
            springs[1].setAttribute('stroke', '#9ca3af');
            ball.setAttribute('cx', ballX);
            ball.setAttribute('cy', y);
            if (Math.abs(ballX - L) <= 1) {
                info.textContent = '封面拉力 0，等于没拉；小球现在贴在妹妹这边。';
            } else {
                info.textContent = '封面没拉，松手后妹妹这边会把小球拽回去。';
            }
        }

        function animate() {
            var force = (xEq - ballX) * K;
            v += force;
            v *= DAMP;
            ballX += v;
            if (Math.abs(xEq - ballX) <= 0.4 && Math.abs(v) <= 0.4) {
                ballX = xEq;
                v = 0;
                render();
                return;
            }
            render();
            raf = requestAnimationFrame(animate);
        }
        function startAnim() {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(animate);
        }

        /* 指针拖动（水平） */
        function pointerX(e) {
            var rect = svg.getBoundingClientRect();
            return e.clientX - rect.left;
        }
        var capturedPointerId = null;
        ball.addEventListener('pointerdown', function (e) {
            dragging = true;
            if (raf) cancelAnimationFrame(raf);
            v = 0;
            ball.style.cursor = 'grabbing';
            try {
                ball.setPointerCapture(e.pointerId);
                capturedPointerId = e.pointerId;
            } catch (err) {
                capturedPointerId = null;
            }
            markDone();
        });
        ball.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            ballX = Math.max(L, Math.min(R, pointerX(e)));
            render();
        });
        function endDrag(e) {
            if (!dragging) return;
            dragging = false;
            try {
                if (capturedPointerId !== null && ball.hasPointerCapture && ball.hasPointerCapture(capturedPointerId)) {
                    ball.releasePointerCapture(capturedPointerId);
                }
            } catch (err) {
                // 有些合成事件没有活动指针，不影响真实手势
            }
            capturedPointerId = null;
            ball.style.cursor = 'grab';
            startAnim();
        }
        ball.addEventListener('pointerup', endDrag);
        ball.addEventListener('pointercancel', endDrag);

        var timer = null;
        window.addEventListener('resize', function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () {
                computeGeometry();
                if (!dragging) { ballX = Math.max(L, Math.min(R, ballX)); render(); }
            }, 150);
        });

        requestAnimationFrame(function () {
            computeGeometry();
            ballX = xEq;
            v = 0;
            render();
        });
    }

    window.renderSpringPull = renderSpringPull;
})();
