/* ==================================================================
   DIE ANZEIGE - Sprechblase, Hinweise, Tasche, Sterne.
   Das ist alles normales HTML, das ueber dem 3D-Bild liegt.
   ================================================================== */

import { klangSprechen } from './klang.js';

const teile = {
  titel: document.getElementById('titel'),
  titelHinweis: document.getElementById('titel-hinweis'),
  blase: document.getElementById('blase'),
  blaseText: document.getElementById('blase-text'),
  blaseWeiter: document.getElementById('blase-weiter'),
  hinweis: document.getElementById('hinweis'),
  tasche: document.getElementById('tasche'),
  sterne: document.getElementById('sterne'),
};

/* ---------- Titel ---------- */
export function versteckTitel() {
  teile.titel.classList.add('weg');
}
export function setzeTitelHinweis(text) {
  teile.titelHinweis.textContent = text;
}

/* ---------- Hinweiszeile unten ---------- */
let letzterHinweis = '';
export function zeigeHinweis(text) {
  if (text === letzterHinweis) return;
  letzterHinweis = text;
  if (!text) {
    teile.hinweis.hidden = true;
    return;
  }
  teile.hinweis.textContent = text;
  teile.hinweis.hidden = false;
  // Animation neu starten
  teile.hinweis.style.animation = 'none';
  void teile.hinweis.offsetWidth;
  teile.hinweis.style.animation = '';
}

/* ---------- Sprechblase ---------- */
let schreibUhr = null;
let aktuellerSatz = '';
let beimFertig = null;
let istFertig = true;

/**
 * Der Mond sagt einen Satz. Der Text erscheint Buchstabe fuer
 * Buchstabe - das macht es lebendiger (und der Mond blubbert dazu).
 */
export function sagText(satz, { beiFertig = null, beiBuchstabe = null } = {}) {
  clearInterval(schreibUhr);
  aktuellerSatz = satz;
  beimFertig = beiFertig;
  istFertig = false;
  const warVersteckt = teile.blase.hidden;
  letzteBlaseX = -999;                     // Breite neu messen lassen
  teile.blase.hidden = false;
  teile.blaseText.textContent = '';
  teile.blaseWeiter.classList.remove('da');
  teile.blase.classList.add('da');
  if (warVersteckt) {
    // nur beim ersten Satz kurz hereinpoppen
    teile.blase.classList.remove('reinpoppen');
    void teile.blase.offsetWidth;
    teile.blase.classList.add('reinpoppen');
  }

  let i = 0;
  schreibUhr = setInterval(() => {
    i++;
    teile.blaseText.textContent = satz.slice(0, i);
    const buchstabe = satz[i - 1];
    if (buchstabe && buchstabe !== ' ') klangSprechen();
    if (beiBuchstabe) beiBuchstabe(i / satz.length);
    if (i >= satz.length) {
      clearInterval(schreibUhr);
      istFertig = true;
      teile.blaseWeiter.classList.add('da');
      if (beimFertig) beimFertig();
    }
  }, 34);
}

/** Beim Antippen: erst Text sofort fertig zeigen, dann weiter. */
export function blaseAntippen() {
  if (!istFertig) {
    clearInterval(schreibUhr);
    teile.blaseText.textContent = aktuellerSatz;
    istFertig = true;
    teile.blaseWeiter.classList.add('da');
    if (beimFertig) beimFertig();
    return 'fertiggeschrieben';
  }
  return 'weiter';
}

export function blaseIstFertig() { return istFertig; }

export function versteckBlase() {
  clearInterval(schreibUhr);
  teile.blase.classList.remove('da', 'reinpoppen');
  teile.blase.hidden = true;
}

/** Die Blase soll dort sein, wo der Mond ist. */
let letzteBlaseX = -999;
let letzteBlaseY = -999;
let gemerkteBreite = 240;

export function setzeBlaseAn(x, y) {
  const b = teile.blase;
  if (b.hidden) return;
  // Die Breite nur ab und zu neu messen - das spart Arbeit,
  // weil diese Funktion bei jedem Bild aufgerufen wird.
  if (letzteBlaseX === -999) gemerkteBreite = b.offsetWidth || 240;
  const rand = 14;
  const links = Math.round(Math.min(Math.max(x, gemerkteBreite / 2 + rand),
                                    window.innerWidth - gemerkteBreite / 2 - rand));
  const oben = Math.round(Math.min(Math.max(y, 120), window.innerHeight - 90));
  if (links === letzteBlaseX && oben === letzteBlaseY) return;
  letzteBlaseX = links;
  letzteBlaseY = oben;
  b.style.left = links + 'px';
  b.style.top = oben + 'px';
}

export function blaseAngetippt(handler) {
  teile.blase.addEventListener('pointerdown', (e) => { e.stopPropagation(); handler(); });
}

/* ---------- Tasche (Werkzeuge) ---------- */
const werkzeuge = new Map();
let gewaehltesWerkzeug = null;
let beimWerkzeugWechsel = null;

export function fuegeWerkzeugHinzu(name, bildPfad, titel) {
  if (werkzeuge.has(name)) return;
  const knopf = document.createElement('div');
  knopf.className = 'werkzeug';
  knopf.title = titel || name;
  knopf.innerHTML = `<img src="${bildPfad}" alt="${titel || name}">`;
  knopf.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    waehleWerkzeug(gewaehltesWerkzeug === name ? null : name);
  });
  teile.tasche.appendChild(knopf);
  werkzeuge.set(name, knopf);
  waehleWerkzeug(name);
}

export function waehleWerkzeug(name) {
  gewaehltesWerkzeug = name;
  for (const [n, knopf] of werkzeuge) knopf.classList.toggle('gewaehlt', n === name);
  if (beimWerkzeugWechsel) beimWerkzeugWechsel(name);
}

export function werkzeugInDerHand() { return gewaehltesWerkzeug; }
export function beiWerkzeugWechsel(handler) { beimWerkzeugWechsel = handler; }
export function hatWerkzeug(name) { return werkzeuge.has(name); }

/* ---------- Sterne fuer geschaffte Aufgaben ---------- */
let sternZahl = 0;
export function gibStern() {
  sternZahl++;
  const s = document.createElement('span');
  s.textContent = '★';
  teile.sterne.appendChild(s);
  return sternZahl;
}
export function setzeSterne(anzahl) {
  teile.sterne.innerHTML = '';
  sternZahl = 0;
  for (let i = 0; i < anzahl; i++) gibStern();
}

/* ---------- kleine Funken am Finger ---------- */
export function funkeAmBildschirm(x, y, zeichen = '✨') {
  const f = document.createElement('div');
  f.className = 'funke';
  f.textContent = zeichen;
  f.style.left = x + 'px';
  f.style.top = y + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1100);
}
