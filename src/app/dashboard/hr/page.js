"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Users, FileText, Calendar, TrendingUp, Building2, Briefcase, MapPin } from 'lucide-react';

export default function HRDashboard() {
  const cards = [
    {
      title: 'Employee Records',
      description: 'Manage staff bio-data, variations, education, and service records.',
      icon: <Users size={20} />,
      iconBg: 'rgba(59, 130, 246, 0.1)',
      iconColor: 'var(--primary)',
      path: '/dashboard/hr/employees'
    },
    {
      title: 'Department Setup',
      description: 'Configure and organize organizational departments, branches, and sections.',
      icon: <Building2 size={20} />,
      iconBg: 'rgba(16, 185, 129, 0.1)',
      iconColor: '#10b981',
      path: '/dashboard/hr/department'
    },
    {
      title: 'Designation Setup',
      description: 'Configure official posts, titles, and designation parameters across departments.',
      icon: <Briefcase size={20} />,
      iconBg: 'rgba(139, 92, 246, 0.1)',
      iconColor: '#8b5cf6',
      path: '/dashboard/hr/designation'
    },
    {
      title: 'Unit Setup',
      description: 'Configure and organize structural operational units within departments.',
      icon: <Building2 size={20} />,
      iconBg: 'rgba(59, 130, 246, 0.1)',
      iconColor: 'var(--primary)',
      path: '/dashboard/hr/unit'
    },
    {
      title: 'LGA Covered',
      description: 'Configure and register local government areas covered for geographical assignments.',
      icon: <MapPin size={20} />,
      iconBg: 'rgba(245, 158, 11, 0.1)',
      iconColor: '#f59e0b',
      path: '/dashboard/hr/lga'
    },
    {
      title: 'Leave Management',
      description: 'Process annual leaves, leave of absence, and tour records.',
      icon: <Calendar size={20} />,
      iconBg: 'rgba(16, 185, 129, 0.1)',
      iconColor: '#10b981',
      path: '/dashboard/hr/leave'
    },
    {
      title: 'Performance & Promotions',
      description: 'Track censures, commendations, and handle promotion briefs.',
      icon: <TrendingUp size={20} />,
      iconBg: 'rgba(245, 158, 11, 0.1)',
      iconColor: '#f59e0b',
      path: '/dashboard/hr/performance'
    },
    {
      title: 'Pension & Gratuity',
      description: 'Process retirements, pensions, and final entitlements.',
      icon: <FileText size={20} />,
      iconBg: 'rgba(139, 92, 246, 0.1)',
      iconColor: '#8b5cf6',
      path: '/dashboard/hr/pension'
    }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>HR Dashboard</h1>
        <p style={{ color: 'var(--secondary)' }}>Manage employee lifecycle, leaves, and organizational performance.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {cards.map((card, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="premium-card" 
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer' }}
          >
            <div style={{ width: '40px', height: '40px', background: card.iconBg, color: card.iconColor, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {card.icon}
            </div>
            <h3 style={{ fontSize: '1.25rem' }}>{card.title}</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>{card.description}</p>
            <Link href={card.path} style={{ marginTop: 'auto', textDecoration: 'none' }}>
              <button className="premium-btn" style={{ background: 'var(--surface-hover)', color: 'var(--foreground)', width: '100%' }}>
                Open Module
              </button>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
