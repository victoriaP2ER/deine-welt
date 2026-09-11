/* ==================================================================
   BEDIENUNG

   Wischen laesst die KAMERA um den Planeten fliegen - der Planet
   selbst steht still. Darum ziehen auch die Sterne im Hintergrund
   vorbei, so als würde man wirklich um ihn herumfliegen.

   Der Blick zeigt dabei immer zur Mitte.
   ================================================================== */

import * as THREE from 'three';
import { kamera } from './szene.js';

const leinwand = document.getElementById('buehne');

export function macheBedienung({ szene, blick, beiTipp, beiStreicheln, antippbareDinge }) {
  const zeiger = new THREE.Vector2();
  const strahl = new THREE.Raycaster();
  const merker = new THREE.Vector3();

  const z = {
    zieht: false,
    hatGezogen: false,
    letzteX: 0,
    letzteY: 0,
    startX: 0,
    startY: 0,
    ruhe: 0,
    fliegtSelbst: true,
    gesperrt: false,
    streichelErlaubt: false,
    letzteStreichelZeit: 0,
  };

  /* ---------- ZOOM ----------
     Am Computer mit dem Mausrad, auf dem Handy mit zwei Fingern
     (auseinanderziehen = näher ran).                               */
  const NAH = 0.4;      // so nah darf man ran
  const WEIT = 1.9;     // so weit darf man weg
  const finger = new Map();     // welche Finger liegen gerade auf?
  let kneifStart = null;        // Zustand beim Zwei-Finger-Zoom

  function zoomeUm(faktor) {
    blick.zoom = THREE.MathUtils.clamp((blick.zoom || 1) * faktor, NAH, WEIT);
  }

  leinwand.addEventListener('wheel', (e) => {
    if (z.gesperrt) return;
    e.preventDefault();
    zoomeUm(1 + e.deltaY * 0.0012);
    z.fliegtSelbst = false;
    z.ruhe = 0;
  }, { passive: false });

  function fingerAbstand() {
    const beide = [...finger.values()];
    if (beide.length < 2) return 0;
    const dx = beide[0].x - beide[1].x;
    const dy = beide[0].y - beide[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ---------- Was ist unter dem Finger? ---------- */
  function strahlTreffer(x, y) {
    zeiger.x = (x / window.innerWidth) * 2 - 1;
    zeiger.y = -(y / window.innerHeight) * 2 + 1;
    strahl.setFromCamera(zeiger, kamera);
    const treffer = strahl.intersectObjects(szene.children, true);
    for (const t of treffer) {
      if (!t.object.visible) continue;
      // Von dem getroffenen Stück nach oben suchen, zu welchem
      // Ding es gehört.
      let o = t.object;
      while (o) {
        if (o.userData && o.userData.typ) {
          return { ding: o, punkt: t.point, netz: t.object };
        }
        o = o.parent;
      }
    }
    return null;
  }

  /* ---------- MAGNET FUER KLEINE DINGE ------------------------------
     Ein Häschen oder eine Blume ist auf dem Bildschirm nur ein
     paar Pixel groß - mit dem Finger trifft man das kaum.

     Darum: wenn der Fingertipp nur den Boden erwischt hat, schauen
     wir, ob in der Nähe (auf dem Bildschirm!) etwas Antippbares
     steht. Wenn ja, ist das gemeint.
     ------------------------------------------------------------------ */
  function findeNahesDing(x, y, umkreis) {
    if (!antippbareDinge) return null;
    let bestes = null;
    let besteEntfernung = umkreis;
    for (const ding of antippbareDinge()) {
      if (!ding.visible || !ding.parent) continue;
      ding.getWorldPosition(merker);
      // etwas nach oben, zur Mitte des Dings
      const hoehe = ding.userData.hoehe || 0.2;
      merker.addScaledVector(ding.userData.richtung || merker.clone().normalize(), hoehe * 0.4);
      const projiziert = merker.clone().project(kamera);
      if (projiziert.z > 1) continue;                  // hinter der Kamera
      const dx = (projiziert.x * 0.5 + 0.5) * window.innerWidth - x;
      const dy = (-projiziert.y * 0.5 + 0.5) * window.innerHeight - y;
      const entfernung = Math.sqrt(dx * dx + dy * dy);
      if (entfernung < besteEntfernung) {
        besteEntfernung = entfernung;
        bestes = ding;
      }
    }
    if (!bestes) return null;
    bestes.getWorldPosition(merker);
    return { ding: bestes, punkt: merker.clone(), netz: bestes, ueberMagnet: true };
  }

  function wasIstDa(x, y) {
    const genau = strahlTreffer(x, y);
    // Ein kleines Ding in der Nähe zählt mehr als der Boden dahinter
    if (!genau || genau.ding.userData.typ === 'boden') {
      const umkreis = Math.max(38, Math.min(window.innerWidth, window.innerHeight) * 0.075);
      const nah = findeNahesDing(x, y, umkreis);
      if (nah) return nah;
    }
    return genau;
  }

  /* ---------- Finger runter ---------- */
  leinwand.addEventListener('pointerdown', (e) => {
    if (z.gesperrt) return;
    finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (finger.size === 2) {
      // zweiter Finger: ab jetzt wird gezoomt, nicht gedreht
      kneifStart = { abstand: fingerAbstand(), zoom: blick.zoom || 1 };
      z.zieht = false;
      return;
    }
    z.zieht = true;
    z.hatGezogen = false;
    z.letzteX = z.startX = e.clientX;
    z.letzteY = z.startY = e.clientY;
    blick.schwungSeite = 0;
    blick.schwungHoch = 0;
    z.fliegtSelbst = false;
    z.ruhe = 0;
    try {
      leinwand.setPointerCapture(e.pointerId);
    } catch (fehler) {
      // Manche Browser moegen das nicht - ist aber nicht schlimm.
    }
  });

  /* ---------- Finger bewegt sich ---------- */
  leinwand.addEventListener('pointermove', (e) => {
    if (finger.has(e.pointerId)) finger.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Zwei Finger: auseinanderziehen holt den Planeten näher heran
    if (kneifStart && finger.size >= 2) {
      const jetzt = fingerAbstand();
      if (jetzt > 10 && kneifStart.abstand > 10) {
        blick.zoom = THREE.MathUtils.clamp(
          kneifStart.zoom * (kneifStart.abstand / jetzt), NAH, WEIT);
      }
      z.fliegtSelbst = false;
      z.ruhe = 0;
      return;
    }

    if (!z.zieht) return;
    const dx = e.clientX - z.letzteX;
    const dy = e.clientY - z.letzteY;
    z.letzteX = e.clientX;
    z.letzteY = e.clientY;

    const weg = Math.abs(e.clientX - z.startX) + Math.abs(e.clientY - z.startY);
    if (weg > 8) z.hatGezogen = true;

    if (z.streichelErlaubt) {
      // Streicheln: nicht fliegen, sondern kraulen
      const jetzt = performance.now();
      if (jetzt - z.letzteStreichelZeit > 55 && (Math.abs(dx) + Math.abs(dy)) > 2) {
        z.letzteStreichelZeit = jetzt;
        const treffer = wasIstDa(e.clientX, e.clientY);
        if (beiStreicheln) beiStreicheln({ treffer, x: e.clientX, y: e.clientY });
      }
      return;
    }

    fliege(dx, dy);
    blick.schwungSeite = dx;
    blick.schwungHoch = dy;
  });

  /* ---------- die Kamera um den Planeten bewegen ----------

     Damit es sich anfühlt, als würdest du den Planeten wirklich
     anfassen und schieben, muss sich die Stelle unter dem Finger
     genau so weit mitbewegen wie der Finger selbst.

     Dafür rechnen wir aus, wie viele Pixel auf dem Bildschirm einem
     Winkel entsprechen. Das hängt davon ab, wie weit die Kamera weg
     ist, wie groß der Planet ist und wie hoch das Fenster ist -
     darum wird es bei jedem Wisch neu berechnet.                     */
  function fliege(dx, dy) {
    const halberBlickwinkel = Math.tan((kamera.fov * Math.PI / 180) / 2);
    const sichtbareHoehe = 2 * blick.abstand * halberBlickwinkel;
    const griff = Math.max(0.35, blick.griffRadius || 0.7);
    // so viel Winkel entspricht einem Pixel
    const proPixel = (sichtbareHoehe / window.innerHeight) / griff;

    blick.seite -= dx * proPixel;
    blick.hoch = THREE.MathUtils.clamp(
      blick.hoch + dy * proPixel,
      -1.25, 1.25         // nicht über die Pole hinaus purzeln
    );
  }

  /* ---------- Finger hoch ---------- */
  function fingerHoch(e) {
    finger.delete(e.pointerId);
    if (finger.size < 2) kneifStart = null;
    if (!z.zieht) return;
    z.zieht = false;
    z.ruhe = 0;
    if (!z.hatGezogen && beiTipp) {
      const treffer = wasIstDa(e.clientX, e.clientY);
      beiTipp({ treffer, x: e.clientX, y: e.clientY });
    }
  }
  leinwand.addEventListener('pointerup', fingerHoch);
  leinwand.addEventListener('pointercancel', (e) => {
    finger.delete(e.pointerId);
    kneifStart = null;
    z.zieht = false;
  });

  /* ---------- jedes Bild ---------- */
  function belebe(schritt) {
    if (z.zieht) return;

    // Schwung sanft ausrollen lassen.
    // (Vorher zog es viel zu weit nach - dadurch passte die Bewegung
    //  nicht mehr zum Finger.)
    if (Math.abs(blick.schwungSeite) > 0.05 || Math.abs(blick.schwungHoch) > 0.05) {
      fliege(blick.schwungSeite * 0.22, blick.schwungHoch * 0.22);
      blick.schwungSeite *= 0.86;
      blick.schwungHoch *= 0.86;
    } else {
      z.ruhe += schritt;
      if (z.ruhe > 3.5) z.fliegtSelbst = true;
    }

    // Wenn lange nichts passiert, zieht die Kamera gemütlich weiter
    if (z.fliegtSelbst) blick.seite -= 0.013 * schritt;
  }

  return {
    belebe,
    wasIstDa,
    sperre(an) { z.gesperrt = an; },
    erlaubeStreicheln(an) { z.streichelErlaubt = an; leinwand.classList.toggle('streicheln', an); },
    stopEigendrehung() { z.fliegtSelbst = false; z.ruhe = 0; },
  };
}
