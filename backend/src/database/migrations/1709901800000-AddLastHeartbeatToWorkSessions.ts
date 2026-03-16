import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLastHeartbeatToWorkSessions1709901800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'work_sessions',
      new TableColumn({
        name: 'last_heartbeat',
        type: 'datetime',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('work_sessions', 'last_heartbeat');
  }
}
