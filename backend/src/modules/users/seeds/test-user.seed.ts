import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Role } from '../../../common/enums/role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';

const testUsers: Partial<User>[] = [
  {
    email: 'admin@pulsetrack.com',
    firstName: 'Admin',
    lastName: 'User',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
    hourlyRate: 50,
  },
  {
    email: 'employee@pulsetrack.com',
    firstName: 'Test',
    lastName: 'Employee',
    role: Role.EMPLOYEE,
    status: UserStatus.ACTIVE,
    hourlyRate: 25,
  },
];

export async function seedTestUsers(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(User);
  const defaultPassword = await bcrypt.hash('Password123!', 12);

  for (const user of testUsers) {
    const exists = await repo.findOne({ where: { email: user.email } });
    if (!exists) {
      await repo.save(repo.create({ ...user, password: defaultPassword }));
    }
  }

  console.log(`Seeded ${testUsers.length} test users`);
}
