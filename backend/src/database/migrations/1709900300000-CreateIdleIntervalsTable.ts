import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateIdleIntervalsTable1709900300000 implements MigrationInterface {
  name = 'CreateIdleIntervalsTable1709900300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'idle_intervals',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'session_id',
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
          },
          {
            name: 'duration',
            type: 'int',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'idle_intervals',
      new TableForeignKey({
        columnNames: ['session_id'],
        referencedTableName: 'work_sessions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = (await queryRunner.getTable('idle_intervals'))!;
    const fk = table.foreignKeys.find((fk) => fk.columnNames.indexOf('session_id') !== -1);
    if (fk) await queryRunner.dropForeignKey('idle_intervals', fk);
    await queryRunner.dropTable('idle_intervals');
  }
}
