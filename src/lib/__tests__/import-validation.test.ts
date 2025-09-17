import { 
  validateShiftsImport, 
  validatePayGuidesImport, 
  validateTaxDataImport,
  generateRenameSuggestion 
} from '../import-validation'
import { prisma } from '@/lib/db'
import { ImportShiftsRequest, ImportPayGuidesRequest, ImportTaxDataRequest } from '@/types'

jest.mock('@/lib/db', () => ({
  prisma: {
    payGuide: {
      findMany: jest.fn()
    },
    shift: {
      findMany: jest.fn()
    }
  }
}))

describe('import-validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateShiftsImport', () => {
    const validShiftsRequest: ImportShiftsRequest = {
      shifts: [
        {
          payGuideName: 'Retail Award',
          startTime: '2023-12-01T09:00:00Z',
          endTime: '2023-12-01T17:00:00Z',
          notes: 'Test shift'
        }
      ],
      options: {
        conflictResolution: 'skip',
        validatePayGuides: true
      }
    }

    it('should validate valid shifts request', async () => {
      ;(prisma.payGuide.findMany as jest.Mock).mockResolvedValue([
        { name: 'Retail Award', isActive: true }
      ])
      ;(prisma.shift.findMany as jest.Mock).mockResolvedValue([])

      const validator = await validateShiftsImport(validShiftsRequest)

      expect(validator.hasErrors()).toBe(false)
      expect(validator.getErrors()).toHaveLength(0)
    })

    it('should reject non-array shifts', async () => {
      const invalidRequest = {
        ...validShiftsRequest,
        shifts: 'not an array' as any
      }

      const validator = await validateShiftsImport(invalidRequest)

      expect(validator.hasErrors()).toBe(true)
      expect(validator.getErrors()[0].message).toBe('Shifts must be an array')
    })

    it('should reject empty shifts array', async () => {
      const invalidRequest = {
        ...validShiftsRequest,
        shifts: []
      }

      const validator = await validateShiftsImport(invalidRequest)

      expect(validator.hasErrors()).toBe(true)
      expect(validator.getErrors()[0].message).toBe('No shifts provided for import')
    })

    it('should validate required fields', async () => {
      const invalidRequest: ImportShiftsRequest = {
        shifts: [
          {
            payGuideName: '',
            startTime: '',
            endTime: '2023-12-01T17:00:00Z'
          }
        ],
        options: {
          conflictResolution: 'skip',
          validatePayGuides: true
        }
      }

      const validator = await validateShiftsImport(invalidRequest)

      expect(validator.hasErrors()).toBe(true)
      const errors = validator.getErrors()
      expect(errors.some(e => e.field === 'payGuideName')).toBe(true)
      expect(errors.some(e => e.field === 'startTime')).toBe(true)
    })

    it('should validate date range', async () => {
      const invalidRequest: ImportShiftsRequest = {
        shifts: [
          {
            payGuideName: 'Retail Award',
            startTime: '2023-12-01T17:00:00Z',
            endTime: '2023-12-01T09:00:00Z' // End before start
          }
        ],
        options: {
          conflictResolution: 'skip',
          validatePayGuides: true
        }
      }

      const validator = await validateShiftsImport(invalidRequest)

      expect(validator.hasErrors()).toBe(true)
      expect(validator.getErrors().some(e => e.message.includes('End time must be after start time'))).toBe(true)
    })

    it('should validate pay guide existence', async () => {
      ;(prisma.payGuide.findMany as jest.Mock).mockResolvedValue([
        { name: 'Different Award', isActive: true }
      ])

      const validator = await validateShiftsImport(validShiftsRequest)

      expect(validator.hasErrors()).toBe(true)
      expect(validator.getErrors()[0].message).toContain('Pay guide "Retail Award" not found')
    })

    it('should detect shift conflicts', async () => {
      ;(prisma.payGuide.findMany as jest.Mock).mockResolvedValue([
        { name: 'Retail Award', isActive: true }
      ])
      ;(prisma.shift.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'existing1',
          startTime: new Date('2023-12-01T08:00:00Z'),
          endTime: new Date('2023-12-01T16:00:00Z')
        }
      ])

      const validator = await validateShiftsImport(validShiftsRequest)

      expect(validator.getWarnings()).toHaveLength(1)
      expect(validator.getWarnings()[0].message).toContain('overlaps with existing shift')
    })
  })

  describe('validatePayGuidesImport', () => {
    const validPayGuidesRequest: ImportPayGuidesRequest = {
      payGuides: [
        {
          name: 'New Award',
          baseRate: '25.50',
          effectiveFrom: '2023-01-01T00:00:00Z',
          timezone: 'Australia/Sydney'
        }
      ],
      options: {
        conflictResolution: 'skip',
        activateImported: true
      }
    }

    it('should validate valid pay guides request', async () => {
      ;(prisma.payGuide.findMany as jest.Mock).mockResolvedValue([])

      const validator = await validatePayGuidesImport(validPayGuidesRequest)

      expect(validator.hasErrors()).toBe(false)
      expect(validator.getErrors()).toHaveLength(0)
    })

    it('should validate required fields', async () => {
      const invalidRequest: ImportPayGuidesRequest = {
        payGuides: [
          {
            name: '',
            baseRate: 'invalid',
            effectiveFrom: '',
            timezone: 'Australia/Sydney'
          }
        ],
        options: {
          conflictResolution: 'skip',
          activateImported: true
        }
      }

      const validator = await validatePayGuidesImport(invalidRequest)

      expect(validator.hasErrors()).toBe(true)
      const errors = validator.getErrors()
      expect(errors.some(e => e.field === 'name')).toBe(true)
      expect(errors.some(e => e.field === 'baseRate')).toBe(true)
      expect(errors.some(e => e.field === 'effectiveFrom')).toBe(true)
    })

    it('should detect duplicate names within import', async () => {
      const invalidRequest: ImportPayGuidesRequest = {
        payGuides: [
          {
            name: 'Duplicate Award',
            baseRate: '25.50',
            effectiveFrom: '2023-01-01T00:00:00Z'
          },
          {
            name: 'Duplicate Award',
            baseRate: '26.00',
            effectiveFrom: '2023-01-01T00:00:00Z'
          }
        ],
        options: {
          conflictResolution: 'skip',
          activateImported: true
        }
      }

      const validator = await validatePayGuidesImport(invalidRequest)

      expect(validator.hasErrors()).toBe(true)
      expect(validator.getErrors().some(e => e.message.includes('Duplicate pay guide name'))).toBe(true)
    })

    it('should detect conflicts with existing pay guides', async () => {
      ;(prisma.payGuide.findMany as jest.Mock).mockResolvedValue([
        { name: 'New Award', isActive: true }
      ])

      const validator = await validatePayGuidesImport(validPayGuidesRequest)

      expect(validator.getWarnings()).toHaveLength(1)
      expect(validator.getWarnings()[0].message).toContain('already exists and will be skipped')
    })
  })

  describe('validateTaxDataImport', () => {
    const validTaxDataRequest: ImportTaxDataRequest = {
      taxSettings: {
        claimedTaxFreeThreshold: true,
        isForeignResident: false,
        hasTaxFileNumber: true,
        medicareExemption: 'none',
        hecsHelpRate: '0.02'
      },
      taxCoefficients: [
        {
          taxYear: '2023-24',
          scale: 'scale1',
          earningsFrom: '0',
          earningsTo: '100',
          coefficientA: '0.19',
          coefficientB: '0'
        }
      ],
      options: {
        conflictResolution: 'skip',
        replaceExisting: false
      }
    }

    it('should validate valid tax data request', async () => {
      const validator = await validateTaxDataImport(validTaxDataRequest)

      expect(validator.hasErrors()).toBe(false)
      expect(validator.getErrors()).toHaveLength(0)
    })

    it('should validate tax settings fields', async () => {
      const invalidRequest: ImportTaxDataRequest = {
        taxSettings: {
          medicareExemption: 'invalid' as any,
          hecsHelpRate: '15.0' // Too high
        },
        options: {
          conflictResolution: 'skip',
          replaceExisting: false
        }
      }

      const validator = await validateTaxDataImport(invalidRequest)

      expect(validator.hasErrors()).toBe(true)
      const errors = validator.getErrors()
      expect(errors.some(e => e.message.includes('Medicare exemption must be'))).toBe(true)
      expect(errors.some(e => e.message.includes('HECS-HELP rate must be between'))).toBe(true)
    })

    it('should validate tax coefficient fields', async () => {
      const invalidRequest: ImportTaxDataRequest = {
        taxCoefficients: [
          {
            taxYear: '',
            scale: '',
            earningsFrom: '-100',
            coefficientA: 'invalid',
            coefficientB: '-50'
          }
        ],
        options: {
          conflictResolution: 'skip',
          replaceExisting: false
        }
      }

      const validator = await validateTaxDataImport(invalidRequest)

      expect(validator.hasErrors()).toBe(true)
      const errors = validator.getErrors()
      expect(errors.some(e => e.field.includes('taxYear'))).toBe(true)
      expect(errors.some(e => e.field.includes('scale'))).toBe(true)
      expect(errors.some(e => e.field.includes('earningsFrom'))).toBe(true)
      expect(errors.some(e => e.field.includes('coefficientA'))).toBe(true)
    })
  })

  describe('generateRenameSuggestion', () => {
    it('should generate first rename suggestion', () => {
      const existingNames = new Set(['Original Name'])
      const suggestion = generateRenameSuggestion('Original Name', existingNames)
      
      expect(suggestion).toBe('Original Name (imported)')
    })

    it('should increment counter for multiple conflicts', () => {
      const existingNames = new Set([
        'Original Name',
        'Original Name (imported)',
        'Original Name (imported 2)'
      ])
      const suggestion = generateRenameSuggestion('Original Name', existingNames)
      
      expect(suggestion).toBe('Original Name (imported 3)')
    })

    it('should handle no conflicts', () => {
      const existingNames = new Set(['Different Name'])
      const suggestion = generateRenameSuggestion('Original Name', existingNames)
      
      expect(suggestion).toBe('Original Name (imported)')
    })
  })
})