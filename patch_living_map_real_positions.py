from pathlib import Path

path = Path("public/js/app.js")
text = path.read_text()

start = text.index("function renderLivingResonanceMap")
new = r'''function renderLivingResonanceMap(nodes, links){
  const host = document.getElementById("livingResonanceMap")
  if(!host) return

  const w = 360
  const h = 260

  const zone = document.getElementById("zone")
  const zoneW = Math.max(1, zone?.clientWidth || w)
  const zoneH = Math.max(1, zone?.clientHeight || h)

  const scaleX = w / zoneW
  const scaleY = h / zoneH

  const centrality = {}
  links.forEach(l => {
    if(l.a) centrality[l.a] = (centrality[l.a] || 0) + 1
    if(l.b) centrality[l.b] = (centrality[l.b] || 0) + 1
  })

  const points = nodes.slice(0, 18).map((n, i) => {
    const c = centrality[n.id] || 0
    const baseX = typeof n.x === "number" ? n.x : zoneW / 2
    const baseY = typeof n.y === "number" ? n.y : zoneH / 2

    return {
      ...n,
      cx: Math.max(24, Math.min(w - 24, baseX * scaleX)),
      cy: Math.max(24, Math.min(h - 24, baseY * scaleY)),
      dx: Math.sin(i + 1) * (7 + c * 3),
      dy: Math.cos(i + 1.5) * (7 + c * 3),
      r: 15 + Math.min(c * 5, 16),
      c
    }
  })

  host.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="living-map" role="img" aria-label="Paysage vivant de résonances">
      <defs>
        <radialGradient id="livingGlow" cx="50%" cy="50%" r="68%">
          <stop offset="0%" stop-color="rgba(255,255,255,.96)" />
          <stop offset="55%" stop-color="rgba(160,190,255,.22)" />
          <stop offset="100%" stop-color="rgba(0,0,0,.10)" />
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

      ${links.map((l, i) => {
        const a = points.find(p => p.id === l.a)
        const b = points.find(p => p.id === l.b)
        if(!a || !b) return ""

        return `
          <line
            x1="${a.cx}"
            y1="${a.cy}"
            x2="${b.cx}"
            y2="${b.cy}"
            class="living-link"
          >
            <animate attributeName="opacity" values=".15;.75;.15" dur="${4 + i % 3}s" repeatCount="indefinite"/>
            <animate attributeName="stroke-width" values="1.5;4;1.5" dur="${5 + i % 3}s" repeatCount="indefinite"/>
          </line>
        `
      }).join("")}

      ${points.map((p, i) => `
        <g class="living-node" transform="translate(${p.cx} ${p.cy})">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="${p.cx} ${p.cy}; ${p.cx + p.dx} ${p.cy + p.dy}; ${p.cx} ${p.cy}"
            dur="${5 + i % 5}s"
            repeatCount="indefinite"
          />

          <circle class="living-halo" r="${p.r + 8}">
            <animate attributeName="r" values="${p.r + 4};${p.r + 15};${p.r + 4}" dur="${4 + i % 4}s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values=".10;.34;.10" dur="${4 + i % 4}s" repeatCount="indefinite"/>
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
