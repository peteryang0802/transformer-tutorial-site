/* 通用站内全屏看图：点任意带 .zoomable 的图片弹出全屏查看，不离开页面。
 * 竖长图可上下滑动，点空白、关闭按钮或按 Esc 退出。自包含，事件委托。
 */
(function () {
    'use strict';

    var overlay = document.createElement('div');
    overlay.className = 'lb-overlay';

    var bigImg = document.createElement('img');
    bigImg.alt = '';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'lb-close';
    closeBtn.setAttribute('aria-label', '关闭大图');
    closeBtn.innerHTML = '&times;';

    var hint = document.createElement('p');
    hint.className = 'lb-hint';
    hint.textContent = '点空白处或右上角关闭，长图可上下滑动';

    overlay.appendChild(bigImg);
    overlay.appendChild(hint);
    overlay.appendChild(closeBtn);

    function open(src, alt) {
        bigImg.src = src;
        bigImg.alt = alt || '';
        bigImg.style.width = '';
        overlay.scrollTop = 0;
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        bigImg.onload = function () {
            // 手机上放大到 2.5 倍视口宽，但不超过原图，细节看得清；超出部分可左右、上下滑动
            var target = Math.min(bigImg.naturalWidth, window.innerWidth * 2.5);
            bigImg.style.width = target + 'px';
            overlay.scrollTop = 0;
            overlay.scrollLeft = 0;
        };
    }

    function close() {
        overlay.classList.remove('open');
        bigImg.src = '';
        document.body.style.overflow = '';
    }

    closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        close();
    });

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });

    document.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.tagName === 'IMG' && t.classList.contains('zoomable')) {
            e.preventDefault();
            open(t.src, t.alt);
        }
    });

    function init() {
        if (!document.body.contains(overlay)) document.body.appendChild(overlay);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
