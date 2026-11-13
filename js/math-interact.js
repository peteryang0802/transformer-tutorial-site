// 数学小互动：纯 JS 实现，轻量、不依赖 Pyodide。
// 各章数学卡片按需调用这里的 renderXxx 函数。

// 数字格式化：最多两位小数，去掉末尾多余的 0
function fmt(x) {
    if (Math.abs(x) < 0.005) x = 0;
    return Number(x.toFixed(2)).toString();
}

function arrFmt(a) {
    return '[' + a.map(fmt).join(', ') + ']';
}

// 在一行里放若干“− 数字 +”步进格。prefix 用来区分事件属于哪个数组。
function appendStepperCells(rowEl, arr, prefix) {
    arr.forEach(function (v, i) {
        var cell = document.createElement('div');
        cell.className = 'data-cell';
        cell.innerHTML =
            '<button class="step-btn" data-p="' + prefix + '" data-act="minus" data-i="' + i + '">−</button>' +
            '<span class="num" data-p="' + prefix + '" data-num="' + i + '">' + v + '</span>' +
            '<button class="step-btn" data-p="' + prefix + '" data-act="plus" data-i="' + i + '">+</button>';
        rowEl.appendChild(cell);
    });
}

// 步骤行：左边说明、右边结果
function addStepLine(stepsEl, label, value, isFinal) {
    var line = document.createElement('div');
    line.className = 'step-line' + (isFinal ? ' final' : '');
    var l = document.createElement('span');
    l.textContent = label;
    var val = document.createElement('span');
    val.className = 'val';
    val.textContent = value;
    line.appendChild(l);
    line.appendChild(val);
    stepsEl.appendChild(line);
}

// 小任务卡：先猜，再点按钮看答案，最后动手验证
function makeLabTask(container, taskText, answerText) {
    var box = document.createElement('div');
    box.className = 'lab-task';
    var q = document.createElement('p');
    q.className = 'task-q';
    q.innerHTML = taskText;
    var btn = document.createElement('button');
    btn.className = 'run-btn btn-secondary task-toggle';
    btn.textContent = '我猜完了，看答案';
    var ans = document.createElement('p');
    ans.className = 'task-answer';
    ans.style.display = 'none';
    ans.innerHTML = answerText;
    btn.addEventListener('click', function () {
        ans.style.display = 'block';
        btn.textContent = '答案在上面，再动手验一验';
    });
    box.appendChild(q);
    box.appendChild(btn);
    box.appendChild(ans);
    container.appendChild(box);
}

// 同步某一行步进格上显示的数字
function syncNums(container, prefix, arr) {
    container.querySelectorAll('[data-p="' + prefix + '"][data-num]').forEach(function (el) {
        el.textContent = arr[Number(el.dataset.num)];
    });
}

// 绑定整个容器里的步进按钮，点击后改对应数组并触发 onChange
function bindStepper(container, state, min, max, onChange) {
    container.addEventListener('click', function (e) {
        var btn = e.target.closest('.step-btn');
        if (!btn) return;
        var arr = state[btn.dataset.p];
        var i = Number(btn.dataset.i);
        if (btn.dataset.act === 'plus') arr[i] = Math.min(max, arr[i] + 1);
        else arr[i] = Math.max(min, arr[i] - 1);
        onChange();
    });
}

// ===== 方差 / 标准差小实验 =====
function renderVarianceLab(container) {
    var state = { v: [2, 4, 6] };
    container.classList.add('math-lab');
    container.innerHTML =
        '<p class="lab-hint">点数字两边的小按钮改一改，看数越分散，标准差怎么变。</p>' +
        '<div class="data-row" id="vRow"></div><div class="steps"></div>';
    var rowEl = container.querySelector('#vRow');
    var stepsEl = container.querySelector('.steps');
    appendStepperCells(rowEl, state.v, 'v');
    bindStepper(container, state, 0, 9, render);

    function render() {
        syncNums(container, 'v', state.v);
        var nums = state.v;
        var n = nums.length;
        var mean = nums.reduce(function (s, x) { return s + x; }, 0) / n;
        var deviations = nums.map(function (x) { return x - mean; });
        var squares = deviations.map(function (d) { return d * d; });
        var variance = squares.reduce(function (s, x) { return s + x; }, 0) / n;
        var std = Math.sqrt(variance);

        stepsEl.innerHTML = '';
        addStepLine(stepsEl, '平均数', fmt(mean));
        addStepLine(stepsEl, '每个数离平均数差多少', arrFmt(deviations));
        addStepLine(stepsEl, '差的平方', arrFmt(squares));
        addStepLine(stepsEl, '平方求平均 = 方差', fmt(variance), true);
        addStepLine(stepsEl, '方差开根号 = 标准差', fmt(std), true);
    }
    render();
    makeLabTask(container,
        '把三个数调成一模一样（比如都变成 5），先猜标准差是多少？',
        '标准差是 0。大家都一样就没有散开。这也解释了正文为什么要在分母上加个很小的正数，免得真的除以 0。');
}

// ===== 平均数小实验（两个数各占一半） =====
function renderMeanLab(container) {
    var state = { m: [2, 4] };
    container.classList.add('math-lab');
    container.innerHTML =
        '<p class="lab-hint">改两个数，平均就是把它俩加起来再除以 2。</p>' +
        '<div class="data-row" id="mRow"></div><div class="steps"></div>';
    var rowEl = container.querySelector('#mRow');
    var stepsEl = container.querySelector('.steps');
    appendStepperCells(rowEl, state.m, 'm');
    bindStepper(container, state, 0, 9, render);

    function render() {
        syncNums(container, 'm', state.m);
        var sum = state.m[0] + state.m[1];
        stepsEl.innerHTML = '';
        addStepLine(stepsEl, fmt(state.m[0]) + ' + ' + fmt(state.m[1]) + ' =', fmt(sum));
        addStepLine(stepsEl, '除以 2 = 平均', fmt(sum / 2), true);
    }
    render();
    makeLabTask(container,
        '把两个数调成一样（比如都变成 3），平均会是多少？',
        '平均就是 3。两个数相等，中间值正好落在它们自己身上。');
}

// ===== 点积小实验（对应相乘再相加） =====
function renderDotLab(container) {
    var state = { a: [1, 0], b: [4, 0] };
    container.classList.add('math-lab');
    container.innerHTML =
        '<p class="lab-hint">改分量，看两个向量对应位置相乘、再把乘积加起来。</p>' +
        '<p class="vec-caption">向量 a</p><div class="data-row" id="aRow"></div>' +
        '<p class="vec-caption">向量 b</p><div class="data-row" id="bRow"></div>' +
        '<div class="steps"></div>';
    appendStepperCells(container.querySelector('#aRow'), state.a, 'a');
    appendStepperCells(container.querySelector('#bRow'), state.b, 'b');
    var stepsEl = container.querySelector('.steps');
    bindStepper(container, state, 0, 9, render);

    function render() {
        syncNums(container, 'a', state.a);
        syncNums(container, 'b', state.b);
        var p1 = state.a[0] * state.b[0];
        var p2 = state.a[1] * state.b[1];
        stepsEl.innerHTML = '';
        addStepLine(stepsEl, '第 1 格相乘', fmt(state.a[0]) + ' × ' + fmt(state.b[0]) + ' = ' + fmt(p1));
        addStepLine(stepsEl, '第 2 格相乘', fmt(state.a[1]) + ' × ' + fmt(state.b[1]) + ' = ' + fmt(p2));
        addStepLine(stepsEl, '加起来 = 点积', fmt(p1 + p2), true);
    }
    render();
    makeLabTask(container,
        '把向量 b 调成 [0, 1]，猜猜它和 [1, 0] 的点积是多少？',
        '是 0。1×0 加上 0×1 正好 0，这就是正文说的两个方向夹角 90 度。');
}

// ===== 指数 e 小实验（任何次方都大于 0） =====
function renderExpLab(container) {
    var state = { x: [1] };
    container.classList.add('math-lab');
    container.innerHTML =
        '<p class="lab-hint">改 x，看 e 的 x 次方。注意它永远是正数，x 越小越接近 0。</p>' +
        '<div class="data-row single" id="xRow"></div><div class="steps"></div>';
    appendStepperCells(container.querySelector('#xRow'), state.x, 'x');
    var stepsEl = container.querySelector('.steps');
    bindStepper(container, state, -3, 5, render);

    function render() {
        syncNums(container, 'x', state.x);
        var x = state.x[0];
        stepsEl.innerHTML = '';
        addStepLine(stepsEl, 'e 的 ' + fmt(x) + ' 次方', fmt(Math.exp(x)), true);
        if (x === 0) addStepLine(stepsEl, '提醒', '任何数的 0 次方都是 1');
    }
    render();
    makeLabTask(container,
        '把 <span class="mi">x</span> 调成 0，再调成负数，<span class="mi">e<sup>x</sup></span> 会变成 0 吗？',
        '不会。<span class="mi">x</span>=0 时 <span class="mi">e<sup>x</sup></span>=1，<span class="mi">x</span> 负得再大，<span class="mi">e<sup>x</sup></span> 也只是越来越接近 0，永远大于 0。');
}

// ===== 平方根小实验（根号 d） =====
function renderSqrtLab(container) {
    var state = { n: [4] };
    container.classList.add('math-lab');
    container.innerHTML =
        '<p class="lab-hint">改 n，看根号 n。缩放时除以的就是格数 d 的平方根。</p>' +
        '<div class="data-row single" id="nRow"></div><div class="steps"></div>';
    appendStepperCells(container.querySelector('#nRow'), state.n, 'n');
    var stepsEl = container.querySelector('.steps');
    bindStepper(container, state, 0, 16, render);

    function render() {
        syncNums(container, 'n', state.n);
        var n = state.n[0];
        stepsEl.innerHTML = '';
        addStepLine(stepsEl, '根号 ' + fmt(n), fmt(Math.sqrt(n)), true);
    }
    render();
    makeLabTask(container,
        '把 n 调成 9，再调成不是完全平方的数（比如 8），根号 n 长什么样？',
        '根号 9 正好是 3；根号 8 约 2.83，夹在 2 和 3 之间。');
}
