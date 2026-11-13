/* ============================================================
 * 原句与 Token 共享数据 SentenceData（全站引用）
 * 位置约定：一律用 1-based（第 1 处 … 第 31 处），
 * 取词用 tokenAt(位置)，内部数组是 0-based。
 * ============================================================ */
(function (global) {
    'use strict';

    // 原句：昨天，小明把妈妈买的那本蓝色封面的故事书借给了住在上海的妹妹，因为她下周要给孩子讲这个故事。
    var TOKENS = [
        '昨天', '，', '小明', '把', '妈妈', '买', '的', '那', '本', '蓝色',
        '封面', '的', '故事', '书', '借给', '了', '住在', '上海', '的', '妹妹',
        '，', '因为', '她', '下周', '要', '给', '孩子', '讲', '这个', '故事', '。'
    ];

    global.SentenceData = {
        tokens: TOKENS,
        count: TOKENS.length,
        // 三个关键位置（1-based）
        keyPositions: { xiaoMing: 3, jieGei: 15, meiMei: 20 },
        // 按 1-based 位置取 token
        tokenAt: function (pos) { return TOKENS[pos - 1]; }
    };
})(window);
