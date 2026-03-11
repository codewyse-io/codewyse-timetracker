import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDesignationToUsers1709901200000 implements MigrationInterface {
  name = 'AddDesignationToUsers1709901200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'designation',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'designation');
  }
}
