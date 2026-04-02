import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankAccountFields1709902500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN bank_name VARCHAR(100) NULL`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN account_holder_name VARCHAR(150) NULL`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN account_number VARCHAR(50) NULL`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN iban VARCHAR(50) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN iban`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN account_number`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN account_holder_name`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN bank_name`);
  }
}
