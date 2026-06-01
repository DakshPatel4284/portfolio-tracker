'use client'
import { useState, useRef } from 'react'

/* ═══════════════════════════════════════════════════
   EXTRACTIVE PIPELINE  (no API, runs in browser)
═══════════════════════════════════════════════════ */

// ── Sentence splitting ──
function splitSentences(text) {
  return text
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map(s => s.trim())
    .filter(Boolean)
}

// ── Junk patterns ──
const JUNK = [
  /^\d+$/,
  /^page\s+\d+/i,
  /\bpage\s+\d+\s+of\s+\d+/i,
  /^(chapter|section|table of contents|contents|index|references|bibliography|appendix)/i,
  /^(all rights reserved|copyright|©|\(c\)|isbn|doi:|published by|printed in)/i,
  /^(figure|fig\.|table)\s+\d+/i,
  /^\s*[\d.]+\s+[A-Z]/,
  /^https?:\/\//i,
  /[^\x00-\x7F]{3,}/,
]
function isJunk(s) {
  if (s.length < 45 || s.length > 600) return true
  const alphaRatio = (s.match(/[a-zA-Z]/g) || []).length / s.length
  if (alphaRatio < 0.55) return true
  return JUNK.some(p => p.test(s.trim()))
}

// ── TF-IDF ──
const STOP = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall','can',
  'that','this','these','those','it','its','we','our','they','their','he',
  'she','his','her','you','your','i','my','me','us','not','no','so','as',
  'if','then','than','when','where','which','who','what','how','all','also',
  'just','more','some','such','into','about','after','before','between',
  'through','during','each','other','there',
])
function tokenize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w))
}
function tfidfScores(sentences) {
  const N = sentences.length
  if (N === 0) return []
  const tfMaps = sentences.map(s => {
    const tokens = tokenize(s)
    const map = {}
    for (const t of tokens) map[t] = (map[t] || 0) + 1
    const len = tokens.length || 1
    Object.keys(map).forEach(k => (map[k] /= len))
    return map
  })
  const df = {}
  for (const m of tfMaps)
    for (const w of Object.keys(m)) df[w] = (df[w] || 0) + 1
  return sentences.map((_, i) => {
    let score = 0
    for (const [w, tf] of Object.entries(tfMaps[i]))
      score += tf * (Math.log((N + 1) / ((df[w] || 0) + 1)) + 1)
    return score
  })
}

// ── Cosine similarity ──
function cosineSim(a, b) {
  const wa = new Set(tokenize(a)), wb = new Set(tokenize(b))
  const all = new Set([...wa, ...wb])
  let dot = 0, na = 0, nb = 0
  for (const w of all) {
    const va = wa.has(w) ? 1 : 0, vb = wb.has(w) ? 1 : 0
    dot += va * vb; na += va * va; nb += vb * vb
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

// ── Build pool of up to 15 unique sentences ──
function buildPool(rawText) {
  const sentences = splitSentences(rawText)
  const clean = sentences
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !isJunk(s))

  if (clean.length === 0)
    throw new Error('No usable sentences found. Your PDF may be scanned or image-based.')

  const texts  = clean.map(x => x.s)
  const scores = tfidfScores(texts)
  const scored = clean.map((x, j) => ({ ...x, score: scores[j] }))

  // Sort by score, deduplicate, collect up to 15
  const sorted = [...scored].sort((a, b) => b.score - a.score)
  const pool = []
  for (const cand of sorted) {
    if (pool.some(c => cosineSim(c.s, cand.s) > 0.50)) continue
    pool.push(cand)
    if (pool.length === 15) break
  }

  if (pool.length === 0)
    throw new Error('Could not extract meaningful sentences from this PDF.')

  // Restore document order within the pool
  pool.sort((a, b) => a.i - b.i)

  return pool.map(x => x.s)
}


/* ═══════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════ */
export default function CapsuleModal({ onClose }) {
  const [file,       setFile]       = useState(null)
  const [capsules,   setCapsules]   = useState([])   // current 5 shown
  const [pool,       setPool]       = useState([])   // up to 15 candidates
  const [poolIndex,  setPoolIndex]  = useState(0)    // pointer into pool
  const [loading,    setLoading]    = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error,      setError]      = useState('')
  const [dragOver,   setDragOver]   = useState(false)
  const fileInputRef = useRef(null)

  // ── File handling ──
  const handleFile = (f) => {
    if (f && f.type === 'application/pdf') {
      setFile(f); setError(''); setCapsules([]); setPool([]); setPoolIndex(0)
    } else {
      setError('Please upload a PDF file only.')
    }
  }
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }

  // ── PDF extraction ──
  const extractTextFromPDF = async (pdfFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          if (!window.pdfjsLib) {
            await new Promise((res, rej) => {
              const script = document.createElement('script')
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
              script.onload = res; script.onerror = rej
              document.head.appendChild(script)
            })
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          }
          const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise
          let fullText = ''
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            fullText += content.items.map(item => item.str).join(' ') + '\n'
          }
          resolve(fullText.trim())
        } catch (err) { reject(err) }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(pdfFile)
    })
  }

  // ── First generate: build pool, show first 5 ──
  const handleGenerate = async () => {
    if (!file) return
    setLoading(true); setExtracting(true); setError(''); setCapsules([]); setPool([]); setPoolIndex(0)
    try {
      const text = await extractTextFromPDF(file)
      setExtracting(false)
      if (!text || text.length < 50)
        throw new Error('Could not extract text. Your PDF might be a scanned image — please use a text-based PDF.')
      await new Promise(r => setTimeout(r, 40)) // let UI repaint
      const newPool = buildPool(text)
      setPool(newPool)
      setCapsules(newPool.slice(0, 5))
      setPoolIndex(5)
    } catch (err) {
      setExtracting(false); setError(err.message); setCapsules([])
    } finally {
      setLoading(false)
    }
  }

  // ── Regenerate: advance pointer, never repeat ──
  const handleRegenerate = () => {
    if (poolIndex >= pool.length) return
    const next = pool.slice(poolIndex, poolIndex + 5)
    setCapsules(next)
    setPoolIndex(poolIndex + 5)
  }

  const canRegenerate  = poolIndex < pool.length
  const loadingMessage = extracting ? 'Reading PDF...' : 'Extracting capsules...'

  return (
    <>
      <style>{`
        /* ── Animations ── */
        @keyframes cap-fade    { from { opacity:0 } to { opacity:1 } }
        @keyframes cap-up      { from { opacity:0; transform:translateY(20px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes cap-shimmer { 0% { background-position:-400px 0 } 100% { background-position:400px 0 } }
        @keyframes cap-dot     { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.3; transform:scale(0.6) } }
        @keyframes cap-item    { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }

        /* ── Overlay ── */
        .cap-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.82);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: flex-end;        /* sheet slides up from bottom on mobile */
          justify-content: center;
          padding: 0;
          animation: cap-fade 0.2s ease;
        }
        /* On larger screens centre it like a modal */
        @media (min-width: 540px) {
          .cap-overlay {
            align-items: center;
            padding: 16px;
          }
        }

        /* ── Modal card ── */
        .cap-modal {
          background: #0d0f14;
          border: 1px solid rgba(255,255,255,0.07);
          /* full-width bottom-sheet on mobile, capped width on desktop */
          width: 100%;
          max-width: 500px;
          padding: 24px 20px;
          padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
          /* rounded top corners only on mobile (sheet style) */
          border-radius: 20px 20px 0 0;
          animation: cap-up 0.3s ease;
          box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
          max-height: 92dvh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        @media (min-width: 540px) {
          .cap-modal {
            border-radius: 22px;
            padding: 28px;
            padding-bottom: 28px;
            box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03);
          }
        }

        /* Drag handle pill (mobile only) */
        .cap-drag-handle {
          width: 36px; height: 4px;
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
          margin: 0 auto 18px;
        }
        @media (min-width: 540px) { .cap-drag-handle { display: none; } }

        /* ── Header ── */
        .cap-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
        .cap-title-row { display:flex; align-items:center; gap:12px; }
        .cap-icon {
          width:44px; height:44px; flex-shrink:0;
          background:linear-gradient(135deg,#7c3aed,#4f46e5);
          border-radius:13px; display:flex; align-items:center; justify-content:center;
          font-size:20px; box-shadow:0 4px 14px rgba(124,58,237,0.35);
        }
        .cap-title { margin:0; font-size:17px; font-weight:700; color:#fff; line-height:1.2; }
        .cap-sub   { margin:3px 0 0; font-size:12px; color:#6b7280; }

        /* Close button — bigger tap target on mobile */
        .cap-close {
          width:44px; height:44px;
          background:rgba(255,255,255,0.05);
          border:none; color:#9ca3af; border-radius:12px; cursor:pointer;
          font-size:15px; display:flex; align-items:center; justify-content:center;
          transition:background 0.15s, color 0.15s; flex-shrink:0;
          -webkit-tap-highlight-color: transparent;
        }
        .cap-close:active { background:rgba(255,255,255,0.12); color:#fff; }
        @media (min-width: 540px) {
          .cap-close { width:32px; height:32px; border-radius:9px; }
          .cap-close:hover { background:rgba(255,255,255,0.1); color:#fff; }
        }

        /* ── Free badge ── */
        .free-badge {
          display:inline-flex; align-items:center; gap:5px;
          background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25);
          color:#10b981; font-size:11px; font-weight:600;
          padding:4px 10px; border-radius:20px; margin-bottom:18px;
        }

        /* ── Drop zone ── */
        .cap-drop {
          border:2px dashed rgba(124,58,237,0.3); border-radius:14px;
          padding:26px 16px; text-align:center; cursor:pointer;
          transition:border-color 0.2s, background 0.2s;
          background:rgba(124,58,237,0.03); margin-bottom:14px;
          /* prevent text selection on long-press */
          user-select:none; -webkit-user-select:none;
          -webkit-tap-highlight-color:transparent;
        }
        .cap-drop:active, .cap-drop.drag { border-color:#7c3aed; background:rgba(124,58,237,0.08); }
        .cap-drop.has-file { border-color:rgba(16,185,129,0.4); background:rgba(16,185,129,0.04); border-style:solid; }
        .cap-drop-icon { font-size:28px; margin-bottom:8px; }
        .cap-drop-text { font-size:14px; color:#9ca3af; margin:0 0 4px; }
        .cap-drop-text strong { color:#a78bfa; }
        .cap-drop-hint { font-size:11px; color:#4b5563; margin:0; }
        .cap-file-name { font-size:13px; color:#10b981; font-weight:600; margin:4px 0 0; word-break:break-all; }
        .cap-file-size { font-size:11px; color:#4b5563; margin-top:2px; }
        .cap-change-btn {
          margin-top:10px; background:none; border:none;
          color:#6b7280; font-size:11px; cursor:pointer;
          text-decoration:underline; font-family:inherit;
          /* large enough to tap */
          padding:6px 2px; display:inline-block;
          -webkit-tap-highlight-color:transparent;
        }

        /* ── Primary button ── */
        .cap-btn-primary {
          width:100%;
          min-height:50px;           /* 50px tap target */
          padding:13px;
          background:linear-gradient(135deg,#7c3aed,#4f46e5);
          border:none; border-radius:12px; color:#fff;
          font-size:15px; font-weight:600; cursor:pointer;
          transition:opacity 0.2s, transform 0.15s;
          letter-spacing:0.01em;
          display:flex; align-items:center; justify-content:center;
          -webkit-tap-highlight-color:transparent;
        }
        .cap-btn-primary:active:not(:disabled) { opacity:0.85; transform:scale(0.98); }
        .cap-btn-primary:disabled { opacity:0.45; cursor:not-allowed; }
        @media (min-width: 540px) {
          .cap-btn-primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 24px rgba(124,58,237,0.4); }
        }

        /* ── Regen button ── */
        .cap-btn-regen {
          width:100%; margin-top:12px;
          min-height:46px;           /* comfortable tap target */
          padding:10px;
          background:transparent; border:1px solid rgba(124,58,237,0.3);
          border-radius:10px; color:#a78bfa; font-size:13px; font-weight:500;
          cursor:pointer; transition:border-color 0.2s, background 0.2s;
          display:flex; align-items:center; justify-content:center; gap:6px;
          -webkit-tap-highlight-color:transparent;
        }
        .cap-btn-regen:active:not(:disabled) { border-color:#7c3aed; background:rgba(124,58,237,0.08); }
        .cap-btn-regen:disabled { opacity:0.35; cursor:not-allowed; }
        @media (min-width: 540px) {
          .cap-btn-regen:hover:not(:disabled) { border-color:#7c3aed; background:rgba(124,58,237,0.08); }
        }

        /* ── Loading dots ── */
        .cap-dots { display:flex; align-items:center; justify-content:center; gap:5px; }
        .cap-dot  { width:6px; height:6px; background:#fff; border-radius:50%; animation:cap-dot 1.1s ease infinite; }
        .cap-dot:nth-child(2) { animation-delay:0.18s; }
        .cap-dot:nth-child(3) { animation-delay:0.36s; }
        .cap-dot-label { margin-left:6px; font-size:13px; }

        /* ── Error ── */
        .cap-error {
          margin-top:14px; padding:12px 14px;
          background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2);
          border-radius:10px; color:#f87171; font-size:13px; line-height:1.5;
        }

        /* ── Result box ── */
        .cap-result {
          margin-top:18px;
          background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);
          border-radius:14px; padding:16px; animation:cap-up 0.25s ease;
        }
        .cap-result-header {
          display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;
        }
        .cap-result-label {
          font-size:10px; text-transform:uppercase; letter-spacing:0.1em; color:#4b5563; font-weight:700;
        }
        .cap-count-badge {
          font-size:11px; font-weight:600;
          background:rgba(124,58,237,0.15); color:#a78bfa;
          padding:3px 9px; border-radius:20px;
        }

        /* ── Capsule items ── */
        .cap-list { display:flex; flex-direction:column; gap:10px; }
        .cap-item {
          display:flex; gap:10px; align-items:flex-start;
          padding:12px;
          background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06);
          border-radius:10px; animation:cap-item 0.3s ease both;
        }
        .cap-item:nth-child(1) { animation-delay:0.00s; }
        .cap-item:nth-child(2) { animation-delay:0.07s; }
        .cap-item:nth-child(3) { animation-delay:0.14s; }
        .cap-item:nth-child(4) { animation-delay:0.21s; }
        .cap-item:nth-child(5) { animation-delay:0.28s; }
        .cap-item-num {
          flex-shrink:0; width:24px; height:24px;
          background:linear-gradient(135deg,#7c3aed,#4f46e5);
          border-radius:7px; font-size:11px; font-weight:700; color:#fff;
          display:flex; align-items:center; justify-content:center; margin-top:1px;
        }
        .cap-item-text { font-size:13.5px; line-height:1.75; color:#e5e7eb; flex:1; }

        /* ── Skeleton ── */
        .cap-skel {
          border-radius:5px; height:13px; margin:7px 0;
          background:linear-gradient(90deg,#1f2937 25%,#2d3748 50%,#1f2937 75%);
          background-size:400px 100%; animation:cap-shimmer 1.4s linear infinite;
        }
        .cap-skel-item {
          display:flex; gap:10px; align-items:flex-start;
          padding:12px;
          background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04);
          border-radius:10px; margin-bottom:10px;
        }

        /* ── Copy button ── */
        .cap-copy-btn {
          margin-top:12px; padding:9px 16px;
          min-height:40px;
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
          border-radius:8px; color:#9ca3af; font-size:12px; cursor:pointer;
          transition:background 0.15s, color 0.15s;
          display:inline-flex; align-items:center; gap:6px;
          -webkit-tap-highlight-color:transparent;
        }
        .cap-copy-btn:active { background:rgba(255,255,255,0.1); color:#fff; }
        .cap-copy-btn.copied { color:#10b981; border-color:rgba(16,185,129,0.3); }
        @media (min-width: 540px) {
          .cap-copy-btn:hover { background:rgba(255,255,255,0.08); color:#fff; }
        }

        /* ── Pool exhausted ── */
        .cap-exhausted {
          margin-top:10px; padding:10px 12px;
          background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.18);
          border-radius:8px; color:#6ee7b7; font-size:12px; text-align:center; line-height:1.5;
        }
      `}</style>

      <div className="cap-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="cap-modal">

          {/* Drag handle — visible on mobile only */}
          <div className="cap-drag-handle" />

          {/* Header */}
          <div className="cap-header">
            <div className="cap-title-row">
              <div className="cap-icon">💊</div>
              <div>
                <h2 className="cap-title">PDF Capsule</h2>
                <p className="cap-sub">5 key sentences from your PDF</p>
              </div>
            </div>
            <button className="cap-close" onClick={onClose} aria-label="Close">✕</button>
          </div>

          {/* Badge */}
          <div className="free-badge">
            ✅ 100% Free — No API · Runs in your browser
          </div>

          {/* Drop Zone */}
          <div
            className={`cap-drop ${dragOver ? 'drag' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="Upload PDF"
          >
            <input
              ref={fileInputRef} type="file" accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
            {file ? (
              <>
                <div className="cap-drop-icon">✅</div>
                <p className="cap-file-name">📄 {file.name}</p>
                <p className="cap-file-size">{(file.size / 1024).toFixed(0)} KB</p>
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
                <p className="cap-drop-text">Tap to choose or <strong>drop PDF here</strong></p>
                <p className="cap-drop-hint">PDF only · Max 10 MB · Text-based PDFs only</p>
              </>
            )}
          </div>

          {/* Generate Button */}
          <button className="cap-btn-primary" onClick={handleGenerate} disabled={!file || loading}>
            {loading ? (
              <div className="cap-dots">
                <div className="cap-dot" /><div className="cap-dot" /><div className="cap-dot" />
                <span className="cap-dot-label">{loadingMessage}</span>
              </div>
            ) : '✨ Extract 5 Capsules'}
          </button>

          {/* Error */}
          {error && <div className="cap-error">⚠️ {error}</div>}

          {/* Result */}
          {(loading || capsules.length > 0) && (
            <div className="cap-result">
              <div className="cap-result-header">
                <span className="cap-result-label">📌 Capsules</span>
                <span className="cap-count-badge">5 sentences</span>
              </div>

              {loading ? (
                [1,2,3,4,5].map(n => (
                  <div className="cap-skel-item" key={n}>
                    <div className="cap-skel" style={{ width:24, height:24, flexShrink:0, borderRadius:7, margin:0 }} />
                    <div style={{ flex:1 }}>
                      <div className="cap-skel" style={{ width:'100%' }} />
                      <div className="cap-skel" style={{ width:'68%' }} />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="cap-list">
                    {capsules.map((text, i) => (
                      <div className="cap-item" key={i}>
                        <div className="cap-item-num">{i + 1}</div>
                        <p className="cap-item-text">{text}</p>
                      </div>
                    ))}
                  </div>

                  <CopyAllButton capsules={capsules} />

                  {canRegenerate ? (
                    <button className="cap-btn-regen" onClick={handleRegenerate}>
                      🔄 Regenerate — get a different set
                    </button>
                  ) : (
                    <div className="cap-exhausted">
                      ✅ All unique capsules shown — no more left in this PDF
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}

/* ── Copy-all sub-component ── */
function CopyAllButton({ capsules }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    const text = capsules.map((s, i) => `${i + 1}. ${s}`).join('\n\n')
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className={`cap-copy-btn${copied ? ' copied' : ''}`} onClick={copy}>
      {copied ? '✅ Copied!' : '📋 Copy all'}
    </button>
  )
}