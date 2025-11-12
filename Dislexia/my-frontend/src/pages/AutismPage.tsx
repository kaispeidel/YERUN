import { Link } from 'react-router-dom'
import '../styles/disability-page.css'

export default function AutismPage() {
  return (
    <div className="disability-page autism-page">
      <header className="page-header autism-header">
        <div className="header-content">
          <Link to="/" className="back-button">
            <span>←</span> Back
          </Link>
          <h1>✨ Autism Support</h1>
          <p>Sensory-friendly interface and communication support</p>
        </div>
      </header>
    </div>
  )
}
