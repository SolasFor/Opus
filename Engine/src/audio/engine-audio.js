/* Звук двигателя — синтез WebAudio, выключен по умолчанию.
 * M-02a: раздел 9 Engine/src/main.js, дословно. Тот же текст — в замороженной Engine/Engine.html (D-17),
 * совпадение проверяет tests/split-sync.test.js.
 * audio.fire() берёт текущую скорость из effSpeed(): она остаётся в main.js (раздел 10, зависит от sim).
 * main.js передаёт её через setSpeedSource(effSpeed) при загрузке, до первого кадра.
 */
let effSpeed;
const setSpeedSource = fn => { effSpeed = fn; };

const audio = {
  ctx: null, master: null, hiss: null, hissFilter: null, noise: null, on: false,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.97 * b0 + 0.03 * w; d[i] = w * 0.5 + b0 * 3; }
    this.noise = buf;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    this.hissFilter = ctx.createBiquadFilter(); this.hissFilter.type = 'lowpass'; this.hissFilter.frequency.value = 300;
    this.hiss = ctx.createGain(); this.hiss.gain.value = 0;
    src.connect(this.hissFilter); this.hissFilter.connect(this.hiss); this.hiss.connect(this.master);
    src.start();
  },
  setOn(v) {
    this.on = v;
    if (v) { this.init(); if (!this.ctx) return false; this.ctx.resume(); }
    if (this.ctx) this.master.gain.setTargetAtTime(v ? 0.55 : 0, this.ctx.currentTime, 0.08);
    return true;
  },
  update(running, speed) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    this.hiss.gain.setTargetAtTime(running ? 0.025 + 0.03 * Math.min(1, speed / 6) : 0, t, 0.2);
    this.hissFilter.frequency.setTargetAtTime(220 + 140 * Math.min(speed, 8), t, 0.2);
  },
  fire(cyl) {
    if (!this.ctx || !this.on || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime + 0.005;
    const sp = Math.min(effSpeed(), 10), dec = 0.22 / (1 + sp * 0.18);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(120 + cyl * 4, t);
    o.frequency.exponentialRampToValueAtTime(42, t + dec);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.9, t + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dec * 1.3);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + dec * 1.4);
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700 + Math.random() * 300; bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.35, t + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dec * 0.6);
    n.connect(bp); bp.connect(ng); ng.connect(this.master);
    n.start(t, Math.random() * 1.5); n.stop(t + dec);
  }
};

export { audio, setSpeedSource };
