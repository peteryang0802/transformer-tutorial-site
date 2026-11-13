/* ============================================================
 * 第 13 坎：童话搅拌机的词表与训练语料
 * 词级 token，覆盖 6 个童话元素 + 少量连接/场景词。
 * 语料是真实 token 序列，模型从中学接词概率，生成时按 logits 采样。
 * ============================================================ */
(function (global) {
    'use strict';

    // 索引即 token id，前两个是特殊符号
    const VOCAB = [
        'BOS', 'EOS',
        // 6 个童话元素（id 2-7）
        '水晶鞋', '南瓜马车', '舞会', '火柴', '奶奶', '雪花',
        // 动词 / 场景 / 连接（id 8-39）
        '静静', '安静', '慢慢', '亮', '亮闪闪', '暖', '冒', '飘', '落',
        '躺', '待', '靠', '坐', '跑', '转', '看', '笑', '进', '向',
        '上', '里', '旁边', '夜色', '光', '圈', '窗边', '角落', '一起',
        '谁', '也', '不', '分不清'
    ];
    const ID = {};
    VOCAB.forEach(function (w, i) { ID[w] = i; });

    // 把一句话（空格分词）转成 id 序列
    function seq(text) {
        return text.split(/\s+/).filter(Boolean).map(function (w) {
            if (ID[w] == null) throw new Error('词表里没有这个词：' + w);
            return ID[w];
        });
    }

    // 单元素基础句：学每个元素的典型搭配
    const BASE = [
        'BOS 水晶鞋 静静 躺 夜色 里 EOS',
        'BOS 水晶鞋 亮闪闪 安静 待 夜色 里 EOS',
        'BOS 南瓜马车 慢慢 跑 向 夜色 里 EOS',
        'BOS 舞会 上 光 亮闪闪 转 圈 EOS',
        'BOS 火柴 亮 暖 光 静静 冒 EOS',
        'BOS 奶奶 安静 坐 窗边 笑 EOS',
        'BOS 雪花 静静 飘 落 夜色 里 EOS'
    ];

    // 两两组合句：以 BOS + 元素A + 元素B 开头，覆盖全部 15 对
    const PAIRS = [
        'BOS 水晶鞋 南瓜马车 旁边 静静 待 夜色 里 EOS',
        'BOS 水晶鞋 舞会 上 亮闪闪 转 圈 EOS',
        'BOS 水晶鞋 火柴 旁边 一起 亮 暖 光 EOS',
        'BOS 水晶鞋 奶奶 旁边 安静 笑 EOS',
        'BOS 水晶鞋 雪花 上 静静 亮 光 EOS',
        'BOS 南瓜马车 舞会 旁边 慢慢 转 圈 EOS',
        'BOS 南瓜马车 火柴 里 暖 光 静静 亮 EOS',
        'BOS 南瓜马车 奶奶 上 安静 坐 笑 EOS',
        'BOS 南瓜马车 雪花 旁边 静静 飘 落 EOS',
        'BOS 舞会 火柴 角落 里 暖 光 冒 EOS',
        'BOS 舞会 奶奶 旁边 安静 看 笑 EOS',
        'BOS 舞会 雪花 里 慢慢 飘 转 圈 EOS',
        'BOS 火柴 奶奶 旁边 暖 光 一起 冒 EOS',
        'BOS 火柴 雪花 上 光 静静 亮 EOS',
        'BOS 奶奶 雪花 窗边 静静 飘 安静 笑 EOS'
    ];

    const TRAIN = BASE.concat(PAIRS).map(seq);

    const api = {
        VOCAB: VOCAB, ID: ID, TRAIN: TRAIN,
        BOS: ID.BOS, EOS: ID.EOS,
        // 元素名 -> id
        elementId: function (name) { return ID[name]; }
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    global.MixerData = api;
})(typeof window !== 'undefined' ? window : global);
