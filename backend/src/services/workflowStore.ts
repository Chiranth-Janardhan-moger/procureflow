import type { PoolClient } from 'pg'
import { getPool, isPostgresActive, memoryStore } from '../db/index.js'

export type Row = Record<string, any>
export type Table = keyof typeof memoryStore
const tableNames = new Set(Object.keys(memoryStore))
let memoryQueue = Promise.resolve()

function identifier(value: string): string {
  if (!/^[a-z_]+$/.test(value)) throw new Error('Invalid storage identifier')
  return `"${value}"`
}

export class WorkflowStore {
  constructor(private readonly client?: PoolClient) {}

  private table(table: Table): string {
    if (!tableNames.has(table)) throw new Error('Unknown workflow table')
    return identifier(table)
  }

  async list(table: Table, filters: Row = {}): Promise<Row[]> {
    const entries = Object.entries(filters)
    if (this.client) {
      const where = entries.length ? ` WHERE ${entries.map(([key], i) => `${identifier(key)} = $${i + 1}`).join(' AND ')}` : ''
      return (await this.client.query(`SELECT * FROM ${this.table(table)}${where} ORDER BY id ASC`, entries.map(([, value]) => value))).rows
    }
    return (memoryStore[table] as unknown as Row[])
      .filter(row => entries.every(([key, value]) => row[key] === value))
      .map(row => ({ ...row })).sort((a, b) => a.id - b.id)
  }

  async find(table: Table, id: number, lock = false): Promise<Row | undefined> {
    if (this.client) return (await this.client.query(`SELECT * FROM ${this.table(table)} WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0]
    return (await this.list(table, { id }))[0]
  }

  async insert(table: Table, data: Row): Promise<Row> {
    if (this.client) {
      const entries = Object.entries(data)
      const values = entries.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : value)
      return (await this.client.query(
        `INSERT INTO ${this.table(table)} (${entries.map(([key]) => identifier(key)).join(', ')}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, values
      )).rows[0]
    }
    const rows = memoryStore[table] as unknown as Row[]
    const row = { ...data, id: rows.reduce((max, existing) => Math.max(max, existing.id), 0) + 1 }
    rows.push(row)
    return { ...row }
  }

  async update(table: Table, id: number, data: Row): Promise<Row> {
    if (this.client) {
      const entries = Object.entries(data)
      return (await this.client.query(
        `UPDATE ${this.table(table)} SET ${entries.map(([key], i) => `${identifier(key)} = $${i + 1}`).join(', ')} WHERE id = $${entries.length + 1} RETURNING *`,
        [...entries.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : value), id]
      )).rows[0]
    }
    const row = (memoryStore[table] as unknown as Row[]).find(existing => existing.id === id)
    if (!row) throw new Error('Workflow record disappeared')
    Object.assign(row, data)
    return { ...row }
  }
}

/** Serialize memory mutations; use PostgreSQL transactions and explicit row locks online. */
export async function atomicWorkflow<T>(work: (store: WorkflowStore) => Promise<T>): Promise<T> {
  if (isPostgresActive()) {
    const client = await getPool()!.connect()
    try {
      await client.query('BEGIN')
      const result = await work(new WorkflowStore(client))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }
  const previous = memoryQueue
  let release!: () => void
  memoryQueue = new Promise<void>(resolve => { release = resolve })
  await previous
  const snapshot = structuredClone(memoryStore)
  try { return await work(new WorkflowStore()) }
  catch (error) {
    for (const table of Object.keys(snapshot) as Table[]) {
      const rows = memoryStore[table] as unknown as Row[]
      rows.splice(0, rows.length, ...(snapshot[table] as unknown as Row[]))
    }
    throw error
  } finally { release() }
}
