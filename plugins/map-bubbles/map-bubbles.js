 rmvpp = (function(rmvpp){

    var pluginName = "map-bubbles"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Map (Bubbles)";
    rmvpp.Plugins[pluginName].description = 'Map visualisation using open source plugin [LeafletJS](http://leafletjs.com/). This shows bubbles based on points positioned by longitude and latitude and sized based on a measure value. Hovering over the bubbles will display a tooltip. Clicking the pencil icon at the top of the map will allow the user to select multiple points by drawing a shape freehand.';
	rmvpp.Plugins[pluginName].icon = "map-marker";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
        {
            targetProperty: "desc",
            formLabel: "Description",
			type: 'dim',
			required: true,
            desc: 'Attribute column giving the descriptive name for a point.'
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
        },
		{
			targetProperty: "measure",
			formLabel: "Measure",
			multiple: true,
			type: 'fact',
			required: true,
            desc: 'Measure attribute scaling the size of the points. Choosing multiple measure will allow the legend to act as a measure selector.'
		},
        {
			targetProperty:"vary",
			formLabel:"Vary By Colour",
			type: 'dim',
            desc: 'Single column to pivot a *single* measure into multiple series of different colours. Will **not** work when using multiple measures.'
		}
    ];

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
        }
		,
		{
            targetProperty:"bubbleLow",
            label: "Minimum Bubble Radius",
            inputType: "textbox",
            inputOptions: {
                "defaultValue": 3,
				"subtype": 'number'
            },
            desc: 'Minimum size for any given bubble.'
        },
		{
            targetProperty:"bubbleHigh",
            label: "Maximum Bubble Radius",
            inputType: "textbox",
            inputOptions: {
                "defaultValue": 20,
				"subtype": 'number'
            },
            desc: 'Maximum size for any given bubble.'
        },
		{
            targetProperty:"stroke",
            label: "Stroke Width",
            inputType: "textbox",
            inputOptions: {
                "defaultValue": 0,
				"subtype": 'number'
            },
            desc: 'Stroke width of each circle displayed.'
        },
		{
            targetProperty:"opacity",
            label: "Opacity",
            inputType: "range",
            inputOptions: {
                "defaultValue": 0.75,
				"min" : 0,
				"max" : 1,
                "step" : 0.01
            },
            desc: 'Opacity of each bubble.'
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
			targetProperty:"legend",
            label: "Show Legend",
            inputType: "checkbox",
            inputOptions: { "defaultValue": true },
            desc: 'Optionally show or hide the legend.'
		},
        {
			targetProperty:"voronoi",
            label: "Distinguish Close Points",
            inputType: "checkbox",
            inputOptions: { "defaultValue": true },
            desc: 'Use a Voronoi layer to aid the distinguishing of very close points when hovering over with the mouse.'
		},
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: { "defaultValue": "Flat-UI" },
            desc: 'Colour palette to use for discrete series colours.'
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
			'trigger' : 'clickBubble',
			'type' : 'click',
			'name' : 'Click Bubble',
			'output' : ['desc'],
			'description' : 'Click on a bubble to pass the description.'
		},
        {
			'trigger' : 'hoverBubble',
			'type' : 'hover',
			'name' : 'Hover Bubble',
			'output' : ['desc'],
			'description' : 'Hover on a bubble to pass the description.'
		},
		{
			'trigger' : 'freehandSelect',
			'type' : 'selection',
			'name' : 'Freehand Select',
			'output' : ['desc'],
			'description' : 'Select a group of points using the the freehand draw tool and pass the data.'
		}
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
        if (data.length == 1)
            rmvpp.displayError(container, 'Need more than one data point to render the map.');

        var varyColour = false; // Check if vary by colour has been defined
		if (columnMap.vary && columnMap.vary.Code != "")
			varyColour = true;

        // Throw error if incompatible options set
		if (varyColour && columnMap.measure.length > 1)
			rmvpp.displayError(container, 'Cannot render visualisation. Accepts multiple measure columns or a single measure and vary by colour dimension.');


        // Store visualisation number (if it exists), so that unique IDs can be created
		var visNum = d3.select(container).attr('vis-number') || '0';

		// Set width, height
		var width = +config.width, height = +config.height;

		// Create HTML elements
		var panel = d3.select(container)
			.append('div')
			.attr('class', 'panel do-not-print')
			.style('font-size', '24px');

		var mapContainer = d3.select(container).append('div')
			.attr('class', 'map print-as-map')
			.style({
				'width' : width + 'px',
				'height' : height + 'px',
				'display' : 'inline-block'
			})[0][0];

        // Restructure data frame if vary by colour being used
		if (varyColour) {
			var pivotData = rmvpp.pivotData(data, columnMap, 'vary', 'desc', 'measure', ['lng', 'lat'], true);
            data = pivotData.data;
			var measureNames = pivotData.colNames;
			var legendTitle = columnMap.vary.Name;
		} else {
            var measureNames = columnMap.measure.length > 0 ? columnMap.measure.map(function(d) { return d.Name; }) : ['None'];
            var legendTitle = 'Measures';
        }

		// Tooltip, legend and colours
        var outerTooltip = new rmvpp.Tooltip(container); // Creates tooltip for the buttons
		var tooltip = new rmvpp.Tooltip(mapContainer); // Create tooltip object
        var colour = rmvpp.colourScale(measureNames, config.colours);

        if (config.legend) {
            // Create SVG container for the legend
            var legendContainer = d3.select(container)
                .append('svg')
                .classed('legendContainer', true)
                .classed('do-not-print', true)
                    .style({
                        'margin-left': '10px',
                        'display': 'inline-block',
                        'font': '10px sans-serif'
                    })
                    .attr('height', height)
                    .append('g');
            var legend = new rmvpp.Legend(d3.select(container).select('.legendContainer>g'), measureNames, legendTitle, 0);
            legend.addColourKey(measureNames, colour);
        }

		// Create a map
		var map = L.map(mapContainer, {
			zoomAnimation: false, // Removing the zoom animation makes D3 overlay work more nicely when zooming
			fadeAnimation : true, // Fade animation is ok
            scrollWheelZoom: false // Disable scroll to zoom
		});
		var tileLayer = new L.TileLayer[config.mapTile]();

		// Loop through properties, adding markers
		var markers = [];
		for (var i=0; i < data.length; i++) {
			var marker = L.marker([data[i].lat, data[i].lng]);
			markers.push(marker); // Maintain a global array for manipulation
		}

		var group = new L.featureGroup(markers);
		map.fitBounds(group.getBounds());
		tileLayer.addTo(map);

        $(mapContainer).data({ 'mapObject' : map }); // Add map object to the map itself
		$(mapContainer).css('cursor', 'grab');

		rmvpp.iconButton(panel.toJQuery(), 'pencil', 'Lasso', outerTooltip, '#FFA500');

		renderMapObjs(map, markers, 0);

		// Make legend a measure selector
        if (config.legend) {
            if (config.styleType == 'Series Picker') {
                d3.select(container).selectAll('.legendContainer .key')
        			.on('click', function(d, i) {
        				tooltip.hide();
        				renderMapObjs(map, markers, i);
        			})
        			.style('cursor','pointer');
            }
        }

		function renderMapObjs(map, markers, measureIdx) {
			var poly, mapEnabled = true;

			$(container).find('.fa-pencil').off('click').click(function() {
				if (mapEnabled)
					disableMap(map);
			});

			// Deselect any selected markers
			function deselectMarkers() {
				d3.select(container).selectAll('circle.measure-marker')
                    .transition().duration(200)
					.attr('fill', function(d) { return getColour(d); })
                    .attr('r', function(d) {
                        return (columnMap.measure.length > 0 ? size(+d.measure[measureIdx].value) : size(0));
                    })
                    .attr('stroke-width', config.stroke)
                    .attr('fill-opacity', config.opacity);
				d3.select(container).selectAll('circle.measure-marker').classed('selected', false);
                tooltip.hide();
			}

			// Disable the map
			function disableMap(map) {
                deselectMarkers();
				map.dragging.disable();
				map.touchZoom.disable();
				map.scrollWheelZoom.disable();
				map.doubleClickZoom.disable();
				map.boxZoom.disable();
				map.zoomControl.removeFrom(map);
				$(container).find('.leaflet-container').css('cursor', 'crosshair');
				map.on('mousedown', draw); // Initiate draw function
				mapEnabled = false;
			}

			// Clear map
			function clear(map) {
				map.off('mousedown')
					.off('mousemove')
					.off('mouseup');
				$(poly._container).parent().hide(); // Prevents from blocking hover overs
				map.removeLayer(poly);
				deselectMarkers();
			}

			// Enable the map
			function enableMap(map) {
				if (!mapEnabled) {
					map.dragging.enable();
					map.touchZoom.enable();
					map.scrollWheelZoom.enable();
					map.doubleClickZoom.enable();
					map.boxZoom.enable();
					$(container).find('.leaflet-container').css('cursor', '');
					map.zoomControl.addTo(map);
				}
				if (d3.select(container).selectAll('circle.selected')[0].length > 0)
					clear(map);
				mapEnabled = true;
				var selectedData = d3.select(container).selectAll('circle').data();
				rmvpp.createTrigger(pluginName, columnMap, container, 'freehandSelect', selectedData); // Trigger event
			}

			// Freehand draw function
			function draw(event) {
				if (poly)
					event.target.removeLayer(poly);

				var lineOptions = {
					'color' : '#333333',
					'weight' : 2,
					'opacity' : 0.8
				};

				var polyOptions = {
					'color' : '#333333',
					'weight' : 2,
					'opacity' : 0.8,
					'fill': true,
					'fillColor' : '#999999',
					'fillOpacity' : 0.4
				};

				var polyPoints = [event.latlng]; // Build array of co-ordinates for polygon

				poly = new L.Polyline([event.latlng], polyOptions).addTo(event.target);
				$(poly._container).parent().show();
				event.target.on('mousemove', function(event) {
						polyPoints.push(event.latlng);
						poly.addLatLng(event.latlng); // Draw line with mouse
					})
					.on('mouseup', function(e) {
						map.off('mousemove');
						polyPoints.push(polyPoints[0]);
						event.target.removeLayer(poly);
						poly = new L.Polygon(polyPoints, polyOptions).addTo(event.target); // Create polygon
						enableMap(event.target);
						clear(event.target);
						for (var i=0; i < markers.length; i++) {
							// Convert polygon to GeoJSON for Pip
							var geoFeature = poly.toGeoJSON();
							var geoLayer = L.geoJson(geoFeature);
							if(leafletPip.pointInLayer(markers[i].getLatLng(), geoLayer, true).length > 0) // Check if point is in layer
								highlightMarker(i);
						}
						var selectedData = d3.select(container).selectAll('circle.selected').data();
						rmvpp.createTrigger(pluginName, columnMap, container, 'freehandSelect', selectedData); // Trigger event

                        var measureCol = columnMap.measure[measureIdx];
                        if (measureCol) {
                            var agg = rmvpp.convertMeasure(measureCol.Measure);
                            var total = d3[agg](selectedData.map(function(d) { return +d.measure[measureIdx].value; }));
                            var msg = '<b>' + measureCol.Name + ': ' + measureCol.format(total) + '</b>';

                            tooltip.displayHTML(msg, e.originalEvent, true);
                            var offset = rmvpp.getOffset(e.originalEvent, tooltip.Container);
                            posTooltip(offset);
                        }
					});
			}

            // Return the correct colour
            function getColour(d) {
                if (columnMap.measure.length == 0) {
                    return colour('None');
                } else if (config.styleType == 'Series Picker') {
                    return colour(d.measure[measureIdx].name);
                } else {
                    var sorted = d.measure.sort(function(a, b) {
                        return d3.descending(+a.value, +b.value);
                    });
                    if (varyColour) {
                        return colour(sorted[0].vary);
                    } else {
                        return colour(sorted[0].name);
                    }
                }
            }

			// Highlight D3 circles
			function highlightMarker(idx) {
				circles.filter(function(d, i) { return i == idx;})
                    .transition().duration(200)
					.attr('fill', function(d) {
                        var highlight = rmvpp.increaseSaturation(getColour(d), 30);
                        highlight = rmvpp.reduceBrightness(highlight, 30);
                        return highlight;
                    })
                    .attr('r', function(d) {
                        return 3 + (columnMap.measure.length > 0 ? size(+d.measure[measureIdx].value) : size(0));
                    })
                    .attr('stroke-width', config.stroke+1)
                    .attr('fill-opacity', 1);
				circles.filter(function(d, i) { return i == idx;}).classed('selected', true);
			}

			// Custom layer for D3
			var svg = d3.select(map.getPanes().overlayPane).append('svg');

            // Layers for Voronoi click map
            var circleLayer = svg.append('g').classed('circles', true);
            var pathLayer = svg.append('g').classed('paths do-not-print', true);
			var clipLayer = svg.append('g').classed('clips do-not-print', true);

			var topBnd, bottomBnd, leftBnd, rightBnd;

			map.on('viewreset', reset);

			var latArr = data.map(function (d) { return +d.lat; });
			var lngArr = data.map(function (d) { return +d.lng; });

			topBnd = d3.max(latArr);
			bottomBnd = d3.min(latArr);
			leftBnd = d3.min(lngArr);
			rightBnd = d3.max(lngArr);

			// Scales
            var min = 1, max = 1;
            if (columnMap.measure.length > 0) {
                if (config.seriesScale == 'Individual') {
                    min = d3.min(data.map(function(d) { return +d.measure[measureIdx].value; }));
                    max = d3.max(data.map(function(d) { return +d.measure[measureIdx].value; }));
                } else {
                    min = d3.min(data.map(function(d) {
                        return d3.min(d.measure.map(function(m) {
                            return +m.value;
                        }));
                    }));
                    max = d3.max(data.map(function(d) {
                        return d3.max(d.measure.map(function(m) {
                            return +m.value;
                        }));
                    }));
                }
            }

			var size = d3.scale.linear()
				.domain([min, max])
				.range([+config.bubbleLow, +config.bubbleHigh]);

			// Render circles (except positioning)
			d3.select(container).selectAll('circle.measure-marker').remove();
			var circles = circleLayer.selectAll("circle")
				.data(data)
				.enter().append('circle')
				.classed('measure-marker', true)
				.attr('stroke', '#333333')
				.attr('stroke-width', config.stroke)
				.attr('fill-opacity', config.opacity)
				.attr('fill', function(d) {
                    return getColour(d);
                })
				.attr('r', 0);

            function addMouseActions(elements) {
                elements.style('cursor', 'pointer')
                .on('mouseover', function(d, i) {
                    if (d3.select(container).selectAll('circle.selected')[0].length > 0)
                        deselectMarkers();
                    highlightMarker(i);
                    rmvpp.createTrigger(pluginName, columnMap, container, 'hoverBubble', data[i]); // Trigger event
                    displayTooltip(data[i], d3.event, i);
                })
                .on('mouseout', function() {
                    deselectMarkers();
                    tooltip.hide();
                })
                .on('click', function(d, i) {
                    rmvpp.createTrigger(pluginName, columnMap, container, 'clickBubble', data[i]); // Trigger event
                });
            }

            if (!config.voronoi)
                addMouseActions(circles);

			circles.transition()
				.duration(500)
				.attr('r', function(d) {
                    return columnMap.measure.length > 0 ? size(+d.measure[measureIdx].value) : size(0);
                })
			reset();

			// Function to return DOM X and Y based on longitude and latitude
			function project(d) {
				var point = map.latLngToLayerPoint(new L.LatLng(d[1], d[0]));
				return [point.x, point.y];
			}

			// Redraw D3 circles
			function reset() {
				bottomLeft = project([leftBnd, bottomBnd]);
				topRight = project([rightBnd, topBnd]);

				svg.attr('width', topRight[0] - bottomLeft[0])
					.attr('height', bottomLeft[1] - topRight[1])
					.style('margin-left', bottomLeft[0] + 'px' )
					.style('margin-top', topRight[1] + 'px')
					.attr('overflow', 'visible');

                circleLayer.attr('transform', 'translate(' + -bottomLeft[0] + ',' + -topRight[1] + ')');
                circles.attr('cx', function(d) { return project([+d.lng, +d.lat])[0]; })
					.attr('cy', function(d) { return project([+d.lng, +d.lat])[1];});

                if (config.voronoi) {
                    clipLayer.attr('transform', 'translate(' + -bottomLeft[0] + ',' + -topRight[1] + ')');
                    pathLayer.attr('transform', 'translate(' + -bottomLeft[0] + ',' + -topRight[1] + ')');

                    var vertices = data.map(function(d) { return project([+d.lng, +d.lat]); });
                    var voronoi = d3.geom.voronoi();

                    // Add clip paths (except positioning)
        			clipLayer.selectAll("clipPath").remove();
                    clipLayer.selectAll("clipPath")
                        .data(vertices)
            				.enter().append("clipPath")
            				.attr("id", function(d, i) { return visNum +"-clip-"+i;})
            			.append("circle")
            				.attr('opacity', '0') // Force opacity to 0 to hide on print function
            				.attr('r', 30)
                            .attr('cx', function(d) { return d[0]; })
                            .attr('cy', function(d) { return d[1]; })

                    // Add paths around clips based on Voronoi geometry (handles overlaps nicely)
        			pathLayer.selectAll("path").remove();
                    var paths = pathLayer.selectAll("path")
                        .data(voronoi(vertices))
            			.enter().append("path")
            				.attr("d", function(d) { if (d && d.length > 0) return "M" + d.join(",") + "Z"; })
            				.attr("id", function(d,i) { return "path-"+i; })
            				.attr("clip-path", function(d,i) { return "url(#" + visNum + "-clip-"+i+")"; })
            				.style('opacity', 0);
                    addMouseActions(paths);
                }
			}

			function displayTooltip(d, event, idx) {
                if (columnMap.measure.length > 0) {
                    tooltip.displayList(d, 'desc', 'measure', columnMap, event, colour, d.measure[measureIdx].name, true);
                } else {
                    tooltip.displayHTML('<b>' + d.desc + '</b>', event, true);
                }
                posTooltip(event);
			}

            function posTooltip(event) {
                var offset = rmvpp.getOffset(event, tooltip.Container);

				var tooltipWidth = $(tooltip.Element[0]).width();
				var tooltipHeight = $(tooltip.Element[0]).height();
                tooltip.Element.style('left', offset.X - 5 + 'px');
                tooltip.Element.style('top', offset.Y - 5 - tooltipHeight + 'px');
            }
		}
	}
    return rmvpp;

}(rmvpp || {}))
