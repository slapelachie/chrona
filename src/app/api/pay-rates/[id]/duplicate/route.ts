import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  ApiValidationResponse,
  DuplicatePayGuideRequest,
  PayGuideResponse,
} from '@/types'
import {
  ValidationResult,
  validateBoolean,
  validateCuid,
  validateDate,
  validateString,
} from '@/lib/validation'
import {
  validateDateRange as validatePayGuideDateRange,
  transformPayGuideToResponse,
} from '@/lib/pay-guide-validation'
import {
  generateUniquePayGuideName,
} from '@/lib/pay-guide-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)

    let body: DuplicatePayGuideRequest | null = null
    const contentLengthHeader = request.headers.get('content-length')
    const hasRequestBody = contentLengthHeader
      ? Number(contentLengthHeader) > 0
      : request.headers.get('content-type')?.includes('application/json')

    if (hasRequestBody) {
      try {
        body = await request.json()
      } catch {
        validator.addError('body', 'Request body must be valid JSON')
      }
    }

    if (body?.name !== undefined) {
      validateString(body.name, 'name', validator, { minLength: 3, maxLength: 200 })
    }

    if (body?.effectiveFrom !== undefined) {
      validateDate(body.effectiveFrom, 'effectiveFrom', validator)
    }

    if (body?.effectiveTo !== undefined && body.effectiveTo !== null) {
      validateDate(body.effectiveTo, 'effectiveTo', validator)
    }

    if (body?.isActive !== undefined) {
      validateBoolean(body.isActive, 'isActive', validator)
    }

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid duplicate request',
        } as ApiValidationResponse,
        { status: 400 },
      )
    }

    const source = await prisma.payGuide.findUnique({
      where: { id },
      include: {
        penaltyTimeFrames: true,
        overtimeTimeFrames: true,
        publicHolidays: true,
      },
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Pay guide not found' },
        { status: 404 },
      )
    }

    const baseName = body?.name?.trim() || `${source.name} Copy`
    const name = await generateUniquePayGuideName(baseName)

    const effectiveFrom = body?.effectiveFrom
      ? new Date(body.effectiveFrom)
      : source.effectiveFrom

    const effectiveTo = body?.effectiveTo === undefined
      ? source.effectiveTo
      : body.effectiveTo === null
        ? null
        : new Date(body.effectiveTo)

    const rangeValidator = ValidationResult.create()
    validatePayGuideDateRange(effectiveFrom, effectiveTo, rangeValidator)
    if (!rangeValidator.isValid()) {
      return NextResponse.json(
        {
          errors: rangeValidator.getErrors(),
          message: 'Invalid effective date range',
        } as ApiValidationResponse,
        { status: 400 },
      )
    }

    const duplicate = await prisma.$transaction(async (tx) => {
      const created = await tx.payGuide.create({
        data: {
          name,
          baseRate: source.baseRate,
          minimumShiftHours: source.minimumShiftHours,
          maximumShiftHours: source.maximumShiftHours,
          description: source.description,
          effectiveFrom,
          effectiveTo,
          timezone: source.timezone,
          isActive: body?.isActive ?? false,
        },
      })

      if (source.penaltyTimeFrames.length > 0) {
        await tx.penaltyTimeFrame.createMany({
          data: source.penaltyTimeFrames.map(({ id, payGuideId, createdAt, updatedAt, ...frame }) => {
            void id
            void payGuideId
            void createdAt
            void updatedAt
            return {
              ...frame,
              payGuideId: created.id,
            }
          }),
        })
      }

      if (source.overtimeTimeFrames.length > 0) {
        await tx.overtimeTimeFrame.createMany({
          data: source.overtimeTimeFrames.map(({ id, payGuideId, createdAt, updatedAt, ...frame }) => {
            void id
            void payGuideId
            void createdAt
            void updatedAt
            return {
              ...frame,
              payGuideId: created.id,
            }
          }),
        })
      }

      if (source.publicHolidays.length > 0) {
        await tx.publicHoliday.createMany({
          data: source.publicHolidays.map(({ id, payGuideId, createdAt, updatedAt, ...holiday }) => {
            void id
            void payGuideId
            void createdAt
            void updatedAt
            return {
              ...holiday,
              payGuideId: created.id,
            }
          }),
        })
      }

      return created
    })

    const responsePayGuide = transformPayGuideToResponse(duplicate)

    return NextResponse.json(
      {
        data: responsePayGuide as PayGuideResponse,
        message: 'Pay guide duplicated successfully',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error duplicating pay guide:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate pay guide' },
      { status: 500 },
    )
  }
}
