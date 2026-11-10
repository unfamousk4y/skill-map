// FICTIONAL SAMPLE DATA AND DAY-1 SCAFFOLDING.
// The student, companies, postings and quotes below are invented. This file is a
// hand-written stand-in for what the analysis engine will produce from real
// pasted text (milestone 2). Until then the counts and the "next" picks are typed
// in by hand, not computed.

import type { Analysis, Quote, SkillFinding } from '../domain/types.ts'

const q = (source: string, text: string): Quote => ({ source, text })

function f(
  id: string,
  required: number,
  preferred: number,
  have: boolean,
  postingQuotes: Quote[] = [],
  resumeQuotes: Quote[] = [],
): SkillFinding {
  return { id, required, preferred, have, postingQuotes, resumeQuotes }
}

export const sampleAnalysis: Analysis = {
  label: 'Sample student aiming at software and AI internships',
  fictional: true,
  postings: [
    { id: 'p1', company: 'Lumen Robotics', title: 'Software Engineering Intern' },
    { id: 'p2', company: 'Harbor Health', title: 'Full-Stack Engineering Intern' },
    { id: 'p3', company: 'Kite Analytics', title: 'Data Engineering Intern' },
    { id: 'p4', company: 'Tessel AI', title: 'AI Engineering Intern' },
    { id: 'p5', company: 'Fernway', title: 'Backend Engineering Intern' },
    { id: 'p6', company: 'Orbit Payments', title: 'Software Engineer, New Grad' },
  ],
  findings: [
    // Skills the resume shows
    f('python', 5, 0, true,
      [q('Tessel AI', 'Strong Python skills are required.'), q('Kite Analytics', 'Write production-quality Python and SQL.')],
      [q('Resume', 'Built a transit delay predictor in Python using three years of public data.')]),
    f('javascript', 3, 0, true),
    f('typescript', 3, 1, true,
      [q('Harbor Health', 'Our front end is React and TypeScript.')],
      [q('Resume', 'Shipped a budgeting web app in React and TypeScript.')]),
    f('react', 2, 1, true, [], [q('Resume', 'Shipped a budgeting web app in React and TypeScript.')]),
    f('html', 1, 0, true),
    f('css', 1, 0, true),
    f('sql', 4, 0, true, [q('Kite Analytics', 'Write production-quality Python and SQL.')]),
    f('relational-databases', 2, 0, true),
    f('postgresql', 2, 1, true,
      [q('Fernway', 'Experience with PostgreSQL or another relational database.')],
      [q('Resume', 'Designed a 9-table PostgreSQL schema for a campus events app.')]),
    f('git', 5, 0, true),
    f('github', 1, 1, true),
    f('unit-testing', 3, 1, true,
      [q('Orbit Payments', 'You write automated tests as a matter of habit.')],
      [q('Resume', 'Wrote 120 unit tests covering date and rounding rules.')]),
    f('jest', 0, 1, true),
    f('data-structures', 4, 0, true),
    f('algorithms', 4, 0, true),
    f('oop', 2, 0, true),
    f('http', 0, 0, true),
    f('rest-api', 4, 0, true,
      [q('Fernway', 'Design and build REST APIs used by our mobile apps.')],
      [q('Resume', 'Built a REST API for a campus events app with 300 weekly users.')]),
    f('java', 1, 1, true),
    f('code-review', 2, 0, true),
    f('debugging', 1, 0, true),
    f('pandas', 1, 0, true),
    f('numpy', 0, 0, true),

    // Gaps: asked for, not shown on the resume
    f('docker', 3, 1, false,
      [q('Fernway', 'Experience with Docker and containerized deployments.'), q('Orbit Payments', 'You have shipped services in Docker.')]),
    f('aws', 2, 2, false, [q('Kite Analytics', 'Familiarity with AWS (S3, Lambda) is a plus.')]),
    f('ci-cd', 2, 1, false, [q('Lumen Robotics', 'Comfortable working in a CI/CD pipeline.')]),
    f('nodejs', 2, 1, false, [q('Harbor Health', 'Build back-end services in Node.js.')]),
    f('linux', 2, 0, false, [q('Lumen Robotics', 'Comfortable on the Linux command line.')]),
    f('llm-apis', 2, 1, false,
      [q('Tessel AI', 'Hands-on experience building with LLM APIs.'), q('Harbor Health', 'Bonus: you have built a feature on top of a large language model.')]),
    f('prompt-engineering', 1, 1, false),
    f('embeddings', 1, 0, false),
    f('rag', 1, 1, false, [q('Tessel AI', 'Experience with retrieval-augmented generation (RAG) pipelines.')]),
    f('model-evaluation', 1, 0, false, [q('Tessel AI', 'You measure model quality with evals, not vibes.')]),
    f('machine-learning', 1, 1, false),
    f('deep-learning', 0, 1, false),
    f('pytorch', 0, 1, false),
    f('statistics', 1, 0, false),
    f('system-design', 1, 1, false, [q('Orbit Payments', 'You can reason about system design trade-offs.')]),
    f('authentication', 1, 0, false),
    f('concurrency', 1, 0, false),
    f('distributed-systems', 0, 1, false),
    f('data-pipelines', 1, 0, false, [q('Kite Analytics', 'Build and maintain ETL pipelines.')]),
    f('airflow', 0, 1, false),
    f('kubernetes', 0, 2, false),
    f('graphql', 0, 1, false),
    f('redis', 0, 1, false),
    f('nextjs', 0, 1, false),
    f('accessibility', 0, 1, false),
    f('agile', 1, 1, false),
  ],
  next: ['llm-apis', 'nodejs', 'aws'],
}
