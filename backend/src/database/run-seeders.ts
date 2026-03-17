import dataSource from '../config/typeorm.config';
import { seedKpiDefinitions } from '../modules/kpis/seeds/kpi-definitions.seed';
import { seedSettings } from '../modules/settings/seeds/settings.seed';

async function runSeeders() {
  await dataSource.initialize();
  console.log('Database connected. Running seeders...\n');

  await seedKpiDefinitions(dataSource);
  await seedSettings(dataSource);

  console.log('\nAll seeders completed.');
  await dataSource.destroy();
}

runSeeders().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
