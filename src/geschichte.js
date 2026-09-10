/* ==================================================================
   DIE GESCHICHTE

   Das ist der Teil, den du am leichtesten aendern kannst!
   Jedes Kapitel hat zwei Sachen:

     spiel:  was passiert, wenn du das Kapitel zum ersten Mal spielst
     sofort: wie die Welt aussehen soll, wenn du das Kapitel schon
             geschafft hast (damit nach dem Neuladen alles da ist)

   Der Mond redet mit  await s.mondSagt([...])
   Warten auf etwas mit await s.warteAufTipp(...) / s.warteBis(...)
   ================================================================== */

import * as THREE from 'three';

/* ---------- Wo steht was auf dem Planeten? ----------
   Ein Vektor zeigt vom Mittelpunkt nach draussen.
   (0,0,1) = vorne (zu dir),  (0,0,-1) = hinten,  (0,1,0) = oben     */
const ORTE = {
  grasTrocken: [
    [0.18, 0.28, 0.94], [-0.38, 0.12, 0.92], [0.44, -0.22, 0.87],
    [0.92, 0.3, 0.25], [-0.86, 0.22, -0.32], [0.12, 0.44, -0.89],
    [-0.22, -0.34, -0.91], [0.3, -0.75, 0.55], [-0.62, 0.68, 0.4],
    [0.7, 0.55, -0.45], [-0.5, -0.6, -0.6], [0.05, -0.35, 0.93],
  ],
  giesskanne: [0.28, 0.16, -0.95],
  samentuete: [-0.92, 0.26, 0.3],
  setzling:   [0.46, 0.62, 0.62],
  haeschen:   [0.15, 0.9, 0.4],
  deko: [
    [-0.55, 0.55, 0.62], [0.7, -0.45, -0.55], [-0.35, -0.8, 0.48],
    [0.85, 0.42, -0.32], [-0.72, -0.28, -0.62], [0.05, -0.95, -0.3],
    [0.62, 0.72, -0.3], [-0.15, 0.35, 0.92],
  ],
};

const v = (a) => new THREE.Vector3(a[0], a[1], a[2]).normalize();

/* ================================================================
   Hilfen, die mehrere Kapitel brauchen
   ================================================================ */

/** Alles trockene Gras auf den Planeten stellen */
function stelleTrockenesGrasAuf(s, wieViele = 12) {
  ORTE.grasTrocken.slice(0, wieViele).forEach((ort, i) => {
    const gras = s.bauer.baueGras({ groesse: 1, trocken: true, startzahl: i + 1 });
    s.planet.stelleAuf(gras, v(ort), { einsinken: 0.015, drehung: i * 1.3 });
  });
  // dazu die selbst gemalten vertrockneten Blubber-Blumen
  s.stelleTrockeneBlumenAuf();
}

/** Ein Ding zum Aufheben hinlegen - mit Funkeln, damit man es sieht */
function legeHin(s, objekt, ort) {
  s.planet.stelleAuf(objekt, v(ort), { einsinken: 0.01 });
  const schimmer = s.bauer.baueSchimmer({ groesse: 1.8 });
  objekt.add(schimmer);
  objekt.userData.schimmer = schimmer;
  const altesBeleben = objekt.userData.belebe;
  objekt.userData.belebe = (zeit, schritt) => {
    if (altesBeleben) altesBeleben(zeit, schritt);
    schimmer.userData.belebe(zeit, schritt);
  };
  return objekt;
}

/** Deko-Stuecke, die bei jedem Wachsen neu zum Vorschein kommen */
const dekoBauer = [
  (s, i) => s.bauer.baueStein({ groesse: 0.8, startzahl: i + 10 }),
  (s, i) => s.bauer.bauePilz({ groesse: 1, startzahl: i + 20 }),
  (s, i) => s.bauer.baueBusch({ groesse: 0.9, startzahl: i + 30 }),
  (s, i) => s.bauer.baueGras({ groesse: 0.9, trocken: false, startzahl: i + 40 }),
  (s, i) => s.bauer.bauePilz({ groesse: 0.8, startzahl: i + 50 }),
  (s, i) => s.bauer.baueBusch({ groesse: 1.05, startzahl: i + 60 }),
  (s, i) => s.bauer.baueStein({ groesse: 1.1, startzahl: i + 70 }),
  (s, i) => s.bauer.baueGras({ groesse: 1.1, trocken: false, startzahl: i + 80 }),
];

/**
 * "Ein neuer Teil kommt zum Vorschein" - immer wenn die Welt
 * waechst, taucht an einer neuen Stelle etwas auf.
 */
function enthuelleNeuesStueck(s, nummer, mitFunken = true) {
  const i = nummer % ORTE.deko.length;
  const ort = ORTE.deko[i];
  const objekt = dekoBauer[i % dekoBauer.length](s, i);
  objekt.scale.setScalar(0.05);
  s.planet.stelleAuf(objekt, v(ort), { einsinken: 0.015, drehung: i * 0.9 });
  s.lassWachsen(objekt, 1, 1.2);
  s.planet.maleGruen(v(ort), 0.28, 0.7);
  if (mitFunken) {
    s.funkeBei(objekt.getWorldPosition(new THREE.Vector3()), 5);
    s.klang.klangFunke();
  }
  return objekt;
}

/** Schmetterlinge einfliegen lassen */
function lassFalterFliegen(s, anzahl = 3) {
  const farben = ['#ff9d3c', '#f492b4', '#8fd0f0', '#ffd75e'];
  for (let i = 0; i < anzahl; i++) {
    const falter = s.bauer.baueSchmetterling({
      groesse: 0.85, farbe: farben[i % farben.length], startzahl: i + 1,
    });
    falter.userData.flug = {
      winkel: (i / anzahl) * Math.PI * 2,
      tempo: 0.35 + i * 0.09,
      hoehe: 0.32 + i * 0.11,
      neigung: (i - 1) * 0.35,
      phase: i * 1.7,
    };
    s.szene.add(falter);
    s.falter.push(falter);
  }
}

/* ================================================================
   DIE KAPITEL
   ================================================================ */

const kapitel = [

  /* ---------------------------------------------------------------
     0 - EIN KLEINER PUNKT IM DUNKELN
     --------------------------------------------------------------- */
  {
    id: 'der-punkt',
    sofort: () => {},
    spiel: async (s) => {
      s.mond.setzeGefuehl('traurig');
      s.ui.setzeTitelHinweis('Tippe auf das Licht');
      await s.warteAufTipp(['kern', 'mond']);

      s.weckeWelt();
      s.mond.setzeGefuehl('staunen');
      s.funkeBei(new THREE.Vector3(0, 0, 0), 10);
      await s.warte(1.4);

      await s.mondSagt([
        'Oh! Du hast das Licht angetippt.',
        'Du kannst mich sehen? Wirklich?',
        'Hallo. Ich bin Lunix.',
      ], 'staunen');
      await s.mondSagt([
        'Eigentlich sollte ich Luna heissen. Wie alle Monde.',
        'Aber auf meinem Planeten war ja nix mehr. Also: Lunix.',
      ], 'traurig');
    },
  },

  /* ---------------------------------------------------------------
     1 - DER MOND ERZAEHLT VON SEINEM PLANETEN
     --------------------------------------------------------------- */
  {
    id: 'die-traurige-geschichte',
    sofort: (s) => {
      s.planet.setzeRadius(0.62);
      s.planet.wachseAuf(0.62);
      stelleTrockenesGrasAuf(s);
      s.zustand.schlaeft = false;
      s.ui.versteckTitel();
    },
    spiel: async (s) => {
      await s.mondSagt([
        'Dieses kleine Licht da... das ist mein Planet.',
        'Meinem Planeten ging es so schlecht, dass er sich immer kleiner gefuehlt hat.',
        'Bis er am Ende ganz winzig wurde. Weil er dachte, niemand interessiert sich fuer so einen kleinen Planeten.',
        'Streichel ihn doch mal. Damit er merkt, dass du da bist.',
      ], 'traurig');

      await s.warteAufStreicheln(10, 'streichel den Punkt: Finger hin und her');

      // Der Planet traut sich wieder heraus
      s.zeigePlanet(0.62);
      s.mond.setzeGefuehl('staunen');
      await s.warte(1.6);
      stelleTrockenesGrasAuf(s);
      s.funkeBei(new THREE.Vector3(0, 0, 0), 12);
      await s.warte(0.8);

      await s.mondSagt([
        'Da ist er ja wieder!',
        'Vielen Dank!',
      ], 'gluecklich');
      s.ui.gibStern();
    },
  },

  /* ---------------------------------------------------------------
     2 - DIE GIESSKANNE SUCHEN
     --------------------------------------------------------------- */
  {
    id: 'giesskanne-finden',
    sofort: (s) => {
      s.ui.fuegeWerkzeugHinzu('giesskanne', 'bilder/icon-giesskanne.svg', 'Giesskanne');
    },
    spiel: async (s) => {
      await s.mondSagt([
        'Schau nur, sein Gras ist ganz vertrocknet.',
        'Und seine Blubber-Blumen haengen alle traurig herunter.',
        'Er hat so lange keinen Regen mehr gehabt.',
        'Irgendwo liegt noch meine alte Giesskanne. Dreh den Planeten mal um - sie muss auf der anderen Seite sein!',
      ], 'normal');

      const kanne = legeHin(s, s.bauer.baueGiesskanne({ groesse: 1.5 }), ORTE.giesskanne);
      const treffer = await s.warteAufTipp('giesskanne', 'dreh den Planeten und suche die Giesskanne');

      // aufheben
      s.klang.klangPlopp();
      s.funkeBei(treffer.punkt, 5);
      s.planet.nimmWeg(kanne);
      s.ui.fuegeWerkzeugHinzu('giesskanne', 'bilder/icon-giesskanne.svg', 'Giesskanne');

      await s.mondSagt([
        'Da ist sie ja! Die habe ich seit Ewigkeiten nicht mehr gesehen.',
        'Tipp jetzt auf das trockene Gras oder auf eine welke Blume. Dann giesst du sie.',
      ], 'gluecklich');
    },
  },

  /* ---------------------------------------------------------------
     3 - DAS ERSTE MAL GIESSEN
     --------------------------------------------------------------- */
  {
    id: 'zum-ersten-mal-giessen',
    sofort: (s) => {
      // drei Buescheln sind schon gegossen
      const trockene = s.planet.aufgestellt.filter((o) => o.userData.typ === 'gras-trocken');
      trockene.slice(0, 3).forEach((g) => s.tauscheGrasAus(g));
      s.planet.maleGruen(v(ORTE.grasTrocken[0]), 0.4, 1);
      s.planet.maleGruen(v(ORTE.grasTrocken[1]), 0.4, 1);
      s.planet.wachseAuf(0.78);
      s.planet.setzeRadius(0.78);
      enthuelleNeuesStueck(s, 0, false);
      s.stelleApfelbaeumeAuf();
    },
    spiel: async (s) => {
      const anfang = s.zaehle('gras-trocken');
      await s.warteBis(
        () => s.zaehle('gras-trocken') <= anfang - 3,
        'tippe das trockene Gras an'
      );

      s.mond.setzeGefuehl('staunen');
      await s.warte(0.6);
      s.lasseWeltWachsen(0.08);
      enthuelleNeuesStueck(s, 0);
      await s.warte(1.2);

      await s.mondSagt([
        'Hast du das gesehen?!',
        'Er ist ein kleines Stueck groesser geworden!',
        'So ist das: Wenn du ihm etwas Gutes tust, waechst er. Weil er sich wieder wichtig fuehlt.',
      ], 'gluecklich');

      // Weil der Planet gewachsen ist, kommt ein Stueck von ihm zum
      // Vorschein, das vorher nicht da war: seine Apfelbaeume.
      await s.stelleApfelbaeumeAuf();
      await s.warte(1.4);
      await s.mondSagt([
        'Warte mal ... da ist noch etwas!',
        'Seine Apfelbaeume! Die hatte ich ganz vergessen.',
        'Sie sind auch alle vertrocknet. Giess sie doch mal.',
      ], 'staunen');
    },
  },

  /* ---------------------------------------------------------------
     4 - DIE APFELBAEUME AUFWECKEN
     --------------------------------------------------------------- */
  {
    id: 'die-apfelbaeume',
    sofort: (s) => {
      s.planet.wachseAuf(0.92);
      s.planet.setzeRadius(0.92);
      // die Baeume stehen schon gruen da
      s.stelleApfelbaeumeAuf().then(() => {
        const welke = s.planet.aufgestellt.filter((o) => o.userData.typ === 'apfelbaum-trocken');
        welke.forEach((b) => s.verwandleBaum(b));
      });
      enthuelleNeuesStueck(s, 2, false);
    },
    spiel: async (s) => {
      await s.warteBis(
        () => s.zaehle('apfelbaum-trocken') === 0 && s.zaehle('apfelbaum') > 0,
        'giesse die Apfelbaeume'
      );
      await s.warte(1.8);

      s.lasseWeltWachsen(0.1);
      enthuelleNeuesStueck(s, 2);
      await s.warte(1);

      await s.mondSagt([
        'Aepfel! Richtige, echte Aepfel!',
        'Weisst du, was das Beste an einem Baum ist? Er bleibt.',
        'Auch wenn du mal nicht da bist.',
      ], 'gluecklich');
    },
  },

  /* ---------------------------------------------------------------
     5 - SAMEN PFLANZEN
     --------------------------------------------------------------- */
  {
    id: 'samen-pflanzen',
    sofort: (s) => {
      s.ui.fuegeWerkzeugHinzu('samentuete', 'bilder/icon-samentuete.svg', 'Samen');
      // ein paar Blumen stehen schon
      [[0.3, 0.4, 0.86], [-0.4, 0.5, 0.76], [0.6, 0.1, 0.79]].forEach((ort, i) => {
        const blume = s.bauer.baueBlume({
          groesse: 0.85, sorte: ['rosa', 'gelb', 'lila'][i], startzahl: i + 100,
        });
        s.planet.stelleAuf(blume, v(ort), { einsinken: 0.01, drehung: i });
        s.planet.maleGruen(v(ort), 0.22, 0.6);
      });
      s.planet.wachseAuf(0.78);
      s.planet.setzeRadius(0.78);
      enthuelleNeuesStueck(s, 1, false);
    },
    spiel: async (s) => {
      const tuete = legeHin(s, s.bauer.baueSamentuete({ groesse: 1.8 }), ORTE.samentuete);
      s.klang.klangFunke();

      await s.mondSagt([
        'Warte mal... da ist noch etwas aufgetaucht.',
        'Dreh ihn nochmal. Ich glaube, das ist eine Samentuete!',
      ], 'staunen');

      const treffer = await s.warteAufTipp('samentuete', 'suche die Samentuete');
      s.klang.klangPlopp();
      s.funkeBei(treffer.punkt, 5);
      s.planet.nimmWeg(tuete);
      s.ui.fuegeWerkzeugHinzu('samentuete', 'bilder/icon-samentuete.svg', 'Samen');

      await s.mondSagt([
        'Blumensamen! Die hat er sich immer gewuenscht.',
        'Nimm die Samentuete und tippe auf den Boden. Dann waechst dort eine Blume.',
      ], 'gluecklich');

      const vorher = s.zustand.gepflanzt;
      await s.warteBis(() => s.zustand.gepflanzt >= vorher + 3, 'pflanze drei Blumen');

      s.lasseWeltWachsen(0.08);
      enthuelleNeuesStueck(s, 1);
      await s.warte(1.2);
      await s.mondSagt([
        'Ohhh. Er hat Blumen.',
        'Er hatte noch nie Blumen.',
      ], 'gluecklich');
    },
  },

  /* ---------------------------------------------------------------
     6 - DIE WOLKE UND DIE SCHMETTERLINGE
     --------------------------------------------------------------- */
  {
    id: 'die-wolke',
    sofort: (s) => {
      const wolke = s.bauer.baueWolke({ groesse: 1.1, startzahl: 2 });
      wolke.position.set(1.15, 0.95, 0.7);
      s.szene.add(wolke);
      s.wolke = wolke;
      // alles ist gruen geworden
      ORTE.grasTrocken.forEach((ort) => s.planet.maleGruen(v(ort), 0.5, 1));
      ORTE.deko.forEach((ort) => s.planet.maleGruen(v(ort), 0.45, 1));
      lassFalterFliegen(s, 3);
      s.planet.wachseAuf(0.97);
      s.planet.setzeRadius(0.97);
      enthuelleNeuesStueck(s, 3, false);
    },
    spiel: async (s) => {
      await s.mondSagt([
        'Riechst du das?',
        'Das riecht nach Regen. Das hat es hier seit Ewigkeiten nicht mehr gegeben.',
      ], 'staunen');

      // Eine Wolke kommt angeschwebt
      const wolke = s.bauer.baueWolke({ groesse: 1.1, startzahl: 2 });
      wolke.position.set(4.5, 2.2, 1.2);
      s.szene.add(wolke);
      s.wolke = wolke;

      const ziel = new THREE.Vector3(1.15, 0.95, 0.7);
      for (let i = 0; i < 70; i++) {
        wolke.position.lerp(ziel, 0.06);
        await new Promise((f) => requestAnimationFrame(f));
      }

      await s.mondSagt(['Da kommt sie! Halt dich fest.'], 'gluecklich');

      wolke.regne(true);
      s.klang.klangGiessen();
      // der Regen macht den ganzen Planeten gruen
      for (let i = 0; i < ORTE.grasTrocken.length; i++) {
        s.planet.maleGruen(v(ORTE.grasTrocken[i]), 0.5, 0.6);
        s.klang.klangFunke();
        await s.warte(0.35);
      }
      ORTE.deko.forEach((ort) => s.planet.maleGruen(v(ort), 0.42, 0.8));

      // restliches trockenes Gras wird gesund
      const trockene = s.planet.aufgestellt.filter((o) => o.userData.typ === 'gras-trocken');
      for (const g of trockene) { s.tauscheGrasAus(g); await s.warte(0.2); }
      await s.warte(1.5);
      wolke.regne(false);

      s.lasseWeltWachsen(0.1);
      enthuelleNeuesStueck(s, 3);
      await s.warte(0.8);

      lassFalterFliegen(s, 3);
      s.klang.klangTier();
      await s.mondSagt([
        'Schmetterlinge!',
        'Die kommen nur, wenn es Blumen gibt. Sie haben deine gefunden.',
      ], 'gluecklich');
    },
  },

  /* ---------------------------------------------------------------
     7 - DAS HAESCHEN ZIEHT EIN
     --------------------------------------------------------------- */
  {
    id: 'das-haeschen',
    sofort: (s) => {
      const hase = s.bauer.baueHaeschen({ groesse: 1, startzahl: 5 });
      s.planet.stelleAuf(hase, v(ORTE.haeschen), { einsinken: 0.01 });
      s.planet.wachseAuf(1.06);
      s.planet.setzeRadius(1.06);
      enthuelleNeuesStueck(s, 4, false);
    },
    spiel: async (s) => {
      await s.mondSagt(['Psst. Schau mal ganz nach oben. Aber leise!'], 'staunen');

      const hase = s.bauer.baueHaeschen({ groesse: 1, startzahl: 5 });
      hase.scale.setScalar(0.05);
      s.planet.stelleAuf(hase, v(ORTE.haeschen), { einsinken: 0.01 });
      s.lassWachsen(hase, 1, 1);
      s.klang.klangTier();
      s.funkeBei(hase.getWorldPosition(new THREE.Vector3()), 6);
      await s.warte(1.4);

      await s.mondSagt([
        'Ein Haeschen ist eingezogen!',
        'Es hat sich einfach ein Plaetzchen gesucht und gesagt: hier bleibe ich.',
        'Du kannst es streicheln, wenn du willst. Tipp es einfach an.',
      ], 'gluecklich');

      s.lasseWeltWachsen(0.09);
      enthuelleNeuesStueck(s, 4);
    },
  },

  /* ---------------------------------------------------------------
     8 - DANKE (und dann darf man einfach weiterspielen)
     --------------------------------------------------------------- */
  {
    id: 'danke',
    sofort: (s) => {
      s.planet.wachseAuf(1.14);
      s.planet.setzeRadius(1.14);
      enthuelleNeuesStueck(s, 5, false);
      enthuelleNeuesStueck(s, 6, false);
      s.ui.setzeSterne(6);
    },
    spiel: async (s) => {
      await s.warte(1);
      await s.mondSagt([
        'Darf ich dir etwas sagen?',
        'Als du gekommen bist, war er ein winziger, trauriger Punkt.',
        'Jetzt hat er Gras und Blumen und einen Baum und ein Haeschen.',
        'Und er ist gewachsen. Bei jedem Mal ein kleines Stueck.',
        'Danke, dass du da warst.',
      ], 'gluecklich');

      s.lasseWeltWachsen(0.08);
      enthuelleNeuesStueck(s, 5);
      enthuelleNeuesStueck(s, 6);
      await s.warte(1.2);

      await s.mondSagt([
        'Du kannst weitermachen, so lange du magst.',
        'Giesse, pflanze Blumen, streichel das Haeschen. Er freut sich ueber jedes Mal.',
        'Und wenn du reden willst: tipp mich einfach an.',
      ], 'gluecklich');

      s.ui.zeigeHinweis('Giesse und pflanze, so viel du magst');
      setTimeout(() => s.ui.zeigeHinweis(''), 6000);
    },
  },
];

/* ================================================================
   DIE GESCHICHTE ABSPIELEN
   ================================================================ */
export async function erzaehleGeschichte(spiel, gespeichert) {
  let ab = 0;

  if (gespeichert && gespeichert.kapitel > 0) {
    ab = Math.min(gespeichert.kapitel, kapitel.length - 1);
    // Die Welt ist schon wach: kein Titel, und der Planet ist da.
    spiel.ui.versteckTitel();
    spiel.zustand.schlaeft = false;
    // Die Welt so herstellen, wie sie am Ende des letzten Kapitels war
    for (let i = 0; i < ab; i++) {
      try {
        kapitel[i].sofort(spiel);
      } catch (fehler) {
        console.warn('Kapitel', kapitel[i].id, 'konnte nicht hergestellt werden:', fehler);
      }
    }
    spiel.ui.setzeSterne(Math.max(0, ab - 1));
    spiel.zustand.gegossen = gespeichert.gegossen || 0;
    spiel.zustand.gepflanzt = gespeichert.gepflanzt || 0;
  }

  for (let i = ab; i < kapitel.length; i++) {
    spiel.setzeKapitel(i);
    try {
      await kapitel[i].spiel(spiel);
    } catch (fehler) {
      console.error('Fehler im Kapitel', kapitel[i].id, fehler);
    }
  }
  spiel.setzeKapitel(kapitel.length);
}

export const kapitelNamen = kapitel.map((k) => k.id);
