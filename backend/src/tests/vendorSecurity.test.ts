import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import bcrypt from 'bcryptjs'
import { app, ensureDatabase } from '../app.js'
import { Repository } from '../services/repository.js'
import { getVendorPasswordError } from '../services/vendorCredentials.js'
import { signToken } from '../middleware/auth.js'

describe('Unit: vendor password validation', () => {
  test('rejects missing, non-string, short, and whitespace-only input', () => {
    for (const input of [undefined, null, 123, {}, '', 'short', ' '.repeat(12)]) {
      assert.notEqual(getVendorPasswordError(input), null)
    }
  })

  test('accepts the minimum and maximum ASCII lengths', () => {
    for (const length of [12, 72]) {
      assert.equal(getVendorPasswordError('a'.repeat(length)), null)
    }
  })

  test('enforces bcrypt byte limits for ASCII and multibyte input', () => {
    assert.notEqual(getVendorPasswordError('a'.repeat(73)), null)
    assert.equal(getVendorPasswordError('\u00e9'.repeat(36)), null)
    assert.notEqual(getVendorPasswordError('\u00e9'.repeat(37)), null)
  })
})

describe('API: vendor account provisioning', () => {
  let server: Server
  let baseUrl: string
  let token: string

  before(async () => {
    await ensureDatabase()
    const admin = await Repository.getUserByEmail('admin@company.com')
    assert.ok(admin)
    token = signToken(admin)
    await new Promise<void>(resolve => {
      server = app.listen(0, '127.0.0.1', () => resolve())
    })
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  })

  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    })
  })

  test('rejects invalid passwords before creating a vendor account', async () => {
    for (const password of [undefined, 'short', ' '.repeat(12), 'a'.repeat(73)]) {
      const email = `invalid-${randomUUID()}@example.com`
      const response = await fetch(`${baseUrl}/vendors`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Invalid Vendor', email, password }),
      })
      assert.equal(response.status, 400)
      assert.equal(await Repository.getUserByEmail(email), null)
    }
  })

  test('requires authentication to provision vendor credentials', async () => {
    const response = await fetch(`${baseUrl}/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthorized Vendor', email: 'blocked@example.com', password: randomBytes(18).toString('hex') }),
    })
    assert.equal(response.status, 401)
  })

  test('hashes the supplied password and permits vendor login without leaking credentials', async () => {
    const email = `vendor-${randomUUID()}@example.com`
    const password = randomBytes(18).toString('hex')
    const response = await fetch(`${baseUrl}/vendors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Security Test Vendor', email, password }),
    })
    assert.equal(response.status, 201)
    const data = await response.json() as { vendor: Record<string, unknown> }
    assert.equal(data.vendor.password, undefined)
    assert.equal(data.vendor.password_hash, undefined)
    const account = await Repository.getUserByEmail(email)
    assert.ok(account)
    assert.notEqual(account.password_hash, password)
    assert.ok(await bcrypt.compare(password, account.password_hash))
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    assert.equal(login.status, 200)
    const session = await login.json() as { token: string; user: { role: string } }
    assert.ok(session.token)
    assert.equal(session.user.role, 'vendor')
  })
})