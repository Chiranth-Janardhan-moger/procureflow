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

export const app = express()

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

let dbInitialized = false
export async function ensureDatabase() {
  if (!dbInitialized) {
    await initDatabase()
    dbInitialized = true
  }
}
