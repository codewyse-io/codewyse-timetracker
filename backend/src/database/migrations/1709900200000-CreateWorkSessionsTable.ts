import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateWorkSessionsTable1709900200000 implements MigrationInterface {
  name = 'CreateWorkSessionsTable1709900200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'work_sessions',
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
            name: 'start_time',
            type: 'datetime',
          },
          {
            name: 'end_time',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'total_duration',
            type: 'int',
            default: 0,
          },
          {
            name: 'idle_duration',
            type: 'int',
            default: 0,
          },
          {
            name: 'active_duration',
            type: 'int',
            default: 0,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'completed'],
            default: "'active'",
          },
          {
            name: 'created_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'work_sessions',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = (await queryRunner.getTable('work_sessions'))!;
    const fk = table.foreignKeys.find((fk) => fk.columnNames.indexOf('user_id') !== -1);
    if (fk) await queryRunner.dropForeignKey('work_sessions', fk);
    await queryRunner.dropTable('work_sessions');
  }
}
