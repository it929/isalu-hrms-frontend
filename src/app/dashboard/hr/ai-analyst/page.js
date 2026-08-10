"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, Search, Loader2, Download, Printer, Copy, Table, BarChart3, Database, MessageSquareText } from 'lucide-react';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

function getUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hrms_user');
    if (raw) return JSON.parse(raw)?.id ?? null;
  } catch { /* ignore */ }
  return null;
}

function buildHeaders() {
  const uid = getUserId();
  return uid ? { 'X-User-Id': uid } : {};
}

export default function AiAnalystPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [toast, setToast] = useState(null);

  const [reportDateTime, setReportDateTime] = useState({ date: '', time: '' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAsk = async (promptToAsk = null) => {
    const q = promptToAsk || query;
    if (!q.trim()) return;

    setLoading(true);
    try {
      const payload = { query: q };
      let res;
      try {
        res = await axios.post(`${API_BASE}/ai/query`, payload, { headers: buildHeaders() });
      } catch {
        const rootBase = API_BASE.replace(/\/nextjs$/, '');
        res = await axios.post(`${rootBase}/ai/query`, payload, { headers: buildHeaders() });
      }

      if (res && res.data && res.data.status === 'success') {
        setResultData(res.data.data);
        showToast('Query processed successfully!');
      } else {
        showToast(res?.data?.message || 'Failed to process query', 'error');
      }
    } catch (err) {
      console.error('Error in AI query:', err);
      showToast(err.response?.data?.message || 'Error executing AI query.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initial default query and client timestamp on load
  useEffect(() => {
    const now = new Date();
    setReportDateTime({
      date: now.toLocaleDateString('en-GB'),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    handleAsk("Show staff count by department");
  }, []);

  const handleDownloadCsv = () => {
    if (!resultData || !resultData.rows || resultData.rows.length === 0) return;
    
    const headers = ["S/N", ...resultData.columns.map(c => c.label)].join(',');
    const rows = resultData.rows.map((r, idx) => 
      [idx + 1, ...resultData.columns.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`)].join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ISALU_HR_AI_Export_${Date.now()}.csv`);
    
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(link);
      link.click();
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      } else if (typeof link.remove === 'function') {
        link.remove();
      }
    } else {
      link.click();
    }

    showToast('Exported to CSV successfully!');
  };

  const handleCopySummary = () => {
    if (!resultData || !resultData.summary) return;
    navigator.clipboard.writeText(resultData.summary);
    showToast('Executive summary copied to clipboard!');
  };

  return (
    <div className={`${styles.container} printCard paperContainer`}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          color: '#fff',
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontWeight: 500,
          fontSize: '0.875rem'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Print-only Report Header */}
      <div className={styles.printOnlyHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #10b981', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
              ISALU HOSPITAL — HR AI Data Analyst Report
            </h2>
            {resultData && resultData.query && (
              <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0.35rem 0 0 0' }}>
                Query: <em>"{resultData.query}"</em>
              </p>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'right' }}>
            <div>Date: {reportDateTime.date}</div>
            <div>Time: {reportDateTime.time}</div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className={`${styles.header} ${styles.noPrint}`}>
        <h1 className={styles.title}>
          <Sparkles className="text-emerald-500" size={28} style={{ color: '#10b981' }} />
          Ask ISALU HR AI — Intelligent Data Analyst
        </h1>
        <p className={styles.subtitle}>
          Ask natural language questions about your staff, salary budget, leave applications, resignations, and HR metrics.
        </p>
      </div>

      {/* Search Bar Input */}
      <div className={`${styles.searchBoxCard} ${styles.noPrint}`}>
        <div className={styles.inputGroup}>
          <input
            type="text"
            className={styles.queryInput}
            placeholder="Ask AI anything about HR data (e.g. 'How many staff applied for IOU?', 'Staff in Nursing')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          />
          <button
            type="button"
            className={styles.askBtn}
            onClick={() => handleAsk()}
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {loading ? 'Analyzing...' : 'Ask AI'}
          </button>
        </div>
      </div>

      {/* Results Container */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#10b981' }} />
          <p style={{ marginTop: '1rem', fontStyle: 'italic', color: 'var(--text-secondary, #6b7280)' }}>
            Querying ISALU HRMS database and generating executive insights...
          </p>
        </div>
      ) : resultData ? (
        <div>
          {/* Executive AI Summary Box */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>
              <Sparkles size={16} /> AI Executive Summary
            </div>
            <p className={styles.summaryText}>{resultData.summary}</p>
          </div>

          {/* Metric Stat Cards */}
          {resultData.metrics && resultData.metrics.length > 0 && (
            <div className={styles.metricsGrid}>
              {resultData.metrics.map((m, idx) => (
                <div key={idx} className={styles.metricCard}>
                  <span className={styles.metricLabel}>{m.label}</span>
                  <span className={styles.metricValue}>{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Table Toolbar */}
          <div className={styles.tableToolbar}>
            <div className={styles.toolbarTitle}>
              Data Table ({resultData.rows ? resultData.rows.length : 0} Records)
            </div>
            <div className={`${styles.actionBtns} ${styles.noPrint}`}>
              <button type="button" className={styles.btnSecondary} onClick={handleCopySummary}>
                <Copy size={14} /> Copy Summary
              </button>
              <button type="button" className={styles.btnSecondary} onClick={handleDownloadCsv}>
                <Download size={14} /> Export CSV
              </button>
              <button type="button" className={styles.btnSecondary} onClick={() => window.print()}>
                <Printer size={14} /> Print Report
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className={styles.tableContainer}>
            {resultData.rows && resultData.rows.length > 0 ? (
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center' }}>S/N</th>
                    {resultData.columns.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultData.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>{rIdx + 1}</td>
                      {resultData.columns.map((col) => {
                        let val = row[col.key];
                        if (col.format === 'currency' && typeof val === 'number') {
                          val = '₦' + val.toLocaleString('en-NG', { minimumFractionDigits: 2 });
                        }
                        return <td key={col.key}>{val ?? '—'}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                <Database className={styles.emptyIcon} size={32} />
                <p>No matching records found for this query.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <MessageSquareText className={styles.emptyIcon} size={36} />
          <h3>Ask any HR question above to generate instant data & reports.</h3>
        </div>
      )}
    </div>
  );
}
