import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import '../styles/disability-page.css'
import '../styles/disability-subpages.css'

interface TextSubsection {
  heading: string
  content: string
}

interface ADHDResult {
  tldr: string[]
  overview: string
  keyPoints: string[]
  details: string
  nextSteps: string[]
  checklist: string[]
  timeEstimate: string
  reformattedText: TextSubsection[]
}

interface QuizQuestion {
  id: string
  question: string
  choices?: string[]
  answer?: string
  type: 'mcq' | 'tf' | 'short'
}

export default function ADHDPage() {
  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState<ADHDResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusPoints, setFocusPoints] = useState(0)
  const [showFullDocument, setShowFullDocument] = useState(false)

  const navigate = useNavigate()

  const parseBoldText = (text?: string | null) => {
    if (!text) return null
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2)
        return (
          <strong key={i} className="adhd-highlight">
            {boldText}
          </strong>
        )
      }
      return part
    })
  }

  const extractJsonObject = (text: string) => {
    const start = text.indexOf('{')
    if (start === -1) return null
    let depth = 0
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++
      if (text[i] === '}') depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
    return null
  }

  const renderMultiline = (text?: string | null) => {
    if (!text) return null
    const parts = text.split(/\n{2,}|\r\n{2,}/).map((p) => p.trim()).filter(Boolean)
    return parts.map((p, i) => {
      if (/^[-•*]\s+/.test(p) || p.includes('\n')) {
        const items = p.split(/\r?\n|[-•*]\s+/).map((s) => s.trim()).filter(Boolean)
        return (
          <ul key={i}>
            {items.map((it, j) => (
              <li key={j}>{parseBoldText(it)}</li>
            ))}
          </ul>
        )
      }
      return <p key={i}>{parseBoldText(p)}</p>
    })
  }

  const normalizedParagraphs = (r?: TextSubsection[]) => {
    if (!r || r.length === 0) return []
    const max = 6
    const min = 3
    if (r.length >= min && r.length <= max) return r.slice(0, max)
    if (r.length > max) return r.slice(0, max)
    if (r.length < min) {
      const allText = r.map((s) => `${s.heading}\n${s.content}`).join('\n\n')
      const sentences = allText
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const chunkCount = Math.max(min, Math.min(max, Math.ceil(sentences.length / 3)))
      const perChunk = Math.ceil(sentences.length / chunkCount)
      const chunks: TextSubsection[] = []
      for (let i = 0; i < chunkCount; i++) {
        const slice = sentences.slice(i * perChunk, (i + 1) * perChunk)
        chunks.push({ heading: `Part ${i + 1}`, content: slice.join(' ').trim() })
      }
      return chunks
    }
    return r.slice(0, max)
  }

  const generateActiveTasks = (res: ADHDResult) => {
    const tasks: string[] = []
    if (!res) return tasks
    tasks.push('Underline the single main claim in each paragraph.')
    if (res.keyPoints && res.keyPoints.length > 0) tasks.push('Choose the top 1–2 **key points** and write them in one sentence.')
    tasks.push('Summarize the whole text in one short sentence.')
    if (res.reformattedText && res.reformattedText.length > 0) tasks.push('Find one sentence you disagree with and explain why (1–2 lines).')
    return tasks
  }

  const generateQuizFromResult = (res: ADHDResult): QuizQuestion[] => {
    if (!res) return []
    const qs: QuizQuestion[] = []
    const kp = res.keyPoints || []
    if (kp.length >= 1) qs.push({ id: 'q1', question: `Which of the following is a main idea from the text?`, choices: [kp[0], kp[1] ?? 'An unrelated idea', 'A made-up incorrect statement'], answer: kp[0], type: 'mcq' })
    if (kp.length >= 2) qs.push({ id: 'q2', question: `True or false: "${kp[1]}" is one of the text's key points.`, choices: ['True', 'False'], answer: 'True', type: 'tf' })
    qs.push({ id: 'q3', question: 'In one sentence, what is the main claim of the text?', type: 'short' })
    return qs
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

    const textSnippet = inputText.length > 4000 ? inputText.substring(0, 4000) + '\n\n...[truncated]' : inputText

    const prompt = `You are rewriting text into an ADHD-friendly, highly readable format.

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
- Use signposting language like: "Here's the key idea…", "In simple terms…", "This means that…".

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
Return a SINGLE JSON object matching this interface:

{
  "tldr": ["string", "string"],
  "overview": "string",
  "keyPoints": ["string"],
  "details": "string",
  "nextSteps": ["string"],
  "checklist": ["string"],
  "timeEstimate": "string",
  "reformattedText": [{"heading": "string", "content": "string"}]
}

Rules for output:
- Every field must be present.
- "tldr" should be 2–3 bullet points summarizing the core message.
- "keyPoints" must be easy to skim.
- "reformattedText" must contain the FULL original text broken into 3-6 small subsections.
- Use **double asterisks** to highlight 1-3 key words per subsection (sparingly).
- Do NOT include markdown or explanation outside of the JSON.
- Do NOT include backticks or extra commentary. Return ONLY the JSON object.

SOURCE TEXT:
Rewrite the following text according to ALL rules above:

${textSnippet}`

    try {
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
      if (!apiKey) throw new Error('VITE_OPENROUTER_API_KEY not found')

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai/gpt-3.5-turbo', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are a strict JSON-only responder. Return only JSON that matches the provided schema.' }, { role: 'user', content: prompt }], temperature: 0.2, max_tokens: 2000 }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`API error ${response.status}: ${errText}`)
      }

      const data = await response.json()
      const raw = data?.choices?.[0]?.message?.content ?? data?.choices?.[0] ?? data
      const contentStr = typeof raw === 'string' ? raw : JSON.stringify(raw)

      let parsed: ADHDResult | null = null
      try {
        parsed = JSON.parse(contentStr) as ADHDResult
      } catch {
        const jsonFragment = extractJsonObject(contentStr)
        if (!jsonFragment) throw new Error('Model did not return a JSON object. Please try again.')
        try {
          parsed = JSON.parse(jsonFragment) as ADHDResult
        } catch (parseErr) {
          console.error('JSON parsing error:', parseErr)
          throw new Error('Model returned invalid JSON. Please try again.')
        }
      }

      const required = ['tldr', 'overview', 'keyPoints', 'details', 'nextSteps', 'checklist', 'timeEstimate', 'reformattedText']
      for (const k of required) if (!(k in parsed!)) throw new Error(`Response missing required field: ${k}`)

      setResult(parsed)
      setFocusPoints((p) => p + 1)
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
            <textarea className="text-input" placeholder="Paste or type your text here..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
            <button className="generate-button" onClick={generateADHDFriendlyText} disabled={loading || !inputText.trim()}>
              {loading ? 'Processing...' : 'Restructure Text'}
            </button>

            {focusPoints > 0 && (
              <div className="focus-gamification">
                <p>
                  Focus streak: <strong>{focusPoints}</strong>{' '}
                  {focusPoints === 1 ? 'document improved' : 'documents improved'}
                </p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(focusPoints * 20, 100)}%` }}></div>
                </div>
              </div>
            )}
          </div>

          <div className="output-section">
            <h2>ADHD-Friendly Output</h2>
            <div className="text-output adhd-optimized">
              {!result && !inputText && <p className="placeholder">Your ADHD-friendly rewrite will appear here with TL;DR, key points, and clear next steps…</p>}
              {error && <p className="error-message">❌ {error}</p>}

              {result && (
                <div className="adhd-structured-content">
                  <section className="adhd-section overview-meta">
                    <h3>Quick Overview</h3>
                    {renderMultiline(result.overview)}

                    <div className="meta-row">
                      <div className="meta-item">
                        <h4>Key Points</h4>
                        <ul>{result.keyPoints?.map((kp, i) => <li key={i}>{parseBoldText(kp)}</li>)}</ul>
                      </div>

                      <div className="meta-item">
                        <h4>Read Time</h4>
                        <p className="time-estimate">{parseBoldText(result.timeEstimate || '≈ 2–5 minutes')}</p>
                      </div>

                      <div className="meta-item">
                        <h4>Active Reading Tasks</h4>
                        <ul>{generateActiveTasks(result).map((t, i) => <li key={i}>{parseBoldText(t)}</li>)}</ul>
                      </div>
                    </div>

                    <div className="meta-actions">
                      <button className="quiz-button" onClick={() => navigate('/quiz', { state: { questions: generateQuizFromResult(result), title: 'Comprehension Quiz' } })}>
                        Take a short quiz
                      </button>
                      <Link to="/notes" className="notes-button">Take Notes</Link>
                    </div>
                  </section>

                  <section className="adhd-section reformatted-section">
                    <h3>Reformatted Paragraphs</h3>
                    <div className="reformatted-grid">
                      {normalizedParagraphs(result.reformattedText).map((sub, i) => (
                        <article key={i} className="reformatted-paragraph">
                          <h4>{parseBoldText(sub.heading)}</h4>
                          {sub.content.split(/(?<=[.?!])\s+/).map((sentence, si) => (
                            <p key={si} className="single-claim-sentence">{parseBoldText(sentence.trim())}</p>
                          ))}
                        </article>
                      ))}
                    </div>

                    {result.reformattedText && result.reformattedText.length > 0 && (
                      <button className="view-full-document-button" onClick={() => setShowFullDocument(true)}>View Full Reformatted Document</button>
                    )}
                  </section>

                  <section className="adhd-section extras-section">
                    <div className="extras-column">
                      <h4>Details / Deep Dive</h4>
                      <div className="details-content">
                        {result.details ? result.details.split('\n\n').map((p, i) => <p key={i}>{parseBoldText(p.trim())}</p>) : <p>No extra details provided.</p>}
                      </div>
                    </div>

                    <div className="extras-column">
                      <h4>Next Steps</h4>
                      <ol>{result.nextSteps?.map((step, i) => <li key={i}>{parseBoldText(step)}</li>)}</ol>

                      <h4>Checklist</h4>
                      <ul className="checklist">{result.checklist?.map((item, i) => <li key={i}>{parseBoldText(item)}</li>)}</ul>
                    </div>
                  </section>
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
              <button className="modal-close-button" onClick={() => setShowFullDocument(false)}>✕</button>
            </div>
            <div className="modal-content">
              {result.reformattedText.map((subsection, i) => (
                <div key={i} className="document-subsection">
                  <h3>{parseBoldText(subsection.heading)}</h3>
                  {subsection.content.split(/(?<=[.?!])\s+/).map((s, si) => (
                    <p key={si}>{parseBoldText(s.trim())}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
