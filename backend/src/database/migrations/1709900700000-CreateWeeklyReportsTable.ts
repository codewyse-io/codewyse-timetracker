import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class CreateWeeklyReportsTable1709900700000 implements MigrationInterface {
  name = 'CreateWeeklyReportsTable1709900700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'weekly_reports',
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
            name: 'week_start',
            type: 'date',
          },
          {
            name: 'week_end',
            type: 'date',
          },
          {
            name: 'total_hours_worked',
            type: 'decimal',
            precision: 8,
            scale: 2,
            default: 0,
          },
          {
            name: 'active_hours',
            type: 'decimal',
            precision: 8,
            scale: 2,
            default: 0,
          },
          {
            name: 'idle_hours',
            type: 'decimal',
            precision: 8,
            scale: 2,
            default: 0,
          },
          {
            name: 'focus_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'kpi_summary',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'payable_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'created_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
          },
        ],
        uniques: [
          new TableUnique({ columnNames: ['user_id', 'week_start'] }),
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'weekly_reports',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = (await queryRunner.getTable('weekly_reports'))!;
    const fk = table.foreignKeys.find((fk) => fk.columnNames.indexOf('user_id') !== -1);
    if (fk) await queryRunner.dropForeignKey('weekly_reports', fk);
    await queryRunner.dropTable('weekly_reports');
  }
}
