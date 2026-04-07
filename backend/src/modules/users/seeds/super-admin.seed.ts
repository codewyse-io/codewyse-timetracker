import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';

export async function seedSuperAdmin(dataSource: DataSource): Promise<void> {
  const userRepo = dataSource.getRepository(User);
  const orgRepo = dataSource.getRepository(Organization);
  const email = 'admin@pulsetrack.com';

  // Get or create a default organization for the super admin
  let defaultOrg = await orgRepo.findOne({ where: { slug: 'default' } });
  if (!defaultOrg) {
    defaultOrg = await orgRepo.save(orgRepo.create({
      name: 'Default Organization',
      slug: 'default',
    }));
    console.log('Created default organization');
  }

  const exists = await userRepo.findOne({ where: { email } });
  if (exists) {
    if (exists.role !== 'super_admin') {
      exists.role = 'super_admin' as any;
      await userRepo.save(exists);
      console.log(`Updated ${email} to super_admin`);
    } else {
      console.log(`Super admin ${email} already exists`);
    }
    return;
  }

  const password = await bcrypt.hash('Code-wyse@2025', 12);
  await userRepo.save(userRepo.create({
    email,
    firstName: 'Code',
    lastName: 'Wyse',
    password,
    role: 'super_admin' as any,
    status: 'active' as any,
    hourlyRate: 0,
    organizationId: defaultOrg.id,
  }));
  console.log(`Created super admin: ${email}`);
}
