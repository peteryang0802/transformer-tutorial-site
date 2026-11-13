/* ============================================================
 * 原句 Token 条通用组件 TokenStrip
 * 用法：TokenStrip.render(容器, {
 *   title: 可选标题,
 *   highlight: [3,15,20],   // 1-based 位置，要高亮的
 *   showNumbers: true       // 格子里是否显示小编号
 * })
 * 31 个 token 小格子按顺序排、自然换行，不横向滚动。
 * ============================================================ */
(function (global) {
    'use strict';

    function isPunct(t) {
        return t === '，' || t === '。' || t === '、';
    }

    function render(container, cfg) {
        var SD = global.SentenceData;
        if (!SD) throw new Error('TokenStrip 需要先加载 sentence-data.js');

        var hl = {};
        (cfg.highlight || []).forEach(function (p) { hl[p] = true; });

        container.classList.add('ts-wrap');
        var html = '';
        if (cfg.title) html += '<div class="ts-title">' + cfg.title + '</div>';
        html += '<div class="ts-strip">';
        for (var pos = 1; pos <= SD.count; pos++) {
            var t = SD.tokenAt(pos);
            var cls = 'ts-token';
            if (isPunct(t)) cls += ' ts-punct';
            if (hl[pos]) cls += ' ts-hl';
            html += '<span class="' + cls + '" data-pos="' + pos + '">';
            if (cfg.showNumbers) html += '<i class="ts-num">' + pos + '</i>';
            html += '<b class="ts-word">' + t + '</b>';
            html += '</span>';
        }
        html += '</div>';
        container.innerHTML = html;
    }

    global.TokenStrip = { render: render };
})(window);
