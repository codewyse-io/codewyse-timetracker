import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class CreateDailyFocusScoresTable1709900400000 implements MigrationInterface {
  name = 'CreateDailyFocusScoresTable1709900400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'daily_focus_scores',
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
            name: 'date',
            type: 'date',
          },
          {
            name: 'score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'category',
            type: 'enum',
            enum: ['deep_focus', 'good_focus', 'moderate', 'low_focus'],
            default: "'low_focus'",
          },
          {
            name: 'total_active_time',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_logged_time',
            type: 'int',
            default: 0,
          },
          {
            name: 'idle_interruptions',
            type: 'int',
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
          new TableUnique({ columnNames: ['user_id', 'date'] }),
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'daily_focus_scores',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = (await queryRunner.getTable('daily_focus_scores'))!;
    const fk = table.foreignKeys.find((fk) => fk.columnNames.indexOf('user_id') !== -1);
    if (fk) await queryRunner.dropForeignKey('daily_focus_scores', fk);
    await queryRunner.dropTable('daily_focus_scores');
  }
}
