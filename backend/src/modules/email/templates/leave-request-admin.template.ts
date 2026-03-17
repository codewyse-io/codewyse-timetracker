export function leaveRequestAdminTemplate(
  employeeName: string,
  subject: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  message: string,
  adminPanelUrl: string,
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Leave Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f2f5; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">

          <!-- Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #f59e0b, #ef4444); border-radius: 12px 12px 0 0;"></td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background: #ffffff; padding: 36px 32px 28px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">

              <!-- Icon -->
              <div style="text-align: center; margin-bottom: 20px;">
                <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #fef3c7, #fde68a); line-height: 56px; font-size: 28px;">
                  📋
                </div>
              </div>

              <h1 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1a1a2e; text-align: center;">
                New Leave Request
              </h1>

              <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280; text-align: center;">
                <strong style="color: #1a1a2e;">${employeeName}</strong> has submitted a leave request.
              </p>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px; border: 1px solid #f3f4f6;">
                <tr>
                  <td style="padding: 6px 12px; font-size: 12px; color: #9ca3af; font-weight: 500;">Subject</td>
                  <td style="padding: 6px 12px; font-size: 13px; color: #374151; font-weight: 600; text-align: right;">${subject}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; font-size: 12px; color: #9ca3af; font-weight: 500;">Duration</td>
                  <td style="padding: 6px 12px; font-size: 13px; color: #374151; font-weight: 600; text-align: right;">${totalDays} day${totalDays !== 1 ? 's' : ''}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; font-size: 12px; color: #9ca3af; font-weight: 500;">Start Date</td>
                  <td style="padding: 6px 12px; font-size: 13px; color: #374151; font-weight: 600; text-align: right;">${startDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; font-size: 12px; color: #9ca3af; font-weight: 500;">End Date</td>
                  <td style="padding: 6px 12px; font-size: 13px; color: #374151; font-weight: 600; text-align: right;">${endDate}</td>
                </tr>
              </table>

              ${message ? `
              <div style="background: #f9fafb; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; border: 1px solid #f3f4f6;">
                <p style="margin: 0 0 4px; font-size: 11px; color: #9ca3af; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Message</p>
                <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.6;">${message}</p>
              </div>
              ` : ''}

              <!-- Review Button -->
              <div style="text-align: center; margin-bottom: 16px;">
                <a href="${adminPanelUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #6c63ff, #5b8def); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px; box-shadow: 0 4px 12px rgba(108,99,255,0.3);">
                  Review Request
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                Powered by <span style="color: #6c63ff; font-weight: 600;">CodeWyse</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
