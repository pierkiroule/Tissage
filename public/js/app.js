const $ = id => document.getElementById(id)

let openFamily = "corps"
let activeMainTab = "accueil"
let activeQrStep = null
const QR_STEPS_TOTAL = 10
let tipTimeout = null

const MENU_TIPS = {
  accueil: {
    title: "Bienvenue 👋",
    text: "Ici, vous voyez le principe. Ensuite allez sur 🎧 pour le parcours QR, puis 🕸️ pour tisser vos mots, et enfin 📄 pour lire votre synthèse."
  },
  ecouter: {
    title: "🎧 Outil QR code / parcours",
    text: "Touchez un numéro, puis « Scanner le QR code ». Si besoin, collez l’URL. Quand l’étape est validée, le numéro devient 👂 : cela signifie que l’étape du parcours est reliée à votre session."
  },
  tisser: {
    title: "🕸️ Outil tissage de réseau",
    text: "1) Touchez des mots-émojis pour les afficher. 2) Faites se toucher 2 bulles pour les relier. 3) Refaites toucher les mêmes bulles pour délier. 4) Retouchez un mot dans la liste pour enlever sa bulle."
  },
  synthetiser: {
    title: "📄 Lire la synthèse écho-évaluative",
    text: "Lisez ce que votre carte raconte. Regardez les liens, les mots forts et les tendances. Ensuite, ajoutez votre avis personnel en commentaire final pour enrichir la synthèse."
  }
}

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
  showMenuTip(tab)
}

function closeMenuTip(){
  if(tipTimeout){
    clearTimeout(tipTimeout)
    tipTimeout = null
  }
  const tip = $("menuTip")
  if(tip) tip.classList.add("hidden")
}

function showMenuTip(tab){
  const tipData = MENU_TIPS[tab]
  const tip = $("menuTip")
  if(!tip || !tipData) return
  $("menuTipTitle").textContent = tipData.title
  $("menuTipText").textContent = tipData.text
  tip.classList.remove("hidden")

  if(tipTimeout) clearTimeout(tipTimeout)
  tipTimeout = setTimeout(() => closeMenuTip(), 5000)
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
  $("closeMenuTipBtn").onclick = closeMenuTip
  $("menuTip").onclick = e => {
    if(e.target.id === "menuTip") closeMenuTip()
  }

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


function getSyntheseComments(){
  const comments = window.BDR.session?.comments?.syntheseList
  return Array.isArray(comments) ? comments : []
}

function addSyntheseComment(text){
  const s = window.BDR.session
  if(!s) return
  if(!s.comments) s.comments = {}
  if(!Array.isArray(s.comments.syntheseList)) s.comments.syntheseList = []

  s.comments.syntheseList.unshift({
    id: uid(),
    text: text.trim(),
    at: now()
  })

  s.comments.synthese = text.trim()
  saveSession()
  showSave()
}

function formatCommentDate(iso){
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day:'2-digit',
      month:'2-digit',
      hour:'2-digit',
      minute:'2-digit'
    })
  } catch {
    return '—'
  }
}

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

    <section class="summary-card summary-feedback">
      <h3>Votre commentaire sur la synthèse</h3>
      <p class="muted">Déposer votre commentaire sur cette synthèse de votre expérience. Que vous apprend cette expérience d’écoute ?</p>
      <form id="syntheseCommentForm" class="summary-comment-form">
        <input id="syntheseCommentInput" type="text" maxlength="280" placeholder="Votre commentaire..." required>
        <button type="submit">Ajouter</button>
      </form>
      <ul class="summary-list summary-comment-list">
        ${getSyntheseComments().length
          ? getSyntheseComments().map(c => `<li><b>${formatCommentDate(c.at)}</b><span>${escapeHtml(c.text)}</span></li>`).join("")
          : "<li class='muted'>Aucun commentaire pour le moment.</li>"
        }
      </ul>
    </section>

    <section class="summary-card replay-card">
      <h3>Replay accéléré</h3>
      <p class="muted">Chaque instant horodaté devient une frame du défilé du timing.</p>
      <canvas id="replayCanvas"></canvas>
      <input id="replaySlider" type="range" min="0" value="0" step="1" aria-label="Slider replay">
      <div id="replayInfo">—</div>
      <button type="button" class="ghost" onclick="openReplayModal()">Ouvrir en plein écran</button>
    </section>

    <section class="summary-actions">
      <button onclick="downloadJson()">Télécharger mes données</button>
    </section>
  `

  const commentForm = document.getElementById('syntheseCommentForm')
  const commentInput = document.getElementById('syntheseCommentInput')
  if(commentForm && commentInput){
    commentForm.onsubmit = e => {
      e.preventDefault()
      const text = commentInput.value.trim()
      if(!text) return
      addSyntheseComment(text)
      renderInlineSummary()
    }
  }

  const slider = document.getElementById('replaySlider')
  if(slider){
    slider.max = Math.max((events.length || 1) - 1, 0)
    slider.value = slider.max
  }

  renderLivingResonanceMap(nodes, links)
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

function renderLivingResonanceMap(nodes, links){
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
