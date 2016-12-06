 rmvpp = (function(rmvpp){

    var pluginName = "scatter";
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = 'Scatter Chart';
    rmvpp.Plugins[pluginName].description = 'Scatter chart visualisation, displaying points on a plot space of two measures against one another. Can be used as a bubble chart as well by setting a third measure to be the size variable. Also can calculate a linear regression and R-squared value indicated correlation.';
	rmvpp.Plugins[pluginName].icon = "line-chart";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
    	{
			targetProperty:"measureX",
			formLabel:"Measure (X)",
			type: 'fact',
			required: true,
            desc: 'Measure to select on the X axis. Currently does not support attribute information here.'
		},
		{
			targetProperty:"measureY",
			formLabel:"Measure (Y)",
			type: 'fact',
			required: true,
            desc: 'Measure to display on the Y axis.'
		},
		{
			targetProperty:"group",
			formLabel:"Group By",
			type: 'dim',
			required: true,
            desc: 'Attribute to group the measures by. Will determine the number of points plotted. If no attribute was selected here, OBIEE would aggregate the two measures into a single point.'
		},
		{
			targetProperty:"varyColour",
			formLabel:"Vary By Colour",
			type: 'dim',
            desc: 'Will vary the colour of the points based on the attribute selected.'
		},
		{
			targetProperty:"varySize",
			formLabel:"Vary By Size",
			type: 'fact',
            desc: 'Will vary the size of hte points based on the measure selected. This will effectively turn the chart into a bubble chart.'
		}
    ];

    rmvpp.Plugins[pluginName].configurationParameters = [
		{
			targetProperty:"width",
			label: "Width",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 400
			},
            desc: 'Width of the chart in pixels.'
		},
		{
			targetProperty:"height",
			label: "Height",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 400
			},
            desc: 'Height of the chart in pixels.'
		},
		{
			targetProperty:"minPointSize",
			label: "Minimum Point Size",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 2
			},
            desc: 'Minimum radius for the points.'
		},
		{
			targetProperty:"maxPointSize",
			label: "Maximum Point Size",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 6
			},
            desc: 'Maximum radius for the points. Only relevant if *Vary By Size* has been populated.'
		},
		{
			targetProperty:"selectBox",
			label: "Drag to Select",
			inputType: "checkbox",
			"inputOptions" : {defaultValue : true},
            desc: 'Allows functionality to drag plot area, selecting points in the area and aggregating the values of each selected point.'
		},
		{
			targetProperty:"lr",
			label: "Linear Regression",
			inputType: "checkbox",
			inputOptions : {defaultValue : true},
            desc: 'Calculates linear regression for the chart, displaying a dashed line for the correlation and the R-squared value when hovering over the line.'
		},
		{
			targetProperty:"xTitle",
			label: "X Axis Title",
			inputType: "textbox",
			inputOptions: {defaultValue : "default"},
            desc: 'Text input for the title of the X-axis.'
		},
		{
			targetProperty:"yTitle",
			label: "Y Axis Title",
			inputType: "textbox",
			inputOptions: {defaultValue : "default"},
            desc: 'Text input for the title of the Y-axis.'
		},
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: { "defaultValue": "Flat-UI" },
            desc: 'Colour palette for the series of points, colours past the first are only relevant if *Vary By Colour* is populated.'
		}
    ];

	rmvpp.Plugins[pluginName].actions = [
		{
			'trigger' : 'selection',
			'type' : 'selection',
			'name' : 'Selection Box',
			'output' : ['group'],
			'description' : 'Drag a box selecting points to pass data.'
		},
		{
			'trigger' : 'pointHover',
			'type' : 'mouseover',
			'name' : 'Hover - Point',
			'output' : ['group', 'varyColour'],
			'description' : 'Hover over a point to pass columns and values.'
		},
		{
			'trigger' : 'pointClick',
			'type' : 'click',
			'name' : 'Click - Point',
			'output' : ['group', 'varyColour'],
			'description' : 'Click on a point to pass columns and values.'
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
			id : 'highlight',
			name : 'Highlight Points',
			description : 'Highlights points based on input value',
			type : 'private'
		}
	];

	rmvpp.Plugins[pluginName].highlight = function(output, container) {
		var points = d3.select(container).selectAll('.marker');
		var data = points.data();
		var config = output[0].config;

        var colourNames = data.map(function(d) { return d.varyColour; }).sort();
		var colour = rmvpp.colourScale(colourNames, config.colours); // Set colour scale
		var pointSize = rmvpp.linearScale([config.minPointSize, config.maxPointSize], data.map(function(d) { return +d.varySize; })); // Set point size scale

		points.each(function(d, i) {
			var filter = [];
			rmvpp.Plugins[pluginName].revertPoint(d3.select(this), pointSize, colour); // Revert any highlighted points

			// Find matching points
			output.forEach(function(criteria) {	filter.push($.inArray(d[criteria.targetId], criteria.values) > -1);	});

			// Highlight points
			if (d3.set(filter).values().length == 1 && d3.set(filter).values()[0] == 'true')
				rmvpp.Plugins[pluginName].highlightPoint(d3.select(this), pointSize, colour);
		});
		$(container).find('.tooltip').stop().fadeOut(200);
	};

	// Highlight points
	rmvpp.Plugins[pluginName].highlightPoint = function(point, sizeScale, colourScale) {
		point.classed('selected', true)
			.transition()
				.attr("r", function(d) { return +sizeScale(d.varySize) + 3; }) // Enlarge point
				.style('fill', function(d) { return rmvpp.reduceBrightness(colourScale(d.varyColour), 15); }) // Darken colour
				.style('opacity', 1)
				.duration(200);
	}

	// Revert point style
	rmvpp.Plugins[pluginName].revertPoint = function(point, sizeScale, colourScale) {
		point.classed('selected', false)
			.transition()
				.attr("r", function(d) { return sizeScale(d.varySize); })
				.style('fill', function(d) { return colourScale(d.varyColour); })
				.style('opacity', 0.7)
				.duration(200);
	}

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container)   {

		// Vary by colour flag
		var varyColour = false, varySize = false
		if (columnMap.varyColour.Code != "") varyColour = true;
		if (columnMap.varySize.Code != "") varySize = true;

		// Stamp a static value if not varying by colour
		if (!varyColour) { data.map(function(d) {d.varyColour = 'single';}); }

		// Check if the two measures are indeed measures. Will be required to be numeric for axis scaling
		if (columnMap.measureX.Measure == 'none' || columnMap.measureY.Measure == 'none')
			rmvpp.displayError(container, 'Cannot produce a scatter plot without at least two measures.');

		// Check varySize is a measure
		if (varySize && columnMap.varySize.measure == 'none')
			rmvpp.displayError(container, 'Vary by Size input must be a measure.');

		// Store visualisation number (if it exists), so that unique IDs can be created
		var visNum = d3.select(container).attr('vis-number') || '0';

		var chartContainer = d3.select(container)
			.append('div')
			.classed('scatter-chart', true);

		renderScatter(data, $(chartContainer[0])[0]);

		// Render scatter chart
		function renderScatter(data, chartContainer) {
			var legendTitle = columnMap.varyColour.Name;
			var colNames = d3.set(data.map(function(d) { return d.varyColour; })).values().sort();

			// Set varySize to 0 if undefined
			if (columnMap.varySize.Code == "") {
				data.map(function(d) {
					d.varySize = '1';
				});
			}

			$(chartContainer).empty(); // Clear existing chart

			// Define column names and height and width from config
			var width = +config.width, height = +config.height, xTitle = config.xTitle, yTitle = config.yTitle;
			if (xTitle == 'default') xTitle = columnMap.measureX.Name;
			if (yTitle == 'default') yTitle = columnMap.measureY.Name;

			// Minimum and maximum measure and size values
			var minX = d3.min(data, function(d) { return +d.measureX; });
			var maxX = d3.max(data, function(d) { return +d.measureX; });
			var minY = d3.min(data, function(d) { return +d.measureY; });
			var maxY = d3.max(data, function(d) { return +d.measureY; });

			// Define X axis
			var x = d3.scale.linear()
				.domain([d3.min([0, minX]), d3.max([0,maxX])]) // From 0 to maximum
				.range([0, width])
				.nice();

			// Define Y axis
			var y = d3.scale.linear().domain([d3.min([0, minY]), d3.max([0,maxY])]) // From 0 to maximum

			// Define colour and point size scales
			var colour = rmvpp.colourScale(colNames, config.colours);
			var pointSize = rmvpp.linearScale([config.minPointSize, config.maxPointSize], data.map(function(d) { return +d.varySize; }));

			// Create chart object (plot area)
			var chartObj = new rmvpp.Chart(chartContainer, width, height);

			chartObj.setX(xTitle, x, columnMap.measureX);
			chartObj.setY(yTitle, y, columnMap.measureY);
			var margin = chartObj.setMargin();
			chart = chartObj.createSVG(".navigator"); // Create chart SVG to standard size
			chartObj.drawAxes(); // Draw axes

			var svg = chart.parent();
			var tooltip = new rmvpp.Tooltip(chartContainer); // Create tooltip object

			// Legend
			if (varyColour || varySize)
				var legend = new rmvpp.Legend(chart, colNames.concat(columnMap.varySize.Name), legendTitle, width);

			if (varyColour)
				legend.addColourKey(colNames, colour);

			if (varySize)
				legend.addSizeKey(columnMap.varySize.Name, pointSize);

			// Add tracker line for identifying points
			var trackerPath = chart.append('path')
				.attr('stroke', '#666')
				.attr('stroke-dasharray', '5, 5')
				.attr('fill', 'none')
				.attr('d', 'M0,0')
				.attr('opacity', '0');

			// Create array of x/y co-ordinates for Voronoi geometry
			var vertices = data.map(function(d) { return [x(d.measureX), y(d.measureY)]; });

			// Containers for Voronoi clip path mask
			var points = chart.append('g').classed('points', true);
			var paths = chart.append('g').classed('paths', true);
			var clips = chart.append('g').classed('clips', true);

			// Add clip paths
			clips.selectAll("clipPath")
			.data(vertices)
				.enter().append("clipPath")
				.attr("id", function(d, i) { return visNum+"-clip-"+i;})
			.append("circle")
				.attr('cx', function(d) { return d[0]; })
				.attr('cy', function(d) { return d[1]; })
				.attr('opacity', '0') // Force opacity to 0 to hide on print function
				.attr('r', 20);

			// Set clip extent, very important in IE
			var voronoi = d3.geom.voronoi().clipExtent([[0, 0], [width, height]]);

			// Add paths around clips based on Voronoi geometry (handles overlaps nicely)
			paths.selectAll("path")
			.data(voronoi(vertices))
			.enter().append("path")
				.attr("d", function(d) { if (d) return "M" + d.join(",") + "Z"; })
				.attr("id", function(d,i) { return "path-"+i; })
				.attr("clip-path", function(d,i) { return "url(#" + visNum + "-clip-"+i+")"; })
				.style('opacity', 0)
				.on("mouseover", function(d, i) {
					if (svg.select( "rect.selectionBox").empty()) {
						// Fetch element and data for associated circle
						var marker = d3.select(chartContainer).selectAll('.marker[index="'+i+'"]');
						var datum = marker.datum();

						d3.select(chartContainer).selectAll('.marker').each(function() { rmvpp.Plugins[pluginName].revertPoint(d3.select(this), pointSize, colour); }); // Revert all selected points
						rmvpp.Plugins[pluginName].highlightPoint(marker, pointSize, colour); // Highlight point
						displayTrackerLine(datum); // Display line to axes

						// Display tooltip with all information
						var tooltipCols = ['group', 'measureX', 'measureY'];
						if (varyColour) tooltipCols.push('varyColour');
						if (varySize) tooltipCols.push('varySize');

						tooltip.displayFull(tooltipCols, columnMap, datum, d3.event)
						rmvpp.createTrigger(pluginName, columnMap, container, 'pointHover', datum); // Hover over point event
					}
				})
				.on("mouseout", function(d, i) {
					rmvpp.Plugins[pluginName].revertPoint(d3.select(chartContainer).select('.marker[index="'+i+'"]'), pointSize, colour);
					trackerPath.attr('opacity', 0); // Hide trackerline
					tooltip.hide();
				})
				.on('click', function (d, i) {
					var marker = d3.select(chartContainer).selectAll('.marker[index="'+i+'"]');
					var datum = marker.datum();
					rmvpp.createTrigger(pluginName, columnMap, container, 'pointClick', datum); // Click on point event
				});

			// Add points
			points.selectAll(".point")
				.data(data)
			.enter().append("circle")
				.attr("class", function(d, i) { return "marker"; })
				.attr('index', function(d, i) { return i; })
				.attr("r", 0)
				.attr("cx", function(d) { return x(d.measureX); })
				.attr("cy", function(d) { return y(d.measureY); })
				.style('opacity', 0.7)
				.style('fill', function(d) {return colour(d.varyColour); })
				.transition()
					.attr('r', function(d) { return pointSize(d.varySize); })
					.duration(200);

			paths.selectAll("path")

			// Drag selection box
			if (config.selectBox) {

				rmvpp.selectBox(svg,
					function() { // Mousedown
						// Hide/revert UI elements
						svg.selectAll('.marker').each(function() { rmvpp.Plugins[pluginName].revertPoint(d3.select(this), pointSize, colour); });
						tooltip.hide();
						trackerPath.attr('opacity', 0);
					},
					function(boxAttrs) { // Mousemove
						var markerData = [];

						// Adjust for margin
						boxAttrs.x -= margin.left;
						boxAttrs.y -= margin.top;

						// Select points inside box
						svg.selectAll('.marker').each(function(d, i) {

							var marker = d3.select(this);
							var dot = {
								'x' : +marker.attr('cx'),
								'y' : +marker.attr('cy')
							}

							// Check that not selected and point is within box
							if (
								dot.x >= boxAttrs.x && dot.x <= boxAttrs.x + boxAttrs.width &&
								dot.y >= boxAttrs.y && dot.y <= boxAttrs.y + boxAttrs.height
							) {
								markerData.push(marker.datum());
								rmvpp.Plugins[pluginName].highlightPoint(marker, pointSize, colour); // Highlight selected
							} else
								rmvpp.Plugins[pluginName].revertPoint(marker, pointSize, colour); // Deselect others
						});

						// Display tooltip
						if (markerData.length > 0) {
							var summary = {}; // Data object for tooltip
							summary.count = markerData.length;
							summary.measureX = d3[rmvpp.convertMeasure(columnMap.measureX.Measure)](markerData.map(function(d) { return +d.measureX; }));
							summary.measureY = d3[rmvpp.convertMeasure(columnMap.measureY.Measure)](markerData.map(function(d) { return +d.measureY; }));
							summary.varySize = d3[rmvpp.convertMeasure(columnMap.measureSize)](markerData.map(function(d) { return +d.varySize; }));

							var tooltipCols = ['count', 'measureX', 'measureY'];
							if (varySize)
								tooltipCols.push('varySize');

							// Add summary to column map
							columnMap['count'] = new obiee.BIColumn('', 'Count');
							tooltip.displayFull(tooltipCols, columnMap, summary, d3.event);
							delete columnMap['count'];
						} else
							tooltip.hide();
					},
					function() { // Mouse up
						// Create trigger passing multiple group values through
						rmvpp.createTrigger(pluginName, columnMap, container, 'selection', d3.select(chartContainer).selectAll('.selected').data());
					}
				);
			}

			// Apply linear regression and draw lines
			if (config.lr) {
				var lr = rmvpp.stats.linearRegression(
					data.map(function(d) { return +d.measureX; }),
					data.map(function(d) { return +d.measureY; })
				);

				var regressionPlot = chart.append("g");
				regressionPlot.append("line")
					.attr("x1", x(0))
					.attr("y1", y(lr.intercept))
					.attr("x2", x(maxX))
					.attr("y2", y( (maxX * lr.slope) + lr.intercept ))
					.style({
						"stroke": "#666",
						"stroke-width": "2",
						"stroke-dasharray": "5"
					})
					.on('mouseover', function() {
						tooltip.displayHTML('R<sup>2</sup> = ' + d3.format('.2f')(lr.r2), d3.event);
					})
					.on('mouseout', function() {
						tooltip.hide();
					});
			}

			// Display tracklines
			function displayTrackerLine(datum) {
				var trackerLine = [
					{'x' : 0, 'y' : y(datum.measureY)},
					{'x' : x(datum.measureX), 'y' : y(datum.measureY)},
					{'x' : x(datum.measureX), 'y' : y.range()[0]}
				];

				trackerPath.attr('stroke', colour(datum.varyColour));
				rmvpp.renderLine(trackerPath, trackerLine);
			}
		}
    }

    return rmvpp;

}(rmvpp || {}))
