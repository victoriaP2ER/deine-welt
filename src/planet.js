/* ==================================================================
   DER PLANET

   Eine Kugel, die aus vielen kleinen Papier-Dreiecken besteht -
   jedes Dreieck hat seinen eigenen Farbton, wie ein Mosaik aus
   ausgeschnittenen Schnipseln.

   Wenn man giesst, wird der Boden an dieser Stelle wieder gruen:
   die Dreiecke bekommen einfach eine neue Farbe, so als haette man
   mit einem dicken Pinsel Gruen darauf gemalt.
   ================================================================== */

import * as THREE from 'three';
import { machGemaltesBild, machWuerfel } from './schnipsel.js';

/* ---------- Wie huegelig ist der Planet an dieser Stelle? ---------- */
// Immer die gleiche Formel -> der Planet sieht jedes Mal gleich aus.
export function hoeheAn(richtung) {
  const { x, y, z } = richtung;
  let h = 0;
  h += Math.sin(x * 3.1 + 1.7) * Math.cos(y * 2.7 - 0.4) * 0.030;
  h += Math.sin(y * 4.3 - 2.1) * Math.cos(z * 3.9 + 1.1) * 0.022;
  h += Math.sin(z * 6.1 + 0.6) * Math.cos(x * 5.3 + 2.4) * 0.013;
  h += Math.sin((x + y + z) * 8.5) * 0.006;
  return h;
}

const TROCKEN = new THREE.Color('#a8845a');
const TROCKEN_HELL = new THREE.Color('#c2a274');
const GRUEN = new THREE.Color('#7fc94e');
const GRUEN_HELL = new THREE.Color('#9ed966');

export function machePlanet() {
  const gruppe = new THREE.Group();        // dreht sich, wenn man zieht
  const sachen = new THREE.Group();        // alles, was auf dem Planeten steht
  gruppe.add(sachen);

  /* ---------- die Kugel ---------- */
  const geo = new THREE.IcosahedronGeometry(1, 4);
  const ort = geo.attributes.position;
  const anzahl = ort.count;

  // Huegel und Taeler
  const richtung = new THREE.Vector3();
  for (let i = 0; i < anzahl; i++) {
    richtung.fromBufferAttribute(ort, i).normalize();
    const r = 1 + hoeheAn(richtung);
    ort.setXYZ(i, richtung.x * r, richtung.y * r, richtung.z * r);
  }
  geo.computeVertexNormals();

  // Jedes Dreieck bekommt seinen eigenen Farbton
  const wuerfel = machWuerfel(2024);
  const farben = new Float32Array(anzahl * 3);
  const nass = new Float32Array(anzahl);      // 0 = trocken, 1 = gegossen
  const tonwerte = new Float32Array(anzahl);  // fuer die kleine Farbabweichung
  for (let dreieck = 0; dreieck < anzahl / 3; dreieck++) {
    const ton = wuerfel(0, 1);
    for (let k = 0; k < 3; k++) tonwerte[dreieck * 3 + k] = ton;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));

  const boden = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: machGemaltesBild({
        grund: '#ffffff',
        striche: ['#ffffff', '#e8e8e8', '#f6f6f6', '#dddddd'],
        anzahl: 1100,
        strichGroesse: 34,
        startzahl: 77,
      }),
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      flatShading: true,
    })
  );
  boden.receiveShadow = true;
  boden.castShadow = false;
  boden.userData.typ = 'boden';
  gruppe.add(boden);

  /* ---------- Farben neu berechnen ---------- */
  const farbe = new THREE.Color();
  function malenAuffrischen() {
    for (let i = 0; i < anzahl; i++) {
      const t = tonwerte[i];
      const n = nass[i];
      const trocken = TROCKEN.clone().lerp(TROCKEN_HELL, t);
      const gruen = GRUEN.clone().lerp(GRUEN_HELL, t);
      farbe.copy(trocken).lerp(gruen, n);
      farben[i * 3] = farbe.r; farben[i * 3 + 1] = farbe.g; farben[i * 3 + 2] = farbe.b;
    }
    geo.attributes.color.needsUpdate = true;
  }
  malenAuffrischen();

  /* ---------- Gruen malen (beim Giessen) ---------- */
  const merker = new THREE.Vector3();
  function maleGruen(zielRichtung, weite = 0.42, staerke = 1) {
    const ziel = zielRichtung.clone().normalize();
    let etwasGeaendert = false;
    // Dreieck fuer Dreieck, damit ganze Papierstuecke die Farbe wechseln
    for (let dreieck = 0; dreieck < anzahl / 3; dreieck++) {
      const i = dreieck * 3;
      merker.set(0, 0, 0);
      for (let k = 0; k < 3; k++) {
        merker.x += ort.getX(i + k); merker.y += ort.getY(i + k); merker.z += ort.getZ(i + k);
      }
      merker.divideScalar(3).normalize();
      const abstand = merker.distanceTo(ziel);
      if (abstand > weite) continue;
      const wieViel = staerke * (1 - Math.pow(abstand / weite, 1.6));
      for (let k = 0; k < 3; k++) {
        const neu = Math.min(1, nass[i + k] + wieViel);
        if (neu > nass[i + k]) { nass[i + k] = neu; etwasGeaendert = true; }
      }
    }
    if (etwasGeaendert) malenAuffrischen();
    return etwasGeaendert;
  }

  /** Wie gruen ist der Planet insgesamt? 0 = ganz trocken, 1 = alles gruen */
  function wieGruen() {
    let summe = 0;
    for (let i = 0; i < anzahl; i += 3) summe += nass[i];
    return summe / (anzahl / 3);
  }

  /* ---------- Groesse ---------- */
  const zustand = {
    radius: 0.0001,
    zielRadius: 0.0001,
  };

  /* ---------- Sachen auf den Planeten stellen ---------- */
  const aufgestellt = [];

  /**
   * Stellt ein Objekt auf die Planetenoberflaeche.
   * richtung = in welche Himmelsrichtung (ein Vektor vom Mittelpunkt weg)
   */
  function stelleAuf(objekt, richtungRoh, { einsinken = 0.02, drehung = 0 } = {}) {
    const richtung = richtungRoh.clone().normalize();
    objekt.userData.richtung = richtung;
    objekt.userData.einsinken = einsinken;
    objekt.userData.eigenDrehung = drehung;
    sachen.add(objekt);
    aufgestellt.push(objekt);
    richteAus(objekt);
    return objekt;
  }

  const hoch = new THREE.Vector3(0, 1, 0);
  function richteAus(objekt) {
    const r = objekt.userData.richtung;
    const boden = zustand.radius * (1 + hoeheAn(r)) - objekt.userData.einsinken * zustand.radius;
    objekt.position.copy(r).multiplyScalar(boden);
    objekt.quaternion.setFromUnitVectors(hoch, r);
    if (objekt.userData.eigenDrehung) {
      objekt.rotateY(objekt.userData.eigenDrehung);
    }
  }

  function nimmWeg(objekt) {
    const i = aufgestellt.indexOf(objekt);
    if (i >= 0) aufgestellt.splice(i, 1);
    sachen.remove(objekt);
  }

  function setzeRadius(r) {
    zustand.radius = r;
    boden.scale.setScalar(r);
    for (const o of aufgestellt) richteAus(o);
  }
  setzeRadius(zustand.radius);

  /* ---------- Wachsen ---------- */
  function wachseAuf(neuerRadius) {
    zustand.zielRadius = neuerRadius;
  }

  /* ---------- jedes Bild ---------- */
  function belebe(zeit, schritt) {
    // sanft zur Zielgroesse wachsen
    if (Math.abs(zustand.radius - zustand.zielRadius) > 0.0004) {
      const neu = THREE.MathUtils.lerp(zustand.radius, zustand.zielRadius, 1 - Math.pow(0.004, schritt));
      setzeRadius(neu);
    }
    for (const o of aufgestellt) {
      if (o.userData.belebe) o.userData.belebe(zeit, schritt);
    }
  }

  return {
    gruppe, boden, sachen,
    stelleAuf, nimmWeg, richteAus, setzeRadius, wachseAuf, belebe,
    maleGruen, wieGruen,
    get radius() { return zustand.radius; },
    get zielRadius() { return zustand.zielRadius; },
    aufgestellt,
  };
}
