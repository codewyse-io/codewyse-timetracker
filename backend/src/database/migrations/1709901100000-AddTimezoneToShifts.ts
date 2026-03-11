import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTimezoneToShifts1709901100000 implements MigrationInterface {
  name = 'AddTimezoneToShifts1709901100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'shifts',
      new TableColumn({
        name: 'timezone',
        type: 'varchar',
        length: '64',
        default: "'UTC'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('shifts', 'timezone');
  }
}
