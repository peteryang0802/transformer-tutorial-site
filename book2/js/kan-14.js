/* ============================================================
 * 第 14 坎：幻觉 vs RAG 对比
 * 同一个问题，直接回答（可能瞎编）/ 先翻资料（带依据）
 * ============================================================ */
var PostTrainDemo = (function () {
    'use strict';

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function render(container) {
        container.innerHTML = '';

        makeIdentityTag(container, 'sim', '这里用固定文案演示流程，帮你看清两种答法的差别，不是现场真去检索。');
        container.appendChild(el('p', 'block-label', '同一个问题，两种答法'));
        var question = el('div', 'pt-question', '问：小女孩擦亮火柴，看到了谁？');
        container.appendChild(question);

        var tabs = el('div', 'cut-tabs');
        var hallucBtn = el('button', 'tbl-tab', '直接回答');
        hallucBtn.type = 'button';
        var ragBtn = el('button', 'tbl-tab', '先翻资料（RAG）');
        ragBtn.type = 'button';
        tabs.appendChild(hallucBtn);
        tabs.appendChild(ragBtn);
        container.appendChild(tabs);

        var answer = el('div', 'pt-answer', '');
        container.appendChild(answer);

        function showHalluc() {
            hallucBtn.classList.add('active');
            ragBtn.classList.remove('active');
            answer.className = 'pt-answer is-halluc';
            answer.innerHTML = '“她看到一位骑着白马的王子，王子带她去了华丽的城堡。”' +
                '<span class="pt-tag tag-halluc">没有依据，这是它顺着“童话”的样子瞎编的——就是幻觉。</span>';
        }
        function showRag() {
            ragBtn.classList.add('active');
            hallucBtn.classList.remove('active');
            answer.className = 'pt-answer is-rag';
            answer.innerHTML = '“她看到了奶奶。”' +
                '<span class="pt-tag tag-rag">依据：《卖火柴的小女孩》——火柴的光里，奶奶把她抱在怀里。先翻资料再答，就靠谱多了。</span>';
        }

        hallucBtn.addEventListener('click', showHalluc);
        ragBtn.addEventListener('click', showRag);
        showHalluc();
    }

    return { render: render };
})();
