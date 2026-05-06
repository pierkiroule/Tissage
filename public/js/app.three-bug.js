const $ = id => document.getElementById(id)

let openFamily = "corps"
let activeMainTab = "accueil"
let activeQrStep = null
const QR_STEPS_TOTAL = 10

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
  if(!Array.isArray(s.unlockedQrSteps)) s.unlockedQrSteps = []
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
  renderQrSteps()
  renderFamilyTabs()
  renderChips()
  resizeCompass()
  renderBubbles()
  renderInlineSummary()
}

function renderQrSteps(){
  const host = $("qrStepsCircle")
  if(!host || !window.BDR?.session) return

  const unlocked = new Set(window.BDR.session.unlockedQrSteps || [])
  host.innerHTML = Array.from({ length: QR_STEPS_TOTAL }, (_, i) => {
    const step = i + 1
    const angle = ((Math.PI * 2) / QR_STEPS_TOTAL) * i - Math.PI / 2
    const x = 50 + Math.cos(angle) * 40
    const y = 50 + Math.sin(angle) * 40
    const isUnlocked = unlocked.has(step)
    return `
      <button
        type="button"
        class="qr-step ${isUnlocked ? "unlocked" : "locked"}"
        style="left:${x}%;top:${y}%;"
        onclick="openQrStep(${step})"
        aria-label="Étape ${step}"
      >${isUnlocked ? "👂" : `<span class="qr-step-number">${step}</span>`}</button>
    `
  }).join("")
}

function openQrStep(step){
  activeQrStep = step
  const modal = $("qrModal")
  const title = $("qrModalTitle")
  const iframe = $("qrIframe")
  if(title) title.textContent = `Étape ${step} · Scanner un QR code`
  if(iframe) iframe.src = "about:blank"
  if(modal) modal.classList.remove("hidden")
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

  if(activeQrStep !== null){
    const unlocked = new Set(window.BDR.session.unlockedQrSteps || [])
    unlocked.add(activeQrStep)
    window.BDR.session.unlockedQrSteps = Array.from(unlocked).sort((a,b) => a - b)
    logEvent("qr_step_unlocked", { step: activeQrStep, url: safe })
    saveSession()
    renderQrSteps()
  }
}

function closeQrModal(){
  const modal = $("qrModal")
  const iframe = $("qrIframe")
  if(iframe) iframe.src = "about:blank"
  if(modal) modal.classList.add("hidden")
  activeQrStep = null
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
    const zoneRect = $("zone")?.getBoundingClientRect()
    const hasValidCenter = center.max > 0
    const centerX = hasValidCenter ? center.x : (zoneRect?.width || 0) / 2
    const centerY = hasValidCenter ? center.y : (zoneRect?.height || 0) / 2
    const maxRadius = hasValidCenter
      ? center.max
      : Math.min(zoneRect?.width || 0, zoneRect?.height || 0) * .55

    const angle = Math.random() * Math.PI * 2
    const r = maxRadius * .55

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
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r
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

  const zoneRect = $("zone")?.getBoundingClientRect()
  const hasValidCenter = center.max > 0
  const centerX = hasValidCenter ? center.x : (zoneRect?.width || 0) / 2
  const centerY = hasValidCenter ? center.y : (zoneRect?.height || 0) / 2

  window.BDR.session.personalNotes.push(note)

  window.BDR.session.active.push({
    id: uid(),
    label,
    family: "perso",
    custom: true,
    noteText: text,
    noteId: note.id,
    x: centerX,
    y: centerY
  })

  input.value = ""
  openFamily = "perso"

  logEvent("note_add", { label, text, noteId: note.id })
  saveSession()
  renderApp()
}

function goToSummary(){
  renderSummary()
}

function backToSession(){
  if(!window.BDR.session) return
  logEvent("back_to_session")
  showApp()
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
window.openQrStep = openQrStep

function renderInlineSummary(){
  const host = $("syntheseInline")
  if(!host || !window.BDR?.session) return

  const s = window.BDR.session
  const nodes = s.active || []
  const links = s.links || []
  const notes = s.personalNotes || []
  const events = s.events || []

  const possibleLinks = nodes.length > 1
    ? (nodes.length * (nodes.length - 1)) / 2
    : 0

  const density = possibleLinks
    ? Math.round((links.length / possibleLinks) * 100)
    : 0

  const densityLabel =
    density < 20 ? "Paysage aéré" :
    density < 50 ? "Paysage équilibré" :
    "Paysage dense"

  const centrality = {}

  links.forEach(l => {
    if(l.a) centrality[l.a] = (centrality[l.a] || 0) + 1
    if(l.b) centrality[l.b] = (centrality[l.b] || 0) + 1
  })

  const centralNodes = [...nodes]
    .sort((a,b) => (centrality[b.id] || 0) - (centrality[a.id] || 0))
    .slice(0,5)

  const isolatedNodes = nodes.filter(n =>
    !links.some(l => l.a === n.id || l.b === n.id)
  )

  const familyCounts = nodes.reduce((acc, n) => {
    acc[n.family] = (acc[n.family] || 0) + 1
    return acc
  }, {})

  const firstEvents = events.slice(0,5)
  const lastEvents = events.slice(-5)

  host.innerHTML = `
    <section class="summary-hero">
      <div class="summary-kicker">Cartographie résonante émergente</div>
      <h2>Paysage vivant de résonances</h2>
      <p class="summary-intro">
        Une visualisation des associations et transformations relationnelles
        émergentes pendant le parcours sonore.
      </p>
    </section>

    <section class="summary-card">
      <h3>Carte vivante</h3>
      <p class="muted">
        Une constellation animée du paysage résonant.
      </p>

      <div id="livingResonanceMap"></div>
    </section>


    <section class="summary-stats">
      <div><b>${nodes.length}</b><span>éléments</span></div>
      <div><b>${links.length}</b><span>liens</span></div>
      <div><b>${notes.length}</b><span>notes</span></div>
    </section>

    <section class="summary-section">
      <h2>Structure</h2>
      <p class="muted">La forme actuelle du paysage résonant.</p>

      <section class="summary-card">
        <h3>Densité relationnelle</h3>
        <div class="density-row">
          <div class="density-bar">
            <div class="density-fill" style="width:${density}%"></div>
          </div>
          <b>${density}%</b>
        </div>
        <p class="muted">${densityLabel}</p>
      </section>

      <section class="summary-card">
        <h3>Zones centrales</h3>
        ${
          centralNodes.length
            ? `<ul class="summary-list">${centralNodes.map(n => `
              <li>${escapeHtml(n.label)} <span>${centrality[n.id] || 0}</span></li>
            `).join("")}</ul>`
            : "<p class='muted'>Aucune centralité détectée.</p>"
        }
      </section>

      <section class="summary-card">
        <h3>Familles dominantes</h3>
        ${
          Object.keys(familyCounts).length
            ? `<ul class="summary-list">${Object.entries(familyCounts).map(([family,count]) => `
              <li>${escapeHtml(family)} <span>${count}</span></li>
            `).join("")}</ul>`
            : "<p class='muted'>Aucune famille dominante.</p>"
        }
      </section>

      <section class="summary-card">
        <h3>Zones isolées</h3>
        ${
          isolatedNodes.length
            ? `<ul class="summary-list">${isolatedNodes.map(n => `
              <li>${escapeHtml(n.label)}</li>
            `).join("")}</ul>`
            : "<p class='muted'>Aucune zone isolée.</p>"
        }
      </section>
    </section>

    <section class="summary-section">
      <h2>Processus</h2>
      <p class="muted">Les transformations significatives du parcours.</p>

      <section class="summary-card">
        <h3>Premiers mouvements</h3>
        ${
          firstEvents.length
            ? `<ul class="summary-list">${firstEvents.map(e => `
              <li><b>${escapeHtml(e.elapsedLabel || "—")}</b> <span>${escapeHtml(e.type || "événement")}</span></li>
            `).join("")}</ul>`
            : "<p class='muted'>Aucun mouvement enregistré.</p>"
        }
      </section>

      <section class="summary-card">
        <h3>Derniers mouvements</h3>
        ${
          lastEvents.length
            ? `<ul class="summary-list">${lastEvents.map(e => `
              <li><b>${escapeHtml(e.elapsedLabel || "—")}</b> <span>${escapeHtml(e.type || "événement")}</span></li>
            `).join("")}</ul>`
            : "<p class='muted'>Aucun mouvement enregistré.</p>"
        }
      </section>
    </section>

    <section class="summary-card">
      <h3>Lecture prudente</h3>
      <p class="muted">
        Ce paysage ne dit pas ce que je suis. Il montre comment certaines
        résonances se sont associées et transformées pendant l’expérience.
      </p>
    </section>

    <section class="summary-actions">
      <button onclick="downloadJson()">Télécharger mes données</button>
    </section>
  `
  renderLivingResonanceMap(nodes, links, events)
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
  const events = s.events || []

  const familyCounts = nodes.reduce((acc, n) => {
    acc[n.family] = (acc[n.family] || 0) + 1
    return acc
  }, {})

  const possibleLinks = nodes.length > 1
    ? (nodes.length * (nodes.length - 1)) / 2
    : 0

  const density = possibleLinks
    ? Math.round((links.length / possibleLinks) * 100)
    : 0

  const densityLabel =
    density < 20 ? "Paysage aéré" :
    density < 50 ? "Paysage équilibré" :
    "Paysage dense"

  const centrality = {}

  links.forEach(l => {
    if(l.a) centrality[l.a] = (centrality[l.a] || 0) + 1
    if(l.b) centrality[l.b] = (centrality[l.b] || 0) + 1
  })

  const centralNodes = [...nodes]
    .sort((a,b) => (centrality[b.id] || 0) - (centrality[a.id] || 0))
    .slice(0,5)

  const isolatedNodes = nodes.filter(n =>
    !links.some(l => l.a === n.id || l.b === n.id)
  )

  const firstEvents = events.slice(0,5)
  const lastEvents = events.slice(-5)

  $("summary").innerHTML = `
    <div class="summary-page">
      <div class="summary-topbar">
        <button class="summary-back" onclick="backToSession()">← Retour au tissage</button>
      </div>

      <section class="summary-hero">
        <div class="summary-kicker">Cartographie résonante émergente</div>
        <h2>Paysage vivant de résonances</h2>
        <p class="summary-intro">
          Une visualisation des associations et transformations relationnelles
          émergentes pendant le parcours sonore.
        </p>
        <div class="summary-hero-actions">
          <button onclick="openReplayModal()">Voir les mouvements du paysage</button>
        </div>
      </section>

      <section class="summary-stats">
        <div><b>${nodes.length}</b><span>éléments</span></div>
        <div><b>${links.length}</b><span>liens</span></div>
        <div><b>${notes.length}</b><span>notes</span></div>
      </section>

      <section class="summary-section">
        <h2>Structure</h2>
        <p class="muted">La forme actuelle du paysage résonant.</p>

        <section class="summary-card">
          <h3>Densité relationnelle</h3>
          <div class="density-row">
            <div class="density-bar">
              <div class="density-fill" style="width:${density}%"></div>
            </div>
            <b>${density}%</b>
          </div>
          <p class="muted">${densityLabel}</p>
        </section>

        <section class="summary-card">
          <h3>Zones centrales</h3>
          ${
            centralNodes.length
              ? `<ul class="summary-list">${centralNodes.map(n => `
                <li>${escapeHtml(n.label)} <span>${centrality[n.id] || 0}</span></li>
              `).join("")}</ul>`
              : "<p class='muted'>Aucune centralité détectée.</p>"
          }
        </section>

        <section class="summary-card">
          <h3>Familles dominantes</h3>
          ${
            Object.keys(familyCounts).length
              ? `<ul class="summary-list">${Object.entries(familyCounts).map(([family,count]) => `
                <li>${escapeHtml(family)} <span>${count}</span></li>
              `).join("")}</ul>`
              : "<p class='muted'>Aucune famille dominante.</p>"
          }
        </section>

        <section class="summary-card">
          <h3>Zones isolées</h3>
          ${
            isolatedNodes.length
              ? `<ul class="summary-list">${isolatedNodes.map(n => `
                <li>${escapeHtml(n.label)}</li>
              `).join("")}</ul>`
              : "<p class='muted'>Aucune zone isolée.</p>"
          }
        </section>
      </section>

      <section class="summary-section">
        <h2>Processus</h2>
        <p class="muted">Les transformations significatives du parcours.</p>

        <section class="summary-card">
          <h3>Premiers mouvements</h3>
          ${
            firstEvents.length
              ? `<ul class="summary-list">${firstEvents.map(e => `
                <li><b>${escapeHtml(e.elapsedLabel || "—")}</b> <span>${escapeHtml(e.type || "événement")}</span></li>
              `).join("")}</ul>`
              : "<p class='muted'>Aucun mouvement enregistré.</p>"
          }
        </section>

        <section class="summary-card">
          <h3>Derniers mouvements</h3>
          ${
            lastEvents.length
              ? `<ul class="summary-list">${lastEvents.map(e => `
                <li><b>${escapeHtml(e.elapsedLabel || "—")}</b> <span>${escapeHtml(e.type || "événement")}</span></li>
              `).join("")}</ul>`
              : "<p class='muted'>Aucun mouvement enregistré.</p>"
          }
        </section>
      </section>

      <section class="summary-card">
        <h3>Lecture prudente</h3>
        <p class="muted">
          Ce paysage ne dit pas ce que je suis. Il montre comment certaines
          résonances se sont associées et transformées pendant l’expérience.
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

async function renderLivingResonanceMap(nodes, links, events = []){
  const host = document.getElementById("livingResonanceMap")
  if(!host) return

  host.innerHTML = ""

  if(window.__resonanceViz?.dispose){
    window.__resonanceViz.dispose()
  }

  const THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js")

  const width = host.clientWidth || 360
  const height = 280

  const zone = document.getElementById("zone")
  const zoneW = Math.max(1, zone?.clientWidth || width)
  const zoneH = Math.max(1, zone?.clientHeight || height)

  const familyColor = {
    corps: 0x38bdf8,
    emotion: 0xf472b6,
    emotions: 0xf472b6,
    pensee: 0xa78bfa,
    pensées: 0xa78bfa,
    relation: 0x4ade80,
    relations: 0x4ade80,
    perso: 0xfacc15
  }

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000)
  camera.position.z = 220

  const renderer = new THREE.WebGLRenderer({
    antialias:true,
    alpha:true
  })

  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  host.appendChild(renderer.domElement)

  const centrality = {}

  links.forEach(l => {
    if(l.a) centrality[l.a] = (centrality[l.a] || 0) + 1
    if(l.b) centrality[l.b] = (centrality[l.b] || 0) + 1
  })

  const toWorld = n => {
    const x = ((n.x || zoneW / 2) / zoneW - .5) * 260
    const y = -(((n.y || zoneH / 2) / zoneH - .5) * 170)
    return { x, y }
  }

  const points = nodes.slice(0, 22).map((n, i) => {
    const p = toWorld(n)
    const c = centrality[n.id] || 0
    const color = new THREE.Color(familyColor[n.family] || 0xffffff)

    return {
      ...n,
      wx:p.x,
      wy:p.y,
      wz:Math.sin(i) * 12,
      color,
      centrality:c,
      radius:7 + Math.min(c * 3, 12),
      phase:Math.random() * Math.PI * 2
    }
  })

  const group = new THREE.Group()
  scene.add(group)

  // Fond étoilé doux
  const starGeometry = new THREE.BufferGeometry()
  const starCount = 160
  const starPositions = []

  for(let i=0; i<starCount; i++){
    starPositions.push(
      (Math.random() - .5) * 340,
      (Math.random() - .5) * 220,
      (Math.random() - .5) * 120
    )
  }

  starGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3)
  )

  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size:1.8,
      color:0xffffff,
      transparent:true,
      opacity:.24,
      depthWrite:false
    })
  )

  group.add(stars)

  // Nœuds
  const nodeMeshes = new Map()

  points.forEach((p, i) => {
    const nodeGroup = new THREE.Group()
    nodeGroup.position.set(p.wx, p.wy, p.wz)

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius * 1.85, 32, 32),
      new THREE.MeshBasicMaterial({
        color:p.color,
        transparent:true,
        opacity:.16,
        blending:THREE.AdditiveBlending,
        depthWrite:false
      })
    )

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius, 32, 32),
      new THREE.MeshBasicMaterial({
        color:0xffffff,
        transparent:true,
        opacity:.92
      })
    )

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius * 1.15, 32, 32),
      new THREE.MeshBasicMaterial({
        color:p.color,
        transparent:true,
        opacity:.38,
        blending:THREE.AdditiveBlending,
        depthWrite:false
      })
    )

    nodeGroup.add(halo)
    nodeGroup.add(glow)
    nodeGroup.add(core)

    group.add(nodeGroup)
    nodeMeshes.set(p.id, { group:nodeGroup, halo, glow, core, data:p, index:i })
  })

  // Courants lumineux entre bulles
  const currentMeshes = []

  links.forEach((l, i) => {
    const a = points.find(p => p.id === l.a)
    const b = points.find(p => p.id === l.b)
    if(!a || !b) return

    const mid = new THREE.Vector3(
      (a.wx + b.wx) / 2,
      (a.wy + b.wy) / 2 + 18 + (i % 3) * 8,
      22
    )

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(a.wx, a.wy, a.wz),
      mid,
      new THREE.Vector3(b.wx, b.wy, b.wz)
    )

    const geometry = new THREE.TubeGeometry(curve, 48, 1.6, 8, false)

    const material = new THREE.MeshBasicMaterial({
      color:a.color.clone().lerp(b.color, .5),
      transparent:true,
      opacity:.42,
      blending:THREE.AdditiveBlending,
      depthWrite:false
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData = { phase:Math.random() * 10 }

    group.add(mesh)
    currentMeshes.push(mesh)
  })

  // Particules de flux
  const particleGeometry = new THREE.BufferGeometry()
  const particleCount = Math.max(80, links.length * 45)
  const particlePositions = []
  const particleColors = []

  for(let i=0; i<particleCount; i++){
    const p = points[i % Math.max(points.length, 1)]
    particlePositions.push(
      (p?.wx || 0) + (Math.random() - .5) * 40,
      (p?.wy || 0) + (Math.random() - .5) * 30,
      (Math.random() - .5) * 40
    )

    const color = p?.color || new THREE.Color(0xffffff)
    particleColors.push(color.r, color.g, color.b)
  }

  particleGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(particlePositions, 3)
  )

  particleGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(particleColors, 3)
  )

  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      size:2.8,
      vertexColors:true,
      transparent:true,
      opacity:.58,
      blending:THREE.AdditiveBlending,
      depthWrite:false
    })
  )

  group.add(particles)

  let frame = 0
  let disposed = false

  function animate(){
    if(disposed) return

    frame += 0.012

    group.rotation.z = Math.sin(frame * .35) * .035
    group.rotation.x = Math.sin(frame * .22) * .08

    stars.rotation.z += .0008

    nodeMeshes.forEach(({ group, halo, glow, data, index }) => {
      const pulse = Math.sin(frame * 3 + data.phase) * .5 + .5
      const driftX = Math.sin(frame * 1.2 + index) * (2 + data.centrality)
      const driftY = Math.cos(frame * 1.1 + index) * (2 + data.centrality)

      group.position.x = data.wx + driftX
      group.position.y = data.wy + driftY
      group.position.z = data.wz + Math.sin(frame * 2 + index) * 5

      halo.scale.setScalar(1 + pulse * .22)
      glow.scale.setScalar(1 + pulse * .12)
      glow.material.opacity = .22 + pulse * .32
      halo.material.opacity = .08 + pulse * .22
    })

    currentMeshes.forEach((m, i) => {
      const pulse = Math.sin(frame * 2.4 + m.userData.phase) * .5 + .5
      m.material.opacity = .18 + pulse * .48
      m.scale.setScalar(1 + pulse * .025)
    })

    const arr = particles.geometry.attributes.position.array

    for(let i=0; i<arr.length; i+=3){
      arr[i] += Math.sin(frame + i) * .045
      arr[i + 1] += Math.cos(frame * 1.2 + i) * .045
      arr[i + 2] += Math.sin(frame * .8 + i) * .03
    }

    particles.geometry.attributes.position.needsUpdate = true

    renderer.render(scene, camera)
    requestAnimationFrame(animate)
  }

  animate()

  window.__resonanceViz = {
    dispose(){
      disposed = true
      renderer.dispose()
      host.innerHTML = ""
    }
  }
}
