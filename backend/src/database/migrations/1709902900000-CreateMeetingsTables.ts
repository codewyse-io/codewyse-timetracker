import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateMeetingsTables1709902900000 implements MigrationInterface {
  name = 'CreateMeetingsTables1709902900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create google_calendar_connections table
    await queryRunner.createTable(
      new Table({
        name: 'google_calendar_connections',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'organization_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'google_email',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'access_token',
            type: 'text',
          },
          {
            name: 'refresh_token',
            type: 'text',
          },
          {
            name: 'token_expiry',
            type: 'datetime',
          },
          {
            name: 'calendar_sync_enabled',
            type: 'tinyint',
            default: 1,
          },
          {
            name: 'last_sync_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
        uniques: [
          {
            name: 'UQ_google_calendar_connections_user_id',
            columnNames: ['user_id'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'google_calendar_connections',
      new TableForeignKey({
        name: 'FK_google_calendar_connections_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'google_calendar_connections',
      new TableForeignKey({
        name: 'FK_google_calendar_connections_organization',
        columnNames: ['organization_id'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create meetings table
    await queryRunner.createTable(
      new Table({
        name: 'meetings',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'organization_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'meeting_url',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'platform',
            type: 'enum',
            enum: ['google_meet', 'zoom', 'teams', 'other'],
            default: "'google_meet'",
          },
          {
            name: 'scheduled_start',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'scheduled_end',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'google_event_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'recall_bot_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['scheduled', 'bot_joining', 'recording', 'processing', 'completed', 'failed'],
            default: "'scheduled'",
          },
          {
            name: 'recording_s3_key',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'transcript_text',
            type: 'longtext',
            isNullable: true,
          },
          {
            name: 'summary',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'action_items',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'duration_seconds',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'participants',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    );

    // Foreign keys for meetings
    await queryRunner.createForeignKey(
      'meetings',
      new TableForeignKey({
        name: 'FK_meetings_organization',
        columnNames: ['organization_id'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'meetings',
      new TableForeignKey({
        name: 'FK_meetings_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Indexes for meetings
    await queryRunner.createIndex(
      'meetings',
      new TableIndex({
        name: 'IDX_meetings_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'meetings',
      new TableIndex({
        name: 'IDX_meetings_organization_id',
        columnNames: ['organization_id'],
      }),
    );

    await queryRunner.createIndex(
      'meetings',
      new TableIndex({
        name: 'IDX_meetings_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'meetings',
      new TableIndex({
        name: 'IDX_meetings_google_event_id',
        columnNames: ['google_event_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('meetings');
    await queryRunner.dropTable('google_calendar_connections');
  }
}
