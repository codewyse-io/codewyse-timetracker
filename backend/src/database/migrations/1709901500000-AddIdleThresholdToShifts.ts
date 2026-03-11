import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIdleThresholdToShifts1709901500000 implements MigrationInterface {
  name = 'AddIdleThresholdToShifts1709901500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'shifts',
      new TableColumn({
        name: 'idle_threshold_minutes',
        type: 'int',
        default: 3,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('shifts', 'idle_threshold_minutes');
  }
}
