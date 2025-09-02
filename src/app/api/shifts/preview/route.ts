import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PayCalculator } from '@/lib/calculations/pay-calculator'
import { 
  ShiftPreviewRequest, 
  ShiftPreviewResponse, 
  ApiValidationResponse,
  PayGuide,
  PenaltyTimeFrame
} from '@/types'
import { 
  ValidationResult, 
  validateString, 
  validateNumber, 
  validateDateRange 
} from '@/lib/validation'

// POST /api/shifts/preview - Calculate shift pay without persisting to database
export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now()
    const body: ShiftPreviewRequest = await request.json()

    // Validate request body
    const validator = ValidationResult.create()
    
    validateString(body.payGuideId, 'payGuideId', validator)
    validateString(body.startTime, 'startTime', validator)
    validateString(body.endTime, 'endTime', validator)
    validateNumber(body.breakMinutes, 'breakMinutes', validator, { min: 0, max: 480, integer: true })
    
    // Validate date range
    if (validator.isValid()) {
      validateDateRange(
        body.startTime, 
        body.endTime, 
        validator, 
        { maxDurationHours: 24 }
      )
    }

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid shift preview data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Fetch pay guide with penalty time frames
    const payGuideRecord = await prisma.payGuide.findUnique({
      where: { 
        id: body.payGuideId,
        isActive: true
      },
      include: {
        penaltyTimeFrames: {
          where: { isActive: true }
        }
      }
    })

    if (!payGuideRecord) {
      return NextResponse.json({
        errors: [{ field: 'payGuideId', message: 'Pay guide not found or inactive' }],
        message: 'Invalid pay guide'
      } as ApiValidationResponse, { status: 400 })
    }

    // Transform database records to domain types
    const payGuide: PayGuide = {
      id: payGuideRecord.id,
      name: payGuideRecord.name,
      baseRate: payGuideRecord.baseRate,
      casualLoading: payGuideRecord.casualLoading,
      overtimeRules: payGuideRecord.overtimeRules,
      description: payGuideRecord.description,
      effectiveFrom: payGuideRecord.effectiveFrom,
      effectiveTo: payGuideRecord.effectiveTo,
      isActive: payGuideRecord.isActive,
      createdAt: payGuideRecord.createdAt,
      updatedAt: payGuideRecord.updatedAt
    }

    const penaltyTimeFrames: PenaltyTimeFrame[] = payGuideRecord.penaltyTimeFrames.map(ptf => ({
      id: ptf.id,
      payGuideId: ptf.payGuideId,
      name: ptf.name,
      multiplier: ptf.multiplier,
      dayOfWeek: ptf.dayOfWeek,
      startTime: ptf.startTime,
      endTime: ptf.endTime,
      isPublicHoliday: ptf.isPublicHoliday,
      description: ptf.description,
      isActive: ptf.isActive,
      createdAt: ptf.createdAt,
      updatedAt: ptf.updatedAt
    }))

    // Calculate pay using the calculator
    const calculator = new PayCalculator(payGuide, penaltyTimeFrames)
    
    try {
      const calculation = calculator.calculate(
        new Date(body.startTime),
        new Date(body.endTime),
        body.breakMinutes
      )

      const endTime = Date.now()
      const calculationTime = endTime - startTime

      // Log performance for monitoring
      if (calculationTime > 100) {
        console.warn(`Slow shift preview calculation: ${calculationTime}ms for shift ${body.startTime}-${body.endTime}`)
      }

      const response: ShiftPreviewResponse = {
        calculation
      }

      return NextResponse.json({ 
        data: response,
        meta: {
          calculationTime: `${calculationTime}ms`
        }
      })

    } catch (calculationError: any) {
      console.error('Calculation error:', calculationError)
      
      return NextResponse.json({
        errors: [{ field: 'calculation', message: calculationError.message }],
        message: 'Failed to calculate shift pay'
      } as ApiValidationResponse, { status: 400 })
    }

  } catch (error) {
    console.error('Error in shift preview:', error)
    return NextResponse.json(
      { error: 'Failed to preview shift calculations' },
      { status: 500 }
    )
  }
}

// GET /api/shifts/preview - Get preview calculation for query parameters (for testing)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const payGuideId = searchParams.get('payGuideId')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const breakMinutes = Number(searchParams.get('breakMinutes') || '0')

    if (!payGuideId || !startTime || !endTime) {
      return NextResponse.json({
        errors: [
          { field: 'query', message: 'payGuideId, startTime, and endTime are required query parameters' }
        ],
        message: 'Missing required parameters'
      } as ApiValidationResponse, { status: 400 })
    }

    // Convert to POST request format and delegate
    const postBody: ShiftPreviewRequest = {
      payGuideId,
      startTime,
      endTime,
      breakMinutes
    }

    // Create a new request with POST method and body
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postBody)
    })

    return await POST(postRequest)

  } catch (error) {
    console.error('Error in shift preview GET:', error)
    return NextResponse.json(
      { error: 'Failed to preview shift calculations' },
      { status: 500 }
    )
  }
}