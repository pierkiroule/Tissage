window.BDR = { session:null }

function uid(){
  return Math.random().toString(36).slice(2,10)
}

function now(){
  return new Date().toISOString()
}

function createSession(participantCode, sessionCode){
  return {
    app:"Mon Tissage Résonances",
    version:"0.9",
    participantCode,
    sessionCode,
    startedAt:Date.now(),
    createdAt:now(),
    active:[],
    links:[],
    personalNotes:[],
    personalWords:[],
    noteCount:0,
    comments:{synthese:"", syntheseList:[]},
    events:[]
  }
}

function saveSession(){
  localStorage.setItem(window.BDR_STORAGE_KEY, JSON.stringify(window.BDR.session))
}

function loadSession(){
  const saved = localStorage.getItem(window.BDR_STORAGE_KEY)
  if(!saved) return null

  try {
    const s = JSON.parse(saved)
    if(!s.links) s.links = []
    if(!s.personalNotes) s.personalNotes = []
    if(!s.personalWords) s.personalWords = []
    if(!s.noteCount) s.noteCount = s.personalNotes.length || 0
    if(!s.comments) s.comments = {synthese:"", syntheseList:[]}
    if(!Array.isArray(s.comments.syntheseList)) s.comments.syntheseList = []
    return s
  } catch {
    return null
  }
}

function clearSession(){
  localStorage.removeItem(window.BDR_STORAGE_KEY)
  location.reload()
}

function showSave(){
  const el = document.getElementById("saveBadge")
  if(!el) return

  el.classList.add("visible")

  setTimeout(()=>{
    el.classList.remove("visible")
  }, 600)
}

function logEvent(type,data={}){
  const s = window.BDR.session
  if(!s) return

  s.events.push({
    type,
    at:now(),
    elapsedMs:getElapsedMs(),
    elapsedLabel:formatElapsed(getElapsedMs()),
    ...data
  })

  saveSession()
  showSave()
  showChrono()
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
}
