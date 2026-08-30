
"use strict";
/* ================= 常量与配置 ================= */
const COLS=9, ROWS=5, CELL_W=100, CELL_H=110, GRID_X=60, GRID_Y=60;
const W=960, H=610;
const SUN_VALUE=25;

const PLANTS={
  sunflower :{name:"向日葵",  emoji:"🌻", cost:50,  hp:80,  cd:7,  desc:"定期产出阳光"},
  peashooter:{name:"豌豆射手",emoji:"🌱", cost:100, hp:100, cd:7,  dmg:20, rate:1.4, desc:"直线发射豌豆"},
  wallnut   :{name:"坚果墙",  emoji:"🥜", cost:50,  hp:400, cd:20, desc:"高血量肉盾，挡住僵尸"},
  snowpea   :{name:"寒冰射手",emoji:"🌱", cost:175, hp:100, cd:8,  dmg:20, rate:1.4, snow:true, badge:"❄", desc:"冰豌豆，减速僵尸"},
  cherry    :{name:"樱桃炸弹",emoji:"🍒", cost:150, hp:999, cd:30, bomb:true, desc:"3×3 范围爆炸，一次性"},
  repeater  :{name:"双发射手",emoji:"🌿", cost:200, hp:100, cd:8,  dmg:20, rate:1.4, double:true, badge:"×2", desc:"一次连发两颗豌豆"},
};
const PLANT_ORDER=["sunflower","peashooter","wallnut","snowpea","cherry","repeater"];

const ZOMBIES={
  normal:{name:"普通僵尸",  hp:100, speed:15, dps:25},
  cone  :{name:"路障僵尸",  hp:170, speed:15, dps:25, hatHP:70,  hat:"cone"},
  bucket:{name:"铁桶僵尸",  hp:280, speed:15, dps:25, hatHP:180, hat:"bucket"},
  runner:{name:"疾跑僵尸",  hp:80,  speed:34, dps:20, hatHP:0,   hat:null},
};

const LEVELS=[
  {name:"第 1 关 · 后院初见", plants:["sunflower","peashooter"], startSun:150, skySun:true,
   waves:[{t:6,z:{normal:1}},{t:18,z:{normal:2}},{t:32,z:{normal:3}},{t:46,z:{normal:4}},{t:60,z:{normal:6},final:true}]},
  {name:"第 2 关 · 路障来袭", plants:["sunflower","peashooter","wallnut"], startSun:100, skySun:true,
   waves:[{t:6,z:{normal:2}},{t:20,z:{normal:2,cone:1}},{t:36,z:{cone:2,normal:2}},{t:50,z:{normal:3,cone:2}},{t:64,z:{cone:3,normal:3}},{t:78,z:{cone:4,normal:5},final:true}]},
  {name:"第 3 关 · 铁桶压境", plants:["sunflower","peashooter","wallnut","snowpea"], startSun:100, skySun:true,
   waves:[{t:6,z:{normal:2,cone:1}},{t:22,z:{cone:2,normal:2}},{t:40,z:{bucket:1,normal:3}},{t:54,z:{bucket:2,cone:2}},{t:70,z:{bucket:2,cone:3,normal:3}},{t:86,z:{bucket:3,cone:3,normal:4},final:true}]},
  {name:"第 4 关 · 疾影夜袭", plants:["sunflower","peashooter","wallnut","snowpea","cherry"], startSun:125, skySun:true,
   waves:[{t:5,z:{runner:2,normal:1}},{t:18,z:{cone:2,runner:2}},{t:34,z:{bucket:2,runner:3}},{t:50,z:{cone:3,runner:3,normal:2}},{t:66,z:{bucket:3,cone:2,runner:3}},{t:82,z:{bucket:3,cone:4,runner:4},final:true}]},
  {name:"第 5 关 · 决战黎明", plants:["sunflower","peashooter","wallnut","snowpea","cherry","repeater"], startSun:125, skySun:true,
   waves:[{t:5,z:{normal:2,cone:2}},{t:16,z:{cone:3,runner:2}},{t:30,z:{bucket:2,cone:3}},{t:44,z:{runner:4,cone:4}},{t:58,z:{bucket:3,cone:4,normal:3}},{t:72,z:{bucket:4,cone:4,runner:4}},{t:84,z:{bucket:4,cone:5,runner:5}},{t:96,z:{bucket:5,cone:5,normal:6},final:true}]},
];

/* ================= 存档 ================= */
const SAVE_KEY="pvzWebProgress";
function loadProgress(){ try{ return Math.max(1, parseInt(localStorage.getItem(SAVE_KEY)||"1",10)||1); }catch(e){ return 1; } }
function saveProgress(unlocked){ try{ localStorage.setItem(SAVE_KEY, String(unlocked)); }catch(e){} }

/* ================= 全局状态 ================= */
const cvs=document.getElementById("game");
const ctx=cvs.getContext("2d");
const $=id=>document.getElementById(id);

const G={
  scene:"menu",            // menu | intro | play | pause | won | lost
  level:0, sun:100, time:0,
  grid:[], zombies:[], peas:[], suns:[], mowers:[], fx:[],
  waveIdx:0, allSpawned:false,
  selected:null, shovel:false,
  skySunTimer:6, mouse:{x:-99,y:-99},
  lastSunShown:-1, progress:loadProgress(),
};

function resetLevelState(){
  G.grid=[]; G.zombies=[]; G.peas=[]; G.suns=[]; G.fx=[];
  G.waveIdx=0; G.allSpawned=false; G.time=0; G.selected=null; G.shovel=false;
  G.skySunTimer=5;
  for(let r=0;r<ROWS;r++) G.grid.push(new Array(COLS).fill(null));
  G.mowers=[];
  for(let r=0;r<ROWS;r++) G.mowers.push({row:r, x:GRID_X-42, state:"idle"});
}
function levelDef(){ return LEVELS[G.level]; }

/* ================= DOM：种子栏 / 覆盖层 ================= */
function buildSeedBar(){
  const bar=$("seed-bar"); bar.innerHTML="";
  levelDef().plants.forEach((type,i)=>{
    const p=PLANTS[type];
    const b=document.createElement("button");
    b.className="seed"; b.dataset.type=type; b.title=(i+1)+" · "+p.name+"："+p.desc;
    b.innerHTML=`<span class="s-emoji">${p.emoji}</span><span class="s-cost">${p.cost}</span><div class="cd"></div>`;
    b.addEventListener("click",()=>selectSeed(type));
    bar.appendChild(b);
  });
}
function selectSeed(type){
  if(G.scene!=="play") return;
  G.shovel=false; $("shovel-btn").classList.remove("sel");
  if(G.selected===type){ G.selected=null; refreshSeedSel(); return; }
  const p=PLANTS[type];
  const cd=G.seedCd[type]||0;
  if(p.cost>G.sun || cd>G.time){ flashText("阳光不足或还在冷却！",W/2,120,"#ffb3b3",16); return; }
  G.selected=type; refreshSeedSel();
}
function refreshSeedSel(){
  document.querySelectorAll(".seed").forEach(b=>b.classList.toggle("sel",b.dataset.type===G.selected));
}
function showOverlay(id){
  ["ov-menu","ov-intro","ov-pause","ov-result"].forEach(o=>$(o).classList.toggle("hidden",o!==id));
  if(!id) ["ov-menu","ov-intro","ov-pause","ov-result"].forEach(o=>$(o).classList.add("hidden"));
}
function buildLevelGrid(){
  const grid=$("level-grid"); grid.innerHTML="";
  LEVELS.forEach((lv,i)=>{
    const locked=i+1>G.progress;
    const card=document.createElement("div");
    card.className="level-card"+(locked?" locked":"");
    const next=LEVELS[i+1];
    let extra="";
    if(i===0) extra=`<div class="newp">解锁：🌻向日葵 🌱豌豆射手</div>`;
    else if(next) extra=`<div class="newp">通关解锁：${PLANTS[next.plants[next.plants.length-1]].emoji}${PLANTS[next.plants[next.plants.length-1]].name}</div>`;
    else extra=`<div class="newp">最终决战！</div>`;
    card.innerHTML=`<div class="num">${locked?"🔒":(i+1)}</div><div class="nm">${lv.name}</div>${locked?"":extra}`;
    if(!locked) card.addEventListener("click",()=>openIntro(i));
    grid.appendChild(card);
  });
}
function openIntro(i){
  G.level=i; G.scene="intro";
  const lv=levelDef();
  $("intro-title").textContent=lv.name;
  const roster=lv.plants.map(t=>PLANTS[t].emoji+PLANTS[t].name).join("　");
  const total=lv.waves.reduce((s,w)=>s+Object.values(w.z).reduce((a,b)=>a+b,0),0);
  $("intro-desc").innerHTML=`可用植物：${roster}<br>共 ${lv.waves.length} 波 · 约 ${total} 只僵尸 · 初始阳光 ${lv.startSun}<br>💡 前排坚果、后排射手、优先攒向日葵`;
  buildSeedBar();
  resetLevelState(); G.sun=lv.startSun; G.seedCd={};
  showOverlay("ov-intro");
}
function startBattle(){
  G.scene="play"; showOverlay(null);
  flashText("准备安放植物！",W/2,H/2,"#ffe66d",34,2.2);
}

/* ================= 游戏逻辑 ================= */
function cellAt(px,py){
  const c=Math.floor((px-GRID_X)/CELL_W), r=Math.floor((py-GRID_Y)/CELL_H);
  if(c<0||c>=COLS||r<0||r>=ROWS) return null;
  return {row:r,col:c};
}
function cellCX(col){ return GRID_X+col*CELL_W+CELL_W/2; }
function cellCY(row){ return GRID_Y+row*CELL_H+CELL_H/2; }

function plantAt(type,row,col){
  const p=PLANTS[type];
  G.grid[row][col]={type,row,col,hp:p.hp,maxHp:p.hp,timer:0,fuse:type==="cherry"?1.1:0,fireT:0,shot2:0};
  G.sun-=p.cost;
  G.seedCd[type]=G.time+p.cd;
  G.selected=null; refreshSeedSel();
}
function spawnSun(x,y,ty,fromFlower){
  G.suns.push({x,y,ty,vy:fromFlower?55:34,life:11,val:SUN_VALUE,phase:Math.random()*6.28,fly:null});
}
function spawnZombie(type){
  const row=Math.floor(Math.random()*ROWS);
  const z=ZOMBIES[type];
  G.zombies.push({type,row,x:W+30+Math.random()*40,hp:z.hp,maxHp:z.hp,
    speed:z.speed,dps:z.dps,slowT:0,eat:null,anim:Math.random()*6.28});
}
function hitZombie(z,dmg,snow){
  z.hp-=dmg;
  if(snow) z.slowT=4;
  if(z.hp<=0 && !z.dead){
    z.dead=true;
    G.fx.push({kind:"die",x:z.x,y:cellCY(z.row),t:0,dur:.9,emoji:"🧟",row:z.row});
  }
}
function explode(cx,cy){
  G.fx.push({kind:"boom",x:cx,y:cy,t:0,dur:.6});
  const r0=Math.round((cy-GRID_Y)/CELL_H-0.5);
  G.zombies.forEach(z=>{
    if(Math.abs(z.row-r0)<=1 && Math.abs(z.x-cx)<=CELL_W*1.6) hitZombie(z,1800);
  });
  G.zombies=G.zombies.filter(z=>!z.dead||z.hp>0);
}
function update(dt){
  G.time+=dt;
  const lv=levelDef();

  /* --- 波次 --- */
  while(G.waveIdx<lv.waves.length && G.time>=lv.waves[G.waveIdx].t){
    const w=lv.waves[G.waveIdx];
    Object.entries(w.z).forEach(([t,n])=>{ for(let i=0;i<n;i++) spawnZombie(t); });
    if(w.final) flashText("🚩 最后一大波僵尸来袭！",W/2,200,"#ff7b6b",30,3);
    G.waveIdx++;
  }
  if(G.waveIdx>=lv.waves.length) G.allSpawned=true;

  /* --- 天降阳光 --- */
  if(lv.skySun){
    G.skySunTimer-=dt;
    if(G.skySunTimer<=0){
      G.skySunTimer=8+Math.random()*4;
      const col=Math.floor(Math.random()*COLS);
      spawnSun(cellCX(col),GRID_Y-30,GRID_Y+40+Math.random()*(ROWS*CELL_H-80),false);
    }
  }

  /* --- 植物 --- */
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const pl=G.grid[r][c]; if(!pl) continue;
    const def=PLANTS[pl.type];
    if(pl.type==="sunflower"){
      pl.timer+=dt;
      if(pl.timer>=14){ pl.timer=0; spawnSun(cellCX(c)+28,cellCY(r)-20,cellCY(r)+18,true); }
    }else if(def.dmg){
      pl.fireT-=dt;
      const hasTarget=G.zombies.some(z=>!z.dead&&z.row===r&&z.x>GRID_X+c*CELL_W-10);
      if(hasTarget && pl.fireT<=0){
        pl.fireT=def.rate;
        G.peas.push({row:r,x:cellCX(c)+22,y:cellCY(r)-14,snow:!!def.snow,vx:420,dmg:def.dmg});
        if(def.double) pl.shot2=.16;
      }
      if(pl.shot2>0){ pl.shot2-=dt; if(pl.shot2<=0){ G.peas.push({row:r,x:cellCX(c)+22,y:cellCY(r)-14,snow:!!def.snow,vx:420,dmg:def.dmg}); } }
    }else if(def.bomb){
      pl.fuse-=dt;
      if(pl.fuse<=0){ G.grid[r][c]=null; explode(cellCX(c),cellCY(r)); }
    }
  }

  /* --- 豌豆 --- */
  G.peas.forEach(p=>{ p.x+=p.vx*dt; });
  G.peas=G.peas.filter(p=>{
    if(p.x>W+20) return false;
    for(const z of G.zombies){
      if(z.dead||z.row!==p.row) continue;
      if(Math.abs(z.x-p.x)<26){
        hitZombie(z,p.dmg,p.snow);
        G.fx.push({kind:"hit",x:p.x,y:p.y,t:0,dur:.18,snow:p.snow});
        return false;
      }
    }
    return true;
  });
  G.zombies=G.zombies.filter(z=>!z.dead);

  /* --- 僵尸 --- */
  for(const z of G.zombies){
    if(z.slowT>0) z.slowT-=dt;
    z.anim+=dt*6;
    const front=z.x-26;
    const col=Math.floor((front-GRID_X)/CELL_W);
    let target=null;
    if(col>=0&&col<COLS) target=G.grid[z.row][col];
    if(target){
      z.eat=target;
      target.hp-=z.dps*dt;
      if(target.hp<=0){
        G.fx.push({kind:"puff",x:cellCX(target.col),y:cellCY(target.row),t:0,dur:.5});
        G.grid[z.row][target.col]=null; z.eat=null;
      }
    }else{
      z.eat=null;
      const slow=z.slowT>0?0.45:1;
      z.x-=z.speed*slow*dt;
    }
    /* 抵达最左：触发小推车 / 失败 */
    if(z.x<GRID_X+4){
      const m=G.mowers.find(m=>m.row===z.row);
      if(m&&m.state==="idle") m.state="run";
      else if(z.x<GRID_X-40 && (!m || m.x>z.x)) return lose();
    }
  }

  /* --- 小推车 --- */
  for(const m of G.mowers){
    if(m.state!=="run") continue;
    m.x+=520*dt;
    G.zombies.forEach(z=>{
      if(!z.dead&&z.row===m.row&&Math.abs(z.x-m.x)<52) hitZombie(z,9999);
    });
    if(m.x>W+80) G.mowers=G.mowers.filter(o=>o!==m);
  }
  G.zombies=G.zombies.filter(z=>!z.dead);

  /* --- 阳光 --- */
  for(const s of G.suns){
    if(s.fly){ s.x+=(30-s.x)*10*dt; s.y+=(24-s.y)*10*dt; s.life=2; if(Math.abs(s.x-30)<8){ s.done=true; G.sun+=s.val; } continue; }
    if(s.y<s.ty) s.y=Math.min(s.ty,s.y+s.vy*dt);
    s.life-=dt; s.phase+=dt*3;
    if(s.life<=0) s.done=true;
  }
  G.suns=G.suns.filter(s=>!s.done);

  /* --- 特效 --- */
  G.fx.forEach(f=>f.t+=dt);
  G.fx=G.fx.filter(f=>f.t<f.dur);

  /* --- 胜利 --- */
  if(G.allSpawned && G.zombies.length===0 && G.scene==="play") win();
}

function win(){
  G.scene="won";
  const next=G.level+1;
  if(next<LEVELS.length && G.progress<next+1){ G.progress=next+1; saveProgress(G.progress); }
  else if(G.level===LEVELS.length-1 && G.progress<LEVELS.length){ G.progress=LEVELS.length; saveProgress(G.progress); }
  $("result-title").innerHTML="🎉 关卡通关！";
  $("result-desc").textContent=G.level===LEVELS.length-1
    ? "你守住了黎明！全部关卡通关，草坪永久安全 🌻"
    : `解锁新植物：${PLANTS[LEVELS[next].plants[LEVELS[next].plants.length-1]].emoji} ${PLANTS[LEVELS[next].plants[LEVELS[next].plants.length-1]].name}`;
  $("btn-next").style.display=G.level===LEVELS.length-1?"none":"";
  showOverlay("ov-result");
}
function lose(){
  G.scene="lost";
  $("result-title").innerHTML="💀 僵尸吃掉了你的脑子…";
  $("result-desc").textContent="别灰心，试试多种向日葵攒经济、前排坚果扛伤。";
  $("btn-next").style.display="none";
  showOverlay("ov-result");
}
function flashText(text,x,y,color,size,dur){
  G.fx.push({kind:"text",text,x,y,color,size:size||20,t:0,dur:dur||1.6});
}

/* ================= 渲染 ================= */
function drawMower(m){
  const y=cellCY(m.row)+26;
  ctx.save();
  ctx.translate(m.x,y);
  ctx.fillStyle=m.state==="run"?"#e74c3c":"#95a5a6";
  ctx.fillRect(-20,-16,40,16);
  ctx.fillStyle="#2c3e50";
  ctx.beginPath(); ctx.arc(-12,2,7,0,7); ctx.arc(12,2,7,0,7); ctx.fill();
  ctx.strokeStyle="#7f8c8d"; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(14,-14); ctx.lineTo(26,-30); ctx.stroke();
  if(m.state==="run"){
    ctx.strokeStyle="rgba(255,255,255,.5)";
    ctx.beginPath(); ctx.moveTo(-30,-6); ctx.lineTo(-48,-6); ctx.stroke();
  }
  ctx.restore();
}
function drawHat(z){
  const def=ZOMBIES[z.type];
  if(!def.hat || z.hp<=def.hp-def.hatHP) return;
  const x=z.x-4, y=cellCY(z.row)-34;
  ctx.save();
  if(def.hat==="cone"){
    ctx.fillStyle="#e67e22";
    ctx.beginPath(); ctx.moveTo(x,y-2); ctx.lineTo(x-11,y+14); ctx.lineTo(x+11,y+14); ctx.closePath(); ctx.fill();
  }else{
    ctx.fillStyle="#95a5a6";
    ctx.fillRect(x-13,y,26,14);
    ctx.fillStyle="#bdc3c7";
    ctx.fillRect(x-16,y+12,32,6);
  }
  ctx.restore();
}
function render(){
  /* 草坪 */
  ctx.fillStyle="#2f4425"; ctx.fillRect(0,0,GRID_X,H);           // 房子侧
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    ctx.fillStyle=(r+c)%2===0?"#7bbf4f":"#6eae45";
    ctx.fillRect(GRID_X+c*CELL_W,GRID_Y+r*CELL_H,CELL_W,CELL_H);
  }
  ctx.strokeStyle="rgba(0,0,0,.08)"; ctx.lineWidth=1;
  for(let c=0;c<=COLS;c++){ ctx.beginPath(); ctx.moveTo(GRID_X+c*CELL_W,GRID_Y); ctx.lineTo(GRID_X+c*CELL_W,GRID_Y+ROWS*CELL_H); ctx.stroke(); }

  /* 房子车道（最左侧专属区域） */
  ctx.fillStyle="#3a2c1c"; ctx.fillRect(0,0,GRID_X,H);
  ctx.fillStyle="rgba(255,255,255,.04)";
  for(let r=0;r<ROWS;r++) ctx.fillRect(0,GRID_Y+r*CELL_H,GRID_X,CELL_H);
  ctx.strokeStyle="rgba(0,0,0,.25)"; ctx.lineWidth=1;
  for(let r=0;r<=ROWS;r++){ ctx.beginPath(); ctx.moveTo(0,GRID_Y+r*CELL_H); ctx.lineTo(GRID_X,GRID_Y+r*CELL_H); ctx.stroke(); }
  ctx.font="40px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText("🏠",GRID_X/2,GRID_Y+58);
  ctx.font="12px sans-serif"; ctx.fillStyle="rgba(255,235,180,.75)";
  ctx.fillText("你 家",GRID_X/2,GRID_Y+104);
  ctx.fillText("↑ 守住",GRID_X/2,GRID_Y+130);

  /* 悬停格高亮（常驻，进入游戏即显示） */
  if(G.scene==="play"){
    const cell=cellAt(G.mouse.x,G.mouse.y);
    if(cell){
      const occ=G.grid[cell.row][cell.col];
      let col = G.shovel&&occ ? "rgba(255,90,80,.28)"
              : G.selected ? (occ?"rgba(255,150,150,.18)":"rgba(255,255,180,.22)")
              : "rgba(255,255,255,.10)";
      ctx.fillStyle=col;
      ctx.fillRect(GRID_X+cell.col*CELL_W,GRID_Y+cell.row*CELL_H,CELL_W,CELL_H);
    }
  }

  /* 小推车 */
  G.mowers.forEach(drawMower);

  /* 植物 */
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const pl=G.grid[r][c]; if(!pl) continue;
    const def=PLANTS[pl.type];
    const x=cellCX(c), y=cellCY(r)+8;
    ctx.font="54px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    if(def.bomb && pl.fuse>0 && Math.floor(pl.fuse*8)%2===0){
      ctx.save(); ctx.translate(x,y); ctx.scale(1.22,1.22); ctx.fillText(def.emoji,0,0); ctx.restore();
    }else ctx.fillText(def.emoji,x,y);
    if(def.badge){
      ctx.font="16px serif"; ctx.fillText(def.badge,x+24,y-24);
    }
    if(pl.hp<pl.maxHp){
      const w=56,frac=Math.max(0,pl.hp/pl.maxHp);
      ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(x-w/2,y+30,w,5);
      ctx.fillStyle=frac>.5?"#7ed321":frac>.25?"#f5a623":"#e74c3c";
      ctx.fillRect(x-w/2,y+30,w*frac,5);
    }
  }

  /* 豌豆 */
  G.peas.forEach(p=>{
    ctx.fillStyle=p.snow?"#8fd8f7":"#58c940";
    ctx.beginPath(); ctx.arc(p.x,p.y,9,0,7); ctx.fill();
    if(p.snow){ ctx.strokeStyle="rgba(200,240,255,.8)"; ctx.stroke(); }
  });

  /* 僵尸 */
  G.zombies.forEach(z=>{
    const y=cellCY(z.row)+8+Math.sin(z.anim)*2;
    ctx.save();
    if(z.slowT>0){ ctx.globalAlpha=.9; }
    ctx.font="50px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("🧟",z.x,y);
    if(z.slowT>0){ ctx.fillStyle="rgba(120,190,255,.28)"; ctx.fillRect(z.x-26,y-34,52,68); }
    drawHat(z);
    if(z.eat){
      ctx.font="14px serif"; ctx.fillText("😋",z.x-20,y-30);
    }
    ctx.restore();
  });

  /* 阳光 */
  G.suns.forEach(s=>{
    const bob=Math.sin(s.phase)*4;
    ctx.font="36px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.globalAlpha=s.life<2?s.life/2:1;
    ctx.fillText("☀️",s.x,s.y+bob);
    ctx.globalAlpha=1;
  });

  /* 特效 */
  G.fx.forEach(f=>{
    const k=f.t/f.dur;
    if(f.kind==="die"){
      ctx.save(); ctx.globalAlpha=1-k;
      ctx.translate(f.x,f.y); ctx.rotate(k*1.5); ctx.font="50px serif";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.filter="grayscale(1)";
      ctx.fillText(f.emoji,0,k*20);
      ctx.filter="none"; ctx.restore();
    }else if(f.kind==="boom"){
      ctx.save();
      ctx.fillStyle=`rgba(255,${140-100*k},30,${.8-.8*k})`;
      ctx.beginPath(); ctx.arc(f.x,f.y,30+150*k,0,7); ctx.fill();
      ctx.font=(40+40*k)+"px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.globalAlpha=1-k; ctx.fillText("💥",f.x,f.y);
      ctx.restore();
    }else if(f.kind==="hit"){
      ctx.fillStyle=f.snow?"rgba(160,220,255,.9)":"rgba(190,255,140,.9)";
      ctx.beginPath(); ctx.arc(f.x,f.y,6+12*k,0,7); ctx.fill();
    }else if(f.kind==="puff"){
      ctx.save(); ctx.globalAlpha=1-k; ctx.font="30px serif";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("💨",f.x,f.y-k*14); ctx.restore();
    }else if(f.kind==="text"){
      ctx.save(); ctx.globalAlpha=k<.15?k/.15:(1-k);
      ctx.font=`bold ${f.size}px "Microsoft YaHei",sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.strokeStyle="rgba(0,0,0,.65)"; ctx.lineWidth=4;
      ctx.strokeText(f.text,f.x,f.y-k*16);
      ctx.fillStyle=f.color; ctx.fillText(f.text,f.x,f.y-k*16);
      ctx.restore();
    }
  });

  /* 波次进度条 */
  if(G.scene==="play"){
    const lv=levelDef();
    const last=lv.waves[lv.waves.length-1].t;
    const bx=GRID_X+10, by=H-14, bw=W-GRID_X-30;
    ctx.fillStyle="rgba(0,0,0,.45)"; ctx.fillRect(bx-4,by-5,bw+8,10);
    ctx.fillStyle="#5d8a3c"; ctx.fillRect(bx,by-3,bw,6);
    ctx.fillStyle="#ffd94d"; ctx.fillRect(bx,by-3,bw*Math.min(1,G.time/last),6);
    lv.waves.forEach((w,i)=>{
      const fx2=bx+bw*(w.t/last);
      ctx.fillStyle=w.final?"#e74c3c":"#3f6f2a";
      ctx.fillRect(fx2-2,by-8,4,16);
    });
    ctx.fillStyle="rgba(255,255,255,.85)"; ctx.font="11px sans-serif"; ctx.textAlign="left";
    ctx.fillText(`第 ${Math.min(G.waveIdx+ (G.allSpawned?0:1), lv.waves.length)} / ${lv.waves.length} 波`,bx+2,by-14);
  }

  /* 鼠标跟随：植物幽灵 / 铲子 */
  if(G.scene==="play"&&G.mouse.x>0){
    if(G.selected){
      ctx.globalAlpha=.75; ctx.font="48px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(PLANTS[G.selected].emoji,G.mouse.x,G.mouse.y);
      ctx.globalAlpha=1;
    }else if(G.shovel){
      ctx.globalAlpha=.8; ctx.font="32px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("⛏",G.mouse.x,G.mouse.y); ctx.globalAlpha=1;
    }
  }
}

/* ================= 每帧 DOM 同步 ================= */
function syncDOM(){
  if(G.sun!==G.lastSunShown){ $("sun-count").textContent=G.sun; G.lastSunShown=G.sun; }
  document.querySelectorAll(".seed").forEach(b=>{
    const type=b.dataset.type, p=PLANTS[type];
    const cdUntil=G.seedCd[type]||0;
    const rem=Math.max(0,cdUntil-G.time);
    b.querySelector(".cd").style.height=rem>0?((rem/p.cd)*100)+"%":"0%";
    const poor=p.cost>G.sun||rem>0;
    b.classList.toggle("poor",poor);
    b.classList.toggle("sel",G.selected===type);
  });
  $("shovel-btn").classList.toggle("sel",G.shovel);
}

/* ================= 主循环 ================= */
let lastT=performance.now();
function loop(now){
  const dt=Math.min((now-lastT)/1000,.05);
  lastT=now;
  if(G.scene==="play") update(dt);
  render(); syncDOM();
  requestAnimationFrame(loop);
}

/* ================= 输入 ================= */
function canvasPos(e){
  const rect=cvs.getBoundingClientRect();
  const cs=getComputedStyle(cvs);
  const bl=parseFloat(cs.borderLeftWidth)||0, bt=parseFloat(cs.borderTopWidth)||0;
  return {x:(e.clientX-rect.left-bl)*(W/rect.width), y:(e.clientY-rect.top-bt)*(H/rect.height)};
}
cvs.addEventListener("mousemove",e=>{ G.mouse=canvasPos(e); });
cvs.addEventListener("mouseleave",()=>{ G.mouse={x:-99,y:-99}; });
cvs.addEventListener("contextmenu",e=>{ e.preventDefault(); G.selected=null; G.shovel=false; refreshSeedSel(); });
cvs.addEventListener("click",e=>{
  if(G.scene!=="play") return;
  const pos=canvasPos(e);
  /* 1. 收阳光 */
  for(const s of G.suns){
    if(!s.fly && Math.hypot(s.x-pos.x,s.y-pos.y)<34){ s.fly=true; return; }
  }
  const cell=cellAt(pos.x,pos.y);
  if(!cell) return;
  /* 2. 铲子 */
  if(G.shovel){
    const pl=G.grid[cell.row][cell.col];
    if(pl){ G.grid[cell.row][cell.col]=null; G.fx.push({kind:"puff",x:cellCX(cell.col),y:cellCY(cell.row),t:0,dur:.5}); }
    G.shovel=false; return;
  }
  /* 3. 先选种子再种植 */
  if(!G.selected){
    flashText("先点上方植物卡片，再点草坪种植",W/2,H/2,"#ffd94d",18,1.4); return;
  }
  /* 4. 种植 */
  if(G.selected){
    const p=PLANTS[G.selected];
    if(G.grid[cell.row][cell.col]){ flashText("这里已经有植物了！",cellCX(cell.col),cellCY(cell.row)-30,"#ffb3b3",15,1); return; }
    if(p.cost>G.sun){ flashText("阳光不足！",cellCX(cell.col),cellCY(cell.row)-30,"#ffb3b3",15,1); return; }
    plantAt(G.selected,cell.row,cell.col);
  }
});
document.addEventListener("keydown",e=>{
  if(G.scene!=="play") { if(e.code==="Space") e.preventDefault(); return; }
  if(e.code==="Space"){ e.preventDefault(); togglePause(); }
  if(e.key==="Escape"){ G.selected=null; G.shovel=false; refreshSeedSel(); }
  const n=parseInt(e.key,10);
  if(n>=1&&n<=levelDef().plants.length) selectSeed(levelDef().plants[n-1]);
});

/* ================= 按钮 ================= */
$("shovel-btn").addEventListener("click",()=>{
  if(G.scene!=="play") return;
  G.selected=null; refreshSeedSel();
  G.shovel=!G.shovel;
});
function togglePause(){
  if(G.scene==="play"){ G.scene="pause"; showOverlay("ov-pause"); }
  else if(G.scene==="pause"){ G.scene="play"; showOverlay(null); }
}
$("pause-btn").addEventListener("click",togglePause);
$("btn-start").addEventListener("click",startBattle);
$("btn-back-menu").addEventListener("click",()=>{ G.scene="menu"; buildLevelGrid(); showOverlay("ov-menu"); });
$("btn-resume").addEventListener("click",togglePause);
$("btn-restart").addEventListener("click",()=>{ openIntro(G.level); startBattle(); });
$("btn-quit").addEventListener("click",()=>{ G.scene="menu"; buildLevelGrid(); showOverlay("ov-menu"); });
$("btn-next").addEventListener("click",()=>{ openIntro(Math.min(G.level+1,LEVELS.length-1)); });
$("btn-retry").addEventListener("click",()=>{ openIntro(G.level); startBattle(); });
$("btn-menu2").addEventListener("click",()=>{ G.scene="menu"; buildLevelGrid(); showOverlay("ov-menu"); });

/* ================= 启动 ================= */
G.seedCd={};
resetLevelState();        // 必须在首帧 render 前初始化 G.grid / G.mowers
buildLevelGrid();
showOverlay("ov-menu");
requestAnimationFrame(loop);
