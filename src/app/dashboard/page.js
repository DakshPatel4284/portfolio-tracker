'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export default function Dashboard() {

  const router = useRouter()
  const [trades, setTrades] = useState([])
  const [totalProfit, setTotalProfit] = useState(0)
  const [editingTrade, setEditingTrade] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchTrades()
  }, [])

  const fetchTrades = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('trade_date', { ascending: false })

    if (error) {
      alert(error.message)
    }

    if (data) {
      setTrades(data)
      const total = data.reduce(
        (sum, trade) => sum + Number(trade.profit), 0
      )
      setTotalProfit(total)
    }
    setLoading(false)
  }

  const deleteTrade = async (id) => {
    const confirmDelete = confirm('Are you sure you want to delete this trade?')
    if (!confirmDelete) return

    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id)

    if (error) {
      alert(error.message)
    } else {
      fetchTrades()
    }
  }

  const editTrade = (trade) => {
    setEditingTrade(trade)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateTrade = async () => {
    const updatedProfit =
      ((Number(editingTrade.exit_value) - Number(editingTrade.entry_value))
        * Number(editingTrade.quantity))
      - Number(editingTrade.charges)

    const { error } = await supabase
      .from('trades')
      .update({
        stock_name: editingTrade.stock_name,
        entry_value: editingTrade.entry_value,
        exit_value: editingTrade.exit_value,
        charges: editingTrade.charges,
        quantity: editingTrade.quantity,
        trade_date: editingTrade.trade_date,
        profit: updatedProfit
      })
      .eq('id', editingTrade.id)

    if (error) {
      alert(error.message)
    } else {
      setEditingTrade(null)
      fetchTrades()
    }
  }

  // DOWNLOAD EXCEL
  const downloadExcel = (period, tradesData) => {

    const label = period === 'all' ? 'All Time' :
      period === '1m' ? '1 Month' :
      period === '3m' ? '3 Months' :
      period === '6m' ? '6 Months' : '1 Year'

    // Get trades for this specific period
    const now = new Date()
    const periodTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.trade_date)
      if (period === '1m') {
        const d = new Date(now); d.setMonth(now.getMonth() - 1); return tradeDate >= d
      } else if (period === '3m') {
        const d = new Date(now); d.setMonth(now.getMonth() - 3); return tradeDate >= d
      } else if (period === '6m') {
        const d = new Date(now); d.setMonth(now.getMonth() - 6); return tradeDate >= d
      } else if (period === '1y') {
        const d = new Date(now); d.setFullYear(now.getFullYear() - 1); return tradeDate >= d
      }
      return true
    })

    if (periodTrades.length === 0) {
      alert(`No trades found for ${label}`)
      return
    }

    const totalP = periodTrades.reduce((sum, t) => sum + Number(t.profit), 0)
    const wins = periodTrades.filter(t => Number(t.profit) > 0).length
    const losses = periodTrades.filter(t => Number(t.profit) < 0).length

    // Build rows
    const rows = periodTrades.map(trade => ({
      'Stock Name': trade.stock_name,
      'Entry Price (₹)': Number(trade.entry_value),
      'Exit Price (₹)': Number(trade.exit_value),
      'Quantity': Number(trade.quantity),
      'Charges (₹)': Number(trade.charges),
      'Profit / Loss (₹)': Number(trade.profit),
      'Trade Date': trade.trade_date,
      'Result': Number(trade.profit) >= 0 ? 'WIN' : 'LOSS'
    }))

    // Add summary rows at bottom
    rows.push({})
    rows.push({
      'Stock Name': 'SUMMARY',
      'Entry Price (₹)': '',
      'Exit Price (₹)': '',
      'Quantity': '',
      'Charges (₹)': '',
      'Profit / Loss (₹)': '',
      'Trade Date': '',
      'Result': ''
    })
    rows.push({ 'Stock Name': 'Period', 'Entry Price (₹)': label })
    rows.push({ 'Stock Name': 'Total Trades', 'Entry Price (₹)': periodTrades.length })
    rows.push({ 'Stock Name': 'Winning Trades', 'Entry Price (₹)': wins })
    rows.push({ 'Stock Name': 'Losing Trades', 'Entry Price (₹)': losses })
    rows.push({ 'Stock Name': 'Total Profit/Loss (₹)', 'Entry Price (₹)': totalP })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, label)

    // Column widths
    worksheet['!cols'] = [
      { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 10 }, { wch: 14 }, { wch: 18 },
      { wch: 14 }, { wch: 8 }
    ]

    XLSX.writeFile(workbook, `TradeTrack_${period}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }


  const getFilteredTrades = () => {
    const now = new Date()
    return trades.filter(trade => {
      const tradeDate = new Date(trade.trade_date)
      if (filter === '1m') {
        const oneMonthAgo = new Date(now)
        oneMonthAgo.setMonth(now.getMonth() - 1)
        return tradeDate >= oneMonthAgo
      } else if (filter === '3m') {
        const threeMonthsAgo = new Date(now)
        threeMonthsAgo.setMonth(now.getMonth() - 3)
        return tradeDate >= threeMonthsAgo
      } else if (filter === '6m') {
        const sixMonthsAgo = new Date(now)
        sixMonthsAgo.setMonth(now.getMonth() - 6)
        return tradeDate >= sixMonthsAgo
      } else if (filter === '1y') {
        const oneYearAgo = new Date(now)
        oneYearAgo.setFullYear(now.getFullYear() - 1)
        return tradeDate >= oneYearAgo
      }
      return true
    })
  }

  const filteredTrades = getFilteredTrades()
  const filteredProfit = filteredTrades.reduce(
    (sum, trade) => sum + Number(trade.profit), 0
  )
  const winningTrades = filteredTrades.filter(t => Number(t.profit) > 0).length
  const losingTrades = filteredTrades.filter(t => Number(t.profit) < 0).length
  const winRate = filteredTrades.length > 0
    ? Math.round((winningTrades / filteredTrades.length) * 100)
    : 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0a0a0f;
          color: #e8e8f0;
          font-family: 'Syne', sans-serif;
          min-height: 100vh;
        }

        .mono { font-family: 'Space Mono', monospace; }

        .dashboard-bg {
          min-height: 100vh;
          background: #0a0a0f;
          background-image:
            radial-gradient(ellipse at 20% 10%, rgba(99,102,241,0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(16,185,129,0.05) 0%, transparent 50%);
        }

        /* NAVBAR */
        .navbar {
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 0 32px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(10,10,15,0.9);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .logo-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px #10b981;
        }

        .add-trade-btn {
          background: #10b981;
          color: #0a0a0f;
          border: none;
          padding: 10px 22px;
          border-radius: 8px;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          letter-spacing: 0.3px;
        }

        .add-trade-btn:hover {
          background: #0d9e6e;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(16,185,129,0.3);
        }

        .news-btn {
          background: rgba(99,102,241,0.12);
          color: #818cf8;
          border: 1px solid rgba(99,102,241,0.2);
          padding: 10px 22px;
          border-radius: 8px;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .news-btn:hover {
          background: rgba(99,102,241,0.22);
          color: #a5b4fc;
          transform: translateY(-1px);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* MAIN CONTENT */
        .main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 24px;
        }

        /* PAGE HEADER */
        .page-header {
          margin-bottom: 32px;
        }

        .page-title {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -1px;
          color: #f0f0f8;
        }

        .page-subtitle {
          color: #6b7280;
          font-size: 14px;
          margin-top: 6px;
          font-weight: 400;
        }

        /* FILTER TABS */
        .filter-tabs {
          display: flex;
          gap: 6px;
          background: rgba(255,255,255,0.04);
          padding: 4px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
          width: fit-content;
          margin-bottom: 32px;
        }

        .filter-tab {
          padding: 7px 18px;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: #6b7280;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-tab.active {
          background: #1e1e2e;
          color: #e8e8f0;
          box-shadow: 0 1px 6px rgba(0,0,0,0.4);
        }

        .filter-tab:hover:not(.active) {
          color: #a0a0b8;
        }

        /* STAT CARDS */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        @media (max-width: 900px) {
          .cards-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 500px) {
          .cards-grid { grid-template-columns: 1fr; }
        }

        .stat-card {
          background: #111118;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 22px 24px;
          transition: border-color 0.2s;
        }

        .stat-card:hover {
          border-color: rgba(255,255,255,0.13);
        }

        .stat-label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 800;
          font-family: 'Space Mono', monospace;
          letter-spacing: -1px;
          line-height: 1;
        }

        .stat-value.profit { color: #10b981; }
        .stat-value.loss { color: #ef4444; }
        .stat-value.neutral { color: #e8e8f0; }
        .stat-value.blue { color: #6366f1; }
        .stat-value.orange { color: #f59e0b; }

        .stat-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
          font-size: 12px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 20px;
        }

        .stat-badge.green {
          background: rgba(16,185,129,0.12);
          color: #10b981;
        }

        .stat-badge.red {
          background: rgba(239,68,68,0.12);
          color: #ef4444;
        }

        /* EDIT FORM */
        .edit-form {
          background: #111118;
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 28px;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .edit-form h2 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 20px;
          color: #a5b4fc;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        @media (max-width: 700px) {
          .form-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .form-input {
          background: #0a0a0f;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 11px 14px;
          color: #e8e8f0;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          width: 100%;
          outline: none;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          border-color: #6366f1;
        }

        .form-input::placeholder { color: #4b5563; }

        .form-actions {
          display: flex;
          gap: 10px;
        }

        .btn-update {
          background: #6366f1;
          color: white;
          border: none;
          padding: 10px 22px;
          border-radius: 8px;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-update:hover {
          background: #5254cc;
          transform: translateY(-1px);
        }

        .btn-cancel {
          background: rgba(255,255,255,0.06);
          color: #9ca3af;
          border: 1px solid rgba(255,255,255,0.08);
          padding: 10px 22px;
          border-radius: 8px;
          font-family: 'Syne', sans-serif;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-cancel:hover {
          background: rgba(255,255,255,0.1);
          color: #e8e8f0;
        }

        /* TABLE SECTION */
        .table-section {
          background: #111118;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          overflow: hidden;
        }

        .table-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .table-title {
          font-size: 16px;
          font-weight: 700;
        }

        .trade-count {
          font-size: 12px;
          color: #6b7280;
          font-weight: 600;
          background: rgba(255,255,255,0.05);
          padding: 3px 10px;
          border-radius: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead tr {
          background: rgba(255,255,255,0.03);
        }

        th {
          text-align: left;
          padding: 12px 24px;
          font-size: 11px;
          font-weight: 700;
          color: #4b5563;
          text-transform: uppercase;
          letter-spacing: 1.2px;
        }

        tbody tr {
          border-top: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
        }

        tbody tr:hover {
          background: rgba(255,255,255,0.02);
        }

        td {
          padding: 14px 24px;
          font-size: 14px;
          vertical-align: middle;
        }

        .stock-name {
          font-weight: 700;
          font-size: 15px;
          letter-spacing: 0.5px;
        }

        .profit-cell {
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          font-size: 14px;
        }

        .profit-cell.pos { color: #10b981; }
        .profit-cell.neg { color: #ef4444; }

        .date-cell {
          color: #6b7280;
          font-size: 13px;
          font-family: 'Space Mono', monospace;
        }

        .action-cell {
          display: flex;
          gap: 8px;
        }

        .btn-edit {
          background: rgba(99,102,241,0.12);
          color: #818cf8;
          border: 1px solid rgba(99,102,241,0.2);
          padding: 6px 14px;
          border-radius: 6px;
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-edit:hover {
          background: rgba(99,102,241,0.25);
          color: #a5b4fc;
        }

        .btn-delete {
          background: rgba(239,68,68,0.08);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.15);
          padding: 6px 14px;
          border-radius: 6px;
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-delete:hover {
          background: rgba(239,68,68,0.2);
          color: #fca5a5;
        }

        /* EMPTY STATE */
        .empty-state {
          text-align: center;
          padding: 60px 24px;
          color: #4b5563;
        }

        .empty-icon {
          font-size: 40px;
          margin-bottom: 12px;
        }

        .empty-text {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 6px;
          color: #6b7280;
        }

        .empty-sub {
          font-size: 13px;
        }

        /* LOADING */
        .loading {
          text-align: center;
          padding: 60px;
          color: #4b5563;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
        }

        /* PROFIT INDICATOR */
        .profit-indicator {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          margin-right: 8px;
          vertical-align: middle;
        }

        .profit-indicator.pos { background: #10b981; box-shadow: 0 0 6px #10b981; }
        .profit-indicator.neg { background: #ef4444; box-shadow: 0 0 6px #ef4444; }

        /* DOWNLOAD SECTION */
        .download-section {
          margin-bottom: 32px;
        }

        .download-section-title {
          font-size: 12px;
          font-weight: 700;
          color: #4b5563;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          margin-bottom: 12px;
        }

        .download-grid {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .download-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 9px;
          padding: 10px 18px;
          color: #9ca3af;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .download-btn:hover {
          background: rgba(16,185,129,0.08);
          border-color: rgba(16,185,129,0.25);
          color: #10b981;
          transform: translateY(-1px);
        }

        .download-icon {
          font-size: 15px;
        }
      `}</style>

      <div className="dashboard-bg">

        {/* NAVBAR */}
        <nav className="navbar">
          <div className="logo">
            <div className="logo-dot"></div>
            <span>TradeTrack</span>
          </div>
          <div className="nav-right">
            <button
              className="news-btn"
              onClick={() => router.push('/news')}
            >
              📰 News
            </button>
            <button
              className="add-trade-btn"
              onClick={() => router.push('/add-trade')}
            >
              + Add Trade
            </button>
          </div>
        </nav>

        {/* MAIN */}
        <div className="main">

          {/* PAGE HEADER */}
          <div className="page-header">
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Monitor your trading performance</p>
          </div>

          {/* FILTER TABS */}
          <div className="filter-tabs">
            {['all', '1m', '3m', '6m', '1y'].map(f => (
              <button
                key={f}
                className={`filter-tab ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All Time' :
                  f === '1m' ? '1 Month' :
                    f === '3m' ? '3 Months' :
                      f === '6m' ? '6 Months' : '1 Year'}
              </button>
            ))}
          </div>

          {/* STAT CARDS */}
          <div className="cards-grid">

            <div className="stat-card">
              <div className="stat-label">Total Profit / Loss</div>
              <div className={`stat-value ${filteredProfit >= 0 ? 'profit' : 'loss'}`}>
                ₹{filteredProfit.toLocaleString('en-IN')}
              </div>
              <span className={`stat-badge ${filteredProfit >= 0 ? 'green' : 'red'}`}>
                {filteredProfit >= 0 ? '▲' : '▼'} {filteredProfit >= 0 ? 'Profit' : 'Loss'}
              </span>
            </div>

            <div className="stat-card">
              <div className="stat-label">Total Trades</div>
              <div className="stat-value neutral">{filteredTrades.length}</div>
              <span className="stat-badge green">Executed</span>
            </div>

            <div className="stat-card">
              <div className="stat-label">Avg. Profit</div>
              <div className={`stat-value blue`}>
                ₹{filteredTrades.length > 0
                  ? Math.round(filteredProfit / filteredTrades.length).toLocaleString('en-IN')
                  : 0}
              </div>
              <span className="stat-badge green">Per Trade</span>
            </div>

          </div>

          {/* DOWNLOAD SECTION */}
          <div className="download-section">
            <div className="download-section-title">⬇ Download Excel Report</div>
            <div className="download-grid">
              {[
                { period: '1m', label: '1 Month' },
                { period: '3m', label: '3 Months' },
                { period: '6m', label: '6 Months' },
                { period: '1y', label: '1 Year' },
                { period: 'all', label: 'All Time' },
              ].map(({ period, label }) => (
                <button
                  key={period}
                  className="download-btn"
                  onClick={() => downloadExcel(period)}
                >
                  <span className="download-icon">📥</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* EDIT FORM */}
          {editingTrade && (
            <div className="edit-form">
              <h2>✏️ Edit Trade</h2>
              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Stock Name"
                  value={editingTrade.stock_name}
                  onChange={(e) => setEditingTrade({ ...editingTrade, stock_name: e.target.value })}
                  className="form-input"
                />
                <input
                  type="number"
                  placeholder="Entry Value"
                  value={editingTrade.entry_value}
                  onChange={(e) => setEditingTrade({ ...editingTrade, entry_value: e.target.value })}
                  className="form-input"
                />
                <input
                  type="number"
                  placeholder="Exit Value"
                  value={editingTrade.exit_value}
                  onChange={(e) => setEditingTrade({ ...editingTrade, exit_value: e.target.value })}
                  className="form-input"
                />
                <input
                  type="number"
                  placeholder="Charges"
                  value={editingTrade.charges}
                  onChange={(e) => setEditingTrade({ ...editingTrade, charges: e.target.value })}
                  className="form-input"
                />
                <input
                  type="number"
                  placeholder="Quantity"
                  value={editingTrade.quantity}
                  onChange={(e) => setEditingTrade({ ...editingTrade, quantity: e.target.value })}
                  className="form-input"
                />
                <input
                  type="date"
                  value={editingTrade.trade_date}
                  onChange={(e) => setEditingTrade({ ...editingTrade, trade_date: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-actions">
                <button className="btn-update" onClick={updateTrade}>Update Trade</button>
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
                <div className="empty-sub">Click &quot;+ Add Trade&quot; to log your first trade</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>Qty</th>
                      <th>Charges</th>
                      <th>Profit / Loss</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map((trade) => (
                      <tr key={trade.id}>
                        <td>
                          <span className="profit-indicator pos"></span>
                          <span className="stock-name">{trade.stock_name}</span>
                        </td>
                        <td className="mono" style={{ color: '#9ca3af' }}>₹{trade.entry_value}</td>
                        <td className="mono" style={{ color: '#9ca3af' }}>₹{trade.exit_value}</td>
                        <td style={{ color: '#9ca3af' }}>{trade.quantity}</td>
                        <td className="mono" style={{ color: '#9ca3af' }}>₹{trade.charges}</td>
                        <td>
                          <span className={`profit-cell ${Number(trade.profit) >= 0 ? 'pos' : 'neg'}`}>
                            {Number(trade.profit) >= 0 ? '+' : ''}₹{Number(trade.profit).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="date-cell">{trade.trade_date}</td>
                        <td>
                          <div className="action-cell">
                            <button className="btn-edit" onClick={() => editTrade(trade)}>Edit</button>
                            <button className="btn-delete" onClick={() => deleteTrade(trade.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </div>
      </div>
    </>
  )
}