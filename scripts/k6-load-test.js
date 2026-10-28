import http from 'k6/http'
import { check, sleep } from 'k6'

// Configuration options for k6 load runner
// Supports testing 100, 1,000, 10,000, and scaling to 100k+ in distributed mode
export const options = {
  stages: [
    // Ramp up to 100 concurrent users
    { duration: '10s', target: 100 },
    { duration: '30s', target: 100 },

    // Ramp up to 1,000 concurrent users
    { duration: '15s', target: 1000 },
    { duration: '45s', target: 1000 },

    // Ramp up to 10,000 users (Target for clustered/distributed environments)
    // In local machines, execute with: k6 run --vus 100 --duration 30s scripts/k6-load-test.js
    { duration: '30s', target: 10000 },
    { duration: '1m', target: 10000 },

    // Ramp down to 0
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    // 95% of requests must complete below 500ms
    http_req_duration: ['p(95)<500'],
    // Error rate must stay below 1%
    http_req_failed: ['rate<0.01'],
  },
}

const BASE_URL = __ENV.API_URL || 'http://localhost:5000'

export default function () {
  // 1. Health check benchmark
  const healthRes = http.get(`${BASE_URL}/api/health`)
  check(healthRes, {
    'health status is 200': r => r.status === 200,
  })

  // 2. Realistic user login flow (password verification + token issuance)
  const loginPayload = JSON.stringify({
    email: 'rahul@company.com',
    password: 'password123',
  })

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  })

  const loginSuccess = check(loginRes, {
    'login status is 200': r => r.status === 200,
    'jwt token received': r => r.json('token') !== undefined,
  })

  // 3. Authenticated purchase request query
  if (loginSuccess) {
    const token = loginRes.json('token')
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    const prRes = http.get(`${BASE_URL}/api/purchase-requests`, {
      headers: authHeaders,
    })

    check(prRes, {
      'get PR status is 200': r => r.status === 200,
      'has requests list': r => Array.isArray(r.json('requests')),
    })
  }

  // Think time between user clicks (1 second)
  sleep(1)
}
