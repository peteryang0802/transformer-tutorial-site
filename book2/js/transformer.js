/* ============================================================
 * 真实的小型 decoder-only Transformer（纯 JS，无依赖）
 * 结构齐全：token/位置嵌入、多头因果自注意力、FFN、残差、层归一化、
 * 多层、输出投影。梯度由 TinyAutograd 自动回传，优化器用 Adam。
 * 浏览器挂 window.TinyTransformer；Node 下走 module.exports。
 * ============================================================ */
(function (global) {
    'use strict';
    const AG = (typeof module !== 'undefined' && module.exports)
        ? require('./autograd.js')
        : global.TinyAutograd;

    function mulberry32(seed) {
        return function () {
            seed |= 0;
            seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function makeTransformer(cfg, seed) {
        const V = cfg.V, d = cfg.d, H = cfg.H, dh = cfg.dh;
        const dff = cfg.dff, L = cfg.L, Tmax = cfg.Tmax;
        const rng = mulberry32(seed == null ? 7 : seed);

        // 小随机权重，范围按 fan-in 收一下
        function randNode(r, c, fan) {
            const bound = Math.sqrt(1 / (fan || c));
            return AG.tensor(r, c, function () { return (rng() - 0.5) * 2 * bound; });
        }
        function onesNode(c) {
            return AG.tensor(1, c, function () { return 1; });
        }
        function zerosNode(c) {
            return AG.tensor(1, c, function () { return 0; });
        }

        // ---- 参数 ----
        const tok = randNode(V, d, d);
        const pos = randNode(Tmax, d, d);
        const layers = [];
        for (let l = 0; l < L; l++) {
            const q = [], k = [], v = [];
            for (let h = 0; h < H; h++) {
                q.push(randNode(d, dh, d));
                k.push(randNode(d, dh, d));
                v.push(randNode(d, dh, d));
            }
            layers.push({
                q: q, k: k, v: v,
                o: randNode(d, d, d),
                ln1g: onesNode(d), ln1b: zerosNode(d),
                w1: randNode(d, dff, d), w2: randNode(dff, d, dff),
                ln2g: onesNode(d), ln2b: zerosNode(d)
            });
        }
        const outW = randNode(d, V, d);

        // 收集全部参数节点
        const allParams = [tok, pos];
        layers.forEach(function (ly) {
            for (let h = 0; h < H; h++) allParams.push(ly.q[h], ly.k[h], ly.v[h]);
            allParams.push(ly.o, ly.ln1g, ly.ln1b, ly.w1, ly.w2, ly.ln2g, ly.ln2b);
        });
        allParams.push(outW);

        function zeroGrads() {
            allParams.forEach(function (p) { p.zeroGrad(); });
        }

        // ---- 前向 ----
        function forward(ids, targets) {
            AG.beginTape();
            const T = ids.length;
            const posIds = [];
            for (let i = 0; i < T; i++) posIds.push(i);
            let x = AG.add(AG.embedding(tok, ids), AG.embedding(pos, posIds));

            for (let li = 0; li < L; li++) {
                const ly = layers[li];
                // 多头因果自注意力（Pre-LN）
                const n = AG.layerNorm(x, ly.ln1g, ly.ln1b);
                const heads = [];
                for (let h = 0; h < H; h++) {
                    const Q = AG.matmul(n, ly.q[h]);
                    const K = AG.matmul(n, ly.k[h]);
                    const Vv = AG.matmul(n, ly.v[h]);
                    let scores = AG.matmul(Q, AG.transpose(K));
                    scores = AG.scale(scores, 1 / Math.sqrt(dh));
                    scores = AG.causalMask(scores);
                    const att = AG.rowSoftmax(scores);
                    heads.push(AG.matmul(att, Vv));
                }
                const ctx = AG.matmul(AG.concatColumns(heads), ly.o);
                x = AG.add(x, ctx);
                // FFN（Pre-LN）
                const n2 = AG.layerNorm(x, ly.ln2g, ly.ln2b);
                const hid = AG.relu(AG.matmul(n2, ly.w1));
                x = AG.add(x, AG.matmul(hid, ly.w2));
            }
            const logits = AG.matmul(x, outW);
            if (targets) {
                const loss = AG.crossEntropy(logits, targets);
                return { loss: loss, logits: logits };
            }
            return { logits: logits };
        }

        // 纯前向（不记录，用于采样）
        function predictLogits(ids) {
            AG.endTape();
            return forward(ids, null).logits;
        }

        // ---- 参数计数 ----
        let paramCount = 0;
        allParams.forEach(function (p) { paramCount += p.data.length; });

        return {
            cfg: cfg, allParams: allParams, paramCount: paramCount,
            forward: forward, predictLogits: predictLogits, zeroGrads: zeroGrads,
            // 序列化用：把每个参数转成普通数组
            exportArrays: function () {
                return allParams.map(function (p) {
                    return Array.prototype.slice.call(p.data);
                });
            }
        };
    }

    // ============ Adam 优化器 ============
    function makeAdam(params, lr, beta1, beta2, eps) {
        beta1 = beta1 || 0.9; beta2 = beta2 || 0.999; eps = eps || 1e-8;
        const m = params.map(function (p) { return new Float64Array(p.data.length); });
        const v = params.map(function (p) { return new Float64Array(p.data.length); });
        let t = 0;
        return {
            step: function () {
                t++;
                for (let pi = 0; pi < params.length; pi++) {
                    const g = params[pi].grad, d = params[pi].data;
                    for (let i = 0; i < d.length; i++) {
                        m[pi][i] = beta1 * m[pi][i] + (1 - beta1) * g[i];
                        v[pi][i] = beta2 * v[pi][i] + (1 - beta2) * g[i] * g[i];
                        const mh = m[pi][i] / (1 - Math.pow(beta1, t));
                        const vh = v[pi][i] / (1 - Math.pow(beta2, t));
                        d[i] -= lr * mh / (Math.sqrt(vh) + eps);
                    }
                }
            }
        };
    }

    // ============ 真实采样 ============
    // 给定前缀，按温度/top-k/top-p 逐词采样，rng 可注入
    function sample(model, prefixIds, opts) {
        opts = opts || {};
        const maxNew = opts.maxNew || 16;
        const eos = opts.eos;
        const temp = opts.temperature == null ? 1.0 : opts.temperature;
        const topK = opts.topK || 0;
        const topP = opts.topP || 1.0;
        const rng = opts.rng || Math.random;
        const ids = prefixIds.slice();

        for (let step = 0; step < maxNew; step++) {
            const logitsNode = model.predictLogits(ids);
            const V = logitsNode.c;
            const last = (logitsNode.r - 1) * V;
            let z = [];
            for (let v = 0; v < V; v++) z.push(logitsNode.data[last + v] / temp);

            // top-k：其余置大负
            if (topK > 0 && topK < V) {
                const sorted = z.slice().sort(function (a, b) { return b - a; });
                const cutoff = sorted[topK - 1];
                for (let v = 0; v < V; v++) if (z[v] < cutoff) z[v] = -1e9;
            }

            // softmax
            let m = -Infinity;
            z.forEach(function (a) { m = Math.max(m, a); });
            let probs = z.map(function (a) { return Math.exp(a - m); });
            const sum = probs.reduce(function (a, b) { return a + b; }, 0);
            probs = probs.map(function (a) { return a / sum; });

            // top-p（核采样）：按概率从高到低累计，超出的去掉，再归一化
            if (topP < 1.0) {
                const order = probs.map(function (p, i) { return i; })
                    .sort(function (a, b) { return probs[b] - probs[a]; });
                let cum = 0;
                const keep = new Array(V).fill(false);
                for (let t = 0; t < order.length; t++) {
                    keep[order[t]] = true;
                    cum += probs[order[t]];
                    if (cum >= topP) break;
                }
                let s2 = 0;
                for (let v = 0; v < V; v++) { if (!keep[v]) probs[v] = 0; s2 += probs[v]; }
                for (let v = 0; v < V; v++) probs[v] /= s2;
            }

            // 按概率抽一个
            const r = rng();
            let acc = 0, pick = V - 1;
            for (let v = 0; v < V; v++) {
                acc += probs[v];
                if (r <= acc) { pick = v; break; }
            }
            ids.push(pick);
            if (eos != null && pick === eos) break;
        }
        return ids;
    }

    const api = {
        makeTransformer: makeTransformer,
        makeAdam: makeAdam,
        sample: sample,
        mulberry32: mulberry32
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    global.TinyTransformer = api;
})(typeof window !== 'undefined' ? window : global);
