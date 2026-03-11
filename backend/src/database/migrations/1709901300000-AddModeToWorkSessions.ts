import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddModeToWorkSessions1709901300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'work_sessions',
      new TableColumn({
        name: 'mode',
        type: 'varchar',
        length: '20',
        default: "'regular'",
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('work_sessions', 'mode');
  }
}
