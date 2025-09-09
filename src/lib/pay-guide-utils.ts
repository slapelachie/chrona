import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'
import { UpdatePayGuideRequest } from '@/types'

export const checkPayGuideNameUniqueness = async (
  name: string,
  excludeId?: string
): Promise<boolean> => {
  const existingPayGuide = await prisma.payGuide.findUnique({
    where: { name },
  })

  // If no existing pay guide found, name is unique
  if (!existingPayGuide) return true

  // If we're excluding an ID (for updates), check if it's the same pay guide
  if (excludeId && existingPayGuide.id === excludeId) return true

  // Name is not unique
  return false
}

export const buildPayGuideUpdateData = (body: UpdatePayGuideRequest): any => {
  const updateData: any = {}
  
  if (body.name !== undefined) updateData.name = body.name
  if (body.baseRate !== undefined) updateData.baseRate = new Decimal(body.baseRate)
  if (body.minimumShiftHours !== undefined) updateData.minimumShiftHours = body.minimumShiftHours
  if (body.maximumShiftHours !== undefined) updateData.maximumShiftHours = body.maximumShiftHours
  if (body.description !== undefined) updateData.description = body.description
  if (body.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(body.effectiveFrom)
  if (body.effectiveTo !== undefined) updateData.effectiveTo = new Date(body.effectiveTo)
  if (body.timezone !== undefined) updateData.timezone = body.timezone
  if (body.isActive !== undefined) updateData.isActive = body.isActive

  return updateData
}

export const getPayGuide = async (id: string) => {
  return await prisma.payGuide.findUnique({
    where: { id }
  })
}

export const createPayGuideData = (body: any) => {
  return {
    name: body.name,
    baseRate: new Decimal(body.baseRate),
    minimumShiftHours: body.minimumShiftHours,
    maximumShiftHours: body.maximumShiftHours,
    description: body.description,
    effectiveFrom: new Date(body.effectiveFrom),
    effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
    timezone: body.timezone,
    isActive: body.isActive !== undefined ? body.isActive : true,
  }
}