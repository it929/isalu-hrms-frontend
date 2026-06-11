"use client";

import { useState, useEffect } from 'react';
import { getCache, setCache } from '../../utils/dataCache';
import axios from 'axios';
import { useSession } from '../../contexts/SessionContext';
import { Users, Briefcase, FileText, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

const iconMap = {
  'Users': <Users size={24} />,
  'Briefcase': <Briefcase size={24} />,
  'FileText': <FileText size={24} />,
  'CheckCircle': <CheckCircle size={24} />,
};

export default function DashboardHome() {
  const { user } = useSession();
  const cachedStats = getCache('dashboard_stats');
  const [stats, setStats] = useState(cachedStats || []);
  const [loading, setLoading] = useState(!cachedStats);

  useEffect(() => {
    const hasCache = !!cachedStats;
    axios.get(`${API_BASE}/dashboard-stats`)
      .then(res => {
        const data = res.data.stats || [];
        setStats(data);
        setCache('dashboard_stats', data);
      })
      .catch(err => console.error('Failed to fetch stats:', err))
      .finally(() => {
        if (!hasCache) setLoading(false);
      });
  }, [cachedStats]);

  return (
    <div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {user?.must_change_password && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow)'
          }}>
            <div>
              <h4 style={{ color: '#991b1b', margin: 0, fontWeight: '700', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚠️ Security Action Required
              </h4>
              <p style={{ color: '#7f1d1d', marginTop: '0.5rem', marginBottom: 0, fontSize: '0.95rem', fontWeight: '500' }}>
                You are currently logged in with a default password. For security reasons, please change your password immediately.
              </p>
            </div>
            <div>
              <Link 
                href="/dashboard/settings/edit-account" 
                style={{
                  display: 'inline-block',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                  transition: 'background-color 0.2s',
                }}
              >
                Change Password Now
              </Link>
            </div>
          </div>
        )}

        <div className="hide-scrollbar" style={{ width: '100%', marginBottom: '2.5rem' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, minmax(240px, 1fr))', 
            gap: '1rem', 
            width: 'max-content',
            minWidth: '100%'
          }}>
            {loading ? (
              // Skeleton loader
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="premium-card" style={{ height: '140px', background: 'var(--surface-hover)', animate: 'pulse' }} />
              ))
            ) : (
              stats.map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="premium-card"
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '1rem',
                    padding: '1.5rem',
                    border: '1px solid var(--border)',
                    minWidth: '240px'
                  }}
                >
                  <div style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '10px', 
                    background: `${stat.color}15`,
                    color: stat.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {iconMap[stat.icon] || <Users size={24} />}
                  </div>
                  <div>
                    <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.2rem' }}>
                      {stat.label}
                    </p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'var(--foreground)' }}>
                      {stat.value}
                    </h3>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
        {/* ── Recent Activity & Quick Links ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <div className="premium-card">
            <h3 style={{ marginBottom: '1.5rem', fontWeight: '700' }}>Recent Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[
                { text: 'New staff documentation completed for John Doe', time: '2 hours ago', type: 'success' },
                { text: 'Leave request submitted by Jane Smith', time: '4 hours ago', type: 'warning' },
                { text: 'Monthly payroll variation report generated', time: '1 day ago', type: 'info' },
                { text: 'Promotion brief updated for HR department', time: '2 days ago', type: 'info' },
              ].map((activity, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: activity.type === 'success' ? '#10b981' : activity.type === 'warning' ? '#f59e0b' : 'var(--primary)',
                    marginTop: '0.5rem'
                  }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: '500', fontSize: '0.95rem' }}>{activity.text}</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--secondary)' }}>{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-card">
            <h3 style={{ marginBottom: '1.5rem', fontWeight: '700' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link href="/dashboard/hr/employees" className="premium-btn" style={{ justifyContent: 'center', textDecoration: 'none' }}>Add New Staff</Link>
              <button className="premium-btn" style={{ background: 'var(--surface-hover)', color: 'var(--foreground)', justifyContent: 'center' }}>Generate Report</button>
              <button className="premium-btn" style={{ background: 'var(--surface-hover)', color: 'var(--foreground)', justifyContent: 'center' }}>View Variations</button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}