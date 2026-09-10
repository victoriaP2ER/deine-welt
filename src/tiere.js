/* ==================================================================
   TIERE - die ziehen ein, wenn es der Welt besser geht.

   Auch sie sind aus Schnipseln geklebt. Wichtig: die Fluegel und
   Ohren werden NICHT festgebacken, damit sie sich bewegen koennen.
   ================================================================== */

import * as THREE from 'three';
import { macheSchnipsel, machWuerfel, tone } from './schnipsel.js';

/* ==================================================================
   SCHMETTERLING - schlaegt mit den Fluegeln
   ================================================================== */
export function baueSchmetterling({ groesse = 1, farbe = '#ff9d3c', startzahl = 1 } = {}) {
  const w = machWuerfel(startzahl * 2654435761 + 29);
  const falter = new THREE.Group();

  /* --- Koerper --- */
  const koerper = macheSchnipsel({
    bild: 'streifen', farbe: '#4b3358', hoehe: 0.13 * groesse, woelbung: 0.02,
  });
  koerper.scale.x = 0.28;
  falter.add(koerper);
  const kopf = macheSchnipsel({ bild: 'klecks', farbe: '#4b3358', hoehe: 0.045 * groesse, woelbung: 0.02 });
  kopf.position.y = 0.07 * groesse;
  falter.add(kopf);

  /* --- Fuehler --- */
  for (const seite of [-1, 1]) {
    const f = macheSchnipsel({ bild: 'braue', farbe: '#4b3358', hoehe: 0.02 * groesse, woelbung: 0 });
    f.position.set(seite * 0.02 * groesse, 0.1 * groesse, 0);
    f.scale.x = seite * 1.6;
    f.rotation.z = seite * -0.9;
    falter.add(f);
  }

  /* --- Fluegel: bleiben beweglich! --- */
  const fluegel = [];
  for (const seite of [-1, 1]) {
    const paar = new THREE.Group();          // dreht sich beim Schlagen
    paar.position.set(seite * 0.012 * groesse, 0.02 * groesse, 0);
    const oben = macheSchnipsel({
      bild: 'fluegel-oben', farbe: tone(farbe, 0.04), hoehe: 0.19 * groesse, woelbung: 0.05 * groesse,
    });
    oben.position.set(seite * 0.09 * groesse, 0.035 * groesse, 0);
    oben.scale.x = seite;
    oben.userData.beweglich = true;
    paar.add(oben);

    const unten = macheSchnipsel({
      bild: 'fluegel-unten', farbe: tone(farbe, -0.1), hoehe: 0.13 * groesse, woelbung: 0.04 * groesse,
    });
    unten.position.set(seite * 0.075 * groesse, -0.06 * groesse, -0.004);
    unten.scale.x = seite;
    unten.userData.beweglich = true;
    paar.add(unten);

    paar.userData.seite = seite;
    falter.add(paar);
    fluegel.push(paar);
  }

  const z = { flatterPhase: w(0, 6.28) };
  falter.userData.typ = 'schmetterling';
  falter.userData.belebe = (zeit) => {
    // Fluegelschlag: schnell, aber nicht gleichmaessig - wie bei echten Faltern
    const schlag = Math.sin(zeit * 13 + z.flatterPhase) * 0.5 + 0.5;
    const winkel = 0.15 + schlag * 1.15;
    fluegel.forEach((paar) => { paar.rotation.y = paar.userData.seite * winkel; });
    // der Koerper wippt beim Schlagen leicht mit
    falter.children[0].rotation.z = Math.sin(zeit * 13 + z.flatterPhase) * 0.05;
  };
  return falter;
}

/* ==================================================================
   HAESCHEN - hopst herum, Ohren wackeln
   ================================================================== */
export function baueHaeschen({ groesse = 1, startzahl = 1 } = {}) {
  const w = machWuerfel(startzahl * 40503 + 31);
  const hase = new THREE.Group();
  const koerperFarbe = '#fdf6ea';

  /* --- Koerper (mehrere Kleckse = rund) --- */
  const rumpf = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const k = macheSchnipsel({
      bild: 'klecks', farbe: tone(koerperFarbe, i === 0 ? 0.02 : -0.03 * i), hoehe: 0.2 * groesse, woelbung: 0.07 * groesse,
    });
    const winkel = (i / 4) * Math.PI * 2;
    k.position.set(Math.cos(winkel) * 0.025 * groesse, 0.1 * groesse, Math.sin(winkel) * 0.025 * groesse);
    k.rotation.y = winkel;
    rumpf.add(k);
  }
  hase.add(rumpf);

  /* --- Kopf --- */
  const kopf = new THREE.Group();
  kopf.position.set(0, 0.21 * groesse, 0.045 * groesse);
  for (let i = 0; i < 3; i++) {
    const k = macheSchnipsel({
      bild: 'klecks', farbe: tone(koerperFarbe, 0.02 - i * 0.02), hoehe: 0.145 * groesse, woelbung: 0.05 * groesse,
    });
    const winkel = (i / 3) * Math.PI * 2;
    k.position.set(Math.cos(winkel) * 0.018 * groesse, 0, Math.sin(winkel) * 0.018 * groesse);
    k.rotation.y = winkel;
    kopf.add(k);
  }
  /* --- Gesicht --- */
  for (const seite of [-1, 1]) {
    const auge = macheSchnipsel({ bild: 'pupille', farbe: '#3e2f26', hoehe: 0.032 * groesse, woelbung: 0.01 });
    auge.position.set(seite * 0.038 * groesse, 0.012 * groesse, 0.072 * groesse);
    kopf.add(auge);
    const wange = macheSchnipsel({
      bild: 'wange', farbe: '#ffa896', hoehe: 0.05 * groesse, woelbung: 0.01, durchsichtig: true,
    });
    wange.material.opacity = 0.55;
    wange.position.set(seite * 0.055 * groesse, -0.022 * groesse, 0.066 * groesse);
    kopf.add(wange);
  }
  const nase = macheSchnipsel({ bild: 'klecks', farbe: '#f4899f', hoehe: 0.026 * groesse, woelbung: 0.01 });
  nase.position.set(0, -0.015 * groesse, 0.078 * groesse);
  kopf.add(nase);

  /* --- Ohren: bleiben beweglich --- */
  const ohren = [];
  for (const seite of [-1, 1]) {
    const ohr = macheSchnipsel({ bild: 'ohr', farbe: tone(koerperFarbe, 0.02), hoehe: 0.16 * groesse, woelbung: 0.05 * groesse });
    ohr.position.set(seite * 0.04 * groesse, 0.11 * groesse, -0.005);
    ohr.rotation.z = seite * 0.18;
    ohr.userData.beweglich = true;
    ohr.userData.ruheDrehung = ohr.rotation.z;
    ohr.userData.phase = w(0, 6.28);
    kopf.add(ohr);
    ohren.push(ohr);
    // Innenohr
    const innen = macheSchnipsel({ bild: 'ohr', farbe: '#f7b3c0', hoehe: 0.1 * groesse, woelbung: 0.03 });
    innen.position.set(0, -0.005 * groesse, 0.006);
    innen.userData.beweglich = true;
    ohr.add(innen);
  }
  hase.add(kopf);

  /* --- Schwaenzchen --- */
  const schwanz = macheSchnipsel({ bild: 'klecks', farbe: '#ffffff', hoehe: 0.07 * groesse, woelbung: 0.03 });
  schwanz.position.set(0, 0.1 * groesse, -0.1 * groesse);
  hase.add(schwanz);

  const z = { hopsPhase: w(0, 6.28), hopstJetzt: false, ruhe: w(1.5, 4) };
  hase.userData.typ = 'haeschen';
  hase.userData.antippbar = true;
  hase.userData.hoehe = 0.35 * groesse;
  hase.userData.belebe = (zeit, schritt) => {
    // ab und zu ein Huepfer
    z.ruhe -= schritt;
    if (z.ruhe <= 0) { z.hopstJetzt = true; z.hopsPhase = 0; z.ruhe = 2.5 + Math.random() * 4; }
    if (z.hopstJetzt) {
      z.hopsPhase += schritt * 4.2;
      if (z.hopsPhase >= Math.PI) { z.hopstJetzt = false; z.hopsPhase = 0; }
      const h = Math.sin(z.hopsPhase);
      hase.position.y = h * 0.12 * groesse;
      rumpf.scale.set(1 - h * 0.1, 1 + h * 0.16, 1 - h * 0.1);
      kopf.rotation.x = -h * 0.25;
    } else {
      // atmen
      const a = Math.sin(zeit * 2.4) * 0.02;
      rumpf.scale.set(1 + a, 1 - a, 1 + a);
      hase.position.y = 0;
      kopf.rotation.x = Math.sin(zeit * 1.1) * 0.05;
    }
    // Ohren wackeln
    ohren.forEach((ohr, i) => {
      ohr.rotation.z = ohr.userData.ruheDrehung + Math.sin(zeit * 2.6 + ohr.userData.phase) * 0.14;
      ohr.rotation.x = Math.sin(zeit * 1.9 + i) * 0.1;
    });
  };
  return hase;
}

/* ==================================================================
   REGENWOLKE

   Aus Papierklecksen in drei Lagen geschichtet: hinten dunkler und
   groesser, vorne heller - so wirkt sie bauschig.

   Wichtig ist die Richtung: die Wolke schwebt UEBER einer Stelle des
   Planeten, und ihre Tropfen fallen nach unten in Richtung
   Planetenmitte. (Im Weltall gibt es kein "unten" - unten ist
   immer da, wo der Planet ist.)
   ================================================================== */
export function baueWolke({ groesse = 1, startzahl = 1 } = {}) {
  const w = machWuerfel(startzahl * 999983 + 3);
  const wolke = new THREE.Group();

  /* ---------- der bauschige Koerper ---------- */
  const ballen = new THREE.Group();
  const lagen = [
    // [x, y, z, groesse, helligkeit]
    [-0.22, -0.02, -0.07, 0.30, -0.14],
    [ 0.24, -0.03, -0.06, 0.27, -0.12],
    [ 0.02,  0.06, -0.09, 0.34, -0.10],
    [-0.12, -0.05,  0.02, 0.28, -0.02],
    [ 0.14, -0.04,  0.03, 0.26, -0.01],
    [ 0.00,  0.08,  0.05, 0.30,  0.05],
    [-0.05, -0.01,  0.12, 0.24,  0.08],
  ];
  lagen.forEach(([x, y, z, gr, hell], i) => {
    const k = macheSchnipsel({
      bild: 'klecks',
      farbe: tone('#fbfaf6', hell),
      hoehe: gr * groesse * w(0.92, 1.08),
      woelbung: 0.1 * groesse,
    });
    k.position.set(x * groesse, y * groesse, z * groesse);
    k.rotation.set(w(-0.2, 0.2), w(-0.5, 0.5), w(-0.2, 0.2));
    ballen.add(k);
  });
  // die Unterseite ist leicht grau - dann sieht man, dass es
  // eine Regenwolke ist und keine Schaefchenwolke
  for (let i = 0; i < 3; i++) {
    const unten = macheSchnipsel({
      bild: 'klecks',
      farbe: '#b9c4d4',
      hoehe: 0.2 * groesse,
      woelbung: 0.06 * groesse,
    });
    unten.position.set((i - 1) * 0.16 * groesse, -0.1 * groesse, 0.02 * groesse);
    unten.rotation.x = 0.5;
    ballen.add(unten);
  }
  wolke.add(ballen);

  /* ---------- ein kleines Gesicht ---------- */
  const gesicht = new THREE.Group();
  gesicht.position.set(0, 0.01 * groesse, 0.16 * groesse);
  for (const seite of [-1, 1]) {
    const auge = macheSchnipsel({ bild: 'pupille', farbe: '#71829a', hoehe: 0.045 * groesse, woelbung: 0.01 });
    auge.position.set(seite * 0.07 * groesse, 0.02 * groesse, 0);
    gesicht.add(auge);
  }
  const mund = macheSchnipsel({ bild: 'mund-laecheln', farbe: '#71829a', hoehe: 0.05 * groesse, woelbung: 0.01 });
  mund.position.set(0, -0.05 * groesse, 0);
  gesicht.add(mund);
  wolke.add(gesicht);

  /* ---------- die Tropfen ----------
     Sie fallen in Richtung des lokalen "unten" - und weil die Wolke
     mit dem Bauch zum Planeten aufgestellt wird, zeigt das genau
     zur Planetenoberflaeche.                                        */
  const TROPFEN_ANZAHL = 14;
  const FALLWEG = 1.15 * groesse;      // wird beim Aufstellen angepasst
  const tropfen = [];
  for (let i = 0; i < TROPFEN_ANZAHL; i++) {
    const t = macheSchnipsel({
      bild: 'tropfen',
      farbe: '#7cc9f0',
      hoehe: 0.075 * groesse,
      woelbung: 0.015,
    });
    t.userData.beweglich = true;
    t.userData.start = i / TROPFEN_ANZAHL + w(-0.03, 0.03);
    t.userData.seite = new THREE.Vector3(w(-0.22, 0.22), 0, w(-0.22, 0.22)).multiplyScalar(groesse);
    t.visible = false;
    wolke.add(t);
    tropfen.push(t);
  }

  /* ---------- Spritzer, wenn ein Tropfen ankommt ---------- */
  const spritzer = [];
  for (let i = 0; i < 6; i++) {
    const sp = macheSchnipsel({
      bild: 'funke', farbe: '#bfe8fb', hoehe: 0.07 * groesse,
      woelbung: 0, leuchten: 0.8, durchsichtig: true,
    });
    sp.userData.beweglich = true;
    sp.visible = false;
    wolke.add(sp);
    spritzer.push(sp);
  }

  const z = {
    regnet: false,
    fallweg: FALLWEG,
    kraft: 0,          // 0 = kein Regen, 1 = Platzregen
  };

  wolke.regne = (an) => { z.regnet = an; };
  wolke.setzeFallweg = (weg) => { z.fallweg = weg; };

  wolke.userData.typ = 'wolke';
  wolke.userData.hoehe = 0.4 * groesse;
  wolke.userData.belebe = (zeit, schritt) => {
    // sanftes Wabern
    ballen.rotation.z = Math.sin(zeit * 0.5 + startzahl) * 0.05;
    ballen.position.y = Math.sin(zeit * 0.8 + startzahl) * 0.015 * groesse;

    // Regen ein- und ausfaden
    const ziel = z.regnet ? 1 : 0;
    z.kraft += (ziel - z.kraft) * Math.min(1, schritt * 1.6);

    tropfen.forEach((t, i) => {
      if (z.kraft < 0.02) { t.visible = false; return; }
      // jeder Tropfen faellt in seinem eigenen Rhythmus
      const f = ((zeit * 0.85 + t.userData.start) % 1);
      if (f > z.kraft * 1.1) { t.visible = false; return; }
      t.visible = true;
      t.position.copy(t.userData.seite);
      t.position.y = -0.12 * groesse - f * z.fallweg;
      // beim Fallen wird er schmaler, wie ein echter Tropfen
      t.scale.set(0.85 + f * 0.2, 1 + f * 0.5, 1);
      t.rotation.y = zeit * 2 + i;
    });

    // Spritzer am Boden
    spritzer.forEach((sp, i) => {
      if (z.kraft < 0.3) { sp.visible = false; return; }
      const f = ((zeit * 1.3 + i / spritzer.length) % 1);
      if (f > 0.35) { sp.visible = false; return; }
      sp.visible = true;
      const seite = tropfen[i % tropfen.length].userData.seite;
      sp.position.set(seite.x, -0.12 * groesse - z.fallweg, seite.z);
      const s = f * 3;
      sp.scale.setScalar(0.4 + s);
      sp.material.opacity = Math.max(0, 0.7 - s * 0.6);
      sp.rotation.x = -Math.PI / 2;
    });
  };
  return wolke;
}
