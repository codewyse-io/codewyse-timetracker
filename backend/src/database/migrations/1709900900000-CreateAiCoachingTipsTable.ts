import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateAiCoachingTipsTable1709900900000 implements MigrationInterface {
  name = 'CreateAiCoachingTipsTable1709900900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ai_coaching_tips',
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
            name: 'category',
            type: 'enum',
            enum: ['productivity', 'time_usage', 'workload'],
          },
          {
            name: 'observation',
            type: 'text',
          },
          {
            name: 'recommendation',
            type: 'text',
          },
          {
            name: 'generated_at',
            type: 'datetime',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'ai_coaching_tips',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = (await queryRunner.getTable('ai_coaching_tips'))!;
    const fk = table.foreignKeys.find((fk) => fk.columnNames.indexOf('user_id') !== -1);
    if (fk) await queryRunner.dropForeignKey('ai_coaching_tips', fk);
    await queryRunner.dropTable('ai_coaching_tips');
  }
}
