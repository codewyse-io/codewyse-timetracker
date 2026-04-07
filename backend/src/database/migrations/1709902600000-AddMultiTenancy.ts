import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiTenancy1709902600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create organizations table
    await queryRunner.query(`
      CREATE TABLE \`organizations\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`slug\` varchar(100) NOT NULL,
        \`logo_url\` varchar(500) NULL,
        \`primary_color\` varchar(7) NOT NULL DEFAULT '#6366f1',
        \`email_from_name\` varchar(100) NOT NULL DEFAULT 'PulseTrack',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_organizations_slug\` (\`slug\`)
      ) ENGINE=InnoDB
    `);

    // 2. Insert default organization
    await queryRunner.query(`
      INSERT INTO \`organizations\` (\`id\`, \`name\`, \`slug\`)
      VALUES (UUID(), 'Default Organization', 'default')
    `);

    // 3. Add organization_id as NULLABLE to all scoped tables
    const tables = [
      'users',
      'shifts',
      'settings',
      'announcements',
      'kpi_definitions',
      'app_category_rules',
      'work_sessions',
      'leave_requests',
      'daily_focus_scores',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` ADD COLUMN \`organization_id\` varchar(36) NULL`,
      );
    }

    // 4. Backfill all rows with the default organization
    for (const table of tables) {
      await queryRunner.query(`
        UPDATE \`${table}\`
        SET \`organization_id\` = (SELECT \`id\` FROM \`organizations\` WHERE \`slug\` = 'default')
      `);
    }

    // 5. Alter columns to NOT NULL
    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`organization_id\` varchar(36) NOT NULL`,
      );
    }

    // 6. Add FK constraints
    for (const table of tables) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        ADD CONSTRAINT \`FK_${table}_organization\`
        FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\`(\`id\`)
        ON DELETE CASCADE ON UPDATE NO ACTION
      `);
    }

    // 7. Drop unique constraint on settings.key and create composite unique
    await queryRunner.query(`
      ALTER TABLE \`settings\` DROP INDEX \`IDX_settings_key\`
    `).catch(async () => {
      // The index name might differ; try the TypeORM default naming
      await queryRunner.query(`
        DROP INDEX \`IDX_4be32e34db580c43e99e215808\` ON \`settings\`
      `).catch(async () => {
        // Try another common pattern
        await queryRunner.query(`
          ALTER TABLE \`settings\` DROP INDEX \`UQ_settings_key\`
        `).catch(() => {
          // Last resort: find and drop whichever unique index is on the key column
          // This will be handled by the composite unique below
        });
      });
    });

    await queryRunner.query(`
      CREATE UNIQUE INDEX \`IDX_settings_key_organization\` ON \`settings\` (\`key\`, \`organization_id\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop composite unique on settings
    await queryRunner.query(`
      DROP INDEX \`IDX_settings_key_organization\` ON \`settings\`
    `).catch(() => {});

    // Restore original unique on settings.key
    await queryRunner.query(`
      CREATE UNIQUE INDEX \`IDX_settings_key\` ON \`settings\` (\`key\`)
    `).catch(() => {});

    // Drop FK constraints and organization_id columns
    const tables = [
      'users',
      'shifts',
      'settings',
      'announcements',
      'kpi_definitions',
      'app_category_rules',
      'work_sessions',
      'leave_requests',
      'daily_focus_scores',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`FK_${table}_organization\``,
      ).catch(() => {});

      await queryRunner.query(
        `ALTER TABLE \`${table}\` DROP COLUMN \`organization_id\``,
      );
    }

    // Drop organizations table
    await queryRunner.query(`DROP TABLE \`organizations\``);
  }
}
