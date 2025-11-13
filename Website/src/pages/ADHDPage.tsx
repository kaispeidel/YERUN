import { Link } from 'react-router-dom'
import '../styles/disability-page.css'

export default function ADHDPage() {
  return (
    <div className="disability-page adhd-page">
      <header className="page-header adhd-header">
        <div className="header-content">
          <div className="header-top">
            <Link to="/" className="back-button">
              <span>←</span> Back
            </Link>
            <div className="header-text">
              <h1>ADHD Support</h1>
              <p>Focus, organization, and task management</p>
            </div>
          </div>
        </div>
      </header>
    </div>
  )
}
