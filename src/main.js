/* ==================================================================
   DEINE WELT - Hauptdatei

   Hier wird alles zusammengesetzt:
   die Buehne, der Planet, der Mond - und die Bausteine, mit denen
   die Geschichte in geschichte.js erzaehlt wird.
   ================================================================== */

import * as THREE from 'three';
import { szene, kamera, maler, belebeSterne, passeGroesseAn } from './szene.js';
import { ladeAlleBilder, macheSchnipsel, machWuerfel } from './schnipsel.js';
import { machePlanet, hoeheAn } from './planet.js';
import { baueMond } from './mond.js';
import { baueGras, baueBlume, baueBaum, baueBusch, bauePilz, baueSetzling, baueStein, FARBEN } from './pflanzen.js';
import { baueSchmetterling, baueHaeschen, baueWolke } from './tiere.js';
import { baueGiesskanne, baueSamentuete, baueSchimmer } from './dinge.js';
import * as ui from './ui.js';
import { macheBedienung } from './eingabe.js';
import * as klang from './klang.js';
import { erzaehleGeschichte } from './geschichte.js';
import { holeEigeneSachen, ladeVorlage } from './eigene-sachen.js';

/* ---------- welche Bilder brauchen wir? ---------- */
const BILDER = [
  'blatt-1', 'blatt-2', 'blatt-3', 'blatt-klein', 'halm', 'halm-breit',
  'blueten-blatt', 'klecks', 'streifen', 'auge', 'pupille', 'braue',
  'mund-laecheln', 'mund-o', 'mund-traurig', 'wange', 'fluegel-oben',
  'fluegel-unten', 'ohr', 'tropfen', 'funke', 'glanz', 'krater',
];

/* ================================================================
   AUFBAU
   ================================================================ */
async function los() {
  await ladeAlleBilder(BILDER);

  const wuerfel = machWuerfel(31337);

  /* ---------- Die Blubber-Blumen (selbst gemalt in Open Brush!) ----------
     Es gibt sie zweimal: vertrocknet und aufgebluecht.
     Wenn du eine vertrocknete giesst, verwandelt sie sich.
     Fehlt eine Datei, laeuft das Spiel einfach ohne sie weiter.       */
  let macheBlubberBlume = null;
  let macheTrockeneBlume = null;

  try {
    macheBlubberBlume = await ladeVorlage('meine-sachen/blubber-blume.glb', 0.62);
    console.log('Blubber-Blume ist da!');
  } catch (fehler) {
    console.warn('Blubber-Blume nicht gefunden, macht nichts:', fehler.message);
  }

  // Die vertrocknete ist eine grosse Datei - die holen wir im
  // Hintergrund, damit das Spiel sofort losgehen kann.
  let trockeneBlumenGewuenscht = false;
  ladeVorlage('meine-sachen/blubber-blume-trocken.glb', 0.58)
    .then((fabrik) => {
      macheTrockeneBlume = fabrik;
      console.log('Vertrocknete Blubber-Blume ist da!');
      if (trockeneBlumenGewuenscht) stelleTrockeneBlumenAuf();
    })
    .catch((fehler) => console.warn('Vertrocknete Blume nicht gefunden:', fehler.message));
  const planet = machePlanet();
  szene.add(planet.gruppe);

  /* ---------- der leuchtende Punkt in der Mitte ---------- */
  const kern = new THREE.Group();
  const kernKugel = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.055, 2),
    new THREE.MeshBasicMaterial({ color: 0xfffdf0 })
  );
  kern.add(kernKugel);
  const glanz = macheSchnipsel({ bild: 'glanz', farbe: '#ffffff', hoehe: 1.5, woelbung: 0, durchsichtig: true });
  glanz.material.blending = THREE.AdditiveBlending;
  glanz.material.depthWrite = false;
  glanz.material.opacity = 0.95;
  kern.add(glanz);
  const kernLicht = new THREE.PointLight(0xffe3a0, 2.2, 6, 2);
  kern.add(kernLicht);
  szene.add(kern);

  /* ---------- der Mond ---------- */
  const mond = baueMond();
  mond.position.set(0, 0, -3);
  szene.add(mond);

  const mondBahn = {
    winkel: 0,
    radius: 1.9,
    neigung: 0.42,
    geschwindigkeit: 0.19,
    modus: 'bahn',        // 'bahn' oder 'buehne'
    buehneSeite: 1,
  };

  /* ---------- Schmetterlinge fliegen frei um den Planeten ---------- */
  const falter = [];

  /* ================================================================
     DIE BAUSTEINE FUER DIE GESCHICHTE
     ================================================================ */

  let wartendeAufgabe = null;      // auf welches Ereignis warten wir?
  let streichelZaehler = 0;
  const zustand = {
    schlaeft: true,
    kapitel: 0,
    zeit: 0,
    gegossen: 0,
    gepflanzt: 0,
  };

  /* --- Der Mond sagt etwas (und wartet, bis man weitertippt) --- */
  function mondSagt(saetze, gefuehl = 'normal') {
    const liste = Array.isArray(saetze) ? saetze : [saetze];
    return new Promise((fertig) => {
      mondBahn.modus = 'buehne';
      mond.setzeGefuehl(gefuehl);
      let i = 0;

      const zeigeSatz = () => {
        mond.redeAn(true);
        ui.sagText(liste[i], {
          beiFertig: () => mond.redeAn(false),
        });
        ui.zeigeHinweis(i < liste.length - 1 ? 'tippe die Blase an' : '');
      };

      wartendeAufgabe = {
        art: 'blase',
        weiter: () => {
          const was = ui.blaseAntippen();
          if (was === 'fertiggeschrieben') return;
          i++;
          if (i < liste.length) {
            zeigeSatz();
          } else {
            mond.redeAn(false);
            ui.versteckBlase();
            ui.zeigeHinweis('');
            wartendeAufgabe = null;
            mondBahn.modus = 'bahn';
            fertig();
          }
        },
      };
      zeigeSatz();
    });
  }

  /* --- Warte, bis der Spieler etwas Bestimmtes antippt --- */
  function warteAufTipp(typen, hinweis) {
    const erlaubt = Array.isArray(typen) ? typen : [typen];
    ui.zeigeHinweis(hinweis || '');
    return new Promise((fertig) => {
      wartendeAufgabe = {
        art: 'tipp',
        typen: erlaubt,
        treffer: (info) => {
          ui.zeigeHinweis('');
          wartendeAufgabe = null;
          fertig(info);
        },
      };
    });
  }

  /* --- Warte, bis der Spieler genug gestreichelt hat --- */
  function warteAufStreicheln(anzahl, hinweis) {
    streichelZaehler = 0;
    ui.zeigeHinweis(hinweis || 'streichel ihn');
    bedienung.erlaubeStreicheln(true);
    return new Promise((fertig) => {
      wartendeAufgabe = {
        art: 'streicheln',
        ziel: anzahl,
        fertig: () => {
          bedienung.erlaubeStreicheln(false);
          ui.zeigeHinweis('');
          wartendeAufgabe = null;
          fertig();
        },
      };
    });
  }

  /* --- kurz warten --- */
  const warte = (sekunden) => new Promise((f) => setTimeout(f, sekunden * 1000));

  /* --- Warte, bis etwas Bestimmtes passiert ist.
         Waehrend dieser Zeit darf man frei spielen (giessen, pflanzen). --- */
  function warteBis(bedingung, hinweis) {
    ui.zeigeHinweis(hinweis || '');
    return new Promise((fertig) => {
      const pruefen = setInterval(() => {
        if (bedingung()) {
          clearInterval(pruefen);
          ui.zeigeHinweis('');
          fertig();
        }
      }, 200);
    });
  }

  /* --- Wie viele Dinge dieser Art stehen auf dem Planeten? --- */
  function zaehle(typ) {
    return planet.aufgestellt.filter((o) => o.userData.typ === typ).length;
  }

  /* --- Die Welt wacht auf --- */
  function weckeWelt() {
    zustand.schlaeft = false;
    klang.klangErwachen();
    ui.versteckTitel();
  }

  /* --- Der Planet erscheint --- */
  function zeigePlanet(radius = 0.62) {
    planet.setzeRadius(0.02);
    planet.wachseAuf(radius);
    klang.klangWachsen();
  }

  /* --- Die Welt wird ein Stueck groesser --- */
  function lasseWeltWachsen(um = 0.075) {
    planet.wachseAuf(planet.zielRadius + um);
    klang.klangWachsen();
    ui.gibStern();
    speichere();
  }

  /* --- Funken an einer Stelle im Raum --- */
  function funkeBei(weltOrt, anzahl = 6) {
    const bildschirm = weltOrt.clone().project(kamera);
    const x = (bildschirm.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-bildschirm.y * 0.5 + 0.5) * window.innerHeight;
    for (let i = 0; i < anzahl; i++) {
      setTimeout(() => {
        ui.funkeAmBildschirm(
          x + (Math.random() - 0.5) * 70,
          y + (Math.random() - 0.5) * 70,
          Math.random() > 0.5 ? '✨' : '💚'
        );
      }, i * 70);
    }
  }

  /* ================================================================
     BEDIENUNG
     ================================================================ */
  const bedienung = macheBedienung({
    planetGruppe: planet.gruppe,
    szene,
    beiTipp: ({ treffer, x, y }) => {
      klang.weckeTon();
      if (!wartendeAufgabe) {
        // freies Spiel: giessen oder pflanzen, wenn ein Werkzeug in der Hand ist
        freiesSpiel(treffer, x, y);
        return;
      }
      // Der Mond redet: einmal tippen schreibt den Satz fertig,
      // nochmal tippen bringt den naechsten. Man darf dafuer ueberall
      // hintippen, nicht nur genau auf die Blase.
      if (wartendeAufgabe.art === 'blase') {
        wartendeAufgabe.weiter();
        return;
      }
      if (wartendeAufgabe.art === 'tipp') {
        const typ = treffer && treffer.ding.userData.typ;
        // Am Anfang ist der Kern der "Punkt"
        const passt = treffer && wartendeAufgabe.typen.includes(typ);
        if (passt) {
          wartendeAufgabe.treffer(treffer);
        } else {
          // daneben getippt: ein kleiner Funke und der Hinweis bleibt
          ui.funkeAmBildschirm(x, y, '·');
        }
      }
    },
    beiStreicheln: ({ treffer, x, y }) => {
      if (!wartendeAufgabe || wartendeAufgabe.art !== 'streicheln') return;
      if (!treffer) return;
      const typ = treffer.ding.userData.typ;
      if (typ !== 'kern' && typ !== 'boden') return;
      streichelZaehler++;
      klang.klangStreicheln();
      ui.funkeAmBildschirm(x, y, streichelZaehler % 2 ? '💛' : '✨');
      // der Kern reagiert: er wird kurz heller
      kernKugel.scale.setScalar(1 + 0.25 * Math.sin(streichelZaehler));
      if (streichelZaehler >= wartendeAufgabe.ziel) wartendeAufgabe.fertig();
    },
  });

  // Ein Klick direkt auf die Sprechblase blaettert auch weiter
  ui.blaseAngetippt(() => {
    if (wartendeAufgabe && wartendeAufgabe.art === 'blase') wartendeAufgabe.weiter();
  });

  // Der leuchtende Punkt soll antippbar und streichelbar sein
  kern.userData.typ = 'kern';
  kern.userData.antippbar = true;
  kernKugel.userData.typ = 'kern';

  /* ================================================================
     FREIES SPIEL - giessen und pflanzen, wann man will
     ================================================================ */
  function freiesSpiel(treffer, x, y) {
    if (!treffer) return;
    const werkzeug = ui.werkzeugInDerHand();
    const typ = treffer.ding.userData.typ;

    if (werkzeug === 'giesskanne'
        && (typ === 'boden' || typ === 'gras-trocken' || typ === 'setzling' || typ === 'blubber-trocken')) {
      giesseAn(treffer);
      return;
    }
    if (werkzeug === 'samentuete' && typ === 'boden') {
      pflanzeBlumeAn(treffer);
      return;
    }
    if (typ === 'blubber-trocken') {
      ui.zeigeHinweis('die braucht Wasser - nimm die Giesskanne');
      setTimeout(() => ui.zeigeHinweis(''), 2500);
      return;
    }
    if (typ === 'blubber-blume') {
      klang.klangFunke();
      ui.funkeAmBildschirm(x, y, '🫧');
      return;
    }
    if (typ === 'haeschen') {
      klang.klangTier();
      ui.funkeAmBildschirm(x, y, '💚');
      return;
    }
    if (typ === 'mond') {
      plaudereMitDemMond();
    }
  }

  /* --- Giessen --- */
  function giesseAn(treffer) {
    const lokal = planet.gruppe.worldToLocal(treffer.punkt.clone()).normalize();
    planet.maleGruen(lokal, 0.34, 0.85);
    klang.klangGiessen();
    macheRegenTropfen(treffer.punkt);
    zustand.gegossen++;

    // trockenes Gras an dieser Stelle wird gesund
    const trockene = planet.aufgestellt.filter((o) =>
      o.userData.typ === 'gras-trocken' && o.userData.richtung.distanceTo(lokal) < 0.36);
    for (const alt of trockene) tauscheGrasAus(alt);
    // vertrocknete Blubber-Blumen bluehen wieder auf
    const welke = planet.aufgestellt.filter((o) =>
      o.userData.typ === 'blubber-trocken' && o.userData.richtung.distanceTo(lokal) < 0.4);
    for (const w of welke) verwandleBlume(w);

    // und aus dem gewaesserten Boden blubbert eine neue Blume hervor
    if (trockene.length > 0 && welke.length === 0) pflanzeBlubberBlume(lokal);
    // ein Setzling wird zum Baum
    const setzlinge = planet.aufgestellt.filter((o) =>
      o.userData.typ === 'setzling' && o.userData.richtung.distanceTo(lokal) < 0.3);
    for (const s of setzlinge) macheBaumAus(s);
    speichere();
  }

  function tauscheGrasAus(altesGras) {
    const richtung = altesGras.userData.richtung.clone();
    planet.nimmWeg(altesGras);
    const neu = baueGras({ groesse: 1, trocken: false, startzahl: Math.floor(wuerfel(1, 9999)) });
    neu.scale.setScalar(0.2);
    planet.stelleAuf(neu, richtung, { einsinken: 0.015 });
    lassWachsen(neu, 1);
    funkeBei(neu.getWorldPosition(new THREE.Vector3()), 4);
  }

  function macheBaumAus(setzling) {
    const richtung = setzling.userData.richtung.clone();
    planet.nimmWeg(setzling);
    const baum = baueBaum({ groesse: 0.9, startzahl: Math.floor(wuerfel(1, 9999)) });
    baum.scale.setScalar(0.15);
    planet.stelleAuf(baum, richtung, { einsinken: 0.02 });
    lassWachsen(baum, 1, 1.6);
    klang.klangWachsen();
    funkeBei(baum.getWorldPosition(new THREE.Vector3()), 8);
  }

  /* --- Die vertrockneten Blubber-Blumen hinstellen --- */
  // Die vertrocknete Blubber-Blume ist eine sehr aufwendige Zeichnung
  // (63.000 Dreiecke), darum stehen vier davon auf dem Planeten - so
  // bleibt es auch auf dem Handy fluessig.
  const TROCKENE_BLUMEN_ORTE = [
    [0.55, 0.36, 0.75], [-0.62, 0.3, 0.72],
    [0.2, -0.5, 0.84], [-0.35, 0.72, -0.6],
  ];
  let trockeneBlumenStehen = false;
  function stelleTrockeneBlumenAuf() {
    trockeneBlumenGewuenscht = true;
    if (!macheTrockeneBlume || trockeneBlumenStehen) return;
    trockeneBlumenStehen = true;
    TROCKENE_BLUMEN_ORTE.forEach((ort, i) => {
      const blume = macheTrockeneBlume();
      blume.userData.typ = 'blubber-trocken';
      blume.userData.antippbar = true;
      planet.stelleAuf(blume, new THREE.Vector3(...ort).normalize(),
                       { einsinken: 0.004, drehung: i * 1.2 });
    });
  }

  /* --- Aus vertrocknet wird aufgebluecht --- */
  function verwandleBlume(alteBlume) {
    const richtung = alteBlume.userData.richtung.clone();
    const drehung = alteBlume.userData.eigenDrehung || 0;
    planet.nimmWeg(alteBlume);
    if (!macheBlubberBlume) return null;
    const neue = macheBlubberBlume();
    neue.userData.typ = 'blubber-blume';
    neue.userData.antippbar = true;
    neue.scale.setScalar(0.02);
    planet.stelleAuf(neue, richtung, { einsinken: 0.004, drehung });
    lassWachsen(neue, 1, 1.4);
    klang.klangWachsen();
    funkeBei(neue.getWorldPosition(new THREE.Vector3()), 10);
    return neue;
  }

  /* --- Die selbst gemalte Blubber-Blume waechst aus dem nassen Boden --- */
  function pflanzeBlubberBlume(lokaleRichtung) {
    if (!macheBlubberBlume) return null;
    // ein bisschen neben die Stelle, damit sie nicht im Gras steckt
    const daneben = lokaleRichtung.clone()
      .add(new THREE.Vector3(wuerfel(-0.13, 0.13), wuerfel(-0.13, 0.13), wuerfel(-0.13, 0.13)))
      .normalize();
    const blume = macheBlubberBlume();
    blume.userData.typ = 'blubber-blume';
    blume.userData.antippbar = true;
    blume.scale.setScalar(0.02);
    planet.stelleAuf(blume, daneben, { einsinken: 0.004, drehung: wuerfel(0, 6.28) });
    lassWachsen(blume, 1, 1.5);
    klang.klangFunke();
    funkeBei(blume.getWorldPosition(new THREE.Vector3()), 5);
    return blume;
  }

  function pflanzeBlumeAn(treffer) {
    const lokal = planet.gruppe.worldToLocal(treffer.punkt.clone()).normalize();
    // jede dritte Blume ist eine selbst gemalte Blubber-Blume
    if (macheBlubberBlume && zustand.gepflanzt % 3 === 2) {
      const b = pflanzeBlubberBlume(lokal);
      if (b) {
        planet.maleGruen(lokal, 0.2, 0.5);
        zustand.gepflanzt++;
        speichere();
        return;
      }
    }
    const sorten = Object.keys(FARBEN.blueten);
    const blume = baueBlume({
      groesse: 0.85,
      sorte: sorten[Math.floor(wuerfel(0, sorten.length))],
      startzahl: Math.floor(wuerfel(1, 9999)),
    });
    blume.scale.setScalar(0.1);
    planet.stelleAuf(blume, lokal, { einsinken: 0.01, drehung: wuerfel(0, 6.28) });
    lassWachsen(blume, 1, 1.1);
    planet.maleGruen(lokal, 0.2, 0.5);
    klang.klangPlopp();
    klang.klangFunke();
    zustand.gepflanzt++;
    funkeBei(blume.getWorldPosition(new THREE.Vector3()), 4);
    speichere();
  }

  /* --- etwas waechst aus dem Boden --- */
  const wachsende = [];
  function lassWachsen(objekt, zielGroesse = 1, dauer = 1) {
    wachsende.push({ objekt, ziel: zielGroesse, zeit: 0, dauer });
  }

  /* --- Regentropfen beim Giessen --- */
  const tropfenFlug = [];
  function macheRegenTropfen(weltOrt) {
    for (let i = 0; i < 7; i++) {
      const t = macheSchnipsel({ bild: 'tropfen', farbe: '#8ed8f5', hoehe: 0.07, woelbung: 0.01 });
      const start = weltOrt.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.3, 0.55 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3
      ));
      t.position.copy(start);
      szene.add(t);
      tropfenFlug.push({ netz: t, ziel: weltOrt.clone(), zeit: -i * 0.06, dauer: 0.45 });
    }
  }

  /* --- Mit dem Mond plaudern (im freien Spiel) --- */
  const mondSprueche = [
    'Schau nur, wie gruen es geworden ist. Das hast du gemacht.',
    'Manchmal setze ich mich einfach hin und schaue zu, wie es waechst.',
    'Weisst du was? Der Planet summt jetzt manchmal. Ganz leise.',
    'Ich bin froh, dass du da bist.',
    'Wenn du willst, giesse noch ein bisschen. Er mag das sehr.',
  ];
  let spruchNummer = 0;
  async function plaudereMitDemMond() {
    if (wartendeAufgabe) return;
    const spruch = mondSprueche[spruchNummer % mondSprueche.length];
    spruchNummer++;
    await mondSagt([spruch], 'gluecklich');
  }

  /* ================================================================
     SPEICHERN
     ================================================================ */
  const SPEICHER = 'deine-welt-fortschritt';
  function speichere() {
    try {
      localStorage.setItem(SPEICHER, JSON.stringify({
        kapitel: zustand.kapitel,
        radius: planet.zielRadius,
        gegossen: zustand.gegossen,
        gepflanzt: zustand.gepflanzt,
      }));
    } catch (e) { /* macht nichts */ }
  }
  function ladeFortschritt() {
    try {
      return JSON.parse(localStorage.getItem(SPEICHER) || 'null');
    } catch (e) { return null; }
  }

  /* ================================================================
     DAS SPIEL-OBJEKT, das die Geschichte benutzt
     ================================================================ */
  const spiel = {
    THREE, szene, kamera, planet, mond, kern, wuerfel, zustand,
    ui, klang, bedienung, mondBahn, falter,
    mondSagt, warteAufTipp, warteAufStreicheln, warte, warteBis, zaehle,
    weckeWelt, zeigePlanet, lasseWeltWachsen, funkeBei,
    lassWachsen, tauscheGrasAus, macheBaumAus, speichere, pflanzeBlubberBlume,
    giesseAn, pflanzeBlumeAn, freiesSpiel,
    stelleTrockeneBlumenAuf, verwandleBlume,
    bauer: { baueGras, baueBlume, baueBaum, baueBusch, bauePilz, baueSetzling, baueStein,
             baueSchmetterling, baueHaeschen, baueWolke, baueGiesskanne, baueSamentuete, baueSchimmer },
    setzeKapitel(n) { zustand.kapitel = n; speichere(); },
  };

  // Damit man in der Browser-Konsole rumprobieren kann, z.B.:
  //   spiel.lasseWeltWachsen(0.2)
  //   spiel.planet.maleGruen(new THREE.Vector3(0,1,0), 1, 1)
  window.spiel = spiel;

  /* ================================================================
     KNOEPFE
     ================================================================ */
  const knopfTon = document.getElementById('knopf-ton');
  knopfTon.addEventListener('click', () => {
    const an = klang.schalteTon(!klang.tonAn);
    knopfTon.textContent = an ? '🔊' : '🔇';
  });
  document.getElementById('knopf-neu').addEventListener('click', () => {
    if (confirm('Willst du wirklich ganz von vorne anfangen?')) {
      localStorage.removeItem(SPEICHER);
      location.reload();
    }
  });

  /* ================================================================
     JEDES BILD NEU MALEN
     ================================================================ */
  const uhr = new THREE.Clock();
  const mondOrt = new THREE.Vector3();
  let kameraAbstand = 4.6;

  function bild() {
    const schritt = Math.min(uhr.getDelta(), 0.05);
    const zeit = zustand.zeit += schritt;

    belebeSterne(zeit);
    bedienung.belebe(schritt);
    planet.belebe(zeit, schritt);

    /* --- der leuchtende Punkt --- */
    const puls = 1 + Math.sin(zeit * 1.8) * 0.12 + Math.sin(zeit * 4.3) * 0.05;
    glanz.scale.setScalar(zustand.schlaeft ? puls * 0.95 : puls * 0.55);
    glanz.lookAt(kamera.position);
    kernLicht.intensity = zustand.schlaeft ? 2.2 * puls : 0.7 * puls;
    kernKugel.visible = planet.radius < 0.2;
    kernKugel.scale.setScalar(THREE.MathUtils.lerp(kernKugel.scale.x, puls, 0.1));
    glanz.material.opacity = zustand.schlaeft ? 0.95 : Math.max(0, 0.5 - planet.radius * 0.5);

    /* --- Mondbahn --- */
    if (mondBahn.modus === 'bahn') {
      mondBahn.winkel += schritt * mondBahn.geschwindigkeit;
      const r = Math.max(1.75, planet.radius * 2.1 + 1.35);
      // Die Bahn ist nach vorne gezogen und geneigt: so verschwindet
      // der Mond nie lange hinter dem Planeten.
      const ziel = new THREE.Vector3(
        Math.cos(mondBahn.winkel) * r,
        Math.sin(mondBahn.winkel * 1.3) * r * mondBahn.neigung,
        Math.sin(mondBahn.winkel) * r * 0.45 + r * 0.3
      );
      mond.position.lerp(ziel, 1 - Math.pow(0.02, schritt));
    } else {
      // Buehne: gut sichtbar vor der Kamera, etwas zur Seite
      const ziel = kamera.localToWorld(new THREE.Vector3(
        1.0 * mondBahn.buehneSeite, 0.18, -3.1
      ));
      mond.position.lerp(ziel, 1 - Math.pow(0.004, schritt));
      // Die Sprechblase folgt dem Mond
      mond.getWorldPosition(mondOrt);
      const p = mondOrt.clone().project(kamera);
      ui.setzeBlaseAn(
        (p.x * 0.5 + 0.5) * window.innerWidth,
        (-p.y * 0.5 + 0.5) * window.innerHeight - 150
      );
    }
    if (mond.userData.belebe) mond.userData.belebe(zeit, schritt, kamera.position);

    /* --- Schmetterlinge --- */
    for (const f of falter) {
      const d = f.userData.flug;
      d.winkel += schritt * d.tempo;
      const r = planet.radius + d.hoehe;
      const ziel = new THREE.Vector3(
        Math.cos(d.winkel) * r * Math.cos(d.neigung),
        Math.sin(d.winkel * 0.8 + d.phase) * r * 0.55,
        Math.sin(d.winkel) * r * Math.cos(d.neigung)
      );
      f.position.lerp(ziel, 1 - Math.pow(0.05, schritt));
      f.lookAt(f.position.clone().add(
        new THREE.Vector3(-Math.sin(d.winkel), 0, Math.cos(d.winkel))
      ));
      if (f.userData.belebe) f.userData.belebe(zeit, schritt);
    }

    /* --- Sachen, die gerade wachsen --- */
    for (let i = wachsende.length - 1; i >= 0; i--) {
      const w = wachsende[i];
      w.zeit += schritt;
      const t = Math.min(1, w.zeit / w.dauer);
      // erst schnell, dann federt es kurz nach
      const federn = 1 + Math.sin(t * Math.PI * 1.2) * 0.16 * (1 - t);
      w.objekt.scale.setScalar(w.ziel * t * federn);
      if (t >= 1) {
        w.objekt.scale.setScalar(w.ziel);
        wachsende.splice(i, 1);
      }
    }

    /* --- fliegende Wassertropfen --- */
    for (let i = tropfenFlug.length - 1; i >= 0; i--) {
      const t = tropfenFlug[i];
      t.zeit += schritt;
      if (t.zeit < 0) { t.netz.visible = false; continue; }
      t.netz.visible = true;
      const f = Math.min(1, t.zeit / t.dauer);
      t.netz.position.lerpVectors(t.netz.position, t.ziel, 0.25);
      t.netz.scale.setScalar(1 - f * 0.7);
      t.netz.lookAt(kamera.position);
      if (f >= 1) {
        szene.remove(t.netz);
        tropfenFlug.splice(i, 1);
      }
    }

    /* --- Kamera weicht zurueck, wenn die Welt waechst --- */
    const zielAbstand = zustand.schlaeft ? 4.6 : 2.05 + planet.radius * 2.5;
    kameraAbstand = THREE.MathUtils.lerp(kameraAbstand, zielAbstand, 1 - Math.pow(0.2, schritt));
    kamera.position.set(0, kameraAbstand * 0.16, kameraAbstand);
    kamera.lookAt(0, 0, 0);

    maler.render(szene, kamera);
    requestAnimationFrame(bild);
  }

  passeGroesseAn();
  bild();

  /* ================================================================
     LOS GEHT'S
     ================================================================ */
  const gespeichert = ladeFortschritt();
  await holeEigeneSachen(spiel);            // eigene Zeichnungen einbauen
  erzaehleGeschichte(spiel, gespeichert);
}

los().catch((fehler) => {
  console.error(fehler);
  document.body.insertAdjacentHTML('beforeend',
    `<div class="fehler">Oh nein, etwas ist schiefgegangen:<br><br>
     <code style="font-size:13px;opacity:.8">${fehler.message}</code></div>`);
});
