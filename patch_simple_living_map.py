from pathlib import Path

path = Path("public/js/app.js")
text = path.read_text()

# Remplacer tous les appels possibles
text = text.replace(
  "renderExactTimelapse(nodes, links, events)",
  "renderLivingResonanceMap(nodes, links)"
)
text = text.replace(
  "renderLivingResonanceMap(nodes, links, events)",
  "renderLivingResonanceMap(nodes, links)"
)

# Remplacer le canvas par le div SVG si besoin
text = text.replace(
  '<canvas id="exactTimelapseCanvas"></canvas><div id="exactTimelapseLabel" class="muted">—</div>',
  '<div id="livingResonanceMap"></div>'
)

# Supprimer anciennes fonctions visuelles à partir de renderLiving ou renderExact
markers = [
  "async function renderLivingResonanceMap",
  "function renderLivingResonanceMap",
  "function renderExactTimelapse"
]

starts = [text.find(m) for m in markers if text.find(m) != -1]
start = min(starts) if starts else len(text)

new = r'''function renderLivingResonanceMap(nodes, links){
  const host = document.getElementById("livingResonanceMap")
  if(!host) return

  const w = 360
  const h = 270

  const zone = document.getElementById("zone")
  const zoneW = Math.max(1, zone?.clientWidth || w)
  const zoneH = Math.max(1, zone?.clientHeight || h)

  const sx = w / zoneW
  const sy = h / zoneH

  const colors = {
    corps:"#38bdf8",
    emotion:"#f472b6",
    emotions:"#f472b6",
    pensee:"#a78bfa",
    pensées:"#a78bfa",
    relation:"#4ade80",
    relations:"#4ade80",
    perso:"#facc15"
  }

  const centrality = {}
  links.forEach(l => {
    if(l.a) centrality[l.a] = (centrality[l.a] || 0) + 1
    if(l.b) centrality[l.b] = (centrality[l.b] || 0) + 1
  })

  const points = nodes.slice(0,18).map(n => ({
    ...n,
    x:Math.max(30, Math.min(w - 30, (n.x || zoneW / 2) * sx)),
    y:Math.max(30, Math.min(h - 30, (n.y || zoneH / 2) * sy)),
    color:colors[n.family] || "#ffffff",
    c:centrality[n.id] || 0
  }))

  host.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="simple-reso-map" role="img" aria-label="Paysage vivant de résonances">
      <defs>
        <radialGradient id="simpleResoBg" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stop-color="rgba(255,255,255,.98)" />
          <stop offset="60%" stop-color="rgba(215,226,255,.95)" />
          <stop offset="100%" stop-color="rgba(170,190,235,.65)" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="${w}" height="${h}" rx="26" fill="url(#simpleResoBg)" />

      ${links.map((l,i) => {
        const a = points.find(p => p.id === l.a)
        const b = points.find(p => p.id === l.b)
        if(!a || !b) return ""

        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2 - 18

        return `
          <path
            class="simple-reso-link"
            d="M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}"
            stroke="${a.color}"
            style="animation-delay:${i * .25}s"
          />
        `
      }).join("")}

      ${points.map((p,i) => {
        const r = 17 + Math.min(p.c * 5, 16)
        return `
          <g class="simple-reso-node" transform="translate(${p.x} ${p.y})">
            <circle class="simple-reso-halo" r="${r + 12}" fill="${p.color}">
              <animate attributeName="opacity" values=".12;.36;.12" dur="${4 + i % 3}s" repeatCount="indefinite"/>
              <animate attributeName="r" values="${r + 8};${r + 16};${r + 8}" dur="${4 + i % 3}s" repeatCount="indefinite"/>
            </circle>

            <circle class="simple-reso-core" r="${r}" stroke="${p.color}" />

            <text y="1">${escapeHtml(getEmoji(p.label, p.family))}</text>
          </g>
        `
      }).join("")}
    </svg>
  `
}
'''

text = text[:start] + new
path.write_text(text)
