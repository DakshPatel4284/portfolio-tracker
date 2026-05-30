'use client'
import { useState, useRef } from 'react'

export default function CapsuleModal({ onClose }) {
  const [file, setFile] = useState(null)
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = (f) => {
    if (f && f.type === 'application/pdf') {
      setFile(f)
      setError('')
      setSummary('')
      setAttempt(0)
    } else {
      setError('Please upload a PDF file only.')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  // Extract text from PDF using pdf.js (loaded from CDN — no install needed)
  const extractTextFromPDF = async (pdfFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          // Load pdf.js from CDN if not already loaded
          if (!window.pdfjsLib) {
            await new Promise((res, rej) => {
              const script = document.createElement('script')
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
              script.onload = res
              script.onerror = rej
              document.head.appendChild(script)
            })
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          }

          const typedArray = new Uint8Array(e.target.result)
          const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise
          let fullText = ''

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            const pageText = content.items.map((item) => item.str).join(' ')
            fullText += pageText + '\n'
          }

          resolve(fullText.trim())
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(pdfFile)
    })
  }

  const generateCapsule = async (currentAttempt) => {
    if (!file) return
    setLoading(true)
    setError('')

    try {
      // Step 1: Extract text from PDF in browser
      setExtracting(true)
      const text = await extractTextFromPDF(file)
      setExtracting(false)

      if (!text || text.length < 20) {
        throw new Error('Could not extract text. Your PDF might be a scanned image — please use a text-based PDF.')
      }

      // Step 2: Send text to Groq API via our Next.js route
      const res = await fetch('/api/capsule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, attempt: currentAttempt }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate capsule')

      setSummary(data.summary)
    } catch (err) {
      setExtracting(false)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = () => {
    setAttempt(0)
    generateCapsule(0)
  }

  const handleRegenerate = () => {
    const next = attempt + 1
    setAttempt(next)
    generateCapsule(next)
  }

  const loadingMessage = extracting ? 'Reading PDF...' : 'Generating capsule...'

  return (
    <>
      <style>{`
        .cap-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: cap-fade 0.2s ease;
        }
        @keyframes cap-fade { from { opacity:0 } to { opacity:1 } }
        @keyframes cap-up {
          from { opacity:0; transform: translateY(24px) scale(0.97) }
          to   { opacity:1; transform: translateY(0) scale(1) }
        }
        @keyframes cap-shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position: 400px 0 }
        }
        @keyframes cap-dot {
          0%,100% { opacity:1; transform:scale(1) }
          50%      { opacity:0.3; transform:scale(0.6) }
        }
        @keyframes cap-typein {
          from { opacity:0; }
          to   { opacity:1; }
        }

        .cap-modal {
          background: #0d0f14;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 22px;
          width: 100%;
          max-width: 500px;
          padding: 28px;
          animation: cap-up 0.28s ease;
          box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03);
        }

        .cap-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .cap-title-row { display:flex; align-items:center; gap:12px; }
        .cap-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          border-radius: 13px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
          box-shadow: 0 4px 14px rgba(124,58,237,0.35);
        }
        .cap-title { margin:0; font-size:17px; font-weight:700; color:#fff; }
        .cap-sub   { margin:3px 0 0; font-size:12px; color:#6b7280; }

        .cap-close {
          width: 32px; height: 32px;
          background: rgba(255,255,255,0.05);
          border: none; color: #9ca3af;
          border-radius: 9px; cursor: pointer;
          font-size: 15px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .cap-close:hover { background: rgba(255,255,255,0.1); color:#fff; }

        /* Free badge */
        .free-badge {
          display: inline-flex; align-items: center; gap: 5px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.25);
          color: #10b981;
          font-size: 11px; font-weight: 600;
          padding: 4px 10px; border-radius: 20px;
          margin-bottom: 18px;
        }

        /* Drop zone */
        .cap-drop {
          border: 2px dashed rgba(124,58,237,0.3);
          border-radius: 14px;
          padding: 28px 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(124,58,237,0.03);
          margin-bottom: 16px;
        }
        .cap-drop:hover, .cap-drop.drag { border-color: #7c3aed; background: rgba(124,58,237,0.08); }
        .cap-drop.has-file { border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.04); border-style: solid; }

        .cap-drop-icon { font-size: 30px; margin-bottom: 8px; }
        .cap-drop-text { font-size: 14px; color: #9ca3af; margin: 0 0 4px; }
        .cap-drop-text strong { color: #7c3aed; }
        .cap-drop-hint { font-size: 11px; color: #4b5563; margin: 0; }
        .cap-file-name { font-size: 13px; color: #10b981; font-weight: 600; margin: 4px 0 0; }
        .cap-change-btn {
          margin-top: 8px; background: none; border: none;
          color: #6b7280; font-size: 11px; cursor: pointer;
          text-decoration: underline;
        }

        /* Buttons */
        .cap-btn-primary {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          border: none; border-radius: 12px;
          color: #fff; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
          letter-spacing: 0.01em;
        }
        .cap-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(124,58,237,0.4);
        }
        .cap-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

        .cap-btn-regen {
          width: 100%; margin-top: 12px; padding: 10px;
          background: transparent;
          border: 1px solid rgba(124,58,237,0.3);
          border-radius: 10px; color: #a78bfa;
          font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .cap-btn-regen:hover:not(:disabled) {
          border-color: #7c3aed;
          background: rgba(124,58,237,0.08);
        }
        .cap-btn-regen:disabled { opacity: 0.35; cursor: not-allowed; }

        /* Loading dots */
        .cap-dots { display:flex; align-items:center; justify-content:center; gap:5px; }
        .cap-dot {
          width:6px; height:6px; background:#fff; border-radius:50%;
          animation: cap-dot 1.1s ease infinite;
        }
        .cap-dot:nth-child(2) { animation-delay:0.18s; }
        .cap-dot:nth-child(3) { animation-delay:0.36s; }

        /* Error */
        .cap-error {
          margin-top: 14px; padding: 12px 14px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px; color: #f87171; font-size: 13px;
          line-height: 1.5;
        }

        /* Result */
        .cap-result {
          margin-top: 18px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; padding: 18px;
          animation: cap-up 0.25s ease;
        }
        .cap-result-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px;
        }
        .cap-result-label {
          font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.1em; color: #4b5563; font-weight: 700;
        }
        .cap-word-count {
          font-size: 11px; font-weight: 600;
          background: rgba(124,58,237,0.15);
          color: #a78bfa;
          padding: 3px 9px; border-radius: 20px;
        }
        .cap-result-text {
          font-size: 14px; line-height: 1.8;
          color: #e5e7eb; animation: cap-typein 0.4s ease;
        }

        /* Shimmer skeleton */
        .cap-skel {
          border-radius: 5px; height: 14px; margin: 8px 0;
          background: linear-gradient(90deg, #1f2937 25%, #2d3748 50%, #1f2937 75%);
          background-size: 400px 100%;
          animation: cap-shimmer 1.4s linear infinite;
        }

        @media (max-width: 480px) {
          .cap-modal { padding: 18px; border-radius: 16px; }
        }
      `}</style>

      <div className="cap-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="cap-modal">

          {/* Header */}
          <div className="cap-header">
            <div className="cap-title-row">
              <div className="cap-icon">💊</div>
              <div>
                <h2 className="cap-title">PDF Capsule</h2>
                <p className="cap-sub">AI-powered 50-word summary</p>
              </div>
            </div>
            <button className="cap-close" onClick={onClose}>✕</button>
          </div>

          {/* Free badge */}
          <div className="free-badge">
            ✅ 100% Free — Powered by Groq + LLaMA 3.3
          </div>

          {/* Drop Zone */}
          <div
            className={`cap-drop ${dragOver ? 'drag' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />

            {file ? (
              <>
                <div className="cap-drop-icon">✅</div>
                <p className="cap-file-name">📄 {file.name}</p>
                <p className="cap-drop-hint" style={{ marginTop: 4 }}>
                  {(file.size / 1024).toFixed(0)} KB
                </p>
                <button
                  className="cap-change-btn"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                >
                  Change file
                </button>
              </>
            ) : (
              <>
                <div className="cap-drop-icon">📂</div>
                <p className="cap-drop-text">
                  Drop PDF here or <strong>browse</strong>
                </p>
                <p className="cap-drop-hint">PDF only · Max 10MB · Text-based PDFs only</p>
              </>
            )}
          </div>

          {/* Generate Button */}
          <button
            className="cap-btn-primary"
            onClick={handleGenerate}
            disabled={!file || loading}
          >
            {loading && !summary ? (
              <div className="cap-dots">
                <div className="cap-dot" />
                <div className="cap-dot" />
                <div className="cap-dot" />
                <span style={{ marginLeft: 6, fontSize: 13 }}>{loadingMessage}</span>
              </div>
            ) : (
              '✨ Generate Capsule'
            )}
          </button>

          {/* Error */}
          {error && <div className="cap-error">⚠️ {error}</div>}

          {/* Result Box */}
          {(summary || (loading && summary)) && (
            <div className="cap-result">
              <div className="cap-result-header">
                <span className="cap-result-label">📌 Capsule</span>
                {summary && (
                  <span className="cap-word-count">
                    {summary.split(/\s+/).filter(Boolean).length} words
                  </span>
                )}
              </div>

              {loading ? (
                <>
                  <div className="cap-skel" style={{ width: '100%' }} />
                  <div className="cap-skel" style={{ width: '88%' }} />
                  <div className="cap-skel" style={{ width: '65%' }} />
                </>
              ) : (
                <p className="cap-result-text">{summary}</p>
              )}

              {/* Regenerate */}
              <button
                className="cap-btn-regen"
                onClick={handleRegenerate}
                disabled={loading}
              >
                {loading ? (
                  <div className="cap-dots">
                    <div className="cap-dot" style={{ background: '#a78bfa' }} />
                    <div className="cap-dot" style={{ background: '#a78bfa' }} />
                    <div className="cap-dot" style={{ background: '#a78bfa' }} />
                  </div>
                ) : (
                  <>🔄 Regenerate — get a different summary</>
                )}
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}