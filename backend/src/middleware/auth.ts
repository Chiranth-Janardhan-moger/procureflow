import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { LoggedUser, Repository } from '../services/repository.js'

export interface AuthRequest extends Request {
  user?: LoggedUser
}

const JWT_SECRET = process.env.JWT_SECRET || 'procureflow_enterprise_secret_key_2026_super_secure'

export function signToken(user: { id: number; employee_id: string; name: string; email: string; role: string; department_id: number | null }) {
  return jwt.sign(
    {
      id: user.id,
      employee_id: user.employee_id,
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as LoggedUser
    const user = await Repository.getUserById(decoded.id)
    if (!user || user.status === 'disabled') {
      return res.status(403).json({ error: 'User account is deactivated or not found.' })
    }
    req.user = user as LoggedUser
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' })
  }
}

export function authorizeRoles(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' does not have permission. Required: [${roles.join(', ')}]`,
      })
    }
    next()
  }
}
