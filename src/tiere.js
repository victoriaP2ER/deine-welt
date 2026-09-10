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
   WOLKE - kann regnen lassen
   ================================================================== */
export function baueWolke({ groesse = 1, startzahl = 1 } = {}) {
  const w = machWuerfel(startzahl * 999983 + 3);
  const wolke = new THREE.Group();
  const ballen = new THREE.Group();
  const orte = [[-0.16, 0, 0], [0.16, 0.01, 0], [0, 0.07, 0.02], [-0.07, -0.03, -0.05], [0.08, -0.02, 0.06]];
  orte.forEach(([x, y, zz], i) => {
    const k = macheSchnipsel({
      bild: 'klecks', farbe: tone('#fdfcf8', -0.02 * i), hoehe: (0.17 + w(0, 0.07)) * groesse, woelbung: 0.06 * groesse,
    });
    k.position.set(x * groesse, y * groesse, zz * groesse);
    k.rotation.y = w(-0.5, 0.5);
    ballen.add(k);
  });
  wolke.add(ballen);

  /* --- Gesicht (klein und freundlich) --- */
  for (const seite of [-1, 1]) {
    const auge = macheSchnipsel({ bild: 'pupille', farbe: '#7b8fa8', hoehe: 0.03 * groesse, woelbung: 0.01 });
    auge.position.set(seite * 0.05 * groesse, 0.01 * groesse, 0.1 * groesse);
    wolke.add(auge);
  }
  const mund = macheSchnipsel({ bild: 'mund-laecheln', farbe: '#7b8fa8', hoehe: 0.035 * groesse, woelbung: 0.01 });
  mund.position.set(0, -0.04 * groesse, 0.1 * groesse);
  wolke.add(mund);

  /* --- Regentropfen --- */
  const tropfen = [];
  for (let i = 0; i < 8; i++) {
    const t = macheSchnipsel({ bild: 'tropfen', farbe: '#7ec8f0', hoehe: 0.05 * groesse, woelbung: 0.01 });
    t.userData.beweglich = true;
    t.userData.start = w(0, 1);
    t.position.set(w(-0.16, 0.16) * groesse, -0.1, w(-0.06, 0.06) * groesse);
    t.visible = false;
    wolke.add(t);
    tropfen.push(t);
  }

  let regnet = false;
  wolke.regne = (an) => { regnet = an; tropfen.forEach((t) => { t.visible = an; }); };

  wolke.userData.typ = 'wolke';
  wolke.userData.belebe = (zeit) => {
    ballen.rotation.z = Math.sin(zeit * 0.6) * 0.04;
    ballen.position.y = Math.sin(zeit * 0.9) * 0.012;
    if (regnet) {
      tropfen.forEach((t) => {
        const f = ((zeit * 0.55 + t.userData.start) % 1);
        t.position.y = -0.12 - f * 0.85;
        t.scale.setScalar(1 - f * 0.35);
      });
    }
  };
  return wolke;
}
