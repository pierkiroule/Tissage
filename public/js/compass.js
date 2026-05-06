const zone = document.getElementById("zone")
const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")

let center = { x:0, y:0, max:0 }
let drag = null
let contactMemory = new Set()

function resizeCompass(){
  const r = zone.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1

  canvas.width = r.width * dpr
  canvas.height = r.height * dpr
  canvas.style.width = r.width + "px"
  canvas.style.height = r.height + "px"

  ctx.setTransform(dpr,0,0,dpr,0,0)

  center.x = r.width / 2
  center.y = r.height / 2
  center.max = Math.min(r.width,r.height) * .55

  draw()
  renderBubbles()
}

function resonance(b){
  const dx = b.x - center.x
  const dy = b.y - center.y
  const d = Math.sqrt(dx*dx + dy*dy)
  return Math.max(0, Math.min(1, 1 - d / center.max))
}

function measures(b){
  const dx = b.x - center.x
  const dy = center.y - b.y

  return {
    valence: +(dx / center.max).toFixed(2),
    activation: +(dy / center.max).toFixed(2),
    resonance: +resonance(b).toFixed(2)
  }
}

function size(b){
  return 62 + resonance(b) * 24
}

function opacity(b){
  return .85 + resonance(b) * .15
}

function linkKey(a,b){
  return [a.id,b.id].sort().join("__")
}

function toggleLink(a,b){
  if(!window.BDR.session.links) window.BDR.session.links = []

  const key = linkKey(a,b)
  const links = window.BDR.session.links
  const index = links.findIndex(l => l.key === key)

  if(index >= 0){
    links.splice(index,1)
    logEvent("link_off",{
      source:a.label,
      target:b.label
    })
  } else {
    links.push({
      key,
      a:a.id,
      b:b.id,
      source:a.label,
      target:b.label,
      weight:3,
      createdAt:now(),
      elapsedMs:getElapsedMs(),
      elapsedLabel:formatElapsed(getElapsedMs())
    })

    logEvent("link_on",{
      source:a.label,
      target:b.label
    })
  }

  saveSession()
  draw()
}

function checkContactToggle(movedBubble){
  const active = window.BDR.session.active || []
  const current = new Set()

  for(const other of active){
    if(other.id === movedBubble.id) continue

    const dx = movedBubble.x - other.x
    const dy = movedBubble.y - other.y
    const dist = Math.sqrt(dx*dx + dy*dy)

    const limit = (size(movedBubble)/2 + size(other)/2) * .82
    const key = linkKey(movedBubble, other)

    if(dist < limit){
      current.add(key)

      if(!contactMemory.has(key)){
        toggleLink(movedBubble, other)
      }
    }
  }

  contactMemory = current
}

function draw(){
  ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight)
  drawLinks()
}

function drawLinks(){
  const active = window.BDR.session?.active || []
  const links = window.BDR.session?.links || []

  for(const link of links){
    const a = active.find(x => x.id === link.a)
    const b = active.find(x => x.id === link.b)
    if(!a || !b) continue

    const res = (resonance(a) + resonance(b)) / 2
    const weight = link.weight || 3

    ctx.beginPath()
    ctx.moveTo(a.x,a.y)
    ctx.lineTo(b.x,b.y)

    ctx.strokeStyle = `rgba(31,111,100,${0.25 + weight*.1 + res*.15})`
    ctx.lineWidth = weight + res*2
    ctx.lineCap = "round"

    if(a.custom || b.custom) ctx.setLineDash([6,6])
    else ctx.setLineDash([])

    ctx.stroke()
    ctx.setLineDash([])
  }
}

function renderBubbles(){
  zone.querySelectorAll(".bubble").forEach(e=>e.remove())

  const active = window.BDR.session?.active || []

  active.forEach(b=>{
    const s = size(b)
    const el = document.createElement("div")


    el.className = `bubble ${b.family || ""} ${b.custom ? "custom" : ""}`
    el.innerHTML = `
      <div class="bubble-label">${escapeHtml(b.label)}</div>
    `
    el.title = b.label

    el.style.width = s + "px"
    el.style.height = s + "px"
    el.style.left = b.x + "px"
    el.style.top = b.y + "px"
    el.style.opacity = opacity(b)

    bindDrag(el,b)
    zone.appendChild(el)
  })

  draw()
}

function bindDrag(el,b){
  let longPressTimer = null
  let longPressDone = false

  el.onpointerdown = e=>{
    e.preventDefault()
    e.stopPropagation()

    contactMemory = new Set()
    longPressDone = false

    longPressTimer = setTimeout(()=>{
      longPressDone = true
      drag = null
      el.classList.remove("drag")

      if(confirm(`Supprimer "${b.label}" ?`)){
        deleteBubble(b)
      }
    }, 750)

    drag = {
      b,
      sx:e.clientX,
      sy:e.clientY,
      x:b.x,
      y:b.y
    }

    el.classList.add("drag")
    el.setPointerCapture(e.pointerId)
    showChrono()
  }

  el.onpointermove = e=>{
    if(!drag || drag.b !== b) return
    e.preventDefault()

    const movedEnough = Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 12
    if(movedEnough) clearTimeout(longPressTimer)

    b.x = drag.x + e.clientX - drag.sx
    b.y = drag.y + e.clientY - drag.sy

    clamp(b)

    const s = size(b)
    el.style.width = s + "px"
    el.style.height = s + "px"
    el.style.left = b.x + "px"
    el.style.top = b.y + "px"
    el.style.opacity = opacity(b)

    checkContactToggle(b)
    draw()
  }

  el.onpointerup = ()=>{
    clearTimeout(longPressTimer)

    if(longPressDone){
      longPressDone = false
      return
    }

    if(!drag) return

    Object.assign(b, measures(b))

    const from = {
      x: Math.round(drag.x),
      y: Math.round(drag.y)
    }

    const to = {
      x: Math.round(b.x),
      y: Math.round(b.y)
    }

    logEvent("word_move", {
      label:b.label,
      family:b.family,
      from,
      to,
      x:to.x,
      y:to.y,
      ...measures(b)
    })

    drag = null
    contactMemory = new Set()

    el.classList.remove("drag")
    saveSession()
    draw()
  }

  el.ondblclick = e=>{
    e.preventDefault()
    e.stopPropagation()

    if(b.noteText){
      showNoteModal(b.label, b.noteText)
    }
  }
}

function clamp(b){
  const r = zone.getBoundingClientRect()
  const s = size(b)/2

  b.x = Math.max(s, Math.min(r.width - s, b.x))
  b.y = Math.max(s, Math.min(r.height - s, b.y))
}

function deleteBubble(b){
  const s = window.BDR.session

  s.active = (s.active || []).filter(x => x.id !== b.id)
  s.links = (s.links || []).filter(l => l.a !== b.id && l.b !== b.id)

  logEvent("word_delete",{
    label:b.label,
    family:b.family,
    note:!!b.noteText
  })

  saveSession()
  renderApp()
}

function showNoteModal(title,text){
  let modal = document.getElementById("noteModal")

  if(!modal){
    modal = document.createElement("div")
    modal.id = "noteModal"
    modal.innerHTML = `
      <div class="note-modal-card">
        <h3 id="noteModalTitle"></h3>
        <p id="noteModalText"></p>
        <button id="noteModalClose">Fermer</button>
      </div>
    `
    document.body.appendChild(modal)

    document.getElementById("noteModalClose").onclick = () => {
      modal.classList.remove("visible")
    }
  }

  document.getElementById("noteModalTitle").textContent = title
  document.getElementById("noteModalText").textContent = text || "Aucune note associée."
  modal.classList.add("visible")
}
