/* ==================================================================
   TOENE - alle vom Computer selbst erzeugt, keine Dateien noetig.
   ================================================================== */

let hof = null;          // der "AudioContext"
let lautstaerke = null;
export let tonAn = true;

function starte() {
  if (hof) return hof;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  hof = new AC();
  lautstaerke = hof.createGain();
  lautstaerke.gain.value = 0.5;
  lautstaerke.connect(hof.destination);
  return hof;
}

// Handys erlauben Toene erst nach der ersten Beruehrung
export function weckeTon() {
  const h = starte();
  if (h && h.state === 'suspended') h.resume();
}

export function schalteTon(an) {
  tonAn = an;
  if (lautstaerke) lautstaerke.gain.value = an ? 0.5 : 0;
  return tonAn;
}

/* ---------- ein einzelner Ton ---------- */
function ton({ hoehe = 440, dauer = 0.2, form = 'sine', laut = 0.3, gleiten = 0, verzug = 0 }) {
  const h = starte();
  if (!h || !tonAn) return;
  const jetzt = h.currentTime + verzug;
  const o = h.createOscillator();
  const g = h.createGain();
  o.type = form;
  o.frequency.setValueAtTime(hoehe, jetzt);
  if (gleiten) o.frequency.exponentialRampToValueAtTime(Math.max(20, hoehe + gleiten), jetzt + dauer);
  g.gain.setValueAtTime(0, jetzt);
  g.gain.linearRampToValueAtTime(laut, jetzt + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, jetzt + dauer);
  o.connect(g).connect(lautstaerke);
  o.start(jetzt);
  o.stop(jetzt + dauer + 0.05);
}

/* ---------- Rauschen (fuer Wasser) ---------- */
function rauschen({ dauer = 0.5, laut = 0.2, filter = 900, verzug = 0 }) {
  const h = starte();
  if (!h || !tonAn) return;
  const jetzt = h.currentTime + verzug;
  const laenge = Math.floor(h.sampleRate * dauer);
  const puffer = h.createBuffer(1, laenge, h.sampleRate);
  const daten = puffer.getChannelData(0);
  for (let i = 0; i < laenge; i++) daten[i] = (Math.random() * 2 - 1) * (1 - i / laenge);
  const quelle = h.createBufferSource();
  quelle.buffer = puffer;
  const bp = h.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(filter, jetzt);
  bp.frequency.linearRampToValueAtTime(filter * 2.2, jetzt + dauer);
  bp.Q.value = 1.2;
  const g = h.createGain();
  g.gain.setValueAtTime(laut, jetzt);
  g.gain.exponentialRampToValueAtTime(0.001, jetzt + dauer);
  quelle.connect(bp).connect(g).connect(lautstaerke);
  quelle.start(jetzt);
}

/* ---------- die Toene des Spiels ---------- */

const TONLEITER = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];

/** Der Mond redet - ein kleines Blubbern pro Buchstabe */
let letzterSprechton = 0;
export function klangSprechen() {
  const j = Date.now();
  if (j - letzterSprechton < 45) return;
  letzterSprechton = j;
  const stufe = TONLEITER[2 + Math.floor(Math.random() * 4)];
  ton({ hoehe: stufe * 1.6, dauer: 0.07, form: 'triangle', laut: 0.07, gleiten: 40 });
}

/** Etwas aufheben */
export function klangPlopp() {
  ton({ hoehe: 520, dauer: 0.1, form: 'sine', laut: 0.25, gleiten: 320 });
  ton({ hoehe: 780, dauer: 0.16, form: 'sine', laut: 0.14, verzug: 0.06, gleiten: 200 });
}

/** Giessen */
export function klangGiessen() {
  rauschen({ dauer: 0.75, laut: 0.16, filter: 1100 });
  for (let i = 0; i < 5; i++) {
    ton({ hoehe: 900 + Math.random() * 700, dauer: 0.1, form: 'sine', laut: 0.05, verzug: i * 0.1, gleiten: -300 });
  }
}

/** Etwas waechst / die Welt wird groesser */
export function klangWachsen() {
  [0, 1, 2, 4].forEach((s, i) => {
    ton({ hoehe: TONLEITER[s], dauer: 0.7, form: 'triangle', laut: 0.16, verzug: i * 0.11 });
    ton({ hoehe: TONLEITER[s] * 2, dauer: 0.5, form: 'sine', laut: 0.07, verzug: i * 0.11 });
  });
}

/** Ein kleines Funkeln */
export function klangFunke() {
  const h = TONLEITER[4 + Math.floor(Math.random() * 4)] * 2;
  ton({ hoehe: h, dauer: 0.28, form: 'sine', laut: 0.12, gleiten: 300 });
}

/** Streicheln */
export function klangStreicheln() {
  ton({ hoehe: 300 + Math.random() * 180, dauer: 0.22, form: 'sine', laut: 0.09, gleiten: 120 });
}

/** Die Welt wacht auf */
export function klangErwachen() {
  ton({ hoehe: 65, dauer: 2.2, form: 'sine', laut: 0.3, gleiten: 60 });
  ton({ hoehe: 130, dauer: 1.8, form: 'triangle', laut: 0.12, verzug: 0.2, gleiten: 40 });
  [0, 2, 4, 7].forEach((s, i) => {
    ton({ hoehe: TONLEITER[s] * 2, dauer: 1.4, form: 'sine', laut: 0.08, verzug: 0.5 + i * 0.18 });
  });
}

/** Ein Tier kommt an */
export function klangTier() {
  [4, 5, 7].forEach((s, i) => {
    ton({ hoehe: TONLEITER[s] * 1.5, dauer: 0.3, form: 'triangle', laut: 0.13, verzug: i * 0.09 });
  });
}
