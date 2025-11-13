import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import '../styles/disability-page.css'
import '../styles/disability-subpages.css'

interface ProblematicText {
  text: string
  sentiment: string
  complexWords: string[]
  analysis?: string
}

interface CaptionSession {
  captions: string[]
  currentIndex: number
  problematicTexts: ProblematicText[]
}

export default function AutismPage() {
  const [session, setSession] = useState<CaptionSession>({
    captions: [],
    currentIndex: 0,
    problematicTexts: []
  })
  const [currentCaption, setCurrentCaption] = useState<string | null>(null)
  const [showWelcome, setShowWelcome] = useState(true)
  const [showReport, setShowReport] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [, setDemoMode] = useState(true)
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Demo captions for testing
  const DEMO_CAPTIONS = [
    "The speaker discussed the intersection of technology and accessibility in education.",
    "Generative AI has become ubiquitous in academic environments.",
    "We must ensure factual accuracy and accountability in automated systems.",
    "Students are advancing rapidly with these sophisticated tools.",
    "The potential for personalized learning is profound and transformative.",
    "However, there remain significant challenges regarding misinformation and bias.",
    "Institutional frameworks need to evolve to accommodate these innovations.",
    "Collaboration between educators and technologists is paramount.",
  ]

  useEffect(() => {
    const hasVisited = localStorage.getItem('autism-visited')
    if (!hasVisited) {
      setShowWelcome(true)
      localStorage.setItem('autism-visited', 'true')
    } else {
      setShowWelcome(false)
    }
  }, [])

  const initializeSession = (captions: string[] = DEMO_CAPTIONS) => {
    const newSession: CaptionSession = {
      captions,
      currentIndex: 0,
      problematicTexts: []
    }
    setSession(newSession)
    setDemoMode(captions === DEMO_CAPTIONS)
    setShowWelcome(false)
    loadNextCaption(newSession)
  }

  const loadNextCaption = (sessionData: CaptionSession) => {
    if (sessionData.currentIndex < sessionData.captions.length) {
      setCurrentCaption(sessionData.captions[sessionData.currentIndex])
    } else {
      setCurrentCaption(null)
    }
  }

  const handleCaptionResponse = async (isStruggling: boolean) => {
    if (!currentCaption) return

    if (isStruggling) {
      setLoading(true)
      try {
        // Analyze the problematic text
        const sentiment = await analyzeSentiment(currentCaption)
        const complexWords = detectComplexWords(currentCaption)
        const analysis = await generateAnalysis(currentCaption, complexWords)

        const problematicEntry: ProblematicText = {
          text: currentCaption,
          sentiment,
          complexWords,
          analysis
        }

        setSession(prev => ({
          ...prev,
          problematicTexts: [...prev.problematicTexts, problematicEntry],
          currentIndex: prev.currentIndex + 1
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to analyze text')
      } finally {
        setLoading(false)
      }
    } else {
      // Move to next caption
      setSession(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1
      }))
    }

    // Load next caption
    setSession(prev => {
      const newSession = { ...prev }
      if (newSession.currentIndex < newSession.captions.length) {
        setCurrentCaption(newSession.captions[newSession.currentIndex])
      } else {
        setCurrentCaption(null)
      }
      return newSession
    })
  }

  const analyzeSentiment = async (text: string): Promise<string> => {
    // Simple sentiment analysis based on word patterns
    const negativeWords = ['not', 'no', 'never', 'fail', 'problem', 'issue', 'challenge', 'difficult', 'wrong']
    const positiveWords = ['good', 'great', 'excellent', 'success', 'wonderful', 'happy', 'achieve', 'improve']

    const textLower = text.toLowerCase()
    const negCount = negativeWords.filter(w => textLower.includes(w)).length
    const posCount = positiveWords.filter(w => textLower.includes(w)).length

    if (negCount > posCount) return 'Negative'
    if (posCount > negCount) return 'Positive'
    return 'Neutral'
  }

  const detectComplexWords = (text: string): string[] => {
    // Detect words longer than 10 characters or technical terms
    const words = text.split(/\s+/)
    const complexPatterns = [
      'tion$', 'ical$', 'ment$', 'able$', 'ious$', 'ous$',
      'ity$', 'ism$', 'ize$', 'ance$', 'ence$'
    ]

    const complexWords = words
      .map(w => w.replace(/[.,!?;:]/g, ''))
      .filter(w => {
        if (w.length > 10) return true
        return complexPatterns.some(pattern => 
          new RegExp(pattern).test(w.toLowerCase())
        )
      })

    return [...new Set(complexWords)].slice(0, 5)
  }

  const generateAnalysis = async (text: string, complexWords: string[]): Promise<string> => {
    setGeneratingAnalysis(true)
    try {
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('API key not configured')
      }

      const wordsStr = complexWords.length > 0 ? complexWords.join(', ') : 'None'
      const prompt = `You are helping make text easier for autistic readers.

Sentence: "${text}"

Complex words to explain: ${wordsStr}

Instructions:
1. If complex words are present, explain each in one or two short literal sentences.
2. Provide a very short, concrete explanation (1–2 sentences) of what the sentence means.
3. Provide a simplified version rewritten clearly and literally in one short sentence.

Output format:
Complex Words:
  <word explanations here, if any>
Explanation:
  <1–2 sentence literal meaning>
Simplified:
  <1 short simplified version>`

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 400,
        }),
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (err) {
      console.error('Analysis error:', err)
      return 'Unable to generate analysis at this time. Please try again later.'
    } finally {
      setGeneratingAnalysis(false)
    }
  }

  const finishSession = () => {
    if (session.problematicTexts.length > 0) {
      setShowReport(true)
    } else {
      setCurrentCaption(null)
      setSession({ captions: [], currentIndex: 0, problematicTexts: [] })
    }
  }

  return (
    <div className="disability-page autism-page">
      <header className="page-header autism-header">
        <div className="header-content">
          <div className="header-top">
            <Link to="/" className="back-button">
              <span>←</span> Back
            </Link>
            <div className="header-text">
              <h1>Autism Support</h1>
              <p>Sensory-friendly caption assistant for better understanding</p>
            </div>
          </div>
        </div>
      </header>

      <main className="dyslexia-content-simple">
        <div className="simple-container">
          {showWelcome ? (
            <div className="welcome-modal">
              <button 
                className="close-welcome"
                onClick={() => setShowWelcome(false)}
                aria-label="Close welcome"
              >
                ×
              </button>
              
              <div className="welcome-content">
                <h2>Welcome to Caption Assistant</h2>
                <p className="welcome-intro">This tool helps you understand complex captions by breaking them down into simpler terms.</p>
                
                <div className="welcome-features">
                  <div className="feature">
                    <span className="feature-icon">1</span>
                    <div>
                      <h3>Read Captions</h3>
                      <p>Captions appear one at a time in a clear, readable format</p>
                    </div>
                  </div>
                  
                  <div className="feature">
                    <span className="feature-icon">2</span>
                    <div>
                      <h3>Mark Struggles</h3>
                      <p>Tell us when a caption is confusing or hard to understand</p>
                    </div>
                  </div>
                  
                  <div className="feature">
                    <span className="feature-icon">3</span>
                    <div>
                      <h3>Get Explanations</h3>
                      <p>Complex words are explained literally and simply</p>
                    </div>
                  </div>
                  
                  <div className="feature">
                    <span className="feature-icon">4</span>
                    <div>
                      <h3>Review Report</h3>
                      <p>See all your notes with detailed explanations at the end</p>
                    </div>
                  </div>
                </div>
                
                <div className="welcome-font-note">
                  <p>This page is designed to be sensory-friendly with clear text, predictable interactions, and straightforward language.</p>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="get-started-welcome"
                    onClick={() => initializeSession(DEMO_CAPTIONS)}
                    style={{ flex: 1 }}
                  >
                    Start Demo
                  </button>
                  <button 
                    className="get-started-welcome"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ flex: 1, opacity: 0.6 }}
                  >
                    Upload File
                  </button>
                </div>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".txt"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (event) => {
                        const text = event.target?.result as string
                        const captions = text
                          .split(/[.!?]+/)
                          .map(s => s.trim())
                          .filter(s => s.length > 0)
                        if (captions.length > 0) {
                          initializeSession(captions)
                        }
                      }
                      reader.readAsText(file)
                    }
                  }}
                />
              </div>
            </div>
          ) : currentCaption && !showReport ? (
            <div className="input-card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h2>Caption {session.currentIndex + 1} of {session.captions.length}</h2>
                <div style={{
                  background: 'rgba(227, 209, 240, 0.1)',
                  border: '2px solid rgba(227, 209, 240, 0.3)',
                  borderRadius: '16px',
                  padding: '2rem',
                  marginTop: '1.5rem',
                  minHeight: '150px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <p style={{
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    fontSize: '1.2rem',
                    lineHeight: '1.8',
                    color: '#1a1a1a',
                    margin: 0,
                    textAlign: 'center'
                  }}>
                    {currentCaption}
                  </p>
                </div>
              </div>

              <div>
                {error && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>}
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: '#e5e5e5',
                  borderRadius: '10px',
                  marginBottom: '1rem',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${((session.currentIndex + 1) / session.captions.length) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(135deg, #e3d1f0 0%, #d4b8e5 100%)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                
                <div className="button-group">
                  <button
                    className="action-button view-button"
                    onClick={() => handleCaptionResponse(false)}
                    disabled={loading || generatingAnalysis}
                  >
                    I Understand
                  </button>
                  
                  <button
                    className="action-button quiz-button"
                    onClick={() => handleCaptionResponse(true)}
                    disabled={loading || generatingAnalysis}
                  >
                    {loading || generatingAnalysis ? 'Analyzing...' : 'I Need Help'}
                  </button>
                </div>

                {session.currentIndex + 1 === session.captions.length && (
                  <button
                    className="action-button view-button"
                    onClick={finishSession}
                    disabled={loading || generatingAnalysis}
                    style={{ marginTop: '1rem', width: '100%' }}
                  >
                    Finish Session
                  </button>
                )}
              </div>
            </div>
          ) : showReport && session.problematicTexts.length > 0 ? (
            <div className="input-card">
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>Session Report</h2>
                <p style={{ opacity: 0.7, fontSize: '0.95rem' }}>
                  You marked {session.problematicTexts.length} caption{session.problematicTexts.length !== 1 ? 's' : ''} as difficult
                </p>
              </div>

              <div style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '2rem' }}>
                {session.problematicTexts.map((item, idx) => (
                  <div key={idx} style={{
                    background: 'linear-gradient(135deg, rgba(227, 209, 240, 0.15) 0%, rgba(227, 209, 240, 0.05) 100%)',
                    border: '2px solid rgba(227, 209, 240, 0.4)',
                    borderRadius: '16px',
                    padding: '2rem',
                    marginBottom: '1.5rem',
                    transition: 'all 0.3s ease',
                    cursor: 'default'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        background: 'linear-gradient(135deg, #e3d1f0 0%, #d4b8e5 100%)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '600',
                        flexShrink: 0
                      }}>
                        {idx + 1}
                      </div>
                      <h3 style={{ 
                        margin: 0,
                        fontSize: '1.1rem',
                        color: '#1a1a1a',
                        fontWeight: '600'
                      }}>
                        Caption {idx + 1}
                      </h3>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.6)',
                      border: '1px solid rgba(227, 209, 240, 0.3)',
                      borderRadius: '12px',
                      padding: '1.2rem',
                      marginBottom: '1.5rem',
                      fontStyle: 'italic',
                      color: '#2a2a2a',
                      lineHeight: '1.6'
                    }}>
                      "{item.text}"
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '1rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.4)',
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(227, 209, 240, 0.2)'
                      }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '700', color: '#888', letterSpacing: '0.5px' }}>Sentiment</span>
                        <p style={{ 
                          margin: '0.4rem 0 0 0',
                          fontSize: '0.95rem',
                          fontWeight: '600',
                          color: item.sentiment === 'Negative' ? '#dc2626' : item.sentiment === 'Positive' ? '#16a34a' : '#6b7280'
                        }}>
                          {item.sentiment}
                        </p>
                      </div>

                      {item.complexWords.length > 0 && (
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.4)',
                          padding: '0.8rem 1rem',
                          borderRadius: '10px',
                          border: '1px solid rgba(227, 209, 240, 0.2)'
                        }}>
                          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '700', color: '#888', letterSpacing: '0.5px' }}>Complex Words</span>
                          <p style={{ 
                            margin: '0.4rem 0 0 0',
                            fontSize: '0.85rem',
                            color: '#2a2a2a',
                            lineHeight: '1.4'
                          }}>
                            {item.complexWords.slice(0, 2).join(', ')}{item.complexWords.length > 2 ? '...' : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    {item.analysis && (
                      <div>
                        <div style={{
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          fontWeight: '700',
                          color: '#888',
                          letterSpacing: '0.5px',
                          marginBottom: '0.8rem'
                        }}>
                          AI Analysis
                        </div>
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(227, 209, 240, 0.1) 0%, rgba(227, 209, 240, 0.05) 100%)',
                          padding: '1.2rem',
                          borderRadius: '12px',
                          border: '1px solid rgba(227, 209, 240, 0.2)',
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.9rem',
                          lineHeight: '1.7',
                          color: '#2a2a2a'
                        }}>
                          {item.analysis}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="button-group">
                <button
                  className="action-button view-button"
                  onClick={() => {
                    setShowReport(false)
                    setCurrentCaption(null)
                    setSession({ captions: [], currentIndex: 0, problematicTexts: [] })
                    setShowWelcome(true)
                  }}
                  style={{ width: '100%' }}
                >
                  Start New Session
                </button>
              </div>
            </div>
          ) : (
            <div className="input-card">
              <h2>Session Complete</h2>
              <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
                You completed the session without marking any captions as difficult. Great work!
              </p>

              <button
                className="action-button view-button"
                onClick={() => setShowWelcome(true)}
                style={{ width: '100%' }}
              >
                Start New Session
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
