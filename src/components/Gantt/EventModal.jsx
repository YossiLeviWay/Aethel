import { useState } from 'react';
import { X } from 'lucide-react';
import './Gantt.css';

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function EventModal({
  event,
  date,
  category,
  categories,
  colors,
  onSave,
  onDelete,
  onClose
}) {
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    time: event?.time || '',
    category: event?.category || category || categories[0],
    color: event?.color || colors[0],
    date: event?.date || (date ? dateKey(date) : '')
  });

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{event ? 'עריכת אירוע' : 'אירוע חדש'}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>כותרת</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="שם האירוע"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>תיאור</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="פרטים נוספים..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>שעה</label>
              <input
                name="time"
                type="time"
                value={form.time}
                onChange={handleChange}
                dir="ltr"
              />
            </div>
            <div className="form-group">
              <label>קטגוריה</label>
              <select name="category" value={form.category} onChange={handleChange}>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>צבע</label>
            <div className="color-picker">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${form.color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm(prev => ({ ...prev, color: c }))}
                />
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">
              {event ? 'עדכון' : 'הוספה'}
            </button>
            {onDelete && (
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                מחיקה
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
