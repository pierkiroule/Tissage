let chronoTimer = null

function getElapsedMs() {
  const s = window.BDR.session
  if (!s) return 0
  return Date.now() - s.startedAt
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
  badge.textContent = "⏱ " + formatElapsed(getElapsedMs())
  badge.classList.add("visible")

  clearTimeout(chronoTimer)
  chronoTimer = setTimeout(() => {
    badge.classList.remove("visible")
  }, 2500)
}
