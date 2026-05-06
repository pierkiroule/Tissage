from pathlib import Path

path = Path("public/js/app.js")
text = path.read_text()

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

  const clampX = x => Math.max(28, Math.min(w - 28, x * scaleX))
  const clampY = y => Math.max(28, Math.min(h - 28, y * scaleY))

  const familyColor = {
    corps: "#7dd3fc",
    emotion: "#f9a8d4",
    emotions: "#f9a8d4",
    pensee: "#c4b5fd",
    pensées: "#c4b5fd",
    relation: "#86efac",
    relations: "#86efac",
    perso: "#fde68a"
  }

  const centrality = {}

  links.forEach(l => {
    if(l.a) centrality[l.a] = (centrality[l.a] || 0) + 1
    if(l.b) centrality[l.b] = (centrality[l.b] || 0) + 1
  })

  const points = nodes.slice(0, 18).map(n => {
    const baseX = typeof n.x === "number" ? n.x : zoneW / 2
    const baseY = typeof n.y === "number" ? n.y : zoneH / 2
    const color = familyColor[n.family] || "#ffffff"
    const c = centrality[n.id] || 0

    return {
      ...n,
      x: clampX(baseX),
      y: clampY(baseY),
      color,
      centrality:c,
      r: 13 + Math.min(c * 5, 18)
    }
  })

  const currents = links.map((l, i) => {
    const a = points.find(p => p.id === l.a)
    const b = points.find(p => p.id === l.b)
    if(!a || !b) return ""

    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const curve = 24 + ((i % 3) * 14)

    return `
      <path
        class="resonance-current"
        d="M ${a.x} ${a.y} Q ${mx} ${my - curve} ${b.x} ${b.y}"
        stroke="url(#mix-${i})"
        style="animation-delay:${i * .2}s"
      />
      <defs>
        <linearGradient id="mix-${i}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${a.color}" />
          <stop offset="50%" stop-color="rgba(255,255,255,.9)" />
          <stop offset="100%" stop-color="${b.color}" />
        </linearGradient>
      </defs>
    `
  }).join("")

  const familyZones = Object.entries(
    points.reduce((acc, p) => {
      if(!acc[p.family]) acc[p.family] = []
      acc[p.family].push(p)
      return acc
    }, {})
  ).map(([family, pts], i) => {
    const x = pts.reduce((sum, p) => sum + p.x, 0) / pts.length
    const y = pts.reduce((sum, p) => sum + p.y, 0) / pts.length
    const r = 34 + pts.length * 8
    const color = familyColor[family] || "#ffffff"

    return `
      <circle
        class="family-cloud"
        cx="${x}"
        cy="${y}"
        r="${r}"
        fill="${color}"
        style="animation-delay:${i * .35}s"
      />
    `
  }).join("")

  host.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="living-map currents-map" role="img" aria-label="Courants du paysage résonant">
      <defs>
        <radialGradient id="currentBackground" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stop-color="rgba(255,255,255,.98)" />
          <stop offset="55%" stop-color="rgba(180,205,255,.20)" />
          <stop offset="100%" stop-color="rgba(10,20,55,.18)" />
        </radialGradient>

        <filter id="liquidGlow">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <rect x="0" y="0" width="${w}" height="${h}" rx="26" fill="url(#currentBackground)" />

      ${familyZones}

      ${currents}

      ${points.map((p, i) => `
        <g class="current-node" transform="translate(${p.x} ${p.y})">
          <circle class="current-node-halo" r="${p.r + 12}" fill="${p.color}">
            <animate attributeName="r" values="${p.r + 8};${p.r + 18};${p.r + 8}" dur="${4 + i % 4}s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values=".18;.42;.18" dur="${4 + i % 4}s" repeatCount="indefinite"/>
          </circle>

          <circle class="current-node-core" r="${p.r}" fill="rgba(255,255,255,.92)" stroke="${p.color}">
            <animate attributeName="r" values="${p.r};${p.r + 3};${p.r}" dur="${3 + i % 4}s" repeatCount="indefinite"/>
          </circle>

          <text y="1">${escapeHtml(getEmoji(p.label, p.family))}</text>
        </g>
      `).join("")}
    </svg>
  `
}
'''

path.write_text(text[:start] + new)
