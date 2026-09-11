/* ==================================================================
   DINGE ZUM FINDEN - Gießkanne und Samentüte.
   Beide liegen irgendwo auf dem Planeten und schimmern leicht,
   damit man sie findet.
   ================================================================== */

import * as THREE from 'three';
import { macheSchnipsel, backeZusammen, tone } from './schnipsel.js';

/* ---------- GIESSKANNE ---------- */
export function baueGiesskanne({ groesse = 1 } = {}) {
  const kanne = new THREE.Group();
  const teile = new THREE.Group();
  const blau = '#3fa8dc';

  // Bauch: vier Streifen im Kreis = wirkt rund
  for (let i = 0; i < 4; i++) {
    const s = macheSchnipsel({
      bild: 'streifen',
      farbe: tone(blau, i === 0 ? 0.08 : i === 2 ? -0.09 : 0),
      hoehe: 0.17 * groesse,
      woelbung: 0.07 * groesse,
    });
    const winkel = (i / 4) * Math.PI * 2;
    s.position.set(Math.cos(winkel) * 0.02 * groesse, 0.085 * groesse, Math.sin(winkel) * 0.02 * groesse);
    s.rotation.y = winkel;
    s.scale.x = 1.25;
    teile.add(s);
  }
  // Deckel
  const deckel = macheSchnipsel({ bild: 'klecks', farbe: tone(blau, 0.12), hoehe: 0.11 * groesse, woelbung: 0.03 });
  deckel.rotation.x = -Math.PI / 2;
  deckel.position.y = 0.17 * groesse;
  teile.add(deckel);

  // Tülle (Rohr nach vorne oben)
  const tuelle = macheSchnipsel({ bild: 'streifen', farbe: tone(blau, 0.05), hoehe: 0.16 * groesse, woelbung: 0.03 });
  tuelle.position.set(-0.09 * groesse, 0.14 * groesse, 0);
  tuelle.rotation.z = 1.05;
  tuelle.scale.x = 0.42;
  teile.add(tuelle);
  const tuelle2 = tuelle.clone();
  tuelle2.rotation.y = Math.PI / 2;
  teile.add(tuelle2);
  // Brausekopf
  const kopf = macheSchnipsel({ bild: 'klecks', farbe: tone(blau, 0.14), hoehe: 0.06 * groesse, woelbung: 0.02 });
  kopf.position.set(-0.155 * groesse, 0.185 * groesse, 0);
  kopf.rotation.z = 0.6;
  teile.add(kopf);

  // Griff: der Bogen-Schnipsel (eigentlich eine Augenbraue!) passt perfekt
  for (const dreh of [0, Math.PI / 2]) {
    const griff = macheSchnipsel({ bild: 'braue', farbe: tone(blau, -0.06), hoehe: 0.055 * groesse, woelbung: 0.02 });
    griff.position.set(0.075 * groesse, 0.2 * groesse, 0);
    griff.rotation.set(0, dreh, -1.5);
    griff.scale.x = 1.3;
    teile.add(griff);
  }

  kanne.add(teile);
  backeZusammen(teile);
  kanne.userData.typ = 'giesskanne';
  kanne.userData.antippbar = true;
  kanne.userData.hoehe = 0.24 * groesse;
  kanne.userData.belebe = (zeit) => {
    teile.rotation.y = Math.sin(zeit * 0.7) * 0.25;
    teile.position.y = Math.sin(zeit * 1.6) * 0.012;
  };
  return kanne;
}

/* ---------- SAMENTUETE ---------- */
export function baueSamentuete({ groesse = 1 } = {}) {
  const tuete = new THREE.Group();
  const teile = new THREE.Group();
  const papier = '#ff5a8a';      // knallig, damit man sie sofort findet

  for (let i = 0; i < 3; i++) {
    const s = macheSchnipsel({
      bild: 'streifen',
      farbe: tone(papier, i === 0 ? 0.06 : -0.07 * i),
      hoehe: 0.19 * groesse,
      woelbung: 0.04 * groesse,
    });
    const winkel = (i / 3) * Math.PI * 2;
    s.position.set(Math.cos(winkel) * 0.016 * groesse, 0.095 * groesse, Math.sin(winkel) * 0.016 * groesse);
    s.rotation.y = winkel;
    s.scale.x = 1.15;
    teile.add(s);
  }
  // umgeknickter Rand oben
  const knick = macheSchnipsel({ bild: 'streifen', farbe: tone(papier, -0.12), hoehe: 0.045 * groesse, woelbung: 0.02 });
  knick.position.y = 0.185 * groesse;
  knick.scale.x = 1.5;
  teile.add(knick);

  // kleine Blume vorne drauf (damit man sieht, was drin ist)
  const bild = new THREE.Group();
  bild.position.set(0, 0.1 * groesse, 0.048 * groesse);
  for (let i = 0; i < 5; i++) {
    const b = macheSchnipsel({ bild: 'blueten-blatt', farbe: '#fff3b0', hoehe: 0.05 * groesse, woelbung: 0.01 });
    const winkel = (i / 5) * Math.PI * 2;
    b.position.set(Math.cos(winkel) * 0.022 * groesse, Math.sin(winkel) * 0.022 * groesse, 0);
    b.rotation.z = -winkel + Math.PI / 2;
    bild.add(b);
  }
  const mitte = macheSchnipsel({ bild: 'klecks', farbe: '#ffe066', hoehe: 0.03 * groesse, woelbung: 0.01 });
  bild.add(mitte);
  teile.add(bild);

  tuete.add(teile);
  backeZusammen(teile);
  tuete.userData.typ = 'samentuete';
  tuete.userData.antippbar = true;
  tuete.userData.hoehe = 0.24 * groesse;
  tuete.userData.belebe = (zeit) => {
    teile.rotation.y = Math.sin(zeit * 0.6 + 1) * 0.2;
    teile.position.y = Math.sin(zeit * 1.4 + 1) * 0.01;
  };
  return tuete;
}

/* ---------- FUNKEN-RING: zeigt, dass man etwas nehmen kann ---------- */
export function baueSchimmer({ groesse = 1.4, farbe = '#fff3a8' } = {}) {
  const ring = new THREE.Group();
  const funken = [];
  for (let i = 0; i < 5; i++) {
    const f = macheSchnipsel({
      bild: 'funke', farbe, hoehe: 0.1 * groesse, woelbung: 0, leuchten: 1.8, durchsichtig: true,
    });
    f.material.opacity = 0.9;
    f.userData.phase = (i / 5) * Math.PI * 2;
    ring.add(f);
    funken.push(f);
  }
  ring.userData.belebe = (zeit) => {
    funken.forEach((f, i) => {
      const t = zeit * 1.1 + f.userData.phase;
      f.position.set(Math.cos(t) * 0.17 * groesse, 0.1 * groesse + Math.sin(t * 1.7 + i) * 0.06 * groesse, Math.sin(t) * 0.17 * groesse);
      f.rotation.z = t * 1.5;
      const s = 0.6 + Math.sin(t * 2.3) * 0.4;
      f.scale.setScalar(s);
      f.material.opacity = 0.35 + s * 0.5;
    });
  };
  return ring;
}
