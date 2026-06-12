"use client";

import { useState, useEffect } from 'react';
import { getCache, setCache } from '../../utils/dataCache';
import axios from 'axios';
import { useSession } from '../../contexts/SessionContext';
import { Users, Briefcase, FileText, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        boxShadow: 'var(--shadow)',
        color: '#f0f0f0'
      }}>
        <p style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem' }}>{label}</p>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6366f1', fontWeight: '800', marginTop: '0.25rem' }}>
          Staff Count: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

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
  const cachedDepts = getCache('dashboard_departments');
  const [stats, setStats] = useState(cachedStats || []);
  const [deptStats, setDeptStats] = useState(cachedDepts || []);
  const [loading, setLoading] = useState(!cachedStats);

  useEffect(() => {
    const hasCache = !!cachedStats;
    axios.get(`${API_BASE}/dashboard-stats`)
      .then(res => {
        const data = res.data.stats || [];
        const depts = res.data.departments || [];
        setStats(data);
        setDeptStats(depts);
        setCache('dashboard_stats', data);
        setCache('dashboard_departments', depts);
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
        {/* ── Department Staff Distribution Bar Chart ── */}
        <div className="premium-card" style={{ width: '100%', padding: '2rem', border: '1px solid var(--border)', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--foreground)' }}>Staff Distribution by Department</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--secondary)', marginTop: '0.25rem' }}>Overview of current employee strengths across all departments</p>
            </div>
          </div>

          <div style={{ height: '320px', width: '100%' }}>
            {deptStats.length === 0 ? (
              <div style={{ color: 'var(--secondary)', fontSize: '0.95rem', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                No department statistics available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    stroke="var(--secondary)" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                  />
                  <YAxis 
                    stroke="var(--secondary)" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  <Bar 
                    dataKey="value" 
                    radius={[6, 6, 0, 0]} 
                    animationDuration={1000}
                    animationMatchBy="stretch"
                    barSize={40}
                  >
                    {deptStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}