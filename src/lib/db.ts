import { PrismaClient } from '@prisma/client'

// Env-aware Prisma client proxy that follows DATABASE_URL per test/file
// This avoids cross-test leakage when different suites set DATABASE_URL
let currentClient: PrismaClient | null = null
let currentUrl: string | undefined

function getClient(): PrismaClient {
  const url = process.env.DATABASE_URL
  if (!currentClient || currentUrl !== url) {
    // Create a new client bound to the current DATABASE_URL
    currentClient = new PrismaClient()
    currentUrl = url
  }
  return currentClient
}

// Proxy forwards all property accesses/calls to the active client
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient() as any
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
