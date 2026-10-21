import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, UserRole, Notification } from '../types'
import { api } from '../services/api'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password?: string) => Promise<void>
  logout: () => void
  switchRole: (role: UserRole) => Promise<void>
  notifications: Notification[]
  unreadCount: number
  refreshNotifications: () => Promise<void>
  markNotificationRead: (id: number) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('procureflow_token')
      if (token) {
        const { user } = await api.getMe()
        setUser(user)
        await fetchNotifications()
      }
    } catch (err) {
      console.warn('Session expired or invalid token:', err)
      localStorage.removeItem('procureflow_token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchNotifications = async () => {
    try {
      const { notifications } = await api.getNotifications()
      setNotifications(notifications)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const login = async (email: string, password: string = 'password123') => {
    const { token, user } = await api.login({ email, password })
    localStorage.setItem('procureflow_token', token)
    setUser(user)
    await fetchNotifications()
  }

  const switchRole = async (role: UserRole) => {
    setLoading(true)
    try {
      const { token, user } = await api.demoSwitch(role)
      localStorage.setItem('procureflow_token', token)
      setUser(user)
      await fetchNotifications()
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('procureflow_token')
    setUser(null)
    setNotifications([])
  }

  const markNotificationRead = async (id: number) => {
    try {
      await api.markNotificationRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (err) {
      console.error(err)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        switchRole,
        notifications,
        unreadCount,
        refreshNotifications: fetchNotifications,
        markNotificationRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
