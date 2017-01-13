 rmvpp = (function(rmvpp){

    var pluginName = "line"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = 'Line Chart';
    rmvpp.Plugins[pluginName].description = 'Line chart visualisation for continuous data, can be used as an area chart by setting the appropriate configuration setting. Secondary Y axes can be used when there are two measures to scale them appropriately regarding their values. When a date column is used as the category property the dataset will be modified to be continuous. This means that if OBIEE is missing records for certain days, they will be assigned a value of 0.';
    rmvpp.Plugins[pluginName].icon = "area-chart";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
    	{
			targetProperty:"category",
			formLabel:"Category",
			type: 'dim',
			required: true,
            desc: 'Single column to be used as the x-axis of the line chart. Should contain continuous values.'
		},
		{
			targetProperty:"measure",
			formLabel:"Measure",
			multiple: true,
			type: 'fact',
			required: true,
			conditionalFormat: true,
            desc: 'Aggregatable measure column to be used for the line in the y-axis. Multiple measures can be selected, which will render multiple lines for each measure value in different colours. *Cannot* have multiple measures and a Vary By Colour column.'
		},
		{
			targetProperty:"vary",
			formLabel:"Vary By Colour",
			type: 'dim',
            desc: 'Single column to pivot a *single* measure into multiple lines of different colours. Will **not** work when using multiple measures.'
		},
		{
			targetProperty:"hidden",
			formLabel:"Hidden",
			multiple: true,
			type: 'hidden',
            desc: 'Hidden columns that can be used for conditional formatting without being displayed. It is important that adding this column does not alter the granularity of the query, i.e. the hidden column should be of the same level, or less descriptive than the category column.'
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
				defaultValue : 300
			},
            desc: 'Height of the chart in pixels.'
		},
		{
			targetProperty:"pointSize",
			label: "Point Size",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 2
			},
            desc: 'Radius of the points to display in pixels.'
		},
		{
			targetProperty:"strokeWidth",
			label: "Line Width",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 2
			},
            desc: 'Stroke width of the line.'
		},
		{
			targetProperty:"horizontal",
			label: "Vertical",
			inputType: "checkbox",
			inputOptions: {
				defaultValue : false
			},
            desc: 'Displays with horizontal orientation as opposed to vertical.'
		},
		{
			targetProperty:"legend",
			label: "Show Legend",
			inputType: "checkbox",
			inputOptions: {
				defaultValue : true
			},
            desc: 'Boolean which if true will show the legend.'
		},
		{
			targetProperty:"secondAxis",
			label: "Second Axis",
			inputType: "checkbox",
			inputOptions: { defaultValue : false },
            desc: 'Boolean which if true will display a second axis on the right hand side of the chart. This will only work if specifically **two** measures have been defined, and is **not** compatible with vary by colour.'
		},
		{
			targetProperty:"dragSelect",
			label: "Drag Select",
			inputType: "checkbox",
			inputOptions: {defaultValue : true	},
            desc: 'Boolean which if true allows the user to drag on the main chart area to zoom into that are of the chart.'
		},
		{
			targetProperty:"brushNav",
			label: "Mini-Chart Navigator",
			inputType: "checkbox",
			inputOptions: {defaultValue : true	},
            desc: 'Boolean which if true will render a miniature chart underneath the original that can be used for navigation. The user can drag on the miniature chart to scroll and zoom the main chart.'
		},
		{
			targetProperty:"shadeArea",
			label: "Shade Area",
			inputType: "checkbox",
			inputOptions: {defaultValue : false	},
            desc: 'Boolean which if true shades the area under the line.'
		},
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: {
				"defaultValue": "Flat-UI"
			},
            desc: 'Colour palette to use for discrete series colours'
		}
    ];

	rmvpp.Plugins[pluginName].actions = [
		{
			'trigger' : 'sectionClick',
			'type' : 'click',
			'name' : 'Click - Section',
			'output' : ['category'],
			'description' : 'Click on a section to pass X column and value'
		},
		{
			'trigger' : 'sectionHover',
			'type' : 'mouseover',
			'name' : 'Hover - Section',
			'output' : ['category'],
			'description' : 'Hover over a section to pass X column and value.'
		},
		{
			'trigger' : 'pointClick',
			'type' : 'click',
			'output' : ['category', 'vary'],
			'name' : 'Click - Point',
			'description' : 'Click on a point to pass columns and values.'
		},
		{
			'trigger' : 'pointHover',
			'type' : 'mouseover',
			'output' : ['category', 'vary'],
			'name' : 'Hover - Point',
			'description' : 'Hover over a point to pass columns and values.'
		},
		{
			'trigger' : 'brushSelect',
			'type' : 'brush',
			'name' : 'Brush Select',
			'output' : ['category'],
			'description' : 'Select category values using the nav bar (only if nav bar enabled).'
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

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {
		var hideXLabels = false, hideYLabels = false, navigator = config.brushNav;

		if (config.secondAxis && columnMap.measure.length != 2)
			rmvpp.displayError(container, 'Error: Cannot have two axes without specifically two measures.');

		// If category is a date, fill in missing values so that data is continuous
		if (columnMap.category.DataType == 'date') {
			var maxX = new Date(d3.max(data, function(d) { return d.category; }));
			var minX = new Date(d3.min(data, function(d) { return d.category; }));
			var dateRange = rmvpp.dateRange(minX, maxX);

			if (dateRange.length > data.length) {
				var newData = [];
				dateRange.forEach(function(dt, i) { // Loop over the date range
					var parseDate = new Date(data[i].category);
					parseDate.setHours(0); // Avoids comparison issues with daylight savings
					if (parseDate.getTime() == dt.getTime()) { // If the date matches, parse the format
						data[i].category = parseDate;
						newData.push(data[i]);
					} else { // Otherwise fill in with a null
						var newDatum = obiee.nullDatum(columnMap);
						newDatum.category = dt;
						newData.push(newDatum);
						data.splice(i, 0, newDatum);
					}
				});
				data = newData;
			}
		}

		// Compile column name list for Y
		var colNames = [], legendTitle = 'Measures';
		for (var i=0; i < columnMap.measure.length; i++) {
			colNames.push(columnMap.measure[i].Name);
		}

		// Denormalise X label onto Y values for tooltip later
		data.map(function(d) {
			d.displayCategory = columnMap.category.format(d.category); // Format category labels
			for (var i=0; i < d.measure.length; i++) {
				d.measure[i].category = d.category;
			}
		});

		// Throw error if incompatible options set
		if (columnMap.vary.Code != "" && columnMap.measure.length > 1)
			rmvpp.displayError(container,'Cannot render line chart. Accepts multiple measure columns or a single measure and vary by colour dimension');

		var varyColour = false;
		if (columnMap.vary.Code != "")
			varyColour = true;

		// Restructure data frame if vary by colour being used
		if (varyColour) {
			var pivotData = rmvpp.pivotData(data, columnMap, 'vary', 'category', 'measure', ['hidden']);
			data = pivotData.data;
			colNames = pivotData.colNames;
			legendTitle = columnMap.vary.Name;
		}

		// Set X and Y titles
		var xTitle = 'default', yTitle = 'default';
		if (xTitle == 'default') xTitle = columnMap.category.Name;
		if (yTitle == 'default') {
			if (varyColour || config.secondAxis)
				yTitle = columnMap.measure[0].Name;
			else
				yTitle = "";
		}
		var y2Title = config.secondAxis ? columnMap.measure[1].Name : '';

		// Chart container
		var chartContainer = d3.select(container)
			.append('div')
			.classed('line-chart', true);

		// Render line chart
		renderLine(data, $(chartContainer[0])[0], true, navigator);

		// Main rendering function
		function renderLine(chartData, chartContainer, animate, navigator) {

			$(chartContainer).find('.main').remove(); // Clear existing chart

			// Define height and width from config
			var width = config.horizontal ? +config.height : +config.width;
			var height = config.horizontal ? +config.width : +config.height;

			if (columnMap.category.DataType == 'date') {
				var xDate = true; // Indicator for X axis as a continuous date
				var extent = d3.extent(chartData.map(function(d) { return new Date(d.category); }));

				// X Axis from subset, chartData
				var x = d3.time.scale()
					.domain(extent)
					.range([0, width]);

				var extent = d3.extent(data.map(function(d) { return new Date(d.category); }));

				// X scale from full dataset, data
				var fullX = d3.time.scale()
					.domain(extent)
					.range([0, width]);

				var rangeBand = 0, rectBand = (width/chartData.length);
			} else {
				var xDate = false;  // Indicator for X axis as an ordinal scale

				// X Axis from subset, chartData
				var x = d3.scale.ordinal()
					.domain(chartData.map(function (d) { return d.category; }))
					.rangeBands([0, width], .1);

				// X scale from full dataset, data
				var fullX = d3.scale.ordinal()
					.domain(data.map(function (d) { return d.category; }))
					.rangeBands([0, width], .1);

				var rangeBand = x.rangeBand()/2, rectBand = x.rangeBand();
			}

			var y2, y2Col;
			if (config.secondAxis) {
				var maxY = d3.max(chartData.map(function(d) { return +d.measure[0].value ? +d.measure[0].value : 0; }));
				var minY = d3.min(chartData.map(function(d) { return +d.measure[0].value ? +d.measure[0].value : 0; }));
				var y = d3.scale.linear().domain([d3.min([0, minY]), d3.max([0,maxY])]); // From 0 to maximum

				var maxY2 = d3.max(chartData.map(function(d) { return +d.measure[1].value ? +d.measure[1].value : 0; }));
				var minY2 = d3.min(chartData.map(function(d) { return +d.measure[1].value ? +d.measure[1].value : 0; }));
				y2 = d3.scale.linear().domain([d3.min([0, minY2]), d3.max([0,maxY2])]); // From 0 to maximum
				y2Col = columnMap.measure[1];
			} else {
				// Y Axis (Full)
				var maxY = d3.max(chartData, function(d) { return d3.max(d.measure, function(d) { return +d.value ? +d.value : 0; }); });
				var minY = d3.min(chartData, function(d) { return d3.min(d.measure, function(d) { return +d.value ? +d.value : 0; }); });
				var y = d3.scale.linear().domain([d3.min([0, minY]), d3.max([0,maxY])]); // From 0 to maximum
			}

			// Define colour palette
			var colour = rmvpp.colourScale(chartData[0].measure.map(function(d) { return d.name; }), config.colours); // Set colour scale

			// Apply conditional formatting to generate colours
			rmvpp.applyColours(chartData, columnMap, colour, condFormats, 'category', 'measure', 'vary');

			// Create chart object
			var chartObj = new rmvpp.Chart(chartContainer, width, height);
			if (config.horizontal) chartObj.Horizontal = true;

			// Set axes and margin
			chartObj.setX(xTitle, x, columnMap.category);
			chartObj.setY(yTitle, y, columnMap.measure[0]);
			if (config.secondAxis)
				chartObj.setY2(y2Title, y2, columnMap.measure[1]);

			var margin = chartObj.setMargin();
			chart = chartObj.createSVG(".navigator"); // Create chart SVG to standard size
			chartObj.drawAxes(); // Draw axes

			chart.parent().classed('main', true);
			var tooltip = new rmvpp.Tooltip(chartContainer); // Create tooltip object


			if (config.legend) {
				var legend = new rmvpp.Legend(chart, colNames, legendTitle, width+margin.right, margin);  // Legend
				legend.addColourKey(colNames, colour); // Legend Colour Key
			}

			var sectionPath = chart.append('path')
				.attr('stroke', '#CCC')
				.attr('fill', 'none')
				.attr('opacity', '0')
				.attr('d', 'M0,0');

			// Define sections
			var xGroups = chart.selectAll(".categoryGroups")
				.data(chartData)
			.enter().append("g")
				.attr("transform", function(d) { return "translate(" + x(d.category) + ",0)"; });

			// Invisible section rectangle
			xGroups.append('rect')
				.style('opacity', 0)
				.attr("x", 0)
				.attr('y', 0)
				.attr('height', y(d3.min([0,minY])))
				.attr('width', rectBand)
				.attr('pointer-events', 'none') // Disable pointer events until animation complete
				.on('mouseover', function(d, i, event) {
					highlightGroup(this); // Highlight markers

					// Show tooltip
					tooltip.displayList( d, 'category', 'measure', columnMap, d3.event, 'colour', d.name);

					// Display section line
					var sectionLine = [
						{'x' : x(d.category) + rangeBand, 'y' : y.range()[1]},
						{'x' : x(d.category) + rangeBand, 'y' : y.range()[0]}
					];

					rmvpp.renderLine(sectionPath, sectionLine);
					rmvpp.createTrigger(pluginName, columnMap, container, 'sectionHover', d); // Trigger hover section event

				})
				.on('mouseout', function(d, i) {
					revertColour(this); // Revert colours
					tooltip.hide(); // Hide tooltip
					sectionPath.attr('opacity', 0); // Hide section line
				})
				.on('click', function(d, i) { // Trigger click section event
					rmvpp.createTrigger(pluginName, columnMap, container, 'sectionClick', d);
				})
				.transition().duration(500)
				.transition().attr('pointer-events', ''); // Enable point events when animation complete

			if (!config.secondAxis) {
				colNames.forEach(function(m, i) {
					plotChart(chartData.map(function(d) { return {measure: [d.measure[i]]}; }), [colNames[i]], i, y);
				})
			} else {
				plotChart(chartData.map(function(d) { return {measure: [d.measure[0]]}; }), [colNames[0]], 0, y);
				plotChart(chartData.map(function(d) { return {measure: [d.measure[1]]}; }), [colNames[1]], 1, y2);
			}

			function plotChart(chartData, colNames, idx, y) {
				// Draw lines between points
				var line = d3.svg.line()
					.x(function(d) { return x(d.category) + rangeBand; })
					.y(function(d) { return y(+d.value); });
                line.defined(function(d) { return !isNaN(d.value); })

				var flatLine = d3.svg.line()
					.x(function(d) { return x(d.category) + rangeBand; })
					.y(function(d) { return y(0); });

				var yVals = chartData.map(function(d) { return +d.value; });

				// Loop through series and plot lines between points
				for (var i=0; i < colNames.length; i++) {
					if (config.shadeArea) { // Shade area under line
						var measure = chartData.map(function(d) { return d.measure[i];});
						measure.push({'category' : measure[measure.length-1].category, 'name' : colNames[i], 'value' : 0});
						measure.unshift({'category' : measure[0].category, 'name' : colNames[i], 'value' : 0});
						var areaPath = chart.append("path")
							.datum(measure)
							.attr('fill', colour(chartData[0].measure[i].name))
							.attr('fill-opacity', 0.2)
							.attr('pointer-events', 'none');

						if (animate) { // Animate depending on the situation
							areaPath
								.attr('d', flatLine)
								.transition()
									.attr("d", line)
									.duration(500);
						} else
							areaPath.attr("d", line);
					}

					var measure = chartData.map(function(d) { return d.measure[i];});
					var linePath = chart.insert("path",":first-child")
						.datum(measure)
						.attr("class", "line")
						.attr('fill', 'none')
						.attr('stroke-width', config.strokeWidth)
						.attr('stroke', colour(chartData[0].measure[i].name))

					if (animate) { // Animate depending on the situation
						linePath
							.attr('d', flatLine)
							.transition()
								.attr("d", line)
								.duration(500);
					} else
						linePath.attr("d", line);
				};

				// Dashed path for trackerline
				var trackerPath = chart.append('path')
					.attr('stroke', '#666')
					.attr('stroke-dasharray', '5, 5')
					.attr('fill', 'none')
					.attr('opacity', '0')
					.attr('d', 'M0,0');

				// Create Points
				var points = xGroups.selectAll('g')
					.data(function(d) { return  [d.measure[idx]]; })
					.enter()
					.append("circle")
					.attr('r', function(d) { return isNaN(d.value) ? 0 : config.pointSize })
					.attr('cx', function(d, i) { return rangeBand; })
					.attr('fill', function(d) { return d.colour;} )
					.classed('marker', true)
					.on('mouseover', function(d, i) {
						highlightGroup(this); // Highlight markers

						// Show tooltip
						var datum = d3.selectAll($(this).parent().find('rect').toArray()).datum()
						tooltip.displayList(datum, 'category', 'measure', columnMap, d3.event, 'colour', d.name);  // Show tooltip

						// Display tracklines
						var trackerLine = [
							{'x' : 0, 'y' : y(d.value)},
							{'x' : x(d.category) + rangeBand, 'y' : y(d.value)},
							{'x' : x(d.category) + rangeBand, 'y' : y.range()[0]}
						];

						trackerPath.attr('stroke', d.colour);
						rmvpp.renderLine(trackerPath, trackerLine);
						rmvpp.createTrigger(pluginName, columnMap, container, 'pointHover', d); // Trigger hover point action
					})
					.on('mouseout', function(d, i) {
						revertColour(this); // Revert colours
						tooltip.hide(); // Hide tooltip
						trackerPath.attr('opacity', 0); // Hide trackerline
					})
					.on('click', function (d, i) { rmvpp.createTrigger(pluginName, columnMap, container, 'pointClick', d); })

				if (animate) {
					points
						.attr('cy', function(d, i) { return y(0); })
						.transition()
							.attr('cy', function(d, i) { return y(d.value ? d.value : 0); })
							.duration(500);
				} else
					points.attr('cy', function(d, i) { return y(d.value ? d.value : 0); });
			}

			if (config.horizontal) {
				chartObj.rotate();
				if (config.legend)
					legend.rotate();
			}

			// Brush function for navigation panel
			var brushNav = d3.svg.brush()
				.x(fullX)
				.on("brush", function () {
					var selected = getNavSelection();
					if (selected.length > 0)
						renderLine(selected, chartContainer);
				})
				.on('brushend', function() {
					var selected = getNavSelection();

					if (xDate) { // Convert back to 'YYYY-MM-DD' for interactions
						var selectConverted = angular.copy(selected);
						selectConverted.forEach(function(d) {
							d.category = rmvpp.locales[columnMap.category.Locale].timeFormat('%Y-%m-%d')(d.category);
						});
						rmvpp.createTrigger(pluginName, columnMap, container, 'brushSelect', selectConverted);
					} else
						rmvpp.createTrigger(pluginName, columnMap, container, 'brushSelect', selected);
				});

			// Fethes selected records by the extend of the navigator selection
			function getNavSelection() {
				var extent = brushNav.extent();

				if (!xDate) { // Ordinal X axis
					var selected = rmvpp.filterOrdinalScale(data, extent[0], extent[1], fullX);
				} else { // Continuous date X axis
					var selected = data.filter(function(d) {
						return d.category.getTime() >= extent[0].getTime() && d.category.getTime() <= extent[1].getTime()
					});
				}
				return selected;
			}

			// Navigator code
			if (navigator) {
				$(chartContainer).find('.navigator').remove();
				var navHeight = 60;
				var navFrac = navHeight / height;
				var navContainer = d3.select(chartContainer).append('div').classed('navigator do-not-print', true);
				var navChartObj = new rmvpp.Chart(navContainer[0][0], width, navHeight) // New chart object

				navChartObj.Margin = { // Scale margin by navigator fraction
					top: margin.top * navFrac,
					bottom: margin.bottom * navFrac,
					left: margin.left,
					right: margin.right
				};

				navChartObj.setX('', fullX); // Set X axis
				var navChart = navChartObj.createSVG(); // Draw SVG

				// Loop through series and plot lines between points
				for (var i=0; i < colNames.length; i++) {
					var measure = chartData.map(function(d) { return d.measure[i];});

					measure.push({'category' : measure[measure.length-1].category, 'name' : colNames[i], 'value' : 0});
					measure.unshift({'category' : measure[0].category, 'name' : colNames[i], 'value' : 0});

					// Draw lines between points
					if (!config.secondAxis) {
						var navLine = d3.svg.line()
							.x(function(d) { return fullX(d.category) + rangeBand; })
							.y(function(d) { return navFrac*y(d.value); });
					} else {
						var navY = maxY >= maxY2 ? y : y2;
						var navLine = d3.svg.line()
							.x(function(d) { return fullX(d.category) + rangeBand; })
							.y(function(d) { return navFrac*navY(d.value); });
					}
                    navLine.defined(function(d) { return !isNaN(d.value); })

					// Draw lines between points
					var navFlatline = d3.svg.line()
						.x(function(d) { return fullX(d.category) + rangeBand; })
						.y(function(d) { return navFrac*y(0); });

					navChart.append("path")
						.datum(measure)
						.attr("d", navFlatline)
						.attr('fill', '#CCC')
						.transition()
							.duration(500)
							.attr("d", navLine);
				};
				navChartObj.drawAxes(); // Draw axes
				navChart.selectAll('.x.axis .tick').remove() // Remove X labels

				var navViewport = navChart.append("g")
					.attr("class", "viewport")
					.call(brushNav)
					.selectAll("rect")
					.attr("height", navHeight - navChartObj.Margin.bottom - 2);

				if (config.horizontal)
					navChartObj.rotate();
			}

			if (config.horizontal) {
				var mainDiv = $(container).find('.main')
				$(container).find('.navigator').css('display', 'inline').insertBefore(mainDiv)
			}

			// Create select box
			if (config.dragSelect) {
				// Create select box
				rmvpp.selectBox(chart,
				function() { // Mouse down

				},
				function(boxAttrs, box) {// Mouse move
					boxAttrs.y = 0, boxAttrs.height = height - margin.bottom - 10;
					box.attr(boxAttrs);
				},
				function(boxAttrs, box) { // Mouse up
					var	minRange = (boxAttrs.x - margin.right),
						maxRange = (boxAttrs.x - margin.right) + boxAttrs.width;

					if (!xDate) { // Ordinal X axis
						var selected = rmvpp.filterOrdinalScale(chartData, minRange, maxRange, x);
						var extent = [fullX(selected[0].category), fullX(selected[selected.length-1].category)];
					} else { // Continuous date X axis
						var extent = [x.invert(minRange), x.invert(maxRange)];
						var selected = data.filter(function(d) {
							return d.category.getTime() >= extent[0].getTime() && d.category.getTime() <= extent[1].getTime()
						});
					}

					if (selected.length > 0) {
						d3.select(chartContainer).selectAll('.navigator .viewport').call(brushNav.extent(extent));

						// Trigger for brush select
						var intMap = rmvpp.actionColumnMap(['category'], columnMap, selected);
						$(chartContainer).parents('.visualisation').trigger('brushSelect', intMap);

						renderLine(selected, chartContainer); // Redraw chart
					}
				}, true);
			};

			// Add Zoom Out button if drilled
			d3.select(chartContainer).selectAll('.zoomOut').remove();
			if (chartData.length != data.length) {
				d3.select(chartContainer).insert('div', ':first-child')
					.style('text-align', 'center')
					.classed('zoomOut', true)
					.append('i')
						.attr('class', 'fa fa-2x fa-search-minus')
						.on('click', function() {
							d3.select(chartContainer).selectAll('.navigator .viewport').call(brushNav.clear());
							d3.select(chartContainer).selectAll('.main .viewport').call(brushNav.clear());
							rmvpp.createTrigger(pluginName, columnMap, container, 'brushSelect', data);
							renderLine(data, chartContainer, true, config.navigator);
						});
			}

			// Highlight markers in a group
			function highlightGroup(element) {
				d3.selectAll($(element).parent().find('circle.marker').toArray())
					.transition()
					.attr('fill', function(d) { return rmvpp.reduceBrightness(d.colour, 15); })
					.attr('r', function(d) { return isNaN(d.value) ? 0 : d3.max([3,+config.pointSize + 2]); })
					.duration(200);
			}

			// Revert colour of markers
			function revertColour(element) {
				d3.selectAll($(element).parent().find('circle.marker').toArray())
					.transition()
					.attr('fill', function(d) { return d.colour; })
					.attr('r', function(d) { return isNaN(d.value) ? 0 : +config.pointSize })
					.duration(200);
			}
		}
    }

    return rmvpp;

}(rmvpp || {}))
