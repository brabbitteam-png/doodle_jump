/* ════════════════════════════════════════
   wheel.js — Fortune Wheel Screen
   
   Segments: +0.1×(×3), +0.2×(×2), +0.3×, +0.5×, Shield, Star, Empty(×3)
   Avg payout: ~0.3× per session (4 spins baseline)
   Max 1 shield + 1 star per session
════════════════════════════════════════ */

const WHEEL_SEGS=[
  {label:'+0.1×',icon:'✨',color:'#1E6FA8',type:'multiplier',value:.1},
  {label:'+0.1×',icon:'✨',color:'#185C8E',type:'multiplier',value:.1},
  {label:'+0.1×',icon:'✨',color:'#1560A0',type:'multiplier',value:.1},
  {label:'+0.2×',icon:'💫',color:'#1A7040',type:'multiplier',value:.2},
  {label:'+0.2×',icon:'💫',color:'#155C35',type:'multiplier',value:.2},
  {label:'+0.3×',icon:'💫',color:'#B8720C',type:'multiplier',value:.3},
  {label:'+0.5×',icon:'🌟',color:'#A02020',type:'multiplier',value:.5},
  {label:'Щит',  icon:'🛡',color:'#5C2880',type:'shield'},
  {label:'Звезда',icon:'🌠',color:'#7A6A00',type:'star'},
  {label:'Пусто', icon:'',  color:'#1E2830',type:'empty'},
  {label:'Пусто', icon:'',  color:'#182028',type:'empty'},
  {label:'Пусто', icon:'',  color:'#121820',type:'empty'},
];
const WN=12,WTAU=Math.PI*2,WARC=WTAU/WN,WTOP=-Math.PI/2;
const BASE_W=[10,10,10,7,7,5,3,8,6,14,14,14];
const STREAK_W=[12,12,12,8,8,5,3,6,5,18,18,18];
const TIERS=[
  {min:50,    max:500,    sp:3,lk:0},
  {min:500,   max:5000,   sp:4,lk:2},
  {min:5000,  max:15000,  sp:5,lk:4},
  {min:15000, max:50000,  sp:6,lk:6},
  {min:50000, max:250000, sp:7,lk:9},
  {min:250000,max:500000, sp:8,lk:13},
  {min:500000,max:1e6,    sp:9,lk:18},
  {min:1e6,   max:1e9,    sp:10,lk:25},
];
function getTier(b){for(let i=TIERS.length-1;i>=0;i--)if(b>=TIERS[i].min)return TIERS[i];return TIERS[0];}

let wAngle=0,wSpinning=false,wSpinsLeft=3,wTotalMult=0,wCollected=[],wWinsRow=0,wLuck=0,wBetLocked=false,wRaf=null;

function initWheel(){
  makeStars('wheelStars',25);
  wAngle=0;wSpinning=false;wSpinsLeft=3;wTotalMult=0;wCollected=[];wWinsRow=0;wLuck=0;wBetLocked=false;
  APP.bet=50;
  const slider=document.getElementById('betSlider');
  slider.max=Math.max(50,APP.balance);
  slider.value=50;
  slider.disabled=false;
  updateBetUI();
  document.getElementById('wheelBalance').textContent=APP.balance.toLocaleString('ru-RU');
  document.getElementById('bonusChips').innerHTML='<span class="chips-empty">Крути колесо!</span>';
  document.getElementById('wheelMultVal').textContent='0.0×';
  document.getElementById('wheelMultVal').className='mult-val-big';
  document.getElementById('wheelPlayBtn').innerHTML='<div class="shine"></div>🎰 КРУТИТЬ!';
  document.getElementById('wheelPlayBtn').disabled=false;
  document.getElementById('wheelPlayBtn').onclick=doSpin;
  document.getElementById('spinCenterBtn').disabled=false;
  document.getElementById('spinCenterBtn').onclick=doSpin;
  slider.oninput=()=>{if(!wBetLocked)updateBetUI();};
  drawWheel(wAngle);
}

function updateBetUI(){
  const bet=+document.getElementById('betSlider').value;
  APP.bet=bet;
  const t=getTier(bet);
  document.getElementById('betAmount').textContent=bet.toLocaleString('ru-RU');
  document.getElementById('betInfo').textContent=t.sp+' кручений · удача +'+t.lk+'%';
  document.getElementById('luckFill').style.width=Math.min(100,(t.lk/25)*100)+'%';
  document.getElementById('luckPct').textContent='+'+t.lk+'%';
  wLuck=t.lk;
  wSpinsLeft=t.sp;
  document.getElementById('spinsN').textContent=wSpinsLeft;
  document.querySelectorAll('.tier-cell').forEach(el=>{
    el.classList.toggle('active-tier',bet>=+el.dataset.min&&bet<+el.dataset.max);
  });
  const warn=bet>APP.balance;
  document.getElementById('wheelPlayBtn').disabled=warn;
  document.getElementById('spinCenterBtn').disabled=warn;
}

function drawWheel(a){
  const cv=document.getElementById('wheelCanvas');
  const ctx=cv.getContext('2d');
  const CX=cv.width/2,CY=cv.height/2,R=CX-8;
  ctx.clearRect(0,0,cv.width,cv.height);
  for(let i=0;i<WN;i++){
    const sa=a+i*WARC,ea=sa+WARC;
    ctx.beginPath();ctx.moveTo(CX,CY);ctx.arc(CX,CY,R,sa,ea);ctx.closePath();
    ctx.fillStyle=WHEEL_SEGS[i].color;ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(CX+Math.cos(a+i*WARC)*26,CY+Math.sin(a+i*WARC)*26);
    ctx.lineTo(CX+Math.cos(a+i*WARC)*R,CY+Math.sin(a+i*WARC)*R);
    ctx.strokeStyle='rgba(255,215,0,.2)';ctx.lineWidth=1;ctx.stroke();
    ctx.save();ctx.translate(CX,CY);ctx.rotate(sa+WARC/2);
    ctx.textAlign='right';ctx.textBaseline='middle';
    ctx.fillStyle='#fff';ctx.font='600 9.5px Inter,sans-serif';
    ctx.fillText(WHEEL_SEGS[i].label,R-7,0);
    if(WHEEL_SEGS[i].icon){ctx.font='10px serif';ctx.fillText(WHEEL_SEGS[i].icon,R-46,0);}
    ctx.restore();
  }
  ctx.beginPath();ctx.arc(CX,CY,R,0,WTAU);ctx.strokeStyle='#FFD700';ctx.lineWidth=3;ctx.stroke();
  ctx.beginPath();ctx.arc(CX,CY,27,0,WTAU);ctx.fillStyle='#0d0530';ctx.fill();
  ctx.strokeStyle='#FFD700';ctx.lineWidth=2;ctx.stroke();
}

function wheelPickSeg(){
  const lk=wLuck/100;
  const hasShield=wCollected.some(b=>b.type==='shield');
  const hasStar=wCollected.some(b=>b.type==='star');
  const raw=wWinsRow>=2?STREAK_W:BASE_W;
  const w=raw.map((v,i)=>{
    const seg=WHEEL_SEGS[i];
    if(seg.type==='shield'&&hasShield) return 0;   // max 1 shield
    if(seg.type==='star'&&hasStar)     return 0;   // max 1 star
    if(seg.type==='empty')    return Math.max(1,v*(1-lk*.6));
    if(seg.type==='multiplier') return v*(1+lk);
    return v*(1+lk*.5);
  });
  const tot=w.reduce((a,b)=>a+b,0);let r=Math.random()*tot;
  for(let i=0;i<w.length;i++){r-=w[i];if(r<=0)return i;}
  return w.length-1;
}

function doSpin(){
  if(wSpinning||wSpinsLeft<=0)return;
  if(!wBetLocked){
    APP.balance-=APP.bet;
    document.getElementById('wheelBalance').textContent=APP.balance.toLocaleString('ru-RU');
    document.getElementById('betSlider').disabled=true;
    wBetLocked=true;
  }
  wSpinning=true;
  document.getElementById('spinCenterBtn').disabled=true;
  document.getElementById('wheelPlayBtn').disabled=true;
  const idx=wheelPickSeg();
  const finalA=WTOP-idx*WARC-WARC/2;
  let delta=((finalA-wAngle)%WTAU+WTAU)%WTAU;
  if(delta<.01)delta+=WTAU;
  const totalRot=(2+Math.floor(Math.random()*2))*WTAU+delta;
  const dur=1600+Math.random()*400;
  const a0=wAngle,t0=performance.now();
  const ease=t=>1-Math.pow(1-t,3);
  (function frame(now){
    const p=Math.min((now-t0)/dur,1);
    wAngle=a0+totalRot*ease(p);drawWheel(wAngle);
    if(p<1){wRaf=requestAnimationFrame(frame);}
    else{
      wAngle=a0+totalRot;drawWheel(wAngle);
      wSpinning=false;wSpinsLeft--;
      document.getElementById('spinsN').textContent=wSpinsLeft;
      const fl=document.getElementById('wheelFlash');
      fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),280);
      const seg=WHEEL_SEGS[idx];
      if(seg.type!=='empty'){
        wCollected.push(seg);
        if(seg.type==='multiplier')wTotalMult=Math.round((wTotalMult+seg.value)*10)/10;
        wWinsRow++;
      } else wWinsRow=Math.max(0,wWinsRow-1);
      renderBonusChips();
      document.getElementById('wheelMultVal').textContent=wTotalMult.toFixed(1)+'×';
      document.getElementById('wheelMultVal').className='mult-val-big'+(wTotalMult>=.5?' hot':'');
      if(wSpinsLeft>0){
        document.getElementById('spinCenterBtn').disabled=false;
        document.getElementById('spinCenterBtn').onclick=doSpin;
        document.getElementById('wheelPlayBtn').disabled=false;
        document.getElementById('wheelPlayBtn').innerHTML='<div class="shine"></div>🎰 Ещё раз! ('+wSpinsLeft+')';
        document.getElementById('wheelPlayBtn').onclick=doSpin;
      } else {
        document.getElementById('spinCenterBtn').disabled=true;
        document.getElementById('wheelPlayBtn').disabled=false;
        document.getElementById('wheelPlayBtn').innerHTML='<div class="shine"></div>▶ НАЧАТЬ ИГРУ!';
        document.getElementById('wheelPlayBtn').onclick=startGameFromWheel;
      }
    }
  })(performance.now());
}

function renderBonusChips(){
  const row=document.getElementById('bonusChips');
  if(!wCollected.length){row.innerHTML='<span class="chips-empty">Крути колесо!</span>';return;}
  row.innerHTML=wCollected.map(b=>'<div class="chip '+(b.type==='multiplier'?'gold':'')+'">'+b.icon+' '+b.label+'</div>').join('');
}

function startGameFromWheel(){
  APP.wheelBonuses=wCollected;
  APP.wheelMult=wTotalMult;
  APP.wheelShield=wCollected.some(b=>b.type==='shield');
  APP.wheelStar=wCollected.some(b=>b.type==='star');
  navigate('wheel','game');
}

function toggleColl(bodyId,chevId){
  const b=document.getElementById(bodyId),ch=document.getElementById(chevId);
  const open=b.classList.toggle('open');
  ch.classList.toggle('open',open);
  if(open){
    b.style.overflow='hidden';
    setTimeout(()=>{if(b.classList.contains('open'))b.style.overflow='visible';},380);
  } else {
    b.style.overflow='hidden';
  }
}
