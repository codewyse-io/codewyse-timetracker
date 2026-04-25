import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCalendarSyncToken1709903000000 implements MigrationInterface {
  name = 'AddCalendarSyncToken1709903000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`google_calendar_connections\` ADD \`sync_token\` TEXT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`google_calendar_connections\` DROP COLUMN \`sync_token\``,
    );
  }
}
