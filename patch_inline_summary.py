from pathlib import Path

path = Path("public/js/app.js")
text = path.read_text()

start = text.index("function renderInlineSummary(){")
end = text.index("function initReplay(){")

new = r'''function renderInlineSummary(){
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
}
'''

path.write_text(text[:start] + new + "\n\n" + text[end:])
