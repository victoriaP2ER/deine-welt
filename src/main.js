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
  // Der Lichtschein ist viel groesser als der Punkt selbst. Wuerde er
  // Fingertipps abfangen, koennte man den Mond dahinter nicht antippen.
  glanz.raycast = () => {};
  kern.add(glanz);

  // Ein unsichtbarer Ball um den Punkt: er macht das Licht gut
  // treffbar, ohne dass man ihn sieht.
  const kernKlickBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  kern.add(kernKlickBall);
  const kernLicht = new THREE.PointLight(0xffe3a0, 2.2, 6, 2);
  kern.add(kernLicht);
  szene.add(kern);

  /* ---------- der Mond ---------- */
  const mond = baueMond();
  mond.position.set(0, 0, -3);
  szene.add(mond);

  const mondBahn = {
    winkel: 0,
    neigung: 0.5,
    geschwindigkeit: 0.15,
    erzaehlNaehe: 0,     // 0 = normale Bahn, 1 = kommt zum Erzaehlen naeher
  };

  /* ---------- DER BLICK: wo ist die Kamera, wohin schaut sie? ----------
     Die Kamera haengt an einem unsichtbaren Faden um den Planeten.
     "seite" und "hoch" sind die Winkel, "abstand" die Entfernung.
     Beim Wischen aendern sich die Winkel - dadurch fliegt die Kamera
     um den Planeten herum und die Sterne ziehen vorbei.               */
  const blick = {
    seite: 0,
    hoch: 0.16,
    abstand: 4.6,
    zielAbstand: 4.6,
    schwungSeite: 0,
    schwungHoch: 0,
    griffRadius: 0.7,   // wie gross der Planet gerade ist (fuer 1:1-Gefuehl)
    ziel: new THREE.Vector3(0, 0, 0),        // wohin die Kamera schaut
    zielZiel: new THREE.Vector3(0, 0, 0),    // wohin sie schauen soll
    schautZuLunix: false,
  };

  /** Setzt die Kamera aus den Winkeln zusammen. */
  function stelleKameraEin() {
    const r = blick.abstand;
    kamera.position.set(
      Math.cos(blick.hoch) * Math.sin(blick.seite) * r,
      Math.sin(blick.hoch) * r,
      Math.cos(blick.hoch) * Math.cos(blick.seite) * r
    );
    kamera.lookAt(blick.ziel);
  }
  stelleKameraEin();

  /* ---------- Schmetterlinge fliegen frei um den Planeten ---------- */
  const falter = [];

  /* ================================================================
     DEINE SELBST GEMALTEN SACHEN (aus Open Brush)

     Alle deine Zeichnungen zusammen sind ueber 20 MB gross. Wuerden
     wir sie alle beim Start laden, muesste man auf dem Handy lange
     warten. Darum:

       - das Gras kommt im Hintergrund gleich mit (das braucht man
         schon im zweiten Kapitel)
       - alles andere wird erst geholt, wenn die Geschichte es braucht

     Fehlt eine Datei, laeuft das Spiel einfach mit den
     Papier-Bastelmodellen weiter.
     ================================================================ */
  // Die zweite Zahl ist die Hoehe auf dem Planeten.
  // Vertrocknet ist absichtlich viel kleiner als gesund - dann sieht
  // man beim Giessen richtig, wie es aufwaechst.
  const DATEIEN = {
    grasTrocken:  ['meine-sachen/gras-trocken.glb', 0.13],
    grasGesund:   ['meine-sachen/gras-gesund.glb', 0.27],
    blumeTrocken: ['meine-sachen/blubber-blume-trocken.glb', 0.2],
    blumeGesund:  ['meine-sachen/blubber-blume.glb', 0.48],
    baumTrocken:  ['meine-sachen/apfelbaum-trocken.glb', 0.5],
    baumGesund:   ['meine-sachen/apfelbaum.glb', 1.2],
  };

  const eigene = {};            // name -> Fabrik, die Kopien macht
  const amLaden = {};           // name -> Versprechen, dass es kommt

  /**
   * Holt eine deiner Zeichnungen. Beim ersten Mal wird sie aus dem
   * Netz geladen, danach ist sie sofort da.
   */
  function holeVorlage(name) {
    if (eigene[name]) return Promise.resolve(eigene[name]);
    if (amLaden[name]) return amLaden[name];
    const [datei, hoehe] = DATEIEN[name] || [];
    if (!datei) return Promise.resolve(null);

    amLaden[name] = ladeVorlage(datei, hoehe)
      .then((fabrik) => {
        eigene[name] = fabrik;
        console.log('deine Zeichnung ist da:', name);
        if (name === 'grasTrocken' || name === 'grasGesund') tauscheGrasGegenDeineZeichnung();
        return fabrik;
      })
      .catch((fehler) => {
        console.warn('nicht gefunden (macht nichts):', datei, fehler.message);
        return null;
      });
    return amLaden[name];
  }

  // Das Gras schon mal im Hintergrund holen
  holeVorlage('grasTrocken').then(() => holeVorlage('grasGesund'));

  let trockeneBlumenGewuenscht = false;

  /* --- Ein Grasbueschel bauen: deine Zeichnung, wenn sie schon da ist --- */
  function machGras(trocken, startzahl) {
    const fabrik = trocken ? eigene.grasTrocken : eigene.grasGesund;
    if (fabrik) {
      const g = fabrik();
      g.userData.typ = trocken ? 'gras-trocken' : 'gras-gesund';
      g.userData.antippbar = trocken;
      g.userData.eigeneZeichnung = true;
      return g;
    }
    return baueGras({ groesse: 1, trocken, startzahl });
  }

  /* --- Papier-Gras gegen deine Zeichnungen tauschen --- */
  function tauscheGrasGegenDeineZeichnung() {
    const alte = planet.aufgestellt.filter((o) =>
      (o.userData.typ === 'gras-trocken' || o.userData.typ === 'gras-gesund')
      && !o.userData.eigeneZeichnung);
    for (const alt of alte) {
      const trocken = alt.userData.typ === 'gras-trocken';
      if (trocken && !eigene.grasTrocken) continue;
      if (!trocken && !eigene.grasGesund) continue;
      const richtung = alt.userData.richtung.clone();
      const drehung = alt.userData.eigenDrehung || 0;
      planet.nimmWeg(alt);
      const neu = machGras(trocken, 1);
      planet.stelleAuf(neu, richtung, { einsinken: 0.01, drehung });
    }
  }

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
    guteTaten: 0,
  };

  /* --- Der Mond sagt etwas (und wartet, bis man weitertippt) --- */
  function mondSagt(saetze, gefuehl = 'normal') {
    const liste = Array.isArray(saetze) ? saetze : [saetze];
    return new Promise((fertig) => {
      blick.schautZuLunix = true;      // die Kamera schwenkt zu ihm hoch
      mond.setzeGefuehl(gefuehl);
      let i = 0;

      const zeigeSatz = () => {
        mond.redeAn(true);
        ui.sagText(liste[i], {
          beiFertig: () => mond.redeAn(false),
        });
        // Unten steht ein weiter-Knopf. Man kann ihn antippen, die
        // Sprechblase, oder einfach irgendwo aufs Bild - alles geht.
        ui.zeigeWeiterHinweis('', () => {
          if (wartendeAufgabe && wartendeAufgabe.art === 'blase') wartendeAufgabe.weiter();
        });
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
            blick.schautZuLunix = false;   // und wieder runter zur Welt
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

  /* --- PAUSE ZUM UMSEHEN -------------------------------------------
     Nach einem schoenen Moment: in Ruhe umschauen, herumfliegen,
     Toene spielen. Weiter geht es erst, wenn man den weiter-Knopf
     oder Lunix antippt.                                            */
  function warteAufUmsehen(hinweis = 'schau dich ruhig um') {
    return new Promise((fertig) => {
      const fertigMachen = () => {
        ui.versteckWeiterHinweis();
        wartendeAufgabe = null;
        fertig();
      };
      ui.zeigeWeiterHinweis(hinweis, fertigMachen);
      wartendeAufgabe = {
        art: 'tipp',
        typen: ['mond'],
        treffer: fertigMachen,
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
    klang.starteMusik();        // ab jetzt spielt die Weltraum-Musik
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

  /* --- GUTE TATEN ---------------------------------------------------
     Jedes Giessen und jedes Pflanzen ist eine gute Tat. Nach jeder
     vierten waechst der Planet ein Stueck weiter - dann hat man
     wieder Platz fuer Neues und kann immer weitermachen.
     Je groesser er schon ist, desto gemuetlicher waechst er.       */
  function guteTat() {
    zustand.guteTaten = (zustand.guteTaten || 0) + 1;
    if (zustand.guteTaten % 4 !== 0) { speichere(); return; }

    const r = planet.zielRadius;
    const um = r < 1.4 ? 0.075 : r < 2.2 ? 0.05 : 0.03;
    planet.wachseAuf(r + um);
    klang.klangWachsen();
    ui.zeigeHinweis('Der Planet ist gewachsen! Jetzt ist wieder Platz.');
    setTimeout(() => ui.zeigeHinweis(''), 3500);
    // ein paar Funken rundherum, damit man es merkt
    for (let i = 0; i < 8; i++) {
      setTimeout(() => ui.funkeAmBildschirm(
        window.innerWidth * (0.2 + Math.random() * 0.6),
        window.innerHeight * (0.3 + Math.random() * 0.4),
        Math.random() > 0.5 ? '✨' : '🌱'), i * 90);
    }
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
    blick,
    szene,
    // Der Magnet braucht die Liste der antippbaren Dinge
    antippbareDinge: () => planet.aufgestellt.filter((o) => o.userData.antippbar),
    beiTipp: ({ treffer, x, y }) => {
      klang.weckeTon();
      // Musik anwerfen (passiert nur beim ersten Mal etwas)
      if (!zustand.schlaeft) klang.starteMusik();
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
        const passt = treffer && wartendeAufgabe.typen.includes(typ);
        if (passt) {
          wartendeAufgabe.treffer(treffer);
        } else {
          // Etwas anderes angetippt: das darf ruhig passieren!
          // So kann man waehrend des Suchens weitergiessen und
          // Toene auf dem Planeten spielen.
          freiesSpiel(treffer, x, y);
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

    // Mit der Giesskanne in der Hand kann man ueberall giessen -
    // auf den Boden, auf Gras, auf Blumen, auf Baeume.
    if (werkzeug === 'giesskanne') {
      giesseAn(treffer);
      return;
    }
    // Mit der Samentuete pflanzt man - auch wenn der Magnet gerade
    // ein Ding in der Naehe vorgeschlagen hat.
    if (werkzeug === 'samentuete' && (typ === 'boden' || treffer.ueberMagnet)) {
      pflanzeBlumeAn(treffer);
      return;
    }
    if (typ === 'apfelbaum-trocken') {
      ui.zeigeHinweis('der Baum braucht Wasser - nimm die Giesskanne');
      setTimeout(() => ui.zeigeHinweis(''), 2500);
      return;
    }
    if (typ === 'apfelbaum') {
      klang.klangFunke();
      ui.funkeAmBildschirm(x, y, '🍎');
      return;
    }
    if (typ === 'mond') {
      plaudereMitDemMond();
      return;
    }

    /* ---------- ALLES KLINGT ----------
       Jedes Ding hat seinen eigenen Klang, und die Tonhoehe haengt
       davon ab, wo es auf dem Planeten steht: oben hell, unten tief.
       So kann man sich eigene Melodien spielen.                     */
    const lokal = planet.gruppe.worldToLocal(treffer.punkt.clone()).normalize();
    const hoehenAnteil = (lokal.y + 1) / 2;
    klang.klangDing(typ, hoehenAnteil);

    // ein passendes Zeichen dazu
    const zeichen = {
      wolke: '💧', haeschen: '💚', schmetterling: '✨',
      'blubber-blume': '🌸', 'blubber-trocken': '🥀',
      apfelbaum: '🍎', 'apfelbaum-trocken': '🍂',
      blume: '🌸', pilz: '🍄', stein: '·',
    }[typ] || '♪';
    ui.funkeAmBildschirm(x, y, zeichen);

    // Ein vertrocknetes Ding sagt ausserdem, was es braucht
    if (typ === 'blubber-trocken' || typ === 'apfelbaum-trocken' || typ === 'gras-trocken') {
      if (!ui.hatWerkzeug('giesskanne')) return;
      ui.zeigeHinweis('nimm die Giesskanne, dann kannst du es giessen');
      setTimeout(() => ui.zeigeHinweis(''), 2500);
    }
  }

  /* --- Giessen --- */
  function giesseAn(treffer) {
    // Der Punkt kann vom Boden kommen oder von einem Ding darauf -
    // beides ergibt eine Richtung auf der Planetenkugel.
    const lokal = planet.gruppe.worldToLocal(treffer.punkt.clone()).normalize();
    planet.maleGruen(lokal, 0.34, 0.85);
    klang.klangGiessen();
    macheRegenTropfen(treffer.punkt);
    zustand.gegossen++;
    guteTat();

    // trockenes Gras an dieser Stelle wird gesund
    const trockene = planet.aufgestellt.filter((o) =>
      o.userData.typ === 'gras-trocken' && o.userData.richtung.distanceTo(lokal) < 0.36);
    for (const alt of trockene) tauscheGrasAus(alt);
    // vertrocknete Apfelbaeume werden wieder gruen
    const welkeBaeume = planet.aufgestellt.filter((o) =>
      o.userData.typ === 'apfelbaum-trocken' && o.userData.richtung.distanceTo(lokal) < 0.45);
    for (const b of welkeBaeume) verwandleBaum(b);

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

  /* Aus vertrocknetem Gras wird gesundes. Weil das gesunde Bueschel
     groesser ist, waechst es beim Giessen sichtbar auf. */
  function tauscheGrasAus(altesGras) {
    const richtung = altesGras.userData.richtung.clone();
    const drehung = altesGras.userData.eigenDrehung || 0;
    planet.nimmWeg(altesGras);
    const neu = machGras(false, Math.floor(wuerfel(1, 9999)));
    neu.scale.setScalar(0.2);
    planet.stelleAuf(neu, richtung, { einsinken: 0.012, drehung });
    lassWachsen(neu, 1, 1.2);
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
  async function stelleTrockeneBlumenAuf() {
    trockeneBlumenGewuenscht = true;
    if (trockeneBlumenStehen) return;
    if (!eigene.blumeTrocken) {
      await holeVorlage('blumeTrocken');
      holeVorlage('blumeGesund');
    }
    if (!eigene.blumeTrocken || trockeneBlumenStehen) return;
    trockeneBlumenStehen = true;
    TROCKENE_BLUMEN_ORTE.forEach((ort, i) => {
      const blume = eigene.blumeTrocken();
      blume.userData.typ = 'blubber-trocken';
      blume.userData.antippbar = true;
      planet.stelleAuf(blume, new THREE.Vector3(...ort).normalize(),
                       { einsinken: 0.004, drehung: i * 1.2 });
    });
  }

  /* --- Eine Stelle, die gerade NICHT zu sehen ist ---
     Damit man etwas wirklich suchen muss, setzen wir es auf die
     Seite, die von der Kamera weg zeigt. */
  function rueckseite() {
    const weg = kamera.position.clone().normalize().negate();
    weg.x += wuerfel(-0.35, 0.35);
    weg.y += wuerfel(-0.15, 0.45);
    weg.z += wuerfel(-0.35, 0.35);
    return planet.gruppe.worldToLocal(weg).normalize();
  }

  /* --- Die vertrockneten Apfelbaeume kommen zum Vorschein --- */
  const BAUM_ORTE = [
    [-0.45, 0.5, 0.74], [0.72, 0.42, -0.55], [-0.3, -0.62, -0.72],
  ];
  let baeumeStehen = false;
  async function stelleApfelbaeumeAuf() {
    if (baeumeStehen) return;
    baeumeStehen = true;
    const fabrik = await holeVorlage('baumTrocken');
    if (!fabrik) { baeumeStehen = false; return; }
    BAUM_ORTE.forEach((ort, i) => {
      const baum = fabrik();
      baum.userData.typ = 'apfelbaum-trocken';
      baum.userData.antippbar = true;
      baum.scale.setScalar(0.04);
      planet.stelleAuf(baum, new THREE.Vector3(...ort).normalize(),
                       { einsinken: 0.01, drehung: i * 2.1 });
      lassWachsen(baum, 1, 1.4);
      funkeBei(baum.getWorldPosition(new THREE.Vector3()), 6);
    });
    klang.klangFunke();
    // die gruene Version schon mal im Hintergrund holen
    holeVorlage('baumGesund');
  }

  /* --- Aus einem vertrockneten Apfelbaum wird ein voller --- */
  function verwandleBaum(alterBaum) {
    const fabrik = eigene.baumGesund;
    if (!fabrik) {
      // noch nicht geladen: holen und dann verwandeln
      holeVorlage('baumGesund').then((f) => { if (f) verwandleBaum(alterBaum); });
      ui.zeigeHinweis('der Baum wacht auf ...');
      setTimeout(() => ui.zeigeHinweis(''), 2000);
      return null;
    }
    const richtung = alterBaum.userData.richtung.clone();
    const drehung = alterBaum.userData.eigenDrehung || 0;
    planet.nimmWeg(alterBaum);
    const neu = fabrik();
    neu.userData.typ = 'apfelbaum';
    neu.userData.antippbar = true;
    neu.scale.setScalar(0.12);
    planet.stelleAuf(neu, richtung, { einsinken: 0.012, drehung });
    lassWachsen(neu, 1, 2.2);
    klang.klangBaumWaechst();
    funkeBei(neu.getWorldPosition(new THREE.Vector3()), 12);
    return neu;
  }

  /* --- Aus vertrocknet wird aufgebluecht --- */
  function verwandleBlume(alteBlume) {
    const richtung = alteBlume.userData.richtung.clone();
    const drehung = alteBlume.userData.eigenDrehung || 0;
    planet.nimmWeg(alteBlume);
    if (!eigene.blumeGesund) return null;
    const neue = eigene.blumeGesund();
    neue.userData.typ = 'blubber-blume';
    neue.userData.antippbar = true;
    neue.scale.setScalar(0.02);
    planet.stelleAuf(neue, richtung, { einsinken: 0.004, drehung });
    lassWachsen(neue, 1, 1.4);
    klang.klangAufbluehen();
    funkeBei(neue.getWorldPosition(new THREE.Vector3()), 10);
    return neue;
  }

  /* --- Die selbst gemalte Blubber-Blume waechst aus dem nassen Boden --- */
  function pflanzeBlubberBlume(lokaleRichtung) {
    if (!eigene.blumeGesund) return null;
    // ein bisschen neben die Stelle, damit sie nicht im Gras steckt
    const daneben = lokaleRichtung.clone()
      .add(new THREE.Vector3(wuerfel(-0.13, 0.13), wuerfel(-0.13, 0.13), wuerfel(-0.13, 0.13)))
      .normalize();
    const blume = eigene.blumeGesund();
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
    if (eigene.blumeGesund && zustand.gepflanzt % 3 === 2) {
      const b = pflanzeBlubberBlume(lokal);
      if (b) {
        planet.maleGruen(lokal, 0.2, 0.5);
        zustand.gepflanzt++;
        guteTat();
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
    klang.klangAufbluehen();
    zustand.gepflanzt++;
    funkeBei(blume.getWorldPosition(new THREE.Vector3()), 4);
    guteTat();
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
        guteTaten: zustand.guteTaten || 0,
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
    ui, klang, bedienung, mondBahn, falter, blick,
    mondSagt, warteAufTipp, warteAufStreicheln, warte, warteBis, zaehle, warteAufUmsehen,
    weckeWelt, zeigePlanet, lasseWeltWachsen, funkeBei,
    lassWachsen, tauscheGrasAus, macheBaumAus, speichere, pflanzeBlubberBlume, guteTat,
    giesseAn, pflanzeBlumeAn, freiesSpiel,
    stelleTrockeneBlumenAuf, verwandleBlume, machGras, eigene,
    holeVorlage, stelleApfelbaeumeAuf, verwandleBaum, rueckseite,
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

  function bild() {
    const schritt = Math.min(uhr.getDelta(), 0.05);
    const zeit = zustand.zeit += schritt;

    belebeSterne(zeit);
    blick.griffRadius = Math.max(0.35, planet.radius);
    bedienung.belebe(schritt);
    planet.belebe(zeit, schritt, kamera.position);

    /* --- der leuchtende Punkt --- */
    const puls = 1 + Math.sin(zeit * 1.8) * 0.12 + Math.sin(zeit * 4.3) * 0.05;
    glanz.scale.setScalar(zustand.schlaeft ? puls * 0.95 : puls * 0.55);
    glanz.lookAt(kamera.position);
    kernLicht.intensity = zustand.schlaeft ? 2.2 * puls : 0.7 * puls;
    kernKugel.visible = planet.radius < 0.2;
    kernKugel.scale.setScalar(THREE.MathUtils.lerp(kernKugel.scale.x, puls, 0.1));
    glanz.material.opacity = zustand.schlaeft ? 0.95 : Math.max(0, 0.5 - planet.radius * 0.5);

    /* --- Lunix zieht seine Bahn um den Planeten ---
       Beim Erzaehlen kommt er ein Stueck naeher und hoeher, damit er
       nicht hinter dem Planeten verschwindet.                      */
    mondBahn.winkel += schritt * mondBahn.geschwindigkeit;
    {
      mondBahn.erzaehlNaehe = THREE.MathUtils.lerp(
        mondBahn.erzaehlNaehe, blick.schautZuLunix ? 1 : 0,
        1 - Math.pow(0.05, schritt));

      const r = Math.max(2.4, planet.radius * 2.0 + 1.9)
                * (1 + mondBahn.erzaehlNaehe * 0.22);
      mond.position.set(
        Math.cos(mondBahn.winkel) * r,
        Math.sin(mondBahn.winkel * 0.85) * r * mondBahn.neigung
          + mondBahn.erzaehlNaehe * (planet.radius + 0.7),
        Math.sin(mondBahn.winkel) * r
      );
    }
    if (mond.userData.belebe) mond.userData.belebe(zeit, schritt, kamera.position);

    /* --- Die Kamera fliegt um den Planeten und schaut zur Mitte.
           Wenn Lunix redet, schwenkt sie zu ihm hoch - und danach
           wieder runter auf die Welt.                              --- */
    if (blick.schautZuLunix) {
      // Der Blick geht auf einen Punkt zwischen Planet und Lunix -
      // aber naeher am Planeten, damit die Welt die Hauptrolle behaelt.
      blick.zielZiel.copy(mond.position).multiplyScalar(0.5);
      blick.zielAbstand = 2.9 + planet.radius * 2.4 + mond.position.length() * 0.7;

      // Die Kamera stellt sich SCHRAEG neben Lunix - dann stehen
      // Planet und Lunix nebeneinander im Bild, statt hintereinander.
      const mondSeite = Math.atan2(mond.position.x, mond.position.z);
      let unterschied = (mondSeite - 0.42) - blick.seite;
      while (unterschied > Math.PI) unterschied -= Math.PI * 2;
      while (unterschied < -Math.PI) unterschied += Math.PI * 2;
      blick.seite += unterschied * (1 - Math.pow(0.35, schritt));

      const laenge = mond.position.length() || 1;
      const mondHoch = Math.asin(THREE.MathUtils.clamp(mond.position.y / laenge, -1, 1));
      // Die Kamera hebt sich fast auf Lunix' Hoehe. Dadurch steht er
      // ungefaehr in der Bildmitte - und ueber ihm ist Platz fuer die
      // Sprechblase, statt dass sie ihn verdeckt.
      blick.hoch += (mondHoch * 0.75 + 0.04 - blick.hoch) * (1 - Math.pow(0.4, schritt));
    } else {
      blick.zielZiel.set(0, 0, 0);
      blick.zielAbstand = zustand.schlaeft ? 4.6 : 2.15 + planet.radius * 2.6;
    }
    blick.ziel.lerp(blick.zielZiel, 1 - Math.pow(0.01, schritt));
    blick.abstand = THREE.MathUtils.lerp(blick.abstand, blick.zielAbstand,
                                         1 - Math.pow(0.06, schritt));
    stelleKameraEin();

    /* --- Die Sprechblase klebt an Lunix --- */
    if (blick.schautZuLunix) {
      mond.getWorldPosition(mondOrt);
      const p = mondOrt.clone().project(kamera);
      ui.setzeBlaseAn(
        (p.x * 0.5 + 0.5) * window.innerWidth,
        (-p.y * 0.5 + 0.5) * window.innerHeight - 95
      );
    }

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
