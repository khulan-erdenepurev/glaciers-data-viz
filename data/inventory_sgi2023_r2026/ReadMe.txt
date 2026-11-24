SWISS GLACIER INVENTORY 2023
----------------------------
The Swiss Glacier Inventory 2023 provides glacier outlines (areas), debris cover and location points of all glaciers in Switzerland 
referring to the years 2021-2024. The data is based on aerial imagery and stereophotogrammatic analysis of the Federal 
office of Topography, Switzerland (swisstopo) within the framework of the Topographic landscape Model of Switzerland (swissTLM3D).
Furthermore the dataset has been revised by Glaciologists of VAW-ETH Zurich, University of Zurich and University of Fribourg (Switzerland). 
Please find more details about this dataset in the publications listed below.

Publication:
------------
  - Linsbauer, A., Huss, M., Hodel, E., Bauder, A. and Bärtschi, H. (2026) in prep
  - Linsbauer, A., Huss, M., Hodel, E., Bauder, A., Fischer, M., Weidmann, Y., Bärtschi, H. and Schmassmann, E. (2021) 
    The New Swiss Glacier Inventory SGI2016: From a Topographical to a Glaciological Dataset. Front. Earth Sci. 9:704189. 
	doi: 10.3389/feart.2021.704189
  - Weidmann, Y., Bärtschi, H., Zingg, Stefan., Schmassmann, E. (2019) Das Schweizerische Gletscherinventar als Produkt des 
    swissTLM3D. Geomatik Schweiz 5/2019, 114–119 (german only)
	
Content: Swiss Glacier Inventory 2023: 
--------------------------------------	
delivered as Shapefile (listed below) and GeoPackage (SGI_2023.gpkg) 
  --------------------------------------------------
  - Outlines: SGI_2023_glaciers.shp -
  --------------------------------------------------
    ATTRIBUTES:
	-----------
	 - [gid]: geometry-ID
	 - [pk_glacier]: uuid for internal use
	 - [sgi-id]: Swiss Glacier Inventory ID: [rl_3,rl_2,rl_1,rl_0]-[i_code] (f.e. A54e-24) 
	 - [name]: name of glacier (if available, f.e. 'Triftgletscher')
	 - [rl_3]: Riverlevel_3: Subdivision of the inventory area on the basis of catchment areas of major rivers (f.e. A)
	 - [rl_2]: Riverlevel_2: Subdivision of the inventory area on the basis of catchment areas of major tributaries (f.e. 5)
	 - [rl_1]: Riverlevel_1: Subdivision of the inventory area on the basis of catchment areas of medium-sized tributaries (f.e. 4)
	 - [rl_0]: Riverlevel_0: Subdivision of the inventory area on the basis of catchment areas of small tributaries (f.e. e)
	 - [i_code]: Inventory Code: Sequential number for glacier within a specific inventory region (f.e. 24)
	 - [year_acq]: Year of acquisition of the aerial image
	 - [year_rel]: Year of release of Swiss Glacier Inventory
	 - [area_km2]: Area in square kilometers
	 - [length_km]: Length of the center line according to Machguth, H. and Huss, M. (2014)
	 - [masl_min]: Minimum of meter above sea level based on swissALTI3D release 2025
	 - [masl_mean]: Mean of meter above sea level based on swissALTI3D release 2025
	 - [masl_med]: Median of meter above sea level based on swissALTI3D release 2025
	 - [masl_max]: Maximum of meter above sea level based on swissALTI3D release 2025
	 - [slope_deg]: Average of slope in degree based on swissALTI3D release 2025
	 - [aspect_deg]: Average of aspect in degree based on swissALTI3D release 2025
	 
  --------------------------------------------------
  - Locations: SGI_2023_locations.shp -
  --------------------------------------------------
    ATTRIBUTES:
	-----------
	 - [gid]: geometry-ID
	 - [pk_glacier]: uuid for internal use
	 - [sgi-id]: Swiss Glacier Inventory ID: [rl_3,rl_2,rl_1,rl_0]-[i_code] (f.e. A54e-24)
	 - [name]: name of glacier (if available, f.e. 'Triftgletscher')
	 - [xcoor]: x coordinate of location point
	 - [ycoor]: y coordinate of location point
	 
	(Please note, that this points have been choosen manually, mainly for labeling purposes.)
	 
  ------------------------------------------
  - Debris cover: SGI_2023_debriscover.shp -
  ------------------------------------------
    ATTRIBUTES:
	-----------
     - [gid]: geometry-ID
	 - [sgi-id]: Swiss Glacier Inventory ID of underlying glacier
	 - [name]: name of glacier (if available)
	 - [year_acq]: Year of acquisition of the aerial image
	 - [year_rel]: Year of release of Swiss Glacier Inventory
	 - [area_km2]: Area in square kilometers
	 
	 
  ------------------------------------------
  - Center lines: SGI_2023_centerlines.shp -
  ------------------------------------------
    ATTRIBUTES:
	-----------
     - [gid]: geometry-ID
	 - [sgi-id]: Swiss Glacier Inventory ID of glacier
	 - [name]: Name of glacier
	 - [year_acq]: Year of acquisition of the aerial image
	 - [year_rel]: Year of release of Swiss Glacier Inventory
	 - [length_km]: Length of the center line in kilometers
	 
	 according to Machguth, H. and Huss, M. (2014). The length of the world's glaciers - a new approach for the global calculation of center lines. The Cryosphere, 8, 1741-1755. doi:10.5194/tc-8-1741-2014
	 

Additional Information:
-----------------------
CRS: CH1903+ / LV95 (EPSG 2056)
Encoding: UTF-8

When using these data, please cite as:
--------------------------------------
GLAMOS (2026). Swiss Glacier Inventory 2023, release 2026, Glacier Monitoring Switzerland, doi:10.18750/inventory.sgi2023.r2026

-------------------------------------
DOI: 10.18750/inventory.sgi2023.r2026
-------------------------------------