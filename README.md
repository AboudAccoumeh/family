# The Aboud Family — Interactive Family Tree

A hyper-modern, infinite-canvas 2D family tree. Dark dashboard UI, glassmorphic cards,
glowing connection lines, Figma-style pan & zoom, collapsible branches, and a detail
drawer with biography, timeline, and a vintage photo album.

## Run it

The site fetches `data.json`, so serve the folder over HTTP (opening `index.html`
directly also works — it falls back to the bundled copy in `data.js`):

```bash
# any of these, from this folder:
python -m http.server 8000
npx serve .
```

Then open <http://localhost:8000>.

## Controls

| Action | How |
|---|---|
| Pan | Drag the canvas (or arrow keys) |
| Zoom | Mouse wheel / trackpad pinch / `+` `-` keys / HUD buttons |
| Fit to screen | `0` key or the ⛶ HUD button |
| Expand / collapse a branch | The circular `⌄` button under a couple card |
| Expand / collapse everything | Last two buttons in the HUD |
| Open a person's profile | Click any capsule card |
| Find someone | Search box (top-right) — auto-expands the branch, flies to them and pulses |

## Editing the family (dynamic data)

Everything lives in **`data.json`** — no code changes needed:

```jsonc
{
  "meta": { "familyName": "...", "tagline": "..." },
  "people": {
    "<id>": {
      "name": "Full Name",
      "gender": "male" | "female",        // drives the avatar gradient + accent dot
      "birth": 1960,
      "death": 2020,                       // omit for living members
      "photo": "path/to/face.jpg",        // optional — falls back to stylish initials
      "occupation": "...", "location": "...",
      "bio": "...",
      "timeline": [{ "year": 1990, "title": "...", "text": "..." }],
      "photos": ["Caption — Place, 1998", { "src": "file.jpg", "caption": "..." }]
    }
  },
  "tree": {
    "partners": ["<id>", "<id>"],          // couple row (or a single id)
    "children": [ { "partners": [...], "children": [...] }, "leaf-person-id" ]
  }
}
```

- Avatars: no image → automatically generated initials avatar with a deterministic
  gradient (blue/cyan for male, rose/violet for female, slate for unspecified).
- Photos: strings render as vintage placeholder tiles (caption + year auto-tagged);
  add `"src"` to show a real image file.
- After editing `data.json`, regenerate the offline fallback with:

```bash
node -e "const fs=require('fs');const j=fs.readFileSync('data.json','utf8');JSON.parse(j);fs.writeFileSync('data.js','window.FAMILY_DATA_FALLBACK = JSON.parse('+JSON.stringify(j)+');')"
```

## Files

- `index.html` — shell (top bar, HUD, drawer, canvas)
- `styles.css` — all theming (colors, glass, glow, animations)
- `app.js` — layout engine, pan/zoom camera, expand/collapse, search, drawer
- `data.json` — **the family data (source of truth)**
- `data.js` — auto-generated offline fallback of the same JSON
