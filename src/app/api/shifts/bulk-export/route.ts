import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface BulkExportRequest {
  shiftIds: string[];
  format: 'csv' | 'pdf';
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkExportRequest = await request.json();
    const { shiftIds, format } = body;

    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json(
        { error: 'shiftIds array is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!format || !['csv', 'pdf'].includes(format)) {
      return NextResponse.json(
        { error: 'format must be either "csv" or "pdf"' },
        { status: 400 }
      );
    }

    // Validate that all shiftIds are strings
    if (!shiftIds.every(id => typeof id === 'string')) {
      return NextResponse.json(
        { error: 'All shift IDs must be valid strings' },
        { status: 400 }
      );
    }

    // Fetch shifts with all needed data
    const shifts = await prisma.shift.findMany({
      where: {
        id: {
          in: shiftIds
        },
        userId: 'default-user' // TODO: Replace with actual user ID from auth
      },
      include: {
        payGuide: true
      },
      orderBy: [
        { startTime: 'desc' },
        { id: 'desc' }
      ]
    });

    if (shifts.length === 0) {
      return NextResponse.json(
        { error: 'No shifts found with the provided IDs' },
        { status: 404 }
      );
    }

    if (shifts.length !== shiftIds.length) {
      return NextResponse.json(
        { error: 'Some shifts were not found or do not belong to you' },
        { status: 404 }
      );
    }

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Date',
        'Start Time',
        'End Time',
        'Break (mins)',
        'Total Hours',
        'Regular Hours',
        'Overtime Hours',
        'Penalty Hours',
        'Shift Type',
        'Status',
        'Location',
        'Notes',
        'Pay Guide',
        'Gross Pay',
        'Superannuation'
      ];

      const csvRows = shifts.map(shift => {
        const startDate = new Date(shift.startTime);
        const endDate = shift.endTime ? new Date(shift.endTime) : null;
        
        return [
          startDate.toLocaleDateString('en-AU'),
          startDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
          endDate ? endDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
          shift.breakMinutes.toString(),
          shift.totalMinutes ? (shift.totalMinutes / 60).toFixed(2) : '',
          shift.regularHours ? shift.regularHours.toFixed(2) : '',
          shift.overtimeHours ? shift.overtimeHours.toFixed(2) : '',
          shift.penaltyHours ? shift.penaltyHours.toFixed(2) : '',
          shift.shiftType,
          shift.status,
          shift.location || '',
          shift.notes || '',
          shift.payGuide?.name || '',
          shift.grossPay ? shift.grossPay.toFixed(2) : '',
          shift.superannuation ? shift.superannuation.toFixed(2) : ''
        ].map(field => `"${field.toString().replace(/"/g, '""')}"`);
      });

      const csvContent = [csvHeaders.map(h => `"${h}"`), ...csvRows]
        .map(row => row.join(','))
        .join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="shifts-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });

    } else {
      // Generate PDF (basic HTML to PDF conversion)
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Shifts Export</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              font-size: 12px; 
            }
            h1 { 
              color: #333; 
              border-bottom: 2px solid #007bff; 
              padding-bottom: 10px; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px; 
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left; 
            }
            th { 
              background-color: #f8f9fa; 
              font-weight: bold; 
            }
            tr:nth-child(even) { 
              background-color: #f8f9fa; 
            }
            .summary {
              background: #e3f2fd;
              padding: 15px;
              border-radius: 5px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <h1>Shifts Export</h1>
          <div class="summary">
            <strong>Export Date:</strong> ${new Date().toLocaleDateString('en-AU')}<br>
            <strong>Total Shifts:</strong> ${shifts.length}<br>
            <strong>Total Hours:</strong> ${shifts.reduce((sum, shift) => sum + (shift.totalMinutes || 0), 0) / 60} hours<br>
            <strong>Total Pay:</strong> $${shifts.reduce((sum, shift) => sum + Number(shift.grossPay || 0), 0).toFixed(2)}
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Start</th>
                <th>End</th>
                <th>Break</th>
                <th>Hours</th>
                <th>Type</th>
                <th>Status</th>
                <th>Location</th>
                <th>Pay</th>
              </tr>
            </thead>
            <tbody>
              ${shifts.map(shift => {
                const startDate = new Date(shift.startTime);
                const endDate = shift.endTime ? new Date(shift.endTime) : null;
                
                return `
                  <tr>
                    <td>${startDate.toLocaleDateString('en-AU')}</td>
                    <td>${startDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                    <td>${endDate ? endDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A'}</td>
                    <td>${shift.breakMinutes} mins</td>
                    <td>${shift.totalMinutes ? (shift.totalMinutes / 60).toFixed(1) : 'N/A'}</td>
                    <td>${shift.shiftType}</td>
                    <td>${shift.status}</td>
                    <td>${shift.location || 'N/A'}</td>
                    <td>$${shift.grossPay ? shift.grossPay.toFixed(2) : '0.00'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          ${shifts.some(s => s.notes) ? `
            <h2>Notes</h2>
            ${shifts.filter(s => s.notes).map(shift => `
              <div style="margin-bottom: 15px; padding: 10px; border-left: 3px solid #007bff;">
                <strong>${new Date(shift.startTime).toLocaleDateString('en-AU')}:</strong> ${shift.notes}
              </div>
            `).join('')}
          ` : ''}
        </body>
        </html>
      `;

      // For now, return HTML content. In a production app, you'd use a PDF library like puppeteer
      // This is a simplified implementation for the MVP
      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="shifts-export-${new Date().toISOString().split('T')[0]}.html"`
        }
      });
    }

  } catch (error) {
    console.error('Error exporting shifts:', error);
    return NextResponse.json(
      { error: 'Failed to export shifts' },
      { status: 500 }
    );
  }
}