# Quick Start Reference

## 🚀 Get Started in 3 Commands

```bash
# 1. Install dependencies
npm install

# 2. Set up environment (copy template)
cp .env.example .env.local

# 3. Start development server
npm run dev
```

Visit: `http://localhost:5173`

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main router (5 routes) |
| `src/pages/DyslexiaPage.tsx` | MCQ generator |
| `src/pages/SignLanguagePage.tsx` | Chat + video |
| `src/App.css` | Home page styling |
| `src/styles/disability-page.css` | Shared styles + fonts |
| `package.json` | Dependencies (includes react-router-dom) |
| `.env.example` | API keys template |

---

## 🔑 Environment Variables

Create `.env.local`:
```
VITE_OPENROUTER_API_KEY=your_key_here
VITE_BACKEND_URL=http://localhost:5000
```

---

## 🌐 Routes

| Route | Component | Feature |
|-------|-----------|---------|
| `/` | HomePage | Tool selection cards |
| `/dyslexia` | DyslexiaPage | MCQ generation |
| `/adhd` | ADHDPage | ADHD tools (stub) |
| `/autism` | AutismPage | Autism tools (stub) |
| `/sign-language` | SignLanguagePage | Chat + video |

---

## 📚 Documentation

- **SETUP.md**: Full setup guide (250+ lines)
- **MIGRATION_COMPLETE.md**: What was migrated
- **README.md**: Project overview

---

## ⚡ Common Commands

```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run lint       # Check code style
npm run preview    # Preview production build
```

---

## 🐛 Troubleshooting

**Fonts not loading?**
- Check: `src/assets/opendyslexic-0.91.12/compiled/`
- DevTools → Network tab to verify font loads

**Backend connection error?**
- Start backend: `python backend_api.py`
- Check: `VITE_BACKEND_URL` in `.env.local`

**React Router errors?**
- Run: `npm install` (installs react-router-dom)

---

## 📊 Stats

- **Lines of Code**: 3000+
- **TypeScript Components**: 5
- **CSS Files**: 3
- **Routes**: 5
- **Pages**: 4 accessibility tools + home

---

**Ready to develop!** 🎉
