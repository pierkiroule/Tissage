function esc(value) {
  return String(value || "")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

async function loadFiles() {
  const files = await fetch("/api/files").then(r => r.json())

  document.getElementById("count").textContent = files.length + " dépôt(s)"

  document.getElementById("rows").innerHTML = files.map(f => `
    <tr>
      <td>${esc(f.participantCode)}</td>
      <td>${esc(f.sessionCode)}</td>
      <td>${esc(f.activeWords)}</td>
      <td>${esc(f.duration)}</td>
      <td>${new Date(f.createdAt).toLocaleString()}</td>
      <td><a href="/api/file/${encodeURIComponent(f.filename)}" target="_blank">JSON</a></td>
    </tr>
  `).join("")
}

async function clearAll() {
  if (!confirm("Effacer tous les dépôts reçus ?")) return
  await fetch("/api/clear", { method: "DELETE" })
  loadFiles()
}

loadFiles()
setInterval(loadFiles, 5000)
