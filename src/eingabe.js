/* ==================================================================
   BEDIENUNG - Ziehen dreht den Planeten, Tippen fasst etwas an.
   Funktioniert mit Maus und mit dem Finger.
   ================================================================== */

import * as THREE from 'three';
import { kamera } from './szene.js';

const leinwand = document.getElementById('buehne');

export function macheBedienung({ planetGruppe, szene, beiTipp, beiStreicheln }) {
  const zeiger = new THREE.Vector2();
  const strahl = new THREE.Raycaster();

  const z = {
    zieht: false,
    hatGezogen: false,
    letzteX: 0,
    letzteY: 0,
    startX: 0,
    startY: 0,
    schwungX: 0,
    schwungY: 0,
    ruhe: 0,
    dreheSelbst: true,
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
      // von dem getroffenen Papierstueck nach oben suchen,
      // zu welchem Ding es gehoert
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

  /* ---------- Drehen ---------- */
  const drehachseHoch = new THREE.Vector3(0, 1, 0);
  const drehachseSeite = new THREE.Vector3();
  const drehung = new THREE.Quaternion();

  function drehe(dx, dy) {
    const staerke = 0.0055;
    // um die Hoch-Achse der Welt
    drehung.setFromAxisAngle(drehachseHoch, dx * staerke);
    planetGruppe.quaternion.premultiply(drehung);
    // um die Achse, die auf dem Bildschirm nach rechts zeigt
    kamera.getWorldDirection(drehachseSeite);
    drehachseSeite.cross(drehachseHoch).normalize();
    drehung.setFromAxisAngle(drehachseSeite, -dy * staerke);
    planetGruppe.quaternion.premultiply(drehung);
  }

  /* ---------- Finger runter ---------- */
  leinwand.addEventListener('pointerdown', (e) => {
    if (z.gesperrt) return;
    z.zieht = true;
    z.hatGezogen = false;
    z.letzteX = z.startX = e.clientX;
    z.letzteY = z.startY = e.clientY;
    z.schwungX = z.schwungY = 0;
    z.dreheSelbst = false;
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
      // Streicheln: nicht drehen, sondern kraulen
      const jetzt = performance.now();
      if (jetzt - z.letzteStreichelZeit > 55 && (Math.abs(dx) + Math.abs(dy)) > 2) {
        z.letzteStreichelZeit = jetzt;
        const treffer = wasIstDa(e.clientX, e.clientY);
        if (beiStreicheln) beiStreicheln({ treffer, x: e.clientX, y: e.clientY });
      }
      return;
    }

    drehe(dx, dy);
    z.schwungX = dx;
    z.schwungY = dy;
  });

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
    if (!z.zieht) {
      // Schwung ausrollen lassen
      if (Math.abs(z.schwungX) > 0.02 || Math.abs(z.schwungY) > 0.02) {
        drehe(z.schwungX * 0.55, z.schwungY * 0.55);
        z.schwungX *= 0.92;
        z.schwungY *= 0.92;
      } else {
        z.ruhe += schritt;
        if (z.ruhe > 3.5) z.dreheSelbst = true;
      }
      // wenn lange nichts passiert: der Planet dreht sich gemuetlich weiter
      if (z.dreheSelbst) drehe(0.16, 0);
    }
  }

  return {
    belebe,
    wasIstDa,
    sperre(an) { z.gesperrt = an; },
    erlaubeStreicheln(an) { z.streichelErlaubt = an; leinwand.classList.toggle('streicheln', an); },
    stopEigendrehung() { z.dreheSelbst = false; z.ruhe = 0; },
  };
}
