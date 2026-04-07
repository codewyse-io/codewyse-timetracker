import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminRole1709902700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Alter the role enum column to include super_admin
    await queryRunner.query(
      `ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'admin', 'employee') NOT NULL DEFAULT 'employee'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove super_admin from enum (first update any super_admin users to admin)
    await queryRunner.query(`UPDATE users SET role = 'admin' WHERE role = 'super_admin'`);
    await queryRunner.query(
      `ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee'`,
    );
  }
}
