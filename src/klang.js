/* ==================================================================
   TOENE - alle vom Computer selbst erzeugt, keine Dateien noetig.
   ================================================================== */

let hof = null;          // der "AudioContext"
let lautstaerke = null;  // Regler fuer alle Geraeusche
let musikRegler = null;  // eigener Regler fuer die Hintergrundmusik
let hallRaum = null;     // gemeinsamer Hall - macht alles weich und weit
export let tonAn = true;

function starte() {
  if (hof) return hof;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  hof = new AC();

  lautstaerke = hof.createGain();
  lautstaerke.gain.value = 0.5;
  lautstaerke.connect(hof.destination);

  musikRegler = hof.createGain();
  musikRegler.gain.value = 0;      // die Musik faedelt sich sanft ein
  musikRegler.connect(hof.destination);

  hallRaum = machHall(hof);
  return hof;
}

/* ------------------------------------------------------------------
   HALL

   Ein Hall macht Toene weit und weich - so als waere man in einer
   grossen Halle. Wir brauchen dafuer keine Datei: der Computer
   wuerfelt sich ein Rauschen zusammen, das langsam leiser wird.
   Genau das ist ein Hall.
   ------------------------------------------------------------------ */
function machHall(h) {
  const sekunden = 3.2;
  const laenge = Math.floor(h.sampleRate * sekunden);
  const puffer = h.createBuffer(2, laenge, h.sampleRate);
  for (let kanal = 0; kanal < 2; kanal++) {
    const daten = puffer.getChannelData(kanal);
    for (let i = 0; i < laenge; i++) {
      const abfall = Math.pow(1 - i / laenge, 2.6);
      daten[i] = (Math.random() * 2 - 1) * abfall * 0.55;
    }
  }
  const hall = h.createConvolver();
  hall.buffer = puffer;
  const rein = h.createGain();
  rein.gain.value = 0.85;
  rein.connect(hall);
  hall.connect(h.destination);
  return rein;
}

/** Schickt einen Ton zusaetzlich in den Hall. */
function inDenHall(knoten, menge = 0.35) {
  if (!hallRaum) return;
  const g = hof.createGain();
  g.gain.value = menge;
  knoten.connect(g);
  g.connect(hallRaum);
}

// Handys erlauben Toene erst nach der ersten Beruehrung
export function weckeTon() {
  const h = starte();
  if (h && h.state === 'suspended') h.resume();
}

export function schalteTon(an) {
  tonAn = an;
  if (lautstaerke) lautstaerke.gain.value = an ? 0.5 : 0;
  if (musikRegler) {
    // sanft aus- und einblenden, nicht abrupt abschneiden
    const jetzt = hof.currentTime;
    musikRegler.gain.cancelScheduledValues(jetzt);
    musikRegler.gain.setValueAtTime(musikRegler.gain.value, jetzt);
    musikRegler.gain.linearRampToValueAtTime(an ? MUSIK_LAUT : 0, jetzt + 1.2);
  }
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

/* ==================================================================
   SUESSE TOENE
   ================================================================== */

/** Eine kleine Glocke - weich, mit Nachklang. */
function glocke({ hoehe, dauer = 1.2, laut = 0.13, verzug = 0 }) {
  const h = starte();
  if (!h || !tonAn) return;
  const jetzt = h.currentTime + verzug;

  // Grundton plus zwei Obertoene: so klingt eine echte Glocke
  const teile = [
    { faktor: 1, laut: 1, form: 'sine' },
    { faktor: 2.01, laut: 0.4, form: 'sine' },
    { faktor: 3.02, laut: 0.16, form: 'sine' },
    { faktor: 5.4, laut: 0.06, form: 'sine' },
  ];
  const sammler = h.createGain();
  sammler.gain.value = laut;
  sammler.connect(lautstaerke);
  inDenHall(sammler, 0.5);

  for (const t of teile) {
    const o = h.createOscillator();
    const g = h.createGain();
    o.type = t.form;
    o.frequency.value = hoehe * t.faktor;
    g.gain.setValueAtTime(0, jetzt);
    g.gain.linearRampToValueAtTime(t.laut, jetzt + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, jetzt + dauer * (1 / t.faktor + 0.35));
    o.connect(g).connect(sammler);
    o.start(jetzt);
    o.stop(jetzt + dauer + 0.3);
  }
}

// Eine Tonleiter ohne "schiefe" Toene - da klingt jede Kombination gut.
// (Das ist eine Pentatonik: wie die schwarzen Tasten am Klavier.)
const PENTA = [293.66, 329.63, 392.0, 440.0, 493.88,
               587.33, 659.25, 783.99, 880.0, 987.77];

/** Auf den Planeten tippen: ein weicher Ton, je nach Stelle ein anderer. */
export function klangPlanetTippen(hoehenAnteil = 0.5) {
  const i = Math.max(0, Math.min(PENTA.length - 1,
    Math.round(hoehenAnteil * (PENTA.length - 1))));
  glocke({ hoehe: PENTA[i] * 0.5, dauer: 1.6, laut: 0.1 });
  // ein tiefer, kurzer "Plopp" dazu - wie wenn man auf einen Kuerbis klopft
  ton({ hoehe: PENTA[i] * 0.25, dauer: 0.22, form: 'sine', laut: 0.14, gleiten: -30 });
}

/** Etwas blueht auf: ein aufsteigender Glockenakkord. */
export function klangAufbluehen() {
  const stufen = [0, 2, 4, 7];
  stufen.forEach((stufe, i) => {
    glocke({ hoehe: PENTA[stufe + 2], dauer: 2.2, laut: 0.11, verzug: i * 0.13 });
  });
  // ein Schimmern obendrauf
  for (let i = 0; i < 4; i++) {
    glocke({ hoehe: PENTA[6 + (i % 4)] * 2, dauer: 1.4, laut: 0.045, verzug: 0.5 + i * 0.14 });
  }
  ton({ hoehe: 110, dauer: 1.8, form: 'sine', laut: 0.1, gleiten: 60 });
}

/** Ein Apfelbaum wacht auf - groesser und feierlicher. */
export function klangBaumWaechst() {
  [0, 3, 5, 7, 9].forEach((stufe, i) => {
    glocke({ hoehe: PENTA[stufe], dauer: 2.8, laut: 0.1, verzug: i * 0.16 });
  });
  ton({ hoehe: 73, dauer: 2.6, form: 'triangle', laut: 0.12, gleiten: 40 });
}

/* ==================================================================
   HINTERGRUNDMUSIK

   Die Musik wird nicht abgespielt, sondern in echtzeit gebaut:
   ein weicher Klangteppich aus langen Toenen, dazu ab und zu ein
   Glockenton. Weil der Computer die Toene selbst wuerfelt, klingt
   sie jedes Mal ein bisschen anders und wiederholt sich nie.
   ================================================================== */

const MUSIK_LAUT = 0.16;
let musikLaeuft = false;
let musikUhr = null;
let akkordNummer = 0;

// Eine ruhige Akkordfolge. Die Zahlen sind Frequenzen in Hertz.
// D-Dur-Gegend: klingt offen und freundlich, nie traurig.
const AKKORDE = [
  [73.42, 146.83, 220.0, 329.63],    // D  - zuhause
  [82.41, 164.81, 246.94, 392.0],    // E-moll-ish - neugierig
  [98.0, 196.0, 293.66, 440.0],      // G  - weit
  [110.0, 220.0, 329.63, 493.88],    // A  - schwebend
];

/** Ein langer, weicher Akkord (ein "Pad"). */
function padAkkord(frequenzen, start, dauer) {
  const h = hof;
  const sammler = h.createGain();
  sammler.gain.setValueAtTime(0, start);
  sammler.gain.linearRampToValueAtTime(0.5, start + dauer * 0.35);   // langsam auf
  sammler.gain.linearRampToValueAtTime(0.0001, start + dauer);       // langsam ab

  const filter = h.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700, start);
  filter.frequency.linearRampToValueAtTime(1500, start + dauer * 0.5);
  filter.frequency.linearRampToValueAtTime(600, start + dauer);
  filter.Q.value = 0.7;

  sammler.connect(filter);
  filter.connect(musikRegler);
  const hallWeg = h.createGain();
  hallWeg.gain.value = 0.5;
  filter.connect(hallWeg);
  if (hallRaum) hallWeg.connect(hallRaum);

  frequenzen.forEach((f, i) => {
    // zwei leicht verstimmte Oszillatoren pro Ton = warmer, breiter Klang
    for (const verstimmung of [-4, 4]) {
      const o = h.createOscillator();
      const g = h.createGain();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = verstimmung;
      g.gain.value = (i === 0 ? 0.5 : 0.22) / frequenzen.length;
      o.connect(g).connect(sammler);
      o.start(start);
      o.stop(start + dauer + 0.5);
    }
  });
}

/** Ab und zu ein einzelner Glockenton - wie ein Stern, der blinkt. */
function sternTon(start) {
  const h = hof;
  const hoehe = PENTA[3 + Math.floor(Math.random() * 6)] * (Math.random() > 0.7 ? 2 : 1);
  const o = h.createOscillator();
  const g = h.createGain();
  o.type = 'sine';
  o.frequency.value = hoehe;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(0.09, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 2.6);
  o.connect(g).connect(musikRegler);
  const hallWeg = h.createGain();
  hallWeg.gain.value = 0.7;
  g.connect(hallWeg);
  if (hallRaum) hallWeg.connect(hallRaum);
  o.start(start);
  o.stop(start + 3);
}

const AKKORD_DAUER = 9;      // Sekunden pro Akkord

function planeMusikStueck() {
  if (!musikLaeuft || !hof) return;
  const start = hof.currentTime + 0.1;
  const akkord = AKKORDE[akkordNummer % AKKORDE.length];
  akkordNummer++;
  padAkkord(akkord, start, AKKORD_DAUER);

  // zwei bis vier Sterntoene ueber den Akkord verteilt
  const anzahl = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < anzahl; i++) {
    sternTon(start + Math.random() * AKKORD_DAUER * 0.9);
  }

  // der naechste Akkord ueberlappt ein bisschen - dann gibt es
  // keine Luecke und es klingt wie ein durchgehender Teppich
  musikUhr = setTimeout(planeMusikStueck, (AKKORD_DAUER - 1.6) * 1000);
}

export function starteMusik() {
  const h = starte();
  if (!h || musikLaeuft) return;
  musikLaeuft = true;

  // ein tiefer Dauerton als Fundament
  const drone = h.createOscillator();
  const droneGain = h.createGain();
  drone.type = 'sine';
  drone.frequency.value = 36.71;        // sehr tiefes D
  droneGain.gain.value = 0.28;
  drone.connect(droneGain).connect(musikRegler);
  drone.start();

  // ganz langsames Schwellen, damit es "atmet"
  const atem = h.createOscillator();
  const atemTiefe = h.createGain();
  atem.frequency.value = 0.06;          // alle ~16 Sekunden
  atemTiefe.gain.value = 0.12;
  atem.connect(atemTiefe).connect(droneGain.gain);
  atem.start();

  planeMusikStueck();

  // sanft einfaeden
  const jetzt = h.currentTime;
  musikRegler.gain.setValueAtTime(0, jetzt);
  musikRegler.gain.linearRampToValueAtTime(tonAn ? MUSIK_LAUT : 0, jetzt + 4);
}

export function stoppeMusik() {
  musikLaeuft = false;
  clearTimeout(musikUhr);
  if (musikRegler && hof) {
    const jetzt = hof.currentTime;
    musikRegler.gain.linearRampToValueAtTime(0, jetzt + 1.5);
  }
}
