import './style.css'
import { renderKayakList } from './kayak-list.js'
import { renderKayakAdd } from './kayak-add.js'
import { renderKayakDetail } from './kayak-detail.js'

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  screen: 'kayak-list', // 'kayak-list' | 'kayak-add' | 'kayak-detail' | 'kayak-edit'
  currentKayakTripId: null,
}

const app = document.getElementById('app')

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  app.innerHTML = `
    <nav class="nav">
      <div class="nav-title">🛶 Plastic <span>Navy</span></div>
    </nav>
    <main class="screen active" id="mainContent">
      <div class="loading"><div class="spinner"></div>Loading…</div>
    </main>
  `

  const container = document.getElementById('mainContent')

  if (state.screen === 'kayak-list') {
    renderKayakList(container, (screen, id) => {
      state.screen = screen
      if (id) state.currentKayakTripId = id
      render()
      window.scrollTo(0, 0)
    })
  }

  if (state.screen === 'kayak-add') {
    renderKayakAdd(container, () => {
      state.screen = 'kayak-list'
      render()
    })
  }

  if (state.screen === 'kayak-edit' && state.currentKayakTripId) {
    renderKayakAdd(container, () => {
      state.screen = 'kayak-detail'
      render()
    }, state.currentKayakTripId)
  }

  if (state.screen === 'kayak-detail' && state.currentKayakTripId) {
    renderKayakDetail(
      container,
      state.currentKayakTripId,
      () => {
        state.screen = 'kayak-list'
        render()
      },
      () => {
        state.screen = 'kayak-edit'
        render()
        window.scrollTo(0, 0)
      }
    )
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────
render()
