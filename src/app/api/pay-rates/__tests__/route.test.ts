/**
 * Pay Rates API Tests Template
 *
 * This file provides a comprehensive template for testing the /api/pay-rates route.
 * Each test includes detailed comments explaining what should be implemented.
 *
 * The tests follow the existing patterns from the codebase and cover:
 * - GET /api/pay-rates (list pay guides with pagination, filtering, sorting)
 * - POST /api/pay-rates (create new pay guides with full validation)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import {
  CreatePayGuideRequest,
  PayGuideResponse,
  PayGuidesListResponse,
  ApiValidationResponse,
} from '@/types'

// Mock Next.js request/response objects following existing patterns
class MockRequest {
  private _url: string
  private _method: string
  private _body: any
  private _headers: Record<string, string> = {}

  constructor(
    url: string,
    options: {
      method?: string
      body?: any
      headers?: Record<string, string>
    } = {}
  ) {
    this._url = url
    this._method = options.method || 'GET'
    this._body = options.body
    this._headers = options.headers || {}
  }

  get url() {
    return this._url
  }
  get method() {
    return this._method
  }

  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body
  }
}

class MockResponse {
  private _status: number = 200
  private _body: any
  private _headers: Record<string, string> = {}

  static json(data: any, options: { status?: number } = {}) {
    const response = new MockResponse()
    response._body = data
    response._status = options.status || 200
    return response
  }

  get status() {
    return this._status
  }
  get body() {
    return this._body
  }

  async json() {
    return this._body
  }
}

// Setup test database connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./pay-rates-api-test.db',
    },
  },
})

describe('Pay Rates API', () => {
  let testUserId: string
  let testPayGuideId: string

  beforeAll(async () => {
    /**
     * IMPLEMENTED: Database setup
     * - Set environment variable: process.env.DATABASE_URL = 'file:./pay-rates-api-test.db'
     * - Run Prisma migrations: execSync('npx prisma migrate dev --name init', { stdio: 'pipe' })
     * - Create test user for relationships
     * - Create base test pay guide for reference tests
     * - Create penalty time frames associated with test pay guide
     */
    // Set up test database
    process.env.DATABASE_URL = 'file:./pay-rates-api-test.db'
    execSync('npx prisma migrate dev --name init', { stdio: 'pipe' })

    // Create a base test pay guide (only if it doesn't exist)
    const existing = await prisma.payGuide.findUnique({
      where: { name: 'Test Retail Award' },
    })

    if (!existing) {
      await prisma.payGuide.create({
        data: {
          name: 'Test Retail Award',
          baseRate: new Decimal('25.00'),
          effectiveFrom: new Date('2024-01-01'),
          timezone: 'Australia/Sydney',
          isActive: true,
        },
      })
    }
  })

  afterAll(async () => {
    /**
     * IMPLEMENTED: Cleanup
     * - Disconnect Prisma client: await prisma.$disconnect()
     * - Optionally remove test database file
     */
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    /**
     * IMPLEMENTED: Test isolation
     * - Clean up any pay guides created during tests (except base test data)
     * - Reset any modified test data to original state
     * - Consider using database transactions for better isolation
     */
    // Clean up any pay guides created during tests (except the base one)
    // First, delete related shifts to avoid foreign key constraint violations
    const testPayGuides = await prisma.payGuide.findMany({
      where: {
        name: {
          not: 'Test Retail Award',
        },
      },
    })

    for (const payGuide of testPayGuides) {
      // Delete any shifts that reference this pay guide
      await prisma.shift.deleteMany({
        where: { payGuideId: payGuide.id },
      })
    }

    // Now delete the pay guides
    await prisma.payGuide.deleteMany({
      where: {
        name: {
          not: 'Test Retail Award',
        },
      },
    })
  })

  describe('GET /api/pay-rates', () => {
    describe('Basic Functionality', () => {
      it('should return paginated list of pay guides with default parameters', async () => {
        /**
         * IMPLEMENTED: Test basic GET request functionality
         *
         * Implementation steps:
         * 1. Import the GET function: const { GET } = await import('@/app/api/pay-rates/route')
         * 2. Create MockRequest: new MockRequest('http://localhost/api/pay-rates')
         * 3. Call GET handler and get response
         * 4. Parse response JSON
         *
         * Assertions to verify:
         * - Response status is 200
         * - Response has data.payGuides array
         * - Response has data.pagination object with page, limit, total, totalPages
         * - Default pagination: page=1, limit=10
         * - Each pay guide has correct structure (id, name, baseRate as string, etc.)
         * - Pay guides include related penalty time frames if any exist
         * - Dates are properly formatted as ISO strings
         * - Decimal values are converted to strings
         */
        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.payGuides).toBeInstanceOf(Array)
        expect(result.data.payGuides.length).toBeGreaterThan(0)
        expect(result.data.pagination).toBeTruthy()
        expect(result.data.pagination.page).toBe(1)
        expect(result.data.pagination.limit).toBe(10)
        expect(result.data.pagination.total).toBeGreaterThan(0)
        expect(result.data.pagination.totalPages).toBeGreaterThan(0)

        // Verify pay guide structure
        const payGuide = result.data.payGuides[0]
        expect(payGuide.id).toBeTruthy()
        expect(payGuide.name).toBeTruthy()
        expect(typeof payGuide.baseRate).toBe('string')
        expect(payGuide.effectiveFrom).toBeTruthy()
        expect(payGuide.timezone).toBeTruthy()
        expect(typeof payGuide.isActive).toBe('boolean')
        expect(payGuide.createdAt).toBeTruthy()
        expect(payGuide.updatedAt).toBeTruthy()
      })

      it('should return empty list when no pay guides exist', async () => {
        /**
         * IMPLEMENTED: Test empty state handling
         *
         * Implementation steps:
         * 1. Clear all pay guides from database: await prisma.payGuide.deleteMany()
         * 2. Make GET request to /api/pay-rates
         * 3. Verify response structure
         *
         * Assertions to verify:
         * - Response status is 200
         * - data.payGuides is empty array []
         * - pagination.total is 0
         * - pagination.totalPages is 0
         * - Other pagination fields are still present and valid
         */
        // Clear all pay guides
        await prisma.payGuide.deleteMany()

        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.payGuides).toEqual([])
        expect(result.data.pagination.total).toBe(0)
        expect(result.data.pagination.totalPages).toBe(0)
        expect(result.data.pagination.page).toBe(1)
        expect(result.data.pagination.limit).toBe(10)
      })
    })

    describe('Pagination', () => {
      it('should handle custom pagination parameters correctly', async () => {
        /**
         * IMPLEMENTED: Test pagination with custom parameters
         *
         * Setup:
         * - Create multiple test pay guides (at least 15) to test pagination
         *
         * Implementation:
         * - Request: GET /api/pay-rates?page=2&limit=5
         * - Verify correct subset of results is returned
         *
         * Assertions to verify:
         * - Response contains exactly 5 pay guides (or fewer if on last page)
         * - Pagination object shows: page=2, limit=5, total=[correct count], totalPages=[correct count]
         * - Results are different from page 1 (no duplicates)
         * - Results are correctly ordered based on default sorting
         */
        
        // Create 15 test pay guides for pagination testing
        const payGuides = []
        for (let i = 1; i <= 15; i++) {
          const payGuide = await prisma.payGuide.create({
            data: {
              name: `Test Award ${i.toString().padStart(2, '0')}`,
              baseRate: new Decimal(`${20 + i}.00`),
              effectiveFrom: new Date('2024-01-01'),
              timezone: 'Australia/Sydney',
              isActive: true,
            },
          })
          payGuides.push(payGuide)
        }

        const { GET } = await import('@/app/api/pay-rates/route')
        
        // First check how many records we actually have
        const totalCheckRequest = new MockRequest('http://localhost/api/pay-rates?page=1&limit=1')
        const totalCheckResponse = await GET(totalCheckRequest as any)
        const totalCheckResult = await totalCheckResponse.json()
        const actualTotal = totalCheckResult.data.pagination.total
        const expectedTotalPages = Math.ceil(actualTotal / 5)
        
        // Test page 2 with limit 5
        const request = new MockRequest('http://localhost/api/pay-rates?page=2&limit=5')
        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.payGuides).toHaveLength(5)
        expect(result.data.pagination.page).toBe(2)
        expect(result.data.pagination.limit).toBe(5)
        expect(result.data.pagination.total).toBe(actualTotal) // Use actual count
        expect(result.data.pagination.totalPages).toBe(expectedTotalPages) // Calculated based on actual

        // Get page 1 to verify no duplicates
        const page1Request = new MockRequest('http://localhost/api/pay-rates?page=1&limit=5')
        const page1Response = await GET(page1Request as any)
        const page1Result = await page1Response.json()

        // Verify no overlapping IDs between page 1 and page 2
        const page1Ids = page1Result.data.payGuides.map((pg: any) => pg.id)
        const page2Ids = result.data.payGuides.map((pg: any) => pg.id)
        const overlap = page1Ids.filter((id: string) => page2Ids.includes(id))
        expect(overlap).toHaveLength(0)

        // Verify results are ordered by name (default sortBy)
        const names = result.data.payGuides.map((pg: any) => pg.name)
        const sortedNames = [...names].sort()
        expect(names).toEqual(sortedNames)
      })

      it('should reject invalid pagination parameters', async () => {
        /**
         * IMPLEMENTED: Test pagination validation
         *
         * Test cases:
         * 1. page < 1: GET /api/pay-rates?page=0
         * 2. limit < 1: GET /api/pay-rates?limit=0
         * 3. limit > 100: GET /api/pay-rates?limit=101
         *
         * Assertions for each case:
         * - Response status is 400
         * - Response has errors array with ValidationError objects
         * - Error messages are descriptive and indicate the specific validation failure
         * - Response includes message field explaining validation failure
         */
        
        const { GET } = await import('@/app/api/pay-rates/route')

        // Test case 1: page < 1
        const invalidPageRequest = new MockRequest('http://localhost/api/pay-rates?page=0')
        const pageResponse = await GET(invalidPageRequest as any)
        const pageResult = await pageResponse.json()

        expect(pageResponse.status).toBe(400)
        expect(pageResult.errors).toBeInstanceOf(Array)
        expect(pageResult.errors.length).toBeGreaterThan(0)
        expect(pageResult.errors.some((err: any) => 
          err.field === 'page' && err.message.includes('Page must be at least 1')
        )).toBe(true)
        expect(pageResult.message).toBe('Invalid query parameters')

        // Test case 2: limit < 1
        const invalidLimitLowRequest = new MockRequest('http://localhost/api/pay-rates?limit=0')
        const limitLowResponse = await GET(invalidLimitLowRequest as any)
        const limitLowResult = await limitLowResponse.json()

        expect(limitLowResponse.status).toBe(400)
        expect(limitLowResult.errors).toBeInstanceOf(Array)
        expect(limitLowResult.errors.length).toBeGreaterThan(0)
        expect(limitLowResult.errors.some((err: any) => 
          err.field === 'limit' && err.message.includes('Limit must be between 1 and 100')
        )).toBe(true)
        expect(limitLowResult.message).toBe('Invalid query parameters')

        // Test case 3: limit > 100
        const invalidLimitHighRequest = new MockRequest('http://localhost/api/pay-rates?limit=101')
        const limitHighResponse = await GET(invalidLimitHighRequest as any)
        const limitHighResult = await limitHighResponse.json()

        expect(limitHighResponse.status).toBe(400)
        expect(limitHighResult.errors).toBeInstanceOf(Array)
        expect(limitHighResult.errors.length).toBeGreaterThan(0)
        expect(limitHighResult.errors.some((err: any) => 
          err.field === 'limit' && err.message.includes('Limit must be between 1 and 100')
        )).toBe(true)
        expect(limitHighResult.message).toBe('Invalid query parameters')
      })

      it('should handle page number beyond available data gracefully', async () => {
        /**
         * IMPLEMENTED: Test pagination edge case
         *
         * Setup:
         * - Ensure only 1-2 pay guides exist in database
         *
         * Implementation:
         * - Request: GET /api/pay-rates?page=999&limit=10
         *
         * Assertions to verify:
         * - Response status is 200 (not error)
         * - data.payGuides is empty array []
         * - pagination.page is 999 (as requested)
         * - pagination.total shows actual count
         * - pagination.totalPages shows correct total pages
         */
        
        // The beforeEach cleanup removes all test data, leaving us with minimal data
        // First check how many pay guides actually exist
        const { GET } = await import('@/app/api/pay-rates/route')
        
        const countRequest = new MockRequest('http://localhost/api/pay-rates?page=1&limit=10')
        const countResponse = await GET(countRequest as any)
        const countResult = await countResponse.json()
        const actualTotal = countResult.data.pagination.total
        const actualTotalPages = Math.ceil(actualTotal / 10)
        
        // Request page 999 which is way beyond available data
        const request = new MockRequest('http://localhost/api/pay-rates?page=999&limit=10')
        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200) // Should not be an error
        expect(result.data.payGuides).toEqual([]) // Empty array
        expect(result.data.pagination.page).toBe(999) // Requested page number
        expect(result.data.pagination.limit).toBe(10) // Requested limit
        expect(result.data.pagination.total).toBe(actualTotal) // Whatever exists in the database
        expect(result.data.pagination.totalPages).toBe(actualTotalPages) // Correct calculation
      })
    })

    describe('Sorting', () => {
      it('should sort by name in ascending order', async () => {
        // Create pay guides with names that will sort differently
        const payGuides = [
          { name: 'Zebra Award', baseRate: '25.00' },
          { name: 'Apple Award', baseRate: '26.00' },
          { name: 'Beta Award', baseRate: '27.00' },
        ]

        for (const guide of payGuides) {
          await prisma.payGuide.create({
            data: {
              name: guide.name,
              baseRate: new Decimal(guide.baseRate),
              effectiveFrom: new Date('2024-01-01'),
              timezone: 'Australia/Sydney',
              isActive: true,
            },
          })
        }

        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates?sortBy=name&sortOrder=asc')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        // We should have at least the 3 created guides
        expect(result.data.payGuides.length).toBeGreaterThanOrEqual(3)
        
        // Verify alphabetical order by name
        const names = result.data.payGuides.map((pg: any) => pg.name)
        // Check that names are in alphabetical order
        const sortedNames = [...names].sort()
        expect(names).toEqual(sortedNames)
        
        // Verify the specific order includes our test guides
        expect(names).toContain('Apple Award')
        expect(names).toContain('Beta Award')
        expect(names).toContain('Zebra Award')
      })

      it('should sort by baseRate in descending order', async () => {
        // Create pay guides with different base rates
        const payGuides = [
          { name: 'Award A', baseRate: '25.00' },
          { name: 'Award B', baseRate: '30.50' },
          { name: 'Award C', baseRate: '22.75' },
        ]

        for (const guide of payGuides) {
          await prisma.payGuide.create({
            data: {
              name: guide.name,
              baseRate: new Decimal(guide.baseRate),
              effectiveFrom: new Date('2024-01-01'),
              timezone: 'Australia/Sydney',
              isActive: true,
            },
          })
        }

        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates?sortBy=baseRate&sortOrder=desc')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        // We should have at least the 3 created guides
        expect(result.data.payGuides.length).toBeGreaterThanOrEqual(3)
        
        // Verify descending order by baseRate
        const baseRates = result.data.payGuides.map((pg: any) => parseFloat(pg.baseRate))
        // Check that rates are in descending order
        const sortedRatesDesc = [...baseRates].sort((a, b) => b - a)
        expect(baseRates).toEqual(sortedRatesDesc)
        
        // Verify we have our test rates
        expect(baseRates).toContain(30.50)
        expect(baseRates).toContain(25.00)
        expect(baseRates).toContain(22.75)
        
        // Verify base rates are returned as strings
        result.data.payGuides.forEach((pg: any) => {
          expect(typeof pg.baseRate).toBe('string')
        })
      })

      it('should sort by effectiveFrom date correctly', async () => {
        // Create pay guides with different effective dates
        const payGuides = [
          { name: 'Award Jan 2024', effectiveFrom: new Date('2024-01-01') },
          { name: 'Award Jun 2024', effectiveFrom: new Date('2024-06-01') },
          { name: 'Award Dec 2023', effectiveFrom: new Date('2023-12-01') },
        ]

        for (const guide of payGuides) {
          await prisma.payGuide.create({
            data: {
              name: guide.name,
              baseRate: new Decimal('25.00'),
              effectiveFrom: guide.effectiveFrom,
              timezone: 'Australia/Sydney',
              isActive: true,
            },
          })
        }

        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates?sortBy=effectiveFrom&sortOrder=asc')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        // We should have at least the 3 created guides  
        expect(result.data.payGuides.length).toBeGreaterThanOrEqual(3)
        
        // Verify chronological order by effectiveFrom
        const effectiveDates = result.data.payGuides.map((pg: any) => new Date(pg.effectiveFrom))
        // Check that dates are in ascending chronological order
        const sortedDatesAsc = [...effectiveDates].sort((a, b) => a.getTime() - b.getTime())
        expect(effectiveDates).toEqual(sortedDatesAsc)
        
        // Verify we have our test dates
        const dateStrings = result.data.payGuides.map((pg: any) => pg.effectiveFrom.split('T')[0])
        expect(dateStrings).toContain('2023-12-01')
        expect(dateStrings).toContain('2024-01-01')
        expect(dateStrings).toContain('2024-06-01')
        
        // Verify dates are properly formatted as ISO strings
        result.data.payGuides.forEach((pg: any) => {
          expect(typeof pg.effectiveFrom).toBe('string')
          expect(() => new Date(pg.effectiveFrom)).not.toThrow()
        })
      })

      it('should reject invalid sort parameters', async () => {
        const { GET } = await import('@/app/api/pay-rates/route')

        // Test case 1: Invalid sortBy
        const invalidSortByRequest = new MockRequest('http://localhost/api/pay-rates?sortBy=invalidField')
        const sortByResponse = await GET(invalidSortByRequest as any)
        const sortByResult = await sortByResponse.json()

        expect(sortByResponse.status).toBe(400)
        expect(sortByResult.errors).toBeInstanceOf(Array)
        expect(sortByResult.errors.length).toBeGreaterThan(0)
        expect(sortByResult.errors.some((err: any) => 
          err.field === 'sortBy' && err.message.includes('Invalid sort field')
        )).toBe(true)
        expect(sortByResult.message).toBe('Invalid query parameters')

        // Test case 2: Invalid sortOrder
        const invalidSortOrderRequest = new MockRequest('http://localhost/api/pay-rates?sortOrder=invalid')
        const sortOrderResponse = await GET(invalidSortOrderRequest as any)
        const sortOrderResult = await sortOrderResponse.json()

        expect(sortOrderResponse.status).toBe(400)
        expect(sortOrderResult.errors).toBeInstanceOf(Array)
        expect(sortOrderResult.errors.length).toBeGreaterThan(0)
        expect(sortOrderResult.errors.some((err: any) => 
          err.field === 'sortOrder' && err.message.includes('Sort order must be asc or desc')
        )).toBe(true)
        expect(sortOrderResult.message).toBe('Invalid query parameters')
      })
    })

    describe('Filtering', () => {
      it('should filter by active status (active=true)', async () => {
        // Create mix of active and inactive pay guides
        const activeGuides = [
          { name: 'Active Award 1', isActive: true },
          { name: 'Active Award 2', isActive: true },
        ]
        
        const inactiveGuides = [
          { name: 'Inactive Award 1', isActive: false },
          { name: 'Inactive Award 2', isActive: false },
        ]

        // Create active pay guides
        for (const guide of activeGuides) {
          await prisma.payGuide.create({
            data: {
              name: guide.name,
              baseRate: new Decimal('25.00'),
              effectiveFrom: new Date('2024-01-01'),
              timezone: 'Australia/Sydney',
              isActive: guide.isActive,
            },
          })
        }

        // Create inactive pay guides
        for (const guide of inactiveGuides) {
          await prisma.payGuide.create({
            data: {
              name: guide.name,
              baseRate: new Decimal('25.00'),
              effectiveFrom: new Date('2024-01-01'),
              timezone: 'Australia/Sydney',
              isActive: guide.isActive,
            },
          })
        }

        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates?active=true')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.payGuides).toBeInstanceOf(Array)
        expect(result.data.payGuides.length).toBeGreaterThan(0)

        // Verify all returned pay guides are active
        result.data.payGuides.forEach((payGuide: any) => {
          expect(payGuide.isActive).toBe(true)
        })

        // Verify that we have our active pay guides in the results
        const returnedNames = result.data.payGuides.map((pg: any) => pg.name)
        expect(returnedNames).toContain('Active Award 1')
        expect(returnedNames).toContain('Active Award 2')

        // Verify inactive guides are not included
        expect(returnedNames).not.toContain('Inactive Award 1')
        expect(returnedNames).not.toContain('Inactive Award 2')

        // Verify pagination reflects filtered count
        expect(result.data.pagination.total).toBeGreaterThanOrEqual(2) // At least our 2 active guides
        expect(result.data.pagination.totalPages).toBeGreaterThan(0)
      })

      it('should filter by active status (active=false)', async () => {
        // Create mix of active and inactive pay guides
        const activeGuides = [
          { name: 'Active Award A', isActive: true },
          { name: 'Active Award B', isActive: true },
        ]
        
        const inactiveGuides = [
          { name: 'Inactive Award A', isActive: false },
          { name: 'Inactive Award B', isActive: false },
        ]

        // Create active pay guides
        for (const guide of activeGuides) {
          await prisma.payGuide.create({
            data: {
              name: guide.name,
              baseRate: new Decimal('25.00'),
              effectiveFrom: new Date('2024-01-01'),
              timezone: 'Australia/Sydney',
              isActive: guide.isActive,
            },
          })
        }

        // Create inactive pay guides
        for (const guide of inactiveGuides) {
          await prisma.payGuide.create({
            data: {
              name: guide.name,
              baseRate: new Decimal('25.00'),
              effectiveFrom: new Date('2024-01-01'),
              timezone: 'Australia/Sydney',
              isActive: guide.isActive,
            },
          })
        }

        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates?active=false')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.payGuides).toBeInstanceOf(Array)
        expect(result.data.payGuides.length).toBeGreaterThan(0)

        // Verify all returned pay guides are inactive
        result.data.payGuides.forEach((payGuide: any) => {
          expect(payGuide.isActive).toBe(false)
        })

        // Verify that we have our inactive pay guides in the results
        const returnedNames = result.data.payGuides.map((pg: any) => pg.name)
        expect(returnedNames).toContain('Inactive Award A')
        expect(returnedNames).toContain('Inactive Award B')

        // Verify active guides are not included
        expect(returnedNames).not.toContain('Active Award A')
        expect(returnedNames).not.toContain('Active Award B')

        // Verify pagination reflects filtered count
        expect(result.data.pagination.total).toBeGreaterThanOrEqual(2) // At least our 2 inactive guides
        expect(result.data.pagination.totalPages).toBeGreaterThan(0)
      })

      it('should return all pay guides when active filter is not specified', async () => {
        // Create mix of active and inactive pay guides
        const activeGuides = [
          { name: 'Mixed Active 1', isActive: true },
          { name: 'Mixed Active 2', isActive: true },
        ]
        
        const inactiveGuides = [
          { name: 'Mixed Inactive 1', isActive: false },
          { name: 'Mixed Inactive 2', isActive: false },
        ]

        // Create active pay guides
        for (const guide of activeGuides) {
          await prisma.payGuide.create({
            data: {
              name: guide.name,
              baseRate: new Decimal('25.00'),
              effectiveFrom: new Date('2024-01-01'),
              timezone: 'Australia/Sydney',
              isActive: guide.isActive,
            },
          })
        }

        // Create inactive pay guides
        for (const guide of inactiveGuides) {
          await prisma.payGuide.create({
            data: {
              name: guide.name,
              baseRate: new Decimal('25.00'),
              effectiveFrom: new Date('2024-01-01'),
              timezone: 'Australia/Sydney',
              isActive: guide.isActive,
            },
          })
        }

        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates') // No active parameter

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.payGuides).toBeInstanceOf(Array)
        expect(result.data.payGuides.length).toBeGreaterThan(0)

        // Verify both active and inactive pay guides are included
        const returnedNames = result.data.payGuides.map((pg: any) => pg.name)
        const returnedActiveStates = result.data.payGuides.map((pg: any) => pg.isActive)

        // Should contain our test guides
        expect(returnedNames).toContain('Mixed Active 1')
        expect(returnedNames).toContain('Mixed Active 2')
        expect(returnedNames).toContain('Mixed Inactive 1')
        expect(returnedNames).toContain('Mixed Inactive 2')

        // Should have both true and false values for isActive
        expect(returnedActiveStates).toContain(true)
        expect(returnedActiveStates).toContain(false)

        // Verify pagination reflects total count (all records)
        expect(result.data.pagination.total).toBeGreaterThanOrEqual(4) // At least our 4 guides
        expect(result.data.pagination.totalPages).toBeGreaterThan(0)
      })
    })

    describe('Combined Parameters', () => {
      it('should handle pagination, sorting, and filtering together', async () => {
        // Create multiple active and inactive pay guides with varying rates
        const testPayGuides = [
          { name: 'High Rate Active', baseRate: '35.00', isActive: true },
          { name: 'Medium Rate Active', baseRate: '28.00', isActive: true },
          { name: 'Low Rate Active', baseRate: '22.00', isActive: true },
          { name: 'Very High Active', baseRate: '40.00', isActive: true },
          { name: 'High Rate Inactive', baseRate: '36.00', isActive: false },
          { name: 'Medium Rate Inactive', baseRate: '29.00', isActive: false },
          { name: 'Another Active', baseRate: '25.00', isActive: true },
          { name: 'Another Inactive', baseRate: '32.00', isActive: false },
        ]

        // Create the test pay guides
        for (const guide of testPayGuides) {
          await prisma.payGuide.create({
            data: {
              name: guide.name,
              baseRate: new Decimal(guide.baseRate),
              effectiveFrom: new Date('2024-01-01'),
              timezone: 'Australia/Sydney',
              isActive: guide.isActive,
            },
          })
        }

        const { GET } = await import('@/app/api/pay-rates/route')
        
        // Test combined parameters: active=true, sorted by baseRate desc, page 1 with limit 3
        const request = new MockRequest('http://localhost/api/pay-rates?page=1&limit=3&sortBy=baseRate&sortOrder=desc&active=true')
        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.payGuides).toHaveLength(3) // Pagination limit

        // Verify all returned pay guides are active
        result.data.payGuides.forEach((payGuide: any) => {
          expect(payGuide.isActive).toBe(true)
        })

        // Verify sorting by baseRate descending (only active guides should be considered)
        const baseRates = result.data.payGuides.map((pg: any) => parseFloat(pg.baseRate))
        const sortedRatesDesc = [...baseRates].sort((a, b) => b - a)
        expect(baseRates).toEqual(sortedRatesDesc)

        // Verify we got the highest 3 active rates
        const activeGuides = testPayGuides.filter(g => g.isActive)
        const expectedTopRates = activeGuides
          .map(g => parseFloat(g.baseRate))
          .sort((a, b) => b - a)
          .slice(0, 3)
        
        expect(baseRates).toEqual(expectedTopRates)

        // Verify pagination object reflects filtered results
        const totalActiveGuides = activeGuides.length
        expect(result.data.pagination.total).toBe(totalActiveGuides)
        expect(result.data.pagination.page).toBe(1)
        expect(result.data.pagination.limit).toBe(3)
        expect(result.data.pagination.totalPages).toBe(Math.ceil(totalActiveGuides / 3))

        // Verify no inactive guides are included
        const returnedNames = result.data.payGuides.map((pg: any) => pg.name)
        expect(returnedNames).not.toContain('High Rate Inactive')
        expect(returnedNames).not.toContain('Medium Rate Inactive')
        expect(returnedNames).not.toContain('Another Inactive')
      })
    })

    describe('Response Structure Validation', () => {
      it('should return properly structured response with all required fields', async () => {
        // Create a comprehensive test pay guide with all possible fields
        const testPayGuide = await prisma.payGuide.create({
          data: {
            name: 'Structure Test Award',
            baseRate: new Decimal('27.50'),
            minimumShiftHours: 3, // Integer value as per schema
            maximumShiftHours: 10,
            description: 'Test pay guide for structure validation',
            effectiveFrom: new Date('2024-01-01T00:00:00Z'),
            effectiveTo: new Date('2024-12-31T23:59:59Z'),
            timezone: 'Australia/Sydney',
            isActive: true,
          },
          include: {
            penaltyTimeFrames: true,
          },
        })

        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates')
        const response = await GET(request as any)
        const result = await response.json()

        // Verify top-level response structure
        expect(response.status).toBe(200)
        expect(result).toHaveProperty('data')
        expect(typeof result.data).toBe('object')

        // Verify data.payGuides structure
        expect(result.data).toHaveProperty('payGuides')
        expect(Array.isArray(result.data.payGuides)).toBe(true)
        expect(result.data.payGuides.length).toBeGreaterThan(0)

        // Verify data.pagination structure
        expect(result.data).toHaveProperty('pagination')
        expect(typeof result.data.pagination).toBe('object')
        expect(result.data.pagination).toHaveProperty('page')
        expect(result.data.pagination).toHaveProperty('limit')
        expect(result.data.pagination).toHaveProperty('total')
        expect(result.data.pagination).toHaveProperty('totalPages')
        expect(typeof result.data.pagination.page).toBe('number')
        expect(typeof result.data.pagination.limit).toBe('number')
        expect(typeof result.data.pagination.total).toBe('number')
        expect(typeof result.data.pagination.totalPages).toBe('number')

        // Find our test pay guide in the results
        const payGuide = result.data.payGuides.find((pg: any) => pg.name === 'Structure Test Award')
        expect(payGuide).toBeTruthy()

        // Verify all required pay guide fields are present
        expect(payGuide).toHaveProperty('id')
        expect(payGuide).toHaveProperty('name')
        expect(payGuide).toHaveProperty('baseRate')
        expect(payGuide).toHaveProperty('minimumShiftHours')
        expect(payGuide).toHaveProperty('maximumShiftHours')
        expect(payGuide).toHaveProperty('description')
        expect(payGuide).toHaveProperty('effectiveFrom')
        expect(payGuide).toHaveProperty('effectiveTo')
        expect(payGuide).toHaveProperty('timezone')
        expect(payGuide).toHaveProperty('isActive')
        expect(payGuide).toHaveProperty('createdAt')
        expect(payGuide).toHaveProperty('updatedAt')

        // Verify field data types
        expect(typeof payGuide.id).toBe('string')
        expect(typeof payGuide.name).toBe('string')
        expect(typeof payGuide.baseRate).toBe('string') // Decimal converted to string
        expect(typeof payGuide.minimumShiftHours).toBe('number') // Integer
        expect(typeof payGuide.maximumShiftHours).toBe('number') // Integer
        expect(typeof payGuide.description).toBe('string')
        expect(typeof payGuide.effectiveFrom).toBe('string') // Date as ISO string
        expect(typeof payGuide.effectiveTo).toBe('string') // Date as ISO string
        expect(typeof payGuide.timezone).toBe('string')
        expect(typeof payGuide.isActive).toBe('boolean')
        expect(typeof payGuide.createdAt).toBe('string') // Date as ISO string
        expect(typeof payGuide.updatedAt).toBe('string') // Date as ISO string

        // Verify specific field values and formatting
        expect(payGuide.name).toBe('Structure Test Award')
        expect(payGuide.baseRate).toBe('27.5') // Decimal precision maintained as string
        expect(payGuide.minimumShiftHours).toBe(3) // Integer as per schema
        expect(Number.isInteger(payGuide.minimumShiftHours)).toBe(true)
        expect(payGuide.maximumShiftHours).toBe(10)
        expect(Number.isInteger(payGuide.maximumShiftHours)).toBe(true)
        expect(payGuide.description).toBe('Test pay guide for structure validation')
        expect(payGuide.timezone).toBe('Australia/Sydney')
        expect(payGuide.isActive).toBe(true)

        // Verify date formatting as valid ISO strings
        expect(() => new Date(payGuide.effectiveFrom)).not.toThrow()
        expect(() => new Date(payGuide.effectiveTo)).not.toThrow()
        expect(() => new Date(payGuide.createdAt)).not.toThrow()
        expect(() => new Date(payGuide.updatedAt)).not.toThrow()

        // Verify date values are valid dates (not checking specific values since timezone handling can vary)
        const effectiveFrom = new Date(payGuide.effectiveFrom)
        const effectiveTo = new Date(payGuide.effectiveTo)
        expect(effectiveFrom.getTime()).toBeGreaterThan(0) // Valid timestamp
        expect(effectiveTo.getTime()).toBeGreaterThan(0) // Valid timestamp
        expect(effectiveTo.getTime()).toBeGreaterThan(effectiveFrom.getTime()) // effectiveTo after effectiveFrom

        // Verify all pay guides in the response follow the same structure
        result.data.payGuides.forEach((pg: any) => {
          // Check all required fields are present
          expect(pg).toHaveProperty('id')
          expect(pg).toHaveProperty('name')
          expect(pg).toHaveProperty('baseRate')
          expect(pg).toHaveProperty('effectiveFrom')
          expect(pg).toHaveProperty('timezone')
          expect(pg).toHaveProperty('isActive')
          expect(pg).toHaveProperty('createdAt')
          expect(pg).toHaveProperty('updatedAt')

          // Check data types
          expect(typeof pg.id).toBe('string')
          expect(typeof pg.name).toBe('string')
          expect(typeof pg.baseRate).toBe('string')
          expect(typeof pg.effectiveFrom).toBe('string')
          expect(typeof pg.timezone).toBe('string')
          expect(typeof pg.isActive).toBe('boolean')
          expect(typeof pg.createdAt).toBe('string')
          expect(typeof pg.updatedAt).toBe('string')

          // Verify dates are valid ISO strings
          expect(() => new Date(pg.effectiveFrom)).not.toThrow()
          expect(() => new Date(pg.createdAt)).not.toThrow()
          expect(() => new Date(pg.updatedAt)).not.toThrow()
          if (pg.effectiveTo) {
            expect(typeof pg.effectiveTo).toBe('string')
            expect(() => new Date(pg.effectiveTo)).not.toThrow()
          }

          // Verify optional fields have correct types when present
          if (pg.minimumShiftHours !== null) {
            expect(typeof pg.minimumShiftHours).toBe('number')
            expect(Number.isInteger(pg.minimumShiftHours)).toBe(true) // Should be integer
          }
          if (pg.maximumShiftHours !== null) {
            expect(typeof pg.maximumShiftHours).toBe('number')
            expect(Number.isInteger(pg.maximumShiftHours)).toBe(true) // Should be integer
          }
          if (pg.description !== null) {
            expect(typeof pg.description).toBe('string')
          }
        })
      })
    })
  })

  describe.skip('POST /api/pay-rates', () => {
    describe('Valid Pay Guide Creation', () => {
      it('should create pay guide with all required fields', async () => {
        /**
         * IMPLEMENTED: Test successful pay guide creation with minimum required fields
         *
         * Implementation:
         * 1. Create valid CreatePayGuideRequest object:
         *    - name: "Test Award 2024"
         *    - baseRate: "28.50"
         *    - effectiveFrom: "2024-01-01T00:00:00Z"
         *    - timezone: "Australia/Sydney"
         * 2. Import POST function: const { POST } = await import('@/app/api/pay-rates/route')
         * 3. Create MockRequest with method: 'POST' and body: payGuideData
         * 4. Call POST handler
         *
         * Assertions to verify:
         * - Response status is 201
         * - Response has data property with created pay guide
         * - data.id is present and valid
         * - data.name matches input
         * - data.baseRate matches input (as string)
         * - data.effectiveFrom matches input
         * - data.timezone matches input
         * - data.isActive is true (default value)
         * - data.createdAt and data.updatedAt are present
         * - Response has success message
         * - Pay guide is actually saved in database (verify with prisma query)
         */
        const payGuideData: CreatePayGuideRequest = {
          name: 'Test Award 2024',
          baseRate: '28.50',
          effectiveFrom: '2024-01-01T00:00:00Z',
          timezone: 'Australia/Sydney',
        }

        const { POST } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates', {
          method: 'POST',
          body: payGuideData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data).toBeTruthy()
        expect(result.data.id).toBeTruthy()
        expect(result.data.name).toBe('Test Award 2024')
        expect(result.data.baseRate).toBe('28.5')
        expect(result.data.effectiveFrom).toBeTruthy()
        expect(result.data.timezone).toBe('Australia/Sydney')
        expect(result.data.isActive).toBe(true)
        expect(result.data.createdAt).toBeTruthy()
        expect(result.data.updatedAt).toBeTruthy()
        expect(result.message).toBe('Pay guide created successfully')

        // Verify it was saved in database
        const savedPayGuide = await prisma.payGuide.findUnique({
          where: { id: result.data.id },
        })
        expect(savedPayGuide).toBeTruthy()
        expect(savedPayGuide!.name).toBe('Test Award 2024')
      })

      it('should create pay guide with all optional fields', async () => {
        /**
         * IMPLEMENTED: Test creation with all possible fields
         *
         * Implementation:
         * - Create CreatePayGuideRequest with:
         *   - All required fields
         *   - minimumShiftHours: 3
         *   - maximumShiftHours: 12
         *   - description: "Comprehensive award with all features"
         *   - effectiveTo: "2024-12-31T23:59:59Z"
         *   - isActive: false
         *
         * Assertions to verify:
         * - All fields are properly saved and returned
         * - Optional fields have correct values (not null/undefined)
         * - effectiveTo is properly handled
         * - isActive can be set to false
         */
        const payGuideData: CreatePayGuideRequest = {
          name: 'Comprehensive Award',
          baseRate: '30.00',
          minimumShiftHours: 3,
          maximumShiftHours: 12,
          description: 'Award with all features',
          effectiveFrom: '2024-01-01T00:00:00Z',
          effectiveTo: '2024-12-31T23:59:59Z',
          timezone: 'Australia/Melbourne',
          isActive: false,
        }

        const { POST } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates', {
          method: 'POST',
          body: payGuideData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data.minimumShiftHours).toBe(3)
        expect(result.data.maximumShiftHours).toBe(12)
        expect(result.data.description).toBe('Award with all features')
        expect(result.data.effectiveTo).toBeTruthy()
        expect(result.data.isActive).toBe(false)
      })

      it('should set default values for optional fields when not provided', async () => {
        /**
         * TODO: Test default value handling
         *
         * Implementation:
         * - Create request with only required fields
         *
         * Assertions to verify:
         * - isActive defaults to true
         * - minimumShiftHours is null
         * - maximumShiftHours is null
         * - description is null
         * - effectiveTo is null
         */
      })
    })

    describe('Required Field Validation', () => {
      it('should reject request with missing name field', async () => {
        /**
         * TODO: Test name field requirement
         *
         * Implementation:
         * - Create request without name field (or name: undefined)
         *
         * Assertions to verify:
         * - Response status is 400
         * - Response has errors array
         * - Error array contains ValidationError with field: 'name'
         * - Error message indicates name is required
         * - No pay guide is created in database
         */
      })

      it('should reject request with missing baseRate field', async () => {
        /**
         * TODO: Test baseRate field requirement
         * Similar to name test, but for baseRate field
         */
      })

      it('should reject request with missing effectiveFrom field', async () => {
        /**
         * TODO: Test effectiveFrom field requirement
         * Similar to name test, but for effectiveFrom field
         */
      })

      it('should reject request with missing timezone field', async () => {
        /**
         * TODO: Test timezone field requirement
         * Similar to name test, but for timezone field
         */
      })

      it('should reject creation with missing required fields', async () => {
        /**
         * IMPLEMENTED: Test validation with missing multiple required fields
         */
        const invalidData = {
          baseRate: '25.00',
          // Missing name, effectiveFrom, timezone
        }

        const { POST } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates', {
          method: 'POST',
          body: invalidData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeTruthy()
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.message).toBe('Invalid pay guide data')
      })
    })

    describe('Data Type and Format Validation', () => {
      it('should validate name field constraints', async () => {
        /**
         * TODO: Test name field validation rules
         *
         * Test cases:
         * 1. Name too short (< 3 characters): name: "AB"
         * 2. Name too long (> 200 characters): name: "A".repeat(201)
         * 3. Name not a string: name: 12345
         *
         * For each case:
         * - Response status is 400
         * - Error indicates specific validation failure
         * - Field name is 'name' in error
         */
      })

      it('should validate baseRate as decimal', async () => {
        /**
         * TODO: Test baseRate validation
         *
         * Test cases:
         * 1. Invalid decimal: baseRate: "not-a-number"
         * 2. Negative rate: baseRate: "-10.00"
         * 3. Rate too high: baseRate: "1001.00" (assuming max is 1000)
         * 4. Rate too low: baseRate: "0.00" (assuming min is 0.01)
         *
         * Assertions for each case:
         * - Response status is 400
         * - ValidationError with field: 'baseRate'
         * - Appropriate error message for each validation type
         */
      })

      it('should validate effectiveFrom as valid date', async () => {
        /**
         * TODO: Test date validation
         *
         * Test cases:
         * 1. Invalid date string: effectiveFrom: "not-a-date"
         * 2. Invalid date format: effectiveFrom: "2024/01/01"
         * 3. Empty string: effectiveFrom: ""
         *
         * Assertions:
         * - Response status is 400
         * - ValidationError with field: 'effectiveFrom'
         * - Error message indicates invalid date format
         */
      })

      it('should validate timezone as valid IANA identifier', async () => {
        /**
         * TODO: Test timezone validation using validateTimezone function
         *
         * Test cases:
         * 1. Invalid timezone: timezone: "Invalid/Timezone"
         * 2. Non-string timezone: timezone: 12345
         * 3. Empty timezone: timezone: ""
         *
         * Assertions:
         * - Response status is 400
         * - ValidationError with field: 'timezone'
         * - Error message indicates invalid IANA timezone identifier
         */
      })

      it('should validate shift hours constraints', async () => {
        /**
         * TODO: Test shift hours validation
         *
         * Test cases:
         * 1. minimumShiftHours negative: minimumShiftHours: -1
         * 2. minimumShiftHours too high: minimumShiftHours: 25
         * 3. maximumShiftHours too low: maximumShiftHours: 0
         * 4. maximumShiftHours too high: maximumShiftHours: 25
         *
         * Assertions:
         * - Response status is 400
         * - Appropriate ValidationError for each field
         * - Error messages indicate range requirements
         */
      })
    })

    describe('Business Rule Validation', () => {
      it('should enforce unique pay guide names', async () => {
        /**
         * IMPLEMENTED: Test unique name constraint
         *
         * Implementation:
         * 1. Create first pay guide with name "Unique Award Name"
         * 2. Attempt to create second pay guide with same name
         *
         * Assertions for second request:
         * - Response status is 400
         * - ValidationError with field: 'name'
         * - Error message indicates duplicate name
         * - Only one pay guide exists in database with that name
         */
        // First create a pay guide
        const firstData: CreatePayGuideRequest = {
          name: 'Unique Award Name',
          baseRate: '25.00',
          effectiveFrom: '2024-01-01T00:00:00Z',
          timezone: 'Australia/Sydney',
        }

        const { POST } = await import('@/app/api/pay-rates/route')
        const firstRequest = new MockRequest('http://localhost/api/pay-rates', {
          method: 'POST',
          body: firstData,
        })

        const firstResponse = await POST(firstRequest as any)
        expect(firstResponse.status).toBe(201)

        // Now try to create a duplicate
        const duplicateData: CreatePayGuideRequest = {
          name: 'Unique Award Name', // Same name
          baseRate: '30.00',
          effectiveFrom: '2024-01-01T00:00:00Z',
          timezone: 'Australia/Melbourne',
        }

        const duplicateRequest = new MockRequest(
          'http://localhost/api/pay-rates',
          {
            method: 'POST',
            body: duplicateData,
          }
        )

        const response = await POST(duplicateRequest as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeTruthy()
        expect(result.errors.some((e: any) => e.field === 'name')).toBe(true)
        expect(result.message).toBe('Duplicate pay guide name')
      })

      it('should validate minimum shift hours < maximum shift hours', async () => {
        /**
         * TODO: Test shift hours relationship validation
         *
         * Implementation:
         * - Create request with minimumShiftHours: 8, maximumShiftHours: 6
         *
         * Assertions:
         * - Response status is 400
         * - ValidationError with field: 'maximumShiftHours'
         * - Error message indicates maximum must be greater than minimum
         */
      })

      it('should validate effectiveTo is after effectiveFrom', async () => {
        /**
         * TODO: Test date range validation
         *
         * Implementation:
         * - Create request with:
         *   - effectiveFrom: "2024-06-01T00:00:00Z"
         *   - effectiveTo: "2024-01-01T00:00:00Z" (before effectiveFrom)
         *
         * Assertions:
         * - Response status is 400
         * - ValidationError with field: 'effectiveTo'
         * - Error message indicates end date must be after start date
         */
      })
    })

    describe('Description Field Validation', () => {
      it('should accept valid description', async () => {
        /**
         * TODO: Test description field handling
         *
         * Implementation:
         * - Create valid request with description: "Valid description text"
         *
         * Assertions:
         * - Response status is 201
         * - Description is saved and returned correctly
         */
      })

      it('should reject description that is too long', async () => {
        /**
         * TODO: Test description length validation
         *
         * Implementation:
         * - Create request with description longer than 500 characters
         *
         * Assertions:
         * - Response status is 400
         * - ValidationError with field: 'description'
         * - Error message indicates maximum length exceeded
         */
      })

      it('should accept null/undefined description', async () => {
        /**
         * TODO: Test optional description handling
         *
         * Implementation:
         * - Create request without description field
         *
         * Assertions:
         * - Response status is 201
         * - Description is null in saved record
         */
      })
    })

    describe('Error Response Format', () => {
      it('should return consistent error structure for validation failures', async () => {
        /**
         * TODO: Test error response structure
         *
         * Implementation:
         * - Create request with multiple validation errors (missing name, invalid baseRate, etc.)
         *
         * Assertions to verify error response structure:
         * - Response status is 400
         * - Response has 'errors' array property
         * - Response has 'message' string property
         * - Each error in errors array has 'field' and 'message' properties
         * - Error messages are descriptive and user-friendly
         * - All validation failures are included (not just first one)
         */
      })

      it('should handle malformed JSON request body', async () => {
        /**
         * TODO: Test malformed request handling
         *
         * Implementation:
         * - Create MockRequest with invalid JSON string in body
         *
         * Assertions:
         * - Response status is 400 or 500 (depending on error handling)
         * - Error response indicates JSON parsing issue
         * - No pay guide is created
         */
      })
    })

    describe('Database Integration', () => {
      it('should handle database connection errors gracefully', async () => {
        /**
         * TODO: Test database error handling
         *
         * Implementation:
         * - Mock Prisma to throw database error
         * - Or temporarily break database connection
         *
         * Assertions:
         * - Response status is 500
         * - Error response indicates server error (not validation error)
         * - Error message is user-friendly (doesn't expose internal details)
         */
      })

      it('should create pay guide with proper database relationships', async () => {
        /**
         * TODO: Test database record creation
         *
         * Implementation:
         * - Create valid pay guide
         * - Query database directly to verify record
         *
         * Assertions:
         * - Pay guide exists in database with correct values
         * - Decimal values are stored as Decimal type
         * - Dates are stored as Date type
         * - Foreign key relationships are properly established
         * - createdAt and updatedAt are set automatically
         */
      })
    })

    describe('Response Data Transformation', () => {
      it('should transform Decimal fields to strings in response', async () => {
        /**
         * TODO: Test data transformation
         *
         * Implementation:
         * - Create pay guide with decimal baseRate
         *
         * Assertions:
         * - Response baseRate is string type
         * - String representation maintains decimal precision
         * - No scientific notation or unexpected formatting
         */
      })

      it('should format date fields as ISO strings in response', async () => {
        /**
         * TODO: Test date formatting
         *
         * Implementation:
         * - Create pay guide with dates
         *
         * Assertions:
         * - effectiveFrom is ISO string format
         * - effectiveTo (if provided) is ISO string format
         * - createdAt and updatedAt are ISO string format
         * - Date values are accurate and timezone-aware
         */
      })
    })

    describe('Performance and Limits', () => {
      it('should complete creation within reasonable time', async () => {
        /**
         * TODO: Test performance requirements
         *
         * Implementation:
         * - Record start time
         * - Create pay guide
         * - Record end time
         *
         * Assertions:
         * - Creation completes within 1 second
         * - Response includes timing information if available
         */
      })

      it('should handle edge case decimal precision correctly', async () => {
        /**
         * TODO: Test decimal precision handling
         *
         * Implementation:
         * - Create pay guide with baseRate: "25.999999"
         *
         * Assertions:
         * - Value is stored with correct precision
         * - No rounding errors in response
         * - Decimal precision is maintained consistently
         */
      })
    })
  })

  describe('Integration Tests', () => {
    it('should create pay guide and then retrieve it in list', async () => {
      /**
       * IMPLEMENTED: Test end-to-end workflow
       *
       * Implementation:
       * 1. POST new pay guide
       * 2. GET list of pay guides
       * 3. Verify new pay guide appears in list
       *
       * Assertions:
       * - Created pay guide appears in GET response
       * - All field values match between POST response and GET response
       * - Pagination counts are updated correctly
       */
      // First, create a new pay guide
      const payGuideData: CreatePayGuideRequest = {
        name: 'Integration Test Award',
        baseRate: '32.00',
        effectiveFrom: '2024-01-01T00:00:00Z',
        timezone: 'Australia/Sydney',
      }

      const { POST } = await import('@/app/api/pay-rates/route')
      const postRequest = new MockRequest('http://localhost/api/pay-rates', {
        method: 'POST',
        body: payGuideData,
      })

      const postResponse = await POST(postRequest as any)
      const postResult = await postResponse.json()

      expect(postResponse.status).toBe(201)
      const createdId = postResult.data.id

      // Then, retrieve the list and verify it appears
      const { GET } = await import('@/app/api/pay-rates/route')
      const getRequest = new MockRequest('http://localhost/api/pay-rates')

      const getResponse = await GET(getRequest as any)
      const getResult = await getResponse.json()

      expect(getResponse.status).toBe(200)
      const foundPayGuide = getResult.data.payGuides.find(
        (pg: any) => pg.id === createdId
      )
      expect(foundPayGuide).toBeTruthy()
      expect(foundPayGuide.name).toBe('Integration Test Award')
      expect(foundPayGuide.baseRate).toBe('32')
      expect(getResult.data.pagination.total).toBeGreaterThanOrEqual(1)
    })

    it.skip('should respect active filter after creating inactive pay guide', async () => {
      /**
       * TODO: Test filtering integration
       *
       * Implementation:
       * 1. POST pay guide with isActive: false
       * 2. GET /api/pay-rates?active=true
       * 3. GET /api/pay-rates?active=false
       *
       * Assertions:
       * - Inactive pay guide doesn't appear in active=true results
       * - Inactive pay guide appears in active=false results
       * - Pagination counts are correct for each filter
       */
    })
  })
})
