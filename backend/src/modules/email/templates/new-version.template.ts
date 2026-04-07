export function newVersionTemplate(
  version: string,
  windowsUrl: string | null,
  macUrl: string | null,
  branding: { appName: string; primaryColor: string } = { appName: 'PulseTrack', primaryColor: '#6366f1' },
): string {
  const { appName, primaryColor } = branding;

  const windowsButton = windowsUrl
    ? `<a href="${windowsUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, ${primaryColor}, #818cf8); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 12px; box-shadow: 0 6px 20px ${primaryColor}40; margin: 0 6px 10px;">
        ⊞ Download for Windows
      </a>`
    : '';

  const macButton = macUrl
    ? `<a href="${macUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #1e293b, #475569); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.2); margin: 0 6px 10px;">
         Download for Mac
      </a>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} Update Available</title>
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
              <div style="height: 120px; background: linear-gradient(135deg, ${primaryColor} 0%, #06b6d4 50%, #22d3ee 100%); text-align: center; padding-top: 28px;">
                <div style="font-size: 40px; line-height: 1;">🚀</div>
                <div style="font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.95); margin-top: 8px;">New Update Available</div>
              </div>

              <!-- Content -->
              <table width="100%" cellpadding="0" cellspacing="0" style="padding: 36px 40px 32px;">
                <tr>
                  <td style="text-align: center;">
                    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 800; color: #1e293b;">
                      ${appName} <span style="color: ${primaryColor};">v${version}</span>
                    </h1>
                    <p style="margin: 0 0 28px; font-size: 15px; color: #64748b; line-height: 1.7;">
                      A new version is ready with the latest features, improvements, and bug fixes. Update now to stay current.
                    </p>

                    <!-- Version badge -->
                    <div style="display: inline-block; background: ${primaryColor}10; border: 1px solid ${primaryColor}25; border-radius: 20px; padding: 6px 16px; margin-bottom: 28px;">
                      <span style="font-size: 12px; font-weight: 700; color: ${primaryColor}; letter-spacing: 0.5px;">VERSION ${version}</span>
                    </div>

                    <div style="margin-bottom: 28px;">
                      ${windowsButton}
                      ${macButton}
                    </div>

                    <!-- Info box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                      <tr>
                        <td style="padding: 14px 18px;">
                          <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.6; text-align: center;">
                            ✅ If you already have ${appName} installed, you'll be prompted to update automatically.
                          </p>
                        </td>
                      </tr>
                    </table>
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
