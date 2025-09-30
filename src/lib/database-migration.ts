import { execSync } from 'node:child_process'

let migrationPromise: Promise<void> | null = null

const shouldSkip = () => process.env.NODE_ENV === 'test'

export async function ensureDatabaseMigrated() {
  if (shouldSkip()) {
    return
  }

  if (!migrationPromise) {
    migrationPromise = new Promise<void>((resolve, reject) => {
      try {
        execSync('npx prisma migrate deploy', {
          cwd: process.cwd(),
          env: process.env,
          stdio: process.env.LOG_PRISMA_MIGRATE === 'true' ? 'inherit' : 'ignore',
        })
        resolve()
      } catch (error) {
        migrationPromise = null
        reject(error)
      }
    })
  }

  return migrationPromise
}
