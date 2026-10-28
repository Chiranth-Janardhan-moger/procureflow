import autocannon, { Result } from 'autocannon'

interface TierTest {
  concurrency: number
  duration: number
  endpoint: string
  name: string
  method?: 'GET' | 'POST'
  body?: string
  headers?: Record<string, string>
}

async function getAuthToken(): Promise<string> {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rahul@company.com', password: 'password123' }),
  })
  if (!res.ok) {
    throw new Error(`Failed to authenticate demo user for load testing: ${res.statusText}`)
  }
  const data = (await res.json()) as { token: string }
  return data.token
}

async function runBenchmark(tier: TierTest): Promise<Result> {
  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: tier.endpoint,
        connections: tier.concurrency,
        duration: tier.duration,
        method: tier.method || 'GET',
        headers: tier.headers || {},
        body: tier.body,
        pipelining: 1,
      },
      (err, result) => {
        if (err) return reject(err)
        resolve(result)
      }
    )
    autocannon.track(instance, { renderProgressBar: false })
  })
}

function formatResult(tierName: string, concurrency: number, result: Result) {
  const rps = Math.round(result.requests.average)
  const p50 = result.latency.p50
  const p99 = result.latency.p99
  const avg = result.latency.average.toFixed(2)
  const max = result.latency.max
  const total = result.requests.total
  const non2xx = result.non2xx
  const errors = result.errors
  const timeouts = result.timeouts

  console.log(`\n========================================================================`)
  console.log(`  [SCALE TIER] ${tierName}: ${concurrency} Concurrent Users`)
  console.log(`========================================================================`)
  console.log(`  • Target Endpoint:   ${result.url}`)
  console.log(`  • Total Requests:    ${total.toLocaleString()} completed in ${result.duration}s`)
  console.log(`  • Throughput:        ${rps.toLocaleString()} Req/Sec`)
  console.log(`  • Latency (Average): ${avg} ms`)
  console.log(`  • Latency (p50):     ${p50} ms`)
  console.log(`  • Latency (p99):     ${p99} ms`)
  console.log(`  • Latency (Max):     ${max} ms`)
  console.log(`  • Successful (2xx):  ${result['2xx'].toLocaleString()} requests`)
  console.log(`  • Failed (non-2xx):  ${non2xx}`)
  console.log(`  • Socket Errors:     ${errors}`)
  console.log(`  • Timeouts:          ${timeouts}`)
}

async function main() {
  console.log('\n========================================================================')
  console.log('  PROCUREFLOW HIGH-CONCURRENCY SCALABILITY & STRESS BENCHMARK')
  console.log('========================================================================')
  console.log('Target Server: http://localhost:5000')

  // Verify health check first
  const healthCheck = await fetch('http://localhost:5000/api/health')
  if (!healthCheck.ok) {
    console.error('Backend server is not running on http://localhost:5000. Start with npm run dev.')
    process.exit(1)
  }
  const healthData = await healthCheck.json()
  console.log(`Service Status: OK (${(healthData as any).database})`)

  console.log('\nAuthenticating test persona to obtain JWT token...')
  const token = await getAuthToken()
  console.log('Authentication successful. JWT acquired.')

  const tiers: TierTest[] = [
    {
      name: 'Tier 1 - Baseline API (Health Check)',
      concurrency: 100,
      duration: 3,
      endpoint: 'http://localhost:5000/api/health',
    },
    {
      name: 'Tier 2 - Authenticated Business Query (Purchase Requests)',
      concurrency: 100,
      duration: 3,
      endpoint: 'http://localhost:5000/api/purchase-requests',
      headers: { Authorization: `Bearer ${token}` },
    },
    {
      name: 'Tier 3 - Medium Concurrency API Spike',
      concurrency: 500,
      duration: 3,
      endpoint: 'http://localhost:5000/api/health',
    },
    {
      name: 'Tier 4 - High Concurrency API Spike',
      concurrency: 1000,
      duration: 3,
      endpoint: 'http://localhost:5000/api/health',
    },
    {
      name: 'Tier 5 - High Concurrency Authenticated Query',
      concurrency: 1000,
      duration: 3,
      endpoint: 'http://localhost:5000/api/purchase-requests',
      headers: { Authorization: `Bearer ${token}` },
    },
    {
      name: 'Tier 6 - High Concurrency Stress Peak',
      concurrency: 1200,
      duration: 3,
      endpoint: 'http://localhost:5000/api/health',
    },
  ]

  for (const tier of tiers) {
    console.log(`\nExecuting ${tier.name} with ${tier.concurrency} concurrent connections for ${tier.duration}s...`)
    try {
      const res = await runBenchmark(tier)
      formatResult(tier.name, tier.concurrency, res)
    } catch (err: any) {
      console.error(`Error during ${tier.name}:`, err.message)
    }
  }

  console.log('\n========================================================================')
  console.log('  SCALABILITY BENCHMARK COMPLETE')
  console.log('========================================================================\n')
}

main().catch(console.error)
