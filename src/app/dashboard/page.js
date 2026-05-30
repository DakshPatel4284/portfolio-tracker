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
  const [menuOpen, setMenuOpen] = useState(false)

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
      'Stock': t.stock_name, 'Entry (₹)': Number(t.entry_value), 'Exit (₹)': Number(t.exit_value),
      'Qty': Number(t.quantity), 'Charges (₹)': Number(t.charges),
      'P&L (₹)': Number(t.profit), 'Date': t.trade_date, 'Result': Number(t.profit) >= 0 ? 'WIN' : 'LOSS'
    }))
    rows.push({}, { 'Stock': '--- SUMMARY ---' },
      { 'Stock': 'Period', 'Entry (₹)': label },
      { 'Stock': 'Total Trades', 'Entry (₹)': periodTrades.length },
      { 'Stock': 'Wins', 'Entry (₹)': wins }, { 'Stock': 'Losses', 'Entry (₹)': losses },
      { 'Stock': 'Total P&L (₹)', 'Entry (₹)': totalP })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, label)
    ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }]
    XLSX.writeFile(wb, `TradeTrack_${period}_${new Date().toISOString().slice(0,10)}.xlsx`)
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
  const winningTrades = filteredTrades.filter(t => Number(t.profit) > 0).length
  const losingTrades = filteredTrades.filter(t => Number(t.profit) < 0).length

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');
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
        .logo { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 800; letter-spacing: -0.5px; }
        .logo-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981; }
        .nav-right { display: flex; align-items: center; gap: 8px; }

        .news-btn {
          background: rgba(99,102,241,0.12); color: #818cf8;
          border: 1px solid rgba(99,102,241,0.2);
          padding: 8px 14px; border-radius: 8px;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
          cursor: pointer; transition: all 0.2s; white-space: nowrap;
        }
        .news-btn:hover { background: rgba(99,102,241,0.22); color: #a5b4fc; }

        .add-trade-btn {
          background: #10b981; color: #0a0a0f; border: none;
          padding: 8px 14px; border-radius: 8px;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
          cursor: pointer; transition: all 0.2s; white-space: nowrap;
        }
        .add-trade-btn:hover { background: #0d9e6e; }

        /* MAIN */
        .main { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }

        .page-title { font-size: 26px; font-weight: 800; letter-spacing: -1px; color: #f0f0f8; }
        .page-subtitle { color: #6b7280; font-size: 13px; margin-top: 4px; }
        .page-header { margin-bottom: 24px; }

        /* FILTER TABS - scrollable on mobile */
        .filter-tabs {
          display: flex; gap: 4px;
          background: rgba(255,255,255,0.04); padding: 4px;
          border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 20px; overflow-x: auto;
          -webkit-overflow-scrolling: touch; scrollbar-width: none;
          width: 100%;
        }
        .filter-tabs::-webkit-scrollbar { display: none; }
        .filter-tab {
          padding: 7px 14px; border-radius: 7px; border: none;
          background: transparent; color: #6b7280;
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0;
        }
        .filter-tab.active { background: #1e1e2e; color: #e8e8f0; box-shadow: 0 1px 6px rgba(0,0,0,0.4); }

        /* STAT CARDS */
        .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        @media (max-width: 600px) { .cards-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 380px) { .cards-grid { grid-template-columns: 1fr; } }

        .stat-card {
          background: #111118; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 16px;
        }
        .stat-label { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
        .stat-value { font-size: 22px; font-weight: 800; font-family: 'Space Mono', monospace; letter-spacing: -1px; line-height: 1; }
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
        .download-btn {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; padding: 8px 14px; color: #9ca3af;
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .download-btn:hover { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.25); color: #10b981; }

        /* EDIT FORM */
        .edit-form {
          background: #111118; border: 1px solid rgba(99,102,241,0.3);
          border-radius: 14px; padding: 20px; margin-bottom: 20px;
          animation: slideDown 0.2s ease;
        }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .edit-form h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #a5b4fc; }
        .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }
        @media (max-width: 400px) { .form-grid { grid-template-columns: 1fr; } }
        .form-input {
          background: #0a0a0f; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 10px 12px; color: #e8e8f0;
          font-family: 'Syne', sans-serif; font-size: 14px; width: 100%;
          outline: none; transition: border-color 0.2s;
        }
        .form-input:focus { border-color: #6366f1; }
        .form-input::placeholder { color: #4b5563; }
        .form-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn-update {
          background: #6366f1; color: white; border: none;
          padding: 10px 20px; border-radius: 8px;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
          cursor: pointer; transition: all 0.2s; flex: 1;
        }
        .btn-cancel {
          background: rgba(255,255,255,0.06); color: #9ca3af;
          border: 1px solid rgba(255,255,255,0.08);
          padding: 10px 20px; border-radius: 8px;
          font-family: 'Syne', sans-serif; font-weight: 600; font-size: 13px;
          cursor: pointer; transition: all 0.2s; flex: 1;
        }

        /* TABLE SECTION */
        .table-section { background: #111118; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; }
        .table-header {
          padding: 16px 18px; border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: space-between;
        }
        .table-title { font-size: 15px; font-weight: 700; }
        .trade-count { font-size: 11px; color: #6b7280; font-weight: 600; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 20px; }

        /* DESKTOP TABLE */
        .desktop-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @media (max-width: 700px) { .desktop-table { display: none; } }

        table { width: 100%; border-collapse: collapse; min-width: 600px; }
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
        .btn-edit {
          background: rgba(99,102,241,0.12); color: #818cf8;
          border: 1px solid rgba(99,102,241,0.2);
          padding: 5px 12px; border-radius: 6px;
          font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; cursor: pointer;
        }
        .btn-delete {
          background: rgba(239,68,68,0.08); color: #f87171;
          border: 1px solid rgba(239,68,68,0.15);
          padding: 5px 12px; border-radius: 6px;
          font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; cursor: pointer;
        }

        /* MOBILE CARDS VIEW - shown only on mobile */
        .mobile-cards { display: none; padding: 12px; }
        @media (max-width: 700px) { .mobile-cards { display: block; } }

        .trade-card {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 14px; margin-bottom: 10px;
        }
        .trade-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .trade-card-stock { font-size: 16px; font-weight: 800; letter-spacing: 0.5px; }
        .trade-card-pnl { font-family: 'Space Mono', monospace; font-size: 15px; font-weight: 700; }
        .trade-card-pnl.pos { color: #10b981; }
        .trade-card-pnl.neg { color: #ef4444; }
        .trade-card-details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
        .trade-card-detail-item { }
        .detail-label { font-size: 9px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px; }
        .detail-value { font-size: 12px; font-weight: 600; color: #9ca3af; font-family: 'Space Mono', monospace; }
        .trade-card-actions { display: flex; gap: 8px; }
        .mobile-btn-edit {
          flex: 1; background: rgba(99,102,241,0.12); color: #818cf8;
          border: 1px solid rgba(99,102,241,0.2); padding: 8px;
          border-radius: 8px; font-family: 'Syne', sans-serif;
          font-size: 12px; font-weight: 700; cursor: pointer; text-align: center;
        }
        .mobile-btn-delete {
          flex: 1; background: rgba(239,68,68,0.08); color: #f87171;
          border: 1px solid rgba(239,68,68,0.15); padding: 8px;
          border-radius: 8px; font-family: 'Syne', sans-serif;
          font-size: 12px; font-weight: 700; cursor: pointer; text-align: center;
        }

        /* PROFIT INDICATOR */
        .profit-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
        .profit-dot.pos { background: #10b981; box-shadow: 0 0 5px #10b981; }
        .profit-dot.neg { background: #ef4444; box-shadow: 0 0 5px #ef4444; }

        /* EMPTY / LOADING */
        .empty-state { text-align: center; padding: 48px 16px; color: #4b5563; }
        .empty-icon { font-size: 36px; margin-bottom: 10px; }
        .empty-text { font-size: 15px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
        .empty-sub { font-size: 12px; }
        .loading { text-align: center; padding: 48px; color: #4b5563; font-size: 13px; font-weight: 600; letter-spacing: 1px; }
      `}</style>

      <div className="dashboard-bg">

        {/* NAVBAR */}
        <nav className="navbar">
          <div className="logo">
            <div className="logo-dot"></div>
            <span>TradeTrack</span>
          </div>
          <div className="nav-right">
            <button className="news-btn" onClick={() => router.push('/news')}>📰 News</button>
            <button className="add-trade-btn" onClick={() => router.push('/add-trade')}>+ Add Trade</button>
          </div>
        </nav>

        <div className="main">

          {/* HEADER */}
          <div className="page-header">
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Monitor your trading performance</p>
          </div>

          {/* FILTER TABS */}
          <div className="filter-tabs">
            {[
              { key: 'all', label: 'All Time' },
              { key: '1m', label: '1 Month' },
              { key: '3m', label: '3 Months' },
              { key: '6m', label: '6 Months' },
              { key: '1y', label: '1 Year' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`filter-tab ${filter === key ? 'active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* STAT CARDS */}
          <div className="cards-grid">
            <div className="stat-card">
              <div className="stat-label">Total P&L</div>
              <div className={`stat-value ${filteredProfit >= 0 ? 'profit' : 'loss'}`}>
                ₹{filteredProfit.toLocaleString('en-IN')}
              </div>
              <span className={`stat-badge ${filteredProfit >= 0 ? 'green' : 'red'}`}>
                {filteredProfit >= 0 ? '▲ Profit' : '▼ Loss'}
              </span>
            </div>
            <div className="stat-card">
              <div className="stat-label">Trades</div>
              <div className="stat-value neutral">{filteredTrades.length}</div>
              <span className="stat-badge green">Executed</span>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg P&L</div>
              <div className="stat-value blue">
                ₹{filteredTrades.length > 0
                  ? Math.round(filteredProfit / filteredTrades.length).toLocaleString('en-IN')
                  : 0}
              </div>
              <span className="stat-badge green">Per Trade</span>
            </div>
          </div>

          {/* DOWNLOAD */}
          <div className="download-section">
            <div className="download-section-title">⬇ Download Excel</div>
            <div className="download-grid">
              {[{ period: '1m', label: '1M' }, { period: '3m', label: '3M' }, { period: '6m', label: '6M' }, { period: '1y', label: '1Y' }, { period: 'all', label: 'All' }].map(({ period, label }) => (
                <button key={period} className="download-btn" onClick={() => downloadExcel(period)}>
                  📥 {label}
                </button>
              ))}
            </div>
          </div>

          {/* EDIT FORM */}
          {editingTrade && (
            <div className="edit-form">
              <h2>✏️ Edit Trade</h2>
              <div className="form-grid">
                <input type="text" placeholder="Stock Name" value={editingTrade.stock_name}
                  onChange={(e) => setEditingTrade({ ...editingTrade, stock_name: e.target.value })} className="form-input" />
                <input type="number" placeholder="Entry Value" value={editingTrade.entry_value}
                  onChange={(e) => setEditingTrade({ ...editingTrade, entry_value: e.target.value })} className="form-input" />
                <input type="number" placeholder="Exit Value" value={editingTrade.exit_value}
                  onChange={(e) => setEditingTrade({ ...editingTrade, exit_value: e.target.value })} className="form-input" />
                <input type="number" placeholder="Charges" value={editingTrade.charges}
                  onChange={(e) => setEditingTrade({ ...editingTrade, charges: e.target.value })} className="form-input" />
                <input type="number" placeholder="Quantity" value={editingTrade.quantity}
                  onChange={(e) => setEditingTrade({ ...editingTrade, quantity: e.target.value })} className="form-input" />
                <input type="date" value={editingTrade.trade_date}
                  onChange={(e) => setEditingTrade({ ...editingTrade, trade_date: e.target.value })} className="form-input" />
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
                {/* DESKTOP TABLE */}
                <div className="desktop-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Stock</th><th>Entry</th><th>Exit</th>
                        <th>Qty</th><th>Charges</th><th>P&L</th>
                        <th>Date</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTrades.map((trade) => (
                        <tr key={trade.id}>
                          <td>
                            <span className={`profit-dot ${Number(trade.profit) >= 0 ? 'pos' : 'neg'}`}></span>
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

                {/* MOBILE CARDS */}
                <div className="mobile-cards">
                  {filteredTrades.map((trade) => (
                    <div key={trade.id} className="trade-card">
                      <div className="trade-card-top">
                        <span className="trade-card-stock">
                          <span className={`profit-dot ${Number(trade.profit) >= 0 ? 'pos' : 'neg'}`}></span>
                          {trade.stock_name}
                        </span>
                        <span className={`trade-card-pnl ${Number(trade.profit) >= 0 ? 'pos' : 'neg'}`}>
                          {Number(trade.profit) >= 0 ? '+' : ''}₹{Number(trade.profit).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="trade-card-details">
                        <div className="trade-card-detail-item">
                          <div className="detail-label">Entry</div>
                          <div className="detail-value">₹{trade.entry_value}</div>
                        </div>
                        <div className="trade-card-detail-item">
                          <div className="detail-label">Exit</div>
                          <div className="detail-value">₹{trade.exit_value}</div>
                        </div>
                        <div className="trade-card-detail-item">
                          <div className="detail-label">Qty</div>
                          <div className="detail-value">{trade.quantity}</div>
                        </div>
                        <div className="trade-card-detail-item">
                          <div className="detail-label">Charges</div>
                          <div className="detail-value">₹{trade.charges}</div>
                        </div>
                        <div className="trade-card-detail-item">
                          <div className="detail-label">Date</div>
                          <div className="detail-value">{trade.trade_date}</div>
                        </div>
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
    </>
  )
}