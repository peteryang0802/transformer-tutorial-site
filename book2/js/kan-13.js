/* ============================================================
 * 第 13 坎：童话搅拌机（真实版）
 * 先在浏览器里真训练一台小 Transformer，再按 logits 真采样。
 * 温度、top-k 都真实作用在概率分布上，不是模板替换。
 * ============================================================ */
var MixerDemo = (function () {
    'use strict';

    var ELEMENTS = [
        { name: '水晶鞋', group: 'a' },
        { name: '南瓜马车', group: 'a' },
        { name: '舞会', group: 'a' },
        { name: '火柴', group: 'b' },
        { name: '奶奶', group: 'b' },
        { name: '雪花', group: 'b' }
    ];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function render(container) {
        container.innerHTML = '';

        // ---- 构建真实模型 ----
        var cfg = {
            V: MixerData.VOCAB.length, d: 16, H: 2, dh: 8,
            dff: 32, L: 2, Tmax: 12
        };
        var model = TinyTransformer.makeTransformer(cfg, 7);
        var adam = TinyTransformer.makeAdam(model.allParams, 0.01);
        var trained = false;

        // ============ 第一块：训练 ============
        makeIdentityTag(container, 'real', '下面这台小 Transformer，是在你浏览器里真算、真更新参数。');
        container.appendChild(el('p', 'block-label', '① 先让它读童话，把参数练出来（很快，大概一秒）'));
        container.appendChild(el('p', 'tip-text', '具体损失数字每次会有波动，看它一路往下走的趋势就行。'));

        var trainBtn = el('button', 'run-btn', '开始训练它');
        trainBtn.type = 'button';
        container.appendChild(trainBtn);

        var progressWrap = el('div', 'mixer-train-progress');
        var bar = el('div', 'mixer-train-bar');
        var barFill = el('div', 'mixer-train-fill');
        bar.appendChild(barFill);
        progressWrap.appendChild(bar);
        var trainStatus = el('div', 'mixer-train-status', '还没练，参数是随机的。');
        progressWrap.appendChild(trainStatus);
        progressWrap.style.display = 'none';
        container.appendChild(progressWrap);

        var TOTAL_EPOCHS = 100;
        function trainChunk(doneEpochs) {
            var perFrame = 4;
            var end = Math.min(doneEpochs + perFrame, TOTAL_EPOCHS);
            var lastLoss = 0;
            for (var e = doneEpochs; e < end; e++) {
                var sumLoss = 0;
                MixerData.TRAIN.forEach(function (full) {
                    model.zeroGrads();
                    var r = model.forward(full.slice(0, -1), full.slice(1));
                    TinyAutograd.backward(r.loss);
                    sumLoss += r.loss.data[0];
                    adam.step();
                });
                lastLoss = sumLoss / MixerData.TRAIN.length;
            }
            var frac = end / TOTAL_EPOCHS;
            barFill.style.width = (frac * 100).toFixed(0) + '%';
            trainStatus.textContent = '已读 ' + end + ' 遍，平均损失 ' + lastLoss.toFixed(3);

            if (end < TOTAL_EPOCHS) {
                setTimeout(function () { trainChunk(end); }, 0);
            } else {
                trained = true;
                trainStatus.textContent = '练好了。损失从 3 点多降到 ' + lastLoss.toFixed(3) + '，可以下锅了。';
                trainBtn.disabled = false;
                trainBtn.textContent = '再练一遍';
            }
        }

        trainBtn.addEventListener('click', function () {
            if (!trained) {
                progressWrap.style.display = 'block';
                trainBtn.disabled = true;
                trainBtn.textContent = '训练中…';
                trainChunk(0);
            } else {
                // 重新构建一台新的再练
                model = TinyTransformer.makeTransformer(cfg, 7);
                adam = TinyTransformer.makeAdam(model.allParams, 0.01);
                trained = false;
                barFill.style.width = '0%';
                trainBtn.disabled = true;
                trainBtn.textContent = '训练中…';
                trainChunk(0);
            }
        });

        // ============ 第二块：搅拌机 ============
        container.appendChild(el('p', 'block-label', '② 从架子上挑两个元素（点一下选中，再点取消）'));
        var shelf = el('div', 'mixer-shelf');
        var picked = [];
        var elemNodes = [];
        ELEMENTS.forEach(function (e) {
            var chip = el('button', 'mixer-elem group-' + e.group, e.name);
            chip.type = 'button';
            chip.addEventListener('click', function () {
                var i = picked.indexOf(e.name);
                if (i >= 0) picked.splice(i, 1);
                else if (picked.length < 2) picked.push(e.name);
                syncChips();
            });
            elemNodes.push(chip);
            shelf.appendChild(chip);
        });
        container.appendChild(shelf);
        function syncChips() {
            elemNodes.forEach(function (c) {
                c.classList.toggle('is-picked', picked.indexOf(c.textContent) >= 0);
            });
        }

        // 温度
        container.appendChild(el('p', 'block-label', '③ 拧温度（火候越大胆）'));
        var tempWrap = el('div', 'mixer-temp');
        var range = el('input', 'mixer-range');
        range.type = 'range'; range.min = '0.5'; range.max = '1.5';
        range.step = '0.1'; range.value = '1';
        var temperature = 1.0;
        var tempVal = el('span', 'mixer-temp-val', '1.0');
        range.addEventListener('input', function () {
            temperature = parseFloat(range.value);
            tempVal.textContent = temperature.toFixed(1);
        });
        tempWrap.appendChild(range);
        tempWrap.appendChild(tempVal);
        container.appendChild(tempWrap);

        // top-k
        container.appendChild(el('p', 'block-label', '④ 设个 top-k（0 就是不限制）'));
        var kWrap = el('div', 'mixer-temp');
        var kRange = el('input', 'mixer-range');
        kRange.type = 'range'; kRange.min = '0'; kRange.max = '15';
        kRange.step = '1'; kRange.value = '10';
        var topK = 10;
        var kVal = el('span', 'mixer-temp-val', '10');
        kRange.addEventListener('input', function () {
            topK = parseInt(kRange.value, 10);
            kVal.textContent = String(topK);
        });
        kWrap.appendChild(kRange);
        kWrap.appendChild(kVal);
        container.appendChild(kWrap);

        // 按钮
        var btns = el('div', 'btn-group');
        var mixBtn = el('button', 'run-btn', '开始搅拌');
        mixBtn.type = 'button';
        var resetBtn = el('button', 'run-btn btn-secondary', '清空重来');
        resetBtn.type = 'button';
        btns.appendChild(mixBtn);
        btns.appendChild(resetBtn);
        container.appendChild(btns);

        // 输出
        container.appendChild(el('p', 'block-label', '⑤ 锅里一个词一个词往外接（真按概率抽）'));
        var output = el('div', 'mixer-output', '');
        container.appendChild(output);
        var timer = null;

        function typeOut(words) {
            if (timer) clearInterval(timer);
            output.textContent = '';
            var k = 0;
            timer = setInterval(function () {
                if (k >= words.length) { clearInterval(timer); timer = null; return; }
                output.textContent += words[k];
                if (k < words.length - 1) output.textContent += ' ';
                k++;
            }, 220);
        }

        mixBtn.addEventListener('click', function () {
            if (!trained) {
                output.textContent = '得先在上面把它练出来，才能下锅。';
                return;
            }
            if (picked.length !== 2) {
                output.textContent = '得先挑够两个元素，才能下锅。';
                return;
            }
            var prefix = [MixerData.BOS, MixerData.ID[picked[0]], MixerData.ID[picked[1]]];
            var outIds = TinyTransformer.sample(model, prefix, {
                eos: MixerData.EOS,
                maxNew: 9,
                temperature: temperature,
                topK: topK,
                topP: 1.0
            });
            // 去掉 BOS，EOS 不显示
            var words = outIds.slice(1)
                .filter(function (i) { return i !== MixerData.EOS; })
                .map(function (i) { return MixerData.VOCAB[i]; });
            typeOut(words);
        });

        resetBtn.addEventListener('click', function () {
            if (timer) { clearInterval(timer); timer = null; }
            picked = [];
            output.textContent = '';
            syncChips();
        });
    }

    return { render: render };
})();
