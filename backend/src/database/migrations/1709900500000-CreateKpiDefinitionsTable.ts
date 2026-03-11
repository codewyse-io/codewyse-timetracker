import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateKpiDefinitionsTable1709900500000 implements MigrationInterface {
  name = 'CreateKpiDefinitionsTable1709900500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'kpi_definitions',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'role',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'metric_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'unit',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'is_active',
            type: 'tinyint',
            default: 1,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('kpi_definitions');
  }
}
