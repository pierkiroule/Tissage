from pathlib import Path

path = Path("public/js/app.js")
text = path.read_text()

start = text.index("function renderLivingResonanceMap")

new = r'''async function renderLivingResonanceMap(nodes, links, events = []){
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
'''

path.write_text(text[:start] + new)
