// src/kayak-detail.js
// Single trip detail view, with edit + delete.

import { supabase } from './supabase.js';

export async function renderKayakDetail(container, tripId, onBack, onEdit) {
  container.innerHTML = `<p class="kayak-loading">Loading trip…</p>`;

  const { data: trip, error } = await supabase
    .from('kayak_trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (error || !trip) {
    container.innerHTML = `
      <span class="kayak-back-link kayak-back-trigger" style="cursor:pointer">&larr; Back to log</span>
      <p class="kayak-error">Couldn't load that trip${error ? `: ${error.message}` : ''}.</p>
    `;
    container.querySelector('.kayak-back-trigger').addEventListener('click', onBack);
    return;
  }

  const dateStr = new Date(`${trip.trip_date}T${trip.trip_time}`).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
  const stars = trip.rating ? '★'.repeat(trip.rating) + '☆'.repeat(5 - trip.rating) : '';
  const total = (trip.kayakers || 0) + (trip.beginners || 0);

  const surveyBits = [];
  if (trip.miles_paddled != null) surveyBits.push(`<span class="kayak-badge kayak-badge-total">${trip.miles_paddled} mi paddled</span>`);
  if (trip.water_level) surveyBits.push(`<span class="kayak-badge kayak-badge-water">Water: ${escapeHtml(trip.water_level)}</span>`);
  if (trip.felt_safe != null) surveyBits.push(`<span class="kayak-badge ${trip.felt_safe ? 'kayak-badge-safe' : 'kayak-badge-unsafe'}">${trip.felt_safe ? 'Felt safe' : 'Felt unsafe'}</span>`);

  container.innerHTML = `
    <span class="kayak-back-link kayak-back-trigger" style="cursor:pointer">&larr; Back to log</span>
    <div class="kayak-card kayak-detail-card">
      <h1>${escapeHtml(trip.river_name)}</h1>
      <p class="kayak-detail-date">${dateStr}</p>
      ${stars ? `<div class="kayak-trip-stars">${stars}</div>` : ''}

      <div class="kayak-trip-readings kayak-detail-readings">
        ${trip.height_ft != null ? `<div class="kayak-reading"><span class="kayak-reading-label">Height</span><span class="kayak-reading-value">${trip.height_ft} <small>ft</small></span></div>` : ''}
        ${trip.discharge_cfs != null ? `<div class="kayak-reading"><span class="kayak-reading-label">Discharge</span><span class="kayak-reading-value">${trip.discharge_cfs} <small>ft³/s</small></span></div>` : ''}
      </div>

      <div class="kayak-badges">
        <span class="kayak-badge kayak-badge-kayaker">${trip.kayakers || 0} kayaker${trip.kayakers === 1 ? '' : 's'}</span>
        <span class="kayak-badge kayak-badge-beginner">${trip.beginners || 0} beginner${trip.beginners === 1 ? '' : 's'}</span>
        <span class="kayak-badge kayak-badge-total">${total} total</span>
      </div>

      ${surveyBits.length ? `<div class="kayak-badges">${surveyBits.join('')}</div>` : ''}

      ${trip.duration ? `<p class="kayak-detail-meta"><strong>Duration:</strong> ${escapeHtml(trip.duration)}</p>` : ''}
      ${trip.notes ? `<p class="kayak-trip-notes">"${escapeHtml(trip.notes)}"</p>` : ''}

      ${trip.gauge_id
        ? `<p class="kayak-detail-meta kayak-detail-gauge">USGS-${escapeHtml(trip.gauge_id)}${trip.distance_mi != null ? ` · ${Number(trip.distance_mi).toFixed(1)} mi from logged location` : ''}</p>`
        : `<p class="kayak-detail-meta kayak-detail-gauge">No gauge — logged manually</p>`}

      <button class="btn-secondary kayak-edit-btn" id="kayak-edit-btn" type="button">Edit this trip</button>
      <button class="btn-danger kayak-delete-btn" id="kayak-delete-btn" type="button">Delete this trip</button>
      <div id="kayak-detail-msg"></div>
    </div>
  `;

  container.querySelectorAll('.kayak-back-trigger').forEach(el => el.addEventListener('click', onBack));
  container.querySelector('#kayak-edit-btn').addEventListener('click', onEdit);

  container.querySelector('#kayak-delete-btn').addEventListener('click', async () => {
    if (!confirm('Delete this trip? This can\'t be undone.')) return;
    const msgEl = container.querySelector('#kayak-detail-msg');
    const { error: delError } = await supabase.from('kayak_trips').delete().eq('id', tripId);
    if (delError) {
      msgEl.innerHTML = `<div class="kayak-form-error">Couldn't delete: ${delError.message}</div>`;
      return;
    }
    onBack();
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
