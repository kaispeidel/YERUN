import { Link } from 'react-router-dom'
import { useState } from 'react'
import '../styles/disability-page.css'

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
  const [showModal, setShowModal] = useState(false)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({})

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
        'Generate EXACTLY 3 multiple-choice questions (4 choices A-D) based ONLY on the source text. ' +
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

      // Log raw content for debugging
      console.log('Raw API response:', content)

      const parsedQuestions = JSON.parse(content) as Question[]
      setQuestions(parsedQuestions)
      setShowModal(true)
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
          <Link to="/" className="back-button">
            <span>←</span> Back
          </Link>
          <h1>📖 Dyslexia Support</h1>
          <p>Reading and text processing assistance</p>
        </div>
      </header>

      <main className="dyslexia-content">
        <div className="layout-container">
          {/* Left Column - Input */}
          <div className="input-section">
            <h2>Paste Your Text</h2>
            <textarea
              className="text-input"
              placeholder="Paste or type your text here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button
              className="generate-button"
              onClick={generateQuestions}
              disabled={loading || !inputText.trim()}
            >
              {loading ? '⏳ Generating...' : '✨ Generate Questions'}
            </button>
          </div>

          {/* Right Column - Output */}
          <div className="output-section">
            <h2>Dyslexia-Friendly Output</h2>
            <div className="text-output dyslexia-optimized">
              {inputText && (
                <div className="formatted-text-section">
                  <h3>📄 Formatted Text</h3>
                  <div className="formatted-text">
                    {inputText}
                  </div>
                </div>
              )}

              {questions.length > 0 && (
                <div className="questions-ready">
                  <p>✅ Questions generated! Click the button below to start.</p>
                  <button 
                    className="start-quiz-button"
                    onClick={() => {
                      setShowModal(true)
                      setCurrentQuestionIdx(0)
                    }}
                  >
                    🎯 Start Quiz
                  </button>
                </div>
              )}

              {!inputText && (
                <p className="placeholder">Your dyslexia-friendly text will appear here...</p>
              )}
              {error && <p className="error-message">❌ {error}</p>}
            </div>
          </div>
        </div>
      </main>

      {/* Questions Modal */}
      {showModal && questions.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Quiz Time! 🎯</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
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
                    setShowModal(false)
                  }
                }}
              >
                {currentQuestionIdx === questions.length - 1 ? 'Finish 🎉' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
