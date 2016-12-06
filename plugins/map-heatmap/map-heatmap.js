 rmvpp = (function(rmvpp){

    var pluginName = "map-heatmap";
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Map (Heatmap)";
    rmvpp.Plugins[pluginName].description = 'Map visualisation using open source plugins [LeafletJS](http://leafletjs.com/) and [Leaflet Heat](https://github.com/Leaflet/Leaflet.heat). This takes longitude and latitude points and generates a coloured heatmap based on the density of points in the distribution.';
	rmvpp.Plugins[pluginName].icon = "globe";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
		{
            targetProperty: "lng",
            formLabel: "Longitude",
			type: 'dim',
			required: true,
            desc: 'Longitude attribute for positioning the points.'
        },
        {
            targetProperty: "lat",
            formLabel: "Latitude",
			type: 'dim',
			required: true,
            desc: 'Latitude attribute for positioning the points.'
        },
		{
			targetProperty: "measure",
			formLabel: "Measure",
			type: 'fact',
            desc: 'Measure column to further weight the heatmap algorithm.'
		}
    ]

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
            targetProperty:"width",
            label: "Width",
            inputType: "textbox",
            inputOptions: {
                "defaultValue": 400,
				"subtype": 'number'
            },
            desc: 'Width of the map in pixels.'
        },
        {
            targetProperty:"height",
            label: "Height",
            inputType: "textbox",
            inputOptions: {
                "defaultValue": 400,
				"subtype": 'number'
            },
            desc: 'Height of the map in pixels.'
        },
		{
            targetProperty:"maxZoom",
            label: "Intensity",
            inputType: "textbox",
            inputOptions: {
                "defaultValue": 8,
				"subtype": 'number'
            },
            desc: 'Intensity of the heat map colours with lower numbers for higher intensity. This is actually related to the zoom level of the map plugin, such that the number chosen is the zoom level at which the maximum colour will always be displayed.'
        },
		{
			targetProperty:"colours",
			label: "Colour Scale",
			inputType: "palette",
			inputOptions: { "defaultValue": "Cool-Scale" },
            desc: 'Colour palette for choosing the heatmap gradient.'
		},
        {
            targetProperty: "mapTile",
            label: "Map Tiles",
            inputType: "maptile",
            inputOptions: { "defaultValue": "Default" },
            desc: 'Defines the images used for the map background in the plugin.'
        }
    ]

	rmvpp.Plugins[pluginName].actions = [

	];

	rmvpp.Plugins[pluginName].reactions = [
		{
			id : 'filter',
			name : 'Filter',
			description : 'Accepts a column map and value and filters the report if the subject area matches.',
			type : 'general'
		}
	];

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container)   {
		var width = +config.width, height = +config.height; // Set width, height
        var colours = rmvpp.getPalette(config.colours);

		var mapContainer = d3.select(container).append('div')
			.attr('class', 'map print-as-map')
			.style({
				'width' : width + 'px',
				'height' : height + 'px',
				'display' : 'inline-block'
			})[0][0];

		// Create a map
		var map = L.map(mapContainer, {
			zoomAnimation: false, // Removing the zoom animation makes D3 overlay work more nicely when zooming
			fadeAnimation : true, // Fade animation is ok
            scrollWheelZoom: false
		});
		var tileLayer = new L.TileLayer[config.mapTile]();

		// Loop through properties, adding markers
		var markers = [];
		for (var i=0; i < data.length; i++) {
			var marker = L.marker([data[i].lat, data[i].lng]);
			markers.push(marker); // Maintain a global array for manipulation
		}

		if (columnMap.measure.Code) {
			var min = d3.min(data.map(function(d) { return +d.measure; }));
			var max = d3.max(data.map(function(d) { return +d.measure; }));
			var scale = d3.scale.linear()
				.domain([min, max])
				.range([0,1]);
		}

		var group = new L.featureGroup(markers);
		map.fitBounds(group.getBounds());
		tileLayer.addTo(map);

		var colourGradient = {
			'0' : colours[0],
			'0.25' : colours[1],
			'0.5' : colours[2],
			'0.75' : colours[3],
			'1' : colours[4]
		}

		var heatPoints = data.map(function(d) {
			if (columnMap.measure.Code)
				return [d.lat, d.lng, scale(+d.measure)];
			else
				return [d.lat, d.lng, 1];
		});
		var heat = L.heatLayer(heatPoints, {maxZoom: config.maxZoom, gradient : colourGradient}).addTo(map);

		$(mapContainer).css('cursor', 'grab');
	}
    return rmvpp;

}(rmvpp || {}))
