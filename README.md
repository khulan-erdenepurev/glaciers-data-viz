# Prototype Specification: Swiss Glaciers

## General

- **Project:** Experimental scrollytelling about urban water consumption and Swiss glacier mass balance.
- **Technology:** Vite, vanilla JavaScript and D3. Three.js powers the cube test scene.
- **Data:** All data files are in the `data/` folder. Use only this data; do not invent values.

## How this specification is organized

- The provisional screens each have a folder in `screens/`, numbered in narrative order.
- Each screen folder contains a `README.md` with the description of that screen, plus one or more photos of the paper prototype.
- **All images in a screen folder belong to that screen.** `screen.jpg` is the main photo; additional photos show other states of the same screen (e.g. `state_no-data.jpg`).

## Local prototype

Use Node.js 22.12 or newer. From the project root, run:

```sh
npm install
npm run dev
```

Open the address printed by Vite. The main route connects the individual, apartment and city chapters through vertical scrolling. Use the arrow buttons or selectors to change values. Horizontal trackpad gestures work over the relevant controls and visual areas. Each chapter shows its fixed cube unit and any volume left over after counting whole cubes. City panels use labelled map placeholders. Open `/overview.html` for the Task 06 plots and exact observations table.

Run `npm test` for checks against the supplied CSVs and `npm run build` to build both pages. See [PLAN.md](PLAN.md) for the approved roadmap. The screen descriptions below the project root are provisional references for future milestones.

The overview uses GLAMOS's fixed-date [Swiss Glacier Mass Balance, release 2025](https://doi.org/10.18750/massbalance.2025.r2025). Years are labelled by the end of the hydrological year. Balances are shown in millimetres of water equivalent. City estimates use the supplied population and daily use figures, with the Zürich rate from municipality 261 in the 2023 cantonal CSV.
