import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameRoleToDesignationInKpiDefinitions1709901400000 implements MigrationInterface {
  name = 'RenameRoleToDesignationInKpiDefinitions1709901400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE kpi_definitions CHANGE COLUMN \`role\` \`designation\` varchar(100) NOT NULL`);
    // Clear old snake_case seed data so fresh seeds can be inserted
    await queryRunner.query(`DELETE FROM kpi_definitions`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE kpi_definitions CHANGE COLUMN \`designation\` \`role\` varchar(100) NOT NULL`);
  }
}
