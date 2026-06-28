/* ════════════════════════════════════════
   game.js — Game Engine v7
   
   Infinite game (max 100×)
   Progressive multiplier growth
   Hidden mine platforms (no visual difference)
   ЗАБРАТЬ button with FOMO mechanics
════════════════════════════════════════ */

/* ══ GAME STATE ══ */
const BET=50;


let G=null, rafID=null, stars=[];

function mkStars(){
  stars=[];
  for(let i=0;i<80;i++)
    stars.push({x:Math.random()*W_CANVAS,y:Math.random()*55000,r:Math.random()*1.4+.3,a:Math.random()*.7+.2,ph:Math.random()*Math.PI*2,sp:.8+Math.random()*1.4});
}

/* ══ BUILD WORLD ══ */
function buildWorld(sess){
  const W=cv?cv.width:360, H=cv?cv.height:640;
  return sess.plats.map((s,idx)=>({
    x:s.px, w:s.pw,
    y:(H-70)-idx*GAP,
    type:s.type, si:idx,
    hit:false, flash:0, la:1, ly:0
  }));
}

/* ══ INIT GAME ══ */
// Called by navigation (no args) — sets up canvas and starts game
function initGame(){
  setupGameCanvas();
  startGame();
}

function createGameState(sess,plats,shieldActive,starActive){
  const p0=plats[0];
  const W=cv.width, H=cv.height;
  return{
    sess, plats,
    mult:sess.wheelMult,
    cam:0,
    dead:false, won:false, paused:false,
    cashedOut:false,
    dx:p0.x+p0.w/2-DW/2,
    dy:p0.y-DH,
    dvx:0, dvy:JVEL,
    dface:1, dsquish:0,
    nextIdx:1,
    landed:0,
    shieldActive, shieldUsed:false, shieldFlash:0,
    starActive:starActive||false, starUsed:false,
  };
}

/* ══ TICK ══ */
function tick(){
  if(!G||G.dead||G.won||G.paused) return;
  const H=cv.height;

  // Steer toward next platform
  if(G.nextIdx<G.plats.length){
    const tp=G.plats[G.nextIdx];
    const s=G.sess.plats[G.nextIdx];
    const tX=tp.x+tp.w/2-DW/2+(s?s.dr:0);
    const diff=tX-G.dx;
    G.dvx+=Math.sign(diff)*Math.min(0.55,Math.abs(diff)*.038);
    G.dvx=Math.max(-7.0,Math.min(7.0,G.dvx));
    if(Math.abs(diff)>6) G.dface=diff>0?1:-1;
  }

  // Physics
  G.dvy+=GRAV; G.dx+=G.dvx; G.dy+=G.dvy;
  const W=cv.width;
  if(G.dx+DW<0) G.dx=W; if(G.dx>W) G.dx=-DW;
  if(G.dsquish>0) G.dsquish=Math.max(0,G.dsquish-.08);
  if(G.shieldFlash>0) G.shieldFlash=Math.max(0,G.shieldFlash-.045);

  // Camera
  if(G.dy-G.cam<H*.40) G.cam=G.dy-H*.40;

  // Label fade
  G.plats.forEach(p=>{if(p.hit&&p.la>0){p.la=Math.max(0,p.la-.04);p.ly-=0.8;}});

  // Collision with next platform only
  if(G.dvy>0&&G.nextIdx<G.plats.length){
    const tp=G.plats[G.nextIdx];
    const feet=G.dy+DH;
    const inX=G.dx+DW-3>tp.x&&G.dx+3<tp.x+tp.w;
    const inY=feet>=tp.y&&feet<=tp.y+PH+G.dvy+3;
    if(inX&&inY){
      G.dy=tp.y-DH; G.dvy=JVEL; G.dvx*=.30; G.dsquish=1;
      tp.hit=true; tp.flash=1; tp.ly=tp.y-G.cam-16;
      onLand(tp); return;
    }
    // Missed
    if(feet>tp.y+PH+140&&G.dvy>0){ triggerDeath('miss'); return; }
  }
  if(G.dy-G.cam>H+90){ triggerDeath('fell'); return; }

  updHUD(); updRisk();
}

/* ══ LAND ══ */
function onLand(tp){
  const s=G.sess.plats[tp.si];
  G.landed++;

  if(s.isDeath){
    G.mult=s.mb; // keep mult before this platform
    if(G.shieldActive&&!G.shieldUsed){
      G.shieldUsed=true; G.shieldActive=false; G.shieldFlash=1.0;
      G.nextIdx++;
      floatText('🛡 Щит защитил!',tp.x+tp.w/2,tp.y-G.cam-20,'#64B5F6',15,900);
      updHUD(); return;
    }
    G.nextIdx++;
    setTimeout(()=>{ if(!G.dead){ G.mult=0; triggerDeath('mine'); }},350);
    return;
  }

  G.mult=s.ma;
  G.nextIdx++;

  // Hit max?
  if(G.mult>=MAX_MULT||G.nextIdx>=G.plats.length){
    G.won=true;
    setTimeout(()=>triggerCashout(true),400);
    return;
  }

  updHUD(); updRisk();
  updTakeBtn();
}

/* ══ DEATH ══ */
function triggerDeath(reason){
  if(G.dead) return;
  G.dead=true;
  hideTakeBtn();
  const subs={miss:'Дудлер промахнулся мимо платформы',fell:'Упал вниз',mine:'Упс, платформа была заминирована'};
  setTimeout(()=>{
    const pay=0; // lost bet
    document.getElementById('dIcon').textContent='💀';
    document.getElementById('dTitle').textContent='Проигрыш!';
    document.getElementById('dTitle').style.color='#FF4444';
    document.getElementById('dSub').textContent=subs[reason]||'';
    document.getElementById('dMult').textContent='0.0×';
    document.getElementById('dMult').style.color='#FF4444';
    document.getElementById('dPay').textContent='Ставка потеряна: −'+APP.bet.toLocaleString('ru-RU')+' монет';
    document.getElementById('deathOv').classList.add('show');
  },220);
}

/* ══ CASHOUT — direct, no pre-confirm modal ══ */
function requestCashout(){
  if(!G||G.dead||G.won||G.paused||G.cashedOut) return;
  G.cashedOut=true;
  const curMult=G.mult;
  // FOMO mult: what player "could have gotten" — slightly inflated for effect
  // Formula: base projection + random 30-80% bonus on top
  // Players who cash out early (mult<1.5) see the biggest FOMO jump
  const fomoMult=calcFomoMult(curMult, G.sess);
  triggerCashout(false, curMult, fomoMult);
}

/* FOMO formula — always higher than current, scale depends on where player stopped */
function calcFomoMult(curMult, sess){
  // Base: project forward 20 platforms from current mult
  let proj=curMult;
  for(let i=0;i<20;i++){
    proj=Math.round((proj+platIncrement(proj))*1000)/1000;
    if(proj>MAX_MULT) break;
  }
  // Inflate factor: bigger when player cashes out early (more FOMO)
  // 0×–1×: inflate ×2.2–3.5 (they left SO much on the table)
  // 1×–2×: inflate ×1.6–2.4
  // 2×–5×: inflate ×1.3–1.8
  // 5×+:   inflate ×1.15–1.4
  let inflateLo, inflateHi;
  if(curMult<1.0)      { inflateLo=2.2; inflateHi=3.5; }
  else if(curMult<2.0) { inflateLo=1.6; inflateHi=2.4; }
  else if(curMult<5.0) { inflateLo=1.3; inflateHi=1.8; }
  else                 { inflateLo=1.15; inflateHi=1.4; }
  const inflate=inflateLo+Math.random()*(inflateHi-inflateLo);
  const fomo=Math.round(proj*inflate*100)/100;
  return Math.min(MAX_MULT, fomo);
}

function triggerCashout(isMax, multOverride, fomoMult){
  G.won=true; G.cashedOut=true;
  hideTakeBtn();
  const m=isMax?G.mult:(multOverride||G.mult);
  const pay=Math.round(APP.bet*m);
  APP.balance+=pay;

  document.getElementById('wTitle').textContent=isMax?'🏆 Максимум!':'💰 Выплата получена!';
  document.getElementById('wSub').textContent=isMax?'Ты достиг 100×!':'Ты вовремя остановился';
  document.getElementById('wMult').textContent=m.toFixed(2)+'×';
  document.getElementById('wPay').textContent='+'+pay.toLocaleString('ru-RU')+' монет';
  document.getElementById('hbal').textContent=APP.balance.toLocaleString('ru-RU');

  // FOMO block — always show after manual cashout (never on max win)
  const fb=document.getElementById('fomoAfterBlock');
  if(!isMax&&fomoMult){
    const fomoPay=Math.round(APP.bet*fomoMult);
    document.getElementById('fomoAfterMult').textContent=fomoMult.toFixed(2)+'× ('+fomoPay.toLocaleString('ru-RU')+' монет)';
    // Dynamic FOMO subtext based on how much they left on table
    const ratio=fomoMult/m;
    let fomoSub='если бы не остановился';
    if(ratio>=3)       fomoSub='ты оставил на столе ×'+ratio.toFixed(1)+' больше 😤';
    else if(ratio>=2)  fomoSub='мог получить в '+ratio.toFixed(1)+' раза больше 😬';
    else if(ratio>=1.5) fomoSub='совсем чуть-чуть не хватило 😅';
    else               fomoSub='неплохо, но могло быть лучше';
    document.querySelector('#fomoAfterBlock .fb-sub')||null;
    // Update subtext in the fomo block
    const fbSub=document.getElementById('fomoAfterSub');
    if(fbSub) fbSub.textContent=fomoSub;
    fb.style.display='block';
  } else {
    fb.style.display='none';
  }

  document.getElementById('winOv').classList.add('show');
}

/* ══ HUD ══ */
function updHUD(){
  if(!G) return;
  APP.balance; // already set
  document.getElementById('hbal').textContent=APP.balance.toLocaleString('ru-RU');
  const pay=Math.round(APP.bet*G.mult);
  document.getElementById('hpay').textContent=pay.toLocaleString('ru-RU');
  const m=document.getElementById('hmv');
  m.textContent=G.mult.toFixed(3).replace(/\.?0+$/,'')+'×';
  if(G.mult<1) m.textContent=G.mult.toFixed(3)+'×';
  m.className='mv'+(G.mult>=10?' fire':G.mult>=3?' hot':'');

  // Wheel bonuses strip
  document.getElementById('bs').innerHTML=(APP.wheelBonuses||[]).map(b=>{
    if(b.type==='shield'){const u=G&&G.shieldUsed;return '<div class="bc'+(u?' used':'')+'">🛡 '+(G&&G.shieldActive&&!u?'Щит (активен)':u?'Щит (исп.)':'Щит')+'</div>';}
    if(b.type==='star'){const u=G&&G.starUsed;return '<div class="bc'+(u?' used':'')+'">🌠 '+(G&&G.starActive&&!u?'Звезда (активна)':u?'Звезда (исп.)':'Звезда')+'</div>';}
    return '<div class="bc gold">'+b.icon+' '+b.label+'</div>';
  }).join('');
}

function updRisk(){
  if(!G) return;
  const dc=deathChance(G.mult, G.sess.bet, G.sess.phase);
  const pct=Math.round(dc*100);
  document.getElementById('riskFill').style.width=Math.min(100,pct*2.5)+'%'; // visual exaggeration
  document.getElementById('riskVal').textContent=pct+'% / пл.';
}

function updTakeBtn(){
  if(!G||G.dead||G.won) return;
  const pay=Math.round(APP.bet*G.mult);
  document.getElementById('takeBtnSub').textContent=BET+' × '+G.mult.toFixed(2)+'× = '+pay.toLocaleString('ru-RU')+' монет';
}

function showTakeBtn(){
  document.getElementById('takeBtnWrap').style.display='block';
  updTakeBtn();
}
function hideTakeBtn(){
  document.getElementById('takeBtnWrap').style.display='none';
}

/* ══ RENDER ══ */
function render(ts){
  const W=cv.width, H=cv.height;
  const cam=G?G.cam:0;

  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#030010'); bg.addColorStop(1,'#120530');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Nebulas
  [[70,180,'rgba(80,0,180,.06)'],[290,350,'rgba(0,50,160,.05)'],[160,520,'rgba(100,20,0,.05)']].forEach(([x,y,c])=>{
    const sy=((y-cam)%55000+55000)%55000;
    const gr=ctx.createRadialGradient(x,sy,5,x,sy,100);
    gr.addColorStop(0,c); gr.addColorStop(1,'transparent');
    ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(x,sy,100,0,Math.PI*2); ctx.fill();
  });

  // Stars (parallax)
  const t=ts/1000;
  stars.forEach(s=>{
    const sy=((s.y-cam*.12)%56000+56000)%56000-H*.3;
    if(sy<-10||sy>H+10) return;
    const tw=s.a*(0.65+0.35*Math.sin(t*s.sp+s.ph));
    ctx.beginPath(); ctx.arc(s.x,sy,s.r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,'+tw.toFixed(2)+')'; ctx.fill();
  });

  if(!G) return;

  // Platforms
  G.plats.forEach(p=>{
    const sy=p.y-cam;
    if(sy<-50||sy>H+30) return;
    drawPlat(p,sy);
  });

  // Doodler
  if(!G.dead) drawDood(G.dx,G.dy-cam,G.dface,G.dsquish);
}

function drawPlat(p,sy){
  let c1,c2,bd,glow=null;
  // All platforms look normal — death is hidden
  switch(p.type){
    case 'orange': c1='#FFB74D';c2='#F57C00';bd='#E65100';break;
    case 'purple': c1='#CE93D8';c2='#9C27B0';bd='#6A1B9A';break;
    case 'ultra':  c1='#FFF176';c2='#FFD600';bd='#F9A825';glow='#FFD600';break;
    default:       c1='#6FCF6F';c2='#4CAF50';bd='#2E7D32';
  }
  const r=PH/2;
  ctx.save();
  if(glow){ctx.shadowColor=glow;ctx.shadowBlur=16;}
  const g=ctx.createLinearGradient(0,sy,0,sy+PH);
  g.addColorStop(0,c1);g.addColorStop(1,c2);
  pill(p.x,sy,p.w,PH,r);
  ctx.fillStyle=g;ctx.fill();
  ctx.strokeStyle=bd;ctx.lineWidth=2;ctx.stroke();
  ctx.restore();
  // Shine
  ctx.save();ctx.globalAlpha=.22;pill(p.x+5,sy+3,p.w-10,4,2);ctx.fillStyle='#fff';ctx.fill();ctx.restore();
  // Flash
  if(p.flash>0){ctx.save();ctx.globalAlpha=p.flash*.4;pill(p.x,sy,p.w,PH,r);ctx.fillStyle='#fff';ctx.fill();ctx.restore();p.flash=Math.max(0,p.flash-.1);}
  // Mult label
  const s=G.sess.plats[p.si];
  if(s&&s.pm>0){
    const alpha=p.hit?p.la:1;
    if(alpha>0){
      const ly2=p.hit?p.ly:sy-16;
      ctx.save();ctx.globalAlpha=alpha;
      ctx.font='bold 10px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      const gc=p.type==='ultra'?'#FFD600':p.type==='orange'?'#FF9800':p.type==='purple'?'#CE93D8':'#66BB6A';
      ctx.shadowColor=gc;ctx.shadowBlur=p.type==='ultra'?12:4;
      ctx.fillStyle='#fff';
      ctx.fillText('+'+s.pm.toFixed(3).replace(/0+$/,'').replace(/\.$/,'')+'×',p.x+p.w/2,ly2);
      ctx.restore();
    }
  }
  // Ultra sparkle
  if(p.type==='ultra'&&!p.hit){ctx.save();ctx.font='11px serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText('✨',p.x+p.w/2,sy-16);ctx.restore();}
}

function pill(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function drawDood(x,y,face,sq){
  if(G&&G.shieldFlash>0){
    ctx.save();ctx.globalAlpha=G.shieldFlash*.5;
    ctx.beginPath();ctx.arc(x+DW/2,y+DH/2,DW*.88,0,Math.PI*2);
    ctx.fillStyle='#64B5F6';ctx.fill();ctx.restore();
  }
  if(!SPR.complete||!SPR.naturalWidth) return;
  ctx.save();
  ctx.translate(x+DW/2,y+DH/2);
  ctx.scale(face*(1+(sq||0)*.18),(1-(sq||0)*.18));
  ctx.drawImage(SPR,-DW/2,-DH/2,DW,DH);
  ctx.restore();
}

function floatText(txt,cx,sy,col,size,dur){
  const el=document.createElement('div');
  el.style.cssText='position:absolute;pointer-events:none;font-family:Inter,sans-serif;font-size:'+size+'px;font-weight:900;color:'+col+';z-index:25;left:'+Math.max(5,Math.min(cv.width-140,cx-55))+'px;top:'+Math.max(80,sy)+'px;animation:floatUp '+(dur/1000)+'s ease forwards;text-shadow:0 0 10px '+col;
  el.textContent=txt;
  document.getElementById('gameWrap').appendChild(el);
  setTimeout(()=>el.remove(),dur);
}

/* ══ LOOP ══ */
function loop(ts){ tick(); render(ts); rafID=requestAnimationFrame(loop); }

/* ══ NAV BUTTONS ══ */
document.getElementById('dPlayAgain').onclick=()=>{ document.getElementById('deathOv').classList.remove('show'); navigate('game','wheel','back'); };
document.getElementById('dGoHome').onclick=()=>{ document.getElementById('deathOv').classList.remove('show'); navigate('game','lobby','back'); };
document.getElementById('wPlayAgain').onclick=()=>{ document.getElementById('winOv').classList.remove('show'); navigate('game','wheel','back'); };
document.getElementById('wGoHome').onclick=()=>{ document.getElementById('winOv').classList.remove('show'); navigate('game','lobby','back'); };
document.getElementById('takeBtn').onclick=requestCashout;

function showIdle(){cancelAnimationFrame(rafID);G=null;hideTakeBtn();navigate('game','lobby','back');}

/* ══ START ══ */
function startGame(){
  const BET=APP.bet||50;
  setupGameCanvas();
  cancelAnimationFrame(rafID);
  ['deathOv','winOv'].forEach(id=>document.getElementById(id).classList.remove('show'));
  mkStars();
  APP.balance-=BET;
  document.getElementById('hbal').textContent=APP.balance.toLocaleString('ru-RU');

  APP.gamesPlayed++;
  const seed=Math.floor(Math.random()*0xFFFFFFFF);
  const sess=genSession(seed, APP.bet, APP.wheelMult);
  const plats=buildWorld(sess);
  G=createGameState(sess,plats,APP.wheelShield||false,APP.wheelStar||false);

  updHUD(); updRisk();
  showTakeBtn();
  rafID=requestAnimationFrame(loop);
}

/* ══ IDLE INIT ══ */



/* ══════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════ */
try {
  initLobby();
} catch(e) {
  console.error('Boot error:', e);
  // Show error on screen so we can debug
  document.body.innerHTML='<div style="color:#fff;padding:20px;font-family:monospace;background:#06001a;min-height:100vh"><h2 style="color:#FFD700">Ошибка загрузки</h2><pre style="white-space:pre-wrap;font-size:12px;margin-top:10px">'+e.message+'\n\n'+e.stack+'</pre></div>';
}
