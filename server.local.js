import express from "express"
import cors from "cors"
import fs from "fs"
import path from "path"

const app = express()
const PORT = process.env.PORT || 3000
const DATA_DIR = "./data/uploads"

fs.mkdirSync(DATA_DIR, { recursive: true })

app.use(cors())
app.use(express.json({ limit: "10mb" }))

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  next()
})

app.get("/api/ping", (_, res) => {
  res.json({ ok: true, app: "BDR Collecteur" })
})
app.use(express.static("public"))

function safeName(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_")
}

function readJsonFile(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), "utf8"))
}

function listJsonFiles() {
  return fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"))
}

function toCsv(rows) {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  const esc = v => `"${String(v ?? "").replaceAll('"', '""')}"`
  return [
    headers.join(","),
    ...rows.map(row => headers.map(h => esc(row[h])).join(","))
  ].join("\n")
}

app.post("/upload-json", (req, res) => {
  const data = req.body
  const participant = safeName(data.participantCode)
  const session = safeName(data.sessionCode)
  const filename = `${Date.now()}_BDR_${session}_${participant}.json`

  fs.writeFileSync(
    path.join(DATA_DIR, filename),
    JSON.stringify(data, null, 2),
    "utf8"
  )

  res.json({ ok: true, filename })
})

app.get("/api/files", (_, res) => {
  const files = listJsonFiles().map(filename => {
    const filepath = path.join(DATA_DIR, filename)
    const stat = fs.statSync(filepath)

    let data = {}
    try { data = readJsonFile(filename) } catch {}

    return {
      filename,
      size: stat.size,
      createdAt: stat.birthtime,
      participantCode: data.participantCode || "",
      sessionCode: data.sessionCode || "",
      activeWords: data.activeWords?.length || 0,
      duration: data.summary?.durationLabel || ""
    }
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  res.json(files)
})

app.get("/api/file/:filename", (req, res) => {
  const filename = req.params.filename
  const filepath = path.join(DATA_DIR, filename)

  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "not found" })
    return
  }

  res.sendFile(path.resolve(filepath))
})

app.get("/api/export-longitudinal", (_, res) => {
  const rows = []

  for (const file of listJsonFiles()) {
    try {
      const data = readJsonFile(file)
      for (const item of data.active || []) {
        rows.push({
          session: data.sessionCode || "",
          participant: data.participantCode || "",
          word: item.label,
          family: item.family,
          custom: item.custom ? "yes" : "no",
          valence: item.valence,
          activation: item.activation,
          resonance: item.resonance,
          x: item.x,
          y: item.y
        })
      }
    } catch {}
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", "attachment; filename=BDR_donnees_mots.csv")
  res.send(toCsv(rows))
})

app.get("/api/export-events", (_, res) => {
  const rows = []

  for (const file of listJsonFiles()) {
    try {
      const data = readJsonFile(file)
      for (const ev of data.events || []) {
        rows.push({
          session: data.sessionCode || "",
          participant: data.participantCode || "",
          at: ev.at,
          elapsedMs: ev.elapsedMs,
          elapsedLabel: ev.elapsedLabel,
          type: ev.type,
          word: ev.label || "",
          category: ev.category || "",
          valence: ev.valence ?? "",
          activation: ev.activation ?? "",
          intensity: ev.intensity ?? "",
          x: ev.x ?? "",
          y: ev.y ?? ""
        })
      }
    } catch {}
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", "attachment; filename=BDR_evenements.csv")
  res.send(toCsv(rows))
})

app.get("/api/export-summary", (_, res) => {
  const rows = []

  for (const file of listJsonFiles()) {
    try {
      const data = readJsonFile(file)
      const s = data.summary || {}

      rows.push({
        session: data.sessionCode || "",
        participant: data.participantCode || "",
        durationMs: s.durationMs || "",
        durationLabel: s.durationLabel || "",
        activeWords: s.activeWords || 0,
        valenceMean: s.valenceMean ?? "",
        activationMean: s.activationMean ?? "",
        intensityMean: s.intensityMean ?? "",
        comment: data.comments?.synthese || ""
      })
    } catch {}
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", "attachment; filename=BDR_synthese.csv")
  res.send(toCsv(rows))
})

app.delete("/api/clear", (_, res) => {
  for (const file of fs.readdirSync(DATA_DIR)) {
    fs.unlinkSync(path.join(DATA_DIR, file))
  }
  res.json({ ok: true })
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BDR Collecteur : http://0.0.0.0:${PORT}`)
})
