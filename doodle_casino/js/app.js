/* ════════════════════════════════════════
   app.js — Global State, Navigation, Helpers
   Doodle Casino
════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   GLOBAL STATE
══════════════════════════════════════════════════════ */
const APP={
  balance: 5000,
  gamesPlayed: 0,
  // Wheel results passed to game
  wheelBonuses: [],
  wheelMult: 0,
  wheelShield: false,
  wheelStar: false,
  bet: 50,
  tgUser: null,
};

/* ══════════════════════════════════════════════════════
   TELEGRAM INIT
══════════════════════════════════════════════════════ */
(function(){
  const tg=window.Telegram?.WebApp;
  if(tg){
    tg.ready();tg.expand();
    tg.setHeaderColor('#06001a');tg.setBackgroundColor('#06001a');
    const u=tg.initDataUnsafe?.user;
    if(u){
      APP.tgUser=u;
      document.getElementById('lobbyAvatar').textContent=(u.first_name||'D')[0].toUpperCase();
      document.getElementById('lobbyUsername').textContent='@'+(u.username||u.first_name||'doodler');
    }
  }
})();

/* ══════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════ */

function navigate(from,to,dir){
  const fromEl=document.getElementById(from);
  const toEl=document.getElementById(to);
  const isBack=dir==='back';
  fromEl.classList.add(isBack?'slide-out-right':'slide-out-left');
  toEl.style.display='flex';
  toEl.classList.add(isBack?'slide-in-left':'slide-in-right');
  setTimeout(()=>{
    fromEl.classList.remove('active','slide-out-right','slide-out-left');
    fromEl.style.display='none';
    toEl.classList.add('active');
    toEl.classList.remove('slide-in-right','slide-in-left');
    onScreenEnter(to);
  },280);
}

function onScreenEnter(screen){
  if(screen==='lobby')  initLobby();
  if(screen==='wheel')  initWheel();
  if(screen==='game')   initGame();
}

/* ══════════════════════════════════════════════════════
   SHARED SPRITE
══════════════════════════════════════════════════════ */

const SPR=new Image();
SPR.src='data:image/png;base64,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';

/* ══════════════════════════════════════════════════════
   PRNG
══════════════════════════════════════════════════════ */
function mkRNG(s){
  s=s>>>0;
  return{n(){s=(Math.imul(1664525,s)+1013904223)>>>0;return s/0x100000000},i(a,b){return a+Math.floor(this.n()*(b-a+1))}};
}

/* ══════════════════════════════════════════════════════
   STARS
══════════════════════════════════════════════════════ */
