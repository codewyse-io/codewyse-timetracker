import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateShiftsTable1709900100000 implements MigrationInterface {
  name = 'CreateShiftsTable1709900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'shifts',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'start_time',
            type: 'varchar',
            length: '5',
          },
          {
            name: 'end_time',
            type: 'varchar',
            length: '5',
          },
          {
            name: 'allowed_days',
            type: 'text',
          },
          {
            name: 'is_active',
            type: 'tinyint',
            default: 1,
          },
          {
            name: 'created_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
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
    await queryRunner.dropTable('shifts');
  }
}
