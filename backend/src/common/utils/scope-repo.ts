import { Repository, FindManyOptions, FindOneOptions, DeepPartial, SelectQueryBuilder } from 'typeorm';

export function scopeRepo<T extends { organizationId: string }>(
  repo: Repository<T>,
  organizationId: string,
) {
  return {
    find(options?: FindManyOptions<T>): Promise<T[]> {
      return repo.find({
        ...options,
        where: { ...(options?.where as any), organizationId } as any,
      });
    },
    findOne(options: FindOneOptions<T>): Promise<T | null> {
      return repo.findOne({
        ...options,
        where: { ...(options?.where as any), organizationId } as any,
      });
    },
    findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
      return repo.findAndCount({
        ...options,
        where: { ...(options?.where as any), organizationId } as any,
      });
    },
    count(options?: FindManyOptions<T>): Promise<number> {
      return repo.count({
        ...options,
        where: { ...(options?.where as any), organizationId } as any,
      });
    },
    create(data: DeepPartial<T>): T {
      return repo.create({ ...data, organizationId } as any) as unknown as T;
    },
    save(entity: DeepPartial<T> | DeepPartial<T>[]): Promise<any> {
      if (Array.isArray(entity)) {
        return repo.save(entity.map((e) => ({ ...e, organizationId })) as any);
      }
      return repo.save({ ...entity, organizationId } as any);
    },
    createQueryBuilder(alias: string): SelectQueryBuilder<T> {
      return repo.createQueryBuilder(alias)
        .andWhere(`${alias}.organization_id = :_scopeOrgId`, { _scopeOrgId: organizationId });
    },
    // Pass-through for operations that don't need scoping
    getRepo(): Repository<T> { return repo; },
  };
}
