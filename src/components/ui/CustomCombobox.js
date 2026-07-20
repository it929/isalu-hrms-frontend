import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import styles from './CustomSelect.module.css';

export default function CustomCombobox({ 
  options = [], 
  value = '', 
  onChange, 
  placeholder = "Select or type...",
  name,
  label,
  required = false,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange({ target: { name, value: optionValue } });
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    onChange({ target: { name, value: e.target.value } });
  };

  return (
    <div className={`${styles.container} ${isOpen ? styles.containerOpen : ''}`} ref={containerRef}>
      {label && <label className={styles.label}>{label} {required && '*'}</label>}
      
      <div 
        className={`${styles.selectBox} ${isOpen ? styles.open : ''} ${disabled ? styles.disabled : ''}`}
        style={{ padding: 0, display: 'flex', alignItems: 'center' }}
      >
        <input
          type="text"
          name={name}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          onFocus={() => setIsOpen(true)}
          style={{
            flex: 1,
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '0.75rem 1rem',
            color: 'var(--foreground)',
            fontSize: '0.95rem'
          }}
        />
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen(!isOpen);
          }}
          style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', height: '100%', cursor: 'pointer' }}
        >
          <ChevronDown size={18} className={`${styles.arrow} ${isOpen ? styles.arrowRotate : ''}`} />
        </div>
      </div>

      {isOpen && options.length > 0 && (
        <div className={styles.dropdown} style={{ marginTop: '4px' }}>
          <div className={styles.optionsList}>
            {options.map(opt => {
              const optVal = opt.id ?? opt;
              const optName = opt.name ?? opt;
              const isSelected = value?.toString() === optVal.toString();
              return (
                <div 
                  key={optVal} 
                  className={`${styles.option} ${isSelected ? styles.selected : ''}`}
                  onClick={() => handleSelect(optVal)}
                >
                  <span>{optName}</span>
                  {isSelected && <Check size={14} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
