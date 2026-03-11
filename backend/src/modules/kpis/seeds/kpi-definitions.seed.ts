import { DataSource } from 'typeorm';
import { KpiDefinition } from '../entities/kpi-definition.entity';

const definitions: Partial<KpiDefinition>[] = [
  // Project Manager
  { designation: 'Project Manager', metricName: 'Sprint completion rate', description: 'Percentage of sprint tasks completed on time', unit: 'percentage' },
  { designation: 'Project Manager', metricName: 'Task delivery rate', description: 'Percentage of tasks delivered within deadlines', unit: 'percentage' },
  { designation: 'Project Manager', metricName: 'Blocker resolution time', description: 'Average time to resolve blockers', unit: 'hours' },
  { designation: 'Project Manager', metricName: 'Milestone adherence', description: 'Percentage of milestones met on schedule', unit: 'percentage' },

  // Product Manager
  { designation: 'Product Manager', metricName: 'PRDs written', description: 'Number of Product Requirement Documents written', unit: 'count' },
  { designation: 'Product Manager', metricName: 'Feature releases', description: 'Number of features released', unit: 'count' },
  { designation: 'Product Manager', metricName: 'Roadmap adherence', description: 'Percentage adherence to product roadmap', unit: 'percentage' },
  { designation: 'Product Manager', metricName: 'Stakeholder satisfaction', description: 'Stakeholder satisfaction score', unit: 'score' },

  // Backend Developer
  { designation: 'Backend Developer', metricName: 'PRs merged', description: 'Number of pull requests merged', unit: 'count' },
  { designation: 'Backend Developer', metricName: 'Bugs fixed', description: 'Number of bugs resolved', unit: 'count' },
  { designation: 'Backend Developer', metricName: 'API performance', description: 'API performance score', unit: 'score' },
  { designation: 'Backend Developer', metricName: 'Deployment success rate', description: 'Percentage of successful deployments', unit: 'percentage' },

  // Frontend Developer
  { designation: 'Frontend Developer', metricName: 'UI features delivered', description: 'Number of UI features delivered', unit: 'count' },
  { designation: 'Frontend Developer', metricName: 'Bug resolution time', description: 'Average time to resolve bugs', unit: 'hours' },
  { designation: 'Frontend Developer', metricName: 'Performance score', description: 'Frontend performance score (Lighthouse etc.)', unit: 'score' },
  { designation: 'Frontend Developer', metricName: 'Code reviews', description: 'Number of code reviews performed', unit: 'count' },

  // Full Stack Developer
  { designation: 'Full Stack Developer', metricName: 'PRs merged', description: 'Number of pull requests merged', unit: 'count' },
  { designation: 'Full Stack Developer', metricName: 'Bugs fixed', description: 'Number of bugs resolved', unit: 'count' },
  { designation: 'Full Stack Developer', metricName: 'Feature completion rate', description: 'Percentage of planned features completed', unit: 'percentage' },
  { designation: 'Full Stack Developer', metricName: 'Code reviews', description: 'Number of code reviews performed', unit: 'count' },

  // Mobile Developer
  { designation: 'Mobile Developer', metricName: 'Builds released', description: 'Number of builds released to store/TestFlight', unit: 'count' },
  { designation: 'Mobile Developer', metricName: 'Crash rate', description: 'Application crash rate percentage', unit: 'percentage' },
  { designation: 'Mobile Developer', metricName: 'Feature completion rate', description: 'Percentage of planned features completed', unit: 'percentage' },

  // DevOps Engineer
  { designation: 'DevOps Engineer', metricName: 'Deployment success rate', description: 'Percentage of successful deployments', unit: 'percentage' },
  { designation: 'DevOps Engineer', metricName: 'Incident response time', description: 'Average time to respond to incidents', unit: 'hours' },
  { designation: 'DevOps Engineer', metricName: 'Uptime percentage', description: 'System uptime percentage', unit: 'percentage' },
  { designation: 'DevOps Engineer', metricName: 'Infrastructure cost optimization', description: 'Cost savings score', unit: 'score' },

  // UI/UX Designer
  { designation: 'UI/UX Designer', metricName: 'Designs delivered', description: 'Number of design deliverables completed', unit: 'count' },
  { designation: 'UI/UX Designer', metricName: 'User satisfaction score', description: 'User satisfaction rating from usability tests', unit: 'score' },
  { designation: 'UI/UX Designer', metricName: 'Design iteration time', description: 'Average time per design iteration', unit: 'hours' },
  { designation: 'UI/UX Designer', metricName: 'Accessibility compliance', description: 'Percentage of designs meeting accessibility standards', unit: 'percentage' },

  // QA Engineer
  { designation: 'QA Engineer', metricName: 'Bugs detected', description: 'Number of bugs detected during testing', unit: 'count' },
  { designation: 'QA Engineer', metricName: 'Test coverage', description: 'Test coverage percentage', unit: 'percentage' },
  { designation: 'QA Engineer', metricName: 'Regression tests executed', description: 'Number of regression test suites executed', unit: 'count' },
  { designation: 'QA Engineer', metricName: 'Bug escape rate', description: 'Percentage of bugs that escaped to production', unit: 'percentage' },

  // HR Manager
  { designation: 'HR Manager', metricName: 'Hiring cycle time', description: 'Average time from job posting to hire', unit: 'hours' },
  { designation: 'HR Manager', metricName: 'Candidate pipeline', description: 'Number of candidates in active pipeline', unit: 'count' },
  { designation: 'HR Manager', metricName: 'Retention rate', description: 'Employee retention rate', unit: 'percentage' },
  { designation: 'HR Manager', metricName: 'Employee satisfaction', description: 'Employee satisfaction score', unit: 'score' },

  // Team Lead
  { designation: 'Team Lead', metricName: 'Team velocity', description: 'Sprint points completed by team', unit: 'count' },
  { designation: 'Team Lead', metricName: 'Team satisfaction', description: 'Team satisfaction score', unit: 'score' },
  { designation: 'Team Lead', metricName: 'Code review turnaround', description: 'Average time to complete code reviews', unit: 'hours' },
  { designation: 'Team Lead', metricName: 'Sprint goal achievement', description: 'Percentage of sprint goals achieved', unit: 'percentage' },

  // Data Analyst
  { designation: 'Data Analyst', metricName: 'Reports delivered', description: 'Number of analytical reports delivered', unit: 'count' },
  { designation: 'Data Analyst', metricName: 'Data accuracy', description: 'Data accuracy percentage', unit: 'percentage' },
  { designation: 'Data Analyst', metricName: 'Insight adoption rate', description: 'Percentage of insights acted upon', unit: 'percentage' },

  // Business Analyst
  { designation: 'Business Analyst', metricName: 'Requirements documented', description: 'Number of requirement documents created', unit: 'count' },
  { designation: 'Business Analyst', metricName: 'Stakeholder alignment', description: 'Stakeholder alignment score', unit: 'score' },
  { designation: 'Business Analyst', metricName: 'Process improvements', description: 'Number of process improvements identified', unit: 'count' },

  // Marketing Specialist
  { designation: 'Marketing Specialist', metricName: 'Campaigns launched', description: 'Number of marketing campaigns launched', unit: 'count' },
  { designation: 'Marketing Specialist', metricName: 'Lead generation', description: 'Number of qualified leads generated', unit: 'count' },
  { designation: 'Marketing Specialist', metricName: 'Conversion rate', description: 'Campaign conversion rate', unit: 'percentage' },

  // Sales Representative
  { designation: 'Sales Representative', metricName: 'Deals closed', description: 'Number of deals closed', unit: 'count' },
  { designation: 'Sales Representative', metricName: 'Revenue generated', description: 'Revenue generated score', unit: 'score' },
  { designation: 'Sales Representative', metricName: 'Client retention', description: 'Client retention rate', unit: 'percentage' },
];

export async function seedKpiDefinitions(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(KpiDefinition);

  for (const def of definitions) {
    const exists = await repo.findOne({
      where: { designation: def.designation, metricName: def.metricName },
    });

    if (!exists) {
      await repo.save(repo.create(def));
    }
  }

  console.log(`Seeded ${definitions.length} KPI definitions`);
}
