import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

// Test the Saturday scenarios
const timeZone = 'Australia/Brisbane'

console.log('=== Saturday Penalty Test ===')
const shiftStart1 = new Date('2025-07-05T10:00:00+10:00') // Saturday 10am
const shiftEnd1 = new Date('2025-07-06T04:00:00+10:00') // Sunday 4am (typo in test comment)

console.log('Shift start (local):', formatInTimeZone(shiftStart1, timeZone, 'yyyy-MM-dd HH:mm:ss'))
console.log('Shift end (local):', formatInTimeZone(shiftEnd1, timeZone, 'yyyy-MM-dd HH:mm:ss'))
console.log('Shift start day of week:', shiftStart1.getDay()) // Should be 6 for Saturday

const startYmd1 = formatInTimeZone(shiftStart1, timeZone, 'yyyy-MM-dd')
const endYmd1 = formatInTimeZone(shiftEnd1, timeZone, 'yyyy-MM-dd')
console.log('Start YMD:', startYmd1)
console.log('End YMD:', endYmd1)

let dayCursor1 = fromZonedTime(`${startYmd1}T00:00:00`, timeZone)
const lastDay1 = fromZonedTime(`${endYmd1}T00:00:00`, timeZone)
console.log('Day cursor:', formatInTimeZone(dayCursor1, timeZone, 'yyyy-MM-dd HH:mm:ss'))
console.log('Last day:', formatInTimeZone(lastDay1, timeZone, 'yyyy-MM-dd HH:mm:ss'))

console.log('\n=== Saturday Morning Penalty Test ===')
const shiftStart2 = new Date('2025-07-05T04:00:00+10:00') // Saturday 4am
const shiftEnd2 = new Date('2025-07-05T10:00:00+10:00') // Saturday 10am

console.log('Shift start (local):', formatInTimeZone(shiftStart2, timeZone, 'yyyy-MM-dd HH:mm:ss'))
console.log('Shift end (local):', formatInTimeZone(shiftEnd2, timeZone, 'yyyy-MM-dd HH:mm:ss'))
console.log('Shift start day of week:', shiftStart2.getDay()) // Should be 6 for Saturday

const startYmd2 = formatInTimeZone(shiftStart2, timeZone, 'yyyy-MM-dd')
const endYmd2 = formatInTimeZone(shiftEnd2, timeZone, 'yyyy-MM-dd')
console.log('Start YMD:', startYmd2)
console.log('End YMD:', endYmd2)

// Test the specific rule period calculation for Saturday 00:00-07:00
const ruleStartUtc = fromZonedTime(`${startYmd2}T00:00:00`, timeZone)
const ruleEndUtc = fromZonedTime(`${startYmd2}T07:00:00`, timeZone)
console.log('Rule start UTC:', ruleStartUtc.toISOString())
console.log('Rule end UTC:', ruleEndUtc.toISOString())
console.log('Shift start UTC:', shiftStart2.toISOString())
console.log('Shift end UTC:', shiftEnd2.toISOString())

// Intersection calculation
const a = ruleStartUtc > shiftStart2 ? ruleStartUtc : shiftStart2
const b = ruleEndUtc < shiftEnd2 ? ruleEndUtc : shiftEnd2
console.log('Intersection start:', a.toISOString())
console.log('Intersection end:', b.toISOString())
console.log('Valid intersection?', b > a)