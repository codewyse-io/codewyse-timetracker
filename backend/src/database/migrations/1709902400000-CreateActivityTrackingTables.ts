import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateActivityTrackingTables1709902400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add summary columns to work_sessions
    await queryRunner.query(`ALTER TABLE work_sessions ADD COLUMN productive_duration INT NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE work_sessions ADD COLUMN unproductive_duration INT NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE work_sessions ADD COLUMN neutral_duration INT NOT NULL DEFAULT 0`);

    // 2. Create activity_logs table
    await queryRunner.createTable(
      new Table({
        name: 'activity_logs',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'session_id', type: 'varchar', length: '36' },
          { name: 'app_name', type: 'varchar', length: '255' },
          { name: 'window_info', type: 'varchar', length: '255', default: "''" },
          { name: 'category', type: 'enum', enum: ['productive', 'neutral', 'unproductive'], default: "'neutral'" },
          { name: 'started_at', type: 'datetime' },
          { name: 'duration_seconds', type: 'int' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'activity_logs',
      new TableForeignKey({
        columnNames: ['session_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'work_sessions',
        onDelete: 'CASCADE',
      }),
    );

    // 3. Create app_category_rules table
    await queryRunner.createTable(
      new Table({
        name: 'app_category_rules',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'app_identifier', type: 'varchar', length: '255' },
          { name: 'match_type', type: 'enum', enum: ['exact', 'contains', 'domain'], default: "'contains'" },
          { name: 'category', type: 'enum', enum: ['productive', 'neutral', 'unproductive'], default: "'neutral'" },
          { name: 'display_name', type: 'varchar', length: '100', default: "''" },
          { name: 'shift_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'designation', type: 'varchar', length: '100', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    // 4. Seed default productive apps
    const productive = [
      // Email & Communication
      { id: 'outlook', name: 'Microsoft Outlook', match: 'contains' },
      { id: 'thunderbird', name: 'Thunderbird', match: 'contains' },
      { id: 'gmail.com', name: 'Gmail', match: 'domain' },
      { id: 'mail.google.com', name: 'Gmail', match: 'domain' },
      { id: 'outlook.live.com', name: 'Outlook Web', match: 'domain' },
      { id: 'outlook.office.com', name: 'Outlook Web', match: 'domain' },
      // Sales & CRM
      { id: 'linkedin.com', name: 'LinkedIn', match: 'domain' },
      { id: 'upwork.com', name: 'Upwork', match: 'domain' },
      { id: 'fiverr.com', name: 'Fiverr', match: 'domain' },
      { id: 'hubspot.com', name: 'HubSpot', match: 'domain' },
      { id: 'salesforce.com', name: 'Salesforce', match: 'domain' },
      { id: 'zoho.com', name: 'Zoho CRM', match: 'domain' },
      { id: 'pipedrive.com', name: 'Pipedrive', match: 'domain' },
      { id: 'calendly.com', name: 'Calendly', match: 'domain' },
      // Documents & Spreadsheets
      { id: 'excel', name: 'Microsoft Excel', match: 'contains' },
      { id: 'winword', name: 'Microsoft Word', match: 'contains' },
      { id: 'powerpnt', name: 'Microsoft PowerPoint', match: 'contains' },
      { id: 'docs.google.com', name: 'Google Docs', match: 'domain' },
      { id: 'sheets.google.com', name: 'Google Sheets', match: 'domain' },
      { id: 'slides.google.com', name: 'Google Slides', match: 'domain' },
      { id: 'drive.google.com', name: 'Google Drive', match: 'domain' },
      { id: 'notion.so', name: 'Notion', match: 'domain' },
      { id: 'Notion', name: 'Notion', match: 'contains' },
      // Development — IDEs & Editors
      { id: 'code', name: 'VS Code', match: 'exact' },
      { id: 'Code', name: 'VS Code', match: 'exact' },
      { id: 'idea64', name: 'IntelliJ IDEA', match: 'contains' },
      { id: 'idea', name: 'IntelliJ IDEA', match: 'exact' },
      { id: 'webstorm', name: 'WebStorm', match: 'contains' },
      { id: 'phpstorm', name: 'PhpStorm', match: 'contains' },
      { id: 'pycharm', name: 'PyCharm', match: 'contains' },
      { id: 'rider', name: 'JetBrains Rider', match: 'contains' },
      { id: 'goland', name: 'GoLand', match: 'contains' },
      { id: 'rubymine', name: 'RubyMine', match: 'contains' },
      { id: 'datagrip', name: 'DataGrip', match: 'contains' },
      { id: 'clion', name: 'CLion', match: 'contains' },
      { id: 'android studio', name: 'Android Studio', match: 'contains' },
      { id: 'xcode', name: 'Xcode', match: 'contains' },
      { id: 'sublime_text', name: 'Sublime Text', match: 'contains' },
      { id: 'notepad++', name: 'Notepad++', match: 'contains' },
      { id: 'vim', name: 'Vim', match: 'exact' },
      { id: 'nvim', name: 'Neovim', match: 'exact' },
      { id: 'cursor', name: 'Cursor', match: 'exact' },
      { id: 'Cursor', name: 'Cursor', match: 'exact' },
      // Development — Source Control & CI/CD
      { id: 'github.com', name: 'GitHub', match: 'domain' },
      { id: 'gitlab.com', name: 'GitLab', match: 'domain' },
      { id: 'bitbucket.org', name: 'Bitbucket', match: 'domain' },
      { id: 'dev.azure.com', name: 'Azure DevOps', match: 'domain' },
      { id: 'vercel.com', name: 'Vercel', match: 'domain' },
      { id: 'netlify.com', name: 'Netlify', match: 'domain' },
      { id: 'aws.amazon.com', name: 'AWS Console', match: 'domain' },
      { id: 'console.cloud.google.com', name: 'Google Cloud', match: 'domain' },
      { id: 'portal.azure.com', name: 'Azure Portal', match: 'domain' },
      // Development — Reference & Learning
      { id: 'stackoverflow.com', name: 'Stack Overflow', match: 'domain' },
      { id: 'developer.mozilla.org', name: 'MDN Docs', match: 'domain' },
      { id: 'npmjs.com', name: 'npm Registry', match: 'domain' },
      { id: 'pypi.org', name: 'PyPI', match: 'domain' },
      { id: 'docs.docker.com', name: 'Docker Docs', match: 'domain' },
      // Development — Database Tools
      { id: 'dbeaver', name: 'DBeaver', match: 'contains' },
      { id: 'pgadmin', name: 'pgAdmin', match: 'contains' },
      { id: 'mysql', name: 'MySQL Workbench', match: 'contains' },
      { id: 'mongodb', name: 'MongoDB Compass', match: 'contains' },
      { id: 'robo3t', name: 'Robo 3T', match: 'contains' },
      { id: 'TablePlus', name: 'TablePlus', match: 'contains' },
      // Development — API Testing
      { id: 'Postman', name: 'Postman', match: 'contains' },
      { id: 'Insomnia', name: 'Insomnia', match: 'contains' },
      // QA & Testing
      { id: 'browserstack.com', name: 'BrowserStack', match: 'domain' },
      { id: 'saucelabs.com', name: 'Sauce Labs', match: 'domain' },
      { id: 'lambdatest.com', name: 'LambdaTest', match: 'domain' },
      { id: 'cypress', name: 'Cypress', match: 'contains' },
      { id: 'selenium', name: 'Selenium', match: 'contains' },
      { id: 'testflight', name: 'TestFlight', match: 'contains' },
      { id: 'testrail.com', name: 'TestRail', match: 'domain' },
      // ── UI/UX Design ──
      { id: 'figma.com', name: 'Figma', match: 'domain' },
      { id: 'Figma', name: 'Figma', match: 'contains' },
      { id: 'sketch', name: 'Sketch', match: 'contains' },
      { id: 'XD', name: 'Adobe XD', match: 'exact' },
      { id: 'zeplin.io', name: 'Zeplin', match: 'domain' },
      { id: 'invisionapp.com', name: 'InVision', match: 'domain' },
      { id: 'framer.com', name: 'Framer', match: 'domain' },
      { id: 'Framer', name: 'Framer', match: 'contains' },
      { id: 'proto.io', name: 'Proto.io', match: 'domain' },
      { id: 'maze.co', name: 'Maze', match: 'domain' },
      { id: 'useberry.com', name: 'Useberry', match: 'domain' },
      { id: 'usertesting.com', name: 'UserTesting', match: 'domain' },
      { id: 'optimal workshop.com', name: 'Optimal Workshop', match: 'domain' },
      { id: 'uxpin.com', name: 'UXPin', match: 'domain' },
      { id: 'balsamiq', name: 'Balsamiq', match: 'contains' },
      { id: 'axure', name: 'Axure RP', match: 'contains' },
      { id: 'principle', name: 'Principle', match: 'contains' },
      { id: 'protopie', name: 'ProtoPie', match: 'contains' },
      { id: 'overflow.io', name: 'Overflow', match: 'domain' },
      { id: 'storybook', name: 'Storybook', match: 'contains' },
      // ── Graphic Design ──
      { id: 'Photoshop', name: 'Adobe Photoshop', match: 'contains' },
      { id: 'Illustrator', name: 'Adobe Illustrator', match: 'contains' },
      { id: 'InDesign', name: 'Adobe InDesign', match: 'contains' },
      { id: 'AfterEffects', name: 'Adobe After Effects', match: 'contains' },
      { id: 'PremierePro', name: 'Adobe Premiere Pro', match: 'contains' },
      { id: 'Premiere Pro', name: 'Adobe Premiere Pro', match: 'contains' },
      { id: 'After Effects', name: 'Adobe After Effects', match: 'contains' },
      { id: 'Lightroom', name: 'Adobe Lightroom', match: 'contains' },
      { id: 'Animate', name: 'Adobe Animate', match: 'contains' },
      { id: 'Dimension', name: 'Adobe Dimension', match: 'contains' },
      { id: 'adobe', name: 'Adobe Creative Suite', match: 'contains' },
      { id: 'canva.com', name: 'Canva', match: 'domain' },
      { id: 'coreldraw', name: 'CorelDRAW', match: 'contains' },
      { id: 'affinity', name: 'Affinity Suite', match: 'contains' },
      { id: 'gimp', name: 'GIMP', match: 'contains' },
      { id: 'inkscape', name: 'Inkscape', match: 'contains' },
      { id: 'blender', name: 'Blender', match: 'contains' },
      { id: 'cinema4d', name: 'Cinema 4D', match: 'contains' },
      { id: 'spline.design', name: 'Spline 3D', match: 'domain' },
      // ── Design Resources & Collaboration ──
      { id: 'whimsical.com', name: 'Whimsical', match: 'domain' },
      { id: 'miro.com', name: 'Miro', match: 'domain' },
      { id: 'lucidchart.com', name: 'Lucidchart', match: 'domain' },
      { id: 'figjam.com', name: 'FigJam', match: 'domain' },
      { id: 'dribbble.com', name: 'Dribbble', match: 'domain' },
      { id: 'behance.net', name: 'Behance', match: 'domain' },
      { id: 'pinterest.com', name: 'Pinterest', match: 'domain' },
      { id: 'unsplash.com', name: 'Unsplash', match: 'domain' },
      { id: 'pexels.com', name: 'Pexels', match: 'domain' },
      { id: 'coolors.co', name: 'Coolors', match: 'domain' },
      { id: 'colorhunt.co', name: 'Color Hunt', match: 'domain' },
      { id: 'fonts.google.com', name: 'Google Fonts', match: 'domain' },
      { id: 'fontawesome.com', name: 'Font Awesome', match: 'domain' },
      { id: 'iconify.design', name: 'Iconify', match: 'domain' },
      { id: 'lottiefiles.com', name: 'LottieFiles', match: 'domain' },
      { id: 'noun project.com', name: 'Noun Project', match: 'domain' },
      { id: 'freepik.com', name: 'Freepik', match: 'domain' },
      { id: 'shutterstock.com', name: 'Shutterstock', match: 'domain' },
      { id: 'stock.adobe.com', name: 'Adobe Stock', match: 'domain' },
      // ── Video & Motion Design ──
      { id: 'davinci', name: 'DaVinci Resolve', match: 'contains' },
      { id: 'finalcut', name: 'Final Cut Pro', match: 'contains' },
      { id: 'Final Cut', name: 'Final Cut Pro', match: 'contains' },
      { id: 'ScreenFlow', name: 'ScreenFlow', match: 'contains' },
      { id: 'OBS', name: 'OBS Studio', match: 'exact' },
      { id: 'obs64', name: 'OBS Studio', match: 'contains' },
      { id: 'loom.com', name: 'Loom', match: 'domain' },
      // Project Management & Product
      { id: 'trello.com', name: 'Trello', match: 'domain' },
      { id: 'asana.com', name: 'Asana', match: 'domain' },
      { id: 'jira', name: 'Jira', match: 'contains' },
      { id: 'atlassian.net', name: 'Jira/Confluence', match: 'domain' },
      { id: 'monday.com', name: 'Monday.com', match: 'domain' },
      { id: 'clickup.com', name: 'ClickUp', match: 'domain' },
      { id: 'linear.app', name: 'Linear', match: 'domain' },
      { id: 'basecamp.com', name: 'Basecamp', match: 'domain' },
      { id: 'productboard.com', name: 'Productboard', match: 'domain' },
      { id: 'amplitude.com', name: 'Amplitude', match: 'domain' },
      { id: 'mixpanel.com', name: 'Mixpanel', match: 'domain' },
      { id: 'hotjar.com', name: 'Hotjar', match: 'domain' },
      { id: 'confluence', name: 'Confluence', match: 'contains' },
      // Video Conferencing
      { id: 'zoom', name: 'Zoom', match: 'contains' },
      { id: 'teams', name: 'Microsoft Teams', match: 'contains' },
      { id: 'meet.google.com', name: 'Google Meet', match: 'domain' },
      { id: 'webex', name: 'Webex', match: 'contains' },
      // Communication
      { id: 'slack', name: 'Slack', match: 'contains' },
      { id: 'slack.com', name: 'Slack', match: 'domain' },
      { id: 'discord', name: 'Discord', match: 'contains' },
      // Social Media for Sales/Marketing
      { id: 'instagram.com', name: 'Instagram', match: 'domain' },
      // Contracts & Signing
      { id: 'docusign.com', name: 'DocuSign', match: 'domain' },
      // Terminal & CLI
      { id: 'WindowsTerminal', name: 'Windows Terminal', match: 'contains' },
      { id: 'Terminal', name: 'Terminal', match: 'exact' },
      { id: 'iTerm2', name: 'iTerm2', match: 'contains' },
      { id: 'powershell', name: 'PowerShell', match: 'contains' },
      { id: 'cmd', name: 'Command Prompt', match: 'exact' },
      { id: 'warp', name: 'Warp Terminal', match: 'contains' },
      // Notes & Documentation
      { id: 'obsidian', name: 'Obsidian', match: 'contains' },
      { id: 'evernote', name: 'Evernote', match: 'contains' },
      { id: 'onenote', name: 'OneNote', match: 'contains' },
      { id: 'bear', name: 'Bear Notes', match: 'exact' },
      // Analytics & Monitoring
      { id: 'analytics.google.com', name: 'Google Analytics', match: 'domain' },
      { id: 'search.google.com', name: 'Google Search Console', match: 'domain' },
      { id: 'grafana', name: 'Grafana', match: 'contains' },
      { id: 'datadog.com', name: 'Datadog', match: 'domain' },
      { id: 'sentry.io', name: 'Sentry', match: 'domain' },
      { id: 'newrelic.com', name: 'New Relic', match: 'domain' },
      // ── AI & Research (all roles) ──
      { id: 'chatgpt.com', name: 'ChatGPT', match: 'domain' },
      { id: 'chat.openai.com', name: 'ChatGPT', match: 'domain' },
      { id: 'claude.ai', name: 'Claude', match: 'domain' },
      { id: 'gemini.google.com', name: 'Gemini', match: 'domain' },
      { id: 'bard.google.com', name: 'Google Bard', match: 'domain' },
      { id: 'copilot.microsoft.com', name: 'Microsoft Copilot', match: 'domain' },
      { id: 'perplexity.ai', name: 'Perplexity', match: 'domain' },
      { id: 'phind.com', name: 'Phind', match: 'domain' },
      { id: 'you.com', name: 'You.com', match: 'domain' },
      { id: 'poe.com', name: 'Poe', match: 'domain' },
      { id: 'huggingface.co', name: 'Hugging Face', match: 'domain' },
      { id: 'midjourney.com', name: 'Midjourney', match: 'domain' },
      { id: 'openai.com', name: 'OpenAI', match: 'domain' },
      { id: 'anthropic.com', name: 'Anthropic', match: 'domain' },
      { id: 'deepseek.com', name: 'DeepSeek', match: 'domain' },
      { id: 'groq.com', name: 'Groq', match: 'domain' },
      { id: 'together.ai', name: 'Together AI', match: 'domain' },
      { id: 'cursor', name: 'Cursor AI', match: 'exact' },
      { id: 'v0.dev', name: 'Vercel v0', match: 'domain' },
      { id: 'bolt.new', name: 'Bolt', match: 'domain' },
      { id: 'replit.com', name: 'Replit', match: 'domain' },
      // ── Research & Knowledge ──
      { id: 'google.com', name: 'Google Search', match: 'domain' },
      { id: 'scholar.google.com', name: 'Google Scholar', match: 'domain' },
      { id: 'wikipedia.org', name: 'Wikipedia', match: 'domain' },
      { id: 'medium.com', name: 'Medium', match: 'domain' },
      { id: 'dev.to', name: 'DEV Community', match: 'domain' },
      { id: 'hashnode.dev', name: 'Hashnode', match: 'domain' },
      { id: 'substack.com', name: 'Substack', match: 'domain' },
      { id: 'quora.com', name: 'Quora', match: 'domain' },
      { id: 'w3schools.com', name: 'W3Schools', match: 'domain' },
      { id: 'udemy.com', name: 'Udemy', match: 'domain' },
      { id: 'coursera.org', name: 'Coursera', match: 'domain' },
      { id: 'pluralsight.com', name: 'Pluralsight', match: 'domain' },
      { id: 'skillshare.com', name: 'Skillshare', match: 'domain' },
      { id: 'linkedin.com/learning', name: 'LinkedIn Learning', match: 'contains' },
    ];

    const unproductive = [
      { id: 'youtube.com', name: 'YouTube', match: 'domain' },
      { id: 'facebook.com', name: 'Facebook', match: 'domain' },
      { id: 'twitter.com', name: 'Twitter/X', match: 'domain' },
      { id: 'x.com', name: 'Twitter/X', match: 'domain' },
      { id: 'reddit.com', name: 'Reddit', match: 'domain' },
      { id: 'tiktok.com', name: 'TikTok', match: 'domain' },
      { id: 'netflix.com', name: 'Netflix', match: 'domain' },
      { id: 'twitch.tv', name: 'Twitch', match: 'domain' },
      { id: 'disneyplus.com', name: 'Disney+', match: 'domain' },
      { id: 'hulu.com', name: 'Hulu', match: 'domain' },
      { id: 'primevideo.com', name: 'Prime Video', match: 'domain' },
      { id: 'spotify.com', name: 'Spotify', match: 'domain' },
    ];

    for (const app of productive) {
      await queryRunner.query(
        `INSERT INTO app_category_rules (id, app_identifier, match_type, category, display_name) VALUES (UUID(), ?, ?, 'productive', ?)`,
        [app.id, app.match, app.name],
      );
    }

    for (const app of unproductive) {
      await queryRunner.query(
        `INSERT INTO app_category_rules (id, app_identifier, match_type, category, display_name) VALUES (UUID(), ?, ?, 'unproductive', ?)`,
        [app.id, app.match, app.name],
      );
    }

    // 5. Add columns to daily_focus_scores
    await queryRunner.query(`ALTER TABLE daily_focus_scores ADD COLUMN productive_time INT NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE daily_focus_scores ADD COLUMN unproductive_time INT NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE daily_focus_scores ADD COLUMN neutral_time INT NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE daily_focus_scores DROP COLUMN neutral_time`);
    await queryRunner.query(`ALTER TABLE daily_focus_scores DROP COLUMN unproductive_time`);
    await queryRunner.query(`ALTER TABLE daily_focus_scores DROP COLUMN productive_time`);

    await queryRunner.dropTable('app_category_rules', true);
    await queryRunner.dropTable('activity_logs', true);

    await queryRunner.query(`ALTER TABLE work_sessions DROP COLUMN neutral_duration`);
    await queryRunner.query(`ALTER TABLE work_sessions DROP COLUMN unproductive_duration`);
    await queryRunner.query(`ALTER TABLE work_sessions DROP COLUMN productive_duration`);
  }
}
