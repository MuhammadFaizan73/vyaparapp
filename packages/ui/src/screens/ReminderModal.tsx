import { useState, useCallback } from "react";
import type { Party } from "@vyapar/api-client";

const STORAGE_KEY = "vyapar_reminders";

function loadReminders(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}
function saveReminders(r: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}
export function getReminder(partyId: string): string | null {
  return loadReminders()[partyId] ?? null;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function parseDate(s: string): Date | null {
  const [dd, mm, yyyy] = s.split("/").map(Number);
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  return isNaN(d.getTime()) ? null : d;
}

interface Props {
  party: Party;
  onClose: () => void;
}

export function ReminderModal({ party, onClose }: Props) {
  const existing = getReminder(party.id);
  const [enabled, setEnabled] = useState(!!existing);
  const [dateStr, setDateStr] = useState(existing ?? formatDate(new Date()));
  const [showCal, setShowCal] = useState(true);

  const selectedDate = parseDate(dateStr) ?? new Date();
  const [calYear, setCalYear] = useState(selectedDate.getFullYear());
  const [calMonth, setCalMonth] = useState(selectedDate.getMonth());

  const today = new Date();

  function buildCalendar() {
    const first = new Date(calYear, calMonth, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function selectDay(d: number) {
    const picked = new Date(calYear, calMonth, d);
    setDateStr(formatDate(picked));
    setEnabled(true);
  }

  function handlePrevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function handleNextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  function handleSave() {
    const reminders = loadReminders();
    if (enabled && dateStr) {
      reminders[party.id] = dateStr;
    } else {
      delete reminders[party.id];
    }
    saveReminders(reminders);
    onClose();
  }

  function handleDelete() {
    const reminders = loadReminders();
    delete reminders[party.id];
    saveReminders(reminders);
    onClose();
  }

  const cells = buildCalendar();
  const fmt = (n: number) => Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="reminder-backdrop" onClick={onClose}>
      <div className="reminder-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="reminder-modal__header">
          <span className="reminder-modal__title">Set Reminder</span>
          <button type="button" className="reminder-modal__close" onClick={onClose}>×</button>
        </div>

        {/* Party info */}
        <div className="reminder-modal__party-row">
          <span className="reminder-modal__party-name">{party.name}</span>
          <span className={`reminder-modal__party-bal${party.balance < 0 ? " reminder-modal__party-bal--neg" : ""}`}>
            Rs {fmt(party.balance)}
          </span>
        </div>

        {/* Remind me on row */}
        <div className="reminder-modal__remind-row">
          <label className="reminder-modal__checkbox-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="reminder-modal__checkbox"
            />
            <span>Remind me on</span>
          </label>
          <div className="reminder-modal__date-wrap">
            <input
              type="text"
              className="reminder-modal__date-input"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              placeholder="DD/MM/YYYY"
            />
            <button
              type="button"
              className="reminder-modal__cal-btn"
              onClick={() => setShowCal(v => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Inline calendar */}
        {showCal && (
          <div className="reminder-cal">
            <div className="reminder-cal__nav">
              <button type="button" className="reminder-cal__nav-btn" onClick={handlePrevMonth}>‹</button>
              <div className="reminder-cal__month-year">
                <span>{MONTHS[calMonth]}</span>
                <select
                  value={calYear}
                  onChange={(e) => setCalYear(Number(e.target.value))}
                  className="reminder-cal__year-select"
                >
                  {Array.from({ length: 10 }, (_, i) => today.getFullYear() - 2 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button type="button" className="reminder-cal__nav-btn" onClick={handleNextMonth}>›</button>
            </div>

            <div className="reminder-cal__grid">
              {DAYS.map((d) => (
                <div key={d} className="reminder-cal__dow">{d}</div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />;
                const thisDate = new Date(calYear, calMonth, day);
                const isSelected = dateStr === formatDate(thisDate);
                const isToday = thisDate.toDateString() === today.toDateString();
                return (
                  <button
                    key={day}
                    type="button"
                    className={`reminder-cal__day${isSelected ? " reminder-cal__day--selected" : ""}${isToday && !isSelected ? " reminder-cal__day--today" : ""}`}
                    onClick={() => selectDay(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Note */}
        <p className="reminder-modal__note">
          Note: You will receive payment reminder on desktop between 10 a.m. to 6 p.m.
        </p>

        {/* Footer */}
        <div className="reminder-modal__footer">
          <button type="button" className="reminder-modal__delete-btn" onClick={handleDelete}>
            Delete Reminder
          </button>
          <button type="button" className="reminder-modal__save-btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
