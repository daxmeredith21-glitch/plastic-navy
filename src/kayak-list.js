// src/kayak-list.js
// Trip history screen — lists all logged kayak trips, newest first.
// Follows the same render-function pattern as home.js (browse recipes).

import { supabase } from './supabase.js';

export async function renderKayakList(container, onNavigate) {
  container.innerHTML = `
    <div class="kayak-header">
      <h1>Kayak Log</h1>
      <p class="kayak-tagline">Every trip, who paddled, and what the water was doing.</p>
      <button class="btn-primary kayak-log-trip-btn" id="kayakLogTripBtn">Log a trip</button>
    </div>
    <div id="kayak-trip-count" class="kayak-trip-count"></div>
    <div id="kayak-history"></div>
  `;

  const historyEl = container.querySelector('#kayak-history');
  const countEl = container.querySelector('#kayak-trip-count');
  historyEl.innerHTML = `<p class="kayak-loading">Loading trips…</p>`;

  const { data: trips, error } = await supabase
    .from('kayak_trips')
    .select('*')
    .order('trip_date', { ascending: false })
    .order('trip_time', { ascending: false });

  if (error) {
    historyEl.innerHTML = `<p class="kayak-error">Couldn't load trips: ${error.message}</p>`;
    return;
  }

  countEl.textContent = trips.length
    ? `${trips.length} trip${trips.length === 1 ? '' : 's'} logged`
    : '';

  if (!trips.length) {
    historyEl.innerHTML = `<div class="kayak-empty">No trips yet. Log the first one above.</div>`;
    return;
  }

  historyEl.innerHTML = trips.map(renderTripCard).join('');

  container.querySelector("#kayakLogTripBtn")?.addEventListener("click", () => onNavigate("kayak-add"));

  historyEl.querySelectorAll('.kayak-trip').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      onNavigate("kayak-detail", id);
    });
  });
}

function renderTripCard(t) {
  const dateStr = formatDate(t.trip_date, t.trip_time);
  const stars = t.rating
    ? '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating)
    : '';
  const total = (t.kayakers || 0) + (t.beginners || 0);

  return `
    <div class="kayak-trip" data-id="${t.id}">
      <div class="kayak-trip-top">
        <div>
          <div class="kayak-trip-river">${escapeHtml(t.river_name)}</div>
          <div class="kayak-trip-when">${dateStr}</div>
        </div>
        ${stars ? `<div class="kayak-trip-stars">${stars}</div>` : ''}
      </div>
      <div class="kayak-trip-readings">
        ${t.height_ft != null ? `<div class="kayak-reading"><span class="kayak-reading-label">Height</span><span class="kayak-reading-value">${t.height_ft} <small>ft</small></span></div>` : ''}
        ${t.discharge_cfs != null ? `<div class="kayak-reading"><span class="kayak-reading-label">Discharge</span><span class="kayak-reading-value">${t.discharge_cfs} <small>ft³/s</small></span></div>` : ''}
      </div>
      <div class="kayak-badges">
        <span class="kayak-badge kayak-badge-kayaker">${t.kayakers || 0} kayaker${t.kayakers === 1 ? '' : 's'}</span>
        <span class="kayak-badge kayak-badge-beginner">${t.beginners || 0} beginner${t.beginners === 1 ? '' : 's'}</span>
        <span class="kayak-badge kayak-badge-total">${total} total</span>
        ${t.miles_paddled != null ? `<span class="kayak-badge kayak-badge-total">${t.miles_paddled} mi</span>` : ''}
        ${t.water_level ? `<span class="kayak-badge kayak-badge-water">${escapeHtml(t.water_level)}</span>` : ''}
      </div>
      ${t.notes ? `<div class="kayak-trip-notes">"${escapeHtml(t.notes)}"</div>` : ''}
    </div>
  `;
}

function formatDate(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr || '00:00'}`);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: timeStr ? 'numeric' : undefined, minute: timeStr ? '2-digit' : undefined
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
