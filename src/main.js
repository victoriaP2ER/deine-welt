/* ==================================================================
   DEINE WELT - Hauptdatei

   Hier wird alles zusammengesetzt:
   die Buehne, der Planet, der Mond - und die Bausteine, mit denen
   die Geschichte in geschichte.js erzählt wird.
   ================================================================== */

import * as THREE from 'three';
import { szene, kamera, maler, belebeSterne, passeGroesseAn } from './szene.js';
import { ladeAlleBilder, macheSchnipsel, machWuerfel } from './schnipsel.js';
import { machePlanet, hoeheAn } from './planet.js';
import { baueMond } from './mond.js';
import { baueGras, baueBlume, baueBaum, baueBusch, bauePilz, baueSetzling, baueStein,
         baueSeerose, FARBEN } from './pflanzen.js';
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
  // Der Lichtschein ist viel größer als der Punkt selbst. Wuerde er
  // Fingertipps abfangen, könnte man den Mond dahinter nicht antippen.
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
    erzaehlNaehe: 0,     // 0 = normale Bahn, 1 = kommt zum Erzählen näher
    zielWinkel: null,    // beim Reden: da bleibt er stehen
    zeigeObjekt: null,   // worum es gerade geht (ein Ding auf dem Planeten)
    zeigeRichtung: null, // oder einfach eine Himmelsrichtung
  };

  /* ---------- DER BLICK: wo ist die Kamera, wohin schaut sie? ----------
     Die Kamera hängt an einem unsichtbaren Faden um den Planeten.
     "seite" und "hoch" sind die Winkel, "abstand" die Entfernung.
     Beim Wischen ändern sich die Winkel - dadurch fliegt die Kamera
     um den Planeten herum und die Sterne ziehen vorbei.               */
  const blick = {
    seite: 0,
    hoch: 0.16,
    abstand: 4.6,
    zielAbstand: 4.6,
    schwungSeite: 0,
    schwungHoch: 0,
    griffRadius: 0.7,   // wie groß der Planet gerade ist (für 1:1-Gefuehl)
    zoom: 1,            // 1 = normal, kleiner = näher dran
    letzterRadius: 0,   // um mitzubekommen, wenn der Planet wächst
    ziel: new THREE.Vector3(0, 0, 0),        // wohin die Kamera schaut
    zielZiel: new THREE.Vector3(0, 0, 0),    // wohin sie schauen soll
    schautZuLunix: false,
    hochVorher: null,   // Blickhöhe vor dem Gespräch, um zurückzufinden
    lunixWeite: 1,      // Sicherheitsnetz: wie weit muss die Kamera weg,
                        // damit Lunix wirklich im Bild ist?
    redeteGerade: false, // um das Ende eines Gesprächs zu bemerken
    hochZurueck: null,   // dorthin kommt der Blick nach dem Gespräch
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

     Alle deine Zeichnungen zusammen sind über 20 MB groß. Wuerden
     wir sie alle beim Start laden, müsste man auf dem Handy lange
     warten. Darum:

       - das Gras kommt im Hintergrund gleich mit (das braucht man
         schon im zweiten Kapitel)
       - alles andere wird erst geholt, wenn die Geschichte es braucht

     Fehlt eine Datei, läuft das Spiel einfach mit den
     Papier-Bastelmodellen weiter.
     ================================================================ */
  // Die zweite Zahl ist die Höhe auf dem Planeten.
  // Vertrocknet ist absichtlich viel kleiner als gesund - dann sieht
  // man beim Gießen richtig, wie es aufwächst.
  const DATEIEN = {
    grasTrocken:  ['meine-sachen/gras-trocken.glb', 0.13],
    // Dein gesundes Gras ist aus dem vertrockneten entstanden und
    // darum noch fast ueberall ockerbraun. Damit man wirklich sieht,
    // dass es aufgelebt ist, bekommen die braunen Striche genau das
    // Gruen, das du in derselben Zeichnung schon benutzt hast.
    grasGesund:   ['meine-sachen/gras-gesund.glb', 0.27, { nachfaerben: '#2f7a28' }],
    blumeTrocken: ['meine-sachen/blubber-blume-trocken.glb', 0.2],
    blumeGesund:  ['meine-sachen/blubber-blume.glb', 0.48],
    baumTrocken:  ['meine-sachen/apfelbaum-trocken.glb', 0.5],
    baumGesund:   ['meine-sachen/apfelbaum.glb', 1.2],
    // Ein See darf ruhig etwas ausladend sein
    seeVoll:      ['meine-sachen/see-voll.glb', 0.88],
    seeLeer:      ['meine-sachen/see-leer.glb', 0.88],
    haeschenHoehle: ['meine-sachen/haeschen-hoehle.glb', 0.42],
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
    const [datei, hoehe, wahl] = DATEIEN[name] || [];
    if (!datei) return Promise.resolve(null);

    amLaden[name] = ladeVorlage(datei, hoehe, wahl)
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

  /* --- Ein Grasbüschel bauen: deine Zeichnung, wenn sie schon da ist --- */
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

  /* --- Lunix fliegt zu einer Sache hin ---
     Er kann auf ein Ding auf dem Planeten zeigen (dann folgt er ihm,
     auch wenn man die Welt dreht) oder auf eine Himmelsrichtung.  */
  function lunixZeigtAuf(was) {
    mondBahn.zeigeObjekt = null;
    mondBahn.zeigeRichtung = null;
    if (!was) return;
    if (was.isVector3) mondBahn.zeigeRichtung = was.clone().normalize();
    else if (was.isObject3D) mondBahn.zeigeObjekt = was;
  }

  const zeigeOrt = new THREE.Vector3();
  /** Wo im Weltall ist gerade die Stelle, um die es geht? */
  function holeZeigeZiel() {
    if (mondBahn.zeigeObjekt && mondBahn.zeigeObjekt.parent) {
      return mondBahn.zeigeObjekt.getWorldPosition(zeigeOrt);
    }
    if (mondBahn.zeigeRichtung) {
      return zeigeOrt.copy(mondBahn.zeigeRichtung)
        .applyQuaternion(planet.gruppe.quaternion)
        .multiplyScalar(Math.max(0.2, planet.radius));
    }
    return null;
  }

  /* --- Der Mond sagt etwas (und wartet, bis man weitertippt) --- */
  function mondSagt(saetze, gefuehl = 'normal', zeigeAuf = null) {
    const liste = Array.isArray(saetze) ? saetze : [saetze];
    return new Promise((fertig) => {
      blick.schautZuLunix = true;      // die Kamera schwenkt zu ihm hoch
      // Wenn es um etwas Bestimmtes geht, fliegt Lunix dorthin -
      // dann sieht man sofort, wovon er redet.
      lunixZeigtAuf(zeigeAuf);
      mond.setzeGefuehl(gefuehl);
      let i = 0;

      const zeigeSatz = () => {
        mond.redeAn(true);
        ui.sagText(liste[i], {
          beiFertig: () => mond.redeAn(false),
        });
        // Unten steht ein weiter-Knopf. Man kann ihn antippen, die
        // Sprechblase, oder einfach irgendwo aufs Bild - alles geht.
        // Der Knopf gehoert GENAU zu diesem Gespraech. Frueher hat er
        // in "die gerade wartende Aufgabe" geschaut - war das
        // inzwischen eine andere, passierte beim Druecken nichts.
        ui.zeigeWeiterHinweis('', () => aufgabe.weiter());
      };

      const aufgabe = {
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
            lunixZeigtAuf(null);
            fertig();
          }
        },
      };
      wartendeAufgabe = aufgabe;
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
     Nach einem schönen Moment: in Ruhe umschauen, herumfliegen,
     Töne spielen. Weiter geht es erst, wenn man den weiter-Knopf
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
         Während dieser Zeit darf man frei spielen (gießen, pflanzen). --- */
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

  /* --- Die Welt wird ein Stück größer --- */
  function lasseWeltWachsen(um = 0.075) {
    planet.wachseAuf(planet.zielRadius + um);
    klang.klangWachsen();
    ui.gibStern();
    speichere();
  }

  /* --- GUTE TATEN ---------------------------------------------------
     Jedes Gießen und jedes Pflanzen ist eine gute Tat.

     Der Planet wächst NICHT einfach so davon - das soll man sich
     verdienen: bei den großen Momenten der Geschichte und wenn ein
     See voll Wasser ist.

     Nur eins macht er von allein: wenn es richtig eng wird auf ihm,
     schafft er Platz. Sonst könnte man irgendwann nichts mehr
     pflanzen.                                                       */
  function guteTat() {
    zustand.guteTaten = (zustand.guteTaten || 0) + 1;
    speichere();

    // Wie viele Sachen haben bei dieser Größe bequem Platz?
    const platz = 22 * planet.zielRadius * planet.zielRadius;
    if (planet.aufgestellt.length <= platz) return;

    planet.wachseAuf(planet.zielRadius + 0.07);
    klang.klangWachsen();
    ui.zeigeHinweis('Es wird eng - der Planet macht Platz!');
    setTimeout(() => ui.zeigeHinweis(''), 3500);
    for (let i = 0; i < 6; i++) {
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
        // freies Spiel: gießen oder pflanzen, wenn ein Werkzeug in der Hand ist
        freiesSpiel(treffer, x, y);
        return;
      }
      // Der Mond redet: einmal tippen schreibt den Satz fertig,
      // nochmal tippen bringt den nächsten. Man darf dafür überall
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
          // So kann man während des Suchens weitergießen und
          // Töne auf dem Planeten spielen.
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

  // Ein Klick direkt auf die Sprechblase blättert auch weiter
  ui.blaseAngetippt(() => {
    if (wartendeAufgabe && wartendeAufgabe.art === 'blase') wartendeAufgabe.weiter();
  });

  // Der leuchtende Punkt soll antippbar und streichelbar sein
  kern.userData.typ = 'kern';
  kern.userData.antippbar = true;
  kernKugel.userData.typ = 'kern';

  /* ================================================================
     FREIES SPIEL - gießen und pflanzen, wann man will
     ================================================================ */
  function freiesSpiel(treffer, x, y) {
    if (!treffer) return;
    const werkzeug = ui.werkzeugInDerHand();
    const typ = treffer.ding.userData.typ;

    // Mit der Gießkanne in der Hand kann man überall gießen -
    // auf den Boden, auf Gras, auf Blumen, auf Bäume.
    if (werkzeug === 'giesskanne') {
      giesseAn(treffer);
      return;
    }
    // Mit der Samentüte pflanzt man - auch wenn der Magnet gerade
    // ein Ding in der Nähe vorgeschlagen hat.
    if (werkzeug === 'samentuete'
        && (typ === 'boden' || typ === 'see' || treffer.ueberMagnet)) {
      pflanzeBlumeAn(treffer);
      return;
    }
    // Auf einem ausgetrockneten See waechst noch nichts
    if (werkzeug === 'samentuete' && typ === 'see-leer') {
      ui.zeigeHinweis('erst Wasser hinein - dann wachsen hier Seerosen');
      setTimeout(() => ui.zeigeHinweis(''), 2500);
      return;
    }
    if (typ === 'apfelbaum-trocken') {
      ui.zeigeHinweis('der Baum braucht Wasser - nimm die Gießkanne');
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
       Jedes Ding hat seinen eigenen Klang, und die Tonhoehe hängt
       davon ab, wo es auf dem Planeten steht: oben hell, unten tief.
       So kann man sich eigene Melodien spielen.                     */
    const lokal = planet.gruppe.worldToLocal(treffer.punkt.clone()).normalize();
    const hoehenAnteil = (lokal.y + 1) / 2;
    klang.klangDing(typ, hoehenAnteil);

    // ein passendes Zeichen dazu
    const zeichen = {
      wolke: '💧', haeschen: '💚', schmetterling: '✨', hoehle: '🐾',
      'blubber-blume': '🌸', 'blubber-trocken': '🥀',
      apfelbaum: '🍎', 'apfelbaum-trocken': '🍂',
      blume: '🌸', pilz: '🍄', stein: '·',
    }[typ] || '♪';
    ui.funkeAmBildschirm(x, y, zeichen);

    // Ein vertrocknetes Ding sagt ausserdem, was es braucht
    if (typ === 'blubber-trocken' || typ === 'apfelbaum-trocken' || typ === 'gras-trocken') {
      if (!ui.hatWerkzeug('giesskanne')) return;
      ui.zeigeHinweis('nimm die Gießkanne, dann kannst du es gießen');
      setTimeout(() => ui.zeigeHinweis(''), 2500);
    }
  }

  /* --- Gießen --- */
  function giesseAn(treffer) {
    // Der Punkt kann vom Boden kommen oder von einem Ding darauf -
    // beides ergibt eine Richtung auf der Planetenkugel.
    const lokal = planet.gruppe.worldToLocal(treffer.punkt.clone()).normalize();
    planet.maleGruen(lokal, 0.34, 0.85);
    klang.klangGiessen();
    macheRegenTropfen(treffer.punkt);
    zustand.gegossen++;
    guteTat();

    /* Was genau habe ich getroffen?
       Tippt man ein vertrocknetes Ding direkt an, soll es auch dann
       gegossen werden, wenn der Finger etwas daneben gerutscht ist. */
    const getroffen = treffer.ding.userData.typ ? treffer.ding : null;
    const dasHier = (typ, o) => o.userData.typ === typ && o === getroffen;

    // trockenes Gras an dieser Stelle wird gesund
    const trockene = planet.aufgestellt.filter((o) =>
      o.userData.typ === 'gras-trocken'
      && (dasHier('gras-trocken', o) || o.userData.richtung.distanceTo(lokal) < 0.36));
    for (const alt of trockene) tauscheGrasAus(alt);
    // ein leerer See füllt sich mit Wasser
    const leereSeen = planet.aufgestellt.filter((o) =>
      o.userData.typ === 'see-leer'
      && (dasHier('see-leer', o) || o.userData.richtung.distanceTo(lokal) < 0.5));
    for (const see of leereSeen) fuelleSee(see);

    // vertrocknete Apfelbäume werden wieder grün
    const welkeBaeume = planet.aufgestellt.filter((o) =>
      o.userData.typ === 'apfelbaum-trocken'
      && (dasHier('apfelbaum-trocken', o) || o.userData.richtung.distanceTo(lokal) < 0.45));
    for (const b of welkeBaeume) verwandleBaum(b);

    // vertrocknete Blubber-Blumen blühen wieder auf
    const welke = planet.aufgestellt.filter((o) =>
      o.userData.typ === 'blubber-trocken'
      && (dasHier('blubber-trocken', o) || o.userData.richtung.distanceTo(lokal) < 0.4));
    for (const w of welke) verwandleBlume(w);

    // und aus dem gewaesserten Boden blubbert eine neue Blume hervor
    if (trockene.length > 0 && welke.length === 0) pflanzeBlubberBlume(lokal);
    // ein Setzling wird zum Baum
    const setzlinge = planet.aufgestellt.filter((o) =>
      o.userData.typ === 'setzling' && o.userData.richtung.distanceTo(lokal) < 0.3);
    for (const s of setzlinge) macheBaumAus(s);
    speichere();
  }

  /* Aus vertrocknetem Gras wird gesundes. Weil das gesunde Büschel
     größer ist, wächst es beim Gießen sichtbar auf. */
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

  /* ---------- SEEN ----------
     Wenn der Planet wächst, kommt Platz für einen See zum
     Vorschein. Die Datei ist groß, darum wird sie erst geholt,
     wenn sie wirklich gebraucht wird.                              */
  const SEE_ORTE = [
    [0.62, 0.2, 0.75], [-0.55, -0.45, 0.7], [0.1, 0.75, -0.65],
  ];
  let seenAufgestellt = 0;

  /* Wie tief ein See im Boden steckt.

     Ganz wenig! Frueher steckte er so tief, dass man vom Wasser
     nichts mehr gesehen hat. Jetzt wird nur die Stelle unter ihm
     glattgebuegelt, und der See legt sich einfach darauf.

     Fest eingestellt, nicht gemessen - denn der leere und der volle
     See sind unterschiedlich gross gemalt. Wuerde man messen, wuerde
     der See beim Auffuellen auf einmal tiefer oder hoeher sitzen.  */
  const SEE_TIEFE = 0;           // leerer See: er liegt einfach oben auf
  const SEE_TIEFE_VOLL = -0.01;  // voller See: das Wasser soll man sehen
  /* Wie stark die Rundung des Planeten ausgeglichen wird.
     1 = der Rand beruehrt genau den Boden (dann steckt der See zu
     tief drin), weniger = der See liegt hoeher und man sieht ihn
     richtig. Auf einem grossen Planeten ist das ohnehin nur ein
     kleiner Unterschied - genau wie bei einem See auf der Erde. */
  const SEE_RUNDUNG = 0.76;
  /* Ein See waechst nicht wie eine Pflanze - er FUELLT sich.
     Darum legt sich der volle See genau so gross ueber den leeren
     und schwillt dabei nur einen Hauch an, waehrend der leere
     darunter verblasst. */
  const SEE_ANSCHWELLEN = 1.05;

  /** Wie breit ein Ding ist - dafuer, dass es passend versenkt wird. */
  function breiteVon(objekt) {
    const m = objekt.userData.masse;
    return m ? Math.max(m.x, m.z) : (objekt.userData.hoehe || 0.5) * 2;
  }

  /* Ein See soll ruhig daliegen und nicht wabern wie eine Blume. */
  function machRuhig(objekt) {
    objekt.userData.belebe = null;
    objekt.rotation.z = 0;
    objekt.rotation.x = 0;
  }

  /* Ein See braucht einen Planeten, der schon eine Weile gewachsen
     ist. Auf einer kleinen Kugel würde ein flacher See abstehen wie
     ein Brett - auf einer großen ist die Rundung so sanft, dass er
     sich einfügt. Genau wie ein See auf der Erde: die ist so groß,
     dass man von ihrer Rundung nichts merkt.                        */
  const PLANET_GROSS_GENUG = 1.55;

  async function lassSeeErscheinen(mitFunken = true) {
    if (seenAufgestellt >= SEE_ORTE.length) return null;
    const nummer = seenAufgestellt;
    seenAufgestellt++;

    if (mitFunken) ui.zeigeHinweis('Der Planet macht Platz für etwas Großes ...');

    // Ist der Planet noch zu klein für einen See? Dann wächst er
    // jetzt dafür - der See ist ja der Grund zu wachsen.
    if (planet.zielRadius < PLANET_GROSS_GENUG) {
      planet.wachseAuf(PLANET_GROSS_GENUG);
      klang.klangWachsen();
      await new Promise((fertig) => setTimeout(fertig, 2600));
    }

    // erst den vertrockneten See versuchen, sonst gleich den vollen
    const fabrik = (await holeVorlage('seeLeer')) || (await holeVorlage('seeVoll'));
    if (!fabrik) { seenAufgestellt--; ui.zeigeHinweis(''); return null; }
    const leerVorhanden = !!eigene.seeLeer;

    // Ein See braucht Platz - darum wächst der Planet ein Stück
    // dafür. Aber nur ein Stück: sonst ist die Welt viel zu schnell
    // viel zu gross.
    planet.wachseAuf(planet.zielRadius + 0.12);

    const see = fabrik();
    see.userData.typ = leerVorhanden ? 'see-leer' : 'see';
    see.userData.antippbar = true;
    see.userData.keinTrefferBall = true;
    machRuhig(see);
    see.scale.setScalar(0.04);
    const richtung = new THREE.Vector3(...SEE_ORTE[nummer]).normalize();

    // Der Planet macht an dieser Stelle eine ebene Fläche - so wie
    // ein Tisch, auf den der See genau passt.
    planet.macheFlacheStelle(richtung, breiteVon(see) * 1.1);

    planet.stelleAuf(see, richtung, {
      einsinken: 0,
      einsinkenAbsolut: SEE_TIEFE,
      // So tief, dass der Rand den Boden beruehrt - auf einem grossen
      // Planeten ist das fast nichts, weil die Rundung so sanft ist.
      flachBreite: breiteVon(see) * SEE_RUNDUNG,
      drehung: nummer * 1.7,
    });
    lassWachsen(see, 1, 2);
    planet.maleGruen(richtung, 0.55, 0.85);
    if (mitFunken) {
      klang.klangWachsen();
      funkeBei(see.getWorldPosition(new THREE.Vector3()), 12);
      setTimeout(() => {
        ui.zeigeHinweis(leerVorhanden
          ? 'Ein ausgetrockneter See! Gieß ihn voll.'
          : 'Ein See ist entstanden!');
        setTimeout(() => ui.zeigeHinweis(''), 4000);
      }, 1200);
    }
    // die gefüllte Fassung schon mal vorbereiten
    if (leerVorhanden) holeVorlage('seeVoll');
    return see;
  }

  /* Wie viel groesser muss der volle See sein, damit er genau so
     viel Boden bedeckt wie der leere? Gemessen wird, wie weit die
     gemalten Punkte von der Mitte weg reichen - nicht die Kiste
     drumherum, denn die kann bei zwei Zeichnungen ganz
     unterschiedlich voll sein.                                     */
  function seeAngleich(leererSee, voll) {
    const a = leererSee.userData.teilWeiten;
    const b = voll.userData.teilWeiten;
    const verhaeltnisse = [];
    if (a && b) {
      for (const name of Object.keys(a)) {
        if (a[name] > 0 && b[name] > 0) verhaeltnisse.push(a[name] / b[name]);
      }
    }
    if (verhaeltnisse.length < 2) {
      // kein gemeinsamer Pinsel - dann wenigstens die Flaeche vergleichen
      const rLeer = leererSee.userData.flaecheRadius || 0;
      const rVoll = voll.userData.flaecheRadius || 0;
      if (!rLeer || !rVoll) return 1;
      return THREE.MathUtils.clamp(rLeer / rVoll, 0.5, 3)
             * (leererSee.scale.x || 1);
    }
    // der mittlere Wert - ein einzelner Ausreisser zieht ihn nicht schief
    verhaeltnisse.sort((x, y) => x - y);
    const mitte = verhaeltnisse[Math.floor(verhaeltnisse.length / 2)];
    return THREE.MathUtils.clamp(mitte, 0.5, 3) * (leererSee.scale.x || 1);
  }

  /* Und wie weit ist der volle See gegenueber dem leeren verrutscht?
     Auch das verraten die gemeinsamen Pinsel: wir schieben ihn so,
     dass sein Ufer genau dort liegt, wo vorher das Ufer des leeren
     Sees war - in der Breite UND in der Hoehe.                     */
  function seeVersatz(leererSee, voll, angleich) {
    const a = leererSee.userData.teilMitten;
    const b = voll.userData.teilMitten;
    const versatz = new THREE.Vector3();
    if (!a || !b || !angleich) return versatz;
    const gemeinsam = Object.keys(a).filter((n) => b[n]);
    if (!gemeinsam.length) return versatz;
    const leerGroesse = leererSee.scale.x || 1;
    for (const name of gemeinsam) {
      versatz.add(a[name].clone().multiplyScalar(leerGroesse / angleich)
                                 .sub(b[name]));
    }
    return versatz.divideScalar(gemeinsam.length);
  }

  /* --- Aus einem leeren See wird ein voller --- */
  function fuelleSee(leererSee) {
    const fabrik = eigene.seeVoll;
    if (!fabrik) {
      holeVorlage('seeVoll').then((f) => { if (f) fuelleSee(leererSee); });
      ui.zeigeHinweis('das Wasser kommt gleich ...');
      setTimeout(() => ui.zeigeHinweis(''), 2000);
      return null;
    }
    const richtung = leererSee.userData.richtung.clone();
    const drehung = leererSee.userData.eigenDrehung || 0;
    const voll = fabrik();
    voll.userData.typ = 'see';
    voll.userData.antippbar = true;
    voll.userData.keinTrefferBall = true;
    machRuhig(voll);

    /* Der volle See ist anders gemalt als der leere. Damit beim
       Auffuellen nichts springt und der gefuellte See nicht ploetzlich
       kleiner ist, wird er genau so gross gemacht, dass er dieselbe
       Flaeche bedeckt wie der leere.                                */
    const angleich = seeAngleich(leererSee, voll);
    const versatz = seeVersatz(leererSee, voll, angleich);
    voll.scale.setScalar(angleich);

    /* Der volle See wird nicht in sich verschoben, sondern als
       Ganzes ein Stueck weitergesetzt. Dann bleibt seine Mitte auch
       die Stelle, die man antippt - wichtig fuer die Seerosen.    */
    const hoch = new THREE.Vector3(0, 1, 0);
    const quer = new THREE.Vector3(versatz.x, 0, versatz.z)
      .multiplyScalar(angleich)
      .applyQuaternion(new THREE.Quaternion().setFromAxisAngle(hoch, drehung))
      .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(hoch, richtung));
    const ort = richtung.clone()
      .multiplyScalar(Math.max(0.3, planet.radius)).add(quer).normalize();

    // Genau so tief wie der leere See - der lag ja richtig.
    planet.stelleAuf(voll, ort, {
      einsinken: 0,
      einsinkenAbsolut: SEE_TIEFE - versatz.y * angleich,
      flachBreite: breiteVon(leererSee) * (leererSee.scale.x || 1) * SEE_RUNDUNG,
      drehung,
    });
    // kein Wachsen wie bei einer Pflanze - nur ein Anschwellen
    lassWachsen(voll, angleich * SEE_ANSCHWELLEN, 1.4, angleich);

    // und der leere See verblasst sanft darunter weg
    leererSee.userData.typ = 'vergeht';
    leererSee.userData.antippbar = false;
    lassVerblassen(leererSee, 1.4);

    klang.klangGiessen();
    klang.klangAufbluehen();
    funkeBei(voll.getWorldPosition(new THREE.Vector3()), 12);

    // Ein voller See ist ein großer Moment: dafür wächst der Planet -
    // und macht dabei Platz für den nächsten.
    setTimeout(() => {
      planet.wachseAuf(planet.zielRadius + 0.12);
      klang.klangWachsen();
      ui.zeigeHinweis('Der See ist voll! Der Planet wächst.');
      setTimeout(() => ui.zeigeHinweis(''), 3500);
      // der naechste See laesst sich Zeit - sonst waechst der
      // Planet viel zu schnell viel zu gross
      setTimeout(() => lassSeeErscheinen(), 30000);
    }, 2000);
    return voll;
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

  /* --- Die Höhle vom Häschen ---
     Du hast dem Häschen eine kleine Höhle gemalt. Sie kommt genau an
     die Stelle, an der sich das Häschen versteckt: dann hat es ein
     Zuhause - und man hat beim Suchen etwas zu entdecken.          */
  async function stelleHoehleAuf(richtung) {
    const fabrik = await holeVorlage('haeschenHoehle');
    if (!fabrik) return null;
    const hoehle = fabrik();
    hoehle.userData.typ = 'hoehle';
    hoehle.userData.antippbar = true;
    hoehle.userData.belebe = null;        // eine Höhle wackelt nicht
    hoehle.scale.setScalar(0.05);
    planet.stelleAuf(hoehle, richtung, {
      einsinken: 0.06,
      drehung: wuerfel(0, 6.28),
    });
    lassWachsen(hoehle, 1, 1.4);
    return hoehle;
  }

  /* --- Die vertrockneten Apfelbäume kommen zum Vorschein --- */
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
    // die grüne Version schon mal im Hintergrund holen
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

  /* --- Aus vertrocknet wird aufgeblüht --- */
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

  /* --- Die selbst gemalte Blubber-Blume wächst aus dem nassen Boden --- */
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

  /* --- Seerosen wachsen nur auf dem Wasser --- */
  function istAufDemSee(lokaleRichtung) {
    return planet.aufgestellt.find((o) => {
      if (o.userData.typ !== 'see') return false;
      // Wie weit reicht dieser See? Umgerechnet auf die Kugel.
      const weite = ((o.userData.flaecheRadius || 0.6) * (o.scale.x || 1))
                    / Math.max(0.4, planet.radius);
      return o.userData.richtung.distanceTo(lokaleRichtung) < Math.max(0.12, weite);
    });
  }

  function pflanzeSeerose(lokaleRichtung, see) {
    const sorten = ['weiss', 'rosa', 'gelb'];
    const rose = baueSeerose({
      groesse: 0.8,          // klein - sie sollen den See nicht zudecken
      sorte: sorten[Math.floor(wuerfel(0, sorten.length))],
      startzahl: Math.floor(wuerfel(1, 9999)),
    });

    /* Die Seerose kommt genau dorthin, wo du hingetippt hast - nur
       ein Hauch versetzt, damit nicht alle aufeinander liegen.
       Dein Finger weiss am besten, wo das Wasser ist.             */
    const derSee = see || istAufDemSee(lokaleRichtung);
    const ort = lokaleRichtung.clone()
      .add(new THREE.Vector3(wuerfel(-0.02, 0.02), wuerfel(-0.02, 0.02),
                             wuerfel(-0.02, 0.02)))
      .normalize();

    rose.scale.setScalar(0.05);

    /* Eine Seerose liegt FLACH auf dem Wasser.
       Der See ist flach, der Planet ist rund - am Rand des Sees
       stand die Seerose darum schraeg und steckte halb im Wasser.
       Jetzt richtet sie sich nach dem See aus (nicht nach der
       Rundung der Kugel) und sinkt genau so tief ein, wie die
       Rundung an dieser Stelle unter dem flachen See abfaellt.
       Wonach sie sich richtet, weiss der See selbst ganz genau:
       es ist die Richtung, in der er aufgestellt wurde.           */
    const seeRichtung = derSee ? derSee.userData.richtung : null;
    const wieWeitVomSee = seeRichtung
      ? ort.angleTo(seeRichtung) * Math.max(0.4, planet.radius) : 0;

    planet.stelleAuf(rose, ort, {
      einsinken: 0,
      einsinkenAbsolut: SEE_TIEFE_VOLL,
      flachBreite: wieWeitVomSee * 2,
      ausrichtung: seeRichtung,
      drehung: wuerfel(0, 6.28),
    });
    lassWachsen(rose, 1, 1.2);
    klang.klangPlopp();
    klang.klangAufbluehen();
    zustand.gepflanzt++;
    funkeBei(rose.getWorldPosition(new THREE.Vector3()), 5);
    guteTat();
    return rose;
  }

  function pflanzeBlumeAn(treffer) {
    const lokal = planet.gruppe.worldToLocal(treffer.punkt.clone()).normalize();

    // Auf dem Wasser wächst keine normale Blume - da wird es eine
    // Seerose. Am sichersten ist es, wenn man den See direkt
    // angetippt hat - dann muss gar nicht erst gesucht werden.
    const seeHier = treffer.ding.userData.typ === 'see'
      ? treffer.ding : istAufDemSee(lokal);
    if (seeHier) {
      pflanzeSeerose(lokal, seeHier);
      return;
    }
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

  /* --- etwas wächst aus dem Boden --- */
  const wachsende = [];
  function lassWachsen(objekt, zielGroesse = 1, dauer = 1, vonGroesse = 0) {
    wachsende.push({ objekt, ziel: zielGroesse, von: vonGroesse, zeit: 0, dauer });
  }

  /* --- Sanft verschwinden ---
     Der leere See wird nicht einfach weggenommen: er wird langsam
     durchsichtig, waehrend sich der volle darueberlegt. Dann sieht es
     aus, als wuerde sich der See wirklich mit Wasser fuellen.      */
  const verblassende = [];
  function lassVerblassen(objekt, dauer = 1.2) {
    // eigene Materialien - sonst verblassen alle anderen Seen mit
    objekt.traverse((teil) => {
      if (!teil.isMesh || !teil.material) return;
      teil.material = Array.isArray(teil.material)
        ? teil.material.map((m) => m.clone())
        : teil.material.clone();
      const liste = Array.isArray(teil.material) ? teil.material : [teil.material];
      for (const m of liste) {
        m.transparent = true;
        m.depthWrite = false;
      }
    });
    objekt.renderOrder = -1;             // liegt unter dem Wasser
    verblassende.push({ objekt, zeit: 0, dauer });
  }

  /* --- Regentropfen beim Gießen --- */
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
    'Schau nur, wie grün es geworden ist. Das hast du gemacht.',
    'Manchmal setze ich mich einfach hin und schaue zu, wie es wächst.',
    'Weißt du was? Der Planet summt jetzt manchmal. Ganz leise.',
    'Ich bin froh, dass du da bist.',
    'Wenn du willst, gieße noch ein bisschen. Er mag das sehr.',
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
        seen: seenAufgestellt,
      }));
    } catch (e) { /* macht nichts */ }
  }
  function ladeFortschritt() {
    try {
      return JSON.parse(localStorage.getItem(SPEICHER) || 'null');
    } catch (e) { return null; }
  }

  /** Nach dem Neuladen: so viele Seen wieder hinstellen wie vorher */
  async function stelleSeenWiederHer(anzahl) {
    for (let i = 0; i < anzahl; i++) await lassSeeErscheinen(false);
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
    lassSeeErscheinen, fuelleSee, pflanzeSeerose, istAufDemSee, stelleSeenWiederHer,
    stelleHoehleAuf,
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
  const mondZiel = new THREE.Vector3();
  const blickMitte = new THREE.Vector3();

  function bild() {
    const schritt = Math.min(uhr.getDelta(), 0.05);
    const zeit = zustand.zeit += schritt;

    belebeSterne(zeit);
    /* Wie "gross" sich der Planet beim Schieben anfuehlt.
       Eigentlich ist das genau sein Radius - dann wandert die Stelle
       unter dem Finger exakt mit. Auf einem sehr grossen Planeten
       muesste man dafuer aber ewig wischen, um einmal herumzukommen.
       Darum waechst der Griff ab einer Weile nur noch mit der Wurzel:
       es fuehlt sich weiter richtig an, bleibt aber leicht zu drehen. */
    const GEMUETLICH = 1.6;
    blick.griffRadius = planet.radius <= GEMUETLICH
      ? Math.max(0.35, planet.radius)
      : GEMUETLICH * Math.sqrt(planet.radius / GEMUETLICH);
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
       Beim Erzählen kommt er ein Stück näher und höher, damit er
       nicht hinter dem Planeten verschwindet.                      */
    /* Zum Reden bleibt Lunix stehen - und zwar da, wo du gerade
       hinschaust. Sonst muesste die Kamera hinter ihm herjagen und
       die ganze Welt wuerde dabei wild herumwirbeln.               */
    if (blick.schautZuLunix) {
      if (mondBahn.zielWinkel === null) {
        mondBahn.zielWinkel = Math.PI / 2 - (blick.seite + 0.42);
        blick.hochVorher = blick.hoch;
      }
      if (mondBahn.zeigeObjekt || mondBahn.zeigeRichtung) {
        // Er ist gerade unterwegs zu einer Stelle - die Bahn merkt
        // sich einfach, wo er ist, damit er danach dort weiterfliegt.
        mondBahn.winkel = Math.atan2(mond.position.z, mond.position.x);
      } else {
        let weg = mondBahn.zielWinkel - mondBahn.winkel;
        while (weg > Math.PI) weg -= Math.PI * 2;
        while (weg < -Math.PI) weg += Math.PI * 2;
        mondBahn.winkel += weg * (1 - Math.pow(0.12, schritt));
      }
    } else {
      mondBahn.winkel += schritt * mondBahn.geschwindigkeit;
    }

    /* ---------- AUFRAEUMEN NACH DEM GESPRAECH ----------
       Wenn Lunix fertig ist, muss alles wieder genau so sein wie
       vorher - sonst laesst sich der Planet hinterher nicht mehr
       richtig drehen.                                             */
    if (blick.schautZuLunix) {
      blick.redeteGerade = true;
    } else if (blick.redeteGerade) {
      blick.redeteGerade = false;
      blick.lunixWeite = 1;
      blick.schwungSeite = 0;
      blick.schwungHoch = 0;
      mondBahn.zielWinkel = null;
      lunixZeigtAuf(null);
      // Beim Reden schaut die Kamera zu Lunix hinauf. Danach kommt
      // sie in einen bequemen Bereich zurueck - nicht steil von oben
      // und nicht von unten, sondern schoen auf die Welt.
      blick.hochZurueck = THREE.MathUtils.clamp(
        blick.hochVorher !== null ? blick.hochVorher : blick.hoch, -0.7, 0.7);
      blick.hochVorher = null;
    }

    /* Zurueck zur bequemen Blickhoehe - aber nur, solange du nicht
       selbst wischst. Deine Finger haben immer Vorrang.           */
    if (blick.hochZurueck !== null) {
      blick.hoch += (blick.hochZurueck - blick.hoch)
                    * (1 - Math.pow(0.1, schritt));
      if (Math.abs(blick.hochZurueck - blick.hoch) < 0.01) {
        blick.hochZurueck = null;
      }
    }
    {
      mondBahn.erzaehlNaehe = THREE.MathUtils.lerp(
        mondBahn.erzaehlNaehe, blick.schautZuLunix ? 1 : 0,
        1 - Math.pow(0.05, schritt));

      const stelle = blick.schautZuLunix ? holeZeigeZiel() : null;

      if (stelle) {
        /* Es geht gerade um eine bestimmte Stelle - dahin fliegt
           Lunix. Er stellt sich schraeg darueber, nicht mittendrauf,
           damit er die Stelle nicht verdeckt.                      */
        const hin = stelle.clone().normalize();
        const quer = new THREE.Vector3(0, 1, 0).cross(hin);
        if (quer.lengthSq() < 0.02) quer.set(1, 0, 0);
        quer.normalize();
        mondZiel.copy(hin).multiplyScalar(planet.radius + 0.9 + planet.radius * 0.3)
          .addScaledVector(quer, planet.radius * 0.55)
          .addScaledVector(hin.clone().cross(quer), planet.radius * 0.3);
      } else {
        // Etwas weiter draussen, damit Lunix und der Planet sich
        // nicht ineinander schieben, wenn die Welt gross wird.
        // Beim Reden kommt er ein Stueck naeher heran.
        // Beim Reden kommt er richtig nah heran - dann passen er und
        // die Welt zusammen ins Bild, ohne dass die Kamera weit weg
        // muss. Sonst waere er nur noch ein Pünktchen.
        const r = Math.max(2.6, planet.radius * 2.1 + 2.1)
                  * (1 - mondBahn.erzaehlNaehe * 0.45);
        mondZiel.set(
          Math.cos(mondBahn.winkel) * r,
          Math.sin(mondBahn.winkel * 0.85) * r * mondBahn.neigung
            + mondBahn.erzaehlNaehe * (planet.radius * 0.5 + 0.5),
          Math.sin(mondBahn.winkel) * r
        );
      }
      // immer sanft hinfliegen - nie springen
      mond.position.lerp(mondZiel, 1 - Math.pow(0.02, schritt));
    }
    if (mond.userData.belebe) mond.userData.belebe(zeit, schritt, kamera.position);

    /* --- Die Kamera fliegt um den Planeten und schaut zur Mitte.
           Wenn Lunix redet, schwenkt sie zu ihm hoch - und danach
           wieder runter auf die Welt.                              --- */
    if (blick.schautZuLunix) {
      /* Worauf schaut die Kamera? Auf die Mitte zwischen Lunix und
         der Stelle, um die es geht - dann ist beides im Bild. Geht
         es um nichts Bestimmtes, ist es die Mitte zwischen Lunix
         und dem Planeten.                                          */
      const stelle = holeZeigeZiel();
      if (stelle) blickMitte.copy(stelle).lerp(mond.position, 0.5);
      // ohne bestimmte Stelle schaut die Kamera fast direkt auf Lunix -
      // der Planet ist ja gross genug, um trotzdem im Bild zu sein
      else blickMitte.copy(mond.position).multiplyScalar(0.7);

      // Genau auf diese Mitte schaut die Kamera - damit steht sie in
      // der Bildmitte und Lunix kann gar nicht mehr aus dem Bild
      // rutschen.
      blick.zielZiel.copy(blickMitte);
      // nah genug, dass man erkennt, worum es geht - und weit genug,
      // dass Lunix wirklich zu sehen ist (siehe Sicherheitsnetz unten)
      blick.zielAbstand = Math.max(planet.radius * 2.1 + 2.6,
                                   mond.position.length() * 1.7)
                          * blick.lunixWeite;

      // Die Kamera stellt sich SCHRAEG daneben - dann stehen Planet
      // und Lunix nebeneinander im Bild, statt hintereinander.
      const seiteZiel = Math.atan2(blickMitte.x, blickMitte.z);
      let unterschied = (seiteZiel - 0.42) - blick.seite;
      while (unterschied > Math.PI) unterschied -= Math.PI * 2;
      while (unterschied < -Math.PI) unterschied += Math.PI * 2;
      blick.seite += unterschied * (1 - Math.pow(0.06, schritt));

      const laenge = blickMitte.length() || 1;
      const zielHoch = Math.asin(
        THREE.MathUtils.clamp(blickMitte.y / laenge, -1, 1));
      // Die Kamera stellt sich auf dieselbe Höhe wie die Bildmitte.
      // So liegt Lunix waagerecht vor der Kamera - und über ihm ist
      // Platz für die Sprechblase, statt dass sie ihn verdeckt.
      blick.hoch += (THREE.MathUtils.clamp(zielHoch, -1.2, 1.2) - blick.hoch)
                    * (1 - Math.pow(0.06, schritt));
    } else {
      blick.zielZiel.set(0, 0, 0);
      const normal = zustand.schlaeft ? 4.6 : 2.15 + planet.radius * 2.6;

      /* Wenn der Planet wächst, zoomen wir sanft mit heraus - sonst
         würde er einem plötzlich aus dem Bild wachsen. Hat man selbst
         am Zoom gedreht, wird der Wunsch behutsam mit angepasst. */
      if (planet.radius > blick.letzterRadius + 0.004) {
        const verhaeltnis = (2.15 + blick.letzterRadius * 2.6) / normal;
        blick.zoom = THREE.MathUtils.clamp(
          blick.zoom + (1 - verhaeltnis) * 0.55, 0.58, 1.9);
      }
      blick.letzterRadius = planet.radius;

      // Der Zoom des Spielers - aber nie so nah, dass die Kamera
      // im Planeten steckt.
      // Nie so nah, dass man nur noch Boden sieht: die Kamera bleibt
      // immer weit genug weg, dass man ein gutes Stück Planet im Bild hat.
      blick.zielAbstand = Math.max(planet.radius * 1.6 + 0.7, normal * blick.zoom);
    }
    blick.ziel.lerp(blick.zielZiel, 1 - Math.pow(0.01, schritt));
    /* Wenn Lunix redet, fliegt die Kamera zuegig auf ihre Position -
       sonst tippt man schon auf "weiter", waehrend sie noch unterwegs
       ist, und sieht ihn nie.                                       */
    blick.abstand = THREE.MathUtils.lerp(
      blick.abstand, blick.zielAbstand,
      1 - Math.pow(blick.schautZuLunix ? 0.002 : 0.06, schritt));
    stelleKameraEin();

    /* --- Die Sprechblase klebt an Lunix --- */
    if (blick.schautZuLunix) {
      mond.getWorldPosition(mondOrt);
      const p = mondOrt.clone().project(kamera);

      /* SICHERHEITSNETZ
         Hier wird nachgeschaut, ob Lunix tatsaechlich auf dem Schirm
         ist. Ist er zu weit am Rand (oder hinter der Kamera), geht
         die Kamera ein Stueck weiter weg, bis er wieder da ist. So
         kann er nie wieder "irgendwo" sein, wo man ihn nicht findet. */
      const wieWeitDraussen = Math.max(Math.abs(p.x), Math.abs(p.y));
      if (p.z > 1 || wieWeitDraussen > 0.62) {
        // schnell genug, dass es auch dann klappt, wenn man gleich
        // wieder auf "weiter" tippt
        blick.lunixWeite = Math.min(3, blick.lunixWeite * 1.12);
      } else if (wieWeitDraussen < 0.44 && blick.lunixWeite > 1) {
        blick.lunixWeite = Math.max(1, blick.lunixWeite * 0.985);
      }
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
      if (w.von) {
        // von einer Groesse zur anderen - ruhig, ohne Federn
        const weich = t * t * (3 - 2 * t);
        w.objekt.scale.setScalar(w.von + (w.ziel - w.von) * weich);
      } else {
        // erst schnell, dann federt es kurz nach
        const federn = 1 + Math.sin(t * Math.PI * 1.2) * 0.16 * (1 - t);
        w.objekt.scale.setScalar(w.ziel * t * federn);
      }
      if (t >= 1) {
        w.objekt.scale.setScalar(w.ziel);
        wachsende.splice(i, 1);
      }
    }

    /* --- Sachen, die gerade verblassen --- */
    for (let i = verblassende.length - 1; i >= 0; i--) {
      const v = verblassende[i];
      v.zeit += schritt;
      const t = Math.min(1, v.zeit / v.dauer);
      v.objekt.traverse((teil) => {
        if (!teil.isMesh || !teil.material) return;
        const liste = Array.isArray(teil.material) ? teil.material : [teil.material];
        for (const m of liste) m.opacity = 1 - t;
      });
      if (t >= 1) {
        planet.nimmWeg(v.objekt);
        verblassende.splice(i, 1);
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
