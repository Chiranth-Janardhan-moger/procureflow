import { app, ensureDatabase } from './app.js'
import { isPostgresActive } from './db/index.js'

const PORT = process.env.PORT || 5000

// Start Server & Database
async function startServer() {
  try {
    await ensureDatabase()

    app.listen(PORT, () => {
      console.log(`====================================================`)
      console.log(` ProcureFlow Server running on http://localhost:${PORT}`)
      console.log(` Database: ${isPostgresActive() ? 'PostgreSQL on Neon (Cloud)' : 'Local Memory Repository (Ready)'}`)
      console.log(` API Healthcheck: http://localhost:${PORT}/api/health`)
      console.log(`====================================================\n`)
    })
  } catch (err) {
    console.error('Failed to start ProcureFlow server:', err)
    process.exit(1)
  }
}

startServer()
