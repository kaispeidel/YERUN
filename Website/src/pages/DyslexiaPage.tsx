import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import '../styles/disability-page.css'
import '../styles/disability-subpages.css'

interface Question {
  question: string
  choices: string[]
  answer: string
  explanation: string
}

export default function DyslexiaPage() {
  const [inputText, setInputText] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showQuestionsModal, setShowQuestionsModal] = useState(false)
  const [showFormattedModal, setShowFormattedModal] = useState(false)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({})
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    const hasVisited = localStorage.getItem('dyslexia-visited')
    if (!hasVisited) {
      setShowWelcome(true)
      localStorage.setItem('dyslexia-visited', 'true')
    }
  }, [])

  const generateQuestions = async () => {
    if (!inputText.trim()) {
      setError('Please paste some text first')
      return
    }

    setLoading(true)
    setError('')
    setQuestions([])

    try {
      const textSnippet = inputText.length > 3000 ? inputText.substring(0, 3000) + '\n\n...[truncated]' : inputText

      const prompt = (
        'Generate EXACTLY 5 multiple-choice questions (4 choices A-D) based ONLY on the source text. ' +
        'Return only valid JSON array: ' +
        '[{"question":"...","choices":["A ...","B ...","C ...","D ..."],"answer":"B","explanation":"..."}]' +
        `\n\nSource text:\n\n${textSnippet}`
      )

      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('VITE_OPENROUTER_API_KEY not found in environment variables')
      }

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
          max_tokens: 800,
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`API error ${response.status}: ${errorData}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content

      console.log('Raw API response:', content)

      const parsedQuestions = JSON.parse(content) as Question[]
      setQuestions(parsedQuestions)
      setShowQuestionsModal(true)
      setCurrentQuestionIdx(0)
      setSelectedAnswers({})
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate questions'
      setError(errorMsg)
      console.error('Full error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="disability-page dyslexia-page">
      <header className="page-header dyslexia-header">
        <div className="header-content">
          <div className="header-top">
            <Link to="/" className="back-button">
              <span>←</span> Back
            </Link>
            <div className="header-text">
              <h1>Dyslexia Support</h1>
              <p>Reading and text processing assistance</p>
            </div>
          </div>
          <p className="font-credit">
            Font by <a href="https://opendyslexic.org/" target="_blank" rel="noopener noreferrer">OpenDyslexic</a> — Thank you for making reading accessible
          </p>
        </div>
      </header>

      <main className="dyslexia-content-simple">
        <div className="simple-container">
          <div className="input-card">
            <h2>Paste Your Text</h2>
            <textarea
              className="text-input-simple"
              placeholder="Paste or type your text here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            
            {error && <p className="error-message">{error}</p>}
            
            <div className="button-group">
              <button
                className="action-button view-button"
                onClick={() => setShowFormattedModal(true)}
                disabled={!inputText.trim()}
              >
                View Dyslexia-Friendly
              </button>
              
              <button
                className="action-button quiz-button"
                onClick={generateQuestions}
                disabled={loading || !inputText.trim()}
              >
                {loading ? 'Generating...' : 'Generate Questions'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Formatted Text Modal */}
      {showFormattedModal && inputText && (
        <div className="modal-overlay" onClick={() => setShowFormattedModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Dyslexia-Friendly View</h2>
              <button className="modal-close" onClick={() => setShowFormattedModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="formatted-text dyslexia-optimized">
                {inputText}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Questions Modal */}
      {showQuestionsModal && questions.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowQuestionsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Quiz Time</h2>
              <button className="modal-close" onClick={() => setShowQuestionsModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${((currentQuestionIdx + 1) / questions.length) * 100}%` }}></div>
              </div>
              <p className="progress-text">Question {currentQuestionIdx + 1} of {questions.length}</p>

              {questions[currentQuestionIdx] && (
                <div className="question-display">
                  <h3 className="question-title">{questions[currentQuestionIdx].question}</h3>
                  
                  <div className="choices-grid">
                    {questions[currentQuestionIdx].choices.map((choice, idx) => {
                      const choiceLetter = choice.charAt(0)
                      const isSelected = selectedAnswers[currentQuestionIdx] === choiceLetter
                      const isCorrect = choiceLetter === questions[currentQuestionIdx].answer
                      const showCorrect = selectedAnswers[currentQuestionIdx] && isCorrect

                      return (
                        <button
                          key={idx}
                          className={`choice-button ${isSelected ? 'selected' : ''} ${showCorrect ? 'correct' : ''} ${isSelected && !isCorrect ? 'incorrect' : ''}`}
                          onClick={() => setSelectedAnswers({ ...selectedAnswers, [currentQuestionIdx]: choiceLetter })}
                        >
                          {choice}
                        </button>
                      )
                    })}
                  </div>

                  {selectedAnswers[currentQuestionIdx] && (
                    <div className={`feedback ${selectedAnswers[currentQuestionIdx] === questions[currentQuestionIdx].answer ? 'correct-feedback' : 'incorrect-feedback'}`}>
                      <p><strong>💡 Explanation:</strong> {questions[currentQuestionIdx].explanation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="nav-button prev-button"
                onClick={() => setCurrentQuestionIdx(Math.max(0, currentQuestionIdx - 1))}
                disabled={currentQuestionIdx === 0}
              >
                ← Previous
              </button>

              <button
                className="nav-button next-button"
                onClick={() => {
                  if (currentQuestionIdx < questions.length - 1) {
                    setCurrentQuestionIdx(currentQuestionIdx + 1)
                  } else {
                    setShowQuestionsModal(false)
                  }
                }}
              >
                {currentQuestionIdx === questions.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal */}
      {showWelcome && (
        <div className="modal-overlay">
          <div className="welcome-modal">
            <button 
              className="close-welcome"
              onClick={() => setShowWelcome(false)}
              aria-label="Close welcome"
            >
              ×
            </button>
            
            <div className="welcome-content">
              <h2>👋 Welcome to Dyslexia Support!</h2>
              <p className="welcome-intro">Hey there! I'm here to help you improve your reading comprehension and text processing.</p>
              
              <div className="welcome-features">
                <div className="feature">
                  <span className="feature-icon">1</span>
                  <div>
                    <h3>Paste Your Text</h3>
                    <p>Copy any article, assignment, or document you want to work with</p>
                  </div>
                </div>
                
                <div className="feature">
                  <span className="feature-icon">2</span>
                  <div>
                    <h3>Generate Questions</h3>
                    <p>AI creates 3 multiple-choice questions to test your understanding</p>
                  </div>
                </div>
                
                <div className="feature">
                  <span className="feature-icon">3</span>
                  <div>
                    <h3>Test Yourself</h3>
                    <p>Take the quiz with dyslexia-friendly formatting for easier reading</p>
                  </div>
                </div>
                
                <div className="feature">
                  <span className="feature-icon">4</span>
                  <div>
                    <h3>Learn & Improve</h3>
                    <p>Get explanations for each answer to understand better</p>
                  </div>
                </div>
              </div>
              
              <div className="welcome-font-note">
                <p>This page uses <strong>OpenDyslexic</strong> font, which is scientifically designed to help with reading dyslexia. All text is spaced out for easier reading.</p>
              </div>
              
              <button 
                className="get-started-welcome"
                onClick={() => setShowWelcome(false)}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
