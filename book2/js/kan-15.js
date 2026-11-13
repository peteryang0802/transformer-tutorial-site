/* ============================================================
 * 第 15 坎：保存演示（真实导出）
 * 真实构建 Blob 文件：权重 / 配置 / 词表，可下载到本地，
 * 文件大小按真实字节数显示，参数计数和第 13 坎那台一致。
 * ============================================================ */
var SaveDemo = (function () {
    'use strict';

    var PARAM_PARTS = [
        { name: 'Token 嵌入（40×16）', n: 640 },
        { name: '位置表（12×16）', n: 192 },
        { name: '两层（注意力+FFN，每层 2112）', n: 4224 },
        { name: '输出层（16×40）', n: 640 }
    ];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        return (bytes / 1024).toFixed(1) + ' KB';
    }

    function downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }

    function render(container) {
        container.innerHTML = '';
        var timers = [];

        // ---- 真实模型（和第 13 坎同一台、同一配置）----
        var cfg = {
            V: MixerData.VOCAB.length, d: 16, H: 2, dh: 8,
            dff: 32, L: 2, Tmax: 12
        };
        var model = TinyTransformer.makeTransformer(cfg, 7);

        makeIdentityTag(container, 'real', '下面三个文件都是真生成的，点卡片上的下载，能存到你电脑上。');

        var btns = el('div', 'btn-group');
        var saveBtn = el('button', 'run-btn', '生成模型文件');
        saveBtn.type = 'button';
        var resetBtn = el('button', 'run-btn btn-secondary', '重置');
        resetBtn.type = 'button';
        btns.appendChild(saveBtn);
        btns.appendChild(resetBtn);

        var fileList = el('div', 'save-filelist');
        container.appendChild(el('p', 'block-label', '点“生成模型文件”，真实把三样东西做出来'));
        container.appendChild(btns);
        container.appendChild(fileList);

        // 参数计数（真实 5696）
        var countBox = el('div', 'param-count');
        countBox.appendChild(el('p', 'block-label', '参数计数：' + model.paramCount + ' 是怎么来的'));
        var total = 0;
        PARAM_PARTS.forEach(function (p) {
            total += p.n;
            var row = el('div', 'pc-row');
            row.appendChild(el('span', 'pc-name', p.name));
            row.appendChild(el('span', 'pc-n', p.n.toLocaleString('zh-CN')));
            countBox.appendChild(row);
        });
        var sumRow = el('div', 'pc-row pc-sum');
        sumRow.appendChild(el('span', 'pc-name', '合计'));
        sumRow.appendChild(el('span', 'pc-n', total.toLocaleString('zh-CN')));
        countBox.appendChild(sumRow);
        var note = el('p', 'save-note');
        note.textContent = '书稿里那台是 5917，结构跟这台一模一样，只是词表和上下文长短不一样，所以参数数差一点。';
        countBox.appendChild(note);
        container.appendChild(countBox);

        // 构造三个真实文件
        function buildFiles() {
            var paramNames = ['tok', 'pos'];
            for (var li = 0; li < cfg.L; li++) {
                paramNames.push('L' + li + '.q0', 'L' + li + '.q1', 'L' + li + '.k0', 'L' + li + '.k1',
                    'L' + li + '.v0', 'L' + li + '.v1', 'L' + li + '.o', 'L' + li + '.ln1g',
                    'L' + li + '.ln1b', 'L' + li + '.w1', 'L' + li + '.w2', 'L' + li + '.ln2g', 'L' + li + '.ln2b');
            }
            paramNames.push('outW');

            var weightsObj = {
                format: 'tinylab-weights-v1',
                config: cfg,
                paramNames: paramNames,
                arrays: model.exportArrays()
            };
            var weightsBlob = new Blob([JSON.stringify(weightsObj)], { type: 'application/json' });
            var configBlob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
            var tokensBlob = new Blob([JSON.stringify({
                format: 'tinylab-tokens-v1',
                vocab: MixerData.VOCAB
            }, null, 2)], { type: 'application/json' });

            return [
                { name: 'weights.json', desc: '所有权重的数值，模型的本体（浏览器里用 JSON 存，工程上常打包成 npz/safetensors）', blob: weightsBlob },
                { name: 'config.json', desc: '几层、维度、词表、结构，照着它摆回权重', blob: configBlob },
                { name: 'tokens.json', desc: '词表和切分规矩，文字怎么变成编号', blob: tokensBlob }
            ];
        }

        function clearTimers() { timers.forEach(clearTimeout); timers = []; }

        saveBtn.addEventListener('click', function () {
            clearTimers();
            fileList.innerHTML = '';
            saveBtn.disabled = true;
            var files = buildFiles();
            files.forEach(function (f, i) {
                timers.push(setTimeout(function () {
                    var card = el('div', 'save-file');
                    card.appendChild(el('span', 'save-fname', f.name));
                    card.appendChild(el('span', 'save-desc', f.desc));
                    card.appendChild(el('span', 'save-size', formatSize(f.blob.size)));
                    var dl = el('button', 'run-btn btn-secondary save-dl', '下载这个文件');
                    dl.type = 'button';
                    dl.addEventListener('click', function () { downloadBlob(f.blob, f.name); });
                    card.appendChild(dl);
                    fileList.appendChild(card);
                }, 350 * (i + 1)));
            });
            timers.push(setTimeout(function () { saveBtn.disabled = false; }, 350 * files.length + 100));
        });

        resetBtn.addEventListener('click', function () {
            clearTimers();
            fileList.innerHTML = '';
            saveBtn.disabled = false;
        });
    }

    return { render: render };
})();
