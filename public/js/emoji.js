window.BDR_EMOJIS = {
  "me détend": "🧘",
  "me tend": "😣",
  "m’alourdit": "⚓",
  "m’allège": "🪶",

  "m’apaise": "🌿",
  "m’inquiète": "😟",
  "me plaît": "🙂",
  "me dérange": "⚠️",

  "me calme": "😌",
  "me stimule": "⚡",
  "m’agite": "🌪️",
  "me ralentit": "🐢",

  "me relie": "🔗",
  "m’éloigne": "↔️",
  "m’immerge": "🌊",
  "me met à distance": "🫧"
}

function getEmoji(label, family){
  if(family === "perso") return "📝"
  return window.BDR_EMOJIS[label] || "•"
}
