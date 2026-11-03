// SPDX-License-Identifier: AGPL-3.0-only
// Kimodo BVH önizleyici: kemiklere bağlı kapsül "manken" + zemin + yörünge kamera
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Icon } from './icons'

export default function BvhViewer({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null)
  const ctl = useRef<{ action?: THREE.AnimationAction; duration: number }>({ duration: 0 })
  const [playing, setPlaying] = useState(true)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [err, setErr] = useState('')

  useEffect(() => {
    const el = host.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x07080c, 6, 18)
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100)
    camera.position.set(2.8, 1.5, 3.9)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.9, 0)
    controls.enableDamping = true

    scene.add(new THREE.HemisphereLight(0xffd9c2, 0x10121a, 1.6))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(3, 5, 2)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xff4f9a, 2.5)
    rim.position.set(-3, 2, -3)
    scene.add(rim)
    const grid = new THREE.GridHelper(20, 40, 0xff6a2b, 0x222634)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.35
    scene.add(grid)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.MeshBasicMaterial({ color: 0xff4f9a, transparent: true, opacity: 0.08 }))
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    let mixer: THREE.AnimationMixer | null = null
    let hips: THREE.Bone | null = null
    let disposed = false
    const clock = new THREE.Clock()

    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('BVH okunamadı (' + r.status + ')'))))
      .then((text) => {
        if (disposed) return
        const res = new BVHLoader().parse(text)
        const root = res.skeleton.bones[0]
        const rig = new THREE.Group()
        rig.add(root)
        scene.add(rig)
        // Birimden bağımsız: iskeleti dinlenme pozunda ölçüp ~1.75 m boya normalize et
        rig.updateMatrixWorld(true)
        const box = new THREE.Box3()
        const v = new THREE.Vector3()
        for (const b of res.skeleton.bones) box.expandByPoint(b.getWorldPosition(v))
        const H = Math.max(1e-3, box.max.y - box.min.y)
        const k = 1.75 / H
        rig.scale.setScalar(k)
        const u = H / 175 // kalınlıklar BVH birimine göre
        const mat = new THREE.MeshStandardMaterial({ color: 0xffd0e4, roughness: 0.45, metalness: 0.1, emissive: 0x5a1030, emissiveIntensity: 0.35 })
        const joint = new THREE.SphereGeometry(1, 12, 10)
        const up = new THREE.Vector3(0, 1, 0)
        for (const b of res.skeleton.bones) {
          if (/hips|pelvis/i.test(b.name)) hips = b
          const kids = b.children.filter((c): c is THREE.Bone => (c as THREE.Bone).isBone)
          const s = new THREE.Mesh(joint, mat)
          s.scale.setScalar((/hand|foot|toe|head/i.test(b.name) ? 3.2 : 2.4) * u)
          b.add(s)
          if (b === root && /^root$/i.test(b.name)) s.visible = false
          for (const c of kids) {
            const len = c.position.length()
            if (len < 0.5 * u || (b === root && /^root$/i.test(b.name))) continue
            const thick = (/spine|chest|hips|neck/i.test(b.name) ? 5 : /finger|thumb|index|middle|ring|pinky/i.test(c.name) ? 0.8 : 2.6) * u
            const limb = new THREE.Mesh(new THREE.CapsuleGeometry(thick, Math.max(0.1, len - thick * 2), 4, 10), mat)
            limb.position.copy(c.position).multiplyScalar(0.5)
            limb.quaternion.setFromUnitVectors(up, c.position.clone().normalize())
            b.add(limb)
          }
        }
        mixer = new THREE.AnimationMixer(root)
        const action = mixer.clipAction(res.clip)
        action.play()
        // İlk karede ayakları zemine oturt
        mixer.update(0)
        rig.position.y = 0
        rig.updateMatrixWorld(true)
        const fb = new THREE.Box3()
        for (const b of res.skeleton.bones) if (!/^root$/i.test(b.name)) fb.expandByPoint(b.getWorldPosition(v))
        rig.position.y = -fb.min.y
        controls.target.set(fb.getCenter(v).x, (fb.max.y - fb.min.y) * 0.55, fb.getCenter(v).z)
        ctl.current = { action, duration: res.clip.duration }
        setDur(res.clip.duration)
        setErr('')
      })
      .catch((e: Error) => setErr(e.message))

    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / Math.max(1, h)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    const hp = new THREE.Vector3()
    let frame = 0
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const dt = clock.getDelta()
      if (mixer) {
        mixer.update(dt)
        if (hips) {
          hips.getWorldPosition(hp)
          // kamera kökü yumuşakça takip etsin (root motion)
          const dx = hp.x - controls.target.x
          const dz = hp.z - controls.target.z
          controls.target.x += dx * 0.08
          controls.target.z += dz * 0.08
          camera.position.x += dx * 0.08
          camera.position.z += dz * 0.08
          floor.position.set(hp.x, 0.001, hp.z)
        }
        if (++frame % 6 === 0 && ctl.current.action) setT(ctl.current.action.time)
      }
      controls.update()
      renderer.render(scene, camera)
    }
    loop()
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [url])

  const toggle = () => {
    const a = ctl.current.action
    if (!a) return
    a.paused = playing
    setPlaying(!playing)
  }

  return (
    <div className="stage" ref={host}>
      {err && <div className="stage-empty">{err}</div>}
      <div className="stage-bar">
        <button className="btn ghost" onClick={toggle} style={{ height: 28, padding: '0 8px' }}>
          <Icon name={playing ? 'pause' : 'play'} size={15} />
        </button>
        <input
          type="range"
          min={0}
          max={dur || 1}
          step={0.01}
          value={t}
          onChange={(e) => {
            const a = ctl.current.action
            if (!a) return
            a.time = Number(e.target.value)
            setT(a.time)
          }}
        />
        <span className="mono dim">
          {t.toFixed(2)} / {dur.toFixed(2)} sn
        </span>
      </div>
    </div>
  )
}
