 rmvpp = (function(rmvpp){

    var pluginName = "map-choropleth";
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Map (Choropleth)";
    rmvpp.Plugins[pluginName].description = 'Map visualisation using open source plugin [LeafletJS](http://leafletjs.com/). This shows regions coloured as a heatmap, darker colours for higher values and vice versa. Hovering over the regions will display a tooltip. Works by using a [topoJSON](https://github.com/mbostock/topojson) file uploaded to the deployment on the server (in the `topojson` folder). This file will have the description of the regions as well as an attribute that can be used to tie the OBIEE dataset to the map.';
	rmvpp.Plugins[pluginName].icon = "globe";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
        {
            targetProperty: "code",
            formLabel: "Code",
			type: 'dim',
			required: true,
            desc: 'Attribute representing the code that matches the attribute in the topoJSON file.'
        },
		{
            targetProperty: "desc",
            formLabel: "Description",
			type: 'dim',
			required: true,
            desc: 'Descriptive field for a given region.'
        },
		{
			targetProperty: "measure",
			formLabel: "Measure",
			multiple: true,
			type: 'fact',
			required: true,
            desc: ' Measure values used to colour the regions. Darker colours represent higher values and vice versa. Choosing multiple measures will cause the legend to become column selector.'
		},
        {
			targetProperty:"vary",
			formLabel:"Vary By Colour",
			type: 'dim',
            desc: 'Single column to pivot a *single* measure into multiple series of different colours. Will **not** work when using multiple measures.'
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
            targetProperty:"topojson",
            label: "TopoJSON File",
            inputType: "map",
            desc: 'TopoJSON file existing in the `topojson` directory.'
        },
		{
			targetProperty:"featureCode",
            label: "Feature Code",
            inputType: "mapcode",
            inputOptions: { "mapProperty": 'topojson' },
            desc: 'TopoJSON attribute linking the OBIEE dataset to the map.'
		},
        {
			targetProperty:"featureDesc",
            label: "Feature Description",
            inputType: "mapcode",
            inputOptions: {"mapProperty": 'topojson'},
            desc: 'TopoJSON attribute with the descriptive name for each feature.'
		},
		{
			targetProperty:"scaleType",
            label: "Colour Scale Type",
            inputType: "radio",
            inputOptions: {
				'values': ['Linear', 'Quantile'],
                "defaultValue": 'Linear',
            },
            desc: 'Scale for the colouration, choosing between linear and quantile. Quantile is better for displaying data that has a very high range.'
		},
        {
			targetProperty:"opacity",
            label: "Opacity",
            inputType: "range",
            inputOptions: {
                "min" : 0,
                "max" : 1,
                "step" : 0.01,
                "defaultValue": 0.75,
            },
            desc: 'Opacity of each feature on the map.'
		},
		{
			targetProperty:"legend",
            label: "Show Legend",
            inputType: "checkbox",
            inputOptions: { "defaultValue": true },
            desc: 'Optionally show or hide the legend.'
		},
        {
			targetProperty:"styleType",
            label: "Style Type",
            inputType: "radio",
            inputOptions: {
				'values': ['Series Picker', 'Split Series'],
                "defaultValue": 'Series Picker',
            },
            desc: 'Defines whether the legend can be used as a colour picker for multiple measures, or whether colours will be determined on the most prominent value.'
		},
        {
			targetProperty:"seriesScale",
            label: "Series Scale",
            inputType: "radio",
            inputOptions: {
				'values': ['Individual', 'Shared'],
                "defaultValue": 'Individual',
            },
            desc: 'Defines whether each data series has its own scale, or if the is a single common scale across all series.'
		},
		{
			targetProperty:"nullColour",
			label: "Null Colour",
			inputType: "colour",
			inputOptions: { "defaultValue": "#CCCCCC" },
            desc: 'Colour for regions which do not map to any rows in the OBIEE dataset.'
		},
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: { "defaultValue": "Flat-UI" },
            desc: 'Colour palette to use for discrete series colours. Each colour will be converted to a gradient when displaying each measure.'
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
		{
			'trigger' : 'clickFeature',
			'type' : 'click',
			'name' : 'Click Feature',
			'output' : ['code'],
			'description' : 'Click on a map feature to trigger this action.'
		},
		{
			'trigger' : 'hoverFeature',
			'type' : 'hover',
			'name' : 'Hover Feature',
			'output' : ['code'],
			'description' : 'Click on a map feature to trigger this action.'
		}
	];

	rmvpp.Plugins[pluginName].reactions = [
		{
			id : 'filter',
			name : 'Filter',
			description : 'Accepts a column map and value and filters the report if the subject area matches.',
			type : 'general'
		},
		{
			id : 'highlightFeatures',
			name : 'Highlight Features',
			description : 'Highlights features if the corresponding code is passed',
			type : 'private'
		}
	];

	// Highlight features
	rmvpp.Plugins[pluginName].highlightFeatures = function(output, container) {
		if (output.length > 0) {
			var config = output[0].config;
			var layers = $(container).find('.mapData').data();

			layers.eachLayer(function(layer) {
				rmvpp.Plugins[pluginName].revert(layer, +config.opacity);

				// Look for output matches
				output.forEach(function(o) {
					if (layer.feature.data) { // Ignore unmatched features
						var target = layer.feature.data[o.targetId];
						if ($.inArray(target, o.values) > -1) {
							rmvpp.Plugins[pluginName].highlight(layer); // Highlight on match
						}
					}
				});
			});
		}
	}

	// Highlight selected elements
	rmvpp.Plugins[pluginName].highlight = function(layer) {
		layer.setStyle({
			weight: 2,
			color: '#000000',
            opacity: 1,
			fillOpacity: 1
		});
	};

	// Revert selected elements
	rmvpp.Plugins[pluginName].revert = function(layer, opacity) {
		layer.setStyle({
			opacity: opacity,
			color: '#333',
			weight: 1,
			fillOpacity: opacity
		});
	};

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container)   {
		var width = +config.width, height = +config.height;
		if (config.featureCode == '')
			rmvpp.displayError(container, 'Cannot render chloropleth without a topojson feature code.');

        var varyColour = false; // Check if vary by colour has been defined
		if (columnMap.vary && columnMap.vary.Code != "")
			varyColour = true;

        // Throw error if incompatible options set
		if (varyColour && columnMap.measure.length > 1)
			rmvpp.displayError(container, 'Cannot render visualisation. Accepts multiple measure columns or a single measure and vary by colour dimension.');

        // Restructure data frame if vary by colour being used
		if (varyColour) {
			var pivotData = rmvpp.pivotData(data, columnMap, 'vary', 'code', 'measure', ['desc'], true);
            data = pivotData.data;
			var measureNames = pivotData.colNames;
			var legendTitle = columnMap.vary.Name;
		} else {
            var measureNames = columnMap.measure.map(function(m) { return m.Name; });
            var legendTitle = 'Measures';
        }

		// Create container for map
		var mapContainer = d3.select(container).append('div')
			.attr('class', 'map print-as-map')
			.style({
				'width' : width + 'px',
				'height' : height + 'px',
				'display' : 'inline-block'
			})[0][0];

		var tooltip = new rmvpp.Tooltip(mapContainer); // Create tooltip object
		rmvpp.loadingScreen(mapContainer, '#1695f0', 'Loading TopoJSON...');

		// Load Topojson file if it exists
		$.ajax({
			dataType: 'json',
			url: '/insights/topojson/' + config.topojson,
			error: function(jqXHR, textStatus, errorThrown) {
				rmvpp.displayError(container, 'Topojson file not found at: ' + 'topojson/' + config.topojson);
			},
			success: processLayer
		});

		var colour = rmvpp.colourScale(measureNames, config.colours);

		// Process JSON features once map is loaded
		function processLayer(json) {
			// Create a map
			var map = L.map(mapContainer, {
				zoomAnimation: true, // Removing the zoom animation makes D3 overlay work more nicely when zooming
				fadeAnimation : true, // Fade animation is ok
                scrollWheelZoom: false
			});
			var tileLayer = new L.TileLayer[config.mapTile]();

			// Create Leaflet TopoJSON layer
			var featureLayer = new L.TopoJSON();
			featureLayer.addData(json)
			map.fitBounds(featureLayer.getBounds());

			tileLayer.addTo(map); // Render map
            $(mapContainer).data({ 'mapObject' : map }); // Add map object to the map itself

			processFeatures(featureLayer, 0);
			featureLayer.addTo(map);

			// Store feature layer in an element on the page so that it can be referenced by other visualisations
			if ($(container).find('.mapData').length == 0) {
				$(container).append(
					$('<span>').addClass('mapData')
				);
			}
			$(container).find('.mapData').data(featureLayer);

			// Draw legend
			if (config.legend) {
				// Create SVG container for the legend
    			var legendContainer = d3.select(container)
    				.append('svg')
    				.classed('legendContainer', true)
    				.classed('do-not-print', true)
    					.style({
    						'margin-left': '10px',
    						'display': 'inline-block',
    						'font': '10px monospace'
    					})
    					.attr('height', height)
    					.append('g');

				var legend = new rmvpp.Legend(d3.select(container).select('.legendContainer>g'), measureNames, 'Measures', 0);
				legend.addColourKey(measureNames, colour);

				// Make legend a measure selector
                if (config.styleType == 'Series Picker') {
                    d3.select(container).selectAll('.legendContainer .key')
    					.on('click', function(d, i) {
    						tooltip.hide();
    						processFeatures(featureLayer, i);
    					})
    					.style('cursor','pointer');
                }
			}
		}

        function getGradColour(min, max, minColour, currColour, maxColour) {
            var gradColour;
            if (config.scaleType == 'Linear') {
				gradColour = d3.scale.linear()
					.domain([min, (min+(max-min)/2), max])
					.range([minColour, currColour, maxColour]);
			} else {
				var colourRange = [
					rmvpp.setBrightness(currColour, 80),
					rmvpp.setBrightness(currColour, 70),
					rmvpp.setBrightness(currColour, 60),
					rmvpp.setBrightness(currColour, 50),
					rmvpp.setBrightness(currColour, 40),
					rmvpp.setBrightness(currColour, 30),
					rmvpp.setBrightness(currColour, 20)
				];

				gradColour = [];
                measureNames.forEach(function(m, i) {
                    var qScale = d3.scale.quantile()
                        .domain(data.map(function(d) { return +d.measure[i].value; }))
                        .range(colourRange);
                    gradColour.push(qScale);
                });
			}
            return gradColour;
        }

        function getColourScales(idx) {
            var currColour = colour(measureNames[idx]); // Colour of the data series
            if (config.seriesScale == 'Individual') {
                // Define range for the gradient
                var min = d3.min(data.map(function(d) { return +d.measure[idx].value; }));
    			var max = d3.max(data.map(function(d) { return +d.measure[idx].value; }));
            } else {
                // Define range for the gradient across all values
    			var currColour = colour(measureNames[idx]);
                var min = d3.min(data.map(function(d) {
                    return d3.min(d.measure.map(function(m) {
                        return +m.value;
                    }));
                }));
                var max = d3.max(data.map(function(d) {
                    return d3.max(d.measure.map(function(m) {
                        return +m.value;
                    }));
                }));
            }
            var minColour = rmvpp.setBrightness(currColour, 80);
			var maxColour = rmvpp.setBrightness(currColour, 20);
            return getGradColour(min, max, minColour, currColour, maxColour);
        }

		// Process each feature in layer
		function processFeatures(fLayer, i) {
			$(mapContainer).find('.loading').remove();
            var gradColour;
            if (config.styleType == 'Series Picker') {
                gradColour = getColourScales(i);
            }

			fLayer.eachLayer(function(layer) {
				var code = layer.feature.properties[config.featureCode];
				var datum = data.filter(function(d) { return d.code == code; })[0];
				layer.feature.data = datum; // Add OBIEE datum to the feature layer

                if (config.styleType == 'Split Series') {
                    if (datum) {
                        var sorted = datum.measure.sort(function(a, b) {
                            return d3.descending(+a.value, +b.value);
                        });
                        if (varyColour) {
                            gradColour = getColourScales(measureNames.indexOf(sorted[0].vary));
                        } else {
                            gradColour = getColourScales(measureNames.indexOf(sorted[0].name));
                        }
                    }
                }

				var fillColour = config.nullColour, nullData = false;
				if (datum) {
					if (config.scaleType == 'Linear') {
						fillColour = gradColour(datum.measure[i].value);
					} else {
						fillColour = gradColour[i](datum.measure[i].value);
					}
				} else { // Cater for nulls
					datum = {'code' : layer.feature.properties[config.featureCode]};
					nullData = true;
				}

				var style = {
					color: '#333',
					weight : 1,
					opacity: +config.opacity,
					fillColor: fillColour,
					fillOpacity: +config.opacity,
					className: 'fillTransition'
				}
				layer.setStyle(style);

				layer.off('mouseover')
					.on('mouseover', function(e) {
						rmvpp.Plugins[pluginName].highlight(layer);
                        if (varyColour && !nullData) {
                            datum.desc = datum.measure[0].desc;
                        }

						if (nullData) {
							tooltip.displayFull(['code'], columnMap, datum, e.originalEvent);
						} else {
							tooltip.displayList(datum, 'desc', 'measure', columnMap, e.originalEvent, colour, datum.measure[i].name);
							rmvpp.createTrigger(pluginName, columnMap, container, 'hoverFeature', datum);
						}
					})
					.off('mouseout')
					.on('mouseout', function(e) {
						rmvpp.Plugins[pluginName].revert(layer, +config.opacity);
						tooltip.hide();
					})
					.off('click')
					.on('click', function(e) {
						rmvpp.createTrigger(pluginName, columnMap, container, 'clickFeature', datum);
					});
			});
		}
	}
    return rmvpp;

}(rmvpp || {}))
