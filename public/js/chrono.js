let chronoTimer = null

function getElapsedMs() {
  const s = window.BDR.session
  if (!s) return 0
  const pausedMs = Number(s.pausedTotalMs || 0)
  if (s.isPaused && s.pauseStartedAt) {
    return Math.max(0, Number(s.pauseStartedAt) - Number(s.startedAt) - pausedMs)
  }
  return Math.max(0, Date.now() - Number(s.startedAt) - pausedMs)
}

function pauseSessionClock(reason = "manual_pause") {
  const s = window.BDR.session
  if (!s || s.isPaused) return
  s.isPaused = true
  s.pauseStartedAt = Date.now()
  s.pauseReason = reason
  s.pauseCount = Number(s.pauseCount || 0) + 1
  if (!Array.isArray(s.pauseHistory)) s.pauseHistory = []
  s.pauseHistory.push({ at: now(), reason, elapsedMs: getElapsedMs() })
  saveSession()
}

function resumeSessionClock(reason = "manual_resume") {
  const s = window.BDR.session
  if (!s || !s.isPaused || !s.pauseStartedAt) return
  const pausedFor = Math.max(0, Date.now() - Number(s.pauseStartedAt))
  s.pausedTotalMs = Number(s.pausedTotalMs || 0) + pausedFor
  s.lastPauseMs = pausedFor
  s.isPaused = false
  s.pauseStartedAt = null
  s.pauseReason = null
  if (!Array.isArray(s.pauseHistory)) s.pauseHistory = []
  s.pauseHistory.push({ at: now(), reason, pausedForMs: pausedFor, elapsedMs: getElapsedMs() })
  saveSession()
}

function formatElapsed(ms) {
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, "0")
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0")
  const sec = String(total % 60).padStart(2, "0")
  return `${h}:${m}:${sec}`
}

function showChrono() {
  const badge = document.getElementById("chronoBadge")
  if(!badge) return
  badge.textContent = "⏱ " + formatElapsed(getElapsedMs())
  badge.classList.add("visible")

  clearTimeout(chronoTimer)
  chronoTimer = setTimeout(() => {
    badge.classList.remove("visible")
  }, 2500)
}
