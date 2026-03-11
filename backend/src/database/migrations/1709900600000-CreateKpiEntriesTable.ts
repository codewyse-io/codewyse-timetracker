import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateKpiEntriesTable1709900600000 implements MigrationInterface {
  name = 'CreateKpiEntriesTable1709900600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'kpi_entries',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'kpi_definition_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'value',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'period',
            type: 'enum',
            enum: ['weekly', 'monthly'],
          },
          {
            name: 'period_start',
            type: 'date',
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'kpi_entries',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'kpi_entries',
      new TableForeignKey({
        columnNames: ['kpi_definition_id'],
        referencedTableName: 'kpi_definitions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = (await queryRunner.getTable('kpi_entries'))!;
    for (const fk of table.foreignKeys) {
      await queryRunner.dropForeignKey('kpi_entries', fk);
    }
    await queryRunner.dropTable('kpi_entries');
  }
}
