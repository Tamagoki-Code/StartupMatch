// Ported 1:1 from the original PortfolioMatch AI Python prototype
// (Startup match algorithm/Code Real/app.py) — O*NET Hot Technologies +
// roadmap.sh verified skill trees for six freelance developer roles.

export type DevRole =
  | "Web Developer"
  | "Mobile Developer"
  | "UI/UX Designer"
  | "Backend Developer"
  | "Full Stack Developer"
  | "Data/ML Developer"

export interface RoleSkills {
  core: string[]
  supporting: string[]
}

export const ROLE_SKILL_TAXONOMY: Record<DevRole, RoleSkills> = {
  "Web Developer": {
    core: ["HTML", "CSS", "JavaScript", "React", "Responsive Design", "Git"],
    supporting: ["TypeScript", "Tailwind CSS", "Bootstrap", "REST API", "Node.js", "Webpack"],
  },
  "Mobile Developer": {
    core: ["Kotlin", "Swift", "Flutter", "React Native", "Android SDK", "iOS SDK"],
    supporting: ["Dart", "Java", "Firebase", "REST API", "Mobile UI", "Git"],
  },
  "UI/UX Designer": {
    core: ["Figma", "Adobe XD", "Wireframing", "Prototyping", "User Research", "Usability Testing"],
    supporting: [
      "Design Systems",
      "Information Architecture",
      "HTML",
      "CSS",
      "Interaction Design",
      "Photoshop",
    ],
  },
  "Backend Developer": {
    core: ["Node.js", "Python", "SQL", "REST API", "PostgreSQL", "MongoDB"],
    supporting: ["Docker", "Redis", "Express.js", "Django", "FastAPI", "Git", "AWS"],
  },
  "Full Stack Developer": {
    core: ["JavaScript", "React", "Node.js", "SQL", "REST API", "Git"],
    supporting: [
      "TypeScript",
      "HTML",
      "CSS",
      "Express.js",
      "PostgreSQL",
      "MongoDB",
      "Docker",
      "AWS",
    ],
  },
  "Data/ML Developer": {
    core: ["Python", "SQL", "Pandas", "Scikit-Learn", "Machine Learning", "Data Analysis"],
    supporting: ["NumPy", "TensorFlow", "PyTorch", "Data Visualization", "Matplotlib", "Jupyter", "Git"],
  },
}

export const ROLE_SEMANTIC_PROFILES: Record<DevRole, string> = {
  "Web Developer":
    "Frontend web development, responsive user interfaces, styling websites, web applications using HTML, CSS, JavaScript, React, TypeScript, Tailwind, REST APIs, and Git version control.",
  "Mobile Developer":
    "Mobile application engineering for Android and iOS devices. Cross-platform and native mobile applications using Kotlin, Swift, Flutter, React Native, Android SDK, iOS SDK, and Firebase.",
  "UI/UX Designer":
    "User experience and interface design, wireframes, user journeys, visual mockups, design systems, and clickable prototypes using Figma, Adobe XD, user research, and usability testing.",
  "Backend Developer":
    "Server-side web development, RESTful APIs, microservices, backend business logic, database management, and cloud architecture using Node.js, Python, SQL, PostgreSQL, MongoDB, Docker, and AWS.",
  "Full Stack Developer":
    "End-to-end full stack software engineering combining frontend client UI with backend server APIs, databases, JavaScript, React, Node.js, SQL, REST APIs, Express, and Docker deployment.",
  "Data/ML Developer":
    "Data science, predictive machine learning models, statistical analysis, feature engineering, data cleaning, and data visualization using Python, SQL, Pandas, Scikit-Learn, TensorFlow, PyTorch, and Jupyter.",
}

export const DEV_ROLES = Object.keys(ROLE_SKILL_TAXONOMY) as DevRole[]

export const SKILL_CANONICAL_LOOKUP: Record<string, string> = {
  html: "HTML",
  html5: "HTML",
  css: "CSS",
  css3: "CSS",
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  python: "Python",
  python3: "Python",
  java: "Java",
  dart: "Dart",
  kotlin: "Kotlin",
  swift: "Swift",
  react: "React",
  "react.js": "React",
  reactjs: "React",
  vue: "Vue.js",
  "vue.js": "Vue.js",
  tailwind: "Tailwind CSS",
  "tailwind css": "Tailwind CSS",
  bootstrap: "Bootstrap",
  "responsive design": "Responsive Design",
  webpack: "Webpack",
  flutter: "Flutter",
  "react native": "React Native",
  "android sdk": "Android SDK",
  "ios sdk": "iOS SDK",
  "mobile ui": "Mobile UI",
  "node.js": "Node.js",
  nodejs: "Node.js",
  node: "Node.js",
  express: "Express.js",
  "express.js": "Express.js",
  django: "Django",
  fastapi: "FastAPI",
  sql: "SQL",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  mongodb: "MongoDB",
  mongo: "MongoDB",
  redis: "Redis",
  "rest api": "REST API",
  "restful api": "REST API",
  rest: "REST API",
  pandas: "Pandas",
  numpy: "NumPy",
  "scikit-learn": "Scikit-Learn",
  sklearn: "Scikit-Learn",
  tensorflow: "TensorFlow",
  tf: "TensorFlow",
  pytorch: "PyTorch",
  "machine learning": "Machine Learning",
  ml: "Machine Learning",
  "data analysis": "Data Analysis",
  "data visualization": "Data Visualization",
  matplotlib: "Matplotlib",
  jupyter: "Jupyter",
  figma: "Figma",
  "adobe xd": "Adobe XD",
  wireframing: "Wireframing",
  prototyping: "Prototyping",
  "user research": "User Research",
  "usability testing": "Usability Testing",
  "design systems": "Design Systems",
  "information architecture": "Information Architecture",
  photoshop: "Photoshop",
  "interaction design": "Interaction Design",
  git: "Git",
  github: "Git",
  docker: "Docker",
  aws: "AWS",
  firebase: "Firebase",
}
