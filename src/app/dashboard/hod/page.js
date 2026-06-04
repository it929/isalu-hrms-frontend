"use client";

import { motion } from 'framer-motion';
import { UserCheck, Search } from 'lucide-react';

export default function HODAssignments() {
  const departments = [
    { id: 1, name: 'Human Resources', currentHOD: 'Jane Smith', users: 15 },
    { id: 2, name: 'Information Technology', currentHOD: 'John Doe', users: 42 },
    { id: 3, name: 'Finance & Payroll', currentHOD: 'Sarah Williams', users: 12 },
    { id: 4, name: 'Procurement', currentHOD: 'Unassigned', users: 8 },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>HOD Assignments</h1>
        <p style={{ color: 'var(--secondary)' }}>Assign Head of Department roles to specific users.</p>
      </div>

      <div className="premium-card">
        <div style={{ display: 'flex', marginBottom: '1.5rem', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary)' }} />
            <input 
              type="text" 
              placeholder="Search departments..." 
              style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--secondary)' }}>
              <th style={{ padding: '1rem' }}>Department Name</th>
              <th style={{ padding: '1rem' }}>Current HOD</th>
              <th style={{ padding: '1rem' }}>Staff Count</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem', fontWeight: '500' }}>{dept.name}</td>
                <td style={{ padding: '1rem' }}>
                  {dept.currentHOD === 'Unassigned' ? (
                    <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{dept.currentHOD}</span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                        {dept.currentHOD.charAt(0)}
                      </div>
                      {dept.currentHOD}
                    </span>
                  )}
                </td>
                <td style={{ padding: '1rem', color: 'var(--secondary)' }}>{dept.users} Users</td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <button className="premium-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border)' }}>
                    Reassign HOD
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
