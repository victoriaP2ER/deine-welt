/* ==================================================================
   DIE BUEHNE - Kamera, Licht, Sternenhimmel.
   Hier wird eingerichtet, wie die Welt beleuchtet und gezeigt wird.
   ================================================================== */

import * as THREE from 'three';
import { machWuerfel } from './schnipsel.js';

export const szene = new THREE.Scene();

/* ---------- Kamera ---------- */
export const kamera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
kamera.position.set(0, 0.9, 6.2);
kamera.lookAt(0, 0, 0);

/* ---------- Bildschirm ---------- */
const leinwand = document.getElementById('buehne');
export const maler = new THREE.WebGLRenderer({
  canvas: leinwand,
  antialias: window.devicePixelRatio < 1.6,
  powerPreference: 'high-performance',
});
maler.setPixelRatio(Math.min(window.devicePixelRatio, 2));
maler.outputColorSpace = THREE.SRGBColorSpace;
maler.toneMapping = THREE.ACESFilmicToneMapping;
maler.toneMappingExposure = 1.32;

// Schatten nur auf Geraeten, die genug Kraft haben
export const schattenAn = !/Android|iPhone|iPad/i.test(navigator.userAgent)
  || window.devicePixelRatio <= 2.5;
if (schattenAn) {
  maler.shadowMap.enabled = true;
  maler.shadowMap.type = THREE.PCFSoftShadowMap;
}

/* ---------- Licht ---------- */
// Weiches Licht von überall, damit nichts komplett schwarz ist
const umgebung = new THREE.HemisphereLight(0xd8e8ff, 0x8a7550, 1.45);
szene.add(umgebung);

// Die Sonne - warm, von oben rechts
export const sonne = new THREE.DirectionalLight(0xfff4dc, 2.1);
// Die Sonne steht schraeg VOR dem Planeten, damit die Seite,
// die du siehst, huebsch beleuchtet ist.
sonne.position.set(2.6, 3.4, 4.2);
if (schattenAn) {
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(1024, 1024);
  const k = sonne.shadow.camera;
  k.left = -3.2; k.right = 3.2; k.top = 3.2; k.bottom = -3.2;
  k.near = 0.5; k.far = 18;
  sonne.shadow.bias = -0.0015;
  sonne.shadow.normalBias = 0.02;
}
szene.add(sonne);

// Kaltes Gegenlicht von links hinten - macht die Ränder huebsch
const gegenlicht = new THREE.DirectionalLight(0x9fb4ff, 0.7);
gegenlicht.position.set(-4, -1.5, 1.5);
szene.add(gegenlicht);

/* ---------- Weltraum-Hintergrund ----------
   Ein echter Nebel aus Blau-, Lila- und Tuerkistönen.
   Wichtig: alles bleibt dunkel und zurückgenommen, damit der
   Planet die Hauptrolle behält.                                    */

function machHimmelBild() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const g = c.getContext('2d');
  const w = machWuerfel(20260910);

  /* --- tiefes Weltraum-Schwarz mit einem Hauch Blau --- */
  const grund = g.createLinearGradient(0, 0, 0, c.height);
  grund.addColorStop(0, '#05060f');
  grund.addColorStop(0.5, '#080b1c');
  grund.addColorStop(1, '#05060f');
  g.fillStyle = grund;
  g.fillRect(0, 0, c.width, c.height);

  /* --- ein Nebelfleck: viele weiche Kreise, die sich überlappen --- */
  function nebel(mitteX, mitteY, weite, farbe, deckkraft, ballen = 14) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ballen; i++) {
      const x = mitteX + w(-weite * 0.55, weite * 0.55);
      const y = mitteY + w(-weite * 0.4, weite * 0.4);
      const r = weite * w(0.3, 0.75);
      // Wolken, die über den Rand ragen, auf der anderen Seite
      // nochmal malen - dann sieht man die Naht der Kugel nicht.
      for (const versatz of [0, -c.width, c.width]) {
        const px = x + versatz;
        if (px < -r || px > c.width + r) continue;
        const verlauf = g.createRadialGradient(px, y, 0, px, y, r);
        verlauf.addColorStop(0, `rgba(${farbe}, ${deckkraft * w(0.7, 1)})`);
        verlauf.addColorStop(0.45, `rgba(${farbe}, ${deckkraft * 0.35})`);
        verlauf.addColorStop(1, `rgba(${farbe}, 0)`);
        g.fillStyle = verlauf;
        g.beginPath();
        g.arc(px, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  /* --- das Nebelband, das sich schraeg über den Himmel zieht --- */
  const band = 520;
  nebel(300, band - 60, 330, '38, 60, 155', 0.15);     // tiefes Blau
  nebel(820, band + 70, 280, '88, 46, 145', 0.13);     // Violett
  nebel(1260, band - 80, 300, '26, 80, 128', 0.115);     // Tuerkis
  nebel(1700, band + 50, 270, '102, 44, 124', 0.105);    // Magenta-Lila

  /* --- winzige hellere Kerne, wo neue Sterne entstehen --- */
  nebel(330, band - 70, 85, '140, 170, 245', 0.1, 5);
  nebel(1290, band - 95, 70, '120, 185, 215', 0.09, 5);
  nebel(1720, band + 40, 65, '175, 140, 215', 0.08, 5);

  /* --- weit oben und unten fast nichts --- */
  nebel(950, 180, 260, '28, 38, 105', 0.075, 8);
  nebel(1560, 850, 270, '58, 34, 105', 0.075, 8);

  /* --- dunkle Staubbahnen: sie geben dem Nebel Struktur --- */
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 22; i++) {
    const x = w(0, c.width);
    const y = band + w(-220, 220);
    const r = w(60, 200);
    const verlauf = g.createRadialGradient(x, y, 0, x, y, r);
    verlauf.addColorStop(0, 'rgba(4, 5, 12, 0.5)');
    verlauf.addColorStop(1, 'rgba(4, 5, 12, 0)');
    g.fillStyle = verlauf;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  /* --- ganz feiner Sternenstaub direkt im Hintergrund --- */
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2200; i++) {
    const x = w(0, c.width);
    const y = w(0, c.height);
    // in der Nähe des Nebelbandes stehen mehr Sterne
    const naheBand = 1 - Math.min(1, Math.abs(y - band) / 420);
    if (w(0, 1) > 0.25 + naheBand * 0.75) continue;
    const helligkeit = w(0.12, 0.62);
    const gr = w(0.4, 1.5);
    g.fillStyle = `rgba(${230 + w(-40, 25)}, ${235 + w(-45, 20)}, 255, ${helligkeit})`;
    g.beginPath();
    g.arc(x, y, gr, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const himmel = new THREE.Mesh(
  new THREE.SphereGeometry(150, 40, 24),
  new THREE.MeshBasicMaterial({
    map: machHimmelBild(),
    side: THREE.BackSide,
    depthWrite: false,
    color: 0xdadff0,        // nimmt dem Nebel einen Hauch Kraft
  })
);
szene.add(himmel);

/* ---------- Sterne ---------- */
function machSternBild() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const v = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  v.addColorStop(0, 'rgba(255,255,255,1)');
  v.addColorStop(0.35, 'rgba(255,246,220,0.75)');
  v.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export const sterne = new THREE.Group();
szene.add(sterne);

function machSternenfeld(anzahl, weite, groesse, startzahl) {
  const wuerfel = machWuerfel(startzahl);
  const orte = new Float32Array(anzahl * 3);
  const farben = new Float32Array(anzahl * 3);
  const farbe = new THREE.Color();
  for (let i = 0; i < anzahl; i++) {
    // gleichmaessig auf einer Kugelschale verteilt
    const u = wuerfel(-1, 1);
    const w = wuerfel(0, Math.PI * 2);
    const r = Math.sqrt(1 - u * u) * weite * wuerfel(0.75, 1);
    orte[i * 3] = Math.cos(w) * r;
    orte[i * 3 + 1] = u * weite * wuerfel(0.75, 1);
    orte[i * 3 + 2] = Math.sin(w) * r;
    // ein paar Sterne blaeulich, ein paar goldig
    farbe.setHSL(wuerfel(0.08, 0.62), wuerfel(0.05, 0.45), wuerfel(0.72, 1));
    farben[i * 3] = farbe.r; farben[i * 3 + 1] = farbe.g; farben[i * 3 + 2] = farbe.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(orte, 3));
  g.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  const m = new THREE.PointsMaterial({
    size: groesse,
    map: machSternBild(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    sizeAttenuation: true,
  });
  const punkte = new THREE.Points(g, m);
  sterne.add(punkte);
  return punkte;
}

const sternenLagen = [
  machSternenfeld(420, 60, 1.15, 7),
  machSternenfeld(300, 40, 0.75, 23),
  machSternenfeld(160, 26, 0.5, 91),
];

/* ---------- jedes Bild neu ---------- */
export function belebeSterne(zeit) {
  sterne.rotation.y = zeit * 0.008;
  himmel.rotation.y = zeit * 0.0035;    // der Nebel zieht ganz langsam vorbei
  sterne.rotation.x = Math.sin(zeit * 0.02) * 0.05;
  // sanftes Funkeln
  sternenLagen.forEach((lage, i) => {
    lage.material.opacity = 0.72 + Math.sin(zeit * (0.7 + i * 0.35) + i) * 0.22;
  });
}

/* ---------- Fenstergröße ---------- */
export function passeGroesseAn() {
  const b = window.innerWidth;
  const h = window.innerHeight;
  kamera.aspect = b / h;
  // Auf hohen, schmalen Handys mehr Blickwinkel, damit alles reinpasst
  kamera.fov = h > b ? 58 : 46;
  kamera.updateProjectionMatrix();
  maler.setSize(b, h, false);
}
window.addEventListener('resize', passeGroesseAn);
passeGroesseAn();
