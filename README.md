# Marina Bahía Concepción: Coming Soon

Static coming-soon site for [marinabahiaconcepcion.com](https://marinabahiaconcepcion.com), a private marina & resort in development at Bahía Concepción, Baja California Sur, México (26.6191° N, 111.7065° W).

## What it is

- A single-page static site (no build step) with a real-time **Three.js** hero scene: sunset sky, animated ocean, silhouetted Baja ridgelines, bobbing mooring buoys, and a sailboat drifting across the horizon.
- Below the fold: the vision, planned amenities, and location.
- Bilingual: English and Spanish, with a toggle in the header and footer. The initial language follows the browser setting and the choice persists in `localStorage`.
- Fully responsive, with a CSS sunset gradient fallback when WebGL is unavailable, and `prefers-reduced-motion` support.

## Structure

```
index.html      markup & content
css/style.css   styling
js/main.js      Three.js scene (loaded as an ES module)
js/i18n.js      English / Spanish toggle
favicon.svg     anchor mark
CNAME           custom domain for GitHub Pages
.nojekyll       disables Jekyll processing on Pages
```

Three.js is loaded from the jsDelivr CDN via an import map, so there are no dependencies to install.

## Local preview

Serve the folder with any static server (ES modules require http, not `file://`):

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages** → Source: *Deploy from a branch* → branch `main`, folder `/ (root)`.
3. Under **Custom domain**, `marinabahiaconcepcion.com` should be picked up automatically from the `CNAME` file. Enable **Enforce HTTPS** once the certificate is issued.
4. At your DNS provider, point the domain at GitHub Pages:
   - `A` records for the apex (`@`): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` record for `www` → `<your-github-username>.github.io`
   - For the `.mx` domain, the simplest option is a redirect to the `.com` at your registrar.
