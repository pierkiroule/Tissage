const $ = id => document.getElementById(id)

let openFamily = "corps"
let showRaw = false

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"))
  $("app").classList.remove("active")
  $("summary").classList.remove("active")

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
  const participant = $("participantCode").value.trim()
  const session = $("sessionCode").value.trim()

  if(!participant){
    alert("Indiquez un code participant.")
    return
  }

  window.BDR.session = createSession(participant, session)
  ensureSessionFields()
  saveSession()
  logEvent("session_start", { participantCode: participant, sessionCode: session })
  showApp()
}

function showApp(){
  showScreen("app")
  renderApp()
}

function renderApp(){
  renderFamilyTabs()
  renderChips()
  resizeCompass()
  renderBubbles()
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
  if(!window.BDR.session){
    alert("Aucune session active.")
    return
  }

  const ok = confirm("Voir votre tissage ?")
  if(!ok) return

  logEvent("view_summary")
  saveSession()
  renderSummary()
}

function backToSession(){
  if(!window.BDR.session) return
  logEvent("back_to_session")
  showApp()
}

function renderSummary(){
  const report = buildParticipantReport()
  const data = payload()

  if(!showRaw){
    $("summary").innerHTML = `
      <button onclick="backToSession()">← Retour au tissage</button>
      <h2>Ce que je peux observer dans mon tissage</h2>

      <div class="box">
        <div class="metric"><span>Durée</span><b>${report.duration}</b></div>
        <div class="metric"><span>Mots choisis</span><b>${report.activeWords}</b></div>
        <div class="metric"><span>Liens créés</span><b>${report.links}</b></div>
        <div class="metric"><span>Notes</span><b>${report.notesCount}</b></div>
      </div>

      <div class="box">
        <h3>Ce qui a le plus résonné</h3>
        ${report.centralWords.map(w => `<p>${escapeHtml(w.label)}</p>`).join("") || "<p>Aucun mot.</p>"}
      </div>

      <div class="box">
        <h3>Ce qui s’est le plus relié</h3>
        ${report.mostLinkedWords.map(([k,v]) => `<p>${escapeHtml(k)} (${v})</p>`).join("") || "<p>Aucun lien.</p>"}
      </div>

      ${report.notes.length ? `
        <div class="box">
          <h3>Mes notes</h3>
          ${report.notes.map(n => `<p><b>${escapeHtml(n.label)}</b> — ${escapeHtml(n.text)}</p>`).join("")}
        </div>
      ` : ""}

      <div class="box">
        <p>Ce tissage ne dit pas ce que je suis. Il montre comment cette expérience a résonné pour moi, ici et maintenant.</p>
      </div>

      <div class="box">
        <button onclick="toggleRaw()">Voir les données</button>
        <button onclick="downloadJson()">Télécharger mes données</button>
        <button class="danger" onclick="clearSession()">Effacer local</button>
        <p id="sendStatus"></p>
      </div>
    `
  } else {
    $("summary").innerHTML = `
      <button onclick="backToSession()">← Retour au tissage</button>
      <h2>Données brutes</h2>
      <div class="box"><pre>${JSON.stringify(data, null, 2)}</pre></div>
      <div class="box"><button onclick="toggleRaw()">Retour synthèse</button></div>
    `
  }

  showScreen("summary")
}

function toggleRaw(){
  showRaw = !showRaw
  renderSummary()
}

function bindUI(){
  $("startBtn").onclick = startSession
  $("noteBtn").onclick = addNote

  const closeBtn = $("closeSessionBtn")
  if(closeBtn) closeBtn.onclick = goToSummary

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

function showTip(text, duration=3000){
  const el = document.getElementById("tip")
  if(!el) return

  el.textContent = text
  el.classList.remove("hidden")

  setTimeout(()=>{
    el.classList.add("hidden")
  }, duration)
}

function initTips(){
  // au démarrage
  setTimeout(()=> showTip("Touchez des mots"), 800)

  // si aucune interaction
  setTimeout(()=>{
    if(window.BDR.session && window.BDR.session.events.length < 3){
      showTip("Ajoutez une note 📝")
    }
  }, 6000)
}

document.addEventListener("DOMContentLoaded", ()=>{
  initTips()
})


function toggleHelp(){
  const panel = document.getElementById("helpPanel")
  if(!panel) return

  panel.classList.toggle("hidden")
}

document.addEventListener("DOMContentLoaded", () => {
  const first = !localStorage.getItem("bdr_help_seen")

  if(first){
    const panel = document.getElementById("helpPanel")
    if(panel){
      panel.classList.remove("hidden")
    }
    localStorage.setItem("bdr_help_seen", "1")
  }

  const btn = document.getElementById("helpBtn")
  if(btn){
    btn.onclick = toggleHelp
  }
})




document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("helpBtn")
  if(btn) btn.onclick = toggleHelp
})
