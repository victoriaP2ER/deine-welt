/* ==================================================================
   SCHNIPSEL - der Baukasten für alles in dieser Welt.

   Jedes Ding im Spiel (Baum, Blume, Mond, Schmetterling) ist aus
   vielen kleinen Papier-Schnipseln zusammengeklebt - genau wie ein
   Basteltier aus ausgeschnittenen Pappstücken.

   Ein Schnipsel ist:
     - ein flaches, leicht gewoelbtes Stück (wie echtes Papier)
     - mit einem gemalten Bild drauf (aus dem Ordner schnipsel/)
     - in einer Farbe, die man frei aussuchen kann
   ================================================================== */

import * as THREE from 'three';

/* ---------- Bilder laden ------------------------------------------ */

const texturen = new Map();   // pfad -> THREE.Texture
const materialien = new Map();

/**
 * Laedt ein SVG-Bild und malt es auf eine Leinwand fester Größe.
 * (Direkt als Textur laden geht auf iPhones manchmal schief, darum
 *  der Umweg über die Leinwand - so klappt es überall.)
 */
function ladeEinBild(pfad, groesse = 256) {
  return new Promise((fertig) => {
    const bild = new Image();
    bild.onload = () => {
      const seiten = bild.width / bild.height || 1;
      const b = seiten >= 1 ? groesse : Math.round(groesse * seiten);
      const h = seiten >= 1 ? Math.round(groesse / seiten) : groesse;
      const leinwand = document.createElement('canvas');
      leinwand.width = b;
      leinwand.height = h;
      leinwand.getContext('2d').drawImage(bild, 0, 0, b, h);

      const textur = new THREE.CanvasTexture(leinwand);
      textur.colorSpace = THREE.SRGBColorSpace;
      textur.anisotropy = 4;
      textur.seitenverhaeltnis = seiten;
      texturen.set(pfad, textur);
      fertig(textur);
    };
    bild.onerror = () => {
      console.warn('Bild nicht gefunden:', pfad);
      // Notfall: ein weißes Quadrat, damit das Spiel weiterläuft
      const leinwand = document.createElement('canvas');
      leinwand.width = leinwand.height = 8;
      const c = leinwand.getContext('2d');
      c.fillStyle = '#fff';
      c.fillRect(0, 0, 8, 8);
      const textur = new THREE.CanvasTexture(leinwand);
      textur.seitenverhaeltnis = 1;
      texturen.set(pfad, textur);
      fertig(textur);
    };
    bild.src = pfad;
  });
}

/** Laedt alle Schnipsel-Bilder, die das Spiel braucht. */
export function ladeAlleBilder(namen) {
  return Promise.all(namen.map((n) => {
    const gross = n === 'krater' || n === 'klecks' ? 384 : 256;
    return ladeEinBild(`schnipsel/${n}.svg`, gross);
  }));
}

export function textur(name) {
  const t = texturen.get(`schnipsel/${name}.svg`);
  if (!t) console.warn('Schnipsel nicht geladen:', name);
  return t;
}

/* ---------- Papier-Geometrie -------------------------------------- */

const geometrien = new Map();

/**
 * Ein Stück Papier: flach, aber leicht gewoelbt - dadurch fängt es
 * das Licht wie echtes Papier und sieht nicht wie ein Aufkleber aus.
 */
function papierGeometrie(breite, hoehe, woelbung) {
  const schluessel = `${breite.toFixed(3)}|${hoehe.toFixed(3)}|${woelbung.toFixed(3)}`;
  if (geometrien.has(schluessel)) return geometrien.get(schluessel);

  const g = new THREE.PlaneGeometry(breite, hoehe, 5, 5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (breite / 2);   // -1 .. 1
    const y = p.getY(i) / (hoehe / 2);
    // Wie ein Blatt, das sich nach hinten biegt und die Spitze hebt
    p.setZ(i, -woelbung * (x * x * 0.9 + y * y * 0.35));
  }
  g.computeVertexNormals();
  geometrien.set(schluessel, g);
  return g;
}

/* ---------- Ein Schnipsel bauen ----------------------------------- */

/**
 * macheSchnipsel({ bild, farbe, hoehe, woelbung, leuchten })
 *
 *   bild     - Name aus dem Ordner schnipsel/ (z.B. 'blatt-1')
 *   farbe    - z.B. '#7fc24a' (das weiße Bild wird damit eingefaerbt)
 *   hoehe    - wie groß das Stück ist (Breite kommt vom Bild)
 *   woelbung - 0 = brettflach, 0.2 = deutlich gebogen
 *   leuchten - leuchtet von sich aus (für Sterne, Funken)
 */
export function macheSchnipsel(einstellungen) {
  const {
    bild,
    farbe = '#ffffff',
    hoehe = 1,
    woelbung = 0.12,
    leuchten = 0,
    durchsichtig = false,
    schattenWerfen = false,
  } = einstellungen;

  const t = textur(bild);
  const seiten = (t && t.seitenverhaeltnis) || 1;
  const breite = hoehe * seiten;

  const schluessel = `${bild}|${farbe}|${leuchten}|${durchsichtig}`;
  let material = materialien.get(schluessel);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      map: t,
      color: new THREE.Color(farbe),
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: durchsichtig,
      alphaTest: durchsichtig ? 0 : 0.45,
      depthWrite: !durchsichtig,
      emissive: new THREE.Color(farbe),
      emissiveIntensity: leuchten,
      emissiveMap: leuchten > 0 ? t : null,
    });
    materialien.set(schluessel, material);
  }

  const netz = new THREE.Mesh(papierGeometrie(breite, hoehe, woelbung), material);
  netz.castShadow = schattenWerfen;
  netz.matrixAutoUpdate = true;
  netz.userData.schnipsel = true;
  return netz;
}

/* ---------- Hilfen ------------------------------------------------ */

/** Zufallszahl zwischen a und b - mit eigenem Wuerfel, damit die Welt
 *  bei jedem Spiel gleich aussieht (sonst springen die Blätter herum). */
export function machWuerfel(startzahl = 1) {
  let s = startzahl >>> 0 || 1;
  return function wuerfel(a = 0, b = 1) {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return a + (s / 4294967296) * (b - a);
  };
}

/** Faerbt eine Farbe etwas heller oder dunkler (für Lagen im Papier). */
export function tone(hex, heller = 0) {
  const f = new THREE.Color(hex);
  const h = {};
  f.getHSL(h);
  f.setHSL(h.h, THREE.MathUtils.clamp(h.s + heller * 0.05, 0, 1),
           THREE.MathUtils.clamp(h.l + heller, 0.02, 0.98));
  return '#' + f.getHexString();
}

/** Dreht ein Objekt so, dass es entlang "richtung" nach oben steht. */
const hoch = new THREE.Vector3(0, 1, 0);
export function stellAuf(objekt, richtung) {
  objekt.quaternion.setFromUnitVectors(hoch, richtung.clone().normalize());
}

/* ==================================================================
   ZUSAMMENBACKEN

   Ein Baum aus 30 Schnipseln wäre für ein Handy viel Arbeit:
   es müsste 30 Mal einzeln zeichnen. Darum kleben wir alle
   Schnipsel, die sich nicht bewegen, zu einem einzigen Stück
   zusammen. Die Farben bleiben trotzdem verschieden, weil jede Ecke
   des Papiers ihre Farbe mitbekommt.

   Schnipsel mit  userData.beweglich = true  bleiben einzeln,
   damit sie wackeln, blinzeln oder flattern können.
   ================================================================== */

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const gebackeneMaterialien = new Map();

export function backeZusammen(gruppe) {
  const stapel = new Map();      // texturname -> [geometrien]
  const rausnehmen = [];

  gruppe.traverse((kind) => {
    if (!kind.isMesh || !kind.userData.schnipsel) return;
    if (kind.userData.beweglich) return;
    rausnehmen.push(kind);
  });

  if (rausnehmen.length < 2) return gruppe;

  gruppe.updateMatrixWorld(true);
  const umkehr = new THREE.Matrix4().copy(gruppe.matrixWorld).invert();

  for (const netz of rausnehmen) {
    const g = netz.geometry.clone();
    // Alles in das Koordinatensystem der Gruppe rechnen
    const m = new THREE.Matrix4().multiplyMatrices(umkehr, netz.matrixWorld);
    g.applyMatrix4(m);

    // Farbe des Schnipsels in die Ecken schreiben
    const f = netz.material.color;
    const anzahl = g.attributes.position.count;
    const farben = new Float32Array(anzahl * 3);
    for (let i = 0; i < anzahl; i++) {
      farben[i * 3] = f.r; farben[i * 3 + 1] = f.g; farben[i * 3 + 2] = f.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(farben, 3));
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') {
        g.deleteAttribute(name);
      }
    }

    const schluessel = netz.material.map ? netz.material.map.uuid : 'ohne';
    if (!stapel.has(schluessel)) stapel.set(schluessel, { karte: netz.material.map, teile: [] });
    stapel.get(schluessel).teile.push(g);
  }

  for (const netz of rausnehmen) netz.parent.remove(netz);

  for (const { karte, teile } of stapel.values()) {
    const zusammen = teile.length === 1 ? teile[0] : mergeGeometries(teile, false);
    if (!zusammen) continue;
    let material = gebackeneMaterialien.get(karte ? karte.uuid : 'ohne');
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        map: karte,
        vertexColors: true,
        roughness: 0.92,
        metalness: 0,
        side: THREE.DoubleSide,
        alphaTest: 0.45,
      });
      gebackeneMaterialien.set(karte ? karte.uuid : 'ohne', material);
    }
    const netz = new THREE.Mesh(zusammen, material);
    netz.castShadow = true;
    netz.receiveShadow = false;
    gruppe.add(netz);
    teile.forEach((t) => { if (t !== zusammen) t.dispose(); });
  }
  return gruppe;
}

/* ==================================================================
   GEMALTE FLAECHEN

   Für runde Sachen (Planet, Mond) brauchen wir kein Schnipsel,
   sondern eine gemalte Oberfläche: viele dicke Pinselstriche,
   direkt vom Computer gemalt.
   ================================================================== */

export function machGemaltesBild({
  grund = '#fff6e0',
  striche = ['#ffffff', '#f0e2c4', '#fffdf4'],
  anzahl = 700,
  groesse = 512,
  strichGroesse = 26,
  startzahl = 5,
} = {}) {
  const w = machWuerfel(startzahl);
  const c = document.createElement('canvas');
  c.width = groesse;
  c.height = groesse / 2;   // 2:1 - passt auf eine Kugel
  const g = c.getContext('2d');
  g.fillStyle = grund;
  g.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < anzahl; i++) {
    const x = w(0, c.width);
    const y = w(0, c.height);
    const laenge = strichGroesse * w(0.6, 1.8);
    const dicke = strichGroesse * w(0.18, 0.42);
    g.save();
    g.translate(x, y);
    g.rotate(w(-0.5, 0.5) + (w(0, 1) > 0.5 ? Math.PI / 2 : 0));
    g.globalAlpha = w(0.12, 0.42);
    g.fillStyle = striche[Math.floor(w(0, striche.length)) % striche.length];
    // ein Pinselstrich: laengliches Oval
    g.beginPath();
    g.ellipse(0, 0, laenge / 2, dicke / 2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
