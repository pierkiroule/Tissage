from pathlib import Path

path = Path("public/js/app.js")
text = path.read_text()

text = text.replace(
    "renderLivingResonanceMap(nodes, links)",
    "renderLivingResonanceMap(nodes, links, events)"
)

start = text.index("function renderLivingResonanceMap")
new = r'''function renderLivingResonanceMap(nodes, links, events = []){
  const host = document.getElementById("livingResonanceMap")
  if(!host) return

  const w = 360
  const h = 270

  const zone = document.getElementById("zone")
  const zoneW = Math.max(1, zone?.clientWidth || w)
  const zoneH = Math.max(1, zone?.clientHeight || h)

  const scaleX = w / zoneW
  const scaleY = h / zoneH

  const clampX = x => Math.max(26, Math.min(w - 26, x * scaleX))
  const clampY = y => Math.max(26, Math.min(h - 26, y * scaleY))

  const centrality = {}

  links.forEach(l => {
    if(l.a) centrality[l.a] = (centrality[l.a] || 0) + 1
    if(l.b) centrality[l.b] = (centrality[l.b] || 0) + 1
  })

  const points = nodes.slice(0, 18).map(n => {
    const moves = events
      .filter(e =>
        e.type === "word_move" &&
        e.label === n.label &&
        e.from &&
        e.to
      )
      .slice(-8)

    const finalX = typeof n.x === "number" ? n.x : zoneW / 2
    const finalY = typeof n.y === "number" ? n.y : zoneH / 2

    let frames = []

    if(moves.length){
      frames.push(`${clampX(moves[0].from.x)} ${clampY(moves[0].from.y)}`)

      moves.forEach(m => {
        frames.push(`${clampX(m.to.x)} ${clampY(m.to.y)}`)
      })
    }

    frames.push(`${clampX(finalX)} ${clampY(finalY)}`)

    const forward = frames.join("; ")
    const backward = [...frames].reverse().join("; ")
    const values = `${forward}; ${backward}`

    return {
      ...n,
      x: clampX(finalX),
      y: clampY(finalY),
      values,
      r: 15 + Math.min((centrality[n.id] || 0) * 5, 18),
      c: centrality[n.id] || 0
    }
  })

  const moveTraces = events
    .filter(e => e.type === "word_move" && e.from && e.to)
    .slice(-18)
    .map((e, i) => ({
      x1: clampX(e.from.x),
      y1: clampY(e.from.y),
      x2: clampX(e.to.x),
      y2: clampY(e.to.y),
      label: e.label || "",
      delay: i * .18
    }))

  host.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="living-map timelapse-map" role="img" aria-label="Timelapse du paysage vivant de résonances">
      <defs>
        <radialGradient id="livingGlow" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stop-color="rgba(255,255,255,.98)" />
          <stop offset="52%" stop-color="rgba(150,185,255,.24)" />
          <stop offset="100%" stop-color="rgba(10,20,55,.16)" />
        </radialGradient>

        <filter id="softGlow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <rect x="0" y="0" width="${w}" height="${h}" rx="26" fill="url(#livingGlow)" />

      ${moveTraces.map(m => {
        const mx = (m.x1 + m.x2) / 2
        const my = (m.y1 + m.y2) / 2 - 24

        return `
          <path
            class="living-trace"
            d="M ${m.x1} ${m.y1} Q ${mx} ${my} ${m.x2} ${m.y2}"
            style="animation-delay:${m.delay}s"
          />
        `
      }).join("")}

      ${links.map((l, i) => {
        const a = points.find(p => p.id === l.a)
        const b = points.find(p => p.id === l.b)
        if(!a || !b) return ""

        return `
          <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="living-link">
            <animate attributeName="opacity" values=".12;.75;.12" dur="${4 + i % 3}s" repeatCount="indefinite"/>
            <animate attributeName="stroke-width" values="1.5;4;1.5" dur="${5 + i % 3}s" repeatCount="indefinite"/>
          </line>
        `
      }).join("")}

      ${points.map((p, i) => `
        <g class="living-node" transform="translate(${p.x} ${p.y})">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="${p.values}"
            dur="${7 + i % 4}s"
            repeatCount="indefinite"
          />

          <circle class="living-halo" r="${p.r + 8}">
            <animate attributeName="r" values="${p.r + 4};${p.r + 16};${p.r + 4}" dur="${4 + i % 4}s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values=".10;.36;.10" dur="${4 + i % 4}s" repeatCount="indefinite"/>
          </circle>

          <circle class="living-core" r="${p.r}">
            <animate attributeName="r" values="${p.r};${p.r + 3};${p.r}" dur="${3.5 + i % 4}s" repeatCount="indefinite"/>
          </circle>

          <text y="1">${escapeHtml(getEmoji(p.label, p.family))}</text>
        </g>
      `).join("")}
    </svg>
  `
}
'''

path.write_text(text[:start] + new)
