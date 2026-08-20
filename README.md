# LAYER_3

This project is a university-based interactive web experience exploring motion, inverse kinematics, and algorithmic animation in a visual and approachable way. The goal is to make complex ideas such as FABRIK, CCD, and Jacobian-based solving easier to understand through live examples, interactive simulations, and explanatory content.

The project is built as a learning-oriented presentation and prototype, with a focus on how motion systems can be visualized and explained in a browser-based environment.

## Project idea

The central idea behind LAYER_3 is to show how a chain of joints can be driven toward a target, whether in a robot arm, a fish body, or a spider leg system. Instead of only describing these algorithms in text, the project turns them into interactive experiments where the user can see how motion is calculated, constrained, and adjusted in real time.

This makes the project interesting for:

- computer graphics and animation exploration
- robotics and motion-planning basics
- visual learning of inverse kinematics
- university coursework and concept demonstrations

## University project context

This repository was created as part of a university project with a focus on AI-inspired and algorithmic motion systems. The project is educational in nature and aims to explain concepts in a way that is understandable for students and curious developers.

Important disclaimer:

- This is not a professional AI product.
- It is not a scientific research system or a production-grade robotics solution.
- It is an educational prototype built for learning and presentation.
- AI tools were used for parts of the code and implementation process, so this project should be understood as a student learning project rather than a definitive expert-level solution.

The intention is to explore the topic, explain the logic in a visual way, and document the learning process rather than claim final authority on the subject.

## Main goals

- explain inverse kinematics in a simple, visual way
- compare different solving methods such as FABRIK, CCD, and Jacobian DLS
- make motion systems interactive and inspectable
- create a clean presentation-style project that can be shared on GitHub
- document a university learning process in an accessible format

## What the project contains

The project combines a web frontend with interactive visualizations and explanatory sections. It includes:

- animated robot and character motion examples
- interactive IK and solver demonstrations
- explanations of algorithm behavior and constraints
- presentation-style pages and a project showcase layout
- Blender-related assets and motion references

## Tech stack

The project is built with modern web technologies:

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- Tailwind CSS

## Repository structure

```text
.
├── src/
│   ├── components/        # interactive visualizations and UI pieces
│   ├── content/           # explanatory project text and algorithm notes
│   ├── pages/             # main pages and content views
│   ├── presentation/      # presentation mode and slide structure
│   ├── App.tsx            # app entry logic
│   ├── main.tsx           # startup point
│   └── index.css          # global styling
├── public/                # static assets
├── blend/                 # Blender-related project files and assets
├── index.html             # HTML entry
├── package.json           # project config and scripts
├── tsconfig.json          # TypeScript config
├── vite.config.ts         # Vite config
├── README.md              # project documentation
└── ...
```

## How to run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite in the browser.

## Notes

This project is best understood as a creative and educational prototype: a way to visually explore abstract ideas, bridge theory and practice, and present a university project in a readable and engaging form.

It is intentionally simple, explanatory, and experimental rather than a polished commercial product.

## Final disclaimer

This project is a student project and should be treated as an educational experiment. It reflects a learning process, not expert-level authority in AI, robotics, or advanced motion control. The goal is understanding, experimentation, and communication of concepts.
