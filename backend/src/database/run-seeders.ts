import dataSource from '../config/typeorm.config';
import { seedKpiDefinitions } from '../modules/kpis/seeds/kpi-definitions.seed';
import { seedSettings } from '../modules/settings/seeds/settings.seed';
import { seedSuperAdmin } from '../modules/users/seeds/super-admin.seed';

async function runSeeders() {
  await dataSource.initialize();
  console.log('Database connected. Running seeders...\n');

  await seedSuperAdmin(dataSource);
  await seedKpiDefinitions(dataSource);
  await seedSettings(dataSource);

  console.log('\nAll seeders completed.');
  await dataSource.destroy();
}

runSeeders().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
