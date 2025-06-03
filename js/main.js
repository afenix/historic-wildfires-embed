
/**
 * This file contains the main JavaScript code for the Historic Wildfire Embed app.
 * It sets up global variables, event listeners, and functions for creating and interacting with the Leaflet map.
 * The code also includes functions for updating the displayed year, adding custom controls to the map, and setting up an Intersection Observer for scrolling events.
 * @global
 * @namespace
 */
// Set the Global variables
const mapParams = {
    'containerID': 'map-container',
    'center':  [35.3, -105.5],
    'zoom': 3
}
// Define regions to create custom zoom control - include center coordinates and zoom levels
const regions = {
    'USA': {
        tooltip: 'Zoom to Entire U.S.',
        center: [39.3, -98.5],
        zoom: 3,
        bounds: L.latLngBounds([17.5, -179], [72, -65])
    },
    'CONUS': {
        tooltip: 'Zoom to Continental U.S.',
        center: [37.5, -96.5],
        zoom: 4,
        bounds: L.latLngBounds([24.396308, -125.0], [49.384358, -66.93457])
    },
    'AK': {
        tooltip: 'Zoom to Alaska',
        center: [63.67, -151.626],
        zoom: 4,
        bounds: L.latLngBounds([51.2, -179], [71.5, -129])
    },
    'HI': {
        tooltip: 'Zoom to Hawai‘i',
        center: [20.7967, -156.3319],
        zoom: 6,
        bounds: L.latLngBounds([18.5, -161], [21.9, -154])
    }
};
const dataDates = {
    'fire-history': {
        startYear: 1984,
        endYear: 2019
    },
    'drought-history': {
        startYear: 2000,
        endYear: 2022
    }
}
const geoJsonPaths = {
    'mtbs-fires-pts': 'assets/data/MTBS_WFIGS_Combined_Fires_1984_2025.geojson',
    'mtbs-fires-poly': 'assets/data/mtbs_fire_poly.geojson'
}
let featuredFireMarkers = [];
let map;
let currentYear = dataDates['fire-history'].startYear;
let geoJson;
let suppressBoundsCheck = false; // Flag to suppress bounds check on initial zoom

// Define thresholds for fire sizes
const SMALL_FIRE_MAX_ACREAGE = 1000;    // up to 1,000 acres
const MEDIUM_FIRE_MAX_ACREAGE = 9999;   // 1,001 to 9,999 acres
const LARGE_FIRE_MAX_ACREAGE = 99999;   // 10,000 to 99,999 acres
// Any fire above 100,000 acres is considered a mega fire

// Define fixed sizes for the icons based on proportions
const BASE_FIRE_SIZE = 12; // Small fire as the visual reference
const MEDIUM_FIRE_SIZE = BASE_FIRE_SIZE * 1.4;  // 40% increase
const LARGE_FIRE_SIZE = BASE_FIRE_SIZE * 2.2;  // 80% increase
const MEGA_FIRE_SIZE = BASE_FIRE_SIZE * 3.4;  // 120% increase

// Add event listeners for splash screen and sidebar panel behavior
document.addEventListener('DOMContentLoaded', function () {
    const toggleLegendButton = document.getElementById('toggle-legend-button');
    const legendContainer = document.querySelector('.legend-container');
    const yearSlider = document.getElementById('slider');

    createMap(mapParams.containerID, mapParams.center, mapParams.zoom);

    // Check the actual visibility using computed style
    const legendVisible = window.getComputedStyle(legendContainer).display !== 'none';

    // Set the initial text based on visibility
    toggleLegendButton.textContent = legendVisible ? 'Close Legend' : 'Open Legend';

    // Toggle function to show/hide the legend and update button text
    toggleLegendButton.addEventListener('click', () => {
        const isVisible = window.getComputedStyle(legendContainer).display !== 'none';
        if (isVisible) {
            legendContainer.style.display = 'none';
            toggleLegendButton.textContent = 'Open Legend';
        } else {
            legendContainer.style.display = 'block';
            toggleLegendButton.textContent = 'Close Legend';
        }
    });

    // Attach an event listener to the year slider to highlight the corresponding bar chart year when the slider is moved.
    yearSlider.addEventListener('click', () => {
        const selectedYear = +document.getElementById('range-value').textContent; // Get year as number
        highlightBarChartYear(selectedYear);
    });

});

// Function to instantiate the Leaflet map and custom controls
const createMap = (containerId, center, zoom) => {


    // Create the map and set its initial view to the specified coordinates and zoom level
    map = L.map(containerId, {
        center: center,
        zoom: zoom,
        minZoom: 3,
        maxZoom: 10,
        maxBounds: regions['CONUS'], // Start with CONUS
        maxBoundsViscosity: 0.7 // “resistance” near boundary edge
    });

    // Disable user interactions (but still allow programmatic zoom/pan)
    map.scrollWheelZoom.disable();   // disable scroll wheel zoom
    //map.dragging.disable();           // disable mouse drag
    //map.doubleClickZoom.disable();   // disable double click zoom
    //map.boxZoom.disable();           // disable shift+drag zoom
    //map.keyboard.disable();          // disable keyboard controls
    //map.touchZoom.disable();         // disable touch zoom

    // Create a new control that adds the home button to the map
    L.Control.HomeButton = L.Control.extend({
        onAdd: function(map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom home-button');
            // Style Home button - use Font Awesome's home icon
            container.innerHTML = '<i class="fa-solid fa-house"></i>';
            container.setAttribute('data-tooltip', 'Zoom to full  extent')
            container.style.backgroundColor = 'white';
            container.style.width = '34px';
            container.style.height = '36px';
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'center';

            // Attach the event listener to the container
            container.onclick = function() {
                suppressBoundsCheck = true;
                 // Update maxBounds based on selected region
                const region = regions['USA'];
                if (region.bounds) {
                    map.setMaxBounds(region.bounds);
                }
                // Zoom to center/zoom
                map.setView(region.center, region.zoom);
            }
            return container;
        }
    });
    // Add the new home control to the map
    map.addControl(new L.Control.HomeButton({ position: 'topleft' }));

    // Create a new control for zooming to user's location
    L.Control.UserLocation = L.Control.extend({
        onAdd: function(map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom zoom-user-button');
            // Style Home button - use Font Awesome's home icon
            container.innerHTML = '<i class="fa-solid fa-location-arrow"></i>';
            container.setAttribute('data-tooltip', 'Zoom to your location')
            container.style.backgroundColor = 'white';
            container.style.width = '34px';
            container.style.height = '36px';
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'center';

            // Attach the event listener to the container
            container.onclick = function() {
                map.locate({setView: true, maxZoom: 8}); // user Leaflet location
            }
            return container;
        }
    });
    // Add the new home control to the map
    map.addControl(new L.Control.UserLocation({ position: 'topleft' }));

    // Create and add a custom zoom control for each region
    Object.keys(regions).forEach(function(regionKey) {
        var region = regions[regionKey];
        L.Control.RegionButton = L.Control.extend({
            onAdd: function(map) {
                var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom region-button');

                // Set the inner HTML for the button, e.g., the name of the region
                container.innerHTML = regionKey.toUpperCase();
                // Add the data-tooltip attribute
                container.setAttribute('data-tooltip', region.tooltip)

                // Style region buttons
                container.style.backgroundColor = 'white';
                container.style.width = '40px';
                container.style.height = '35px';
                container.style.display = 'flex';
                container.style.justifyContent = 'center';
                container.style.alignItems = 'center';
                container.fontFamily = "Protest Revolution";

                // Attach the event listener
                container.onclick = function() {
                    suppressBoundsCheck = true;
                    // Update maxBounds based on selected region
                   if (region.bounds) {
                        map.setMaxBounds(region.bounds);
                    }

                    map.setView(region.center, region.zoom);
                }

                return container;
            }
        });

        // Add each region zoom control to the map
        map.addControl(new L.Control.RegionButton({ position: 'topleft' }));
    });

    // Add a tile layer to the map using Mapbox's dark basemap tiles for contrast with the wildfire data
    L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/dark-v8/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYWxpc3RlcmZ4IiwiYSI6ImNsdmx2ejJ6NjJmYTAycnBodTczcnRsbWQifQ.bZ7LqgToP7GFn2210da3Bg', {
        attribution: '© <a href="https://www.mapbox.com/map-feedback/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    map.attributionControl.addAttribution('Historical fire data &copy; <a href="https://www.mtbs.gov/">Monitoring Trends in Burn Severity</a>');

    // Add a scale bar to the map
    L.control.scale({ position: 'bottomleft', metric: false }).addTo(map);

    map.on('moveend', () => {
        if (suppressBoundsCheck) {
            suppressBoundsCheck = false;
            return;
        }
        const bounds = map.options.maxBounds;
        if (bounds && !bounds.contains(map.getCenter())) {
            map.panInsideBounds(bounds, { animate: true });
        }
    });

    // Initiate the retrieval and display of wildfire points
    loadFireData ();
    createCloroplethLegend();
    createProportionalLegend();
};

// Function to toggle the side panel and adjust the map
const toggleSidePanelAndAdjustMap = (event) => {
    const sidePanel = document.getElementById('side-panel-container');
    const mapContainer = document.getElementById('map-container');
    // Get the scale bar element
    const scaleBar = document.querySelector('.leaflet-control-scale');

    // Toggle the classes to resize the map and side panel
    sidePanel.classList.toggle('closed');
    scaleBar.classList.toggle('closed');
    mapContainer.classList.toggle('expanded');

    // Change the text content of the toggle button based on the current state of the side panel
    if (sidePanel.classList.contains('closed')) {
        event.target.textContent = 'Open';
    } else {
        event.target.textContent = 'Close';
    }

    // Wait for the transition, then adjust the map size and re-center
    setTimeout(function () {
        map.invalidateSize(); // Adjust map size to new container size
        // Re-center the map on Redding, California
        map.setView([40.61063281856264, -122.63627755594064], map.getZoom());
    }, 300); // Adjust timeout duration
}

const closeSidePanel = () => {
    const sidePanel = document.getElementById('side-panel-container');
    const mapContainer = document.getElementById('map-container');
    // Get the scale bar element
    const scaleBar = document.querySelector('.leaflet-control-scale');

    // Toggle the classes to resize the map and side panel
    sidePanel.classList.toggle('closed');
    scaleBar.classList.toggle('closed');
    mapContainer.classList.toggle('expanded');

    // adjust the map size and re-center
    map.invalidateSize(); // Adjust map size to new container size
    // Re-center the map on Redding, California
    map.setView([40.61063281856264, -122.63627755594064], map.getZoom());
}


/**
 * Extracts unique years from an array of features.
 * @param {Array} features - The array of features.
 * @returns {Array} - An array of unique years sorted in ascending order.
 */
const extractUniqueYears = (features) => {
    const years = new Set();
    features.forEach(feature => {
        const igDate = feature.properties.Ig_Date;
        if (igDate) {
            const year = igDate.substring(0, 4);
            if (parseInt(year) >= 1990) { // ✅ Filter starts here
                years.add(year);
            }
        }
    });
    return Array.from(years).sort();
};

/**
 * Loads fire data from a specified geoJsonPath and kicks off the process to filter and display the data.
 * @returns {Promise<void>} A promise that resolves when the fire data is loaded and processed.
 */
const loadFireData  = async () => {
    try {
        const response = await fetch(geoJsonPaths["mtbs-fires-pts"]);
        const data = await response.json();

         // Extract unique years and initialize the slider
        const uniqueYears = extractUniqueYears(data.features);

        setupSliderAndButtons(uniqueYears);

        // Process data for chart ingestion and create the stacked bar chart
        const lineChartData = createChartData(data);
        createStackedBarChart(lineChartData);

        // Load the initial year's data
        filterMapByYear(uniqueYears[0]);

    } catch (error) {
        console.error("Failed to load or process geojson:", error);
    }
};

/**
 * Function to add and style fire data to the map
 * @param {Object} geojsonData - The GeoJSON data containing the fire incident locations and attributes
 */
const addFireDataToMap = (geojsonData) => {
    if (window.geoJsonLayer) {
        map.removeLayer(window.geoJsonLayer);
    }

    window.geoJsonLayer = L.geoJSON(geojsonData, {
        pointToLayer: createFireMarker,
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                layer.bindPopup(createFirePopup(feature));
            }
        }
    }).addTo(map);
};

/**
 * Creates a fire marker on the map.
 * @param {Object} feature - The feature object containing properties of the fire.
 * @param {L.LatLng} latlng - The latitude and longitude coordinates of the fire marker.
 * @returns {L.Marker} - The fire marker.
 */
const createFireMarker = (feature, latlng) => {
    const props = feature.properties;
    const fireType = props.Incid_Type;
    const isFeatureFire  = props.isFeatureFire  === 1;
    const acres = parseFloat(props.BurnBndAc);

    // Only render if:
    // 1. It's a featured fire (always include)
    // 2. OR it has 1 or more acres
    if (!isFeatureFire && (!acres || acres < 1)) return;

    // If it's a featured fire, use the featured icon
    const iconUrl = isFeatureFire
        ? 'assets/img/featuredFire.svg'
        : getIconUrlForFireType(fireType === 'Unknown' ? 'Wildfire' : fireType);

    const iconSize = calcPropRadius(acres);

    const fireIcon = L.icon({
        iconUrl: iconUrl,
        iconSize: [iconSize, iconSize],
        className: isFeatureFire  ? 'fire-icon feature-fire' : 'fire-icon'
    });

    const marker = L.marker(latlng, { icon: fireIcon });

        // Add tooltip only for featured fires
    if (isFeatureFire) {
        marker.bindTooltip("🔥 Featured Fire", {
            permanent: true,
            direction: 'top',
            className: 'featured-fire-tooltip'
        }).openTooltip(); // Ensure it shows immediately

        // Add marker to global list
        featuredFireMarkers.push(marker);

        // Auto-dismiss tooltip after 3 seconds (3000 ms)
        setTimeout(() => {
            marker.unbindTooltip();
        }, 2000);

        // Remove tooltip on click (when popup is triggered)
        marker.on('click', function () {
            featuredFireMarkers.forEach(m => m.unbindTooltip());
            featuredFireMarkers = []; // clear list so they’re not tracked anymore
        });
    }

    return marker;

}

/**
 * Creates a fire popup HTML string based on the provided feature.
 * @param {Object} feature - The feature object containing fire properties.
 * @returns {string} The HTML string representing the fire popup.
 */
const createFirePopup = (feature) => {
    const props = feature.properties;
    const isFeatured = props.isFeatureFire === 1;

    const name = props.FireName || 'Not Available';
    const date = props.Ig_Date ? new Date(props.Ig_Date).toLocaleDateString("en-US") : 'Unknown';
    const acres = props.BurnBndAc ? props.BurnBndAc.toLocaleString() : 'Not Available';
    const cause = props.Cause || 'Unknown';
    const cost = props.Cost ? props.Cost : 'Not Reported';
    const livesLost = props.LivesLost ?? 'Not Reported';
    const structuresLost = props.StrucLost ?? 'Not Reported';

    return `
        <div class="map-popup">
            ${isFeatured ? `<div class="popup-label">🔥 Featured Fire</div>` : ''}
            <h3 class="popup-title">${name}</h3>
            <p class="popup-subtitle"><strong>Ignited:</strong> ${date}</p>

            <div class="popup-metrics">
                <div><strong>Acres:</strong> ${acres}</div>
                <div><strong>Cost:</strong> ${cost}</div>
                <div><strong>Lives Lost:</strong> ${livesLost}</div>
                <div><strong>Structures:</strong> ${structuresLost}</div>
            </div>

            ${isFeatured ? `
                <p class="popup-cause"><strong>Cause:</strong> ${cause}</p>
                <p class="popup-description">
                    This fire was selected to illustrate significant trends in wildfire behavior,
                    community impact, or response.
                </p>
            ` : ''}
        </div>
    `;
}

/**
 * Returns the URL of an icon based on the given fire type.
 *
 * @param {string} fireType - The type of fire.
 * @returns {string} The URL of the corresponding icon.
 */
const getIconUrlForFireType = (fireType) => {
    switch (fireType) {
        case 'Wildfire':
            return 'assets/img/wildfire_igType2.svg';
        case 'Prescribed':
            return 'assets/img/prescribed_igType2.svg';
        case 'Unknown':
            return 'assets/img/unknown_igType2.svg';
        case 'Wildland Fire Use':
            return 'assets/img/beneficialFire_igType3.svg';
        case 'Outline':
            return 'assets/img/fire_outline.svg';
        default:
            return 'assets/img/unknown_igType2.svg';
    }
}

/**
 * Calculates the proportional radius based on the burned acres.
 * @param {number} burnedAcres - The number of burned acres.
 * @returns {number} The proportional radius.
 */
const calcPropRadius = (burnedAcres) => {
    if (burnedAcres <= SMALL_FIRE_MAX_ACREAGE) {
        return BASE_FIRE_SIZE;
    } else if (burnedAcres <= MEDIUM_FIRE_MAX_ACREAGE) {
        return MEDIUM_FIRE_SIZE;
    } else if (burnedAcres <= LARGE_FIRE_MAX_ACREAGE) {
        return LARGE_FIRE_SIZE;
    } else {
        return MEGA_FIRE_SIZE;
    }
};

/**
 * Sets up the slider and buttons for controlling the years.
 *
 * @param {Array} years - An array of years.
 */
const setupSliderAndButtons = (years) => {
    const slider = document.getElementById('yearSlider');
    const rangeValueDisplay = document.getElementById('range-value');
    const reverseButton = document.getElementById('reverse');
    const forwardButton = document.getElementById('forward');
    const playButton = document.getElementById('play');
    const pauseButton = document.getElementById('pause');

    let animationInterval = null;

    // Update visual and map
    function updateSliderAppearance(index) {
        const percentage = (index / (years.length - 1)) * 100;
        slider.style.background = `linear-gradient(to right, red ${percentage}%, grey ${percentage}%)`;
        rangeValueDisplay.textContent = years[index];

        const selectedYear = years[index];
        filterMapByYear(selectedYear); // update d3 chart when clicking the slider
        highlightBarChartYear(selectedYear); // update d3 chart when auto-playing
    }

    // Move to a specific year
    function setYear(index) {
        slider.value = index;
        updateSliderAppearance(index);
    }

    // Start auto-play
    function startAnimation() {
        if (animationInterval) return; // don't double-run

        animationInterval = setInterval(() => {
            let current = parseInt(slider.value, 10);
            if (current < years.length - 1) {
                setYear(current + 1);
            } else {
                stopAnimation();
            }
        }, 1000); // Change speed here (1000ms = 1 sec per year)
    }

    // Stop auto-play
    function stopAnimation() {
        clearInterval(animationInterval);
        animationInterval = null;
    }

    // Set slider bounds
    slider.min = 0;
    slider.max = years.length - 1;
    setYear(0); // Load first year

    // Manual controls
    slider.oninput = () => setYear(parseInt(slider.value, 10));
    reverseButton.onclick = () => setYear(Math.max(0, slider.value - 1));
    forwardButton.onclick = () => setYear(Math.min(years.length - 1, parseInt(slider.value, 10) + 1));

    playButton.onclick = startAnimation;
    pauseButton.onclick = stopAnimation;

    // Optional: start animating immediately on load
    startAnimation();
};

/**
 * Filters the map data by year.
 * @param {string} year - The year to filter the data by.
 */
const filterMapByYear = (year) => {
  fetch(geoJsonPaths['mtbs-fires-pts'])
  .then(response => response.json())
  .then(data => {
    const filteredData = {
        type: 'FeatureCollection',
        features: data.features.filter(feature => {
            const props = feature.properties;
            const fireYear = props.Ig_Date?.substring(0, 4);
            const incType = props.Incid_Type;
            const acres = parseFloat(props.BurnBndAc || 0);

            const isRelevantType = ['Wildfire', 'Unknown'].includes(incType);
            const isTargetYear = fireYear === year;

            return isRelevantType && isTargetYear && acres >= 500;
        })
    };
    // Clear old data (if any)
    if (window.geoJsonLayer) {
      map.removeLayer(window.geoJsonLayer)
    }
    // Add new data to the map
    addFireDataToMap(filteredData)

    // Calculate total acres burned for the year
    let yearSumAcres = calculateTotalAcresByYear(filteredData)
    // Update the map title with the total acres burned for the year
    //updateElementsOnPage(yearSumAcres, year)
  })
  .catch(error => {
    console.error('Error filtering data:', error)
  })

};


/**
 * Function to create a proportional map legend.
 * @param {number} minValue - The minimum value for the legend.
 * @param {number} maxValue - The maximum value for the legend.
 * @returns {void} - This function does not return any value, it creates a proportional map legend.
 */
const createProportionalLegend = () => {
    const legendContainer = document.getElementById('proportional-container');
    legendContainer.innerHTML = '';  // Clear existing content

    // Create and append the header
    const header = document.createElement('div');
    header.className = 'column-header-proportional';
    header.textContent = 'Acres Burned:';
    legendContainer.appendChild(header);

    // Define the categories with label and icon size
    const categories = [
        { label: 'Small: ≤1k', size: BASE_FIRE_SIZE },
        { label: 'Medium: 1k–9.9k', size: MEDIUM_FIRE_SIZE },
        { label: 'Large: 10k–99.9k', size: LARGE_FIRE_SIZE },
        { label: 'Mega: ≥100k', size: MEGA_FIRE_SIZE }
    ];

    // Generate a row for each icon/label pair
    categories.forEach(category => {
        const row = document.createElement('div');
        row.className = 'legend-item';

        const icon = document.createElement('img');
        icon.src = getIconUrlForFireType('Outline');  // Or whatever default type
        icon.style.width = `${category.size}px`;
        icon.style.height = `${category.size}px`;
        icon.className = 'legend-icon';

        const label = document.createElement('div');
        label.textContent = category.label;
        label.className = 'legend-label';

        row.appendChild(icon);
        row.appendChild(label);
        legendContainer.appendChild(row);
    });
};

/**
 * Function to create a cloropleth map legend.
 * @returns {void} - This function does not return any value, it creates a proportional map legend.
 */
const createCloroplethLegend = () => {
    const legendContainer = document.getElementById('cloropleth-container');
    // Create and append the header for the Cloropleth Legend
    const header = document.createElement('div');
    header.className = 'column-header-cloropleth';
    header.textContent = 'Type of Fire:';
    legendContainer.appendChild(header);  // Append the header to the container

    const classes = [
        { label: 'Wildfires', iconUrl: 'assets/img/wildfire_igType2.svg' },
        { label: 'Featured Wildfires', iconUrl: 'assets/img/featuredFire.svg' } // Optional
    ];

    classes.forEach(cls => {
        const itemContainer = document.createElement("div");
        itemContainer.className = "legend-item-cloropleth";

        // Use an SVG image instead of a colored circle
        const legendIcon = document.createElement('img');
        legendIcon.src = cls.iconUrl;
        legendIcon.style.width = legendIcon.style.height = '40px';  // Adjust size as necessary

        const legendValue = document.createElement('div');
        legendValue.className = 'legendValue-cloropleth';
        legendValue.textContent = cls.label;

        // Append the icon and label to the container
        itemContainer.appendChild(legendIcon);
        itemContainer.appendChild(legendValue);
        legendContainer.appendChild(itemContainer);
    });
};

/**
 * Calculates the total acres burned by year from the given geojsonData.
 *
 * @param {Object} geojsonData - The geoJSON data containing the features with burn data.
 * @returns {Object} - An object with the total acres burned by year.
 */
const calculateTotalAcresByYear = (geojsonData) => {
    const summary = {};

    geojsonData.features
        .filter(feature => {
            const props = feature.properties;
            const incType = props.Incid_Type;
            const acres = parseFloat(props.BurnBndAc || 0);
            const isFeature = props.isFeatureFire === 1;

            // Include only:
            // 1. Wildfire/Unknown types
            // 2. Acres >= 500 or is a featured fire
            return ['Wildfire', 'Unknown'].includes(incType) && (acres >= 500 || isFeature);
        })
        .forEach(feature => {
            const year = feature.properties.Ig_Date.substring(0, 4);
            const incType = feature.properties.Incid_Type;
            const acres = parseFloat(feature.properties.BurnBndAc || 0);

            if (!summary[year]) summary[year] = { totalAcres: 0 };
            if (!summary[year][incType]) summary[year][incType] = 0;

            summary[year][incType] += acres;
            summary[year].totalAcres += acres;
        });

    return summary;
};


/**
 * Updates the map title with the given number of acres.
 * @param {number} acres - The number of acres to display in the map title.
 * @returns {void}
 */
const updateElementsOnPage = (yearData, year) => {
    // Check if data for the specific year is available
    if (!yearData[year]) {
        console.error('Data for year', year, 'is not available.');
        return;
    }

    // Directly retrieve values from the yearData
    const totalFireAcres = yearData[year]['totalAcres'] || 0;  // Use a default of 0 if no data
    const prescribedFireAcres = yearData[year]["Prescribed Fire"] || 0;  // Use a default of 0 if no data
    const unknownAcres = yearData[year]['Unknown'] || 0;
    const wildfireAcres = yearData[year]['Wildfire'] || 0;


    // Update the DOM elements with the new values
    const fireYearElements = document.getElementsByClassName('fire-year');
    Array.from(fireYearElements).forEach(element => {
        element.textContent = year;
    });

    const fireTotalElements = document.getElementsByClassName('total-fire-acres');
    Array.from(fireTotalElements).forEach(element => {
        element.textContent = totalFireAcres.toLocaleString();
    });
    document.getElementById('wildfire-acres').textContent = wildfireAcres.toLocaleString(); // Format numbers with commas
    document.getElementById('prescribed-acres').textContent = prescribedFireAcres.toLocaleString();
    document.getElementById('wildland-fire-use-acres').textContent = wildLandFireUseAcres.toLocaleString();  // Assuming 'Wildfire' is equivalent to 'Wildland Fire Use'
    document.getElementById('unknown-acres').textContent = unknownAcres.toLocaleString();
};


//TODO _ THIS IS NOT CURRENTLY SETUP
// Function to update the search control with new data
function updateSearchControl(layer) {
    if (map.hasControl(window.searchControl)) {
        map.removeControl(window.searchControl);
    }
    window.searchControl = new L.Control.Search({
        layer: layer,
        propertyName: 'FireName',
        position: 'topleft',
        initial: false,
        zoom: 12,
        marker: false,
        moveToLocation: (latlng, title, map) => {
            map.fitBounds(latlng.layer.getBounds());
            latlng.layer.fire('click'); // Open the popup
        },
        filter: (text, layer) => {
            return layer.feature.properties.FireName.toLowerCase().includes(text.toLowerCase());
        }
    });
    map.addControl(window.searchControl);
}


// Make sure that the slider the default click propagation behavior on the map is disabled (e.g., when user clicks on slider, map won't zoom)
const slider = L.DomUtil.get('slider');
if (slider) {
    L.DomEvent.disableClickPropagation(slider);
    L.DomEvent.on(slider, 'mousewheel', L.DomEvent.stopPropagation);
}

// --------------------------------------------------------------------------------------
// Sidebar Logic
// Special Appreciation goes to Grzegorz Tomicki for providing
// implementation logic for the clickable sidebar:
// https://github.com/tomickigrzegorz/leaflet-examples/blob/master/docs/56.sidebar/style.css
// ---------------------------------------------------------------------------------------

// Selectors
const menuItems = document.querySelectorAll(".menu-item");
const sidebar = document.querySelector(".sidebar");
const buttonClose = document.querySelector(".close-button");

// Add event handlers for the menu items
menuItems.forEach((item) => {
    item.addEventListener("click", (e) => {
        const target = e.target;

        if (
            target.classList.contains("active-item") ||
            !document.querySelector(".active-sidebar")
        ) {
            document.body.classList.toggle("active-sidebar");
        }

        // show content
        showContent(target.dataset.item);
        // add active class to menu item
        addRemoveActiveItem(target, "active-item");
    });
});

// Remove active class from menu item and content
const addRemoveActiveItem = (target, className) => {
    const element = document.querySelector(`.${className}`);
    target.classList.add(className);
    if (!element) return;
    element.classList.remove(className);
}

// show specific content
const showContent = (dataContent) => {
    const idItem = document.querySelector(`#${dataContent}`);
    addRemoveActiveItem(idItem, "active-content");
}

// Close sidebar when click on close button
buttonClose.addEventListener("click", () => {
    closeSidebar();
});

// Close the sidebar when user clicks escape key
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeSidebar();
    }
});

// Close sidebar when click near it
document.addEventListener("click", (e) => {
    if (!e.target.closest(".sidebar")) {
        closeSidebar();
    }
});

// Close sidebar when user clicks on close button
const closeSidebar = () => {
    document.body.classList.remove("active-sidebar");
    const element = document.querySelector(".active-item");
    const activeContent = document.querySelector(".active-content");
    if (!element) return;
    element.classList.remove("active-item");
    activeContent.classList.remove("active-content");
}

const createChartData = (geojsonData) => {
    const wildfireData = calculateTotalAcresByYear(geojsonData);
    const data = Object.keys(wildfireData)
        .filter(year => parseInt(year) >= 1990) // Filter to include only years from 1990 onwards
        .map(year => ({
            year: new Date(year, 0, 1),
            totalAcres: wildfireData[year].totalAcres || 0,
            wildfire: (wildfireData[year]['Wildfire'] || 0) + (wildfireData[year]['Unknown'] || 0)
        }));
    return data;
};


//-------------------------------------------------------------------------------------------------------------

//-------------------   D3 CHART  -----------------------------------------------------------------------------

//-------------------------------------------------------------------------------------------------------------
/**
 * Creates a stacked bar chart based on the provided data.
 *
 * @param {Array} data - The data used to generate the stacked bar chart.
 */
const createStackedBarChart = (data) => {
    // Setup the SVG and its dimensions
    const svg = d3.select('#wildfireChart');
    const margin = { top: 20, right: 20, bottom: 40, left: 80 };
    const width = +svg.attr('width') - margin.left - margin.right;
    const height = +svg.attr('height') - margin.top - margin.bottom;
    const d3Group = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Setup the scales
    const x = d3.scaleTime()
        .range([0, width])
        .domain(d3.extent(data, d => d.year));

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(data, d => d.totalAcres)]);

    const z = d3.scaleOrdinal()
        .range(["#e78531", "#d9dbdb"])
        .domain(['wildfire']);

    // Setup the stack function
    const stack = d3.stack()
        .keys(['wildfire']);

    // Generate layers
    const layers = stack(data);

    // Create groups for each series and append rectangles
    d3Group.selectAll(".serie")
        .data(layers)
        .enter().append("g")
            .attr("class", "serie")
            .attr("fill", d => z(d.key))
        .selectAll("rect")
        .data(d => d)
        .enter().append("rect")
            .attr("x", d => x(d.data.year) - (width / data.length) / 2)
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]))
            .attr("width", width / data.length)
            .attr("data-year", d => d.data.year.getFullYear())
            .on('mouseover', function(d, event) {
                // Show tooltip
                d3.select('#chart-tooltip')
                    .style('left', (event.pageX + 10) + "px")
                    .style('top', (event.pageY - 20) + "px")
                    .classed('hidden', false)
                    .html(`
                        <div>
                            <h3><strong>${d.data.year.getFullYear()}</strong></h3>
                            <p><strong>Total Acres:</strong> ${d.data.totalAcres.toLocaleString()}</p>
                        </div>
                    `);;
            })
            .on('mouseout', function() {
                // Hide the tooltip
                d3.select('#chart-tooltip').classed('hidden', true);
            });

    // Add the X Axis
    const tickYears = d3.range(1990, 2024, 10); // [1984, 1994, 2004, 2014, 2024]
    tickYears.push(2025); // Add final year explicitly

    d3Group.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0,${height})`)
        .call(
            d3.axisBottom(x)
                .tickValues(tickYears.map(d => new Date(d, 0, 1))) // Jan 1 of each year
                .tickFormat(d3.timeFormat("%Y"))
        )
        .append("text")
        .attr("x", width / 2)
        .attr("y", 40) // distance below the axis line
        .attr("fill", "#fff") // optional, matches your chart style
        .attr("text-anchor", "middle")
        .text("Years");

    // Add the Y Axis
    d3Group.append("g")
        .attr("class", "axis axis--y")
        .attr("transform", "translate(-5,0)")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2s")))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -70) // space from the axis line
        .attr("x", -height / 2)
        .attr("dy", "1em")
        .attr("text-anchor", "middle")
        .text("Acres Burned");

    // ---------------------------------------------
    // Add Linear Regression Trend Line
    // ---------------------------------------------
    const regressionLine = (() => {
        const fireCounts = data.map(d => [d.year.getFullYear(), d.totalAcres]);
        const n = fireCounts.length;
        const sumX = d3.sum(fireCounts, d => d[0]);
        const sumY = d3.sum(fireCounts, d => d[1]);
        const sumXY = d3.sum(fireCounts, d => d[0] * d[1]);
        const sumX2 = d3.sum(fireCounts, d => d[0] * d[0]);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        return fireCounts.map(([x]) => [new Date(x, 0, 1), slope * x + intercept]);
    })();

    const trendLine = d3.line()
        .x(d => x(d[0]) + (width / data.length) / 2)
        .y(d => y(d[1]));


    d3Group.append("path")
        .datum(regressionLine)
        .attr("class", "trend-line")
        .attr("fill", "none")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2)
        .attr("d", trendLine);

    d3Group.append("text")
        .attr("x", width - 100)
        .attr("y", y(regressionLine[regressionLine.length - 1][1]) - 10)
        .attr("text-anchor", "end")
        .style("fill", "#ffffff")
        .style("font-size", "12px")
        .text("Trend Line");
};


// Prepare a tooltip element
const tooltip = d3.select('body').append('div')
    .attr('id', 'chart-tooltip')
    .attr('class', 'hidden')
    .style('position', 'absolute')
    .style('padding', '10px')
    .style('background', 'white')
    .style('border', '1px solid black')
    .style('pointer-events', 'none');



/**
 * Highlights the bar chart for a specific year.
 *
 * @param {number} selectedYear - The year to highlight.
 * @returns {void}
 */
const highlightBarChartYear = (selectedYear) => {
    const d3Group = d3.select('#wildfireChart g'); // Access d3Group directly
    // Convert selectedYear to string to ensure proper comparison with data-year attribute
    selectedYear = String(selectedYear);

    // First, remove the 'highlight' class from all rectangles
    d3Group.selectAll('rect')
        .classed('highlight', false)  // Remove the highlight class from all rectangles

    // Find the relevant bar based on the selectedYear using the 'data-year' attribute
    // Then, add the 'highlight' class only to the rectangles that match the selectedYear
    d3Group.selectAll('rect')
        .filter(function() {
            return d3.select(this).attr("data-year") === selectedYear;
        })
        .classed('highlight', true)  // Add the highlight class
}