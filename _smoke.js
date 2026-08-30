// 无头冒烟测试：模拟 DOM/Canvas，驱动游戏主循环跑约 100 秒
const fs = require('fs');
const SRC = fs.readFileSync('C:/Users/向靖宇/WorkBuddy/2026-08-30-10-16-44/pvz-web/_check.js', 'utf8');

// ---- ctx 代理：所有方法变 no-op ----
const ctxProxy = new Proxy({}, {
  get(t, k) { return () => undefined; },
  set() { return true; }
});

// ---- DOM 存根 ----
const els = new Map();
const created = [];
function makeEl(id) {
  const el = {
    id, dataset: {}, style: {}, innerHTML: '', textContent: '', title: '', className: '',
    children: [],
    classList: { add(){}, remove(){}, toggle(){} },
    appendChild(c) { el.children.push(c); return c; },
    querySelector() { return makeEl(); },
    addEventListener(ev, fn) { (el._l = el._l || {})[ev] = fn; },
    click(arg) { if (el._l && el._l.click) el._l.click(arg); },
    getContext() { return ctxProxy; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 610 }; }
  };
  return el;
}
global.document = {
  getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  createElement() { const e = makeEl(); created.push(e); return e; },
  querySelectorAll() { return []; },
  addEventListener() {}
};
global.localStorage = { getItem: () => null, setItem(){} };
let now = 0;
global.performance = { now: () => now };
global.getComputedStyle = () => ({ borderLeftWidth: '4px', borderTopWidth: '4px' });
let rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; };

// ---- 加载游戏脚本 ----
eval(SRC + '\n;globalThis.__G = G;');
console.log('[1] 脚本加载 + 菜单渲染 OK');

// ---- 进入第 1 关 ----
const card = created.find(e => e.className.includes('level-card') && e._l);
card.click();
console.log('[2] 点击关卡卡片 → openIntro OK, scene =', __G.scene);
els.get('btn-start').click();
console.log('[3] 开始战斗 OK, scene =', __G.scene);

// ---- 种植：向日葵(0,0) + 豌豆射手(0,2) ----
const seedBar = created.filter(e => e.dataset && e.dataset.type);
const sunflowerBtn = seedBar.find(e => e.dataset.type === 'sunflower');
const peaBtn = seedBar.find(e => e.dataset.type === 'peashooter');
sunflowerBtn.click();
els.get('game')._l.click({ clientX: 110, clientY: 115 });
peaBtn.click();
els.get('game')._l.click({ clientX: 310, clientY: 115 });
console.log('[4] 种植向日葵+豌豆射手 OK, 剩余阳光 =', __G.sun, ', 场上植物 =', __G.grid.flat().filter(Boolean).length);

// ---- 主循环：60fps 跑 100 秒 ----
const FRAMES = 6000, STEP = 1000 / 60;
let sawZombie = false, sawPea = false, sawSun = false, sawMower = false, sawDie = false;
for (let i = 0; i < FRAMES; i++) {
  now += STEP;
  rafCb(now);
  if (__G.zombies.length) sawZombie = true;
  if (__G.peas.length) sawPea = true;
  if (__G.suns.length) sawSun = true;
  if (__G.mowers.some(m => m.state === 'run')) sawMower = true;
  if (__G.fx.some(f => f.kind === 'die')) sawDie = true;
}
console.log('[5] 100 秒主循环 OK →', JSON.stringify({
  scene: __G.scene, waveIdx: __G.waveIdx, zombies: __G.zombies.length,
  sawZombie, sawPea, sawSun, sawMower, sawDie
}));

// ---- 输入路径：铲子 / Esc / 暂停 / 收阳光 ----
__G.shovel = true;
els.get('game')._l.click({ clientX: 110, clientY: 115 }); // 铲掉向日葵
console.log('[6] 铲子移除植物 OK, 场上植物 =', __G.grid.flat().filter(Boolean).length);
if (__G.scene === 'play') { els.get('pause-btn').click(); els.get('btn-resume').click(); }
console.log('[7] 暂停/恢复 OK, scene =', __G.scene);

// ---- 失败路径：重开并拆掉小推车，僵尸必进屋 ----
els.get('btn-retry').click();
__G.mowers = [];
for (let i = 0; i < 15000 && __G.scene === 'play'; i++) { now += STEP; rafCb(now); }
console.log('[8] 失败结算 OK, scene =', __G.scene, '(期望 lost)');
if (__G.scene !== 'lost') throw new Error('失败路径未触发');

// ---- 胜利路径：重开后清场 ----
els.get('btn-retry').click();
__G.allSpawned = true; __G.zombies = [];
now += STEP; rafCb(now);
console.log('[9] 胜利结算 OK, scene =', __G.scene, '(期望 won), 解锁进度 =', __G.progress);
if (__G.scene !== 'won') throw new Error('胜利路径未触发');

console.log('SMOKE TEST PASSED');
