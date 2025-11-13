import { Link } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import '../styles/disability-page.css'
import '../styles/disability-subpages.css'
import './SignLanguagePage.css'

interface ChunkDebugWord {
  original: string
  singular: string
  stemmed: string
  normalized: string
  applied?: boolean
}

interface VideoResult {
  index: number
  status: 'success' | 'error'
  wordCount: number
  text: string
  url?: string
  error?: string
  debugWords: ChunkDebugWord[]
  mimeType?: string
}

interface VideoDebugSummary {
  total_chunks: number
  max_words_per_chunk: number
  total_words: number
  normalized_text_preview?: string
  transformations_preview?: ChunkDebugWord[]
}

interface BackendVideoResponse {
  index: number
  status: 'success' | 'error' | 'pending'
  word_count: number
  text: string
  video_base64?: string
  error?: string
  debug_words?: ChunkDebugWord[]
  mime_type?: string
}

interface BackendVideoPayload {
  videos?: BackendVideoResponse[]
  debug?: VideoDebugSummary
  error?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  videoResults?: VideoResult[]
  videoDebug?: VideoDebugSummary
  videoError?: string
  videoLoading?: boolean
}

export default function SignLanguagePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [documentLoaded, setDocumentLoaded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  const [spokenLang, setSpokenLang] = useState('en')
  const [signLang, setSignLang] = useState('ase')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sessionId = useRef<string>(`session_${Date.now()}`)
  const videoUrlsRef = useRef<string[]>([])
  const DEBUG_PREVIEW_LIMIT = 20

  useEffect(() => {
    return () => {
      videoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      videoUrlsRef.current = []
    }
  }, [])

  const registerVideoUrl = (url: string) => {
    videoUrlsRef.current.push(url)
    return url
  }

  const releaseVideoUrls = (urls: Array<string | undefined>) => {
    urls.forEach((url) => {
      if (!url) return
      URL.revokeObjectURL(url)
      videoUrlsRef.current = videoUrlsRef.current.filter((stored) => stored !== url)
    })
  }

  const releaseMessageVideoUrls = (message: Message) => {
    if (!message.videoResults || message.videoResults.length === 0) return
    const urls = message.videoResults.map(result => result.url)
    releaseVideoUrls(urls)
  }

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
  const videoMessages = messages.filter(msg => (msg.videoResults?.length ?? 0) > 0)

  const spokenLanguages = [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'German' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
  ]

  const signLanguages = [
    { code: 'ase', name: 'American Sign Language (ASE)' },
    { code: 'gsg', name: 'German Sign Language (GSG)' },
  ]

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsText(file)
      })
    }
    
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')) {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${BACKEND_URL}/api/extract-text`, {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to extract text from file')
      }
      
      const data = await response.json()
      return data.text
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file, 'utf-8')
    })
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadedFile(file)
    setError('')
    setDocumentLoaded(false)

    try {
      setLoading(true)
      const text = await extractTextFromFile(file)
      
      const response = await fetch(`${BACKEND_URL}/api/store-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          session_id: sessionId.current
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to store document')
      }

      setDocumentLoaded(true)
      setShowSettings(false)
      setMessages([{
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Document "${file.name}" loaded successfully! You can now ask questions about it.`
      }])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to extract text from file'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!inputText.trim() || loading) return

    if (!documentLoaded) {
      setError('Please upload a document first')
      return
    }

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputText.trim()
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage.content,
          session_id: sessionId.current
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to get response')
      }

      const data = await response.json()
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        videoLoading: false,
        videoResults: []
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response'
      setError(errorMsg)
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMsg}`
      }])
    } finally {
      setLoading(false)
    }
  }

  const base64ToObjectUrl = (base64Data: string, mime = 'video/webm') => {
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Uint8Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const blob = new Blob([byteNumbers], { type: mime })
    return URL.createObjectURL(blob)
  }

  const generateVideoFromText = async (text: string, spoken: string, signed: string) => {
    const response = await fetch(`${BACKEND_URL}/api/text-to-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        spoken,
        signed,
        fps: 30
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `API error: ${response.status}`)
    }

    const data: BackendVideoPayload = await response.json()
    if (!data.videos || data.videos.length === 0) {
      return { videos: [] as VideoResult[], debug: data.debug }
    }

    const processedVideos: VideoResult[] = data.videos.map((video) => {
      const debugWords: ChunkDebugWord[] = Array.isArray(video.debug_words) ? video.debug_words : []
      const videoResult: VideoResult = {
        index: video.index ?? 0,
        status: video.status === 'success' ? 'success' : 'error',
        wordCount: video.word_count ?? debugWords.length,
        text: video.text ?? '',
        debugWords,
        mimeType: video.mime_type || 'video/webm'
      }

      if (videoResult.status === 'success' && video.video_base64) {
        try {
          const url = base64ToObjectUrl(video.video_base64, videoResult.mimeType)
          videoResult.url = registerVideoUrl(url)
        } catch (conversionError) {
          console.error('Failed to decode video chunk', conversionError)
          videoResult.status = 'error'
          videoResult.error = 'Unable to decode video chunk'
        }
      } else if (video.error) {
        videoResult.error = video.error
      } else if (videoResult.status === 'error' && !videoResult.error) {
        videoResult.error = 'Unknown error'
      }

      return videoResult
    })

    return {
      videos: processedVideos,
      debug: data.debug
    }
  }

  const handleTranslateToSign = async (messageId: string, text: string) => {
    const existingMessage = messages.find(msg => msg.id === messageId)
    if (existingMessage) {
      releaseMessageVideoUrls(existingMessage)
    }

    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, videoLoading: true, videoResults: [], videoDebug: undefined, videoError: undefined }
        : msg
    ))

    try {
      const { videos, debug } = await generateVideoFromText(text, spokenLang, signLang)
      const hasSuccess = videos.some(video => video.status === 'success')

      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? {
              ...msg,
              videoResults: videos,
              videoDebug: debug,
              videoLoading: false,
              videoError: hasSuccess
                ? undefined
                : (videos.length === 0
                    ? 'No video data returned'
                    : 'Video generation failed for all chunks')
            }
          : msg
      ))

      if (!hasSuccess && videos.length > 0) {
        setError('Video generation failed for this answer')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate video'
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, videoLoading: false, videoError: errorMsg }
          : msg
      ))
      setError(errorMsg)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="disability-page sign-language-page">
      <header className="page-header sign-language-header">
        <div className="header-content">
          <div className="header-top">
            <Link to="/" className="back-button">
              <span>←</span> Back
            </Link>
            <div className="header-text">
              <h1>🤟 Sign Language Helper</h1>
              <p>Chat with your course documents and translate answers to sign language</p>
            </div>
          </div>
        </div>
      </header>

      <main className="sign-language-content">
        <div className="sign-language-layout">
          <div className="left-panel">
            <div className="settings-toggle">
              <button
                type="button"
                className={`settings-button ${showSettings ? 'active' : ''}`}
                onClick={() => setShowSettings(prev => !prev)}
              >
                {showSettings ? 'Close Settings' : 'Settings'}
              </button>
              {documentLoaded && (
                <span className="settings-status">✅ Document ready</span>
              )}
            </div>

            {showSettings && (
              <>
                <div className="upload-section">
                  <div className="upload-header">
                    <h2>📄 Upload Document</h2>
                  </div>
                  
                  <div className="upload-area">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.pdf,.docx"
                      onChange={handleFileUpload}
                      className="file-input"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="file-upload-label">
                      <div className="upload-icon">📁</div>
                      <div className="upload-text">
                        {uploadedFile ? uploadedFile.name : 'Click to upload document'}
                      </div>
                      <div className="upload-hint">Supports: .txt, .pdf, .docx</div>
                    </label>
                  </div>

                  {documentLoaded && (
                    <div className="document-status">
                      ✅ Document loaded and ready for questions
                    </div>
                  )}

                  {loading && (
                    <div className="loading-status">
                      Processing document...
                    </div>
                  )}
                </div>

                <div className="language-section">
                  <h3>Language Settings</h3>
                  <div className="language-selectors">
                    <div className="language-selector">
                      <label>Spoken Language:</label>
                      <select 
                        value={spokenLang} 
                        onChange={(e) => setSpokenLang(e.target.value)}
                        className="language-select"
                      >
                        {spokenLanguages.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="language-selector">
                      <label>Sign Language:</label>
                      <select 
                        value={signLang} 
                        onChange={(e) => setSignLang(e.target.value)}
                        className="language-select"
                      >
                        {signLanguages.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="chat-section">
              <div className="chat-header">
                <h2>💬 Chat</h2>
              </div>
              
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-placeholder">
                    <p>Upload a document and start asking questions!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.role}`}>
                      <div className="message-content">
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && (
                        <div className="message-actions">
                          <button
                            className="translate-button"
                            onClick={() => handleTranslateToSign(msg.id, msg.content)}
                            disabled={msg.videoLoading}
                          >
                            {msg.videoLoading ? 'Generating...' : 'Translate to Sign Language'}
                          </button>
                        </div>
                      )}
                      {msg.role === 'assistant' && msg.videoResults && msg.videoResults.length > 0 && (
                        <div className="message-video-summary">
                          Generated {msg.videoResults.filter(result => result.status === 'success').length}/{msg.videoResults.length} chunk videos.
                        </div>
                      )}
                      {msg.role === 'assistant' && msg.videoError && (
                        <div className="message-video-error">⚠️ {msg.videoError}</div>
                      )}
                    </div>
                  ))
                )}
                {loading && (
                  <div className="message assistant">
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-container">
                <textarea
                  className="chat-input"
                  placeholder={documentLoaded ? "Ask a question about the document..." : "Upload a document first..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  rows={2}
                  disabled={!documentLoaded || loading}
                />
                <button
                  className="send-button"
                  onClick={handleSendMessage}
                  disabled={loading || !inputText.trim() || !documentLoaded}
                >
                  {loading ? 'Sending...' : 'Send'}
                </button>
              </div>
              {error && <div className="error-message">{error}</div>}
            </div>
          </div>

          <div className="right-panel">
            <div className="video-section">
              <div className="video-header">
                <h2>🎥 Sign Language Video</h2>
              </div>
              <div className="video-container">
                {videoMessages.length > 0 ? (
                  <div className="videos-list">
                    {videoMessages.map((msg) => {
                      const successCount = msg.videoResults?.filter(result => result.status === 'success').length ?? 0
                      const totalCount = msg.videoResults?.length ?? 0
                      const contentPreview = msg.content.length > 200
                        ? `${msg.content.slice(0, 200)}…`
                        : msg.content

                      return (
                        <div key={msg.id} className="video-group">
                          <div className="video-text-preview">
                            {contentPreview}
                          </div>
                          <div className="video-summary">
                            <span>{successCount}/{totalCount} chunks succeeded</span>
                            {msg.videoDebug && (
                              <span>
                                Chunk size ≤ {msg.videoDebug.max_words_per_chunk} words (total {msg.videoDebug.total_words})
                              </span>
                            )}
                          </div>
                          {msg.videoDebug?.normalized_text_preview && (
                            <div className="video-preview-text">
                              <strong>Processed preview:</strong> {msg.videoDebug.normalized_text_preview}
                            </div>
                          )}
                          {msg.videoResults?.map((result) => (
                            <div key={`${msg.id}-chunk-${result.index}`} className="video-item">
                              <div className="video-item-header">
                                <span>Chunk {result.index + 1}</span>
                                <span>{result.wordCount} words</span>
                              </div>
                              {result.status === 'success' && result.url ? (
                                <video controls className="sign-video">
                                  <source src={result.url} type={result.mimeType || 'video/webm'} />
                                  Your browser does not support the video tag.
                                </video>
                              ) : (
                                <div className="video-error-card">
                                  ⚠️ {result.error || 'Unable to generate video for this chunk'}
                                </div>
                              )}
                              <details className="video-debug">
                                <summary>Debug (transformation candidates)</summary>
                                <div className="debug-table">
                                  {result.debugWords.slice(0, DEBUG_PREVIEW_LIMIT).map((word, index) => (
                                    <div key={`${msg.id}-chunk-${result.index}-word-${index}`} className="debug-row">
                                      <span className="debug-original">{word.original}</span>
                                      <span className="debug-arrow">→</span>
                                      <span className="debug-normalized">{word.normalized}</span>
                                      <span className="debug-note">({word.singular} → {word.stemmed})</span>
                                      <span className={`debug-status ${word.applied ? 'changed' : 'unchanged'}`}>
                                        {word.applied ? 'modified' : 'original'}
                                      </span>
                                    </div>
                                  ))}
                                  {result.debugWords.length > DEBUG_PREVIEW_LIMIT && (
                                    <div className="debug-row debug-more">
                                      … showing {DEBUG_PREVIEW_LIMIT} of {result.debugWords.length} words
                                    </div>
                                  )}
                                  {result.debugWords.length === 0 && (
                                    <div className="debug-row debug-empty">No debug details for this chunk</div>
                                  )}
                                </div>
                              </details>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="video-placeholder">
                    <div className="placeholder-content">
                      <div className="placeholder-icon">🤟</div>
                      <p>Click "Translate to Sign Language" on any answer to see the video</p>
                      <p className="placeholder-hint">Current: {spokenLanguages.find(l => l.code === spokenLang)?.name} → {signLanguages.find(l => l.code === signLang)?.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
