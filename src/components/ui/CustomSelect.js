import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import styles from './CustomSelect.module.css';

export default function CustomSelect({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select an option",
  name,
  label,
  required = false,
  searchable = true,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  
  const selectedOption = options.find(opt => opt.id.toString() === value?.toString());

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (optionId) => {
    onChange({ target: { name, value: optionId } });
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`${styles.container} ${isOpen ? styles.containerOpen : ''}`} ref={containerRef}>
      {label && <label className={styles.label}>{label} {required && '*'}</label>}
      
      <div 
        className={`${styles.selectBox} ${isOpen ? styles.open : ''} ${disabled ? styles.disabled : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? styles.value : styles.placeholder}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown size={18} className={`${styles.arrow} ${isOpen ? styles.arrowRotate : ''}`} />
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          {searchable && (
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input 
                type="text" 
                className={styles.searchInput}
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          )}
          
          <div className={styles.optionsList}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div 
                  key={opt.id} 
                  className={`${styles.option} ${value?.toString() === opt.id.toString() ? styles.selected : ''}`}
                  onClick={() => handleSelect(opt.id)}
                >
                  <span>{opt.name}</span>
                  {value?.toString() === opt.id.toString() && <Check size={14} />}
                </div>
              ))
            ) : (
              <div className={styles.noResults}>No matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
