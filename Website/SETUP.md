# Website Frontend Setup

## Project (key files)
Website/
- src/
    - pages/ (DyslexiaPage.tsx, ADHDPage.tsx, AutismPage.tsx, SignLanguagePage.tsx)
    - styles/ (disability-page.css)
    - assets/opendyslexic-0.91.12/ (font files)
    - App.tsx, main.tsx, index.css
- index.html, package.json, vite.config.ts, tsconfig.json, .env.example

## Install & Run
1. Install deps:
     npm install
2. Create env:
     cp .env.example .env.local
     Edit .env.local: VITE_OPENROUTER_API_KEY=your_key, VITE_BACKEND_URL=http://localhost:5000
3. Start dev server:
     npm run dev (http://localhost:5173)
4. Build:
     npm run build

## Features (short)
- Dyslexia (/dyslexia): MCQ generation — needs OpenRouter key, uses OpenDyslexic font.
- ADHD (/adhd): foundation/stubs — timers/task UI planned.
- Autism (/autism): foundation/stubs — sensory-friendly UI planned.
- Sign Language (/sign-language): upload/chat → sign videos — needs backend + OpenRouter key.
    Backend endpoints: POST /api/extract-text, /api/store-document, /api/chat, /api/text-to-video

## Backend (Sign Language)
Quick setup:
cd ../
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python backend_api.py
Backend should run at http://localhost:5000

## API Keys
- OpenRouter: LLM for MCQs and chat. Set VITE_OPENROUTER_API_KEY.
- Google Cloud Sign Language (backend): text→pose. Configure in backend.

## Troubleshooting (quick)
- React/router errors: npm install
- Fonts not loading: ensure src/assets/opendyslexic... exists and CSS @font-face is correct
- Backend issues: run backend, check VITE_BACKEND_URL, watch CORS and browser console
- OpenRouter errors: verify key and account credits

## Dev notes
- TypeScript, React hooks (useState/useEffect). Build to check types.
- Lint: npm run lint (use --fix to auto-fix)
- Styling: disability-page.css (shared), SignLanguagePage.css (specific). Responsive breakpoints: 480/768/1024.

## Git & Deploy
- Branch:
    git checkout -b feature/your-feature
    git add . && git commit -m "feat: ..."
    git push origin feature/your-feature
- Frontend deploy: npm run build → deploy dist/
- Backend deploy: PaaS (Heroku/Railway), set env vars, enable CORS

Contact: open issues or PRs for help with specific tools (fonts, backend, video).
