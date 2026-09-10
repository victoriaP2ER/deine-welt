/* ==================================================================
   PFLANZEN - aus Schnipseln zusammengeklebte 3D-Modelle.

   Jedes Modell ist eine kleine Bastelarbeit:
   Ein Baum besteht aus 3 Stammstreifen, ein paar Aesten und
   ungefaehr 25 einzelnen Blaettern, die alle im Raum stehen.
   Darum sieht er von jeder Seite anders aus - wie echtes Pappmache.
   ================================================================== */

import * as THREE from 'three';
import { macheSchnipsel, machWuerfel, backeZusammen, tone } from './schnipsel.js';

/* ---------- Farbtoepfe ---------- */
export const FARBEN = {
  grasTrocken: ['#f0dc94', '#e6cd7c', '#f7e8ae', '#d9bb64', '#efe0a2'],
  grasGesund:  ['#8fd34e', '#a3e05f', '#bcea78', '#78c23e', '#aae267'],
  laubGruen:   ['#519f3d', '#62b045', '#76c351', '#428c34', '#8fce5f', '#a8db72'],
  laubHerbst:  ['#e0663a', '#e79440', '#d4442e', '#efb254', '#c9552f'],
  stamm:       ['#a2703f', '#8b5b31', '#bb8a55'],
  blueten: {
    rosa:   ['#f492b4', '#f7abc3', '#e97ba3'],
    gelb:   ['#ffd75e', '#ffe488', '#f7c53f'],
    blau:   ['#8fbdf0', '#a9cdf5', '#6fa5e6'],
    lila:   ['#c795e0', '#d6aae9', '#b47ad3'],
    weiss:  ['#fdf6ea', '#ffffff', '#f0e6d4'],
  },
  erde: ['#9c7b4e', '#8a6a41', '#b0906a'],
};

const wahl = (liste, w) => liste[Math.floor(w(0, liste.length)) % liste.length];

/* ---------- Punkte gleichmaessig auf einer Kugel verteilen ---------- */
function kugelPunkte(anzahl, w) {
  const punkte = [];
  const gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < anzahl; i++) {
    const y = 1 - (i / (anzahl - 1 || 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const winkel = gold * i + w(-0.3, 0.3);
    punkte.push(new THREE.Vector3(Math.cos(winkel) * r, y, Math.sin(winkel) * r));
  }
  return punkte;
}

/* ---------- Ein Schnipsel so hinstellen, dass es nach aussen zeigt ---------- */
function richteNachAussen(netz, richtung, drehung) {
  netz.lookAt(netz.position.clone().add(richtung));
  netz.rotateZ(drehung);
}

/* ==================================================================
   BAUM
   ================================================================== */
export function baueBaum({ groesse = 1, palette = 'laubGruen', startzahl = 1, blaetter = 26 } = {}) {
  const w = machWuerfel(startzahl * 7919 + 13);
  const baum = new THREE.Group();
  const laubFarben = FARBEN[palette] || FARBEN.laubGruen;

  /* --- Stamm: mehrere Streifen im Kreis = wirkt raeumlich, wie gefaltet --- */
  const stamm = new THREE.Group();
  const stammHoehe = 0.62 * groesse;
  for (let i = 0; i < 3; i++) {
    const heller = i === 0 ? 0.09 : i === 1 ? 0 : -0.1;   // eine Seite im Licht, eine im Schatten
    const s = macheSchnipsel({
      bild: 'streifen',
      farbe: tone(FARBEN.stamm[i % 3], heller),
      hoehe: stammHoehe,
      woelbung: 0.06 * groesse,
    });
    s.position.y = stammHoehe / 2;
    s.rotation.y = (i / 3) * Math.PI * 2 + w(-0.15, 0.15);
    s.scale.x = w(0.8, 1.05);
    stamm.add(s);
  }
  /* --- Aeste --- */
  for (let i = 0; i < 3; i++) {
    const ast = macheSchnipsel({
      bild: 'streifen',
      farbe: tone(FARBEN.stamm[1], w(-0.06, 0.06)),
      hoehe: 0.3 * groesse,
      woelbung: 0.04,
    });
    const winkel = w(0, Math.PI * 2);
    ast.position.set(Math.cos(winkel) * 0.1 * groesse, stammHoehe * w(0.7, 0.95), Math.sin(winkel) * 0.1 * groesse);
    ast.rotation.set(w(-0.5, 0.5), winkel, w(0.5, 1.1) * (w(0, 1) > 0.5 ? 1 : -1));
    ast.scale.x = 0.45;
    stamm.add(ast);
  }
  baum.add(stamm);

  /* --- Krone: viele einzelne Blaetter auf einer Kugel --- */
  const krone = new THREE.Group();
  krone.position.y = stammHoehe + 0.34 * groesse;
  const kronenRadius = 0.4 * groesse;
  const punkte = kugelPunkte(blaetter, w);
  punkte.forEach((p, i) => {
    // oben dichter als unten
    const hoehenDehnung = 0.78;
    const ort = p.clone().multiply(new THREE.Vector3(1, hoehenDehnung, 1))
      .multiplyScalar(kronenRadius * w(0.82, 1.12));
    const blattBild = ['blatt-1', 'blatt-2', 'blatt-1', 'blatt-3'][i % 4];
    const blatt = macheSchnipsel({
      bild: blattBild,
      farbe: tone(wahl(laubFarben, w), (p.y + 0.4) * 0.06),  // oben heller, unten dunkler
      hoehe: (0.3 + 0.16 * w(0, 1)) * groesse,
      woelbung: 0.09 * groesse,
    });
    blatt.position.copy(ort);
    richteNachAussen(blatt, p, w(0, Math.PI * 2));
    blatt.rotateX(w(-0.45, 0.45));
    krone.add(blatt);
  });
  baum.add(krone);
  backeZusammen(krone);
  backeZusammen(stamm);

  /* --- ein paar lose Blaetter, die im Wind zappeln --- */
  const zappelBlaetter = [];
  for (let i = 0; i < 4; i++) {
    const p = punkte[Math.floor(w(0, punkte.length))];
    const blatt = macheSchnipsel({
      bild: 'blatt-1',
      farbe: tone(wahl(laubFarben, w), 0.1),
      hoehe: 0.34 * groesse,
      woelbung: 0.1 * groesse,
    });
    blatt.position.copy(p.clone().multiplyScalar(kronenRadius * 1.12));
    richteNachAussen(blatt, p, w(0, Math.PI * 2));
    blatt.userData.beweglich = true;
    blatt.userData.phase = w(0, Math.PI * 2);
    blatt.userData.ruhe = blatt.rotation.clone();
    krone.add(blatt);
    zappelBlaetter.push(blatt);
  }

  baum.userData.typ = 'baum';
  baum.userData.hoehe = stammHoehe + 0.8 * groesse;
  baum.userData.belebe = (zeit) => {
    krone.rotation.z = Math.sin(zeit * 0.9 + startzahl) * 0.035;
    krone.rotation.x = Math.cos(zeit * 0.7 + startzahl) * 0.025;
    for (const b of zappelBlaetter) {
      b.rotation.z = b.userData.ruhe.z + Math.sin(zeit * 3.1 + b.userData.phase) * 0.22;
    }
  };
  return baum;
}

/* ==================================================================
   GRASBUESCHEL  (trocken oder gesund)
   ================================================================== */
export function baueGras({ groesse = 1, trocken = false, startzahl = 1, faecher = 3 } = {}) {
  const w = machWuerfel(startzahl * 104729 + 7);
  const buschel = new THREE.Group();
  const farben = trocken ? FARBEN.grasTrocken : FARBEN.grasGesund;
  const halmGruppe = new THREE.Group();

  /* Ein Grasbueschel ist wie ein Papierfaecher:
     drei flache Faecher, die kreuzweise ineinander stecken.
     Von jeder Seite sieht man immer einen gut. */
  for (let f = 0; f < faecher; f++) {
    const ebene = new THREE.Group();
    ebene.rotation.y = (f / faecher) * Math.PI + w(-0.12, 0.12);

    const halmeProFaecher = 4;
    for (let i = 0; i < halmeProFaecher; i++) {
      const mitte = i - (halmeProFaecher - 1) / 2;     // faechert nach links und rechts
      const hoehe = (trocken ? 0.17 : 0.3) * groesse * w(0.85, 1.15)
                    * (1 - Math.abs(mitte) * 0.22);     // aussen kuerzer
      const halm = macheSchnipsel({
        bild: Math.abs(mitte) < 0.6 ? 'halm-breit' : 'halm',
        farbe: tone(wahl(farben, w), w(-0.04, 0.08) + (f === 0 ? 0.05 : -0.03 * f)),
        hoehe,
        woelbung: 0.045 * groesse,
      });
      halm.scale.x = 1.1;                               // etwas breiter = sieht nach Papier aus
      halm.position.set(mitte * 0.06 * groesse, hoehe * 0.44, w(-0.014, 0.014) * groesse);
      // faechert in der Ebene auf; trockene Halme haengen weiter nach aussen
      halm.rotation.z = mitte * (trocken ? w(0.34, 0.5) : w(0.24, 0.4));
      halm.rotation.x = trocken ? w(0.04, 0.16) : w(-0.05, 0.05);
      ebene.add(halm);
    }
    halmGruppe.add(ebene);
  }
  buschel.add(halmGruppe);
  backeZusammen(halmGruppe);

  buschel.userData.typ = trocken ? 'gras-trocken' : 'gras-gesund';
  buschel.userData.antippbar = trocken;
  buschel.userData.hoehe = 0.3 * groesse;
  buschel.userData.belebe = (zeit) => {
    const wiegen = trocken ? 0.025 : 0.07;
    halmGruppe.rotation.z = Math.sin(zeit * 1.7 + startzahl) * wiegen;
    halmGruppe.rotation.x = Math.cos(zeit * 1.3 + startzahl * 2) * wiegen * 0.7;
  };
  return buschel;
}

/* ==================================================================
   BLUME - Bluetenblaetter stehen echt im Kreis, nicht flach
   ================================================================== */
export function baueBlume({ groesse = 1, sorte = 'rosa', startzahl = 1 } = {}) {
  const w = machWuerfel(startzahl * 15485863 + 3);
  const blume = new THREE.Group();
  const blattFarben = FARBEN.blueten[sorte] || FARBEN.blueten.rosa;

  /* --- Stiel --- */
  const stielHoehe = 0.3 * groesse;
  const stiel = macheSchnipsel({
    bild: 'halm',
    farbe: tone('#5fa83c', w(-0.04, 0.04)),
    hoehe: stielHoehe,
    woelbung: 0.03,
  });
  stiel.position.y = stielHoehe * 0.5;
  stiel.scale.x = 0.55;
  blume.add(stiel);

  /* --- zwei Blaetter am Stiel --- */
  for (let i = 0; i < 2; i++) {
    const b = macheSchnipsel({
      bild: 'blatt-klein',
      farbe: tone('#6bb544', i ? 0.06 : -0.04),
      hoehe: 0.13 * groesse,
      woelbung: 0.05,
    });
    const winkel = i * Math.PI + w(-0.5, 0.5);
    b.position.set(Math.cos(winkel) * 0.05 * groesse, stielHoehe * (0.3 + i * 0.22), Math.sin(winkel) * 0.05 * groesse);
    b.rotation.set(0.9, winkel, 0.5);
    blume.add(b);
  }

  /* --- Bluete --- */
  const bluete = new THREE.Group();
  bluete.position.y = stielHoehe;
  const anzahl = 5 + Math.floor(w(0, 2));
  for (let i = 0; i < anzahl; i++) {
    const blatt = macheSchnipsel({
      bild: 'blueten-blatt',
      farbe: tone(wahl(blattFarben, w), w(-0.03, 0.06)),
      hoehe: 0.19 * groesse,
      woelbung: 0.06 * groesse,
    });
    const winkel = (i / anzahl) * Math.PI * 2;
    blatt.position.set(Math.cos(winkel) * 0.082 * groesse, 0.025 * groesse, Math.sin(winkel) * 0.082 * groesse);
    blatt.rotation.set(-1.15 + w(-0.12, 0.12), -winkel + Math.PI / 2, 0);
    bluete.add(blatt);
  }
  // Mitte
  const mitte = macheSchnipsel({
    bild: 'klecks',
    farbe: sorte === 'gelb' ? '#f2a03c' : '#ffd75e',
    hoehe: 0.095 * groesse,
    woelbung: 0.035,
  });
  mitte.rotation.x = -Math.PI / 2;
  mitte.position.y = 0.035 * groesse;
  bluete.add(mitte);
  blume.add(bluete);
  backeZusammen(bluete);

  blume.userData.typ = 'blume';
  blume.userData.hoehe = stielHoehe + 0.1 * groesse;
  blume.userData.belebe = (zeit) => {
    const s = Math.sin(zeit * 1.5 + startzahl) * 0.1;
    bluete.rotation.z = s;
    bluete.rotation.x = Math.cos(zeit * 1.1 + startzahl) * 0.08;
    bluete.rotation.y = zeit * 0.15;
    stiel.rotation.z = s * 0.5;
  };
  return blume;
}

/* ==================================================================
   BUSCH
   ================================================================== */
export function baueBusch({ groesse = 1, startzahl = 1, beeren = true } = {}) {
  const w = machWuerfel(startzahl * 32452843 + 11);
  const busch = new THREE.Group();
  const teile = new THREE.Group();
  const punkte = kugelPunkte(14, w);
  punkte.forEach((p, i) => {
    const blatt = macheSchnipsel({
      bild: i % 3 === 0 ? 'blatt-2' : 'blatt-1',
      farbe: tone(wahl(FARBEN.laubGruen, w), (p.y + 0.3) * 0.05),
      hoehe: 0.33 * groesse * w(0.85, 1.15),
      woelbung: 0.07,
    });
    blatt.position.copy(p.clone().multiply(new THREE.Vector3(1, 0.6, 1)).multiplyScalar(0.25 * groesse));
    blatt.position.y += 0.12 * groesse;
    richteNachAussen(blatt, p, w(0, Math.PI * 2));
    teile.add(blatt);
  });
  if (beeren) {
    for (let i = 0; i < 4; i++) {
      const beere = macheSchnipsel({
        bild: 'klecks',
        farbe: wahl(['#c76bd4', '#b054c9', '#d97fe0'], w),
        hoehe: 0.055 * groesse,
        woelbung: 0.02,
      });
      const p = punkte[Math.floor(w(0, punkte.length))];
      beere.position.copy(p.clone().multiplyScalar(0.21 * groesse));
      beere.position.y += 0.14 * groesse;
      richteNachAussen(beere, p, 0);
      teile.add(beere);
    }
  }
  busch.add(teile);
  backeZusammen(teile);
  busch.userData.typ = 'busch';
  busch.userData.hoehe = 0.3 * groesse;
  busch.userData.belebe = (zeit) => {
    teile.rotation.z = Math.sin(zeit * 1.4 + startzahl) * 0.045;
  };
  return busch;
}

/* ==================================================================
   PILZ
   ================================================================== */
export function bauePilz({ groesse = 1, startzahl = 1 } = {}) {
  const w = machWuerfel(startzahl * 49979687 + 5);
  const pilz = new THREE.Group();
  const stielHoehe = 0.17 * groesse;
  const stiel = macheSchnipsel({ bild: 'streifen', farbe: '#fdf3e0', hoehe: stielHoehe, woelbung: 0.03 });
  stiel.position.y = stielHoehe / 2;
  stiel.scale.x = 0.5;
  pilz.add(stiel);
  const stiel2 = stiel.clone();
  stiel2.rotation.y = Math.PI / 2;
  pilz.add(stiel2);

  const hut = new THREE.Group();
  hut.position.y = stielHoehe;
  for (let i = 0; i < 5; i++) {
    const teil = macheSchnipsel({
      bild: 'klecks',
      farbe: tone(w(0, 1) > 0.75 ? '#f0f0e8' : '#e0503f', w(-0.05, 0.05)),
      hoehe: 0.2 * groesse * w(0.8, 1.05),
      woelbung: 0.06 * groesse,
    });
    const winkel = (i / 5) * Math.PI * 2;
    teil.position.set(Math.cos(winkel) * 0.03 * groesse, 0, Math.sin(winkel) * 0.03 * groesse);
    teil.rotation.set(-1.25, -winkel, 0);
    hut.add(teil);
  }
  // weisse Punkte
  for (let i = 0; i < 3; i++) {
    const punkt = macheSchnipsel({ bild: 'klecks', farbe: '#fffaf0', hoehe: 0.04 * groesse, woelbung: 0.01 });
    const winkel = w(0, Math.PI * 2);
    punkt.position.set(Math.cos(winkel) * 0.05 * groesse, 0.035 * groesse, Math.sin(winkel) * 0.05 * groesse);
    punkt.rotation.x = -Math.PI / 2 + 0.2;
    hut.add(punkt);
  }
  pilz.add(hut);
  backeZusammen(hut);
  pilz.userData.typ = 'pilz';
  pilz.userData.hoehe = 0.2 * groesse;
  pilz.userData.belebe = (zeit) => {
    hut.position.y = stielHoehe + Math.sin(zeit * 2 + startzahl) * 0.006;
  };
  return pilz;
}

/* ==================================================================
   SETZLING - wird spaeter zum Baum
   ================================================================== */
export function baueSetzling({ groesse = 1, startzahl = 1 } = {}) {
  const w = machWuerfel(startzahl * 86028121 + 17);
  const setzling = new THREE.Group();
  const stielHoehe = 0.14 * groesse;
  const stiel = macheSchnipsel({ bild: 'halm', farbe: '#8a6a3f', hoehe: stielHoehe, woelbung: 0.02 });
  stiel.position.y = stielHoehe / 2;
  stiel.scale.x = 0.5;
  setzling.add(stiel);

  const blaetter = new THREE.Group();
  blaetter.position.y = stielHoehe * 0.85;
  for (let i = 0; i < 3; i++) {
    const b = macheSchnipsel({
      bild: 'blatt-klein',
      farbe: tone(wahl(FARBEN.laubGruen, w), 0.08),
      hoehe: 0.14 * groesse,
      woelbung: 0.06,
    });
    const winkel = (i / 3) * Math.PI * 2 + w(-0.3, 0.3);
    b.position.set(Math.cos(winkel) * 0.045 * groesse, 0, Math.sin(winkel) * 0.045 * groesse);
    b.rotation.set(-0.85, -winkel, 0);
    blaetter.add(b);
  }
  setzling.add(blaetter);
  backeZusammen(blaetter);
  setzling.userData.typ = 'setzling';
  setzling.userData.antippbar = true;
  setzling.userData.hoehe = 0.2 * groesse;
  setzling.userData.belebe = (zeit) => {
    blaetter.rotation.z = Math.sin(zeit * 2.2 + startzahl) * 0.1;
  };
  return setzling;
}

/* ==================================================================
   STEIN
   ================================================================== */
export function baueStein({ groesse = 1, startzahl = 1 } = {}) {
  const w = machWuerfel(startzahl * 6291469 + 23);
  const stein = new THREE.Group();
  const teile = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const t = macheSchnipsel({
      bild: 'klecks',
      farbe: tone(wahl(['#a9a49c', '#928d86', '#bdb8b0'], w), w(-0.05, 0.05)),
      hoehe: 0.22 * groesse * w(0.7, 1.1),
      woelbung: 0.07 * groesse,
    });
    const winkel = (i / 5) * Math.PI * 2;
    t.position.set(Math.cos(winkel) * 0.035 * groesse, 0.055 * groesse * w(0.6, 1.1), Math.sin(winkel) * 0.035 * groesse);
    t.rotation.set(w(-0.6, -0.2), -winkel, w(-0.3, 0.3));
    teile.add(t);
  }
  stein.add(teile);
  backeZusammen(teile);
  stein.userData.typ = 'stein';
  stein.userData.hoehe = 0.14 * groesse;
  return stein;
}
