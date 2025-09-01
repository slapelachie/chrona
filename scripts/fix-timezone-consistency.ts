#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { createLocalMidnight, isUTCMidnight, isLocalMidnight } from '../src/lib/timezone';

const prisma = new PrismaClient();

interface TimezoneIssue {
  type: 'shift' | 'public_holiday';
  id: string;
  originalDate: Date;
  correctedDate: Date;
  description: string;
}

async function analyzeTimezoneIssues(): Promise<TimezoneIssue[]> {
  const issues: TimezoneIssue[] = [];

  console.log('🔍 Analyzing timezone inconsistencies...');

  // Check shifts for UTC midnight issues (stored as *T00:00:00.000Z)
  const shifts = await prisma.shift.findMany({
    orderBy: { startTime: 'desc' }
  });

  console.log(`\n📊 Analyzing ${shifts.length} shifts:`);
  for (const shift of shifts) {
    if (isUTCMidnight(shift.startTime)) {
      // This shift starts at UTC midnight, but should use local timezone midnight
      // Calculate what local midnight should be for this date
      const shiftDateStr = shift.startTime.toISOString().split('T')[0]; // Get YYYY-MM-DD
      const correctDate = createLocalMidnight(shiftDateStr);

      issues.push({
        type: 'shift',
        id: shift.id,
        originalDate: shift.startTime,
        correctedDate: correctDate,
        description: `Shift ${shift.id.slice(-8)} starts at UTC midnight instead of local midnight`
      });
    }

    if (shift.endTime && isUTCMidnight(shift.endTime)) {
      // This shift ends at UTC midnight - also needs correction
      const shiftDateStr = shift.endTime.toISOString().split('T')[0]; // Get YYYY-MM-DD
      const correctDate = createLocalMidnight(shiftDateStr);

      issues.push({
        type: 'shift',
        id: shift.id + '_end',
        originalDate: shift.endTime,
        correctedDate: correctDate,
        description: `Shift ${shift.id.slice(-8)} ends at UTC midnight instead of local midnight`
      });
    }
  }

  // Check public holidays for UTC midnight issues
  const publicHolidays = await prisma.publicHoliday.findMany({
    orderBy: { date: 'asc' }
  });

  console.log(`\n📊 Analyzing ${publicHolidays.length} public holidays:`);
  for (const holiday of publicHolidays) {
    if (isUTCMidnight(holiday.date)) {
      // This holiday is stored at UTC midnight, should use local timezone midnight
      const holidayDateStr = holiday.date.toISOString().split('T')[0]; // Get YYYY-MM-DD
      const correctDate = createLocalMidnight(holidayDateStr);

      issues.push({
        type: 'public_holiday',
        id: holiday.id,
        originalDate: holiday.date,
        correctedDate: correctDate,
        description: `Holiday "${holiday.name}" stored at UTC midnight instead of local midnight`
      });
    }
  }

  return issues;
}

async function displayAnalysis(issues: TimezoneIssue[]) {
  console.log(`\n📋 Timezone Issues Found: ${issues.length}`);
  console.log('=' .repeat(60));

  if (issues.length === 0) {
    console.log('✅ No timezone issues found! All dates are correctly stored.');
    return;
  }

  const shiftIssues = issues.filter(i => i.type === 'shift');
  const holidayIssues = issues.filter(i => i.type === 'public_holiday');

  if (shiftIssues.length > 0) {
    console.log(`\n🔄 Shift Issues (${shiftIssues.length}):`);
    for (const issue of shiftIssues.slice(0, 10)) { // Show first 10
      console.log(`  • ${issue.description}`);
      console.log(`    Original: ${issue.originalDate.toISOString()} (${issue.originalDate.toLocaleString('en-AU', {timeZone: 'Australia/Sydney'})})`);
      console.log(`    Corrected: ${issue.correctedDate.toISOString()} (${issue.correctedDate.toLocaleString('en-AU', {timeZone: 'Australia/Sydney'})})`);
      console.log('');
    }
    if (shiftIssues.length > 10) {
      console.log(`    ... and ${shiftIssues.length - 10} more shift issues`);
    }
  }

  if (holidayIssues.length > 0) {
    console.log(`\n🎉 Public Holiday Issues (${holidayIssues.length}):`);
    for (const issue of holidayIssues) {
      console.log(`  • ${issue.description}`);
      console.log(`    Original: ${issue.originalDate.toISOString()} (${issue.originalDate.toLocaleString('en-AU', {timeZone: 'Australia/Sydney'})})`);
      console.log(`    Corrected: ${issue.correctedDate.toISOString()} (${issue.correctedDate.toLocaleString('en-AU', {timeZone: 'Australia/Sydney'})})`);
      console.log('');
    }
  }
}

async function fixTimezoneIssues(issues: TimezoneIssue[], confirm: boolean = false) {
  if (issues.length === 0) {
    console.log('✅ No issues to fix!');
    return;
  }

  if (!confirm) {
    console.log('⚠️  Run with --fix flag to apply corrections');
    return;
  }

  console.log(`\n🔧 Applying ${issues.length} timezone corrections...`);
  
  let fixedCount = 0;
  const errors: string[] = [];

  // Fix shifts
  const shiftIssues = issues.filter(i => i.type === 'shift');
  for (const issue of shiftIssues) {
    try {
      const shiftId = issue.id.includes('_end') ? issue.id.replace('_end', '') : issue.id;
      const isEndTime = issue.id.includes('_end');
      
      if (isEndTime) {
        await prisma.shift.update({
          where: { id: shiftId },
          data: { endTime: issue.correctedDate }
        });
      } else {
        await prisma.shift.update({
          where: { id: shiftId },
          data: { startTime: issue.correctedDate }
        });
      }
      
      fixedCount++;
      console.log(`✅ Fixed shift ${shiftId.slice(-8)} ${isEndTime ? 'end time' : 'start time'}`);
    } catch (error) {
      const errorMsg = `Failed to fix shift ${issue.id}: ${error}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  // Fix public holidays
  const holidayIssues = issues.filter(i => i.type === 'public_holiday');
  for (const issue of holidayIssues) {
    try {
      await prisma.publicHoliday.update({
        where: { id: issue.id },
        data: { date: issue.correctedDate }
      });
      
      fixedCount++;
      console.log(`✅ Fixed holiday ${issue.id.slice(-8)}`);
    } catch (error) {
      const errorMsg = `Failed to fix holiday ${issue.id}: ${error}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  console.log(`\n🎉 Fixed ${fixedCount} out of ${issues.length} issues`);
  if (errors.length > 0) {
    console.log(`❌ ${errors.length} errors occurred`);
    errors.forEach(error => console.log(`   ${error}`));
  }
}

async function verifyCorrections() {
  console.log('\n🔍 Verifying corrections...');
  
  // Re-analyze to see if any issues remain
  const remainingIssues = await analyzeTimezoneIssues();
  
  if (remainingIssues.length === 0) {
    console.log('✅ All timezone issues have been resolved!');
  } else {
    console.log(`⚠️  ${remainingIssues.length} issues still remain`);
    await displayAnalysis(remainingIssues);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');
  const shouldVerify = args.includes('--verify');

  console.log('🕐 Chrona Timezone Consistency Checker');
  console.log('=====================================');

  try {
    if (shouldVerify) {
      await verifyCorrections();
    } else {
      const issues = await analyzeTimezoneIssues();
      await displayAnalysis(issues);
      await fixTimezoneIssues(issues, shouldFix);
      
      if (shouldFix) {
        await verifyCorrections();
      }
    }

    console.log('\n🏁 Timezone consistency check completed');
  } catch (error) {
    console.error('💥 Error during timezone consistency check:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Show usage if no arguments
if (process.argv.length === 2) {
  console.log('Usage:');
  console.log('  npx tsx scripts/fix-timezone-consistency.ts           # Analyze issues only');
  console.log('  npx tsx scripts/fix-timezone-consistency.ts --fix     # Analyze and fix issues');
  console.log('  npx tsx scripts/fix-timezone-consistency.ts --verify  # Verify corrections');
  process.exit(0);
}

main();