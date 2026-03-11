import { DataSource } from 'typeorm';
import { Setting } from '../entities/setting.entity';

const defaultSettings = [
  {
    key: 'idle_threshold_minutes',
    value: '3',
    description: 'Number of minutes of inactivity before marking as idle',
  },
  {
    key: 'focus_penalty_per_interruption',
    value: '2',
    description: 'Focus score penalty points per excess idle interruption',
  },
  {
    key: 'max_interruptions_before_penalty',
    value: '5',
    description: 'Number of idle interruptions allowed before penalties apply',
  },
];

export async function seedSettings(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Setting);

  for (const setting of defaultSettings) {
    const exists = await repo.findOne({ where: { key: setting.key } });
    if (!exists) {
      await repo.save(repo.create(setting));
    }
  }

  console.log(`Seeded ${defaultSettings.length} default settings`);
}
