import { Link } from 'react-router-dom'
import { useState } from 'react'
import '../styles/disability-page.css'

interface TextSubsection {
  heading: string;
  content: string;
}

interface ADHDResult {
  tldr: string[];
  overview: string;
  keyPoints: string[];
  details: string;
  nextSteps: string[];
  checklist: string[];
  timeEstimate: string;
  reformattedText: TextSubsection[];
}

export default function ADHDPage() {
  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState<ADHDResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusPoints, setFocusPoints] = useState(0)
  const [showFullDocument, setShowFullDocument] = useState(false)

  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2)
        return <strong key={i} className="adhd-highlight">{boldText}</strong>
      }
      return part
    })
  }

  const generateADHDFriendlyText = async () => {
    if (!inputText.trim()) {
      setError('Please paste some text first')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setShowFullDocument(false)

    try {
      const textSnippet =
        inputText.length > 4000
          ? inputText.substring(0, 4000) + '\n\n...[truncated]'
          : inputText

      const prompt = `
You are rewriting text into an ADHD-friendly, highly readable format.

Follow ALL of these rules STRICTLY:

1. KEEP THE STRUCTURE SIMPLE AND PREDICTABLE
- Break the text into short paragraphs (2–4 sentences).
- Use clear section headers that summarize what each part is about.
- Present only one main idea per paragraph.

2. MAKE KEY POINTS EASY TO SPOT
- Highlight or restate the most important message at the beginning and end.
- Use bullet points or numbered lists whenever possible.
- Bold **only the most critical words or concepts** (use sparingly).

3. REDUCE COGNITIVE LOAD
- Use concise, direct sentences.
- Avoid long, nested explanations.
- Remove unnecessary details or repetition unless they strengthen clarity.

4. PROVIDE FREQUENT ORIENTATION
- Add brief summaries after longer sections.
- Use signposting language like:
  "Here's the key idea…", "In simple terms…", "This means that…".

5. USE CONCRETE, RELATABLE EXAMPLES
- Offer short, realistic examples that illustrate abstract concepts.
- Prioritize examples that help the reader visualize the idea.

6. SUPPORT ATTENTION WITH ENGAGING PRESENTATION
- Vary sentence style slightly to avoid monotony, but keep wording simple.
- Use active voice instead of passive voice.

7. MAKE THE TEXT SKIM-FRIENDLY
- Include quick "takeaway" statements.
- Ensure paragraphs can stand alone without needing to re-read earlier sections.

8. MAINTAIN A FRIENDLY, MOTIVATING TONE
- Use encouraging, non-judgmental language.
- Avoid overwhelming or overly formal phrasing.

9. ADD OPTIONAL "DEEP DIVE" CONTENT
- If the text contains complex material, offer a brief version first.
- Then add an optional deeper explanation clearly labeled as "Optional: Deep Dive".

10. ENSURE CLARITY OVER CREATIVITY
- Avoid metaphors or figurative language unless they make the idea easier to understand.
- Prefer literal explanations.

JSON OUTPUT REQUIREMENTS (MANDATORY)
You MUST return a SINGLE JSON object that matches EXACTLY this TypeScript interface:

interface TextSubsection {
  heading: string;
  content: string;
}

interface ADHDResult {
  tldr: string[];
  overview: string;
  keyPoints: string[];
  details: string;
  nextSteps: string[];
  checklist: string[];
  timeEstimate: string;
  reformattedText: TextSubsection[];
}

Rules for output:
- Every field must be present.
- "tldr" should be 2–3 bullet points summarizing the core message.
- "keyPoints" must be easy to skim.
- "details" may include any optional deep-dive content.
- "nextSteps" must be concrete, actionable steps.
- "checklist" must be a simple, scannable list of tasks.
- "reformattedText" must contain the FULL original text broken into small subsections:
  * Each subsection should have a clear, descriptive "heading" (3-7 words)
  * Each "content" should be 1-3 sentences with ONE main claim
  * Use **double asterisks** to highlight 1-3 key words per subsection
  * Headings should be informative and help with navigation
  * Keep sentences short and direct
  * Each subsection should be self-contained and understandable on its own
- Use **double asterisks** for emphasis only on truly key words or phrases.
- Do NOT include markdown or explanation outside of the JSON.
- Do NOT include backticks or extra commentary. Return ONLY the JSON object.

SOURCE TEXT:
Rewrite the following text according to ALL rules above:

${textSnippet}
`

      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('VITE_OPENROUTER_API_KEY not found')
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-3.5-turbo',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`API error ${response.status}: ${errText}`)
      }

      const data = await response.json()
      const content: string = data.choices[0].message.content

      console.log('Raw API response (ADHD):', content)

      const start = content.indexOf('{')
      const end = content.lastIndexOf('}') + 1

      if (start === -1 || end === 0) {
        console.error('No JSON object found in content:', content)
        throw new Error('Model did not return a JSON object. Please try again.')
      }

      const jsonText = content.slice(start, end)

      let parsed: ADHDResult
      try {
        parsed = JSON.parse(jsonText) as ADHDResult
      } catch (parseErr) {
        console.error('JSON parsing error:', parseErr, 'JSON text was:', jsonText)
        throw new Error('Model returned invalid JSON. Please try again.')
      }

      setResult(parsed)
      setFocusPoints((prev) => prev + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate ADHD-friendly text'
      setError(msg)
      console.error('ADHD transform error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="disability-page adhd-page">
      <header className="page-header adhd-header">
        <div className="header-content">
          <div className="header-top">
            <Link to="/" className="back-button">
              <span>←</span> Back
            </Link>
            <div className="header-text">
              <h1>ADHD-Friendly Text</h1>
              <p>Restructure and simplify content for better focus</p>
            </div>
          </div>
        </div>
      </header>

      <main className="adhd-content">
        <div className="layout-container">
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
              onClick={generateADHDFriendlyText}
              disabled={loading || !inputText.trim()}
            >
              {loading ? 'Processing...' : 'Restructure Text'}
            </button>

            {focusPoints > 0 && (
              <div className="focus-gamification">
                <p>
                  Focus streak: <strong>{focusPoints}</strong>{' '}
                  {focusPoints === 1 ? 'document improved' : 'documents improved'}
                </p>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(focusPoints * 20, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="output-section">
            <h2>ADHD-Friendly Output</h2>

            <div className="text-output adhd-optimized">
              {!result && !inputText && (
                <p className="placeholder">
                  Your ADHD-friendly rewrite will appear here with TL;DR, key points, and clear next steps…
                </p>
              )}

              {error && <p className="error-message">❌ {error}</p>}

              {result && (
                <div className="adhd-structured-content">
                  <section className="adhd-section tldr-section">
                    <h3>Summary</h3>
                    <ul>
                      {result.tldr?.map((item, i) => (
                        <li key={i}>{parseBoldText(item)}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="adhd-section overview-section">
                    <h3>Overview</h3>
                    <p>{parseBoldText(result.overview)}</p>
                  </section>

                  <section className="adhd-section keypoints-section">
                    <h3>Key Points</h3>
                    <ul>
                      {result.keyPoints?.map((kp, i) => (
                        <li key={i}>{parseBoldText(kp)}</li>
                      ))}
                    </ul>
                  </section>

                  {result.details && (
                    <section className="adhd-section details-section">
                      <h3>Details</h3>
                      <div className="details-content">
                        {result.details.split('\n\n').map((paragraph, i) => (
                          <p key={i}>{parseBoldText(paragraph.trim())}</p>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="adhd-section nextsteps-section">
                    <h3>Next Steps</h3>
                    <ol>
                      {result.nextSteps?.map((step, i) => (
                        <li key={i}>{parseBoldText(step)}</li>
                      ))}
                    </ol>
                  </section>

                  <section className="adhd-section checklist-section">
                    <h3>Checklist</h3>
                    <ul className="checklist">
                      {result.checklist?.map((item, i) => (
                        <li key={i}>{parseBoldText(item)}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="adhd-section time-section">
                    <h3>Time Estimate</h3>
                    <p className="time-estimate">{parseBoldText(result.timeEstimate)}</p>
                  </section>

                  {result.reformattedText && result.reformattedText.length > 0 && (
                    <button
                      className="view-full-document-button"
                      onClick={() => setShowFullDocument(true)}
                    >
                      View Full Document
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showFullDocument && result?.reformattedText && (
        <div className="modal-overlay" onClick={() => setShowFullDocument(false)}>
          <div className="full-document-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Full Reformatted Document</h2>
              <button
                className="modal-close-button"
                onClick={() => setShowFullDocument(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-content">
              {result.reformattedText.map((subsection, i) => (
                <div key={i} className="document-subsection">
                  <h3>{parseBoldText(subsection.heading)}</h3>
                  <p>{parseBoldText(subsection.content)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
