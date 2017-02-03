 rmvpp = (function(rmvpp){

    var pluginName = "map-cluster";
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Map (Cluster)";
    rmvpp.Plugins[pluginName].description = 'Map visualisation using open source plugins [LeafletJS](http://leafletjs.com/) and [MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster). This takes longitude and latitude points and clusters them based on their location. This is useful when there are very many points on the map to display. Hovering over a cluster will show the region which encloses all of those points.';
	rmvpp.Plugins[pluginName].icon = "map-marker";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
		{
            targetProperty: "desc",
            formLabel: "Description",
			type: 'dim',
			required: true,
            desc: 'Descriptive field for the point.'
        },
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
            desc: 'Height of the map in pixels'
        },
		{
			targetProperty:"colour",
			label: "Colour",
			inputType: "colour",
			inputOptions: {
				"defaultValue": "#5DA5DA"
			},
            desc: 'Thematic colour for the cluster points'
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
        data = rmvpp.checkLngLat(container, columnMap, data);

        var width = +config.width, height = +config.height; // Set width, height

		var mapContainer = d3.select(container).append('div')
			.attr('class', 'map print-as-map')
			.style({
				'width' : width + 'px',
				'height' : height + 'px',
				'display' : 'inline-block'
			})[0][0];

		var tooltip = new rmvpp.Tooltip(mapContainer); // Create tooltip object

		// Create a map
		var map = L.map(mapContainer, {
			zoomAnimation: false, // Removing the zoom animation makes D3 overlay work more nicely when zooming
			fadeAnimation : true, // Fade animation is ok
            scrollWheelZoom: false
		});
		var tileLayer = new L.TileLayer[config.mapTile]();
		tileLayer.addTo(map);
        $(mapContainer).data({ 'mapObject' : map }); // Add map object to the map itself

		// Define gradient colour scale
		var max = data.length, min = 2;
		var minColour = rmvpp.setBrightness(config.colour, 80);
		var maxColour = rmvpp.setBrightness(config.colour, 20);
		gradColour = d3.scale.linear()
			.domain([min, (min+(max-min)/2), max])
			.range([minColour, config.colour, maxColour]);

		var markers = L.markerClusterGroup({
			iconCreateFunction: function(cluster) {
				var backColour = gradColour(cluster.getChildCount());
				if (rmvpp.getBrightness(backColour) < 0.5)
					var colour = 'white';
				else
					var colour = 'black';
				return new L.DivIcon({
					iconSize: [40, 40],
					html: '<div class="marker-cluster"><div style="color:' + colour + '; background: ' + backColour + ';"><span>' + cluster.getChildCount() + '</span></div></div>'
				});
			},
			polygonOptions: {
				fillColor: minColour,
				color: maxColour,
				weight: 1,
				opacity: 1,
				fillOpacity: 0.5
			}
		});

		var customIcon = L.divIcon({
			iconSize: new L.Point(10, 10),
			html: '<div class="dot" style="color=' + maxColour + ';"></div>'
		});

		for (var i = 0; i < data.length; i++) {
			var title = data[i].desc;
			var marker = L.marker(new L.LatLng(data[i].lat, data[i].lng), { icon: customIcon, title: title })
				.on('mouseover', function(e) {
					tooltip.displayHTML(e.target.options.title, e.originalEvent, true);
					var offset = rmvpp.getOffset(e.originalEvent, tooltip.Container);
					var tooltipWidth = $(tooltip.Element[0]).width();
					var tooltipHeight = $(tooltip.Element[0]).height();
					tooltip.Element.style('left', offset.X + 'px');
					tooltip.Element.style('top', offset.Y-tooltipHeight + 'px');
				})
				.on('mouseout', function(e) {
					tooltip.hide();
				});
			markers.addLayer(marker);
		}
		map.fitBounds(markers.getBounds()); // Fit based on marker extremeties
		map.addLayer(markers);

		$(mapContainer).find('.cluster').parent().addClass('marker-cluster');
		$(mapContainer).css('cursor', 'grab');
	}
    return rmvpp;

}(rmvpp || {}))
