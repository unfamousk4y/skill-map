# Answer key review sheet

The postings and the answer key below were written by an AI model. The accuracy numbers are only as good as this key, so a person needs to check it.

**How to check one posting:** read the posting, then ask of each skill in the key "does this posting really ask the candidate for this?", and ask "is anything it asks for missing from the key?". Use these rules:

- A skill counts when it is named, or clearly described without being named. Skills marked *(described)* are the second kind.
- A tool counts as its parent skill when our list groups them: Tableau counts as "BI tools", Snowflake as "Data warehousing", S3 as "AWS".
- A skill does not count if the posting says it is not needed, or only mentions it as something the company or another team uses.
- "Preferred" means the posting presents it as a bonus, a plus, nice to have, optional or preferred. Everything else is "required".
- Only skills on our list can be in the key. The full list is in `src/data/taxonomy.json`.

Tick the box if the key is right. If not, write what should change on the "Change" line, then tell Claude Code which postings you changed.

## s01 (named)

```
Junior Web Developer, Pinecrest Studio
Requirements:
- HTML, CSS and JavaScript
- Experience with React
- Git
Nice to have:
- TypeScript
- Tailwind CSS
```

- Required: HTML, CSS, JavaScript, React, Git
- Preferred: TypeScript, Tailwind CSS

- [ ] The key is right
- Change: 

## s02 (named)

```
Backend Engineer Intern, Marlow Freight
You will build REST APIs in Java with Spring Boot, backed by PostgreSQL.
Required: Java, SQL, unit testing with JUnit.
Bonus: Kafka, Docker.
```

- Required: REST APIs, Java, Spring Boot, PostgreSQL, SQL, Unit testing, JUnit
- Preferred: Kafka, Docker

- [ ] The key is right
- Change: 

## s03 (named)

```
Data Analyst Intern, Bellweather Retail
Must have: SQL, Excel and Tableau.
You will build dashboards and run A/B tests.
Preferred: Python with pandas.
```

- Required: SQL, Excel, BI tools, Data visualisation, A/B testing
- Preferred: Python, pandas

- [ ] The key is right
- Change: 

## s04 (named)

```
Machine Learning Intern, Quillon Labs
Requirements:
- Python, NumPy and PyTorch
- Solid understanding of machine learning and deep learning
- Linear algebra and statistics
Preferred:
- Experience with Hugging Face transformers
- CUDA
```

- Required: Python, NumPy, PyTorch, Machine learning, Deep learning, Linear algebra, Statistics
- Preferred: Transformers, GPU computing

- [ ] The key is right
- Change: 

## s05 (named)

```
DevOps Intern, Stonebridge Cloud
What you need:
- Linux and Bash
- Docker and Kubernetes
- Terraform
- CI/CD with GitHub Actions
- AWS
Good to have: Prometheus and Grafana.
```

- Required: Linux, Bash, Docker, Kubernetes, Terraform, CI/CD, GitHub Actions, AWS
- Preferred: Monitoring and observability

- [ ] The key is right
- Change: 

## s06 (named)

```
Mobile Developer Intern, Tidewater Apps
We build with React Native and TypeScript.
Requirements: React Native, TypeScript, REST APIs, Git.
A plus: native iOS (Swift) or Android (Kotlin) experience.
```

- Required: React Native, TypeScript, REST APIs, Git
- Preferred: iOS, Swift, Android, Kotlin

- [ ] The key is right
- Change: 

## s07 (named)

```
Full-Stack Intern, Garnet Health
- Next.js and React on the front end
- Node.js with Express on the back end
- MongoDB
- Authentication with OAuth
- Jest for testing
```

- Required: Next.js, React, Node.js, Express, MongoDB, Authentication, OAuth, Jest and Vitest
- Preferred: none

- [ ] The key is right
- Change: 

## s08 (named)

```
Data Engineer Intern, Halcyon Energy
Requirements:
- Python and SQL
- ETL pipelines with Airflow
- Spark
- Snowflake or BigQuery
Nice to have:
- dbt
- Kafka
```

- Required: Python, SQL, Data pipelines, Airflow, Spark, Data warehousing
- Preferred: dbt, Kafka

- [ ] The key is right
- Change: 

## s09 (described)

```
Platform Intern, Orchard Systems
- You package services into containers and run them on a cluster orchestrator.
- You automate builds and releases so that every merge is tested and shipped without manual steps.
- You are comfortable in a terminal on a Unix-like system.
```

- Required: Docker, Kubernetes *(described)*, CI/CD *(described)*, Linux
- Preferred: none

- [ ] The key is right
- Change: 

## s10 (described)

```
Applied AI Intern, Fennel & Co
- You have built features on top of hosted large language models by calling their APIs.
- You know how to write and iterate on instructions for a model until the output is reliable.
- You have built a system that looks up relevant documents and feeds them to a model before it answers.
- You measure output quality with a fixed test set, not by eyeballing.
```

- Required: LLM APIs, Prompt engineering *(described)*, Retrieval-augmented generation *(described)*, Model evaluation *(described)*
- Preferred: none

- [ ] The key is right
- Change: 

## s11 (described)

```
Software Intern, Brindle Robotics
- You write tests before you write the code that makes them pass.
- You review teammates' changes and welcome review of your own.
- You can find the cause of a failure in an unfamiliar codebase.
- You track your work in version control with small, well-described commits.
```

- Required: Test-driven development *(described)*, Code review *(described)*, Debugging *(described)*, Git
- Preferred: none

- [ ] The key is right
- Change: 

## s12 (described)

```
Backend Intern, Larkspur Pay
- You design tables, keys and relationships so that data stays consistent.
- You make sure that either every step of a payment is saved or none of it is.
- You keep slow lookups fast by storing recent results in memory.
- You verify who a user is before showing them their data.
```

- Required: Database design *(described)*, Database transactions *(described)*, Caching *(described)*, Authentication *(described)*
- Preferred: none

- [ ] The key is right
- Change: 

## s13 (described)

```
Frontend Intern, Meridian Arts
- You build pages that work as well on a phone as on a wide monitor.
- You make sure people using a screen reader or only a keyboard can use everything.
- You care how fast a page loads and can measure it.
```

- Required: Responsive design *(described)*, Web accessibility *(described)*, Web performance *(described)*
- Preferred: none

- [ ] The key is right
- Change: 

## s14 (described)

```
ML Engineer Intern, Cobalt Vision
- You have trained neural networks to recognise objects in images.
- You have taken a model from an experiment to a service that other teams call.
- You have adapted a pretrained model to a new task with a small labelled dataset.
- Python is our main language.
```

- Required: Deep learning, Computer vision *(described)*, MLOps *(described)*, Fine-tuning *(described)*, Python
- Preferred: none

- [ ] The key is right
- Change: 

## s15 (described)

```
Data Intern, Wrenfield Insurance
- You turn messy files and exports into tidy tables you can trust.
- You explain what the numbers mean with clear charts.
- You can summarise a dataset and say how confident you are in an estimate.
- You write database queries every day.
```

- Required: Data cleaning *(described)*, Data visualisation *(described)*, Statistics *(described)*, SQL *(described)*
- Preferred: none

- [ ] The key is right
- Change: 

## s16 (described)

```
Systems Intern, Tarn Networks
- You understand how processes, threads and memory are managed by a kernel.
- You can write code where several things happen at once without corrupting shared state.
- You know what happens between typing an address and a page arriving, packet by packet.
- We write mostly in C and Rust.
```

- Required: Operating systems *(described)*, Concurrency *(described)*, Computer networks *(described)*, C, Rust
- Preferred: none

- [ ] The key is right
- Change: 

## s17 (misleading)

```
Customer Success Associate, Go Bright Energy
You react quickly to customer issues, excel at written communication and express ideas clearly.
You will rest easy knowing our platform team handles the technical side.
Requirements: empathy, organisation, a driving licence.
```

- Required: none
- Preferred: none

- [ ] The key is right
- Change: 

## s18 (misleading)

```
Backend Intern, Ashgrove Mobility
About us: our platform runs on Kubernetes and Kafka and serves 2 million riders. Our data science team uses PyTorch.
About the role: you will maintain internal billing scripts.
Requirements:
- Python
- SQL
```

- Required: Python, SQL
- Preferred: none

- [ ] The key is right
- Change: 

## s19 (misleading)

```
Junior Developer, Thistle Software
Requirements:
- JavaScript and React
You do not need to know Docker or Kubernetes: our platform team handles deployment.
No prior TypeScript experience is required, we will teach you.
```

- Required: JavaScript, React
- Preferred: none

- [ ] The key is right
- Change: 

## s20 (misleading)

```
Analytics Intern, Kestrel Sports
Requirements:
- R or Python for analysis
- SQL
- Go is a bonus
- Strong Excel skills
```

- Required: R, Python, SQL, Excel
- Preferred: Go

- [ ] The key is right
- Change: 

## s21 (misleading)

```
Software Intern, Spring Street Bank
Join us in spring 2027 at our Spring Street office.
Requirements:
- Java with Spring
- Oracle or SQL Server
- Swift communication with stakeholders
```

- Required: Java, Spring Boot, SQL Server
- Preferred: none

- [ ] The key is right
- Change: 

## s22 (misleading)

```
Research Engineer Intern, Lambda School of Design
We are an art school; the name has nothing to do with programming.
Requirements:
- Python
- Experience building dashboards
- Comfortable presenting to non-technical staff
```

- Required: Python, Data visualisation
- Preferred: none

- [ ] The key is right
- Change: 

## s23 (levels)

```
Software Engineer Intern, Pallas Aerospace
Minimum qualifications:
- C++
- Data structures and algorithms
Preferred qualifications:
- Python
- Experience with Linux
What we offer:
- Mentorship from engineers who use MATLAB daily
```

- Required: C++, Data structures, Algorithms
- Preferred: Python, Linux

- [ ] The key is right
- Change: 

## s24 (levels)

```
Web Intern, Ostler Media
We would love it if you knew Vue, but it is not required.
You must be comfortable with HTML and CSS.
Ideally you have used Figma and some JavaScript.
```

- Required: HTML, CSS
- Preferred: Vue, JavaScript

- [ ] The key is right
- Change: 

## s25 (levels)

```
Cloud Intern, Nimbus Ledger
Required: one of AWS, Azure or Google Cloud.
Strongly preferred: Terraform.
Optional but welcome: Go, Kubernetes.
```

- Required: AWS, Azure, Google Cloud
- Preferred: Terraform, Go, Kubernetes

- [ ] The key is right
- Change: 

## s26 (levels)

```
QA Intern, Verity Games
Must-haves
- Writing automated tests
- Playwright or Cypress
Nice-to-haves
- Python
- Experience with CI/CD
```

- Required: Unit testing, End-to-end testing
- Preferred: Python, CI/CD

- [ ] The key is right
- Change: 

## s27 (levels)

```
Software Intern, Calder Maps
- Python (required)
- PostgreSQL (required)
- Redis (nice to have)
- GraphQL (nice to have)
- TypeScript (bonus)
```

- Required: Python, PostgreSQL
- Preferred: Redis, GraphQL, TypeScript

- [ ] The key is right
- Change: 

## s28 (nothing)

```
Barista, Juniper Coffee
Make great coffee, keep the bar clean, be kind to customers.
Weekend availability required.
```

- Required: none
- Preferred: none

- [ ] The key is right
- Change: 

## s29 (nothing)

```
Software Engineer Intern, Vantage
We are looking for curious people with strong technical skills and a passion for problem solving.
Any programming language is fine.
```

- Required: none
- Preferred: none

- [ ] The key is right
- Change: 

## s30 (described)

```
Security Intern, Halberd Trust
Requirements:
- Understanding of common web vulnerabilities (OWASP Top 10)
- TLS, hashing and encryption basics
- Python or Bash scripting
Preferred:
- Experience reading other people's code to find flaws before it ships
```

- Required: Application security, Cryptography, Python, Bash
- Preferred: Code review *(described)*

- [ ] The key is right
- Change: 
