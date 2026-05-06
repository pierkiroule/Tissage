from pathlib import Path

path = Path("public/js/app.js")
text = path.read_text()

start = text.index("function renderExactTimelapse")
new = r'''function renderExactTimelapse(nodes, links, events = []){
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

  const frames = events.length ? events : [{ type:"état final" }]
  let frame = 0
  let tween = 0
  let previousPositions = {}

  function stateAt(until){
    const visible = new Set()
    const positions = {}

    frames.slice(0, until + 1).forEach(e => {
      if(e.type === "word_on" && e.label) visible.add(e.label)
      if(e.type === "word_off" && e.label) visible.delete(e.label)

      if(e.type === "word_move" && e.label){
        visible.add(e.label)
        if(e.to) positions[e.label] = { x:e.to.x, y:e.to.y }
        else if(typeof e.x === "number") positions[e.label] = { x:e.x, y:e.y }
      }

      if(e.type === "link_on"){
        if(e.source) visible.add(e.source)
        if(e.target) visible.add(e.target)
      }
    })

    return { visible, positions }
  }

  function posOf(n, positions){
    const p = positions[n.label]
    return {
      x: ((p?.x ?? n.x ?? zoneW / 2) * sx),
      y: ((p?.y ?? n.y ?? zoneH / 2) * sy)
    }
  }

  function lerp(a,b,t){
    return a + (b - a) * t
  }

  function draw(){
    const event = frames[frame]
    const current = stateAt(frame)

    ctx.clearRect(0,0,w,h)

    const grad = ctx.createRadialGradient(w/2,h/2,20,w/2,h/2,Math.max(w,h)/1.2)
    grad.addColorStop(0,"rgba(255,255,255,.98)")
    grad.addColorStop(.55,"rgba(210,225,255,.92)")
    grad.addColorStop(1,"rgba(160,180,230,.55)")
    ctx.fillStyle = grad
    ctx.fillRect(0,0,w,h)

    const activeNodes = nodes.filter(n =>
      current.visible.has(n.label) || frame >= frames.length - 1
    )

    const positionsNow = {}

    activeNodes.forEach(n => {
      const target = posOf(n, current.positions)
      const prev = previousPositions[n.label] || target

      positionsNow[n.label] = {
        x: lerp(prev.x, target.x, tween),
        y: lerp(prev.y, target.y, tween)
      }
    })

    links.forEach(l => {
      const a = activeNodes.find(n => n.id === l.a)
      const b = activeNodes.find(n => n.id === l.b)
      if(!a || !b) return

      const pa = positionsNow[a.label]
      const pb = positionsNow[b.label]
      if(!pa || !pb) return

      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.strokeStyle = "rgba(30,50,120,.42)"
      ctx.lineWidth = 5
      ctx.lineCap = "round"
      ctx.stroke()
    })

    activeNodes.forEach(n => {
      const p = positionsNow[n.label]
      if(!p) return

      const emoji = typeof getEmoji === "function" ? getEmoji(n.label, n.family) : "•"

      ctx.beginPath()
      ctx.arc(p.x, p.y, 34, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(120,160,255,.22)"
      ctx.fill()

      ctx.beginPath()
      ctx.arc(p.x, p.y, 25, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,.97)"
      ctx.fill()
      ctx.strokeStyle = "rgba(20,30,80,.85)"
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.font = "28px system-ui"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(emoji, p.x, p.y)
    })

    if(label){
      label.textContent = event
        ? `${event.elapsedLabel || "—"} · ${event.type || "événement"} ${event.label ? "· " + event.label : ""}`
        : "—"
    }

    tween += .08

    if(tween >= 1){
      previousPositions = positionsNow
      tween = 0
      frame = (frame + 1) % frames.length
    }

    window.__exactTimelapseTimer = requestAnimationFrame(draw)
  }

  draw()
}
'''

text = text[:start] + new
path.write_text(text)
