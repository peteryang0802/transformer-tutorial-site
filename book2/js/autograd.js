/* ============================================================
 * 微型自动微分引擎（纯 JS，无依赖）
 * 矩阵级计算图：基础算子记录局部梯度，反向自动穿过任意组合。
 * 张量用 Float64Array + 形状(r 行, c 列)表示，索引 i*c+j。
 * 浏览器挂 window.TinyAutograd；Node 下走 module.exports。
 * ============================================================ */
(function (global) {
    'use strict';

    // ---- 张量节点 ----
    function Node(data, r, c) {
        this.data = data;
        this.r = r;
        this.c = c;
        this.grad = new Float64Array(data.length);
        this.parents = [];
        this._backward = null;
    }
    Node.prototype.zeroGrad = function () {
        this.grad.fill(0);
    };

    // 本次前向的计算带（有序）；为 null 时算子只算值不记录
    let tape = null;
    function beginTape() { tape = []; }
    function endTape() { tape = null; }
    function register(node, parents, backward) {
        node.parents = parents;
        node._backward = backward;
        if (tape) tape.push(node);
        return node;
    }

    function tensor(r, c, fill) {
        const data = new Float64Array(r * c);
        if (fill) for (let i = 0; i < data.length; i++) data[i] = fill(i);
        return new Node(data, r, c);
    }

    // ---- 反向：从损失节点逆序回传 ----
    function backward(lossNode) {
        if (!(lossNode instanceof Node)) throw new Error('backward 需要节点');
        lossNode.grad.fill(1);
        for (let i = tape.length - 1; i >= 0; i--) {
            const n = tape[i];
            if (n._backward) n._backward();
        }
    }

    function getTape() { return tape; }

    // ============ 算子 ============

    // 矩阵乘 A[r,k] × B[k,c]
    function matmul(A, B) {
        const r = A.r, k = A.c, c = B.c;
        if (B.r !== k) throw new Error('矩阵形状对不上：' + A.c + ' vs ' + B.r);
        const out = new Float64Array(r * c);
        for (let i = 0; i < r; i++) {
            for (let t = 0; t < k; t++) {
                const a = A.data[i * k + t];
                if (a === 0) continue;
                for (let j = 0; j < c; j++) {
                    out[i * c + j] += a * B.data[t * c + j];
                }
            }
        }
        const N = new Node(out, r, c);
        return register(N, [A, B], function () {
            const g = N.grad;
            for (let i = 0; i < r; i++) {
                for (let t = 0; t < k; t++) {
                    let ga = 0;
                    const a = A.data[i * k + t];
                    for (let j = 0; j < c; j++) {
                        const gv = g[i * c + j];
                        ga += gv * B.data[t * c + j];
                        B.grad[t * c + j] += a * gv;
                    }
                    A.grad[i * k + t] += ga;
                }
            }
        });
    }

    // 转置 A[r,c] -> [c,r]
    function transpose(A) {
        const r = A.r, c = A.c;
        const out = new Float64Array(r * c);
        for (let i = 0; i < r; i++)
            for (let j = 0; j < c; j++)
                out[j * r + i] = A.data[i * c + j];
        const N = new Node(out, c, r);
        return register(N, [A], function () {
            const g = N.grad;
            for (let i = 0; i < r; i++)
                for (let j = 0; j < c; j++)
                    A.grad[i * c + j] += g[j * r + i];
        });
    }

    // 逐元素相加（同形状，残差用）
    function add(A, B) {
        if (A.r !== B.r || A.c !== B.c) throw new Error('add 形状不一致');
        const out = new Float64Array(A.data.length);
        for (let i = 0; i < out.length; i++) out[i] = A.data[i] + B.data[i];
        const N = new Node(out, A.r, A.c);
        return register(N, [A, B], function () {
            const g = N.grad;
            for (let i = 0; i < g.length; i++) {
                A.grad[i] += g[i];
                B.grad[i] += g[i];
            }
        });
    }

    // 加偏置（行向量 b[1,c] 广播到 r 行）
    function addBias(A, b) {
        const r = A.r, c = A.c;
        const out = new Float64Array(r * c);
        for (let i = 0; i < r; i++)
            for (let j = 0; j < c; j++)
                out[i * c + j] = A.data[i * c + j] + b.data[j];
        const N = new Node(out, r, c);
        return register(N, [A, b], function () {
            const g = N.grad;
            for (let i = 0; i < r; i++)
                for (let j = 0; j < c; j++) {
                    A.grad[i * c + j] += g[i * c + j];
                    b.grad[j] += g[i * c + j];
                }
        });
    }

    // 乘常数
    function scale(A, s) {
        const out = new Float64Array(A.data.length);
        for (let i = 0; i < out.length; i++) out[i] = A.data[i] * s;
        const N = new Node(out, A.r, A.c);
        return register(N, [A], function () {
            const g = N.grad;
            for (let i = 0; i < g.length; i++) A.grad[i] += g[i] * s;
        });
    }

    // ReLU
    function relu(A) {
        const out = new Float64Array(A.data.length);
        for (let i = 0; i < out.length; i++) out[i] = Math.max(A.data[i], 0);
        const N = new Node(out, A.r, A.c);
        return register(N, [A], function () {
            const g = N.grad;
            for (let i = 0; i < g.length; i++)
                if (A.data[i] > 0) A.grad[i] += g[i];
        });
    }

    // 按行 softmax（每行长度 c）
    function rowSoftmax(A) {
        const r = A.r, c = A.c;
        const out = new Float64Array(r * c);
        for (let i = 0; i < r; i++) {
            let m = -Infinity;
            for (let j = 0; j < c; j++) m = Math.max(m, A.data[i * c + j]);
            let sum = 0;
            for (let j = 0; j < c; j++) {
                const e = Math.exp(A.data[i * c + j] - m);
                out[i * c + j] = e;
                sum += e;
            }
            for (let j = 0; j < c; j++) out[i * c + j] /= sum;
        }
        const N = new Node(out, r, c);
        return register(N, [A], function () {
            const g = N.grad;
            for (let i = 0; i < r; i++) {
                let dot = 0;
                for (let j = 0; j < c; j++) dot += g[i * c + j] * out[i * c + j];
                for (let j = 0; j < c; j++) {
                    A.grad[i * c + j] += out[i * c + j] * (g[i * c + j] - dot);
                }
            }
        });
    }

    // 因果掩码：T×T 上，严格上三角(j>i)置为大负数
    const NEG = -1e9;
    function causalMask(A) {
        const r = A.r, c = A.c;
        const out = new Float64Array(r * c);
        for (let i = 0; i < r; i++)
            for (let j = 0; j < c; j++)
                out[i * c + j] = (j > i) ? NEG : A.data[i * c + j];
        const N = new Node(out, r, c);
        return register(N, [A], function () {
            const g = N.grad;
            for (let i = 0; i < r; i++)
                for (let j = 0; j < c; j++)
                    if (j <= i) A.grad[i * c + j] += g[i * c + j];
        });
    }

    // 按列拼接若干 [T×c_h] -> [T×sum]
    function concatColumns(list) {
        const r = list[0].r;
        const widths = list.map(function (m) { return m.c; });
        const total = widths.reduce(function (a, b) { return a + b; }, 0);
        const out = new Float64Array(r * total);
        for (let i = 0; i < r; i++) {
            let off = 0;
            for (let h = 0; h < list.length; h++) {
                for (let j = 0; j < widths[h]; j++) {
                    out[i * total + off + j] = list[h].data[i * widths[h] + j];
                }
                off += widths[h];
            }
        }
        const N = new Node(out, r, total);
        return register(N, list, function () {
            const g = N.grad;
            for (let i = 0; i < r; i++) {
                let off = 0;
                for (let h = 0; h < list.length; h++) {
                    for (let j = 0; j < widths[h]; j++) {
                        list[h].grad[i * widths[h] + j] += g[i * total + off + j];
                    }
                    off += widths[h];
                }
            }
        });
    }

    // 层归一化（对每行特征 d），gamma/beta 为 1×d
    function layerNorm(A, gamma, beta, eps) {
        eps = eps == null ? 1e-5 : eps;
        const r = A.r, d = A.c;
        const mean = new Float64Array(r), inv = new Float64Array(r);
        const xhat = new Float64Array(r * d);
        const out = new Float64Array(r * d);
        for (let i = 0; i < r; i++) {
            let m = 0;
            for (let j = 0; j < d; j++) m += A.data[i * d + j];
            m /= d;
            let v = 0;
            for (let j = 0; j < d; j++) {
                const c = A.data[i * d + j] - m;
                xhat[i * d + j] = c;
                v += c * c;
            }
            const iv = 1 / Math.sqrt(v / d + eps);
            mean[i] = m; inv[i] = iv;
            for (let j = 0; j < d; j++) {
                xhat[i * d + j] *= iv;
                out[i * d + j] = xhat[i * d + j] * gamma.data[j] + beta.data[j];
            }
        }
        const N = new Node(out, r, d);
        return register(N, [A, gamma, beta], function () {
            const g = N.grad;
            for (let i = 0; i < r; i++) {
                const iv = inv[i];
                let sumG = 0, sumGX = 0;
                for (let j = 0; j < d; j++) {
                    const gx = g[i * d + j] * gamma.data[j];
                    sumG += gx;
                    sumGX += gx * xhat[i * d + j];
                    beta.grad[j] += g[i * d + j];
                    gamma.grad[j] += g[i * d + j] * xhat[i * d + j];
                }
                for (let j = 0; j < d; j++) {
                    const gx = g[i * d + j] * gamma.data[j];
                    const dx = (iv / d) * (d * gx - sumG - xhat[i * d + j] * sumGX);
                    A.grad[i * d + j] += dx;
                }
            }
        });
    }

    // 查表：table[V×d]，ids 长度 T，输出 T×d
    function embedding(table, ids) {
        const d = table.c, T = ids.length;
        const out = new Float64Array(T * d);
        for (let i = 0; i < T; i++) {
            const row = ids[i];
            for (let j = 0; j < d; j++) out[i * d + j] = table.data[row * d + j];
        }
        const N = new Node(out, T, d);
        return register(N, [table], function () {
            const g = N.grad;
            for (let i = 0; i < T; i++) {
                const row = ids[i];
                for (let j = 0; j < d; j++) {
                    table.grad[row * d + j] += g[i * d + j];
                }
            }
        });
    }

    // 交叉熵：logits[T×V]，targets 长度 T，输出 1×1 平均损失
    function crossEntropy(logits, targets) {
        const T = logits.r, V = logits.c;
        const probs = new Float64Array(T * V);
        let loss = 0;
        for (let i = 0; i < T; i++) {
            let m = -Infinity;
            for (let v = 0; v < V; v++) m = Math.max(m, logits.data[i * V + v]);
            let sum = 0;
            for (let v = 0; v < V; v++) {
                const e = Math.exp(logits.data[i * V + v] - m);
                probs[i * V + v] = e;
                sum += e;
            }
            for (let v = 0; v < V; v++) probs[i * V + v] /= sum;
            loss += -Math.log(probs[i * V + targets[i]]);
        }
        const N = new Node(new Float64Array([loss / T]), 1, 1);
        return register(N, [logits], function () {
            for (let i = 0; i < T; i++) {
                for (let v = 0; v < V; v++) {
                    logits.grad[i * V + v] += (1 / T) * (probs[i * V + v] - (v === targets[i] ? 1 : 0));
                }
            }
        });
    }

    const api = {
        Node: Node, tensor: tensor,
        beginTape: beginTape, endTape: endTape, backward: backward, getTape: getTape,
        matmul: matmul, transpose: transpose, add: add, addBias: addBias,
        scale: scale, relu: relu, rowSoftmax: rowSoftmax, causalMask: causalMask,
        concatColumns: concatColumns, layerNorm: layerNorm,
        embedding: embedding, crossEntropy: crossEntropy, NEG: NEG
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    global.TinyAutograd = api;
})(typeof window !== 'undefined' ? window : global);
