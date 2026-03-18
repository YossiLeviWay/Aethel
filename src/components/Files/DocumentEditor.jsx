import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignRight,
  AlignCenter,
  AlignLeft,
  List,
  ListOrdered,
  Minus,
  Palette,
  Type,
} from 'lucide-react';
import './Editors.css';

const TEXT_COLORS = [
  { label: 'Black', value: '#1e293b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Orange', value: '#f59e0b' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Gray', value: '#64748b' },
  { label: 'Brown', value: '#a16207' },
];

export default function DocumentEditor({ content, onChange, readOnly = false }) {
  const editorRef = useRef(null);
  const [showColors, setShowColors] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimerRef = useRef(null);
  const colorBtnRef = useRef(null);

  // Initialize content
  useEffect(() => {
    if (editorRef.current && content !== undefined) {
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content || '';
      }
    }
  }, [content]);

  // Close color picker on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (colorBtnRef.current && !colorBtnRef.current.contains(e.target)) {
        setShowColors(false);
      }
    }
    if (showColors) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColors]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const triggerSave = useCallback(() => {
    setSaveStatus('pending');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (editorRef.current) {
        onChange?.(editorRef.current.innerHTML);
      }
      setSaveStatus('saved');
    }, 800);
  }, [onChange]);

  function execCommand(command, value = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    triggerSave();
  }

  function handleBold() {
    execCommand('bold');
  }

  function handleItalic() {
    execCommand('italic');
  }

  function handleUnderline() {
    execCommand('underline');
  }

  function handleAlignRight() {
    execCommand('justifyRight');
  }

  function handleAlignCenter() {
    execCommand('justifyCenter');
  }

  function handleAlignLeft() {
    execCommand('justifyLeft');
  }

  function handleBulletList() {
    execCommand('insertUnorderedList');
  }

  function handleNumberedList() {
    execCommand('insertOrderedList');
  }

  function handleHorizontalLine() {
    execCommand('insertHorizontalRule');
  }

  function handleHeadingChange(e) {
    const value = e.target.value;
    if (value === 'p') {
      execCommand('formatBlock', 'p');
    } else {
      execCommand('formatBlock', value);
    }
  }

  function handleColor(color) {
    execCommand('foreColor', color);
    setShowColors(false);
  }

  function handleInput() {
    triggerSave();
  }

  function handleKeyDown(e) {
    // Allow tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      execCommand('insertHTML', '&emsp;');
    }
  }

  return (
    <div className="document-editor">
      {/* Toolbar */}
      {!readOnly && (
        <div className="document-toolbar">
          {/* Heading select */}
          <select className="toolbar-select" onChange={handleHeadingChange} defaultValue="p">
            <option value="p">פסקה</option>
            <option value="h1">כותרת 1</option>
            <option value="h2">כותרת 2</option>
            <option value="h3">כותרת 3</option>
          </select>

          <div className="toolbar-separator" />

          {/* Text formatting */}
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={handleBold} title="מודגש">
              <Bold size={16} />
            </button>
            <button className="toolbar-btn" onClick={handleItalic} title="נטוי">
              <Italic size={16} />
            </button>
            <button className="toolbar-btn" onClick={handleUnderline} title="קו תחתון">
              <Underline size={16} />
            </button>
          </div>

          <div className="toolbar-separator" />

          {/* Text alignment */}
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={handleAlignRight} title="יישור לימין">
              <AlignRight size={16} />
            </button>
            <button className="toolbar-btn" onClick={handleAlignCenter} title="יישור למרכז">
              <AlignCenter size={16} />
            </button>
            <button className="toolbar-btn" onClick={handleAlignLeft} title="יישור לשמאל">
              <AlignLeft size={16} />
            </button>
          </div>

          <div className="toolbar-separator" />

          {/* Lists */}
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={handleBulletList} title="רשימת תבליטים">
              <List size={16} />
            </button>
            <button className="toolbar-btn" onClick={handleNumberedList} title="רשימה ממוספרת">
              <ListOrdered size={16} />
            </button>
          </div>

          <div className="toolbar-separator" />

          {/* Color picker */}
          <div className="color-btn-wrapper" ref={colorBtnRef}>
            <button
              className={`toolbar-btn${showColors ? ' active' : ''}`}
              onClick={() => setShowColors(!showColors)}
              title="צבע טקסט"
            >
              <Palette size={16} />
            </button>
            {showColors && (
              <div className="color-dropdown">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className="color-swatch"
                    style={{ backgroundColor: c.value }}
                    onClick={() => handleColor(c.value)}
                    title={c.label}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Horizontal line */}
          <button className="toolbar-btn" onClick={handleHorizontalLine} title="קו אופקי">
            <Minus size={16} />
          </button>
        </div>
      )}

      {/* Editor Area */}
      <div className="document-content-area">
        <div
          ref={editorRef}
          className="editor-content"
          contentEditable={!readOnly}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          suppressContentEditableWarning
          dir="rtl"
        />
      </div>

      {/* Status Bar */}
      <div className="document-status">
        <div className="autosave-indicator">
          <span className={`autosave-dot${saveStatus === 'pending' ? ' autosave-dot--pending' : ''}`} />
          <span>{saveStatus === 'pending' ? 'שומר...' : 'נשמר'}</span>
        </div>
        <span />
      </div>
    </div>
  );
}
