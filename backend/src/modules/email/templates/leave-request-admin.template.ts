export function leaveRequestAdminTemplate(
  employeeName: string,
  subject: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  message: string,
  adminPanelUrl: string,
  branding: { appName: string; primaryColor: string } = { appName: 'PulseTrack', primaryColor: '#6366f1' },
): string {
  const { appName, primaryColor } = branding;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Leave Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f6fb; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 540px;">

          <!-- Card -->
          <tr>
            <td style="background: #ffffff; border-radius: 20px; box-shadow: 0 8px 40px rgba(0,0,0,0.06); overflow: hidden;">

              <!-- Header banner -->
              <div style="height: 100px; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); text-align: center; padding-top: 28px;">
                <div style="font-size: 32px; line-height: 1;">📋</div>
                <div style="font-size: 16px; font-weight: 700; color: rgba(255,255,255,0.95); margin-top: 6px;">Leave Request</div>
              </div>

              <!-- Content -->
              <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px 40px 28px;">
                <tr>
                  <td>
                    <h2 style="margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #1e293b; text-align: center;">
                      New Request from ${employeeName}
                    </h2>
                    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b; text-align: center; line-height: 1.6;">
                      A team member has submitted a leave request for your review.
                    </p>

                    <!-- Details -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-bottom: 20px;">
                      <tr>
                        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8;">Subject</span>
                          <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 4px;">${subject}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="50%">
                                <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8;">From</span>
                                <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 4px;">${startDate}</div>
                              </td>
                              <td width="50%">
                                <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8;">To</span>
                                <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 4px;">${endDate}</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 20px;">
                          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8;">Duration</span>
                          <div style="font-size: 20px; font-weight: 800; color: #f59e0b; margin-top: 4px;">${totalDays} day${totalDays !== 1 ? 's' : ''}</div>
                        </td>
                      </tr>
                    </table>

                    ${message ? `
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 14px 18px;">
                          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #0369a1; margin-bottom: 6px;">💬 Message</div>
                          <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.6;">${message}</p>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    <!-- Review Button -->
                    <div style="text-align: center; margin-bottom: 8px;">
                      <a href="${adminPanelUrl}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, ${primaryColor}, #818cf8); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 12px; box-shadow: 0 6px 20px ${primaryColor}40; letter-spacing: 0.3px;">
                        Review Request &rarr;
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px 0 0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} ${appName} &middot; Powered by <span style="color: ${primaryColor}; font-weight: 600;">CodeWyse</span>
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
