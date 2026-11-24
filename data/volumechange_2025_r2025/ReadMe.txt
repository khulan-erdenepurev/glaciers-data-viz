The data of the Swiss Glacier Monitoring Network (GLAMOS) are freely available (https://www.glamos.ch) and may be used with 
indication of the source for scientific and non-commercial use.
When using these data, please cite as:
GLAMOS (2025). Swiss Glacier Volume Change, release 2025, Glacier Monitoring Switzerland, doi:10.18750/volumechange.2025.r2025.

SWISS GLACIER VOLUME CHANGE (GEODETIC MASS BALANCE)

General Information
-------------------
Due to the increased availability of surface elevation models from various sources and glacier outlines, the calculation of volume change and geodetic mass balance was extended to all Swiss glaciers. We provide comparison of all available pairs of digital elevation models per glacier, as well as time series of subsequent periods per glacier. The temporally closest glacier outline (from inventories and other sources) is attributed to each digital elevation model. 
Note that computed geodetic mass balances may show minor changes between releases due to newly available data (e.g. glacier outlines). Minor data gaps (max. 10% of the glacier area) were filled with hypsometric interpolation techniques. Uncertainties at the 1 sigma level were computed by quantifying the spatial correlation lengths through an assessment of the difference map over stable terrain. 

File description
----------------
 - volumechange_r2025_r2025_series.csv - contains selected volume change observations for each glacier arranged as a time series with a minimum interval of 3 years.
 - volumechange_r2025_r2025_allcombinations.csv - contains the volume change of all possible combinations between  available digital elevation models of an individual glacier. The minimum time difference has been set to 3 years. 

Metadata description - volumechange_2025_r2025.csv
------------------------------------------------------
SGI-ID: Swiss Glacier Inventory ID based on SGI2016
Source_start, Source_end: source of DEM
    - ai-bw -> swisstopo Aerial images b/w
    - ai-col -> swisstopo Aerial images color
    - dhm25-l1 -> swisstopo DHM25 - Level 1
    - dhm25-l2 -> swisstopo DHM25 - Level 2
    - is-spez -> swisstopo Image stripe - Spezialbefliegung
    - is-stand -> swisstopo Image stripe - Standardbefliegung
    - kp10 -> Kurvenplan 1:10k
    - kp25 -> Kurvenplan 1:25k
    - lk25 -> Landeskarte 1:25k
    - lk50 -> Landeskarte 1:50k
    - sk10 -> Spezialkarte 1:10k
    - sk25 -> Spezialkarte 1:25k
    - sieg-map -> Siegfried map
    - ueb-plan -> Uebersichtsplan
    - sa3d-2018 -> swissALTI3D 2018
    - sa3d-2019 -> swissALTI3D 2019
    - sa3d-2020 -> swissALTI3D 2020
    - sa3d-2021 -> swissALTI3D 2021
	- sa3d-2022 -> swissALTI3D 2022
	- sa3d-2023 -> swissALTI3D 2023
	- sa3d-2024 -> swissALTI3D 2024
    - ss3d-2024 -> swissSURFACE3d 2024
date_start: date of acquisition of source_start DEM, 9999: unknown day/month [yyyymmdd] 
date_end: date of acquisition of source_end DEM, 9999: unknown day/month [yyyymmdd]
A_start: area of glacier at start [km2]
outline_start: year of outline_start [yyyy]
A_end: area of glacier at end [km2]
outline_end: year of outline end [yyyy] 
dV: Volume change [km3]
dh_mean: Mean elevation change [m]
Bgeod: geodetic mass balance [mw.e.a-1]
sigma: uncertainty in geodetic mass balance [m.w.e.a-1]
covered: Percentage of DEM coverage [%]
rho_dv: Assumed density of volume change [kgm-3]
Name: Glacier name according to SGI2016
