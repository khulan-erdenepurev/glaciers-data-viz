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

Open the address printed by Vite. The main route connects the individual, apartment, city and glacier comparison chapters through vertical scrolling. Use the arrow buttons or selectors to change values. Horizontal trackpad gestures work over the relevant controls and visual areas. Each chapter shows its fixed cube unit and any volume left over after counting whole cubes. City panels use labelled map placeholders. Open `/overview.html` for the Task 06 plots and exact observations table.

Screen 04 uses one cube for every 500,000 m³ across all comparisons. The city pile regroups to this unit as it moves left from Screen 03. Each pile uses whole cubes, so the smallest city estimate (Zürich for 30 days) appears as seven cubes. The exact volumes, remainder and comparison ratio are shown separately. Sideways gestures on the city, period and glacier headings change those selections individually.

Run `npm test` for checks against the supplied CSVs and `npm run build` to build both pages. See [PLAN.md](PLAN.md) for the approved roadmap. The screen descriptions below the project root are provisional references for future milestones.

The overview uses GLAMOS's fixed-date [Swiss Glacier Mass Balance, release 2025](https://doi.org/10.18750/massbalance.2025.r2025). Years are labelled by the end of the hydrological year. Balances are shown in millimetres of water equivalent. City estimates use the supplied population and daily use figures, with the Zürich rate from municipality 261 in the 2023 cantonal CSV.

### Swiss municipality water comparisons

Screens 03–04 use the cleaned observations, comparison candidates and municipality population CSVs in `data/processed/swiss_water_cleaned/`. The source registry is supplied as a Numbers workbook. Runtime attribution comes from the CSVs. Screen 01 and Screen 02 use the cleaned Zürich 2023 per-resident indicator for their illustrative daily, 30-day and 365-day calculations.

Bern's 2025 figure is a reported municipal total. Zürich's 2025 estimate applies the 2023 rate to the 2025 population. Lausanne's 2025 figure estimates local retail deliveries using a rounded 55% allocation. These estimates are contextual volume comparisons with glacier loss. Basel and Genève remain selectable with municipality water volumes unavailable because their sources cover wider supply areas.

Where a complete municipality month is available in the reference year, its dated reading takes priority. For the current eligible cities, Monthly means a derived average of the annual figure divided by 12. Basel's actual months and its incomplete 2025 sum remain in the normalized history with their original scope and completeness flags. They do not enter municipality comparisons.
