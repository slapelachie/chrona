import { NextRequest, NextResponse } from 'next/server'
import { getFinancialYearStatistics } from '@/lib/statistics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taxYear = searchParams.get('taxYear')
    const data = await getFinancialYearStatistics(taxYear)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching financial year statistics', error)
    return NextResponse.json(
      { error: 'Failed to load financial year statistics' },
      { status: 500 }
    )
  }
}
