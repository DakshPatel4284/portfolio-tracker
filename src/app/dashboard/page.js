'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY

export default function Dashboard() {

  const router = useRouter()
  const [trades, setTrades] = useState([])
  const [totalProfit, setTotalProfit] = useState(0)
  const [editingTrade, setEditingTrade] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  // CAPSULE STATES
  const [capsuleOpen, setCapsuleOpen] = useState(false)
  const [capsuleLoading, setCapsuleLoading] = useState(false)
  const [capsuleSummary, setCapsuleSummary] = useState('')
  const [capsuleHistory, setCapsuleHistory] = useState([])
  const [capsuleVersion, setCapsuleVersion] = useState(0)
  const [pdfFileName, setPdfFileName] = useState('')
  const [pdfText, setPdfText] = useState('')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)

  // AI ANALYSIS STATES
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiCopied, setAiCopied] = useState(false)

  useEffect(() => { fetchTrades() }, [])

  const fetchTrades = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('trades').select('*').order('trade_date', { ascending: false })
    if (error) alert(error.message)
    if (data) {
      setTrades(data)
      setTotalProfit(data.reduce((sum, t) => sum + Number(t.profit), 0))
    }
    setLoading(false)
  }

  const deleteTrade = async (id) => {
    if (!confirm('Delete this trade?')) return
    const { error } = await supabase.from('trades').delete().eq('id', id)
    if (error) alert(error.message)
    else fetchTrades()
  }

  const editTrade = (trade) => {
    setEditingTrade(trade)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateTrade = async () => {
    const updatedProfit =
      ((Number(editingTrade.exit_value) - Number(editingTrade.entry_value)) * Number(editingTrade.quantity))
      - Number(editingTrade.charges)
    const { error } = await supabase.from('trades').update({
      stock_name: editingTrade.stock_name,
      entry_value: editingTrade.entry_value,
      exit_value: editingTrade.exit_value,
      charges: editingTrade.charges,
      quantity: editingTrade.quantity,
      trade_date: editingTrade.trade_date,
      profit: updatedProfit
    }).eq('id', editingTrade.id)
    if (error) alert(error.message)
    else { setEditingTrade(null); fetchTrades() }
  }

  const downloadExcel = (period) => {
    const label = { all: 'All Time', '1m': '1 Month', '3m': '3 Months', '6m': '6 Months', '1y': '1 Year' }[period]
    const now = new Date()
    const periodTrades = trades.filter(trade => {
      const d = new Date(trade.trade_date)
      if (period === '1m') { const x = new Date(now); x.setMonth(now.getMonth()-1); return d >= x }
      if (period === '3m') { const x = new Date(now); x.setMonth(now.getMonth()-3); return d >= x }
      if (period === '6m') { const x = new Date(now); x.setMonth(now.getMonth()-6); return d >= x }
      if (period === '1y') { const x = new Date(now); x.setFullYear(now.getFullYear()-1); return d >= x }
      return true
    })
    if (periodTrades.length === 0) { alert(`No trades for ${label}`); return }
    const totalP = periodTrades.reduce((s,t) => s + Number(t.profit), 0)
    const wins = periodTrades.filter(t => Number(t.profit) > 0).length
    const losses = periodTrades.filter(t => Number(t.profit) < 0).length
    const rows = periodTrades.map(t => ({
      'Stock': t.stock_name, 'Entry (Rs)': Number(t.entry_value), 'Exit (Rs)': Number(t.exit_value),
      'Qty': Number(t.quantity), 'Charges (Rs)': Number(t.charges),
      'P&L (Rs)': Number(t.profit), 'Date': t.trade_date, 'Result': Number(t.profit) >= 0 ? 'WIN' : 'LOSS'
    }))
    rows.push({}, { 'Stock': '--- SUMMARY ---' },
      { 'Stock': 'Period', 'Entry (Rs)': label },
      { 'Stock': 'Total Trades', 'Entry (Rs)': periodTrades.length },
      { 'Stock': 'Wins', 'Entry (Rs)': wins },
      { 'Stock': 'Losses', 'Entry (Rs)': losses },
      { 'Stock': 'Total P&L (Rs)', 'Entry (Rs)': totalP })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, label)
    XLSX.writeFile(wb, `TradeTrack_${period}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ─── PDF EXTRACT ──────────────────────────────────────────────────
  const extractTextFromPDF = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const pdfjsLib = await import(
            /* webpackIgnore: true */
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs'
          )
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs'
          const typedArray = new Uint8Array(e.target.result)
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
          let fullText = ''
          for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            fullText += content.items.map(item => item.str).join(' ') + ' '
          }
          resolve(fullText.trim().slice(0, 8000))
        } catch (err) { reject(err) }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  const handlePDFUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') { alert('Please upload a PDF file only'); return }
    setPdfFileName(file.name)
    setCapsuleSummary('')
    setCapsuleHistory([])
    setCapsuleVersion(0)
    setCapsuleLoading(true)
    try {
      const text = await extractTextFromPDF(file)
      if (!text || text.length < 50) { alert('Could not extract text from this PDF.'); setCapsuleLoading(false); return }
      setPdfText(text)
      await generateSummary(text, [])
    } catch (err) {
      alert('Error reading PDF: ' + err.message)
      setCapsuleLoading(false)
    }
  }

  const generateSummary = async (text, history) => {
    setCapsuleLoading(true)
    const previousSummaries = history.length > 0
      ? `\n\nIMPORTANT: DO NOT repeat these previous summaries:\n${history.map((s, i) => `Version ${i+1}: ${s}`).join('\n\n')}\nFocus on completely different aspects.`
      : ''
    const prompt = `Summarize this document in EXACTLY 100 meaningful words. No filler phrases. Clear English. Focus on key facts and ideas.${previousSummaries}\n\nDocument:\n${text.slice(0, 6000)}\n\nWrite the 100-word summary now:`
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300, temperature: 0.9
        })
      })
      const data = await response.json()
      if (data.error) { alert('Groq API error: ' + data.error.message); setCapsuleLoading(false); return }
      setCapsuleSummary(data.choices[0].message.content.trim())
      setCapsuleVersion(prev => prev + 1)
    } catch (err) { alert('Failed to generate summary: ' + err.message) }
    setCapsuleLoading(false)
  }

  const handleRegenerate = async () => {
    if (!pdfText) { alert('Please upload a PDF first'); return }
    const newHistory = [...capsuleHistory, capsuleSummary]
    setCapsuleHistory(newHistory)
    await generateSummary(pdfText, newHistory)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(capsuleSummary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const closeCapsule = () => {
    setCapsuleOpen(false); setCapsuleSummary(''); setCapsuleHistory([])
    setCapsuleVersion(0); setPdfFileName(''); setPdfText('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── AI TRADE ANALYSIS ────────────────────────────────────────────
  const runAIAnalysis = async () => {
    if (trades.length === 0) { alert('No trades found. Add some trades first.'); return }
    setAiOpen(true)
    setAiLoading(true)
    setAiAnalysis('')

    // Build trade summary data
    const totalP = trades.reduce((s,t) => s + Number(t.profit), 0)
    const wins = trades.filter(t => Number(t.profit) > 0)
    const losses = trades.filter(t => Number(t.profit) < 0)
    const winRate = Math.round((wins.length / trades.length) * 100)
    const bestTrade = trades.reduce((a,b) => Number(a.profit) > Number(b.profit) ? a : b)
    const worstTrade = trades.reduce((a,b) => Number(a.profit) < Number(b.profit) ? a : b)
    const avgWin = wins.length > 0 ? wins.reduce((s,t) => s + Number(t.profit), 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? losses.reduce((s,t) => s + Number(t.profit), 0) / losses.length : 0

    // Stock wise performance
    const stockMap = {}
    trades.forEach(t => {
      if (!stockMap[t.stock_name]) stockMap[t.stock_name] = { profit: 0, count: 0 }
      stockMap[t.stock_name].profit += Number(t.profit)
      stockMap[t.stock_name].count += 1
    })
    const stockSummary = Object.entries(stockMap)
      .map(([name, data]) => `${name}: ${data.count} trades, P&L = Rs ${data.profit.toFixed(0)}`)
      .join('\n')

    const tradeList = trades.slice(0, 30).map(t =>
      `${t.stock_name} | Entry: ${t.entry_value} | Exit: ${t.exit_value} | Qty: ${t.quantity} | P&L: Rs ${t.profit} | Date: ${t.trade_date}`
    ).join('\n')

    const prompt = `You are an expert stock trading coach and analyst. Analyze this trader's performance data and give detailed honest insights.

TRADER DATA:
- Total Trades: ${trades.length}
- Total P&L: Rs ${totalP.toFixed(0)}
- Win Rate: ${winRate}%
- Winning Trades: ${wins.length}
- Losing Trades: ${losses.length}
- Best Trade: ${bestTrade.stock_name} with Rs ${bestTrade.profit} profit on ${bestTrade.trade_date}
- Worst Trade: ${worstTrade.stock_name} with Rs ${worstTrade.profit} on ${worstTrade.trade_date}
- Average Win: Rs ${avgWin.toFixed(0)}
- Average Loss: Rs ${avgLoss.toFixed(0)}

STOCK-WISE PERFORMANCE:
${stockSummary}

RECENT TRADES:
${tradeList}

Give a detailed analysis with these EXACT sections using these EXACT emoji headers:

📈 OVERALL PERFORMANCE
Write 2-3 sentences about overall profitability and trading health.

🏆 BEST PERFORMING STOCK
Which stock gives best returns and why.

⚠️ RISK ASSESSMENT
Honest assessment of risk management. Is average loss too big vs wins?

📊 TRADING PATTERNS
What patterns do you notice in their trading behavior?

💡 TOP 3 SUGGESTIONS
Numbered list of 3 specific actionable improvements.

🚫 MISTAKES TO AVOID
2-3 specific mistakes visible in their data.

Keep each section concise and specific to THEIR actual data. Be honest but constructive.`

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          temperature: 0.7
        })
      })
      const data = await response.json()
      if (data.error) { alert('Groq API error: ' + data.error.message); setAiLoading(false); return }
      setAiAnalysis(data.choices[0].message.content.trim())
    } catch (err) { alert('Failed to generate analysis: ' + err.message) }
    setAiLoading(false)
  }

  const handleAiCopy = () => {
    navigator.clipboard.writeText(aiAnalysis)
    setAiCopied(true)
    setTimeout(() => setAiCopied(false), 2000)
  }

  // Parse analysis into sections for beautiful display
  const parseAnalysis = (text) => {
    const sections = []
    const sectionHeaders = [
      { emoji: '📈', key: 'performance' },
      { emoji: '🏆', key: 'best' },
      { emoji: '⚠️', key: 'risk' },
      { emoji: '📊', key: 'patterns' },
      { emoji: '💡', key: 'suggestions' },
      { emoji: '🚫', key: 'mistakes' },
    ]
    sectionHeaders.forEach(({ emoji, key }) => {
      const regex = new RegExp(`${emoji}[\\s\\S]*?(?=${sectionHeaders.map(s => s.emoji).filter(e => e !== emoji).join('|')}|$)`, 'g')
      const match = text.match(regex)
      if (match) {
        const content = match[0].trim()
        const lines = content.split('\n')
        const title = lines[0].trim()
        const body = lines.slice(1).join('\n').trim()
        sections.push({ emoji, title, body, key })
      }
    })
    return sections.length > 0 ? sections : [{ emoji: '🤖', title: 'AI Analysis', body: text, key: 'full' }]
  }

  const getFilteredTrades = () => {
    const now = new Date()
    return trades.filter(trade => {
      const d = new Date(trade.trade_date)
      if (filter === '1m') { const x = new Date(now); x.setMonth(now.getMonth()-1); return d >= x }
      if (filter === '3m') { const x = new Date(now); x.setMonth(now.getMonth()-3); return d >= x }
      if (filter === '6m') { const x = new Date(now); x.setMonth(now.getMonth()-6); return d >= x }
      if (filter === '1y') { const x = new Date(now); x.setFullYear(now.getFullYear()-1); return d >= x }
      return true
    })
  }

  const filteredTrades = getFilteredTrades()
  const filteredProfit = filteredTrades.reduce((s,t) => s + Number(t.profit), 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; color: #e8e8f0; font-family: 'Syne', sans-serif; min-height: 100vh; }
        .mono { font-family: 'Space Mono', monospace; }

        .dashboard-bg {
          min-height: 100vh; background: #0a0a0f;
          background-image: radial-gradient(ellipse at 20% 10%, rgba(99,102,241,0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(16,185,129,0.05) 0%, transparent 50%);
        }

        /* NAVBAR */
        .navbar {
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 0 20px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(10,10,15,0.95); backdrop-filter: blur(12px);
          position: sticky; top: 0; z-index: 100;
        }
        .logo { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 800; letter-spacing: -0.5px; flex-shrink: 0; }
        .logo-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981; flex-shrink: 0; }
        .nav-right { display: flex; align-items: center; gap: 6px; }
        .nav-btn { border-radius: 8px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; cursor: pointer; white-space: nowrap; transition: all 0.2s; border: none; padding: 8px 10px; display: flex; align-items: center; gap: 4px; }
        .btn-ai { background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.25) !important; }
        .btn-ai:hover { background: rgba(16,185,129,0.22); }
        .btn-capsule { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2) !important; }
        .btn-capsule:hover { background: rgba(245,158,11,0.22); }
        .btn-news { background: rgba(99,102,241,0.12); color: #818cf8; border: 1px solid rgba(99,102,241,0.2) !important; }
        .btn-news:hover { background: rgba(99,102,241,0.22); }
        .btn-add { background: #10b981; color: #0a0a0f; }
        .btn-add:hover { background: #0d9e6e; }
        .btn-text { }
        @media (max-width: 480px) { .btn-text { display: none; } .nav-btn { padding: 8px; font-size: 14px; } .logo span { display: none; } }

        /* MAIN */
        .main { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
        .page-title { font-size: 26px; font-weight: 800; letter-spacing: -1px; color: #f0f0f8; }
        .page-subtitle { color: #6b7280; font-size: 13px; margin-top: 4px; }
        .page-header { margin-bottom: 24px; }

        /* FILTER TABS */
        .filter-tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.04); padding: 4px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 20px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; width: 100%; }
        .filter-tabs::-webkit-scrollbar { display: none; }
        .filter-tab { padding: 7px 14px; border-radius: 7px; border: none; background: transparent; color: #6b7280; font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
        .filter-tab.active { background: #1e1e2e; color: #e8e8f0; box-shadow: 0 1px 6px rgba(0,0,0,0.4); }

        /* STAT CARDS */
        .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        @media (max-width: 600px) { .cards-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 360px) { .cards-grid { grid-template-columns: 1fr; } }
        .stat-card { background: #111118; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; }
        .stat-label { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
        .stat-value { font-size: 20px; font-weight: 800; font-family: 'Space Mono', monospace; letter-spacing: -1px; line-height: 1; word-break: break-all; }
        .stat-value.profit { color: #10b981; }
        .stat-value.loss { color: #ef4444; }
        .stat-value.neutral { color: #e8e8f0; }
        .stat-value.blue { color: #6366f1; }
        .stat-badge { display: inline-flex; align-items: center; margin-top: 6px; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 20px; }
        .stat-badge.green { background: rgba(16,185,129,0.12); color: #10b981; }
        .stat-badge.red { background: rgba(239,68,68,0.12); color: #ef4444; }

        /* DOWNLOAD */
        .download-section { margin-bottom: 24px; }
        .download-section-title { font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .download-grid { display: flex; gap: 8px; flex-wrap: wrap; }
        .download-btn { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 14px; color: #9ca3af; font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .download-btn:hover { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.25); color: #10b981; }
        @media (max-width: 400px) { .download-btn { padding: 7px 10px; font-size: 11px; } }

        /* EDIT FORM */
        .edit-form { background: #111118; border: 1px solid rgba(99,102,241,0.3); border-radius: 14px; padding: 20px; margin-bottom: 20px; animation: slideDown 0.2s ease; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .edit-form h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #a5b4fc; }
        .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }
        @media (max-width: 420px) { .form-grid { grid-template-columns: 1fr; } }
        .form-input { background: #0a0a0f; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 11px 12px; color: #e8e8f0; font-family: 'Syne', sans-serif; font-size: 14px; width: 100%; outline: none; transition: border-color 0.2s; -webkit-appearance: none; }
        .form-input:focus { border-color: #6366f1; }
        .form-input::placeholder { color: #4b5563; }
        @media (max-width: 480px) { .form-input { font-size: 16px; } }
        .form-actions { display: flex; gap: 8px; }
        .btn-update { background: #6366f1; color: white; border: none; padding: 11px 20px; border-radius: 8px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; flex: 1; }
        .btn-cancel { background: rgba(255,255,255,0.06); color: #9ca3af; border: 1px solid rgba(255,255,255,0.08); padding: 11px 20px; border-radius: 8px; font-family: 'Syne', sans-serif; font-weight: 600; font-size: 13px; cursor: pointer; flex: 1; }

        /* TABLE */
        .table-section { background: #111118; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; }
        .table-header { padding: 16px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; }
        .table-title { font-size: 15px; font-weight: 700; }
        .trade-count { font-size: 11px; color: #6b7280; font-weight: 600; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 20px; }
        .desktop-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @media (max-width: 700px) { .desktop-table { display: none; } }
        table { width: 100%; border-collapse: collapse; min-width: 580px; }
        thead tr { background: rgba(255,255,255,0.03); }
        th { text-align: left; padding: 10px 16px; font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 1px; }
        tbody tr { border-top: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
        tbody tr:hover { background: rgba(255,255,255,0.02); }
        td { padding: 12px 16px; font-size: 13px; vertical-align: middle; }
        .stock-name { font-weight: 700; font-size: 14px; }
        .profit-cell { font-family: 'Space Mono', monospace; font-weight: 700; font-size: 13px; }
        .profit-cell.pos { color: #10b981; }
        .profit-cell.neg { color: #ef4444; }
        .date-cell { color: #6b7280; font-size: 12px; font-family: 'Space Mono', monospace; }
        .action-cell { display: flex; gap: 6px; }
        .btn-edit { background: rgba(99,102,241,0.12); color: #818cf8; border: 1px solid rgba(99,102,241,0.2); padding: 5px 12px; border-radius: 6px; font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; }
        .btn-delete { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.15); padding: 5px 12px; border-radius: 6px; font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; }

        /* MOBILE CARDS */
        .mobile-cards { display: none; padding: 12px; }
        @media (max-width: 700px) { .mobile-cards { display: block; } }
        .trade-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px; margin-bottom: 10px; }
        .trade-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .trade-card-stock { font-size: 16px; font-weight: 800; }
        .trade-card-pnl { font-family: 'Space Mono', monospace; font-size: 15px; font-weight: 700; }
        .trade-card-pnl.pos { color: #10b981; }
        .trade-card-pnl.neg { color: #ef4444; }
        .trade-card-details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
        .detail-label { font-size: 9px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px; }
        .detail-value { font-size: 12px; font-weight: 600; color: #9ca3af; font-family: 'Space Mono', monospace; }
        .trade-card-actions { display: flex; gap: 8px; }
        .mobile-btn-edit { flex: 1; background: rgba(99,102,241,0.12); color: #818cf8; border: 1px solid rgba(99,102,241,0.2); padding: 10px; border-radius: 8px; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; text-align: center; }
        .mobile-btn-delete { flex: 1; background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.15); padding: 10px; border-radius: 8px; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; text-align: center; }
        .profit-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
        .profit-dot.pos { background: #10b981; box-shadow: 0 0 5px #10b981; }
        .profit-dot.neg { background: #ef4444; box-shadow: 0 0 5px #ef4444; }
        .empty-state { text-align: center; padding: 48px 16px; color: #4b5563; }
        .empty-icon { font-size: 36px; margin-bottom: 10px; }
        .empty-text { font-size: 15px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
        .empty-sub { font-size: 12px; }
        .loading { text-align: center; padding: 48px; color: #4b5563; font-size: 13px; font-weight: 600; letter-spacing: 1px; }

        /* MODAL BASE */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 12px; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }

        /* CAPSULE MODAL */
        .capsule-panel { background: #0f0f18; border: 1px solid rgba(245,158,11,0.2); border-radius: 20px; width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; padding: 24px; animation: slideUp 0.25s ease; }
        @media (max-width: 480px) { .capsule-panel { padding: 18px; border-radius: 16px; } }
        .capsule-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .capsule-panel-title { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 800; }
        .capsule-icon-badge { width: 34px; height: 34px; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
        .modal-close-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: #6b7280; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .upload-area { border: 2px dashed rgba(245,158,11,0.25); border-radius: 14px; padding: 24px 16px; text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 18px; background: rgba(245,158,11,0.03); }
        .upload-area:hover { border-color: rgba(245,158,11,0.5); background: rgba(245,158,11,0.06); }
        .upload-area.has-file { border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.04); }
        .upload-icon { font-size: 30px; margin-bottom: 8px; }
        .upload-text { font-size: 14px; font-weight: 700; color: #e8e8f0; margin-bottom: 4px; word-break: break-all; }
        .upload-sub { font-size: 12px; color: #6b7280; }
        .file-input-hidden { display: none; }
        .loading-dots { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 24px; }
        .loading-dot { width: 8px; height: 8px; border-radius: 50%; animation: bounce 1.2s infinite; }
        .loading-dot.yellow { background: #fbbf24; }
        .loading-dot.green { background: #10b981; }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,80%,100% { transform: scale(0.7); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
        .loading-label { font-size: 11px; color: #6b7280; text-align: center; margin-top: -14px; margin-bottom: 14px; font-weight: 600; letter-spacing: 1px; }
        .summary-card { background: #0a0a0f; border: 1px solid rgba(245,158,11,0.15); border-radius: 14px; padding: 20px; margin-bottom: 14px; animation: fadeIn 0.3s ease; }
        .summary-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .summary-label { font-size: 10px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 1.2px; }
        .version-badge { font-size: 10px; font-weight: 700; background: rgba(245,158,11,0.12); color: #fbbf24; padding: 2px 8px; border-radius: 20px; }
        .summary-text { font-family: 'Roboto', sans-serif; font-size: 15px; font-weight: 400; color: #d1d5db; line-height: 1.75; letter-spacing: 0.2px; }
        @media (max-width: 480px) { .summary-text { font-size: 14px; } }
        .word-count { font-size: 11px; color: #4b5563; margin-top: 10px; font-family: 'Space Mono', monospace; text-align: right; }
        .capsule-actions { display: flex; gap: 10px; margin-bottom: 4px; }
        .btn-regenerate { flex: 1; background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.25); padding: 12px; border-radius: 10px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; text-align: center; }
        .btn-regenerate:hover:not(:disabled) { background: rgba(245,158,11,0.22); }
        .btn-regenerate:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-copy { background: rgba(255,255,255,0.06); color: #9ca3af; border: 1px solid rgba(255,255,255,0.08); padding: 12px 18px; border-radius: 10px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .btn-copy.copied { background: rgba(16,185,129,0.12); color: #10b981; border-color: rgba(16,185,129,0.2); }
        .history-section { margin-top: 18px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px; }
        .history-title { font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .history-item { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 12px; margin-bottom: 8px; }
        .history-version { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .history-text { font-family: 'Roboto', sans-serif; font-size: 13px; color: #6b7280; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

        /* AI ANALYSIS MODAL */
        .ai-panel { background: #0c0c14; border: 1px solid rgba(16,185,129,0.2); border-radius: 20px; width: 100%; max-width: 640px; max-height: 92vh; overflow-y: auto; padding: 24px; animation: slideUp 0.25s ease; }
        @media (max-width: 480px) { .ai-panel { padding: 16px; border-radius: 16px; } }
        .ai-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .ai-panel-title { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 800; }
        .ai-icon-badge { width: 34px; height: 34px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }

        /* AI SECTION CARDS */
        .ai-section { background: #111118; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; margin-bottom: 12px; animation: fadeIn 0.3s ease; }
        .ai-section-title { font-size: 13px; font-weight: 700; color: #e8e8f0; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .ai-section-body { font-family: 'Roboto', sans-serif; font-size: 14px; color: #9ca3af; line-height: 1.7; white-space: pre-wrap; }
        @media (max-width: 480px) { .ai-section-body { font-size: 13px; } }

        /* Color per section */
        .ai-section.performance { border-color: rgba(16,185,129,0.2); }
        .ai-section.performance .ai-section-title { color: #10b981; }
        .ai-section.best { border-color: rgba(251,191,36,0.2); }
        .ai-section.best .ai-section-title { color: #fbbf24; }
        .ai-section.risk { border-color: rgba(239,68,68,0.2); }
        .ai-section.risk .ai-section-title { color: #ef4444; }
        .ai-section.patterns { border-color: rgba(99,102,241,0.2); }
        .ai-section.patterns .ai-section-title { color: #818cf8; }
        .ai-section.suggestions { border-color: rgba(16,185,129,0.2); }
        .ai-section.suggestions .ai-section-title { color: #10b981; }
        .ai-section.mistakes { border-color: rgba(239,68,68,0.15); }
        .ai-section.mistakes .ai-section-title { color: #f87171; }

        .ai-actions { display: flex; gap: 10px; margin-top: 4px; }
        .btn-reanalyze { flex: 1; background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.25); padding: 12px; border-radius: 10px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; text-align: center; }
        .btn-reanalyze:hover:not(:disabled) { background: rgba(16,185,129,0.22); }
        .btn-reanalyze:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ai-copy { background: rgba(255,255,255,0.06); color: #9ca3af; border: 1px solid rgba(255,255,255,0.08); padding: 12px 18px; border-radius: 10px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; }
        .btn-ai-copy.copied { background: rgba(16,185,129,0.12); color: #10b981; border-color: rgba(16,185,129,0.2); }

        /* AI QUICK STATS */
        .ai-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        @media (max-width: 400px) { .ai-stats-row { grid-template-columns: 1fr 1fr; } }
        .ai-stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; text-align: center; }
        .ai-stat-val { font-family: 'Space Mono', monospace; font-size: 16px; font-weight: 700; }
        .ai-stat-val.green { color: #10b981; }
        .ai-stat-val.red { color: #ef4444; }
        .ai-stat-val.blue { color: #818cf8; }
        .ai-stat-label { font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px; }
      `}</style>

      <div className="dashboard-bg">

        {/* NAVBAR */}
        <nav className="navbar">
          <div className="logo">
            <div className="logo-dot"></div>
            <span>TradeTrack</span>
          </div>
          <div className="nav-right">
            <button className="nav-btn btn-ai" onClick={runAIAnalysis}>
              🤖 <span className="btn-text">AI Analysis</span>
            </button>
            <button className="nav-btn btn-capsule" onClick={() => setCapsuleOpen(true)}>
              💊 <span className="btn-text">Capsule</span>
            </button>
            <button className="nav-btn btn-news" onClick={() => router.push('/news')}>
              📰 <span className="btn-text">News</span>
            </button>
            <button className="nav-btn btn-add" onClick={() => router.push('/add-trade')}>
              + <span className="btn-text">Add Trade</span>
            </button>
          </div>
        </nav>

        <div className="main">

          <div className="page-header">
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Monitor your trading performance</p>
          </div>

          {/* FILTER TABS */}
          <div className="filter-tabs">
            {[{ key: 'all', label: 'All Time' }, { key: '1m', label: '1 Month' }, { key: '3m', label: '3 Months' }, { key: '6m', label: '6 Months' }, { key: '1y', label: '1 Year' }].map(({ key, label }) => (
              <button key={key} className={`filter-tab ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>

          {/* STAT CARDS */}
          <div className="cards-grid">
            <div className="stat-card">
              <div className="stat-label">Total P&L</div>
              <div className={`stat-value ${filteredProfit >= 0 ? 'profit' : 'loss'}`}>₹{filteredProfit.toLocaleString('en-IN')}</div>
              <span className={`stat-badge ${filteredProfit >= 0 ? 'green' : 'red'}`}>{filteredProfit >= 0 ? '▲ Profit' : '▼ Loss'}</span>
            </div>
            <div className="stat-card">
              <div className="stat-label">Trades</div>
              <div className="stat-value neutral">{filteredTrades.length}</div>
              <span className="stat-badge green">Executed</span>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg P&L</div>
              <div className="stat-value blue">₹{filteredTrades.length > 0 ? Math.round(filteredProfit / filteredTrades.length).toLocaleString('en-IN') : 0}</div>
              <span className="stat-badge green">Per Trade</span>
            </div>
          </div>

          {/* DOWNLOAD */}
          <div className="download-section">
            <div className="download-section-title">⬇ Download Excel</div>
            <div className="download-grid">
              {[{ period: '1m', label: '1M' }, { period: '3m', label: '3M' }, { period: '6m', label: '6M' }, { period: '1y', label: '1Y' }, { period: 'all', label: 'All' }].map(({ period, label }) => (
                <button key={period} className="download-btn" onClick={() => downloadExcel(period)}>📥 {label}</button>
              ))}
            </div>
          </div>

          {/* EDIT FORM */}
          {editingTrade && (
            <div className="edit-form">
              <h2>✏️ Edit Trade</h2>
              <div className="form-grid">
                <input type="text" placeholder="Stock Name" value={editingTrade.stock_name} onChange={(e) => setEditingTrade({ ...editingTrade, stock_name: e.target.value })} className="form-input" />
                <input type="number" placeholder="Entry Value" value={editingTrade.entry_value} onChange={(e) => setEditingTrade({ ...editingTrade, entry_value: e.target.value })} className="form-input" inputMode="decimal" />
                <input type="number" placeholder="Exit Value" value={editingTrade.exit_value} onChange={(e) => setEditingTrade({ ...editingTrade, exit_value: e.target.value })} className="form-input" inputMode="decimal" />
                <input type="number" placeholder="Charges" value={editingTrade.charges} onChange={(e) => setEditingTrade({ ...editingTrade, charges: e.target.value })} className="form-input" inputMode="decimal" />
                <input type="number" placeholder="Quantity" value={editingTrade.quantity} onChange={(e) => setEditingTrade({ ...editingTrade, quantity: e.target.value })} className="form-input" inputMode="numeric" />
                <input type="date" value={editingTrade.trade_date} onChange={(e) => setEditingTrade({ ...editingTrade, trade_date: e.target.value })} className="form-input" />
              </div>
              <div className="form-actions">
                <button className="btn-update" onClick={updateTrade}>Update</button>
                <button className="btn-cancel" onClick={() => setEditingTrade(null)}>Cancel</button>
              </div>
            </div>
          )}

          {/* TRADES TABLE */}
          <div className="table-section">
            <div className="table-header">
              <span className="table-title">Trade History</span>
              <span className="trade-count">{filteredTrades.length} trades</span>
            </div>
            {loading ? (
              <div className="loading">LOADING TRADES...</div>
            ) : filteredTrades.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <div className="empty-text">No trades found</div>
                <div className="empty-sub">Tap &quot;+ Add Trade&quot; to log your first trade</div>
              </div>
            ) : (
              <>
                <div className="desktop-table">
                  <table>
                    <thead>
                      <tr><th>Stock</th><th>Entry</th><th>Exit</th><th>Qty</th><th>Charges</th><th>P&L</th><th>Date</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {filteredTrades.map((trade) => (
                        <tr key={trade.id}>
                          <td><span className={`profit-dot ${Number(trade.profit) >= 0 ? 'pos' : 'neg'}`}></span><span className="stock-name">{trade.stock_name}</span></td>
                          <td className="mono" style={{ color: '#9ca3af' }}>₹{trade.entry_value}</td>
                          <td className="mono" style={{ color: '#9ca3af' }}>₹{trade.exit_value}</td>
                          <td style={{ color: '#9ca3af' }}>{trade.quantity}</td>
                          <td className="mono" style={{ color: '#9ca3af' }}>₹{trade.charges}</td>
                          <td><span className={`profit-cell ${Number(trade.profit) >= 0 ? 'pos' : 'neg'}`}>{Number(trade.profit) >= 0 ? '+' : ''}₹{Number(trade.profit).toLocaleString('en-IN')}</span></td>
                          <td className="date-cell">{trade.trade_date}</td>
                          <td><div className="action-cell"><button className="btn-edit" onClick={() => editTrade(trade)}>Edit</button><button className="btn-delete" onClick={() => deleteTrade(trade.id)}>Delete</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mobile-cards">
                  {filteredTrades.map((trade) => (
                    <div key={trade.id} className="trade-card">
                      <div className="trade-card-top">
                        <span className="trade-card-stock"><span className={`profit-dot ${Number(trade.profit) >= 0 ? 'pos' : 'neg'}`}></span>{trade.stock_name}</span>
                        <span className={`trade-card-pnl ${Number(trade.profit) >= 0 ? 'pos' : 'neg'}`}>{Number(trade.profit) >= 0 ? '+' : ''}₹{Number(trade.profit).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="trade-card-details">
                        <div><div className="detail-label">Entry</div><div className="detail-value">₹{trade.entry_value}</div></div>
                        <div><div className="detail-label">Exit</div><div className="detail-value">₹{trade.exit_value}</div></div>
                        <div><div className="detail-label">Qty</div><div className="detail-value">{trade.quantity}</div></div>
                        <div><div className="detail-label">Charges</div><div className="detail-value">₹{trade.charges}</div></div>
                        <div><div className="detail-label">Date</div><div className="detail-value">{trade.trade_date}</div></div>
                      </div>
                      <div className="trade-card-actions">
                        <button className="mobile-btn-edit" onClick={() => editTrade(trade)}>✏️ Edit</button>
                        <button className="mobile-btn-delete" onClick={() => deleteTrade(trade.id)}>🗑 Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* CAPSULE MODAL */}
      {capsuleOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeCapsule() }}>
          <div className="capsule-panel">
            <div className="capsule-panel-header">
              <div className="capsule-panel-title">
                <div className="capsule-icon-badge">💊</div>
                <span>Document Capsule</span>
              </div>
              <button className="modal-close-btn" onClick={closeCapsule}>✕</button>
            </div>
            <div className={`upload-area ${pdfFileName ? 'has-file' : ''}`} onClick={() => fileInputRef.current.click()}>
              <div className="upload-icon">{pdfFileName ? '✅' : '📄'}</div>
              <div className="upload-text">{pdfFileName ? pdfFileName : 'Click to upload PDF'}</div>
              <div className="upload-sub">{pdfFileName ? 'Tap to change PDF' : 'PDF files only'}</div>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" className="file-input-hidden" onChange={handlePDFUpload} />
            {capsuleLoading && (
              <>
                <div className="loading-dots">
                  <div className="loading-dot yellow"></div>
                  <div className="loading-dot yellow"></div>
                  <div className="loading-dot yellow"></div>
                </div>
                <div className="loading-label">GENERATING CAPSULE...</div>
              </>
            )}
            {capsuleSummary && !capsuleLoading && (
              <>
                <div className="summary-card">
                  <div className="summary-header">
                    <div className="summary-label">💊 Capsule Summary</div>
                    <span className="version-badge">v{capsuleVersion}</span>
                  </div>
                  <div className="summary-text">{capsuleSummary}</div>
                  <div className="word-count">~{capsuleSummary.split(/\s+/).filter(Boolean).length} words</div>
                </div>
                <div className="capsule-actions">
                  <button className="btn-regenerate" onClick={handleRegenerate} disabled={capsuleLoading}>🔄 Regenerate</button>
                  <button className={`btn-copy ${copied ? 'copied' : ''}`} onClick={handleCopy}>{copied ? '✅ Copied!' : '📋 Copy'}</button>
                </div>
                {capsuleHistory.length > 0 && (
                  <div className="history-section">
                    <div className="history-title">Previous Versions ({capsuleHistory.length})</div>
                    {capsuleHistory.map((h, i) => (
                      <div key={i} className="history-item">
                        <div className="history-version">Version {i + 1}</div>
                        <div className="history-text">{h}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* AI ANALYSIS MODAL */}
      {aiOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setAiOpen(false) }}>
          <div className="ai-panel">

            <div className="ai-panel-header">
              <div className="ai-panel-title">
                <div className="ai-icon-badge">🤖</div>
                <span>AI Trade Analysis</span>
              </div>
              <button className="modal-close-btn" onClick={() => setAiOpen(false)}>✕</button>
            </div>

            {/* QUICK STATS */}
            {trades.length > 0 && (
              <div className="ai-stats-row">
                <div className="ai-stat">
                  <div className={`ai-stat-val ${totalProfit >= 0 ? 'green' : 'red'}`}>
                    ₹{Math.abs(totalProfit).toLocaleString('en-IN')}
                  </div>
                  <div className="ai-stat-label">Total P&L</div>
                </div>
                <div className="ai-stat">
                  <div className="ai-stat-val blue">{Math.round((trades.filter(t => Number(t.profit) > 0).length / trades.length) * 100)}%</div>
                  <div className="ai-stat-label">Win Rate</div>
                </div>
                <div className="ai-stat">
                  <div className="ai-stat-val blue">{trades.length}</div>
                  <div className="ai-stat-label">Total Trades</div>
                </div>
              </div>
            )}

            {/* LOADING */}
            {aiLoading && (
              <>
                <div className="loading-dots">
                  <div className="loading-dot green"></div>
                  <div className="loading-dot green"></div>
                  <div className="loading-dot green"></div>
                </div>
                <div className="loading-label">AI IS ANALYZING YOUR TRADES...</div>
              </>
            )}

            {/* ANALYSIS SECTIONS */}
            {aiAnalysis && !aiLoading && (
              <>
                {parseAnalysis(aiAnalysis).map((section) => (
                  <div key={section.key} className={`ai-section ${section.key}`}>
                    <div className="ai-section-title">{section.title}</div>
                    <div className="ai-section-body">{section.body}</div>
                  </div>
                ))}
                <div className="ai-actions">
                  <button className="btn-reanalyze" onClick={runAIAnalysis} disabled={aiLoading}>
                    🔄 Re-Analyze
                  </button>
                  <button className={`btn-ai-copy ${aiCopied ? 'copied' : ''}`} onClick={handleAiCopy}>
                    {aiCopied ? '✅ Copied!' : '📋 Copy'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}