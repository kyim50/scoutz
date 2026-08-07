# Cite — landing page

The marketing site for [joincite.com](https://joincite.com). Plain HTML and CSS,
no build step and no dependencies: a landing page does not need a framework, and
this way there is nothing to keep upgraded and nothing that can fail to compile.

## Local

```bash
cd web
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploying

Vercel serves this directory as-is.

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `web`. This is the only setting that matters — the
   repo root holds the Expo app, so pointing Vercel there would try to build it.
3. Leave the framework preset as **Other**, with no build command and `.` as the
   output directory.
4. Add `joincite.com` under Settings → Domains.

`vercel.json` sets the security headers, clean URLs, and the JSON content type
that `apple-app-site-association` needs.

## Keeping it honest

Every colour in `styles.css` comes from `frontend/src/constants/theme.ts` (the
`darkColors` table) and the per-category tints the app uses for pin and report
types. The page sits on `surface` (`#141414`), not `background` (`#000000`):
every screen in the app renders on surface, so black read as a different
product.

Two small deviations, both deliberate. Hairlines are `#262629` rather than the
app's `border` (`#1C1C1E`), which is eight values off the surface and vanishes
on a desktop display. And muted body text is `#85858b` rather than `textMuted`
(`#636366`), which only reaches 3.4:1 here — the web version clears AA at 5.0:1.

The phone in the hero is a CSS and SVG rebuild of the real pin sheet: the same
type tile, meta row, and the two verify buttons, plus the white head-and-stick
marker from `MapPinMarker.tsx`. Icons are inline SVG defined once and referenced
with `<use>`, drawn at the weight Ionicons uses in the app.

The expiry figures in the "why it stays true" table are the real ones, from
`REPORT_LIFETIME` in `CreateReportScreen.tsx` and `TTL_CONFIG` in the backend's
`report.service.ts`. If those change, change them here.

## Universal links

`.well-known/` holds the two files iOS and Android check before they will hand a
`https://joincite.com` link to the app. Both ship with placeholders and **will
not work until they are filled in**:

- `apple-app-site-association` — replace `REPLACE_WITH_APPLE_TEAM_ID` with the
  Apple Developer Team ID. No file extension, served as `application/json`.
- `assetlinks.json` — replace the fingerprint with the SHA-256 from
  `eas credentials`, which only exists once there has been a build.

Until then `cite://` links work and `https://joincite.com/...` links open the
browser.
