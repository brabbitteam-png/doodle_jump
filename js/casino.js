/* ════════════════════════════════════════
   casino.js — ALL Gambling Mechanics
   
   RTP: ~92%
   Phases: honey (games 1-3, 80% win) / ride (60%) / drain (every 7th, 20%)
   Death: based on bet size + current multiplier height
   Multiplier: progressive (+0.02 at low, up to +0.20 at high)
   Platform types: green/orange/purple/ultra — death is HIDDEN (no visual diff)
════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   ③ GAME ENGINE — v7
══════════════════════════════════════════════════════ */
let cv,ctx;
function setupGameCanvas(){cv=document.getElementById('gameCanvas');ctx=cv.getContext('2d');cv.width=360;cv.height=640;}

/* ══ PRNG ══ */
function mkRNG(s){
  s=s>>>0;
  return{
    n(){s=(Math.imul(1664525,s)+1013904223)>>>0;return s/0x100000000},
    i(a,b){return a+Math.floor(this.n()*(b-a+1))}
  };
}

/* ══ CONFIG ══ */
const W_CANVAS=360, H_CANVAS=640;
const DW=52, DH=52, PH=14, GRAV=0.52, JVEL=-17.5, GAP=118;
const MAX_PLAT=500; // effectively infinite — 500 platforms = max ~100×
const MAX_MULT=100;

// Bet tiers for death chance (base per-platform chance FROM 1.5×)
// Structure: [minBet, baseMineChance]
/* ── Casino phases ── */
const PHASE={H:'honey',R:'ride',D:'drain'};
// Win probability per phase (session will or won't have a mine)
const PHASE_WIN_P={honey:0.80, ride:0.60, drain:0.20};
// Earliest mult at which mine CAN appear per phase
const PHASE_MINE_FROM={honey:2.0, ride:1.0, drain:0.8};
// Mine prob PER PLATFORM once above threshold (base, before bet/height scaling)
const PHASE_MINE_BASE={honey:0.018, ride:0.032, drain:0.065};

/* ── Bet size modifier on mine chance ── */
const BET_TIERS=[
  [0,       1.0],   // 50–499: no change
  [500,     1.4],   // 500–4999: +40%
  [5000,    1.9],   // 5k–14999: +90%
  [15000,   2.5],   // 15k–49999: ×2.5
  [50000,   3.2],   // 50k–249999: ×3.2
  [250000,  4.0],   // 250k+: ×4
  [500000,  5.0],
  [1000000, 6.5],
];

 // incremented on each startGame

// Platform mult increment by current mult level
// Returns per-platform mult gain
/* Base increment per mult level (green platform) */
function platIncrement(currentMult){
  if(currentMult<1.0)  return 0.02;
  if(currentMult<2.0)  return 0.05;
  if(currentMult<5.0)  return 0.08;
  if(currentMult<10.0) return 0.10;
  if(currentMult<20.0) return 0.15;
  if(currentMult<50.0) return 0.20;
  return 0.30; // 50×+
}

/* Per-platform mult: orange +1 step, purple +2 steps, ultra = ×3 base */
function platMultForType(currentMult, type){
  const base=platIncrement(currentMult);
  if(type==='orange') return Math.round((base+0.01)*1000)/1000;
  if(type==='purple') return Math.round((base+0.02)*1000)/1000;
  if(type==='ultra')  return Math.round(base*3*1000)/1000;
  return base; // green, cp
}

// Death chance per platform — phase + bet + height aware
function deathChance(currentMult, bet, phase){
  phase=phase||PHASE.R;
  const mineFrom=PHASE_MINE_FROM[phase]||1.0;
  if(currentMult < mineFrom) return 0;

  // Base per-platform chance from phase
  let base=PHASE_MINE_BASE[phase]||0.032;

  // Bet size multiplier
  let betMult=1.0;
  for(const [minBet,mult] of BET_TIERS){ if(bet>=minBet) betMult=mult; }

  // Height multiplier
  let heightMult=1.0;
  if(currentMult>=20)     heightMult=3.5;
  else if(currentMult>=10) heightMult=2.5;
  else if(currentMult>=5)  heightMult=1.8;
  else if(currentMult>=2)  heightMult=1.3;

  return Math.min(0.65, base*betMult*heightMult);
}


// Platform visual type (same as before — orange/purple/ultra hidden death)
function pickPlatType(rng){
  const r=rng.n();
  if(r<0.04) return 'ultra';
  if(r<0.12) return 'purple';
  if(r<0.32) return 'orange';
  return 'green';
}

/* ══ SPRITE ══ */


/* ══ CANVAS SETUP ══ */


/* ══ PLATFORM MULT MAP ══ */
const PLAT_MULT_MAP={green:1,orange:1,purple:1,ultra:1,green_extra:1};

/* ══ GENERATE SESSION — seeded casino outcome ══
   RTP 92%: phase controls win/lose before session starts.
   If willLose → mine injected at seeded position after mineFrom threshold.
   All 500 platforms generated regardless — world doesn't end early.
*/
function getPhase(){
  if(APP.gamesPlayed<3) return PHASE.H;
  if(APP.gamesPlayed%7===0) return PHASE.D;
  return PHASE.R;
}

function genSession(seed, bet, wheelMult){
  const phase=getPhase();
  const rng=mkRNG(seed);

  // Step 1: decide outcome
  const willWin=rng.n()<PHASE_WIN_P[phase];

  // Step 2: if losing, pick mine position (after mineFrom mult)
  // We'll mark it during platform generation
  // Use a second RNG value to pick "how far past threshold"
  const mineFrom=PHASE_MINE_FROM[phase];
  // mineDelay: how many platforms past threshold before mine hits
  // honey: longer delay (8-20), ride: medium (3-12), drain: short (1-6)
  const mineDelayRange={honey:[15,30],ride:[5,15],drain:[2,8]};
  const [dlo,dhi]=mineDelayRange[phase];
  const mineDelay=dlo+Math.floor(rng.n()*(dhi-dlo+1));

  const plats=[];
  let mult=wheelMult;
  let pastThreshold=0; // platforms counted after mineFrom
  let mineSet=false;

  for(let i=0;i<MAX_PLAT;i++){
    const type=pickPlatType(rng);
    const pw=78+rng.i(0,26);
    const px=14+rng.i(0,W_CANVAS-pw-28);
    const dr=rng.i(-6,6);

    // Is this the seeded mine platform?
    let isDeath=false;
    if(!willWin&&!mineSet&&mult>=mineFrom){
      pastThreshold++;
      if(pastThreshold>=mineDelay){
        isDeath=true;
        mineSet=true;
      }
    }

    const pm=platMultForType(mult,type);
    const mb=mult;
    if(!isDeath) mult=Math.round((mult+pm)*1000)/1000;
    if(mult>MAX_MULT) mult=MAX_MULT;

    plats.push({i,type,px,pw,dr,pm,mb,ma:mult,isDeath,phase});
    if(mult>=MAX_MULT) break;
  }
  return{seed,phase,willWin,bet,wheelMult,plats,maxMult:mult};
}
