import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateAiInsightsTable1709900800000 implements MigrationInterface {
  name = 'CreateAiInsightsTable1709900800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ai_insights',
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
            name: 'type',
            type: 'enum',
            enum: ['productivity', 'time_usage', 'pattern', 'team'],
          },
          {
            name: 'insight',
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
      'ai_insights',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = (await queryRunner.getTable('ai_insights'))!;
    const fk = table.foreignKeys.find((fk) => fk.columnNames.indexOf('user_id') !== -1);
    if (fk) await queryRunner.dropForeignKey('ai_insights', fk);
    await queryRunner.dropTable('ai_insights');
  }
}
