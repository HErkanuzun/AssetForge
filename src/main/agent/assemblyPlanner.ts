// SPDX-License-Identifier: AGPL-3.0-only
// Montaj planlayıcısı: modelin ölçülü görünüşlerine bakıp hareketli parçaları, pivotları, efekt bağlantı
// noktalarını, ezilme bölgelerini, hareket kliplerini ve kit seslerini eşleyen planı yazar; kontrol
// render'larına bakıp planı onaylar ya da düzeltir. Plan forge_assembly.py'nin biçimine çevrilir.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { AssetSpec, Bible, LlmProvider } from '../../shared/types'
import { assetContext, bibleContext, structured, type CallResult, type Content } from '../providers/claude'
import { sniffImage } from '../util'

const V3 = z.array(z.number()).describe('[x, y, z] in meters, assembly space')

const PartSchema = z.object({
  name: z.string().describe('snake_case bone name. Vehicles: wheel_fl, wheel_fr, wheel_rl, wheel_rr (6 wheels: add wheel_ml, wheel_mr), door_fl, door_fr, door_rl, door_rr, hood, trunk'),
  role: z.enum(['wheel', 'door', 'hood', 'trunk', 'lid', 'hatch', 'steering_wheel', 'propeller', 'rotor', 'turret', 'barrel', 'lever', 'other']),
  method: z.enum(['cylinder', 'box', 'objects', 'islands']).describe('How to cut the part out of the model'),
  center: V3.describe('cylinder: wheel/axle centre'),
  radius: z.number().describe('cylinder radius (m); 0 if not cylinder'),
  half_width: z.number().describe('cylinder half length along its axis (m); 0 if not cylinder'),
  axis: z.enum(['X', 'Y', 'Z']).describe('cylinder axis (wheels: Y)'),
  box_min: V3.describe('box: min corner; [0,0,0] if not box'),
  box_max: V3.describe('box: max corner; [0,0,0] if not box'),
  objects: z.array(z.string()).describe('objects method: source object names from the analysis'),
  islands: z.array(z.number().int()).describe('islands method: island indices from the analysis'),
  pivot: V3.describe('Hinge / rotation centre. Wheels: wheel centre. Doors: front hinge line at the door middle height. Hood: rear edge. Trunk: front edge'),
  motion_type: z.enum(['rotate', 'translate', 'none']),
  motion_axis: z.enum(['X', 'Y', 'Z']).describe('Wheels spin on Y, side doors swing on Z, hood/trunk on Y'),
  motion_min: z.number().describe('degrees (rotate) or meters (translate)'),
  motion_max: z.number()
})

const PlanSchema = z.object({
  front: z
    .enum(['-Y', '+Y', '+X', '-X'])
    .describe(
      'Which axis the FRONT of the raw model faced. The analysis renders assumed the value in front_assumed; if the renders show the front pointing +X (left in the side view, right in the top view), keep that value'
    ),
  length_m: z.number().describe('Real length in meters to scale to (0 = keep the analysed size)'),
  parts: z.array(PartSchema),
  sockets: z.array(
    z.object({
      name: z.string().describe('fx_exhaust, fx_exhaust_2, fx_headlight_l, fx_headlight_r, fx_taillight_l, fx_taillight_r, fx_wheel_rl …'),
      use: z.enum(['exhaust', 'headlight', 'taillight', 'dust', 'smoke', 'spark', 'muzzle', 'other']),
      location: V3,
      direction: V3.describe('Unit vector the effect points to (exhaust: backwards [-1,0,0])')
    })
  ),
  damage: z.array(
    z.object({
      name: z.string().describe('front, rear, left, right, roof …'),
      center: V3.describe('On the surface of the body where impacts land'),
      radius: z.number().describe('Zone radius (m), about a third of the vehicle width'),
      depth: z.number().describe('Dent depth (m), 0.05-0.15 for cars')
    })
  ),
  clips: z.array(
    z.object({
      name: z.string().describe('e.g. door_fl_open, door_fl_close, hood_open, trunk_open, lid_open'),
      seconds: z.number(),
      loop: z.boolean(),
      tracks: z.array(z.object({ part: z.string(), keys: z.array(z.object({ t: z.number(), value: z.number() })).describe('value: degrees or meters along the motion axis') }))
    })
  ),
  sounds: z.array(z.object({ clip: z.string(), time: z.number(), kit_role: z.string().describe('role tag of a kit sound, e.g. door_open, door_close') })),
  notes: z.string().describe('Short Turkish summary of the plan and anything uncertain')
})
export type LlmPlan = z.infer<typeof PlanSchema>

const ReviewSchema = z.object({
  ok: z.boolean().describe('true only if every part is cut cleanly, pivots sit on the hinge/axle and nothing important is missing'),
  problems: z.array(z.string()).describe('Concrete Turkish problems seen in the check renders'),
  plan: PlanSchema.describe('The corrected full plan (repeat the same plan if ok)')
})

export const RIGGER_GUIDE = `You are the technical rigger of AssetForge, a game-asset pipeline for Unreal Engine 5. You turn a generated 3D model into a game-ready assembly: moving parts become separate pieces with a bone at their pivot, effect attachment points, dent zones for damage and short motion clips. You work only from the measured renders and the analysis JSON; you never guess numbers you can read from the grid.

ASSEMBLY SPACE (all renders and numbers): meters, +X = FRONT, +Y = LEFT side of the object, +Z = up, origin = bottom centre (ground). Side view looks at the LEFT side (front is on the image's left), top view has front to the right and left side up, front view looks at the front (the object's left side is on the image's right). Grid lines every 0.25 m, labels every 0.5 m.

HOW PARTS ARE CUT
- cylinder: every face whose centre lies inside the cylinder becomes the part. Wheels: centre = axle centre, axis Y, radius = tire radius + 2-3 cm, half_width = half tire width + 2 cm. Keep the cylinder inside the wheel arch so the body is not cut.
- box: faces whose centre is inside the box. Use for doors, hood, trunk, lids. Keep boxes tight; a door box spans the door from its front gap to its rear gap, sill to window top, and only ~0.15 m deep into the body.
- objects / islands: when the analysis shows separate source objects or loose islands that are exactly the part (common for wheels), use them — cleanest result.
- Name wheels by position: front/rear + left (+Y) / right (-Y): wheel_fl = front-left = (+X, +Y).

VEHICLES
- Always the wheels. Wheel centres are usually right above ground_contacts (x, y) at z = tire radius.
- Doors, hood and trunk only when the model clearly shows their panel gaps; otherwise leave them out (a wrong cut is worse than none). Max 4 openable parts.
- Sockets: fx_exhaust at the tailpipe end pointing backwards; fx_headlight_l / fx_headlight_r at the lamps; fx_wheel_* just behind the rear wheels at ground level for dust.
- Damage zones: front, rear, left, right (and roof for tall vehicles) on the body surface.
- Clips: one open and one close clip per openable part (open ~0.8-1.2 s with a small overshoot). Side doors open 60-75°, hood 50-60°, trunk 60-80°. Value sign does not matter for vehicles (Unreal opens them outwards automatically) but keep it consistent.
- Sounds: map each open/close clip to the matching kit sound role (door_open, door_close, hood_open, trunk_open …) only if that role exists in the KIT list.

OTHER OBJECTS (props, weapons, machines)
- Moving parts are lids, doors, levers, barrels, rotors, turrets. Same rules; damage zones only for objects that can be dented.
- If nothing should move, return no parts — an empty plan is valid.

When reviewer feedback or a previous plan is given, fix every listed problem.`

function imageBlocks(files: string[], label: (f: string) => string): Content {
  const out: Content = []
  for (const f of files) {
    try {
      const buf = fs.readFileSync(f)
      const media = sniffImage(buf)
      if (!media) continue
      out.push({ type: 'text', text: label(f) })
      out.push({ type: 'image', source: { type: 'base64', media_type: media, data: buf.toString('base64') } })
    } catch {
      /* yoksa atla */
    }
  }
  return out
}

export interface PlanInput {
  provider?: LlmProvider
  bible: Bible
  asset: AssetSpec
  kitRoles: string[]
  analysis: Record<string, unknown>
  renders: string[]
  extra: string
  feedback: string[]
  reference?: string[]
}

function context(i: PlanInput): string {
  const a = { ...i.analysis }
  delete a.renders
  return [
    'ASSET',
    assetContext(i.asset),
    i.asset.tier ? `COMPLEXITY TIER: ${i.asset.tier}` : '',
    `\nKIT SOUND ROLES AVAILABLE: ${i.kitRoles.join(', ') || '(none)'}`,
    `\nANALYSIS (measured)\n${JSON.stringify(a, null, 1).slice(0, 12000)}`,
    i.extra.trim() ? `\nEXTRA INSTRUCTIONS FROM THE USER: ${i.extra.trim()}` : '',
    i.feedback.length ? `\nREVIEWER FEEDBACK ON EARLIER ATTEMPTS — fix every point:\n${i.feedback.map((f, k) => `${k + 1}. ${f}`).join('\n')}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

export async function planAssembly(i: PlanInput): Promise<CallResult<LlmPlan>> {
  const content: Content = [
    ...imageBlocks(i.reference ?? [], () => 'Reference concept image of the asset:'),
    ...imageBlocks(i.renders, (f) => `Analysis render: ${path.basename(f, '.png').replace('analyze_', '')} view`),
    { type: 'text', text: `${context(i)}\n\nWrite the assembly plan.` }
  ]
  return structured(
    PlanSchema,
    [
      { type: 'text', text: RIGGER_GUIDE },
      { type: 'text', text: `PROJECT BIBLE\n${bibleContext(i.bible)}` }
    ],
    content,
    'high',
    32000,
    'vision',
    i.provider
  )
}

export async function reviewAssembly(i: PlanInput & { plan: LlmPlan; result: Record<string, unknown>; checks: string[] }): Promise<CallResult<z.infer<typeof ReviewSchema>>> {
  const r = { ...i.result }
  delete r.checks
  const content: Content = [
    ...imageBlocks(
      i.renders.filter((f) => /side|top/.test(f)),
      (f) => `Original analysis render (${path.basename(f, '.png').replace('analyze_', '')}):`
    ),
    ...imageBlocks(i.checks, (f) => `CHECK render after the build (${path.basename(f, '.png').replace('check_', '')}): body grey, every cut part has its own colour, small dark spheres = pivots`),
    {
      type: 'text',
      text: `${context(i)}\n\nPLAN THAT WAS BUILT\n${JSON.stringify(i.plan)}\n\nBUILD RESULT\n${JSON.stringify(r, null, 1).slice(0, 8000)}\n\nCheck the result like a strict technical artist: is each coloured part exactly the intended piece (whole wheel incl. tire and rim, no chunks of body), is each pivot on the axle / hinge, are sockets and damage zones on the surface, any warnings? Return ok=true only if it is good enough for the game; otherwise return the corrected plan.`
    }
  ]
  return structured(ReviewSchema, [{ type: 'text', text: RIGGER_GUIDE }], content, 'high', 32000, 'vision', i.provider)
}

const v3 = (a: number[] | undefined, d: number[] = [0, 0, 0]) => (Array.isArray(a) && a.length >= 3 ? a.slice(0, 3).map(Number) : d)

/** LLM planı → forge_assembly.py plan.json */
export function toForgePlan(p: LlmPlan, kind: string): Record<string, unknown> {
  const parts = p.parts.map((x) => {
    let select: Record<string, unknown> = {}
    if (x.method === 'cylinder') select = { cylinder: { center: v3(x.center), radius: x.radius, half_width: x.half_width, axis: x.axis } }
    else if (x.method === 'box') select = { box: { min: v3(x.box_min), max: v3(x.box_max) } }
    else if (x.method === 'objects') select = { objects: x.objects }
    else select = { islands: x.islands }
    return {
      name: x.name,
      role: x.role,
      select,
      pivot: v3(x.pivot, x.method === 'cylinder' ? v3(x.center) : undefined),
      motion: x.motion_type === 'none' ? null : { type: x.motion_type, axis: x.motion_axis, min: x.motion_min, max: x.motion_max }
    }
  })
  return {
    kind,
    front: p.front,
    ...(p.length_m > 0 ? { size: { length: p.length_m } } : {}),
    parts,
    sockets: p.sockets.map((s) => ({ name: s.name, use: s.use, location: v3(s.location), direction: v3(s.direction, [-1, 0, 0]) })),
    damage: p.damage.map((d) => ({ name: d.name, center: v3(d.center), radius: d.radius, depth: d.depth })),
    clips: p.clips.map((c) => ({ name: c.name, seconds: c.seconds, loop: c.loop, tracks: c.tracks.map((t) => ({ part: t.part, keys: t.keys.map((k) => [k.t, k.value]) })) })),
    sounds: p.sounds
  }
}
