/* 通用 SVG 锚定连线工具
 * 响应式页面里，把若干“源元素”用 SVG 连线精确锚到一个目标（内部焦点圆或外部元素）。
 * 坐标用 getBoundingClientRect 实测，不写死 viewBox；初始化、窗口 resize、元素显示后自动重算。
 *
 * 用法：
 *   var ctl = AnchorLines.connect({
 *       host: 放 SVG 的容器,
 *       sources: 源元素数组（也可传函数，动态返回）,
 *       weights: 每个源的权重 0..1 数组（也可传函数），决定线粗细/浓淡,
 *       color: 统一线颜色，或用 colors 逐个指定,
 *       target: 目标元素；不传则在 SVG 底部居中画一个焦点圆,
 *       minWidth/maxWidth: 线宽范围，sourceEdge: 'bottom'（默认）或 'center'
 *   });
 *   ctl.update() 手动重算；ctl.destroy() 移除。
 */
(function () {
    'use strict';
    var NS = 'http://www.w3.org/2000/svg';

    function resolve(v) {
        return typeof v === 'function' ? v() : v;
    }

    function connect(opts) {
        var host = opts.host;
        var svg = document.createElementNS(NS, 'svg');
        svg.classList.add('anchor-svg');
        if (opts.svgClass) svg.classList.add(opts.svgClass);
        host.appendChild(svg);

        var focus = null;
        if (!opts.target) {
            focus = document.createElementNS(NS, 'circle');
            focus.setAttribute('r', opts.focusR || 10);
            focus.setAttribute('fill', opts.focusColor || opts.color || '#6366f1');
            svg.appendChild(focus);
        }

        var lines = [];
        function ensureLines(n) {
            while (lines.length < n) {
                var l = document.createElementNS(NS, 'line');
                l.setAttribute('stroke-linecap', 'round');
                svg.appendChild(l);
                lines.push(l);
            }
            while (lines.length > n) {
                svg.removeChild(lines.pop());
            }
        }

        function colorFor(i) {
            if (opts.colors && opts.colors[i]) return opts.colors[i];
            return opts.color || '#6366f1';
        }

        function layout() {
            var rect = svg.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) return;
            svg.setAttribute('viewBox', '0 0 ' + rect.width + ' ' + rect.height);

            var tx, ty;
            if (opts.target) {
                var tr = opts.target.getBoundingClientRect();
                tx = tr.left + tr.width / 2 - rect.left;
                ty = tr.top + tr.height / 2 - rect.top;
            } else {
                tx = rect.width / 2;
                ty = rect.height - (opts.focusPadding != null ? opts.focusPadding : 16);
                focus.setAttribute('cx', tx);
                focus.setAttribute('cy', ty);
            }

            var sources = resolve(opts.sources) || [];
            var weights = resolve(opts.weights) || [];
            ensureLines(sources.length);
            var minW = opts.minWidth != null ? opts.minWidth : 1;
            var maxW = opts.maxWidth != null ? opts.maxWidth : 10;

            sources.forEach(function (src, i) {
                var sr = src.getBoundingClientRect();
                var sx = sr.left + sr.width / 2 - rect.left;
                var sy = opts.sourceEdge === 'center'
                    ? sr.top + sr.height / 2 - rect.top
                    : sr.bottom - rect.top;
                var line = lines[i];
                line.setAttribute('x1', sx);
                line.setAttribute('y1', sy);
                line.setAttribute('x2', tx);
                line.setAttribute('y2', ty);
                line.setAttribute('stroke', colorFor(i));
                var w = weights[i] != null ? weights[i] : 0;
                line.setAttribute('stroke-width', minW + w * (maxW - minW));
                if (opts.opacity !== false) {
                    line.setAttribute('opacity', 0.35 + w * 0.65);
                }
            });
        }

        var rafId = requestAnimationFrame(layout);
        var timer = null;
        function onResize() {
            if (timer) clearTimeout(timer);
            timer = setTimeout(layout, 150);
        }
        window.addEventListener('resize', onResize);

        return {
            update: layout,
            destroy: function () {
                cancelAnimationFrame(rafId);
                window.removeEventListener('resize', onResize);
                if (timer) clearTimeout(timer);
                if (svg.parentNode) svg.parentNode.removeChild(svg);
            }
        };
    }

    window.AnchorLines = { connect: connect };
})();
