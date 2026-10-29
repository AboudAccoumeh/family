# The Accoumeh Family Tree

An interactive family tree that works on phones and computers. **Everything is generated
from `data.json`.** To add or fix a person, edit that one file. You never need to touch the code.

- **Tree**: pan, zoom and pinch, with expandable branches. Spouses sit side by side, and each
  marriage's children branch from that couple. Divorces show as a dashed link.
- **Members**: a searchable directory with filters (living, male, female) that you can
  group by generation, branch, location or A–Z, plus family stats.
- **Timeline**: births, marriages, divorces, milestones and deaths, grouped by decade.
- **Profiles**: details, parents, all spouses (with status), children grouped by the other
  parent, siblings and half-siblings, biography, life timeline and photos.
- Light and dark themes, a search shortcut (`/`), shareable links (`…/#tree/rami`), and works offline.

## Editing the family (`data.json`)

```jsonc
{
  "meta": {
    "familyName": "The Accoumeh Family",
    "tagline": "Descendants of Abedelrahman Accoumeh",
    "description": "Shown on the Members page",
    "root": "abedelrahman"            // who sits at the top of the tree
  },
  "people": {
    "rami": {
      "name": "Rami Accoumeh",          // required
      "gender": "male",                 // "male" | "female"
      "birth": 1988,                    // a year, or "1988-04-12", or "1988-04"
      "birthApprox": true,              // shows "c. 1988" (use when you only know the age)
      "death": 2024, "deathApprox": true, // omit for living people
      "father": "ahmed",                // id of the father  ─┐ this is how the tree is built
      "mother": "sania",                // id of the mother  ─┘
      "maidenName": "Kabbara",          // optional
      "nickname": "Abu Zach",           // optional
      "occupation": "Engineer",         // optional
      "location": "Beirut, Lebanon",    // optional (last part is treated as the country)
      "birthPlace": "Tripoli",          // optional
      "photo": "photos/rami.jpg",       // optional profile picture (else coloured initials)
      "bio": "A few sentences…",        // optional
      "details": { "Education": "AUB" },// optional: any extra facts you want to show
      "timeline": [ { "year": 2015, "title": "Moved to Dubai", "text": "…" } ],
      "photos": [ "Caption only", { "src": "photos/wedding.jpg", "caption": "Wedding, 2016" } ]
    }
  },
  "marriages": [
    { "partners": ["rami", "sarah-ghemraoui"], "status": "married", "year": 2016 },
    { "partners": ["ahmed", "first-wife"], "status": "divorced", "year": 1975, "ended": 1979 }
  ]
}
```

### Common situations

| Situation | What to write |
|---|---|
| **Child** | Give the child `"father"` and/or `"mother"`. |
| **Two or more wives** | Add one entry per wife to `marriages`. Each child's `mother` decides which couple they hang from. |
| **Divorced** | `"status": "divorced"`, plus optional `"ended": <year>`. Children stay with that couple. |
| **Widowed / separated / engaged** | `"status": "widowed"`, `"separated"` or `"engaged"`. |
| **Other parent unknown** | Leave out `father` or `mother`. The child hangs from the known parent. |
| **Only the age is known** | `"birth": 2026 - age, "birthApprox": true`. |
| **Deceased, year unknown** | `"deceased": true`. |

Ids (the keys in `people`) can be anything unique, e.g. `"bassam"` and `"bassam-jr"`.

### Things to fill in

- Abedelrahman's second wife is not in the data yet. When you add her, give her a `people` entry and a
  `marriages` entry, then add her children with `"father": "abedelrahman"` and her id as `"mother"`.
- **Zein Choghri** (Susanne's son) and **Belal Accoumeh** (Jenan's son) have no father yet. Add him
  as a person, add a `"divorced"` marriage, and set the child's `father`.
- Birth years come from the ages you gave, so they are approximate (`birthApprox`).

### Check your edits

```bash
node tools/build.mjs      # validates data.json and refreshes data.js (offline copy)
```

It reports mistakes such as a `father` id that doesn't exist, a death before birth, or a
parent loop. GitHub runs the same check on every push.

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

You can also open `index.html` directly. It falls back to `data.js` (run the build first).

## Publishing to GitHub Pages (on tag)

**One-time setup:** on GitHub, open **Settings → Pages → Build and deployment → Source** and
choose **GitHub Actions**.

**Release:** push any tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The **Release to GitHub Pages** workflow (`.github/workflows/deploy.yml`) does three things:
1. It validates `data.json` and builds the site into `_site/`.
2. It deploys the site to `https://<user>.github.io/<repo>/`.
3. It creates a GitHub Release for the tag with a zip of the site attached.

You can also run it by hand from the **Actions** tab ("Run workflow").

## Files

| File | Purpose |
|---|---|
| `data.json` | **The family data. This is the only file you need to edit.** |
| `index.html`, `styles.css`, `app.js` | The app: layout, theme, tree engine, views |
| `data.js` | Auto-generated offline copy of `data.json` |
| `tools/build.mjs` | Validator and site builder (no dependencies) |
| `fonts/` | Self-hosted Inter and Space Grotesk |
| `photos/` | (optional) Put pictures here and reference them from `data.json` |
