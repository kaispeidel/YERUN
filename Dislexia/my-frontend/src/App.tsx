import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import './App.css'
import DyslexiaPage from './pages/DyslexiaPage'
import ADHDPage from './pages/ADHDPage'
import AutismPage from './pages/AutismPage'
import SignLanguagePage from './pages/SignLanguagePage'

function HomePage() {
  const tools = [
    {
      id: 'dyslexia',
      title: 'Dyslexia',
      description: 'Specialized tools to help with reading and text processing. Features include font adjustments, text spacing, and reading support.',
      tags: ['READING', 'TEXT', 'FOCUS'],
      emoji: '📖',
      color: 'gradient-warm',
      link: '/dyslexia'
    },
    {
      id: 'adhd',
      title: 'ADHD',
      description: 'Tools designed for better focus and organization. Includes timers, task management, and distraction-reducing features.',
      tags: ['FOCUS', 'ORGANIZATION', 'TIME'],
      emoji: '⏱️',
      color: 'gradient-fresh',
      link: '/adhd'
    },
    {
      id: 'autism',
      title: 'Autism',
      description: 'Sensory-friendly interface with customizable visuals. Features reduced animations, clear communication tools, and predictable layouts.',
      tags: ['SENSORY', 'CUSTOMIZABLE', 'CLEAR'],
      emoji: '✨',
      color: 'gradient-calm',
      link: '/autism'
    },
    {
      id: 'sign-language',
      title: 'Sign Language Helper',
      description: 'Learn and practice sign language with AI-powered Q&A and video demonstrations. Ask questions and see sign language in action.',
      tags: ['COMMUNICATION', 'LEARNING', 'VIDEO'],
      emoji: '🤟',
      color: 'gradient-purple',
      link: '/sign-language'
    }
  ]

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="title">AccessHub</h1>
          <p className="subtitle">Empowering everyone with personalized tools</p>
        </div>
      </header>

      <section className="hero">
        <h2>Choose Your Experience</h2>
        <p className="hero-subtitle">Select the tool that works best for you</p>
      </section>

      <section className="cards-container">
        {tools.map((tool) => (
          <div key={tool.id} className={`card ${tool.color}`}>
            <div className="card-emoji">{tool.emoji}</div>
            <h3 className="card-title">{tool.title}</h3>
            <p className="card-description">{tool.description}</p>
            <div className="card-tags">
              {tool.tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            <Link to={tool.link} className="card-link">
              Get Started
              <span className="arrow">→</span>
            </Link>
          </div>
        ))}
      </section>

      <footer className="footer">
        <p>Built with care for accessibility</p>
      </footer>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dyslexia" element={<DyslexiaPage />} />
        <Route path="/adhd" element={<ADHDPage />} />
        <Route path="/autism" element={<AutismPage />} />
        <Route path="/sign-language" element={<SignLanguagePage />} />
      </Routes>
    </Router>
  )
}

export default App
