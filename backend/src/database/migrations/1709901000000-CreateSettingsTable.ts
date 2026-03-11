import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSettingsTable1709901000000 implements MigrationInterface {
  name = 'CreateSettingsTable1709901000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'settings',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'key',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'value',
            type: 'varchar',
            length: '1000',
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            default: "''",
          },
          {
            name: 'updated_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('settings');
  }
}
