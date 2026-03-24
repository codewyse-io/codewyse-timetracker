import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateMessagesTable1709902200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'messages',
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
            name: 'senderId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['text', 'file', 'system'],
            default: "'text'",
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'fileUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'fileName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'fileSize',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'mimeType',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'replyToId',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'isEdited',
            type: 'tinyint',
            default: 0,
          },
          {
            name: 'isDeleted',
            type: 'tinyint',
            default: 0,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    // Index for efficient message listing by conversation
    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'IDX_messages_conversation_createdAt',
        columnNames: ['conversationId', 'createdAt'],
      }),
    );

    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({
        columnNames: ['conversationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'conversations',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({
        columnNames: ['senderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({
        columnNames: ['replyToId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'messages',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('messages');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('messages', fk);
      }
    }
    await queryRunner.dropIndex('messages', 'IDX_messages_conversation_createdAt');
    await queryRunner.dropTable('messages');
  }
}
