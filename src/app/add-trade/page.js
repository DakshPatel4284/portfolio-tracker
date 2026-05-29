'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AddTrade() {

  const router = useRouter()

  const [form, setForm] = useState({
    stock_name: '',
    entry_value: '',
    exit_value: '',
    charges: '',
    quantity: '',
    trade_date: ''
  })

  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)

  // Live profit preview
  const calculatePreview = (updatedForm) => {
    const { entry_value, exit_value, charges, quantity } = updatedForm
    if (entry_value && exit_value && quantity) {
      const profit =
        ((Number(exit_value) - Number(entry_value)) * Number(quantity))
        - Number(charges || 0)
      setPreview(profit)
    } else {
      setPreview(null)
    }
  }

  const handleChange = (field, value) => {
    const updatedForm = { ...form, [field]: value }
    setForm(updatedForm)
    calculatePreview(updatedForm)
  }

  const handleSubmit = async () => {
    // Validate
    if (!form.stock_name || !form.entry_value || !form.exit_value || !form.quantity || !form.trade_date) {
      alert('Please fill all fields')
      return
    }

    setLoading(true)

    const profit =
      ((Number(form.exit_value) - Number(form.entry_value)) * Number(form.quantity))
      - Number(form.charges || 0)

    const { error } = await supabase
      .from('trades')
      .insert([{
        stock_name: form.stock_name.toUpperCase(),
        entry_value: Number(form.entry_value),
        exit_value: Number(form.exit_value),
        charges: Number(form.charges || 0),
        quantity: Number(form.quantity),
        trade_date: form.trade_date,
        profit: profit
      }])

    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      router.push('/dashboard')
    }
  }

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

        .page-bg {
          min-height: 100vh;
          background: #0a0a0f;
          background-image:
            radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.07) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(16,185,129,0.05) 0%, transparent 50%);
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
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.5px;
          cursor: pointer;
        }

        .logo-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px #10b981;
        }

        .back-btn {
          background: rgba(255,255,255,0.06);
          color: #9ca3af;
          border: 1px solid rgba(255,255,255,0.08);
          padding: 8px 18px;
          border-radius: 8px;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .back-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #e8e8f0;
        }

        /* MAIN */
        .main {
          max-width: 680px;
          margin: 0 auto;
          padding: 48px 24px;
        }

        .page-header {
          margin-bottom: 36px;
        }

        .page-title {
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -1px;
        }

        .page-subtitle {
          color: #6b7280;
          font-size: 14px;
          margin-top: 6px;
        }

        /* FORM CARD */
        .form-card {
          background: #111118;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 32px;
          margin-bottom: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }

        @media (max-width: 500px) {
          .form-row { grid-template-columns: 1fr; }
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        label {
          font-size: 12px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .form-input {
          background: #0a0a0f;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          padding: 12px 16px;
          color: #e8e8f0;
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 600;
          width: 100%;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-input:focus {
          border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
        }

        .form-input::placeholder {
          color: #374151;
          font-weight: 400;
        }

        /* PROFIT PREVIEW */
        .preview-card {
          border-radius: 12px;
          padding: 18px 22px;
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .preview-card.profit {
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
        }

        .preview-card.loss {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
        }

        .preview-label {
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
        }

        .preview-value {
          font-family: 'Space Mono', monospace;
          font-size: 22px;
          font-weight: 700;
        }

        .preview-value.profit { color: #10b981; }
        .preview-value.loss { color: #ef4444; }

        /* SUBMIT BUTTON */
        .submit-btn {
          width: 100%;
          background: #10b981;
          color: #0a0a0f;
          border: none;
          padding: 15px;
          border-radius: 12px;
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.3px;
          margin-top: 6px;
        }

        .submit-btn:hover:not(:disabled) {
          background: #0d9e6e;
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(16,185,129,0.3);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* HELPER TEXT */
        .helper {
          font-size: 12px;
          color: #4b5563;
          text-align: center;
          margin-top: 14px;
        }
      `}</style>

      <div className="page-bg">

        {/* NAVBAR */}
        <nav className="navbar">
          <div className="logo" onClick={() => router.push('/dashboard')}>
            <div className="logo-dot"></div>
            <span>TradeTrack</span>
          </div>
          <button className="back-btn" onClick={() => router.push('/dashboard')}>
            ← Dashboard
          </button>
        </nav>

        {/* MAIN */}
        <div className="main">

          <div className="page-header">
            <h1 className="page-title">Log New Trade</h1>
            <p className="page-subtitle">Enter your trade details below</p>
          </div>

          <div className="form-card">

            {/* STOCK NAME */}
            <div className="form-row">
              <div className="form-group full">
                <label>Stock Name</label>
                <input
                  type="text"
                  placeholder="e.g. RELIANCE, TCS, INFY"
                  value={form.stock_name}
                  onChange={(e) => handleChange('stock_name', e.target.value)}
                  className="form-input"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>

            {/* ENTRY / EXIT */}
            <div className="form-row">
              <div className="form-group">
                <label>Entry Price (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={form.entry_value}
                  onChange={(e) => handleChange('entry_value', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Exit Price (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={form.exit_value}
                  onChange={(e) => handleChange('exit_value', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            {/* QUANTITY / CHARGES */}
            <div className="form-row">
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  placeholder="No. of shares"
                  value={form.quantity}
                  onChange={(e) => handleChange('quantity', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Charges / Brokerage (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={form.charges}
                  onChange={(e) => handleChange('charges', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            {/* DATE */}
            <div className="form-row">
              <div className="form-group full">
                <label>Trade Date</label>
                <input
                  type="date"
                  value={form.trade_date}
                  onChange={(e) => handleChange('trade_date', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            {/* LIVE PROFIT PREVIEW */}
            {preview !== null && (
              <div className={`preview-card ${preview >= 0 ? 'profit' : 'loss'}`}>
                <span className="preview-label">Estimated P&L</span>
                <span className={`preview-value ${preview >= 0 ? 'profit' : 'loss'}`}>
                  {preview >= 0 ? '+' : ''}₹{preview.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {/* SUBMIT */}
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Saving Trade...' : 'Save Trade →'}
            </button>

            <p className="helper">
              Profit = (Exit − Entry) × Quantity − Charges
            </p>

          </div>

        </div>
      </div>
    </>
  )
}