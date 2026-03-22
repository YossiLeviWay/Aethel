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
  Table,
  Pilcrow,
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

const FONT_FAMILIES = [
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'David', value: "'David Libre', David, serif" },
  { label: 'Frank Ruhl', value: "'Frank Ruhl Libre', serif" },
  { label: 'Rubik', value: "'Rubik', sans-serif" },
  { label: 'Heebo', value: "'Heebo', sans-serif" },
  { label: 'Assistant', value: "'Assistant', sans-serif" },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Georgia', value: 'Georgia, serif' },
];

const FONT_SIZES = ['10', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48'];

export default function DocumentEditor({ content, onChange, readOnly = false }) {
  const editorRef = useRef(null);
  const [showColors, setShowColors] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [textDirection, setTextDirection] = useState('rtl');
  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimerRef = useRef(null);
  const colorBtnRef = useRef(null);
  const tableBtnRef = useRef(null);

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
      if (tableBtnRef.current && !tableBtnRef.current.contains(e.target)) {
        setShowTableDialog(false);
      }
    }
    if (showColors || showTableDialog) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColors, showTableDialog]);

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

  function handleHeadingChange(e) {
    const value = e.target.value;
    if (value === 'p') {
      execCommand('formatBlock', 'p');
    } else {
      execCommand('formatBlock', value);
    }
  }

  function handleFontChange(e) {
    const font = e.target.value;
    if (font) {
      execCommand('fontName', font);
    }
  }

  function handleFontSizeChange(e) {
    const size = e.target.value;
    if (!size) return;
    // execCommand fontSize only supports 1-7, so we use insertHTML with span
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size + 'px';
      range.surroundContents(span);
      triggerSave();
    }
  }

  function handleColor(color) {
    execCommand('foreColor', color);
    setShowColors(false);
  }

  function toggleDirection() {
    const newDir = textDirection === 'rtl' ? 'ltr' : 'rtl';
    setTextDirection(newDir);
    if (editorRef.current) {
      editorRef.current.setAttribute('dir', newDir);
      editorRef.current.style.textAlign = newDir === 'rtl' ? 'right' : 'left';
    }
    triggerSave();
  }

  function insertTable() {
    if (tableCols < 1 || tableRows < 1) return;
    let html = '<table><tbody>';
    for (let r = 0; r < tableRows; r++) {
      html += '<tr>';
      for (let c = 0; c < tableCols; c++) {
        html += '<td>&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p></p>';
    execCommand('insertHTML', html);
    setShowTableDialog(false);
  }

  function handleInput() {
    triggerSave();
  }

  function handleKeyDown(e) {
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
          {/* Font family */}
          <select className="toolbar-select toolbar-select--font" onChange={handleFontChange} defaultValue="">
            <option value="" disabled>גופן</option>
            {FONT_FAMILIES.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>

          {/* Font size */}
          <select className="toolbar-select toolbar-select--size" onChange={handleFontSizeChange} defaultValue="">
            <option value="" disabled>גודל</option>
            {FONT_SIZES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className="toolbar-separator" />

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
            <button className="toolbar-btn" onClick={() => execCommand('bold')} title="מודגש">
              <Bold size={16} />
            </button>
            <button className="toolbar-btn" onClick={() => execCommand('italic')} title="נטוי">
              <Italic size={16} />
            </button>
            <button className="toolbar-btn" onClick={() => execCommand('underline')} title="קו תחתון">
              <Underline size={16} />
            </button>
          </div>

          <div className="toolbar-separator" />

          {/* Text direction */}
          <button
            className={`toolbar-btn toolbar-btn--direction`}
            onClick={toggleDirection}
            title={textDirection === 'rtl' ? 'שנה לשמאל-לימין' : 'שנה לימין-לשמאל'}
          >
            {textDirection === 'rtl' ? 'RTL' : 'LTR'}
          </button>

          {/* Text alignment */}
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={() => execCommand('justifyRight')} title="יישור לימין">
              <AlignRight size={16} />
            </button>
            <button className="toolbar-btn" onClick={() => execCommand('justifyCenter')} title="יישור למרכז">
              <AlignCenter size={16} />
            </button>
            <button className="toolbar-btn" onClick={() => execCommand('justifyLeft')} title="יישור לשמאל">
              <AlignLeft size={16} />
            </button>
          </div>

          <div className="toolbar-separator" />

          {/* Lists */}
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={() => execCommand('insertUnorderedList')} title="רשימת תבליטים">
              <List size={16} />
            </button>
            <button className="toolbar-btn" onClick={() => execCommand('insertOrderedList')} title="רשימה ממוספרת">
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

          {/* Table insert */}
          <div className="color-btn-wrapper" ref={tableBtnRef}>
            <button
              className={`toolbar-btn${showTableDialog ? ' active' : ''}`}
              onClick={() => setShowTableDialog(!showTableDialog)}
              title="הוספת טבלה"
            >
              <Table size={16} />
            </button>
            {showTableDialog && (
              <div className="table-insert-dialog">
                <label>
                  שורות:
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={tableRows}
                    onChange={e => setTableRows(parseInt(e.target.value) || 1)}
                  />
                </label>
                <label>
                  עמודות:
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={tableCols}
                    onChange={e => setTableCols(parseInt(e.target.value) || 1)}
                  />
                </label>
                <div className="table-insert-actions">
                  <button className="btn btn-primary btn-sm" onClick={insertTable}>הוסף</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowTableDialog(false)}>ביטול</button>
                </div>
              </div>
            )}
          </div>

          {/* Horizontal line */}
          <button className="toolbar-btn" onClick={() => execCommand('insertHorizontalRule')} title="קו אופקי">
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
          dir={textDirection}
          style={{ textAlign: textDirection === 'rtl' ? 'right' : 'left' }}
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
