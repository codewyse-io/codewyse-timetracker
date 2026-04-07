import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrencyToOrganizations1709902800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE organizations ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'USD'`);
    await queryRunner.query(`ALTER TABLE organizations ADD COLUMN currency_symbol VARCHAR(5) NOT NULL DEFAULT '$'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE organizations DROP COLUMN currency_symbol`);
    await queryRunner.query(`ALTER TABLE organizations DROP COLUMN currency`);
  }
}
