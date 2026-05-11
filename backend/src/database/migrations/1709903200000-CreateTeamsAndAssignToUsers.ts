import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateTeamsAndAssignToUsers1709903200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── teams ──
    await queryRunner.createTable(
      new Table({
        name: 'teams',
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
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'teams',
      new TableIndex({
        name: 'IDX_teams_org_name',
        columnNames: ['organization_id', 'name'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'teams',
      new TableForeignKey({
        columnNames: ['organization_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      }),
    );

    // ── users.team_id ──
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'team_id',
        type: 'varchar',
        length: '36',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'users',
      new TableForeignKey({
        columnNames: ['team_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'teams',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users');
    const fk = users?.foreignKeys.find((f) => f.columnNames.includes('team_id'));
    if (fk) await queryRunner.dropForeignKey('users', fk);
    if (users?.findColumnByName('team_id')) {
      await queryRunner.dropColumn('users', 'team_id');
    }

    const teams = await queryRunner.getTable('teams');
    if (teams) {
      for (const f of teams.foreignKeys) {
        await queryRunner.dropForeignKey('teams', f);
      }
    }
    await queryRunner.dropTable('teams', true);
  }
}
