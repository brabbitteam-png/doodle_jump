/* ════════════════════════════════════════
   lobby.js — Lobby Screen
════════════════════════════════════════ */

function makeStars(containerId,count){
  const c=document.getElementById(containerId);
  c.innerHTML='';
  for(let i=0;i<count;i++){
    const s=document.createElement('div');s.className='star';
    const sz=Math.random()*2+.4;
    s.style.cssText='width:'+sz+'px;height:'+sz+'px;top:'+(Math.random()*100)+'%;left:'+(Math.random()*100)+'%;animation-delay:'+(Math.random()*3)+'s;animation-duration:'+(1.4+Math.random()*2)+'s';
    c.appendChild(s);
  }
}

/* ══════════════════════════════════════════════════════
   ① LOBBY
══════════════════════════════════════════════════════ */
let lobbyRaf=null;
const LOBBY_PLATS=[{x:20,y:155,w:80},{x:120,y:118,w:75},{x:220,y:84,w:70},{x:55,y:56,w:75},{x:190,y:26,w:70}];
let lx=50,ly=118,lvx=0.7,lvy=0,ltarget=1,lface=1,lLastT=0;
const LGRAV=0.22,LJUMP=-7.0,LSPEED=0.45;

function initLobby(){
  makeStars('lobbyStars',30);
  updateLobbyBalance();
  // daily bonus
  const key='dc_daily_'+new Date().toDateString();
  if(!localStorage.getItem(key)){
    APP.balance+=250;
    localStorage.setItem(key,'1');
    updateLobbyBalance();
    const t=document.getElementById('lobbyToast');
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),2500);
  }
  document.getElementById('dailyBtn').onclick=()=>{
    const t=document.getElementById('lobbyToast');
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),2000);
  };
  if(lobbyRaf) cancelAnimationFrame(lobbyRaf);
  lLastT=0;
  lobbyRaf=requestAnimationFrame(lobbyLoop);
}

function updateLobbyBalance(){
  document.getElementById('lobbyBalance').textContent=APP.balance.toLocaleString('ru-RU')+' 🪙';
}

/* cross-browser rounded rect — ctx.roundRect not supported in older Safari */
function roundedRect(ctx,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function lobbyFindTarget(){
  let best=0,bs=Infinity;
  for(let i=0;i<LOBBY_PLATS.length;i++){
    const p=LOBBY_PLATS[i];
    if(p.y<ly-5&&p.y>ly-200){
      const sc=Math.abs(p.x+p.w/2-(lx+18))*.5+(ly-p.y)*.3;
      if(sc<bs){bs=sc;best=i;}
    }
  }
  return best;
}

function lobbyLoop(ts){
  try{
    const dt=lLastT?(ts-lLastT)/16:1;lLastT=ts;
    const sp=LSPEED*dt;
    const cv=document.getElementById('lobbyCanvas');
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,320,180);
    const tp=LOBBY_PLATS[ltarget];
    const diff=(tp.x+tp.w/2)-(lx+18);
    lvx+=Math.sign(diff)*.08*sp;lvx=Math.max(-2,Math.min(2,lvx));
    if(Math.abs(diff)>5)lface=diff>0?1:-1;
    lvy=(lvy+LGRAV*sp);lx+=lvx*sp;ly+=lvy*sp;
    if(lx+36<0)lx=320;if(lx>320)lx=-36;
    if(lvy>0){
      for(const p of LOBBY_PLATS){
        const df=ly+36;
        if(lx+30>p.x&&lx+6<p.x+p.w&&df>=p.y&&df<=p.y+14+Math.abs(lvy*sp)+2){
          ly=p.y-36;lvy=LJUMP;ltarget=lobbyFindTarget();break;
        }
      }
    }
    if(ly>200){lx=LOBBY_PLATS[0].x+LOBBY_PLATS[0].w/2-18;ly=LOBBY_PLATS[0].y-36;lvy=LJUMP;ltarget=lobbyFindTarget();}
    LOBBY_PLATS.forEach(p=>{
      const g=ctx.createLinearGradient(0,p.y,0,p.y+12);
      g.addColorStop(0,'#6FCF6F');g.addColorStop(1,'#4CAF50');
      roundedRect(ctx,p.x,p.y,p.w,12,6);
      ctx.fillStyle=g;ctx.fill();
      ctx.strokeStyle='#2E7D32';ctx.lineWidth=2;ctx.stroke();
      ctx.globalAlpha=.25;ctx.fillStyle='#fff';
      roundedRect(ctx,p.x+5,p.y+2,p.w-10,4,2);ctx.fill();
      ctx.globalAlpha=1;
    });
    if(SPR.complete&&SPR.naturalWidth){
      ctx.save();ctx.translate(lx+18,ly+18);ctx.scale(lface,1);
      ctx.drawImage(SPR,-18,-18,36,36);ctx.restore();
    }
  }catch(e){console.error('lobbyLoop:',e);}
  lobbyRaf=requestAnimationFrame(lobbyLoop);
}

/* ══════════════════════════════════════════════════════
   ② WHEEL
══════════════════════════════════════════════════════ */
