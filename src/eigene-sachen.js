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
      Dann gehoert sie fest zum Spiel - auch fuer alle anderen.
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
 * Hier werden sie auf eine gute Groesse gebracht und so verschoben,
 * dass sie mit den Fuessen auf dem Boden stehen.
 */
function machePassend(modell, zielHoehe = 0.55) {
  /* Open-Brush-Zeichnungen brauchen eine kleine Kur, damit sie hier
     genauso aussehen wie in der Brille:

     - metalness: glTF sagt standardmaessig "das ist Metall". Ohne eine
       Spiegel-Umgebung wird Metall aber pechschwarz. Also: kein Metall.
     - schwarze Grundfarbe: manche Pinsel bringen color = schwarz mit.
       Weil die echte Farbe in den Ecken (vertex colors) steckt, wuerde
       schwarz alles ausloeschen. Also auf weiss setzen.
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
      // schwarze Grundfarbe wuerde die Eckenfarben ausloeschen
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

  const kasten = new THREE.Box3().setFromObject(modell);
  const groesse = kasten.getSize(new THREE.Vector3());
  const groesste = Math.max(groesse.x, groesse.y, groesse.z) || 1;
  const faktor = zielHoehe / groesste;

  const huelle = new THREE.Group();
  modell.scale.setScalar(faktor);
  // in die Mitte ruecken und auf den Boden stellen
  const mitte = kasten.getCenter(new THREE.Vector3()).multiplyScalar(faktor);
  modell.position.set(-mitte.x, -kasten.min.y * faktor, -mitte.z);
  huelle.add(modell);

  huelle.userData.typ = 'eigene-zeichnung';
  huelle.userData.antippbar = true;
  huelle.userData.hoehe = zielHoehe;
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

/** Die Stelle, die gerade zu dir zeigt */
function vorderseite(spiel) {
  const welt = new THREE.Vector3(0, 0.3, 1).normalize();
  return spiel.planet.gruppe.worldToLocal(welt.clone()).normalize();
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

/** Holt eine einzelne Skizze ueber ihre Nummer */
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
   BEIM START: alles laden, was zur Welt gehoert
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

  /* --- ueber die Nummer holen --- */
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

   Manche Zeichnungen gehoeren fest zum Spiel und werden viele Male
   gebraucht (zum Beispiel die Blubber-Blume, die beim Giessen
   waechst). Die laden wir einmal und machen dann Kopien davon -
   das ist viel schneller, als sie jedes Mal neu zu laden.
   ================================================================== */

export async function ladeVorlage(pfad, hoehe = 0.5) {
  const roh = await ladeGlb(pfad);
  const vorlage = machePassend(roh, hoehe);
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
    return kopie;
  };
}
