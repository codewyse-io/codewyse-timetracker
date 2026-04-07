import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';

export async function seedSuperAdmin(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(User);
  const email = 'admin@pulsetrack.com';

  const exists = await repo.findOne({ where: { email } });
  if (exists) {
    // Update to super_admin if not already
    if (exists.role !== 'super_admin') {
      exists.role = 'super_admin' as any;
      await repo.save(exists);
      console.log(`Updated ${email} to super_admin`);
    } else {
      console.log(`Super admin ${email} already exists`);
    }
    return;
  }

  const password = await bcrypt.hash('Code-wyse@2025', 12);
  await repo.save(repo.create({
    email,
    firstName: 'Code',
    lastName: 'Wyse',
    password,
    role: 'super_admin' as any,
    status: 'active' as any,
    hourlyRate: 0,
  }));
  console.log(`Created super admin: ${email}`);
}
