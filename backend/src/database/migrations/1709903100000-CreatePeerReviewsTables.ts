import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePeerReviewsTables1709903100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── peer_review_surveys ──
    await queryRunner.createTable(
      new Table({
        name: 'peer_review_surveys',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'organization_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'period_month',
            type: 'varchar',
            length: '7',
          },
          {
            name: 'opens_at',
            type: 'datetime',
          },
          {
            name: 'closes_at',
            type: 'datetime',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['open', 'closed'],
            default: "'open'",
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'peer_review_surveys',
      new TableIndex({
        name: 'IDX_peer_review_surveys_org_period',
        columnNames: ['organization_id', 'period_month'],
        isUnique: true,
      }),
    );

    // ── peer_review_responses ──
    await queryRunner.createTable(
      new Table({
        name: 'peer_review_responses',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'survey_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'reviewer_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'reviewee_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'submitted'],
            default: "'draft'",
          },
          {
            name: 'submitted_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'comment',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'peer_review_responses',
      new TableIndex({
        name: 'IDX_peer_review_responses_survey_reviewer_reviewee',
        columnNames: ['survey_id', 'reviewer_id', 'reviewee_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'peer_review_responses',
      new TableForeignKey({
        columnNames: ['survey_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'peer_review_surveys',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'peer_review_responses',
      new TableForeignKey({
        columnNames: ['reviewer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'peer_review_responses',
      new TableForeignKey({
        columnNames: ['reviewee_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    // ── peer_review_answers ──
    await queryRunner.createTable(
      new Table({
        name: 'peer_review_answers',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'response_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'question_key',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'category',
            type: 'enum',
            enum: ['performance', 'responsibility', 'knowledge', 'leadership_collaboration'],
          },
          {
            name: 'score',
            type: 'tinyint',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'peer_review_answers',
      new TableIndex({
        name: 'IDX_peer_review_answers_response_question',
        columnNames: ['response_id', 'question_key'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'peer_review_answers',
      new TableForeignKey({
        columnNames: ['response_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'peer_review_responses',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const answers = await queryRunner.getTable('peer_review_answers');
    if (answers) {
      for (const fk of answers.foreignKeys) {
        await queryRunner.dropForeignKey('peer_review_answers', fk);
      }
    }
    await queryRunner.dropTable('peer_review_answers', true);

    const responses = await queryRunner.getTable('peer_review_responses');
    if (responses) {
      for (const fk of responses.foreignKeys) {
        await queryRunner.dropForeignKey('peer_review_responses', fk);
      }
    }
    await queryRunner.dropTable('peer_review_responses', true);

    await queryRunner.dropTable('peer_review_surveys', true);
  }
}
