const $ = id => document.getElementById(id)

let openFamily = "corps"
let showRaw = false
let activeMainTab = "ecouter"

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"))
  $("app").classList.remove("active")
  const summaryEl = $("summary")
  if(summaryEl) summaryEl.classList.remove("active")

  if(id === "app") $("app").classList.add("active")
  else if(id === "summary") $("summary").classList.add("active")
  else if($(id)) $(id).classList.add("active")
}

function ensureSessionFields(){
  const s = window.BDR.session
  if(!s.links) s.links = []
  if(!s.personalNotes) s.personalNotes = []
  if(!s.active) s.active = []
}

function startSession(){
  const pseudo = $("pseudoInput").value.trim()

  if(!pseudo){
    alert("Indiquez votre pseudo.")
    return
  }

  window.BDR.session = createSession(pseudo, "local")
  ensureSessionFields()
  saveSession()
  logEvent("session_start", { pseudo })
  showApp()
}

function showApp(){
  showScreen("app")
  renderApp()
}

function renderApp(){
  renderMainTabs()
  renderFamilyTabs()
  renderChips()
  resizeCompass()
  renderBubbles()
  renderInlineSummary()
}

function renderMainTabs(){
  document.querySelectorAll(".main-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === activeMainTab)
  })
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.tabPanel === activeMainTab)
  })
}

function switchMainTab(tab){
  activeMainTab = tab
  renderMainTabs()
}

async function scanQrFromFile(){
  const input = $("qrFileInput")
  const status = $("qrStatus")
  if(!input || !input.files?.length) return
  if(!("BarcodeDetector" in window)){
    status.textContent = "Scanner non supporté ici. Collez l’URL manuellement."
    return
  }
  const detector = new BarcodeDetector({ formats: ["qr_code"] })
  const bitmap = await createImageBitmap(input.files[0])
  const codes = await detector.detect(bitmap)
  if(!codes.length || !codes[0].rawValue){
    status.textContent = "QR non reconnu."
    return
  }
  openScannedPage(codes[0].rawValue)
  status.textContent = "QR détecté."
}

function openScannedPage(url){
  const safe = (url || "").trim()
  if(!/^https?:\/\//i.test(safe)){
    alert("URL invalide. Utilisez une URL commençant par http:// ou https://")
    return
  }
  const modal = $("qrModal")
  const iframe = $("qrIframe")
  iframe.src = safe
  modal.classList.remove("hidden")
}

function closeQrModal(){
  const modal = $("qrModal")
  const iframe = $("qrIframe")
  if(iframe) iframe.src = "about:blank"
  if(modal) modal.classList.add("hidden")
}

function renderFamilyTabs(){
  $("familyTabs").innerHTML = Object.keys(window.BDR_LABELS).map(family => `
    <button class="family-tab ${family} ${openFamily === family ? "active" : ""}" onclick="toggleFamily('${family}')">
      ${window.BDR_LABELS[family]}
    </button>
  `).join("")
}

function toggleFamily(family){
  openFamily = openFamily === family ? "" : family
  renderFamilyTabs()
  renderChips()
}

function getWordsForFamily(family){
  if(family === "perso"){
    return (window.BDR.session.personalNotes || []).map(n => n.label)
  }
  return window.BDR_WORDS[family] || []
}

function renderChips(){
  if(!openFamily){
    $("chips").innerHTML = ""
    return
  }

  const words = getWordsForFamily(openFamily)

  $("chips").innerHTML = words.map(label => {
    const on = window.BDR.session.active.some(x => x.label === label)
    return `
      <button class="chip ${openFamily} ${on ? "used" : ""}" onclick="toggleWord('${openFamily}','${label}')">
        ${getEmoji(label, openFamily)} ${escapeHtml(label)}
      </button>
    `
  }).join("")
}

function toggleWord(family, label){
  const active = window.BDR.session.active
  const found = active.find(x => x.label === label)

  if(found){
    window.BDR.session.active = active.filter(x => x.label !== label)
    window.BDR.session.links = (window.BDR.session.links || []).filter(l => l.a !== found.id && l.b !== found.id)
    logEvent("word_off", { label, family })
  } else {
    const angle = Math.random() * Math.PI * 2
    const r = center.max * .55

    const note = family === "perso"
      ? (window.BDR.session.personalNotes || []).find(n => n.label === label)
      : null

    window.BDR.session.active.push({
      id: uid(),
      label,
      family,
      custom: family === "perso",
      noteText: note?.text || "",
      noteId: note?.id || "",
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r
    })

    logEvent("word_on", { label, family })
  }

  saveSession()
  renderApp()
}

function addNote(){
  const input = $("noteInput")
  const text = input.value.trim()

  if(!text) return

  const raw = text.toLowerCase().replace(/\s+/g, "")
  const label = raw.slice(0, 6) + (raw.length > 6 ? "…" : "")

  const note = {
    id: uid(),
    label,
    text,
    createdAt: now(),
    elapsedMs: getElapsedMs(),
    elapsedLabel: formatElapsed(getElapsedMs())
  }

  window.BDR.session.personalNotes.push(note)

  window.BDR.session.active.push({
    id: uid(),
    label,
    family: "perso",
    custom: true,
    noteText: text,
    noteId: note.id,
    x: center.x,
    y: center.y
  })

  input.value = ""
  openFamily = "perso"

  logEvent("note_add", { label, text, noteId: note.id })
  saveSession()
  renderApp()
}

function goToSummary(){
  switchMainTab("synthetiser")
  renderInlineSummary()
}

function backToSession(){
  if(!window.BDR.session) return
  logEvent("back_to_session")
  showApp()
}



function toggleRaw(){
  showRaw = !showRaw
  renderSummary()
}

function bindUI(){
  $("startBtn").onclick = startSession
  $("noteBtn").onclick = addNote
  $("scanQrBtn").onclick = () => $("qrFileInput").click()
  $("qrFileInput").onchange = scanQrFromFile
  $("openManualUrlBtn").onclick = () => openScannedPage($("manualUrlInput").value)
  $("closeQrModalBtn").onclick = closeQrModal
  $("qrModal").onclick = e => {
    if(e.target.id === "qrModal") closeQrModal()
  }

  document.querySelectorAll(".main-tab").forEach(btn => {
    btn.onclick = () => switchMainTab(btn.dataset.tab)
  })

  const input = $("noteInput")
  if(input){
    input.onkeydown = e => {
      if(e.key === "Enter") addNote()
    }
  }
}

window.onresize = () => {
  if(window.BDR.session && $("app").classList.contains("active")) renderApp()
}

document.addEventListener("pointerdown", () => {
  if(window.BDR.session) showChrono()
})

document.addEventListener("DOMContentLoaded", () => {
  bindUI()

  const saved = loadSession()
  if(saved){
    window.BDR.session = saved
    ensureSessionFields()
  }

  showScreen("start")
})


window.goToSummary = goToSummary
window.backToSession = backToSession

function renderInlineSummary(){
  const host = $("syntheseInline")
  if(!host || !window.BDR?.session) return
  const s = window.BDR.session
  const nodes = s.active || []
  const links = s.links || []
  const notes = s.personalNotes || []

  host.innerHTML = `
    <section class="summary-stats">
      <div><b>${nodes.length}</b><span>éléments</span></div>
      <div><b>${links.length}</b><span>liens</span></div>
      <div><b>${notes.length}</b><span>notes</span></div>
    </section>
    <section class="summary-card summary-notes">
      <h3>Mes notes</h3>
      ${notes.length ? `<ul class="summary-list">${notes.map(n => `<li><b>${escapeHtml(n.label)}</b><br>${escapeHtml(n.text)}</li>`).join("")}</ul>` : "<p class='muted'>Aucune note ajoutée.</p>"}
    </section>
    <section class="summary-actions">
      <button onclick="downloadJson()">Télécharger mes données</button>
    </section>
  `
}

function renderSummarySafe(){
  const s = window.BDR.session
  const nodes = s.active || []
  const links = s.links || []
  const notes = s.personalNotes || []

  $("summary").innerHTML = `
    <button onclick="backToSession()">← Retour au tissage</button>
    <h2>Mon tissage</h2>
      <div class="box"><button onclick="openReplayModal()">Voir le replay</button></div>

    <div class="box">
      <div class="metric"><span>Mots / notes</span><b>${nodes.length}</b></div>
      <div class="metric"><span>Liens</span><b>${links.length}</b></div>
      <div class="metric"><span>Notes</span><b>${notes.length}</b></div>
    </div>

    <div class="box">
      <h3>Mes notes</h3>
      ${notes.map(n => `<p><b>${escapeHtml(n.label)}</b> — ${escapeHtml(n.text)}</p>`).join("") || "<p>Aucune note.</p>"}
    </div>

    <div class="box">
      <button onclick="downloadJson()">Télécharger mes données</button>
      <button class="danger" onclick="clearSession()">Effacer local</button>
    </div>
  `

  showScreen("summary")
}

const oldRenderSummary = renderSummary
renderSummary = function(){
  try{
    oldRenderSummary()
  }catch(e){
    console.warn("Fallback summary", e)
    renderSummarySafe()
  }
}







renderSummary = function(){
  const s = window.BDR.session
  const nodes = s.active || []
  const links = s.links || []
  const notes = s.personalNotes || []
  const events = s.events || []

  const sorted = [...nodes]
    .map(n => ({ ...n, score: n.resonance ?? 0 }))
    .sort((a,b) => b.score - a.score)
    .slice(0,5)

  const degree = {}
  links.forEach(l => {
    degree[l.source] = (degree[l.source] || 0) + 1
    degree[l.target] = (degree[l.target] || 0) + 1
  })

  const mostLinked = Object.entries(degree)
    .sort((a,b) => b[1] - a[1])
    .slice(0,5)

  $("summary").innerHTML = `
    <button onclick="backToSession()">← Retour</button>

    <h2>Mon tissage</h2>
      <div class="box"><button onclick="openReplayModal()">Voir le replay</button></div>

    <div class="replay-box">
      <h3>Dynamique du tissage</h3>
      <canvas id="replayCanvas"></canvas>
      <input id="replaySlider" type="range" min="0" max="${Math.max(events.length - 1, 0)}" value="${Math.max(events.length - 1, 0)}">
      <div id="replayInfo">—</div>
      <div id="replaySub">Déplacez le curseur pour revoir l’évolution.</div>
    </div>

    <div class="box">
      <div class="metric"><span>Éléments</span><b>${nodes.length}</b></div>
      <div class="metric"><span>Liens</span><b>${links.length}</b></div>
      <div class="metric"><span>Notes</span><b>${notes.length}</b></div>
    </div>

    <div class="box">
      <h3>Ce qui ressort</h3>
      ${
        sorted.length
          ? sorted.map(n => `<p>${escapeHtml(n.label)}</p>`).join("")
          : "<p>—</p>"
      }
    </div>

    <div class="box">
      <h3>Connexions fortes</h3>
      ${
        mostLinked.length
          ? mostLinked.map(([l,c]) => `<p>${escapeHtml(l)} — ${c}</p>`).join("")
          : "<p>—</p>"
      }
    </div>

    <div class="box">
      <h3>Notes</h3>
      ${
        notes.length
          ? notes.map(n => `<p>${escapeHtml(n.text)}</p>`).join("")
          : "<p>Aucune</p>"
      }
    </div>

    <div class="box">
      <p style="opacity:.7">
        Ce tissage reflète une expérience à un moment donné.
      </p>
    </div>

    <div class="box">
      <button onclick="downloadJson()">Télécharger mes données</button>
    </div>
  `

  showScreen("summary")
  initReplay()
}

function initReplay(){
  const slider = document.getElementById("replaySlider")
  if(!slider) return

  slider.oninput = () => drawReplay(Number(slider.value))
  drawReplay(Number(slider.value))
}

function drawReplay(index){
  const s = window.BDR.session
  const events = s.events || []
  const nodes = s.active || []
  const links = s.links || []

  const canvas = document.getElementById("replayCanvas")
  const info = document.getElementById("replayInfo")
  if(!canvas || !info) return

  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  const ctx = canvas.getContext("2d")
  ctx.setTransform(dpr,0,0,dpr,0,0)
  ctx.clearRect(0,0,rect.width,rect.height)

  const event = events[index]
  const t = event?.elapsedMs || 0

  const visibleLabels = new Set()

  events.slice(0, index + 1).forEach(e => {
    if(e.label) visibleLabels.add(e.label)
    if(e.source) visibleLabels.add(e.source)
    if(e.target) visibleLabels.add(e.target)
  })

  const visibleNodes = nodes.filter(n => visibleLabels.has(n.label) || index >= events.length - 1)

  const scaleX = rect.width / Math.max(1, document.getElementById("zone")?.clientWidth || rect.width)
  const scaleY = rect.height / Math.max(1, document.getElementById("zone")?.clientHeight || rect.height)

  const visibleLinks = links.filter(l => {
    const a = visibleNodes.find(n => n.id === l.a)
    const b = visibleNodes.find(n => n.id === l.b)
    return a && b
  })

  visibleLinks.forEach(l => {
    const a = visibleNodes.find(n => n.id === l.a)
    const b = visibleNodes.find(n => n.id === l.b)
    if(!a || !b) return

    ctx.beginPath()
    ctx.moveTo(a.x * scaleX, a.y * scaleY)
    ctx.lineTo(b.x * scaleX, b.y * scaleY)
    ctx.strokeStyle = "rgba(0,0,0,.45)"
    ctx.lineWidth = l.weight || 3
    ctx.lineCap = "round"
    ctx.stroke()
  })

  visibleNodes.forEach(n => {
    const x = n.x * scaleX
    const y = n.y * scaleY
    const emoji = typeof getEmoji === "function" ? getEmoji(n.label, n.family) : "•"

    ctx.beginPath()
    ctx.arc(x, y, 18, 0, Math.PI*2)
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.font = "20px system-ui"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(emoji, x, y)
  })

  const label = event
    ? `${event.elapsedLabel || formatElapsed(t)} · ${event.type || "événement"} ${event.label ? "· " + event.label : ""}`
    : "Aucun événement"

  info.textContent = label
}

function openReplayModal(){
  let modal = document.getElementById("replayModal")

  if(!modal){
    modal = document.createElement("div")
    modal.id = "replayModal"
    modal.innerHTML = `
      <div class="replay-modal-card">
        <div class="replay-modal-head">
          <h3>Dynamique du tissage</h3>
          <button id="replayModalClose" type="button">×</button>
        </div>

        <canvas id="replayModalCanvas"></canvas>
        <input id="replayModalSlider" type="range" min="0" value="0">
        <div id="replayModalInfo">—</div>
      </div>
    `
    document.body.appendChild(modal)

    document.getElementById("replayModalClose").onclick = closeReplayModal
    modal.addEventListener("click", e => {
      if(e.target.id === "replayModal") closeReplayModal()
    })
  }

  const events = window.BDR.session?.events || []
  const slider = document.getElementById("replayModalSlider")
  slider.max = Math.max(events.length - 1, 0)
  slider.value = Math.max(events.length - 1, 0)
  slider.oninput = () => drawReplayModal(Number(slider.value))

  modal.classList.add("visible")
  drawReplayModal(Number(slider.value))
}

function closeReplayModal(){
  const modal = document.getElementById("replayModal")
  if(modal) modal.classList.remove("visible")
}

function drawReplayModal(index){
  const s = window.BDR.session
  if(!s) return

  const events = s.events || []
  const nodes = s.active || []
  const links = s.links || []

  const canvas = document.getElementById("replayModalCanvas")
  const info = document.getElementById("replayModalInfo")
  if(!canvas || !info) return

  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  const ctx = canvas.getContext("2d")
  ctx.setTransform(dpr,0,0,dpr,0,0)
  ctx.clearRect(0,0,rect.width,rect.height)

  const event = events[index]

  const visibleLabels = new Set()
  events.slice(0, index + 1).forEach(e => {
    if(e.label) visibleLabels.add(e.label)
    if(e.source) visibleLabels.add(e.source)
    if(e.target) visibleLabels.add(e.target)
  })

  const visibleNodes = nodes.filter(n =>
    visibleLabels.has(n.label) || index >= events.length - 1
  )

  const zoneEl = document.getElementById("zone")
  const scaleX = rect.width / Math.max(1, zoneEl?.clientWidth || rect.width)
  const scaleY = rect.height / Math.max(1, zoneEl?.clientHeight || rect.height)

  links.forEach(l => {
    const a = visibleNodes.find(n => n.id === l.a)
    const b = visibleNodes.find(n => n.id === l.b)
    if(!a || !b) return

    ctx.beginPath()
    ctx.moveTo(a.x * scaleX, a.y * scaleY)
    ctx.lineTo(b.x * scaleX, b.y * scaleY)
    ctx.strokeStyle = "rgba(0,0,0,.45)"
    ctx.lineWidth = l.weight || 3
    ctx.lineCap = "round"
    ctx.stroke()
  })

  visibleNodes.forEach(n => {
    const x = n.x * scaleX
    const y = n.y * scaleY
    const emoji = typeof getEmoji === "function" ? getEmoji(n.label, n.family) : "•"

    ctx.beginPath()
    ctx.arc(x, y, 19, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.font = "20px system-ui"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(emoji, x, y)
  })

  info.textContent = event
    ? `${event.elapsedLabel || ""} · ${event.type || ""} ${event.label ? "· " + event.label : ""}`
    : "Aucun événement"
}






function renderSummary(){
  const s = window.BDR.session
  const nodes = s.active || []
  const links = s.links || []
  const notes = s.personalNotes || []

  const sorted = [...nodes]
    .map(n => ({ ...n, score: n.resonance ?? 0 }))
    .sort((a,b) => b.score - a.score)
    .slice(0,4)

  const degree = {}
  links.forEach(l => {
    degree[l.source] = (degree[l.source] || 0) + 1
    degree[l.target] = (degree[l.target] || 0) + 1
  })

  const mostLinked = Object.entries(degree)
    .sort((a,b) => b[1] - a[1])
    .slice(0,4)

  $("summary").innerHTML = `
    <div class="summary-page">
      <div class="summary-topbar">
        <button class="summary-back" onclick="backToSession()">← Retour au tissage</button>
      </div>

      <section class="summary-hero">
        <h2>Mon tissage</h2>
        <p>Une trace de ce qui a résonné ici et maintenant.</p>
        <button onclick="openReplayModal()">Voir le replay</button>
      </section>

      <section class="summary-stats">
        <div>
          <b>${nodes.length}</b>
          <span>éléments</span>
        </div>
        <div>
          <b>${links.length}</b>
          <span>liens</span>
        </div>
        <div>
          <b>${notes.length}</b>
          <span>notes</span>
        </div>
      </section>

      <section class="summary-card">
        <h3>Ce qui ressort</h3>
        ${
          sorted.length
            ? `<ul class="summary-list">${sorted.map(n => `<li>${escapeHtml(n.label)}</li>`).join("")}</ul>`
            : "<p class='muted'>Aucun élément central pour l’instant.</p>"
        }
      </section>

      <section class="summary-card">
        <h3>Connexions fortes</h3>
        ${
          mostLinked.length
            ? `<ul class="summary-list">${mostLinked.map(([label,count]) => `<li>${escapeHtml(label)} <span>${count} lien(s)</span></li>`).join("")}</ul>`
            : "<p class='muted'>Aucun lien tissé.</p>"
        }
      </section>

      <section class="summary-card summary-notes">
        <h3>Mes notes</h3>
        ${
          notes.length
            ? `<ul class="summary-list">${notes.map(n => `<li><b>${escapeHtml(n.label)}</b><br>${escapeHtml(n.text)}</li>`).join("")}</ul>`
            : "<p class='muted'>Aucune note ajoutée.</p>"
        }
      </section>

      <section class="summary-card">
        <h3>Lecture prudente</h3>
        <p class="muted">
          Ce tissage ne dit pas ce que je suis.
          Il montre comment cette expérience a résonné pour moi.
        </p>
      </section>

      <section class="summary-actions">
        <button onclick="downloadJson()">Télécharger mes données</button>
        <button class="danger" onclick="clearSession()">Effacer local</button>
      </section>

    </div>
  `

  showScreen("summary")
}
