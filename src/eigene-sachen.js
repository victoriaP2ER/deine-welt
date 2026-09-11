/* ==================================================================
   DEINE EIGENEN ZEICHNUNGEN

   Wenn du auf der Meta Quest in Open Brush etwas malst, kann es
   hier in die Welt kommen. Es gibt drei Wege:

   1. ICOSA GALLERY (kein Kabel noetig!)
      In Open Brush auf Icosa Gallery hochladen, dann im Spiel auf
      den Mal-Knopf tippen und deinen Namen eingeben. Das Spiel holt
      deine Skizzen direkt aus dem Internet.

   2. DATEI INS FENSTER ZIEHEN
      Eine .glb Datei einfach ins Spielfenster ziehen.

   3. ORDNER meine-sachen/
      Datei dort ablegen und in meine-sachen/liste.json eintragen.
      Dann gehört sie fest zum Spiel - auch für alle anderen.
   ================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ICOSA = 'https://api.icosa.gallery/v1';
const SPEICHER = 'deine-welt-eigene-sachen';
const lader = new GLTFLoader();

/* ================================================================
   Ein GLB laden und passend zurechtmachen
   ================================================================ */
function ladeGlb(quelle) {
  return new Promise((fertig, schiefgegangen) => {
    lader.load(quelle, (ergebnis) => fertig(ergebnis.scene), undefined, schiefgegangen);
  });
}

/**
 * Open-Brush-Zeichnungen sind riesig und stehen irgendwo im Raum.
 * Hier werden sie auf eine gute Größe gebracht und so verschoben,
 * dass sie mit den Füßen auf dem Boden stehen.
 */
function machePassend(modell, zielHoehe = 0.55) {
  /* Open-Brush-Zeichnungen brauchen eine kleine Kur, damit sie hier
     genauso aussehen wie in der Brille:

     - metalness: glTF sagt standardmaessig "das ist Metall". Ohne eine
       Spiegel-Umgebung wird Metall aber pechschwarz. Also: kein Metall.
     - schwarze Grundfarbe: manche Pinsel bringen color = schwarz mit.
       Weil die echte Farbe in den Ecken (vertex colors) steckt, würde
       schwarz alles auslöschen. Also auf weiß setzen.
     - beide Seiten sichtbar, weil Pinselstriche papierdünn sind.        */
  modell.traverse((teil) => {
    if (!teil.isMesh) return;
    teil.castShadow = false;
    teil.receiveShadow = false;
    const hatEckenFarben = !!(teil.geometry && teil.geometry.attributes.color);
    const materialien = Array.isArray(teil.material) ? teil.material : [teil.material];
    for (const m of materialien) {
      if (!m) continue;
      m.side = THREE.DoubleSide;
      if (hatEckenFarben) m.vertexColors = true;
      if ('metalness' in m) m.metalness = 0;
      if ('roughness' in m) m.roughness = Math.max(0.75, m.roughness || 0);

      /* Durchsichtige Pinsel (Wasser, Blasen, Nebel) brauchen eine
         Sonderbehandlung: sie duerfen sich nicht gegenseitig
         wegschneiden. Darum schreiben sie keine Tiefe mehr - dann
         scheint das Wasser richtig durch.                          */
      if (m.transparent) {
        m.depthWrite = false;
        m.side = THREE.DoubleSide;
        if (m.opacity < 0.15) m.opacity = 0.4;   // ganz unsichtbar wäre schade
      }
      // schwarze Grundfarbe würde die Eckenfarben auslöschen
      if (hatEckenFarben && m.color) {
        const helligkeit = m.color.r + m.color.g + m.color.b;
        if (helligkeit < 0.12) m.color.setRGB(1, 1, 1);
      }
      // Pinselstriche in Open Brush leuchten ein wenig von sich aus
      if (m.emissive && m.emissive.getHex() === 0x000000) {
        m.emissive.setRGB(1, 1, 1);
        m.emissiveIntensity = 0.1;
      }
    }
  });

  /* ------------------------------------------------------------------
     VERIRRTE STRICHE AUSSORTIEREN

     Beim Malen in VR bleibt schnell mal ein Strich weit weg vom Rest
     hängen - ein Ausrutscher, ein Punkt hinter dir. Man sieht ihn in
     der Brille kaum, aber er macht die "Kiste" um die Zeichnung
     riesig. Folge: die Zeichnung wird viel zu klein gerechnet und
     sitzt nicht mehr in der Mitte.

     Darum messen wir robust: wir schauen uns viele Punkte der
     Zeichnung an und lassen die äußersten 4 Prozent weg. Was dann
     übrig bleibt, ist das, was man wirklich gemalt hat.
     ------------------------------------------------------------------ */
  const proben = [];
  modell.updateMatrixWorld(true);
  modell.traverse((teil) => {
    if (!teil.isMesh || !teil.geometry || !teil.geometry.attributes.position) return;
    const pos = teil.geometry.attributes.position;
    const schritt = Math.max(1, Math.floor(pos.count / 500));
    const punkt = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += schritt) {
      punkt.fromBufferAttribute(pos, i);
      teil.localToWorld(punkt);
      proben.push(punkt.clone());
    }
  });

  const kasten = new THREE.Box3();
  if (proben.length > 20) {
    // Mittelpunkt aller Proben
    const mitte = new THREE.Vector3();
    for (const p of proben) mitte.add(p);
    mitte.divideScalar(proben.length);

    // Entfernungen sortieren und die äußersten 4% weglassen
    const entfernungen = proben.map((p) => p.distanceTo(mitte)).sort((a, b) => a - b);
    const grenze = entfernungen[Math.floor(entfernungen.length * 0.96)] || 1;

    for (const p of proben) {
      if (p.distanceTo(mitte) <= grenze * 1.02) kasten.expandByPoint(p);
    }

    // Meshes, die komplett weit draußen liegen, sind Ausrutscher -
    // die blenden wir aus.
    const weitDraussen = grenze * 1.9;
    modell.traverse((teil) => {
      if (!teil.isMesh || !teil.geometry) return;
      if (!teil.geometry.boundingSphere) teil.geometry.computeBoundingSphere();
      const kugel = teil.geometry.boundingSphere;
      if (!kugel) return;
      const ort = kugel.center.clone();
      teil.localToWorld(ort);
      if (ort.distanceTo(mitte) - kugel.radius > weitDraussen) {
        teil.visible = false;
      }
    });
  }
  if (kasten.isEmpty()) kasten.setFromObject(modell);

  const groesse = kasten.getSize(new THREE.Vector3());
  const groesste = Math.max(groesse.x, groesse.y, groesse.z) || 1;

  /* Wie weit reicht jeder einzelne Pinsel von der Mitte weg?
     Damit kann man zwei Zeichnungen aneinander ausrichten, die
     denselben Kern haben - zum Beispiel den leeren und den
     gefuellten See: beide sind mit denselben Pinseln gemalt, im
     vollen kommen nur Wasser und Pflanzen dazu. Vergleicht man nur
     die gemeinsamen Pinsel, weiss man genau, wie gross der eine
     gegenueber dem anderen gemalt wurde.                           */
  const teilWeiten = {};
  const teilMitten = {};
  {
    // Gemessen wird, wie GROSS ein Pinsel-Teil ist (seine Kiste),
    // nicht wo es liegt. So ist es egal, ob die Zeichnung
    // verschoben ist - nur die Groesse zaehlt.
    const kisten = {};
    const p = new THREE.Vector3();
    modell.traverse((teil) => {
      if (!teil.isMesh || !teil.visible) return;
      if (!teil.geometry || !teil.geometry.attributes.position) return;
      const name = (teil.material && teil.material.name) || '?';
      const kiste = kisten[name] || (kisten[name] = new THREE.Box3());
      const pos = teil.geometry.attributes.position;
      const schritt = Math.max(1, Math.floor(pos.count / 200));
      for (let i = 0; i < pos.count; i += schritt) {
        p.fromBufferAttribute(pos, i);
        teil.localToWorld(p);
        kiste.expandByPoint(p);
      }
    });
    const mass = new THREE.Vector3();
    for (const name of Object.keys(kisten)) {
      if (kisten[name].isEmpty()) continue;
      kisten[name].getSize(mass);
      teilWeiten[name] = Math.max(mass.x, mass.y, mass.z);
      teilMitten[name] = kisten[name].getCenter(new THREE.Vector3());
    }
  }

  /* Wie weit reicht die Zeichnung wirklich auf dem Boden?
     Eine Kiste drumherum sagt das nicht gut: bei einem See ist die
     Kiste voll, beim naechsten haengt nur ein einzelner Strich in
     der Ecke. Darum schauen wir, wie weit 90 Prozent der gemalten
     Punkte von der Mitte weg sind. Das ist die Groesse, die man
     wirklich sieht - und damit koennen zwei Zeichnungen fair
     verglichen werden.                                            */
  let flaecheRadius = 0;
  if (proben.length > 20) {
    const m = kasten.getCenter(new THREE.Vector3());
    const weiten = proben
      .map((p) => Math.hypot(p.x - m.x, p.z - m.z))
      .sort((a, b) => a - b);
    flaecheRadius = weiten[Math.floor(weiten.length * 0.9)] || 0;
  }

  /* Wir messen die HOEHE, nicht die Breite: sonst würde eine breit
     gemalte Blume ganz flach und winzig auf dem Planeten stehen.
     Bei sehr flachen Sachen (einem Teppich zum Beispiel) nehmen wir
     einen Teil der Gesamtgröße, damit sie nicht riesig werden.     */
  const bezug = Math.max(groesse.y, groesste * 0.42);
  const faktor = zielHoehe / bezug;

  const huelle = new THREE.Group();
  modell.scale.setScalar(faktor);
  // in die Mitte ruecken und auf den Boden stellen
  const mitte = kasten.getCenter(new THREE.Vector3()).multiplyScalar(faktor);
  modell.position.set(-mitte.x, -kasten.min.y * faktor, -mitte.z);
  huelle.add(modell);

  huelle.userData.typ = 'eigene-zeichnung';
  huelle.userData.antippbar = true;
  huelle.userData.hoehe = zielHoehe;
  // Die echten Masse merken (bei voller Groesse). Sonst misst man
  // aus Versehen ein Modell, das gerade erst herauswaechst.
  huelle.userData.masse = {
    x: groesse.x * faktor,
    y: groesse.y * faktor,
    z: groesse.z * faktor,
  };
  huelle.userData.flaecheRadius = flaecheRadius * faktor;
  huelle.userData.teilWeiten = {};
  huelle.userData.teilMitten = {};
  for (const name of Object.keys(teilWeiten)) {
    huelle.userData.teilWeiten[name] = teilWeiten[name] * faktor;
    // die Mitte jedes Pinsel-Teils, umgerechnet auf die fertige
    // Zeichnung - damit zwei Zeichnungen genau uebereinander passen
    huelle.userData.teilMitten[name] = teilMitten[name].clone()
      .multiplyScalar(faktor).add(modell.position);
  }
  huelle.userData.belebe = (zeit) => {
    // schwebt und dreht sich ganz sanft, damit man sie von allen Seiten sieht
    huelle.rotation.y = Math.sin(zeit * 0.25) * 0.3;
    huelle.position.y = Math.sin(zeit * 1.1) * 0.008;
  };
  return huelle;
}

/* ================================================================
   Auf den Planeten stellen
   ================================================================ */
function stelleAufPlanet(spiel, modell, richtung) {
  const r = richtung || vorderseite(spiel);
  modell.scale.setScalar(0.05);
  spiel.planet.stelleAuf(modell, r, { einsinken: 0.005 });
  spiel.lassWachsen(modell, 1, 1.2);
  spiel.planet.maleGruen(r, 0.26, 0.6);
  spiel.klang.klangWachsen();
  spiel.funkeBei(modell.getWorldPosition(new THREE.Vector3()), 8);
  return modell;
}

/** Die Stelle des Planeten, die gerade zu dir zeigt.
    Weil die Kamera um den Planeten fliegt, ist das einfach die
    Richtung, in der die Kamera steht. */
function vorderseite(spiel) {
  const zurKamera = spiel.kamera.position.clone().normalize();
  return spiel.planet.gruppe.worldToLocal(zurKamera.multiplyScalar(1)).normalize();
}

/* ================================================================
   Gemerkte Zeichnungen (damit sie nach dem Neuladen wieder da sind)
   ================================================================ */
function lesGemerkte() {
  try { return JSON.parse(localStorage.getItem(SPEICHER) || '[]'); } catch (e) { return []; }
}
function merkeDir(eintrag) {
  const liste = lesGemerkte();
  if (liste.some((e) => e.id === eintrag.id)) return;
  liste.push(eintrag);
  try { localStorage.setItem(SPEICHER, JSON.stringify(liste)); } catch (e) {}
}
function vergissAlle() {
  try { localStorage.removeItem(SPEICHER); } catch (e) {}
}

/* ================================================================
   ICOSA GALLERY
   ================================================================ */

/** Sucht alle Skizzen von einem Namen */
export async function sucheAufIcosa(name) {
  const antwort = await fetch(`${ICOSA}/assets?authorName=${encodeURIComponent(name)}&pageSize=30`);
  if (!antwort.ok) throw new Error('Icosa antwortet nicht (' + antwort.status + ')');
  const daten = await antwort.json();
  return (daten.assets || []).map(machEintrag).filter((e) => e.glb);
}

/** Holt eine einzelne Skizze über ihre Nummer */
export async function holeVonIcosa(id) {
  const antwort = await fetch(`${ICOSA}/assets/${encodeURIComponent(id)}`);
  if (!antwort.ok) throw new Error('Diese Nummer gibt es nicht (' + antwort.status + ')');
  return machEintrag(await antwort.json());
}

function machEintrag(asset) {
  const formate = asset.formats || [];
  const finde = (art) => {
    const f = formate.find((x) => x.formatType === art && x.root && x.root.url);
    return f ? f.root.url : null;
  };
  return {
    id: asset.assetId,
    name: asset.displayName || 'Ohne Namen',
    autor: asset.authorName || '',
    bild: asset.thumbnail && asset.thumbnail.url,
    glb: finde('GLB') || finde('GLTF2') || finde('GLTF'),
  };
}

/* ================================================================
   BEIM START: alles laden, was zur Welt gehört
   ================================================================ */
export async function holeEigeneSachen(spiel) {
  bauePanel(spiel);
  macheZiehenUndFallen(spiel);

  /* --- 1. die feste Liste aus dem Ordner meine-sachen/ --- */
  try {
    const antwort = await fetch('meine-sachen/liste.json');
    if (antwort.ok) {
      const liste = await antwort.json();
      for (const eintrag of (liste.sachen || [])) {
        try {
          const quelle = eintrag.datei
            ? 'meine-sachen/' + eintrag.datei
            : (await holeVonIcosa(eintrag.icosa)).glb;
          const modell = machePassend(await ladeGlb(quelle), eintrag.groesse || 0.55);
          const richtung = eintrag.ort
            ? new THREE.Vector3(...eintrag.ort).normalize()
            : vorderseite(spiel);
          spiel.planet.stelleAuf(modell, richtung, { einsinken: 0.005 });
        } catch (fehler) {
          console.warn('Konnte', eintrag, 'nicht laden:', fehler.message);
        }
      }
    }
  } catch (e) { /* keine Liste - macht nichts */ }

  /* --- 2. was du dir im Spiel dazugeholt hast --- */
  for (const gemerkt of lesGemerkte()) {
    try {
      const eintrag = await holeVonIcosa(gemerkt.id);
      if (!eintrag.glb) continue;
      const modell = machePassend(await ladeGlb(eintrag.glb), gemerkt.groesse || 0.55);
      spiel.planet.stelleAuf(modell, new THREE.Vector3(...gemerkt.ort).normalize(), { einsinken: 0.005 });
    } catch (fehler) {
      console.warn('Gemerkte Zeichnung konnte nicht geladen werden:', fehler.message);
    }
  }
}

/* ================================================================
   DAS PANEL ZUM SUCHEN
   ================================================================ */
function bauePanel(spiel) {
  const knopf = document.createElement('button');
  knopf.className = 'knopf';
  knopf.textContent = '🎨';
  knopf.title = 'Deine eigenen Zeichnungen';
  document.querySelector('.knoepfe').prepend(knopf);

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="panel-kopf">
      <strong>Deine eigenen Zeichnungen</strong>
      <button class="panel-zu" title="zumachen">✕</button>
    </div>
    <p class="panel-text">
      Mal etwas in <b>Open Brush</b> auf deiner Quest und lade es auf
      <b>Icosa Gallery</b> hoch (oeffentlich!). Dann tippe hier deinen
      Icosa-Namen ein - und deine Zeichnung kommt auf den Planeten.
    </p>
    <div class="panel-zeile">
      <input class="panel-feld" placeholder="dein Name auf Icosa" autocomplete="off">
      <button class="panel-los">suchen</button>
    </div>
    <div class="panel-zeile">
      <input class="panel-feld panel-nummer" placeholder="oder eine Skizzen-Nummer" autocomplete="off">
      <button class="panel-holen">holen</button>
    </div>
    <div class="panel-meldung"></div>
    <div class="panel-liste"></div>
    <p class="panel-text panel-klein">
      Du kannst auch eine .glb Datei einfach in dieses Fenster ziehen.
    </p>
    <button class="panel-leeren">alle meine Zeichnungen wieder wegnehmen</button>
  `;
  document.body.appendChild(panel);

  const feld = panel.querySelector('.panel-feld');
  const nummernFeld = panel.querySelector('.panel-nummer');
  const meldung = panel.querySelector('.panel-meldung');
  const liste = panel.querySelector('.panel-liste');

  knopf.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      const gemerkterName = localStorage.getItem('deine-welt-icosa-name');
      if (gemerkterName) feld.value = gemerkterName;
      feld.focus();
    }
  });
  panel.querySelector('.panel-zu').addEventListener('click', () => { panel.hidden = true; });
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());

  panel.querySelector('.panel-leeren').addEventListener('click', () => {
    vergissAlle();
    meldung.textContent = 'Gemerkt. Nach dem Neuladen sind sie weg.';
  });

  /* --- suchen --- */
  async function suchen() {
    const name = feld.value.trim();
    if (!name) return;
    localStorage.setItem('deine-welt-icosa-name', name);
    meldung.textContent = 'suche...';
    liste.innerHTML = '';
    try {
      const treffer = await sucheAufIcosa(name);
      if (!treffer.length) {
        meldung.textContent = 'Nichts gefunden. Ist die Skizze auf oeffentlich gestellt?';
        return;
      }
      meldung.textContent = treffer.length + ' Zeichnungen gefunden - tippe eine an:';
      for (const eintrag of treffer) zeigeTreffer(eintrag);
    } catch (fehler) {
      meldung.textContent = 'Das hat nicht geklappt: ' + fehler.message;
    }
  }
  panel.querySelector('.panel-los').addEventListener('click', suchen);
  feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') suchen(); });

  /* --- über die Nummer holen --- */
  async function holen() {
    const id = nummernFeld.value.trim();
    if (!id) return;
    meldung.textContent = 'hole...';
    try {
      const eintrag = await holeVonIcosa(id);
      if (!eintrag.glb) { meldung.textContent = 'Diese Skizze hat keine 3D-Datei zum Laden.'; return; }
      liste.innerHTML = '';
      zeigeTreffer(eintrag);
      meldung.textContent = 'Gefunden! Tippe sie an.';
    } catch (fehler) {
      meldung.textContent = 'Das hat nicht geklappt: ' + fehler.message;
    }
  }
  panel.querySelector('.panel-holen').addEventListener('click', holen);
  nummernFeld.addEventListener('keydown', (e) => { if (e.key === 'Enter') holen(); });

  function zeigeTreffer(eintrag) {
    const karte = document.createElement('div');
    karte.className = 'panel-karte';
    karte.innerHTML = `
      ${eintrag.bild ? `<img src="${eintrag.bild}" alt="">` : '<div class="panel-kein-bild">🎨</div>'}
      <span>${eintrag.name}</span>`;
    karte.addEventListener('click', async () => {
      meldung.textContent = 'lade "' + eintrag.name + '" ...';
      try {
        const modell = machePassend(await ladeGlb(eintrag.glb), 0.6);
        const richtung = vorderseite(spiel);
        stelleAufPlanet(spiel, modell, richtung);
        merkeDir({ id: eintrag.id, ort: [richtung.x, richtung.y, richtung.z], groesse: 0.6 });
        meldung.textContent = '"' + eintrag.name + '" steht jetzt auf deinem Planeten!';
        panel.hidden = true;
      } catch (fehler) {
        meldung.textContent = 'Konnte nicht geladen werden: ' + fehler.message;
      }
    });
    liste.appendChild(karte);
  }
}

/* ================================================================
   DATEI INS FENSTER ZIEHEN
   ================================================================ */
function macheZiehenUndFallen(spiel) {
  const halt = (e) => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((art) => {
    document.addEventListener(art, halt, false);
  });
  document.addEventListener('dragover', () => document.body.classList.add('zieht'));
  document.addEventListener('dragleave', () => document.body.classList.remove('zieht'));
  document.addEventListener('drop', async (e) => {
    document.body.classList.remove('zieht');
    const datei = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!datei) return;
    if (!/\.(glb|gltf)$/i.test(datei.name)) {
      spiel.ui.zeigeHinweis('Das muss eine .glb Datei sein');
      setTimeout(() => spiel.ui.zeigeHinweis(''), 3000);
      return;
    }
    const adresse = URL.createObjectURL(datei);
    try {
      const modell = machePassend(await ladeGlb(adresse), 0.6);
      stelleAufPlanet(spiel, modell);
      spiel.ui.zeigeHinweis('"' + datei.name + '" ist jetzt auf dem Planeten!');
      setTimeout(() => spiel.ui.zeigeHinweis(''), 4000);
    } catch (fehler) {
      spiel.ui.zeigeHinweis('Konnte die Datei nicht lesen');
      setTimeout(() => spiel.ui.zeigeHinweis(''), 3000);
    } finally {
      URL.revokeObjectURL(adresse);
    }
  });
}

/* ==================================================================
   VORLAGEN

   Manche Zeichnungen gehören fest zum Spiel und werden viele Male
   gebraucht (zum Beispiel die Blubber-Blume, die beim Gießen
   wächst). Die laden wir einmal und machen dann Kopien davon -
   das ist viel schneller, als sie jedes Mal neu zu laden.
   ================================================================== */

/**
 * Faerbt die braunen Stellen einer Zeichnung nach.
 *
 * Warum? Das gesunde Grasbueschel ist in Open Brush aus dem
 * vertrockneten entstanden - die meisten Striche sind darum noch
 * genauso ockerbraun. Auf dem Planeten sah das gesunde Gras deshalb
 * aus wie vertrocknetes, das sich nicht giessen laesst.
 *
 * Umgefaerbt wird nur, was braun ist (rot mehr als gruen). Das Gruen,
 * das du selbst gemalt hast, bleibt genau so, wie es ist.
 */
function faerbeBraunNach(modell, zielFarbe, staerke = 0.8) {
  const ziel = new THREE.Color(zielFarbe);
  const schonGemacht = new Set();
  modell.traverse((teil) => {
    const farben = teil.isMesh && teil.geometry && teil.geometry.attributes.color;
    if (!farben || schonGemacht.has(farben)) return;
    schonGemacht.add(farben);
    for (let i = 0; i < farben.count; i++) {
      const r = farben.getX(i);
      const g = farben.getY(i);
      const b = farben.getZ(i);
      if (g > r) continue;                    // schon gruen - so lassen
      farben.setX(i, r + (ziel.r - r) * staerke);
      farben.setY(i, g + (ziel.g - g) * staerke);
      farben.setZ(i, b + (ziel.b - b) * staerke);
    }
    farben.needsUpdate = true;
  });
}

export async function ladeVorlage(pfad, hoehe = 0.5, { nachfaerben } = {}) {
  const roh = await ladeGlb(pfad);
  const vorlage = machePassend(roh, hoehe);
  if (nachfaerben) faerbeBraunNach(vorlage, nachfaerben);
  vorlage.updateMatrixWorld(true);

  return function macheKopie() {
    const kopie = vorlage.clone(true);
    kopie.userData = { ...vorlage.userData };
    kopie.userData.belebe = (zeit) => {
      // blubbert sanft vor sich hin
      const b = 1 + Math.sin(zeit * 2.2 + kopie.userData.phase) * 0.05;
      kopie.scale.set(kopie.userData.groesse * (2 - b), kopie.userData.groesse * b, kopie.userData.groesse * (2 - b));
      kopie.rotation.y = Math.sin(zeit * 0.4 + kopie.userData.phase) * 0.25;
    };
    kopie.userData.phase = Math.random() * 6.28;
    kopie.userData.groesse = 1;
    kopie.userData.masse = vorlage.userData.masse;
    kopie.userData.flaecheRadius = vorlage.userData.flaecheRadius;
    kopie.userData.teilWeiten = vorlage.userData.teilWeiten;
    kopie.userData.teilMitten = vorlage.userData.teilMitten;
    return kopie;
  };
}
