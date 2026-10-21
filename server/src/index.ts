import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { initDatabase, isPostgresActive } from './db/index.js'
import { apiRouter } from './routes/api.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Middlewares
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ProcureFlow Backend API',
    database: isPostgresActive() ? 'Neon PostgreSQL (Cloud)' : 'Local Memory Store (Demo Mode)',
    timestamp: new Date().toISOString(),
  })
})

// Mount API router
app.use('/api', apiRouter)

// Serve frontend in production if built
const clientDist = path.join(__dirname, '../../client/dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// Start Server & Database
async function startServer() {
  try {
    await initDatabase()

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
