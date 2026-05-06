from pathlib import Path

path = Path("public/js/app.js")
text = path.read_text()

start = text.index("async function renderLivingResonanceMap")
new = r'''function renderLivingResonanceMap(nodes, links, events = []){
  const host = document.getElementById("livingResonanceMap")
  if(!host) return

  const w = 360
  const h = 260

  const zone = document.getElementById("zone")
  const zoneW = Math.max(1, zone?.clientWidth || w)
  const zoneH = Math.max(1, zone?.clientHeight || h)

  const sx = w / zoneW
  const sy = h / zoneH

  const colorByFamily = {
    corps:"#38bdf8",
    emotion:"#f472b6",
    emotions:"#f472b6",
    pensee:"#a78bfa",
    pensées:"#a78bfa",
    relation:"#4ade80",
    relations:"#4ade80",
    perso:"#facc15"
  }

  const points = nodes.slice(0,18).map(n => ({
    ...n,
    x:Math.max(28, Math.min(w - 28, (n.x || zoneW/2) * sx)),
    y:Math.max(28, Math.min(h - 28, (n.y || zoneH/2) * sy)),
    color:colorByFamily[n.family] || "#ffffff"
  }))

  host.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="living-map">
      <rect width="${w}" height="${h}" rx="26" class="svg-bg"/>

      ${links.map((l,i) => {
        const a = points.find(p => p.id === l.a)
        const b = points.find(p => p.id === l.b)
        if(!a || !b) return ""
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2 - 24
        return `
          <path class="resonance-current"
            d="M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}"
            stroke="${a.color}">
          </path>
        `
      }).join("")}

      ${points.map((p,i) => `
        <g class="living-node" transform="translate(${p.x} ${p.y})">
          <circle class="living-halo" r="26" fill="${p.color}"></circle>
          <circle class="living-core" r="16" stroke="${p.color}"></circle>
          <text y="1">${escapeHtml(getEmoji(p.label, p.family))}</text>

          <animateTransform
            attributeName="transform"
            type="translate"
            values="${p.x} ${p.y}; ${p.x + Math.sin(i+1)*8} ${p.y + Math.cos(i+2)*8}; ${p.x} ${p.y}"
            dur="${5 + i%4}s"
            repeatCount="indefinite"
          />
        </g>
      `).join("")}
    </svg>
  `
}
'''

path.write_text(text[:start] + new)
