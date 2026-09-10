# 🌍 Deine Welt

Ein kleines Spiel über einen Planeten, der sich so klein gefühlt hat,
dass er fast verschwunden ist. Wenn du dich um ihn kümmerst, wächst er
wieder — Stück für Stück.

**Spielen:** einfach die Seite öffnen. Handy, Tablet oder Computer, alles geht.

---

## Wie man spielt

| Was du tun willst | Wie es geht |
|---|---|
| den Planeten drehen | mit dem Finger ziehen |
| etwas anfassen | antippen |
| streicheln | mit dem Finger hin und her fahren |
| gießen | Gießkanne unten rechts wählen, dann aufs Gras tippen |
| Blumen pflanzen | Samentüte wählen, dann auf den Boden tippen |
| mit dem Mond reden | den Mond antippen |
| eigene Zeichnungen holen | oben auf 🎨 tippen |

Dein Fortschritt wird gespeichert. Mit ↺ oben rechts fängst du von vorne an.

---

## Deine eigenen Zeichnungen aus Open Brush

Wenn du auf der Meta Quest in **Open Brush** etwas malst, kann es in dein
Spiel kommen. Es gibt drei Wege:

### 1. Über Icosa Gallery (am besten — kein Kabel nötig)

1. In Open Brush: **Save/Share → Upload to Icosa Gallery**
2. Im Spiel oben auf **🎨** tippen
3. Deinen Icosa-Namen eingeben und **suchen**
4. Deine Zeichnung antippen — sie landet auf dem Planeten und bleibt da

> Damit die Namenssuche funktioniert, muss die Skizze auf Icosa
> **öffentlich** stehen. Wenn sie „unlisted" ist, nimm stattdessen die
> Skizzen-Nummer (die steht in der Adresse: `icosa.gallery/edit/`**`x46g-EXbXF8`**).

### 2. Datei ins Fenster ziehen

Eine `.glb`-Datei einfach ins Spielfenster ziehen. Sofort da — aber nur
bis zum nächsten Neuladen.

### 3. Fest ins Spiel einbauen

Datei in den Ordner `meine-sachen/` legen und in `meine-sachen/liste.json`
eintragen:

```json
{
  "sachen": [
    { "datei": "mein-drache.glb", "ort": [0.3, 0.6, 0.7], "groesse": 0.7 }
  ]
}
```

`ort` ist die Stelle auf dem Planeten (x, y, z — `[0,1,0]` ist oben,
`[0,0,1]` ist vorne). So gehört die Zeichnung fest zum Spiel — auch für
alle anderen, die es öffnen.

Schon eingebaut: **`blubber-blume.glb`** — die wächst, wenn du gießt. 🌸

---

## Wie das Spiel gebaut ist

Alles im Spiel besteht aus **Papier-Schnipseln**: flache, leicht gewölbte
Stücke mit einem gemalten Bild darauf. Ein Baum ist zum Beispiel aus drei
Stammstreifen, drei Ästen und 26 einzelnen Blättern zusammengeklebt — jedes
Blatt steht im Raum, darum sieht er von jeder Seite anders aus.

```
deinewelt/
├── index.html            die Seite
├── server.js             kleiner Server zum Ausprobieren
├── schnipsel/            die Einzelteile (Blätter, Halme, Augen, Münder …)
├── bilder/               Symbole für Gießkanne und Samentüte
├── meine-sachen/         deine eigenen 3D-Zeichnungen
└── src/
    ├── main.js           setzt alles zusammen, malt jedes Bild
    ├── geschichte.js  ←  DIE GESCHICHTE (hier kannst du am meisten ändern!)
    ├── schnipsel.js      der Baukasten für alle Papierstücke
    ├── pflanzen.js       Baum, Gras, Blume, Busch, Pilz, Stein
    ├── mond.js           der Mond mit Augen, Brauen, Mund und Ringen
    ├── tiere.js          Schmetterling, Häschen, Wolke
    ├── dinge.js          Gießkanne und Samentüte
    ├── planet.js         die Kugel aus Papier-Dreiecken
    ├── eingabe.js        Ziehen, Tippen, Streicheln
    ├── klang.js          alle Töne (selbst gemacht, keine Dateien)
    ├── ui.js             Sprechblase, Hinweise, Tasche
    └── eigene-sachen.js  holt deine Open-Brush-Zeichnungen
```

### Was du leicht ändern kannst

**Die Geschichte** — in `src/geschichte.js`. Der Mond redet so:

```js
await s.mondSagt([
  'Das kann er sagen.',
  'Und das danach.',
], 'gluecklich');        // 'normal', 'traurig', 'gluecklich' oder 'staunen'
```

**Die Farben** — oben in `src/pflanzen.js` stehen alle Farbtöpfe:

```js
grasGesund: ['#8fd34e', '#a3e05f', '#bcea78', '#78c23e', '#aae267'],
```

**Die Bilder** — die SVG-Dateien in `schnipsel/` kann man in jedem
Zeichenprogramm aufmachen. Sie sind weiß, weil die Farbe erst im Spiel
dazukommt — so kann ein Blatt grün, rot oder orange sein.

---

## Auf dem eigenen Computer starten

```bash
npm start
```

Dann [http://localhost:5173](http://localhost:5173) im Browser öffnen.
(Es muss nichts installiert werden — der Server ist eine einzige kleine Datei.)

---

## Technisches

- **three.js r170** liegt im Ordner `vendor/` — kein Build, kein Bundler,
  keine Installation. Der Browser lädt die Dateien direkt.
- Läuft auf Handys: fertige Modelle werden zu einem Stück zusammengebacken
  (`backeZusammen` in `src/schnipsel.js`), damit die Grafikkarte weniger
  Arbeit hat. Schatten schalten sich auf schwachen Geräten ab.
- Alle Töne werden im Browser erzeugt (Web Audio), keine Audiodateien.
- Der Fortschritt liegt im `localStorage` des Browsers.

