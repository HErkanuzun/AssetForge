// SPDX-License-Identifier: AGPL-3.0-only
// Web hesapları: sahip parolası, davet bağlantıları (rol + süre + kullanım sayısı), oturumlar.
// Parolalar scrypt ile tuzlanmış özet olarak, oturum anahtarları SHA-256 özetiyle saklanır. Davet bağlantıları,
// sahip yeniden kopyalayabilsin diye bu bilgisayarda açık tutulur; kullanılınca ya da süresi dolunca silinir.
import { app } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { WebInvitePublic, WebRole, WebUserPublic } from '../../shared/types'

interface StoredUser extends WebUserPublic {
  salt: string
  hash: string
}
interface StoredInvite {
  /** Bağlantıdaki anahtarın özeti */
  id: string
  /** Sahibin ekranında yeniden gösterebilmek için bağlantının kendisi (yalnızca bu bilgisayarda) */
  token: string
  role: WebRole
  createdAt: number
  expiresAt: number
  uses: number
  maxUses: number
}
interface StoredSession {
  id: string
  userId: string
  expiresAt: number
}
interface AccessFile {
  users: StoredUser[]
  invites: StoredInvite[]
  sessions: StoredSession[]
}

const SESSION_DAYS = 30
const file = () => path.join(app.getPath('userData'), 'web-access.json')
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
const token = () => crypto.randomBytes(24).toString('base64url')

let cache: AccessFile | null = null

function data(): AccessFile {
  if (cache) return cache
  try {
    const j = JSON.parse(fs.readFileSync(file(), 'utf8')) as Partial<AccessFile>
    cache = { users: j.users ?? [], invites: j.invites ?? [], sessions: j.sessions ?? [] }
  } catch {
    cache = { users: [], invites: [], sessions: [] }
  }
  return cache
}

function save(): void {
  const d = data()
  const now = Date.now()
  d.sessions = d.sessions.filter((s) => s.expiresAt > now)
  d.invites = d.invites.filter((i) => i.expiresAt > now && i.uses < i.maxUses)
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  const tmp = file() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2))
  fs.renameSync(tmp, file())
}

/** Testler için: önbelleği bırak (dosya yeniden okunur) */
export function resetAccessCache(): void {
  cache = null
}

function hashPassword(pw: string, salt: string): string {
  return crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex')
}

function checkPassword(u: StoredUser, pw: string): boolean {
  const a = Buffer.from(hashPassword(pw, u.salt), 'hex')
  const b = Buffer.from(u.hash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function validate(name: string, pw: string): { name: string } {
  const n = name.trim().replace(/\s+/g, ' ')
  if (n.length < 2 || n.length > 40) throw new Error('Ad 2–40 karakter olmalı')
  if (pw.length < 8) throw new Error('Parola en az 8 karakter olmalı')
  return { name: n }
}

const pub = (u: StoredUser): WebUserPublic => ({ id: u.id, name: u.name, role: u.role, createdAt: u.createdAt, lastSeen: u.lastSeen })

export const listUsers = (): WebUserPublic[] => data().users.map(pub)
export const ownerSet = (): boolean => data().users.some((u) => u.role === 'owner')
export const findUser = (id: string): WebUserPublic | undefined => {
  const u = data().users.find((x) => x.id === id)
  return u ? pub(u) : undefined
}

/** Sahip hesabını oluşturur ya da parolasını değiştirir (yalnızca masaüstünden ya da sahip tarafından) */
export function setOwner(name: string, pw: string): WebUserPublic {
  const v = validate(name, pw)
  const d = data()
  let u = d.users.find((x) => x.role === 'owner')
  if (d.users.some((x) => x !== u && x.name.toLowerCase() === v.name.toLowerCase())) throw new Error('Bu ad başka bir hesapta kullanılıyor')
  const salt = crypto.randomBytes(16).toString('hex')
  if (u) {
    u.name = v.name
    u.salt = salt
    u.hash = hashPassword(pw, salt)
    // Parola değişince sahibin eski oturumları kapanır
    d.sessions = d.sessions.filter((s) => s.userId !== u!.id)
  } else {
    u = { id: `usr_${token().slice(0, 10)}`, name: v.name, role: 'owner', createdAt: Date.now(), salt, hash: hashPassword(pw, salt) }
    d.users.push(u)
  }
  save()
  return pub(u)
}

export function createInvite(role: WebRole, hours = 72, maxUses = 1): StoredInvite {
  if (role === 'owner') throw new Error('Sahip daveti oluşturulamaz')
  const t = token()
  const inv: StoredInvite = { id: sha(t), token: t, role, createdAt: Date.now(), expiresAt: Date.now() + Math.max(1, hours) * 3600_000, uses: 0, maxUses: Math.max(1, Math.round(maxUses)) }
  data().invites.push(inv)
  save()
  return inv
}

export function listInvites(baseUrl: string): WebInvitePublic[] {
  const now = Date.now()
  return data()
    .invites.filter((i) => i.expiresAt > now && i.uses < i.maxUses)
    .map((i) => ({ token: i.token, role: i.role, createdAt: i.createdAt, expiresAt: i.expiresAt, uses: i.uses, maxUses: i.maxUses, url: `${baseUrl}/join/${i.token}` }))
}

export function revokeInvite(t: string): void {
  const d = data()
  d.invites = d.invites.filter((i) => i.token !== t)
  save()
}

export function inviteInfo(t: string): { role: WebRole } | null {
  const i = data().invites.find((x) => x.id === sha(t))
  return i && i.expiresAt > Date.now() && i.uses < i.maxUses ? { role: i.role } : null
}

/** Davet bağlantısıyla hesap açar */
export function join(t: string, name: string, pw: string): WebUserPublic {
  const d = data()
  const inv = d.invites.find((x) => x.id === sha(t))
  if (!inv || inv.expiresAt < Date.now() || inv.uses >= inv.maxUses) throw new Error('Davet geçersiz ya da süresi dolmuş')
  const v = validate(name, pw)
  if (d.users.some((x) => x.name.toLowerCase() === v.name.toLowerCase())) throw new Error('Bu ad kullanılıyor; başka bir ad seçin')
  const salt = crypto.randomBytes(16).toString('hex')
  const u: StoredUser = { id: `usr_${token().slice(0, 10)}`, name: v.name, role: inv.role, createdAt: Date.now(), salt, hash: hashPassword(pw, salt) }
  inv.uses++
  d.users.push(u)
  save()
  return pub(u)
}

export function login(name: string, pw: string): WebUserPublic | null {
  const u = data().users.find((x) => x.name.toLowerCase() === name.trim().toLowerCase())
  // Kullanıcı yoksa da aynı süre harcansın (ad tahminini zorlaştırır)
  if (!u) {
    hashPassword(pw, 'yok')
    return null
  }
  return checkPassword(u, pw) ? pub(u) : null
}

export function removeUser(id: string): void {
  const d = data()
  const u = d.users.find((x) => x.id === id)
  if (!u) return
  if (u.role === 'owner') throw new Error('Sahip hesabı silinemez')
  d.users = d.users.filter((x) => x.id !== id)
  d.sessions = d.sessions.filter((s) => s.userId !== id)
  save()
}

export function setRole(id: string, role: WebRole): void {
  const u = data().users.find((x) => x.id === id)
  if (!u) throw new Error('Kullanıcı bulunamadı')
  if (u.role === 'owner' || role === 'owner') throw new Error('Sahip rolü değiştirilemez')
  u.role = role
  save()
}

/** Yeni oturum: düz anahtar çereze yazılır, özeti saklanır */
export function createSession(userId: string): string {
  const t = token()
  data().sessions.push({ id: sha(t), userId, expiresAt: Date.now() + SESSION_DAYS * 86400_000 })
  save()
  return t
}

export function sessionUser(t: string | undefined): WebUserPublic | null {
  if (!t) return null
  const d = data()
  const s = d.sessions.find((x) => x.id === sha(t))
  if (!s || s.expiresAt < Date.now()) return null
  const u = d.users.find((x) => x.id === s.userId)
  if (!u) return null
  // Son görülme dakikada bir yazılır
  if (!u.lastSeen || Date.now() - u.lastSeen > 60_000) {
    u.lastSeen = Date.now()
    save()
  }
  return pub(u)
}

export function endSession(t: string | undefined): void {
  if (!t) return
  const d = data()
  d.sessions = d.sessions.filter((x) => x.id !== sha(t))
  save()
}
