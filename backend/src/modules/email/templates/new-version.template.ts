export function newVersionTemplate(version: string, downloadUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pulse Update Available</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f2f5; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">

          <!-- Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #6c63ff, #00d4ff); border-radius: 12px 12px 0 0;"></td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background: #ffffff; padding: 36px 32px 28px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">

              <!-- Rocket Icon -->
              <div style="text-align: center; margin-bottom: 20px;">
                <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #ede9fe, #dbeafe); line-height: 56px; font-size: 28px;">
                  🚀
                </div>
              </div>

              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #1a1a2e; text-align: center;">
                Pulse v${version} is here!
              </h1>

              <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; line-height: 1.6; text-align: center;">
                A new version of the Pulse desktop app is available. Update now to get the latest features and improvements.
              </p>

              <!-- Download Button -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${downloadUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #6c63ff, #5b8def); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px; box-shadow: 0 4px 12px rgba(108,99,255,0.3);">
                  Download Update
                </a>
              </div>

              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5;">
                If you already have Pulse installed, you'll be prompted to update automatically.
              </p>

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
