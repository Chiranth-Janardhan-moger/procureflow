import { app, ensureDatabase } from '../backend/src/app.js'
import type { Request, Response } from 'express'

export default async function handler(req: Request, res: Response) {
  await ensureDatabase()
  return app(req, res)
}
