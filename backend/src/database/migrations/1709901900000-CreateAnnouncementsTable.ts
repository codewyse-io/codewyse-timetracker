import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateAnnouncementsTable1709901900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'announcements',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'message', type: 'text' },
          { name: 'type', type: 'enum', enum: ['general', 'holiday', 'meeting', 'memo', 'urgent'], default: "'general'" },
          { name: 'priority', type: 'enum', enum: ['low', 'normal', 'high'], default: "'normal'" },
          { name: 'created_by', type: 'varchar', length: '36' },
          { name: 'is_active', type: 'tinyint', default: 1 },
          { name: 'expires_at', type: 'datetime', isNullable: true },
          { name: 'created_at', type: 'datetime', length: '6', default: 'CURRENT_TIMESTAMP(6)' },
          { name: 'updated_at', type: 'datetime', length: '6', default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'announcements',
      new TableForeignKey({
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('announcements');
    const fk = table?.foreignKeys.find((f) => f.columnNames.includes('created_by'));
    if (fk) await queryRunner.dropForeignKey('announcements', fk);
    await queryRunner.dropTable('announcements');
  }
}
