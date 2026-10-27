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
app.disable('x-powered-by')

// Middlewares
app.use(cors({
  origin: 'http://localhost:5173',
}))
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
const frontendDist = path.join(__dirname, '../../frontend/dist')
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

let dbInitialized = false
export async function ensureDatabase() {
  if (!dbInitialized) {
    await initDatabase()
    dbInitialized = true
  }
}
