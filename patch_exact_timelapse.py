from pathlib import Path

path = Path("public/js/app.js")
text = path.read_text()

# Remplace l'appel ancien s'il existe
text = text.replace(
  "renderLivingResonanceMap(nodes, links, events)",
  "renderExactTimelapse(nodes, links, events)"
)
text = text.replace(
  "renderLivingResonanceMap(nodes, links)",
  "renderExactTimelapse(nodes, links, events)"
)

# Remplace le div de carte vivante par canvas
text = text.replace(
  '<div id="livingResonanceMap"></div>',
  '<canvas id="exactTimelapseCanvas"></canvas><div id="exactTimelapseLabel" class="muted">—</div>'
)

# Ajoute fonction
text += r'''

function renderExactTimelapse(nodes, links, events = []){
  const canvas = document.getElementById("exactTimelapseCanvas")
  const label = document.getElementById("exactTimelapseLabel")
  if(!canvas) return

  if(window.__exactTimelapseTimer){
    clearInterval(window.__exactTimelapseTimer)
  }

  const zone = document.getElementById("zone")
  const zoneW = Math.max(1, zone?.clientWidth || 360)
  const zoneH = Math.max(1, zone?.clientHeight || 260)

  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  const ctx = canvas.getContext("2d")
  ctx.setTransform(dpr,0,0,dpr,0,0)

  const w = rect.width
  const h = rect.height

  const sx = w / zoneW
  const sy = h / zoneH

  let frame = 0
  const frames = events.length ? events : [{ type:"état final" }]

  function buildState(until){
    const visible = new Set()
    const positions = {}

    frames.slice(0, until + 1).forEach(e => {
      if(e.type === "word_on" && e.label) visible.add(e.label)
      if(e.type === "word_off" && e.label) visible.delete(e.label)

      if(e.type === "word_move" && e.label){
        visible.add(e.label)
        if(e.to){
          positions[e.label] = { x:e.to.x, y:e.to.y }
        } else if(typeof e.x === "number" && typeof e.y === "number"){
          positions[e.label] = { x:e.x, y:e.y }
        }
      }

      if(e.type === "link_on"){
        if(e.source) visible.add(e.source)
        if(e.target) visible.add(e.target)
      }
    })

    return { visible, positions }
  }

  function draw(){
    const event = frames[frame]
    const { visible, positions } = buildState(frame)

    ctx.clearRect(0,0,w,h)

    ctx.fillStyle = "rgba(255,255,255,.82)"
    ctx.fillRect(0,0,w,h)

    const activeNodes = nodes.filter(n =>
      visible.has(n.label) || frame >= frames.length - 1
    )

    const getPos = n => {
      const p = positions[n.label]
      return {
        x: ((p?.x ?? n.x ?? zoneW/2) * sx),
        y: ((p?.y ?? n.y ?? zoneH/2) * sy)
      }
    }

    links.forEach(l => {
      const a = activeNodes.find(n => n.id === l.a)
      const b = activeNodes.find(n => n.id === l.b)
      if(!a || !b) return

      const pa = getPos(a)
      const pb = getPos(b)

      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.strokeStyle = "rgba(20,30,70,.38)"
      ctx.lineWidth = l.weight || 3
      ctx.lineCap = "round"
      ctx.stroke()
    })

    activeNodes.forEach(n => {
      const p = getPos(n)
      const emoji = typeof getEmoji === "function"
        ? getEmoji(n.label, n.family)
        : "•"

      ctx.beginPath()
      ctx.arc(p.x, p.y, 21, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,.95)"
      ctx.fill()
      ctx.strokeStyle = "rgba(20,30,70,.75)"
      ctx.lineWidth = 2.5
      ctx.stroke()

      ctx.font = "22px system-ui"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(emoji, p.x, p.y)
    })

    if(label){
      label.textContent = event
        ? `${event.elapsedLabel || "—"} · ${event.type || "événement"} ${event.label ? "· " + event.label : ""}`
        : "—"
    }

    frame = (frame + 1) % frames.length
  }

  draw()
  window.__exactTimelapseTimer = setInterval(draw, 650)
}
'''

path.write_text(text)
