/* 声音混音（注意力权重的听觉版）
 * 每个候选是一个音轨，音高不同、音量=当前权重。
 * 权重集中时基本只听到一个音，权重拉平时几个音一起响成和弦。
 * 手机浏览器禁止自动发声，所以只在用户点喇叭后才创建 AudioContext（在用户手势里）。
 *
 * 用法：
 *   var mixer = SoundMix.attach(容器, function () {
 *       return { tracks: [{ label, freq, weight }] };
 *   });
 *   外部权重每次变化后调 mixer.sync()。
 */
(function () {
    'use strict';

    var AC = window.AudioContext || window.webkitAudioContext;
    var VOL = 0.22; // 单轨最大音量，避免多音叠加刺耳

    function attach(container, getState) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'run-btn sound-btn';
        btn.textContent = '🔊 用耳朵听听';

        var ctx = null, master = null, nodes = [], playing = false;

        function build() {
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0.9;
            master.connect(ctx.destination);
            var st = getState();
            nodes = st.tracks.map(function (t) {
                var osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = t.freq;
                var g = ctx.createGain();
                g.gain.value = t.weight * VOL;
                osc.connect(g);
                g.connect(master);
                osc.start();
                return { osc: osc, gain: g };
            });
        }

        function sync() {
            if (!playing || !ctx) return;
            var st = getState();
            st.tracks.forEach(function (t, i) {
                if (nodes[i]) {
                    nodes[i].gain.gain.setTargetAtTime(t.weight * VOL, ctx.currentTime, 0.05);
                }
            });
        }

        btn.addEventListener('click', function () {
            if (!AC) {
                btn.textContent = '这个浏览器不支持声音';
                btn.disabled = true;
                return;
            }
            if (navigator.userActivation && !navigator.userActivation.isActive) {
                btn.textContent = '请再点一次喇叭';
                return;
            }
            if (!playing) {
                if (!ctx) build();
                if (ctx.state === 'suspended') {
                    var resumePromise = ctx.resume();
                    if (resumePromise && resumePromise.catch) resumePromise.catch(function () {});
                }
                playing = true;
                btn.textContent = '🔇 停止';
                btn.classList.add('playing');
                sync();
            } else {
                playing = false;
                btn.textContent = '🔊 用耳朵听听';
                btn.classList.remove('playing');
                if (ctx) {
                    var suspendPromise = ctx.suspend();
                    if (suspendPromise && suspendPromise.catch) suspendPromise.catch(function () {});
                }
            }
        });

        container.appendChild(btn);
        return { sync: sync };
    }

    window.SoundMix = { attach: attach };
})();
