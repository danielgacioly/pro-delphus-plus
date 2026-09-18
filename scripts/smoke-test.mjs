import assert from 'node:assert/strict'

const baseUrl = process.env.API_URL ?? 'http://localhost:4000/api'

async function request(path, options) {
  return fetch(`${baseUrl}${path}`, options)
}

const health = await request('/health')
assert.equal(health.status, 200, 'API health check should return 200')
assert.deepEqual(await health.json(), { ok: true })

const protectedResponse = await request('/auth/me')
assert.equal(protectedResponse.status, 401, 'Unauthenticated /auth/me should return 401')

const invalidLogin = await request('/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'not-an-email', password: '' }),
})
assert.equal(invalidLogin.status, 400, 'Malformed login should return 400')

console.log('API smoke test passed')
