# ATHLONEX

Every sport. Every opportunity. A portal for student athletes and college sports departments.

- **Student portal**: Opportunities (241 sports, 12 categories, District → International), My Achievements (upload medals/certificates/photos), TA/DA Claims (upload bills with proof, see sanctioned / paid / remaining).
- **Official portal** (sports director): see every student of their college, verify achievements, set sanctions, approve/reject/pay claims, add verified events, export CSV.
- **iChaty**: in-app chat assistant (💬 button).

## Files
`index.html` · `style.css` · `data.js` (sports + sample events + official access code) · `app.js` (everything else)

## Run locally
Double-click `index.html`, or run `npx serve .` / VS Code "Live Server".

## IMPORTANT before you deploy
1. Open `data.js` and change `CONFIG.officialCode` (default `ATHLONEX-OFFICIAL`). Only sports directors should know it.
2. Data is stored **in each browser** (localStorage + IndexedDB). A student's data is NOT visible to an official on another device until you add a backend (Supabase/Firebase). The UI is already split so only the storage functions in `app.js` need replacing.
3. Events marked **Sample** are generated placeholders. Officials add real ones in Events.

## Version control (on your computer)
```
git init
git add .
git commit -m "ATHLONEX v1.0.0"
git branch -M main
```
Later changes: `git add .` → `git commit -m "what changed"` → `git push`.

## GitHub
1. github.com → New repository → name `athlonex` → Create (don't add README).
2. Run the two lines GitHub shows:
```
git remote add origin https://github.com/YOUR-USERNAME/athlonex.git
git push -u origin main
```

## Vercel
1. vercel.com → Sign up with GitHub.
2. Add New → Project → pick `athlonex` → Framework Preset: **Other** → Deploy.
3. Your site goes live at `https://athlonex.vercel.app`. Every `git push` redeploys automatically.
