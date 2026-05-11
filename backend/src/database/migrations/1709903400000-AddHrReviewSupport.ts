import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddHrReviewSupport1709903400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── users.is_hr ──
    const users = await queryRunner.getTable('users');
    if (!users?.findColumnByName('is_hr')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'is_hr',
          type: 'tinyint',
          width: 1,
          default: 0,
        }),
      );
    }

    // ── peer_review_responses.kind ──
    const responses = await queryRunner.getTable('peer_review_responses');
    if (!responses?.findColumnByName('kind')) {
      await queryRunner.addColumn(
        'peer_review_responses',
        new TableColumn({
          name: 'kind',
          type: 'enum',
          enum: ['team', 'hr'],
          default: "'team'",
        }),
      );
    }

    // Replace the (survey_id, reviewer_id, reviewee_id) unique index with
    // (survey_id, reviewer_id, reviewee_id, kind) so a person can be reviewed
    // both as a teammate and as HR by the same reviewer.
    //
    // MySQL won't allow us to drop the old index while a foreign key still
    // depends on it (the survey_id FK uses it as its supporting index), so
    // we must CREATE the new index FIRST — once a replacement covering
    // survey_id as its leftmost column exists, MySQL is happy to drop the old.
    const refreshed = await queryRunner.getTable('peer_review_responses');
    const hasNewIdx = refreshed?.indices.some(
      (i) =>
        i.isUnique &&
        i.columnNames.length === 4 &&
        i.columnNames.includes('kind') &&
        i.columnNames.includes('survey_id') &&
        i.columnNames.includes('reviewer_id') &&
        i.columnNames.includes('reviewee_id'),
    );
    if (!hasNewIdx) {
      await queryRunner.createIndex(
        'peer_review_responses',
        new TableIndex({
          name: 'IDX_peer_review_responses_survey_reviewer_reviewee_kind',
          columnNames: ['survey_id', 'reviewer_id', 'reviewee_id', 'kind'],
          isUnique: true,
        }),
      );
    }

    const afterCreate = await queryRunner.getTable('peer_review_responses');
    const oldIdx = afterCreate?.indices.find(
      (i) =>
        i.isUnique &&
        i.columnNames.length === 3 &&
        i.columnNames.includes('survey_id') &&
        i.columnNames.includes('reviewer_id') &&
        i.columnNames.includes('reviewee_id'),
    );
    if (oldIdx) {
      await queryRunner.dropIndex('peer_review_responses', oldIdx);
    }

    // ── extend peer_review_answers.category enum to include HR categories ──
    // MySQL: ALTER COLUMN MODIFY with the new enum values
    await queryRunner.query(
      `ALTER TABLE \`peer_review_answers\` MODIFY \`category\` ENUM(
        'performance',
        'responsibility',
        'knowledge',
        'leadership_collaboration',
        'hr_responsiveness',
        'hr_empathy',
        'hr_fairness',
        'hr_communication'
      ) NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert enum (will fail if any HR rows exist; that's OK — operator must clean up first)
    await queryRunner.query(
      `ALTER TABLE \`peer_review_answers\` MODIFY \`category\` ENUM(
        'performance',
        'responsibility',
        'knowledge',
        'leadership_collaboration'
      ) NOT NULL`,
    );

    // Drop new unique index and recreate the old one
    const responses = await queryRunner.getTable('peer_review_responses');
    const newIdx = responses?.indices.find(
      (i) =>
        i.isUnique &&
        i.columnNames.length === 4 &&
        i.columnNames.includes('kind'),
    );
    if (newIdx) {
      await queryRunner.dropIndex('peer_review_responses', newIdx);
    }
    await queryRunner.createIndex(
      'peer_review_responses',
      new TableIndex({
        name: 'IDX_peer_review_responses_survey_reviewer_reviewee',
        columnNames: ['survey_id', 'reviewer_id', 'reviewee_id'],
        isUnique: true,
      }),
    );

    if (responses?.findColumnByName('kind')) {
      await queryRunner.dropColumn('peer_review_responses', 'kind');
    }

    const users = await queryRunner.getTable('users');
    if (users?.findColumnByName('is_hr')) {
      await queryRunner.dropColumn('users', 'is_hr');
    }
  }
}
