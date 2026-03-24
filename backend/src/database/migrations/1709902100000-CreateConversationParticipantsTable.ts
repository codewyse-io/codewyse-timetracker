import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class CreateConversationParticipantsTable1709902100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'conversation_participants',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'conversationId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['owner', 'member'],
            default: "'member'",
          },
          {
            name: 'lastReadMessageId',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'lastReadAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'joinedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_conversation_user',
            columnNames: ['conversationId', 'userId'],
          }),
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'conversation_participants',
      new TableForeignKey({
        columnNames: ['conversationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'conversations',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'conversation_participants',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('conversation_participants');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('conversation_participants', fk);
      }
    }
    await queryRunner.dropTable('conversation_participants');
  }
}
