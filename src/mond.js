/* ==================================================================
   DER MOND

   Er ist der Freund, der die Geschichte erzählt.
   Sein Kopf ist eine Pappmache-Kugel, sein Gesicht besteht aus
   aufgeklebten Schnipseln: zwei Augen mit Pupillen, zwei Brauen,
   ein Mund, zwei Wangen - und eine Traene für traurige Momente.

   Alles davon kann sich bewegen: er blinzelt, schaut umher,
   und wenn er redet, klappt sein Mund auf und zu.
   ================================================================== */

import * as THREE from 'three';
import { macheSchnipsel, machGemaltesBild, backeZusammen, machWuerfel, tone } from './schnipsel.js';

const RADIUS = 0.31;

export function baueMond() {
  const mond = new THREE.Group();

  /* ---------- Kopf: eine gemalte Pappmache-Kugel ---------- */
  const kopfBild = machGemaltesBild({
    grund: '#fdf3d8',
    striche: ['#ffffff', '#f3e4bf', '#fffdf2', '#e8d5ac'],
    anzahl: 900,
    strichGroesse: 30,
    startzahl: 42,
  });
  const kopf = new THREE.Mesh(
    new THREE.IcosahedronGeometry(RADIUS, 3),
    new THREE.MeshStandardMaterial({
      map: kopfBild,
      color: 0xfff8e4,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
      emissive: 0xffe9b0,
      emissiveIntensity: 0.16,
    })
  );
  kopf.castShadow = false;
  mond.add(kopf);

  /* ---------- Krater ---------- */
  const kraterOrte = [
    [-0.6, 0.55, 0.5, 0.16], [0.75, 0.3, 0.35, 0.2],
    [-0.35, -0.7, 0.5, 0.12], [0.5, -0.6, -0.5, 0.14],
    [-0.9, 0.1, -0.4, 0.17], [0.1, 0.9, -0.35, 0.13],
  ];
  for (const [x, y, z, gr] of kraterOrte) {
    const richtung = new THREE.Vector3(x, y, z).normalize();
    const krater = macheSchnipsel({
      bild: 'krater',
      farbe: '#efdcb4',
      hoehe: gr,
      woelbung: 0.03,
    });
    krater.position.copy(richtung.clone().multiplyScalar(RADIUS * 0.995));
    krater.lookAt(richtung.clone().multiplyScalar(RADIUS * 2));
    mond.add(krater);
  }

  /* ---------- RINGE ----------
     Aus vielen kleinen Papierstückchen auf eine Kreisbahn geklebt.
     Sie sind vom Kopf entkoppelt: während das Gesicht dich anschaut,
     behalten die Ringe ihre eigene Neigung im Weltall.              */
  const ringe = new THREE.Group();
  mond.add(ringe);
  {
    const w = machWuerfel(4711);
    const ringSorten = [
      { r: RADIUS * 1.75, stuecke: 28, laenge: 0.18, farbe: '#f7dfae' },
      { r: RADIUS * 2.15, stuecke: 32, laenge: 0.15, farbe: '#d6b4ea' },
      { r: RADIUS * 2.5,  stuecke: 24, laenge: 0.12, farbe: '#a8cdf0' },
    ];
    const gebacken = new THREE.Group();
    for (const sorte of ringSorten) {
      for (let i = 0; i < sorte.stuecke; i++) {
        const speiche = new THREE.Object3D();
        speiche.rotation.y = (i / sorte.stuecke) * Math.PI * 2 + w(-0.06, 0.06);

        const stueck = macheSchnipsel({
          bild: i % 4 === 0 ? 'klecks' : 'streifen',
          farbe: tone(sorte.farbe, w(-0.06, 0.08)),
          hoehe: sorte.laenge * w(0.8, 1.25),
          woelbung: 0.015,
        });
        stueck.position.set(0, w(-0.014, 0.014), sorte.r * w(0.94, 1.06));
        // flach hinlegen (rotation.x) und entlang der Kreisbahn
        // ausrichten (rotation.z) - so entsteht ein Band, keine Speichen
        stueck.rotation.set(-Math.PI / 2 + w(-0.14, 0.14), 0, Math.PI / 2 + w(-0.2, 0.2));
        stueck.scale.x = 0.8;
        speiche.add(stueck);
        gebacken.add(speiche);
      }
    }
    ringe.add(gebacken);
    backeZusammen(gebacken);

    /* Wichtig: die Ringe sind viel breiter als der Mond selbst.
       Wuerden sie Fingertipps abfangen, könnte man nichts mehr
       antippen, was dahinter liegt (zum Beispiel den Planeten).
       Darum sind sie für Beruehrungen unsichtbar.                  */
    ringe.traverse((teil) => {
      if (teil.isMesh) teil.raycast = () => {};
    });
  }

  /* ---------- Gesicht ---------- */
  // Ein Teil wird so auf die Kugel geklebt, dass es nach vorne schaut.
  function klebeAufKugel(netz, x, y, abstand = 1.008) {
    const z = Math.sqrt(Math.max(0.04, 1 - x * x - y * y));
    const richtung = new THREE.Vector3(x, y, z).normalize();
    netz.position.copy(richtung.clone().multiplyScalar(RADIUS * abstand));
    netz.lookAt(richtung.clone().multiplyScalar(RADIUS * 3));
    netz.userData.grundOrt = netz.position.clone();
    netz.userData.grundDrehung = netz.quaternion.clone();
    return netz;
  }

  const gesicht = new THREE.Group();
  mond.add(gesicht);

  const augen = [];
  const pupillen = [];
  const brauen = [];
  for (const seite of [-1, 1]) {
    const auge = macheSchnipsel({ bild: 'auge', farbe: '#fffdf6', hoehe: 0.17, woelbung: 0.02 });
    klebeAufKugel(auge, seite * 0.3, 0.1);
    auge.userData.beweglich = true;
    gesicht.add(auge);
    augen.push(auge);

    const pupille = macheSchnipsel({ bild: 'pupille', farbe: '#4a3628', hoehe: 0.1, woelbung: 0.01 });
    klebeAufKugel(pupille, seite * 0.3, 0.1, 1.055);
    pupille.userData.beweglich = true;
    pupille.userData.mitte = pupille.position.clone();
    gesicht.add(pupille);
    pupillen.push(pupille);

    const braue = macheSchnipsel({ bild: 'braue', farbe: '#4a3628', hoehe: 0.055, woelbung: 0.02 });
    klebeAufKugel(braue, seite * 0.31, 0.38, 1.02);
    braue.scale.x = seite;      // die rechte Braue spiegeln
    braue.userData.beweglich = true;
    gesicht.add(braue);
    brauen.push(braue);
  }

  const wangen = [];
  for (const seite of [-1, 1]) {
    const wange = macheSchnipsel({
      bild: 'wange', farbe: '#ff9d84', hoehe: 0.12, woelbung: 0.02, durchsichtig: true,
    });
    klebeAufKugel(wange, seite * 0.48, -0.16, 1.015);
    wange.material.opacity = 0.5;
    wange.userData.beweglich = true;
    gesicht.add(wange);
    wangen.push(wange);
  }

  // Drei Muender - immer nur einer ist sichtbar
  const muender = {};
  for (const [name, bild, hoehe] of [
    ['froh', 'mund-laecheln', 0.1],
    ['offen', 'mund-o', 0.11],
    ['traurig', 'mund-traurig', 0.085],
  ]) {
    const m = macheSchnipsel({ bild, farbe: '#4a3628', hoehe, woelbung: 0.02 });
    klebeAufKugel(m, 0, -0.36, 1.02);
    m.userData.beweglich = true;
    m.visible = name === 'froh';
    gesicht.add(m);
    muender[name] = m;
  }

  const traene = macheSchnipsel({ bild: 'tropfen', farbe: '#7ec8f0', hoehe: 0.07, woelbung: 0.02 });
  klebeAufKugel(traene, 0.42, -0.1, 1.03);
  traene.visible = false;
  traene.userData.beweglich = true;
  gesicht.add(traene);

  /* ---------- Zustand ---------- */
  const z = {
    gefuehl: 'normal',
    redet: false,
    blinzelt: 0,
    naechstesBlinzeln: 2,
    blick: new THREE.Vector2(0, 0),
    blickZiel: new THREE.Vector2(0, 0),
    naechsterBlick: 1.5,
    mundOffen: 0,
  };

  /* ---------- Gefuehle ---------- */
  mond.setzeGefuehl = (gefuehl) => {
    z.gefuehl = gefuehl;
    traene.visible = gefuehl === 'traurig';
    for (const name of Object.keys(muender)) muender[name].visible = false;

    if (gefuehl === 'traurig') {
      muender.traurig.visible = true;
      brauen.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * -0.42; b.position.y = b.userData.grundOrt.y - 0.035; });
      wangen.forEach((w) => { w.material.opacity = 0.3; });
    } else if (gefuehl === 'gluecklich') {
      muender.froh.visible = true;
      brauen.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * 0.28; b.position.y = b.userData.grundOrt.y + 0.025; });
      wangen.forEach((w) => { w.material.opacity = 0.72; });
    } else if (gefuehl === 'staunen') {
      muender.offen.visible = true;
      brauen.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * 0.1; b.position.y = b.userData.grundOrt.y + 0.05; });
      wangen.forEach((w) => { w.material.opacity = 0.45; });
    } else {
      muender.froh.visible = true;
      brauen.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * 0.06; b.position.y = b.userData.grundOrt.y; });
      wangen.forEach((w) => { w.material.opacity = 0.5; });
    }
  };

  mond.redeAn = (an) => {
    z.redet = an;
    if (!an) mond.setzeGefuehl(z.gefuehl);
  };

  /** Der Mond schaut zu einem Punkt (z.B. zum Planeten oder zu dir). */
  mond.schauNach = (x, y) => {
    z.blickZiel.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
    z.naechsterBlick = 2.5;
  };

  /* ---------- Leben ---------- */
  mond.userData.belebe = (zeit, schritt, kameraOrt) => {
    // Immer mit dem Gesicht zur Kamera
    if (kameraOrt) {
      const blick = kameraOrt.clone().sub(mond.position).normalize();
      const ziel = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), blick);
      mond.quaternion.slerp(ziel, 0.12);
    }

    // Blinzeln
    z.naechstesBlinzeln -= schritt;
    if (z.naechstesBlinzeln <= 0) {
      z.blinzelt = 0.16;
      z.naechstesBlinzeln = 2.2 + Math.random() * 4;
    }
    let augenHoehe = 1;
    if (z.blinzelt > 0) {
      z.blinzelt -= schritt;
      const t = Math.max(0, z.blinzelt) / 0.16;
      augenHoehe = Math.abs(Math.sin(t * Math.PI)) * 0.85 + 0.15;
      augenHoehe = 1 - (1 - augenHoehe);
      augenHoehe = 0.12 + 0.88 * Math.abs(Math.cos(t * Math.PI));
    }
    if (z.gefuehl === 'gluecklich') augenHoehe *= 0.72;
    augen.forEach((a) => { a.scale.y = augenHoehe; });
    pupillen.forEach((p) => { p.scale.y = augenHoehe; p.visible = augenHoehe > 0.3; });

    // Umherschauen
    z.naechsterBlick -= schritt;
    if (z.naechsterBlick <= 0) {
      z.blickZiel.set((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.6);
      z.naechsterBlick = 1.4 + Math.random() * 2.6;
    }
    z.blick.lerp(z.blickZiel, 1 - Math.pow(0.001, schritt));
    pupillen.forEach((p) => {
      p.position.x = p.userData.mitte.x + z.blick.x * 0.028;
      p.position.y = p.userData.mitte.y + z.blick.y * 0.022;
    });

    // Reden: der Mund klappt auf und zu
    if (z.redet) {
      const auf = (Math.sin(zeit * 17) * 0.5 + 0.5) * (Math.sin(zeit * 6.3) * 0.35 + 0.65);
      z.mundOffen += (auf - z.mundOffen) * 0.4;
      const zeigeOffen = z.mundOffen > 0.35;
      muender.offen.visible = zeigeOffen;
      muender.froh.visible = !zeigeOffen && z.gefuehl !== 'traurig';
      muender.traurig.visible = !zeigeOffen && z.gefuehl === 'traurig';
      muender.offen.scale.set(0.7 + z.mundOffen * 0.5, 0.45 + z.mundOffen * 0.9, 1);
    } else {
      muender.offen.scale.set(1, 1, 1);
    }

    // sanftes Schweben und Nicken
    gesicht.rotation.z = Math.sin(zeit * 0.8) * 0.03;
    kopf.rotation.y = Math.sin(zeit * 0.25) * 0.12;

    // Die Ringe machen die Kopfdrehung rueckgaengig und behalten
    // ihre eigene Neigung - so wie bei einem echten Ringplaneten.
    ringe.quaternion.copy(mond.quaternion).invert();
    ringe.rotateX(0.34);
    ringe.rotateZ(0.12);
    ringe.rotateY(zeit * 0.11);
  };

  mond.setzeGefuehl('normal');
  mond.userData.radius = RADIUS;
  mond.userData.typ = 'mond';
  mond.userData.antippbar = true;
  return mond;
}
