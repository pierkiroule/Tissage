function makeSummary(){
  const active = window.BDR.session.active || []

  active.forEach(b => Object.assign(b, measures(b)))

  const avg = key => {
    if(!active.length) return 0
    return +(active.reduce((s,b)=>s+(+b[key]||0),0)/active.length).toFixed(3)
  }

  return {
    durationMs:getElapsedMs(),
    durationLabel:formatElapsed(getElapsedMs()),
    activeWords:active.length,
    links:window.BDR.session.links?.length || 0,
    notes:(window.BDR.session.personalNotes||[]).length,
    valenceMean:avg("valence"),
    activationMean:avg("activation"),
    resonanceMean:avg("resonance")
  }
}

function buildLongitudinal(){
  const s = window.BDR.session

  return {
    timeline: s.events.map(e => ({
      t:e.elapsedMs,
      type:e.type,
      label:e.label || "",
      family:e.family || "",
      x:e.x || "",
      y:e.y || "",
      valence:e.valence || "",
      activation:e.activation || "",
      resonance:e.resonance || ""
    })),

    bubbles: s.active.map(b => ({
      id:b.id,
      label:b.label,
      family:b.family,
      isNote:!!b.noteText,
      noteText:b.noteText || "",
      x:b.x,
      y:b.y,
      ...measures(b)
    })),

    links: (s.links||[]).map(l => ({
      source:l.source,
      target:l.target,
      elapsedMs:l.elapsedMs
    })),

    notes: (s.personalNotes||[]).map(n => ({
      label:n.label,
      text:n.text,
      elapsedMs:n.elapsedMs
    }))
  }
}

function payload(){
  const s = window.BDR.session

  return {
    meta:{
      app:s.app,
      version:s.version,
      participant:s.participantCode,
      session:s.sessionCode,
      startedAt:s.createdAt,
      exportedAt:now(),
      durationMs:getElapsedMs()
    },

    summary:makeSummary(),
    longitudinal:buildLongitudinal(),
    raw:s
  }
}

function downloadJson(){
  const blob = new Blob([JSON.stringify(payload(),null,2)],{type:"application/json"})
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")

  const s = window.BDR.session
  a.href = url
  a.download = `BDR_${s.sessionCode}_${s.participantCode}.json`
  a.click()

  URL.revokeObjectURL(url)
}

async function sendToAnimator(){
  const status = document.getElementById("sendStatus")
  status.textContent = "Envoi..."

  try{
    const res = await fetch("/upload-json",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload())
    })

    const data = await res.json()

    status.textContent = data.ok ? "OK" : "Erreur"
  }catch{
    status.textContent = "Connexion impossible"
  }
}

function buildParticipantReport(){
  const data = payload()

  const bubbles = data.longitudinal.bubbles
  const links = data.longitudinal.links
  const notes = data.longitudinal.notes

  const centralWords = [...bubbles]
    .sort((a,b) => b.resonance - a.resonance)
    .slice(0,3)

  const degree = {}

  links.forEach(l=>{
    degree[l.source] = (degree[l.source]||0)+1
    degree[l.target] = (degree[l.target]||0)+1
  })

  const mostLinkedWords = Object.entries(degree)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3)

  return {
    duration: data.summary.durationLabel,
    activeWords: data.summary.activeWords,
    links: data.summary.links,
    notesCount: data.summary.notes,
    centralWords,
    mostLinkedWords,
    notes
  }
}
