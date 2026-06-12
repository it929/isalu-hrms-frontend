"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      background: 'var(--background)',
      color: 'var(--foreground)',
      textAlign: 'center'
    }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '500px'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '96px',
          height: '96px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.1)',
          color: 'var(--primary)',
          marginBottom: '2rem'
        }}>
          <FileQuestion size={48} />
        </div>

        <h1 style={{
          fontSize: '3rem',
          fontWeight: '700',
          marginBottom: '1rem',
          lineHeight: '1.2',
          fontFamily: 'var(--font-outfit)'
        }}>
          404
        </h1>
        
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          marginBottom: '1rem',
          color: 'var(--foreground)'
        }}>
          Page Not Found
        </h2>

        <p style={{
          color: 'var(--secondary)',
          marginBottom: '2.5rem',
          lineHeight: '1.6'
        }}>
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved, deleted, or never existed.
        </p>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          justifyContent: 'center'
        }}>
          <button 
            onClick={() => window.history.back()}
            className="premium-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)'
            }}
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
          
          <Link href="/dashboard" className="premium-btn" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            textDecoration: 'none'
          }}>
            <Home size={16} />
            Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
