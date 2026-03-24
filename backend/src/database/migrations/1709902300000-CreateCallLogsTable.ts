import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateCallLogsTable1709902300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'call_logs',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['audio', 'video'],
            default: "'audio'",
          },
          {
            name: 'state',
            type: 'enum',
            enum: ['ringing', 'connecting', 'connected', 'ended', 'missed', 'declined'],
            default: "'ringing'",
          },
          {
            name: 'initiatorId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'participantIds',
            type: 'text',
            comment: 'JSON array of user IDs',
          },
          {
            name: 'startedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'connectedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'endedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'durationSeconds',
            type: 'int',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'call_logs',
      new TableForeignKey({
        columnNames: ['initiatorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('call_logs');
    const fk = table?.foreignKeys.find((f) => f.columnNames.includes('initiatorId'));
    if (fk) await queryRunner.dropForeignKey('call_logs', fk);
    await queryRunner.dropTable('call_logs');
  }
}
