/* ==================================================================
   BEDIENUNG

   Wischen laesst die KAMERA um den Planeten fliegen - der Planet
   selbst steht still. Darum ziehen auch die Sterne im Hintergrund
   vorbei, so als wuerde man wirklich um ihn herumfliegen.

   Der Blick zeigt dabei immer zur Mitte.
   ================================================================== */

import * as THREE from 'three';
import { kamera } from './szene.js';

const leinwand = document.getElementById('buehne');

export function macheBedienung({ szene, blick, beiTipp, beiStreicheln }) {
  const zeiger = new THREE.Vector2();
  const strahl = new THREE.Raycaster();

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

  /* ---------- Was ist unter dem Finger? ---------- */
  function wasIstDa(x, y) {
    zeiger.x = (x / window.innerWidth) * 2 - 1;
    zeiger.y = -(y / window.innerHeight) * 2 + 1;
    strahl.setFromCamera(zeiger, kamera);
    const treffer = strahl.intersectObjects(szene.children, true);
    for (const t of treffer) {
      if (!t.object.visible) continue;
      // Von dem getroffenen Stueck nach oben suchen, zu welchem
      // Ding es gehoert.
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

  /* ---------- Finger runter ---------- */
  leinwand.addEventListener('pointerdown', (e) => {
    if (z.gesperrt) return;
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

  /* ---------- die Kamera um den Planeten bewegen ---------- */
  function fliege(dx, dy) {
    const staerke = 0.0052;
    blick.seite -= dx * staerke;
    blick.hoch = THREE.MathUtils.clamp(
      blick.hoch + dy * staerke,
      -1.25, 1.25         // nicht ueber die Pole hinaus
    );
  }

  /* ---------- Finger hoch ---------- */
  function fingerHoch(e) {
    if (!z.zieht) return;
    z.zieht = false;
    z.ruhe = 0;
    if (!z.hatGezogen && beiTipp) {
      const treffer = wasIstDa(e.clientX, e.clientY);
      beiTipp({ treffer, x: e.clientX, y: e.clientY });
    }
  }
  leinwand.addEventListener('pointerup', fingerHoch);
  leinwand.addEventListener('pointercancel', () => { z.zieht = false; });

  /* ---------- jedes Bild ---------- */
  function belebe(schritt) {
    if (z.zieht) return;

    // Schwung ausrollen lassen
    if (Math.abs(blick.schwungSeite) > 0.02 || Math.abs(blick.schwungHoch) > 0.02) {
      fliege(blick.schwungSeite * 0.55, blick.schwungHoch * 0.55);
      blick.schwungSeite *= 0.92;
      blick.schwungHoch *= 0.92;
    } else {
      z.ruhe += schritt;
      if (z.ruhe > 3.5) z.fliegtSelbst = true;
    }

    // Wenn lange nichts passiert, zieht die Kamera gemuetlich weiter
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
