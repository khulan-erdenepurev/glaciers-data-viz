# Cleaned Swiss urban water dataset — prototype handoff

This folder is a **normalized extract** of five uploaded official-source files plus the uploaded 2025 Swiss municipal population workbook. Originals are unchanged. UTF-8 CSV with comma separators, headings, consistent water-volume units (m³), explicit measurement years, source metadata, geographical scope, and missing values left blank.

## Files

- `swiss_water_observations.csv`: normalized annual/monthly water observations and indicator values. Includes all supplied Basel monthly records (including blank 2025 months), annual Basel sums, Geneva's annual water sold, Bern city annual totals, Lausanne retail and approximate city allocation, and Zürich per-resident indicator plus a separately flagged estimate.
- `swiss_city_comparison_candidates.csv`: one suggested reference row for each of five cities, **not** a scientifically harmonized comparison table. Review `quality_flag`, `geographic_scope`, `volume_is_estimate`, and `use_for_direct_cross_city_comparison` before plotting.
- `swiss_city_population.csv`: permanent-resident municipality populations, **2025**, from the uploaded Swiss FSO export; uses BFS municipality codes.
- `swiss_city_data_sources.csv`: audit/provenance registry.

## Important comparison limitations

**Only Bern's current candidate is a direct reported city total.**

- **Zürich:** Official municipality water-use rate = 262 litres/person/day **in 2023** (BFS 261). The derived annual volume uses **2025 population (440,935)** from the uploaded FSO workbook and assumes the 2023 per-capita rate holds in 2025. It is a **cross-year modelled estimate**, not measured consumption in either year.
- **Basel:** The CSV reports monthly water consumption covering **Basel-Stadt and Binningen**. The **2024 annual sum** has all 12 months; 2025 has only 7 populated months, so its summed annual record is flagged partial and is NOT a full-year total. These do not isolate Basel municipality.
- **Bern:** `bern.pdf`, page 1, reports 2025 consumption **13.395 million m³ for Stadt Bern**, explicitly distinct from **24.218 million m³** for the wider regional water network. The 2024 city total is 13.300 million m³.
- **Genève:** In `geneva.xlsx`, `Eau vendue` represents the wider SIG/cantonal reporting scope, not Genève municipality. Source values are **thousands of m³**, multiplied by 1,000 here.
- **Lausanne:** The 2025 report (printed p. 30, PDF p. 16) provides **21,400,844 m³** metered retail deliveries across multiple municipalities and indicates about **55%** is in Lausanne territory. The city-share estimate is **11,770,464.2 m³**, but is approximate because 55% is rounded. Do not substitute the **32,090,161 m³** water production figure or the wastewater volume.
- These are **water utility/municipal use** measures, not consistent household-only consumption. They are *contextual volume comparisons*, not a statement that glacier melt supplies a city's water.

## Data modeling and Codex integration

The column `water_volume_m3` is the converted numeric volume when available. Source `per_capita_liters_day` is separate and must not be added to annual totals. Each record distinguishes `is_estimate`, `data_completeness`, `measurement_type`, `geographic_scope`, and `usable_as_city_total`. Blank cells mean unavailable data, **not zero**. The 2025 Basel record is a partial-year sum even though `period=annual` (check `data_completeness`).

If your prototype requires exactly comparable totals for Zürich, Basel, Bern, Genève and Lausanne, **you still need municipality-only, same-year, same-measure definitions**. Until then, do not feed the five candidate volumes into an unqualified ranked visualization. Alternatively, use five municipalities in Canton Zürich with a common per-resident metric and same-year populations.

Recommended: use `swiss_water_observations.csv` as the source and explicitly filter only scientifically appropriate records. Do not overwrite the existing app city CSV until the scope and year are resolved.
