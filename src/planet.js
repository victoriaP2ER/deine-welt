/* ==================================================================
   DER PLANET

   Eine Kugel, die aus vielen kleinen Papier-Dreiecken besteht -
   jedes Dreieck hat seinen eigenen Farbton, wie ein Mosaik aus
   ausgeschnittenen Schnipseln.

   Wenn man gießt, wird der Boden an dieser Stelle wieder grün:
   die Dreiecke bekommen einfach eine neue Farbe, so als hätte man
   mit einem dicken Pinsel Grün darauf gemalt.
   ================================================================== */

import * as THREE from 'three';
import { machGemaltesBild, machWuerfel } from './schnipsel.js';

/* ---------- GLATTE STELLEN ----------
   Ein See ist flach wie ein Teller, der Planet ist hügelig. Liegt der
   See auf einem Hügel, schaut eine Ecke heraus und die andere steckt
   im Boden.

   Darum werden die Hügel an dieser Stelle weggebügelt: der Boden wird
   dort so glatt wie die Kugel selbst. Das Wichtige daran - es wird nur
   etwas WEGGENOMMEN, nie etwas dazugetan. Dadurch kann der Planet
   davon niemals unförmig werden.

   Und je größer der Planet wird, desto weniger merkt man von seiner
   Rundung - genau wie bei der Erde. Ein See auf einem großen Planeten
   fügt sich also ganz von allein ein.
   ------------------------------------------------------------------ */
const glatteStellen = [];

/* Die Hügel des Planeten.
   Immer die gleiche Formel -> der Planet sieht jedes Mal gleich aus. */
function huegelAn(richtung) {
  const { x, y, z } = richtung;
  let h = 0;
  h += Math.sin(x * 3.1 + 1.7) * Math.cos(y * 2.7 - 0.4) * 0.030;
  h += Math.sin(y * 4.3 - 2.1) * Math.cos(z * 3.9 + 1.1) * 0.022;
  h += Math.sin(z * 6.1 + 0.6) * Math.cos(x * 5.3 + 2.4) * 0.013;
  h += Math.sin((x + y + z) * 8.5) * 0.006;
  return h;
}

/** Wie hoch liegt der Boden hier - mit den glattgebügelten Stellen. */
export function hoeheAn(richtung) {
  let h = huegelAn(richtung);
  for (const s of glatteStellen) {
    const abstand = richtung.distanceTo(s.richtung);
    if (abstand >= s.weite) continue;
    const t = 1 - abstand / s.weite;
    const weich = t * t * (3 - 2 * t);        // weicher Übergang zum Rest
    // zur Höhe in der Mitte hin angleichen - nie darüber hinaus
    h = h * (1 - weich) + s.hoehe * weich;
  }
  return h;
}

/** Diese Stelle wird glattgebügelt (für flache Sachen wie einen See). */
function buegleGlatt(richtung, weite) {
  const r = richtung.clone().normalize();
  glatteStellen.push({ richtung: r, weite, hoehe: huegelAn(r) });
}

const TROCKEN = new THREE.Color('#a8845a');
const TROCKEN_HELL = new THREE.Color('#c2a274');
const GRUEN = new THREE.Color('#7fc94e');
const GRUEN_HELL = new THREE.Color('#9ed966');

export function machePlanet() {
  const gruppe = new THREE.Group();        // dreht sich, wenn man zieht
  const sachen = new THREE.Group();        // alles, was auf dem Planeten steht
  gruppe.add(sachen);

  /* ---------- die Kugel ----------
     Sie wird aus Dreiecken gebaut. Je größer der Planet wird, desto
     mehr Dreiecke braucht er - sonst sieht man bei einer großen Welt
     die einzelnen Flächen viel zu deutlich.

     Darum kann die Kugel jederzeit feiner neu gebaut werden. Damit
     dabei nichts verloren geht, merkt sich der Planet, WO gegossen
     wurde (nicht nur, welche Ecke gerade grün ist).                 */
  let geo = null;
  let ort = null;
  let anzahl = 0;
  let richtungen = [];
  let farben = null;
  let nass = null;         // 0 = trocken, 1 = gegossen
  let tonwerte = null;     // kleine Farbabweichung pro Dreieck
  let feinheit = 0;
  let dreieckMitten = [];
  let boden = null;   // das Kugel-Mesh (wird gleich gebaut)

  /** Baut die Kugelform neu auf: Hügel, Täler und ebene Stellen. */
  function formeKugelNeu() {
    for (let i = 0; i < anzahl; i++) {
      const r = richtungen[i];
      const hoehe = 1 + hoeheAn(r);
      ort.setXYZ(i, r.x * hoehe, r.y * hoehe, r.z * hoehe);
    }
    ort.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  /** Baut die Kugel mit einer bestimmten Feinheit ganz neu. */
  function baueKugel(neueFeinheit) {
    const alteGeo = geo;
    feinheit = neueFeinheit;
    geo = new THREE.IcosahedronGeometry(1, neueFeinheit);
    ort = geo.attributes.position;
    anzahl = ort.count;

    // Die Grundrichtung jeder Ecke merken
    richtungen = new Array(anzahl);
    const richtung = new THREE.Vector3();
    for (let i = 0; i < anzahl; i++) {
      richtung.fromBufferAttribute(ort, i).normalize();
      richtungen[i] = richtung.clone();
    }

    // Jedes Dreieck bekommt seinen eigenen Farbton.
    // Der Würfel startet immer gleich - so sieht der Planet nach dem
    // Umbau genauso aus wie vorher, nur feiner.
    const wuerfel = machWuerfel(2024);
    farben = new Float32Array(anzahl * 3);
    nass = new Float32Array(anzahl);
    tonwerte = new Float32Array(anzahl);
    for (let dreieck = 0; dreieck < anzahl / 3; dreieck++) {
      const ton = wuerfel(0, 1);
      for (let k = 0; k < 3; k++) tonwerte[dreieck * 3 + k] = ton;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));

    // Die Mitte jedes Dreiecks einmal ausrechnen. Beim Gießen muss
    // dann nur noch verglichen werden, wie weit sie weg ist - das
    // ist viel schneller, als sie jedes Mal neu zu berechnen.
    dreieckMitten = new Array(anzahl / 3);
    for (let dreieck = 0; dreieck < anzahl / 3; dreieck++) {
      const i = dreieck * 3;
      const m = new THREE.Vector3();
      for (let k = 0; k < 3; k++) m.add(richtungen[i + k]);
      dreieckMitten[dreieck] = m.divideScalar(3).normalize();
    }

    formeKugelNeu();
    if (boden) {
      boden.geometry = geo;
      if (alteGeo) alteGeo.dispose();
      trageAllesNeuAuf();          // alles Grün wieder auftragen
    }
  }

  baueKugel(4);

  boden = new THREE.Mesh(
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

  /* ---------- Grün malen (beim Gießen) ----------
     Jede gegossene Stelle wird in einer Liste gemerkt. Dadurch kann
     der Planet später aus mehr Dreiecken neu gebaut werden, ohne
     dass das Grün verloren geht.                                    */
  const gegosseneStellen = [];

  /** Trägt eine einzelne Stelle auf die Ecken auf. */
  function trageStelleAuf(stelle) {
    const { richtung: ziel, weite, staerke } = stelle;
    let etwasGeaendert = false;
    // Dreieck für Dreieck, damit ganze Papierstücke die Farbe wechseln
    for (let dreieck = 0; dreieck < dreieckMitten.length; dreieck++) {
      const i = dreieck * 3;
      const abstand = dreieckMitten[dreieck].distanceTo(ziel);
      if (abstand > weite) continue;
      const wieViel = staerke * (1 - Math.pow(abstand / weite, 1.6));
      for (let k = 0; k < 3; k++) {
        const neu = Math.min(1, nass[i + k] + wieViel);
        if (neu > nass[i + k]) { nass[i + k] = neu; etwasGeaendert = true; }
      }
    }
    return etwasGeaendert;
  }

  function maleGruen(zielRichtung, weite = 0.42, staerke = 1) {
    const stelle = { richtung: zielRichtung.clone().normalize(), weite, staerke };
    gegosseneStellen.push(stelle);
    const etwasGeaendert = trageStelleAuf(stelle);
    if (etwasGeaendert) malenAuffrischen();
    return etwasGeaendert;
  }

  /** Alle gegossenen Stellen neu auftragen (nach einem Umbau). */
  function trageAllesNeuAuf() {
    nass.fill(0);
    for (const stelle of gegosseneStellen) trageStelleAuf(stelle);
    malenAuffrischen();
  }

  /** Wie grün ist der Planet insgesamt? 0 = ganz trocken, 1 = alles grün */
  function wieGruen() {
    let summe = 0;
    for (let i = 0; i < anzahl; i += 3) summe += nass[i];
    return summe / (anzahl / 3);
  }

  /* ---------- Eine Stelle glattbügeln ---------- */
  /**
   * Bügelt die Hügel an einer Stelle weg - für flache Sachen wie
   * einen See. Der Planet bekommt dadurch keine Beule und keine
   * Mulde, er wird dort nur ruhiger.
   *   breite - wie breit die glatte Fläche werden soll (echtes Maß)
   */
  function macheFlacheStelle(zielRichtung, breite) {
    const halbe = (breite * 0.5) / Math.max(0.3, zustand.radius);
    buegleGlatt(zielRichtung, Math.min(0.9, halbe * 2.2));
    formeKugelNeu();
    for (const o of aufgestellt) richteAus(o);
  }

  /* ---------- Größe ---------- */
  const zustand = {
    radius: 0.0001,
    zielRadius: 0.0001,
  };

  /* ---------- Sachen auf den Planeten stellen ---------- */
  const aufgestellt = [];

  /**
   * Stellt ein Objekt auf die Planetenoberfläche.
   * richtung = in welche Himmelsrichtung (ein Vektor vom Mittelpunkt weg)
   */
  function stelleAuf(objekt, richtungRoh,
                     { einsinken = 0.02, einsinkenAbsolut = 0,
                       flachBreite = 0, drehung = 0 } = {}) {
    const richtung = richtungRoh.clone().normalize();
    objekt.userData.richtung = richtung;
    objekt.userData.einsinken = einsinken;
    // "einsinkenAbsolut" ist eine feste Tiefe in Weltmass - gut für
    // Sachen wie einen See, die immer gleich tief im Boden liegen
    // sollen, egal wie groß der Planet gerade ist.
    objekt.userData.einsinkenAbsolut = einsinkenAbsolut;
    objekt.userData.flachBreite = flachBreite;
    objekt.userData.eigenDrehung = drehung;
    sachen.add(objekt);
    aufgestellt.push(objekt);
    richteAus(objekt);
    if (objekt.userData.antippbar) gibGrosseTrefferflaeche(objekt);
    return objekt;
  }

  /* ------------------------------------------------------------------
     GROSSE TREFFERFLAECHE

     Ein Häschen oder eine Blume ist klein - mit dem Finger auf dem
     Handy trifft man sie kaum. Darum bekommt jedes antippbare Ding
     einen unsichtbaren Ball drumherum, der die Beruehrung auffängt.
     Man sieht ihn nicht, aber man trifft viel leichter.
     ------------------------------------------------------------------ */
  function gibGrosseTrefferflaeche(objekt) {
    if (objekt.userData.hatTrefferBall) return;
    objekt.userData.hatTrefferBall = true;

    // Wie groß ist das Ding überhaupt?
    let hoehe = objekt.userData.hoehe;
    if (!hoehe) {
      const kasten = new THREE.Box3().setFromObject(objekt);
      const groesse = kasten.getSize(new THREE.Vector3());
      hoehe = Math.max(groesse.x, groesse.y, groesse.z) || 0.3;
    }
    const r = Math.max(0.16, hoehe * 0.65);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(r, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    ball.position.y = hoehe * 0.45;
    // Das Ding selbst wird beim Wachsen skaliert - der Ball soll
    // dabei nicht mitschrumpfen, darum hängt er am Objekt und
    // wird beim Antippen über die Elternkette gefunden.
    objekt.add(ball);
    objekt.userData.trefferBall = ball;
  }

  const hoch = new THREE.Vector3(0, 1, 0);
  /* ------------------------------------------------------------------
     FLACHE SACHEN AUF EINER RUNDEN WELT

     Ein See ist flach wie ein Teller, der Planet ist rund. Legt man
     den Teller obendrauf, stehen seine Raender in der Luft, weil die
     Kugel darunter wegfaellt.

     Darum versenken wir flache Sachen genau so tief, dass ihr Rand
     den Boden beruehrt. Wie tief das ist, haengt davon ab, wie breit
     das Ding ist und wie gross der Planet gerade ist - darum wird es
     jedes Mal neu ausgerechnet, auch wenn der Planet waechst.
     ------------------------------------------------------------------ */
  function krümmungsTiefe(breite) {
    const halbe = breite * 0.5;
    const r = zustand.radius;
    if (halbe >= r) return r * 0.6;      // riesig: einfach tief rein
    return r - Math.sqrt(Math.max(0, r * r - halbe * halbe));
  }

  function richteAus(objekt) {
    const r = objekt.userData.richtung;
    const flach = objekt.userData.flachBreite
      ? krümmungsTiefe(objekt.userData.flachBreite)
      : 0;
    const boden = zustand.radius * (1 + hoeheAn(r))
      - objekt.userData.einsinken * zustand.radius
      - (objekt.userData.einsinkenAbsolut || 0)
      - flach;
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

  /** Wie fein muss die Kugel bei dieser Größe sein?
   *
   *  Die Kugel besteht aus 20 großen Flächen, und jede wird in
   *  (feinheit+1)² kleine Dreiecke geteilt. Wenn der Planet doppelt
   *  so groß wird, braucht er also etwa viermal so viele Dreiecke,
   *  damit die einzelnen Flächen gleich klein aussehen.
   *
   *  Wenige Stufen, damit nicht bei jedem kleinen Wachstum die ganze
   *  Kugel neu gebaut werden muss.                                  */
  function passendeFeinheit(r) {
    if (r < 1.3) return 4;      //    500 Dreiecke
    if (r < 1.9) return 7;      //  1 280
    if (r < 2.6) return 10;     //  2 420
    if (r < 3.6) return 13;     //  3 920
    return 16;                  //  5 780
  }

  function setzeRadius(r) {
    zustand.radius = r;
    boden.scale.setScalar(r);
    // Je größer der Planet, desto mehr Dreiecke - sonst sieht man
    // die einzelnen Flächen zu deutlich.
    const gewuenscht = passendeFeinheit(r);
    if (gewuenscht !== feinheit) baueKugel(gewuenscht);
    // Solange der Planet noch winzig ist, ist er gar nicht da: sonst
    // würde die unsichtbare Mini-Kugel schon Fingertipps abfangen.
    boden.visible = r > 0.04;
    for (const o of aufgestellt) richteAus(o);
  }
  setzeRadius(zustand.radius);

  /* ---------- Wachsen ---------- */
  function wachseAuf(neuerRadius) {
    zustand.zielRadius = neuerRadius;
  }

  /* ---------- jedes Bild ---------- */
  function belebe(zeit, schritt, kameraOrt) {
    // sanft zur Zielgröße wachsen
    if (Math.abs(zustand.radius - zustand.zielRadius) > 0.0004) {
      const neu = THREE.MathUtils.lerp(zustand.radius, zustand.zielRadius, 1 - Math.pow(0.004, schritt));
      setzeRadius(neu);
    }
    // Die Kameraposition wird weitergegeben: Dinge mit Gesicht
    // können sich damit zum Betrachter drehen.
    for (const o of aufgestellt) {
      if (o.userData.belebe) o.userData.belebe(zeit, schritt, kameraOrt);
    }
  }

  return {
    gruppe, boden, sachen,
    stelleAuf, nimmWeg, richteAus, setzeRadius, wachseAuf, belebe,
    maleGruen, wieGruen, macheFlacheStelle,
    get radius() { return zustand.radius; },
    get zielRadius() { return zustand.zielRadius; },
    aufgestellt,
  };
}
