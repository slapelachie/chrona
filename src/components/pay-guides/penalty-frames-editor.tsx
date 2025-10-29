"use client"

import React from 'react'
import { TimeFramesEditor } from './time-frames-editor'

interface Props {
  payGuideId: string
}

export const PenaltyFramesEditor: React.FC<Props> = ({ payGuideId }) => {
  return <TimeFramesEditor variant="penalty" payGuideId={payGuideId} />
}

