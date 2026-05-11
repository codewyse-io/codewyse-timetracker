import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateTeamMembersJoinTable1709903300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── If a previous schema put users.team_id in place, migrate the data
    //    over to the new join table and drop the column. ──
    const usersTable = await queryRunner.getTable('users');
    const hasTeamIdCol = !!usersTable?.findColumnByName('team_id');

    // ── team_members join table ──
    await queryRunner.createTable(
      new Table({
        name: 'team_members',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'team_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '36',
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
      'team_members',
      new TableIndex({
        name: 'IDX_team_members_team_user',
        columnNames: ['team_id', 'user_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'team_members',
      new TableIndex({
        name: 'IDX_team_members_user',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'team_members',
      new TableForeignKey({
        columnNames: ['team_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'teams',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'team_members',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    if (hasTeamIdCol) {
      // Carry existing single-team assignments into the join table
      await queryRunner.query(
        `INSERT INTO team_members (id, team_id, user_id, created_at)
         SELECT UUID(), team_id, id, NOW()
         FROM users
         WHERE team_id IS NOT NULL`,
      );

      const fresh = await queryRunner.getTable('users');
      const teamIdFk = fresh?.foreignKeys.find((f) =>
        f.columnNames.includes('team_id'),
      );
      if (teamIdFk) {
        await queryRunner.dropForeignKey('users', teamIdFk);
      }
      await queryRunner.dropColumn('users', 'team_id');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tm = await queryRunner.getTable('team_members');
    if (tm) {
      for (const f of tm.foreignKeys) {
        await queryRunner.dropForeignKey('team_members', f);
      }
    }
    await queryRunner.dropTable('team_members', true);
  }
}
