"""Local job title list and fuzzy search when Lightcast API is unavailable."""

JOB_TITLES = [
    # Software & Engineering
    "Software Engineer", "Senior Software Engineer", "Staff Software Engineer",
    "Principal Software Engineer", "Software Architect", "Software Development Engineer",
    "Software Development Engineer II", "Software Development Engineer III",
    "Backend Developer", "Senior Backend Developer", "Backend Engineer",
    "Frontend Developer", "Senior Frontend Developer", "Frontend Engineer",
    "Full Stack Developer", "Senior Full Stack Developer", "Full Stack Engineer",
    "Web Developer", "Senior Web Developer", "Web Application Developer",
    "Mobile Developer", "Mobile Application Developer", "Mobile Engineer",
    "Android Developer", "Senior Android Developer", "Android Engineer",
    "iOS Developer", "Senior iOS Developer", "iOS Engineer",
    "React Developer", "React Native Developer", "Angular Developer", "Vue.js Developer",
    "Node.js Developer", "Python Developer", "Java Developer", "Golang Developer",
    "Rust Developer", ".NET Developer", "C++ Developer", "PHP Developer",
    "Ruby on Rails Developer", "Scala Developer", "Kotlin Developer", "Swift Developer",
    "TypeScript Developer", "Django Developer", "Spring Boot Developer",
    "Microservices Developer", "API Developer", "Platform Engineer",

    # DevOps & Infrastructure
    "DevOps Engineer", "Senior DevOps Engineer", "DevOps Architect",
    "Site Reliability Engineer", "Senior SRE", "SRE Manager",
    "Cloud Engineer", "Senior Cloud Engineer", "Cloud Architect",
    "Cloud Solutions Architect", "AWS Solutions Architect", "Azure Cloud Engineer",
    "GCP Cloud Engineer", "Infrastructure Engineer", "Platform Engineer",
    "Systems Engineer", "System Administrator", "Linux Administrator",
    "Windows Administrator", "Network Engineer", "Senior Network Engineer",
    "Network Administrator", "Network Architect", "Security Engineer",
    "Senior Security Engineer", "Security Architect", "Cyber Security Analyst",
    "Cyber Security Engineer", "Information Security Analyst", "Penetration Tester",
    "Security Operations Engineer", "SOC Analyst", "Cloud Security Engineer",
    "Application Security Engineer", "Release Engineer", "Build Engineer",
    "Kubernetes Engineer", "Docker Engineer", "CI/CD Engineer",
    "Terraform Engineer", "Configuration Management Engineer",

    # Data & Analytics
    "Data Scientist", "Senior Data Scientist", "Lead Data Scientist",
    "Data Analyst", "Senior Data Analyst", "Business Data Analyst",
    "Data Engineer", "Senior Data Engineer", "Lead Data Engineer",
    "Big Data Engineer", "ETL Developer", "Data Warehouse Engineer",
    "Database Administrator", "Database Developer", "Database Engineer",
    "SQL Developer", "PostgreSQL DBA", "MongoDB Developer",
    "Analytics Engineer", "Analytics Manager", "BI Developer",
    "Business Intelligence Analyst", "Business Intelligence Developer",
    "Power BI Developer", "Tableau Developer", "Looker Developer",
    "Data Visualization Analyst", "Statistical Analyst", "Quantitative Analyst",
    "Research Scientist", "Applied Scientist",

    # AI & Machine Learning
    "Machine Learning Engineer", "Senior ML Engineer", "Lead ML Engineer",
    "AI Engineer", "Senior AI Engineer", "AI Research Scientist",
    "AI/ML Engineer", "Deep Learning Engineer", "NLP Engineer",
    "Natural Language Processing Engineer", "Computer Vision Engineer",
    "Robotics Engineer", "Reinforcement Learning Engineer",
    "MLOps Engineer", "ML Platform Engineer", "AI Product Manager",
    "Prompt Engineer", "LLM Engineer", "GenAI Engineer",
    "Conversational AI Developer", "Chatbot Developer",

    # QA & Testing
    "QA Engineer", "Senior QA Engineer", "QA Lead",
    "Quality Assurance Analyst", "Quality Assurance Engineer",
    "Test Engineer", "Senior Test Engineer", "Test Lead",
    "Automation Test Engineer", "Senior Automation Engineer",
    "SDET", "Software Development Engineer in Test",
    "Performance Test Engineer", "Manual Test Engineer",
    "QA Automation Architect", "Test Manager",

    # Product & Design
    "Product Manager", "Senior Product Manager", "Associate Product Manager",
    "Group Product Manager", "Director of Product", "VP of Product",
    "Product Owner", "Technical Product Manager", "Product Analyst",
    "Product Designer", "Senior Product Designer", "Lead Product Designer",
    "UI Designer", "UX Designer", "UI/UX Designer",
    "Senior UI/UX Designer", "Lead UX Designer", "UX Researcher",
    "Senior UX Researcher", "Interaction Designer", "Visual Designer",
    "Graphic Designer", "Motion Designer", "Design Lead",
    "Design Manager", "Creative Director",

    # Project & Program Management
    "Project Manager", "Senior Project Manager", "Technical Project Manager",
    "IT Project Manager", "Agile Project Manager",
    "Program Manager", "Senior Program Manager", "Technical Program Manager",
    "Scrum Master", "Senior Scrum Master", "Agile Coach",
    "Delivery Manager", "Release Manager", "Engineering Manager",
    "Senior Engineering Manager", "Director of Engineering",
    "VP of Engineering", "CTO", "Chief Technology Officer",

    # Business & Operations
    "Business Analyst", "Senior Business Analyst", "Lead Business Analyst",
    "Systems Analyst", "IT Business Analyst", "Functional Analyst",
    "Management Consultant", "Technology Consultant", "IT Consultant",
    "Solutions Consultant", "Pre-Sales Consultant", "Implementation Consultant",
    "Operations Manager", "IT Operations Manager", "Technical Operations Manager",
    "Operations Analyst", "Process Analyst", "Process Improvement Specialist",
    "Business Process Analyst", "Change Management Analyst",

    # Sales & Marketing (Tech)
    "Technical Sales Engineer", "Solutions Engineer", "Sales Engineer",
    "Pre-Sales Engineer", "Customer Success Engineer",
    "Technical Account Manager", "Customer Success Manager",
    "Digital Marketing Manager", "SEO Specialist", "SEM Specialist",
    "Growth Hacker", "Growth Engineer", "Marketing Analyst",
    "Marketing Technologist", "Email Marketing Specialist",
    "Content Strategist", "Content Writer", "Technical Writer",
    "Senior Technical Writer", "Documentation Engineer",
    "Developer Advocate", "Developer Relations Engineer",
    "Developer Evangelist", "Community Manager",

    # Embedded & Hardware
    "Embedded Software Engineer", "Embedded Systems Engineer",
    "Firmware Engineer", "Senior Firmware Engineer",
    "Hardware Engineer", "VLSI Design Engineer", "ASIC Design Engineer",
    "FPGA Engineer", "PCB Design Engineer", "Electrical Engineer",
    "Electronics Engineer", "RF Engineer", "Signal Processing Engineer",
    "IoT Developer", "IoT Engineer", "Robotics Software Engineer",

    # Game Development
    "Game Developer", "Senior Game Developer", "Game Programmer",
    "Unity Developer", "Unreal Engine Developer",
    "Game Designer", "Level Designer", "Game Artist",
    "3D Artist", "3D Modeler", "Technical Artist",
    "Animation Programmer", "Graphics Programmer", "Engine Programmer",

    # Blockchain & Web3
    "Blockchain Developer", "Senior Blockchain Developer",
    "Solidity Developer", "Smart Contract Developer",
    "Web3 Developer", "DeFi Developer", "Crypto Engineer",
    "Blockchain Architect",

    # ERP & Enterprise
    "SAP Consultant", "SAP Developer", "SAP Basis Administrator",
    "SAP ABAP Developer", "SAP FICO Consultant", "SAP MM Consultant",
    "Salesforce Developer", "Salesforce Administrator", "Salesforce Architect",
    "ServiceNow Developer", "Oracle Developer", "Oracle DBA",
    "Workday Consultant", "PeopleSoft Developer",

    # Support & IT
    "IT Support Engineer", "Technical Support Engineer",
    "Help Desk Technician", "Desktop Support Engineer",
    "System Support Engineer", "Application Support Engineer",
    "L1 Support Engineer", "L2 Support Engineer", "L3 Support Engineer",
    "IT Manager", "IT Director", "Chief Information Officer",

    # Telecom & Networking
    "Telecom Engineer", "Network Security Engineer",
    "VoIP Engineer", "Wireless Engineer",
    "Solutions Architect", "Enterprise Architect", "Technical Architect",
    "Integration Architect", "Middleware Developer",

    # Compliance & Governance
    "IT Auditor", "Compliance Analyst", "GRC Analyst",
    "Risk Analyst", "IT Risk Manager",
    "Privacy Engineer", "Data Protection Officer",

    # Emerging & Specialized
    "AR/VR Developer", "Augmented Reality Developer",
    "Virtual Reality Developer", "XR Developer",
    "Quantum Computing Engineer", "Edge Computing Engineer",
    "Digital Twin Engineer", "Simulation Engineer",
    "Bioinformatics Scientist", "Health Informatics Specialist",
    "Clinical Data Analyst", "GIS Analyst", "GIS Developer",
    "Geospatial Engineer", "CAD Engineer", "BIM Specialist",

    # Fresher / Entry Level
    "Software Engineer Intern", "Software Development Intern",
    "Data Science Intern", "ML Intern", "Web Development Intern",
    "Graduate Trainee", "Associate Software Engineer",
    "Associate Developer", "Trainee Engineer", "Junior Developer",
    "Junior Software Engineer", "Junior Data Analyst",
    "Junior Frontend Developer", "Junior Backend Developer",
    "Apprentice Developer",

    # Freelance & Contractor
    "Freelance Developer", "Freelance Designer",
    "Independent Consultant", "Contract Developer",
    "Staff Augmentation Engineer",

    # Teaching & Research
    "Computer Science Professor", "Assistant Professor",
    "Research Engineer", "Research Associate",
    "Lab Instructor", "Coding Instructor",
    "Technical Trainer", "Curriculum Developer",
]

TITLES_LOWER = [(t, t.lower()) for t in JOB_TITLES]


def search_roles_local(q: str, limit: int) -> list[str]:
    if not q.strip():
        return JOB_TITLES[:limit]

    query = q.lower().strip()
    tokens = query.split()

    scored: list[tuple[str, int]] = []
    for title, title_lower in TITLES_LOWER:
        if all(tok in title_lower for tok in tokens):
            if title_lower.startswith(tokens[0]):
                scored.append((title, 0))
            elif any(word.startswith(tokens[0]) for word in title_lower.split()):
                scored.append((title, 1))
            else:
                scored.append((title, 2))

    scored.sort(key=lambda x: (x[1], len(x[0])))
    return [s[0] for s in scored[:limit]]
