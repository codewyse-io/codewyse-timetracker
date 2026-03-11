import dataSource from '../config/typeorm.config';
import { seedTestUsers } from '../modules/users/seeds/test-user.seed';
import { seedKpiDefinitions } from '../modules/kpis/seeds/kpi-definitions.seed';
import { seedSettings } from '../modules/settings/seeds/settings.seed';

async function runSeeders() {
  await dataSource.initialize();
  console.log('Database connected. Running seeders...\n');

  await seedTestUsers(dataSource);
  await seedKpiDefinitions(dataSource);
  await seedSettings(dataSource);

  console.log('\nAll seeders completed.');
  await dataSource.destroy();
}

runSeeders().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
