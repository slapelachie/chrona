import { NextRequest, NextResponse } from 'next/server'

// 410 Gone — HECS-HELP thresholds were removed in favor of STSL Schedule 8 rates.
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { error: '410 Gone: HECS thresholds replaced by STSL Schedule 8 rates.' },
    { status: 410 }
  )
}

export async function PUT(_request: NextRequest) {
  return NextResponse.json(
    { error: '410 Gone: HECS thresholds replaced by STSL Schedule 8 rates.' },
    { status: 410 }
  )
}

