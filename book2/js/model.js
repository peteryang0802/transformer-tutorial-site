/* ============================================================
 * 最小可训练模型（纯 JS，无依赖）
 * 数学是真的：前向 -> softmax -> 交叉熵 -> 解析梯度 -> 梯度下降
 * 故意做得很小：输入档案 d 维、词表 C 个候选，参数少到能数清。
 * ============================================================ */
(function (global) {
    'use strict';

    // 可复现的伪随机（让每次重置都长得一样）
    function mulberry32(seed) {
        return function () {
            seed |= 0;
            seed = (seed + 0x6D2B79F5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function softmax(logits) {
        var m = Math.max.apply(null, logits);
        var ex = logits.map(function (z) { return Math.exp(z - m); });
        var s = ex.reduce(function (a, b) { return a + b; }, 0);
        return ex.map(function (e) { return e / s; });
    }

    function createModel(opts) {
        opts = opts || {};
        var d = opts.d || 3;
        var C = opts.C || 5;
        var rng = mulberry32(opts.seed || 7);

        // 配方参数：输出权重 W（d×C）、偏置 b（C）
        var W = [], b = [];
        for (var i = 0; i < d; i++) {
            var row = [];
            for (var j = 0; j < C; j++) row.push((rng() - 0.5) * 0.6);
            W.push(row);
        }
        for (var k = 0; k < C; k++) b.push(0);

        // 训练样本：每个是一道题 {x: 上文档案, target: 正确候选下标}
        var samples = opts.samples || [];

        // 前向：档案 -> 打分 -> 概率
        function forward(x) {
            var logits = new Array(C).fill(0);
            for (var j = 0; j < C; j++) {
                var s = b[j];
                for (var i = 0; i < d; i++) s += x[i] * W[i][j];
                logits[j] = s;
            }
            return { logits: logits, probs: softmax(logits) };
        }

        // 单题：损失 + 梯度（softmax 配交叉熵，梯度很干净）
        function lossGrad(x, target) {
            var out = forward(x);
            var probs = out.probs;
            var loss = -Math.log(probs[target]);
            // 对打分的梯度：正确候选减 1，其余不变
            var g = probs.map(function (p, j) { return p - (j === target ? 1 : 0); });
            // 再传回 W、b
            var gW = [];
            for (var i = 0; i < d; i++) {
                var grow = [];
                for (var j = 0; j < C; j++) grow.push(x[i] * g[j]);
                gW.push(grow);
            }
            return { logits: out.logits, probs: probs, loss: loss, g: g, gW: gW, gb: g.slice() };
        }

        // 一批题：梯度平均，再更新一次；返回平均损失和平均梯度
        function trainStep(lr) {
            var accGW = [], accGB = new Array(C).fill(0), totalLoss = 0;
            for (var i = 0; i < d; i++) accGW.push(new Array(C).fill(0));

            for (var s = 0; s < samples.length; s++) {
                var r = lossGrad(samples[s].x, samples[s].target);
                totalLoss += r.loss;
                for (var ii = 0; ii < d; ii++)
                    for (var jj = 0; jj < C; jj++) accGW[ii][jj] += r.gW[ii][jj];
                for (var j = 0; j < C; j++) accGB[j] += r.gb[j];
            }

            var n = samples.length;
            for (var a = 0; a < d; a++)
                for (var c = 0; c < C; c++) {
                    accGW[a][c] /= n;
                    W[a][c] -= lr * accGW[a][c];
                }
            for (var bb = 0; bb < C; bb++) {
                accGB[bb] /= n;
                b[bb] -= lr * accGB[bb];
            }
            return { loss: totalLoss / n, gW: accGW, gb: accGB };
        }

        return {
            d: d, C: C, samples: samples,
            W: W, b: b,
            forward: forward, lossGrad: lossGrad, trainStep: trainStep
        };
    }

    global.TinyLab = { createModel: createModel, softmax: softmax, mulberry32: mulberry32 };
})(window);
