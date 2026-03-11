import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAllowedLeavesToUsers1709901600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'allowedLeavesPerYear',
        type: 'int',
        default: 20,
        isNullable: false,
      }),
    );
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'consumedLeaves',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'consumedLeaves');
    await queryRunner.dropColumn('users', 'allowedLeavesPerYear');
  }
}
