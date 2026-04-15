/**
 * timer.js — Countdown timer moduli
 * Har bir avtobus uchun real-vaqt kelish vaqti simulyatsiyasi
 */

'use strict';

// Aktiv timerlar: { busId: { intervalId, seconds, element } }
const activeTimers = new Map();

/**
 * Berilgan avtobus uchun countdown timer boshlash
 * @param {number} busId     — avtobus ID
 * @param {number} etaMinutes — daqiqalardagi taxminiy vaqt
 * @param {HTMLElement} el   — vaqtni ko'rsatadigan element
 * @param {Function} onDone  — vaqt tugaganda chaqiriladigan callback
 */
export function startCountdown(busId, etaMinutes, el, onDone) {
  // Eski timerni bekor qilish
  stopCountdown(busId);

  let seconds = etaMinutes * 60;

  function tick() {
    if (seconds <= 0) {
      el.textContent = '🟢 Keldi!';
      el.style.color = '#10B981';
      stopCountdown(busId);
      if (typeof onDone === 'function') onDone(busId);
      return;
    }

    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    el.textContent = `${m}:${String(s).padStart(2, '0')}`;

    // Rang: yashil (>5 min) → sariq (2-5 min) → qizil (<2 min)
    if (m >= 5)      el.style.color = '#10B981';
    else if (m >= 2) el.style.color = '#F59E0B';
    else             el.style.color = '#EF4444';

    seconds--;
  }

  tick(); // Darhol chiqarish
  const intervalId = setInterval(tick, 1000);
  activeTimers.set(busId, { intervalId, el });
}

/**
 * Berilgan avtobus timerni to'xtatish
 * @param {number} busId
 */
export function stopCountdown(busId) {
  const timer = activeTimers.get(busId);
  if (timer) {
    clearInterval(timer.intervalId);
    activeTimers.delete(busId);
  }
}

/**
 * Barcha timerlarni to'xtatish
 */
export function stopAllCountdowns() {
  activeTimers.forEach(({ intervalId }) => clearInterval(intervalId));
  activeTimers.clear();
}

/**
 * Jadval vaqtlariga asoslangan countdown hisoblash
 * Hozirgi vaqt bilan jadval vaqtini solishtiradi
 * @param {string} scheduleTime — "HH:MM" formatidagi vaqt
 * @returns {number} sekundlardagi farq (manfiy bo'lsa avtobus o'tib ketgan)
 */
export function getSecondsUntil(scheduleTime) {
  const now = new Date();
  const [hours, minutes] = scheduleTime.split(':').map(Number);

  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // Agar o'tib ketgan bo'lsa, ertangi kunni hisoblash
  if (target < now) target.setDate(target.getDate() + 1);

  return Math.floor((target - now) / 1000);
}

/**
 * Sekundlarni odam o'qiydigan formatga o'tkazish
 * @param {number} totalSeconds
 * @returns {string} masalan: "5 daqiqa 30 soniya"
 */
export function formatDuration(totalSeconds) {
  if (totalSeconds <= 0) return 'Hozir keladi';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h} soat ${m} daq`;
  if (m > 0) return `${m} daq ${s} son`;
  return `${s} soniya`;
}
