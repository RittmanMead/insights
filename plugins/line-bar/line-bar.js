 rmvpp = (function(rmvpp){

    var pluginName = "line-bar";
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = 'Line/Bar Chart';
    rmvpp.Plugins[pluginName].description = 'Displays a bar and line chart on the same plot, with two Y axes but the same X axis. Should be used for displaying discrete information. Bars can be displayed as stacked as well as making the whole chart horizontal by editing the configuration properties.';
    rmvpp.Plugins[pluginName].icon = "line-chart";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
    	{
			targetProperty:"category",
			formLabel:"Category",
			type: 'dim',
			required: true,
            desc: 'Single column to be used as the x-axis of the bar chart. Should contain discrete values.'
		},
		{
			targetProperty:"barMeasure",
			formLabel:"Bar Measure",
			conditionalFormat: true,
			multiple: true,
			type: 'fact',
            desc: 'Aggregatable measure column to be used for the line in the y-axis. Multiple measures can be selected, which will render multiple bars for each measure value in different colours.'
		},
		{
			targetProperty:"lineMeasure",
			formLabel:"Line Measure",
			conditionalFormat: true,
			multiple: true,
			type: 'fact',
            desc: 'Aggregatable measure column to be used for the line in the y-axis. Multiple measures can be selected, which will render multiple lines for each measure value in different colours.'
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
				defaultValue : 3
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
			targetProperty:"xTitle",
			label: "X Axis Title",
			inputType: "textbox",
			inputOptions: {
				defaultValue : "default"
			},
            desc: 'Text input for the title of the x-axis.'
		},
		{
			targetProperty:"yTitle",
			label: "Y Axis Title",
			inputType: "textbox",
			inputOptions: {
				defaultValue : "default"
			},
            desc: 'Text input for the title of the left y-axis.'
		},
		{
			targetProperty:"y2Title",
			label: "Second Y Axis Title",
			inputType: "textbox",
			inputOptions: {
				defaultValue : "default"
			},
            desc: 'Text input for the title of the right y-axis.'
		},
		{
			targetProperty:"brushNav",
			label: "Mini-Chart Navigator",
			inputType: "checkbox",
			inputOptions: {defaultValue : true	},
            desc: 'Boolean which if true will render a miniature chart underneath the original that can be used for navigation. The user can drag on the miniature chart to scroll and zoom the main chart.'
		},
		{
			targetProperty:"legend",
			label: "Show Legend",
			inputType: "checkbox",
			inputOptions: {	defaultValue : true	},
            desc: 'Boolean which if true will show the legend.'
		},
		{
			targetProperty:"stacked",
			label: "Stacked Bar",
			inputType: "checkbox",
			inputOptions: {	defaultValue : false },
            desc: 'Display multiple bars as stacked instead of inline.'
		},
		{
			targetProperty:"horizontal",
			label: "Horizontal",
			inputType: "checkbox",
			inputOptions: {	defaultValue : false },
            desc: 'Display chart horizontal with orientation rather than vertical.'
		},
		{
			targetProperty:"sortDirDefault",
			label: "Default Sort Direction",
			inputType: "radio",
			inputOptions: {
				"values":["Ascending", "Descending"] ,
				defaultValue : 'Descending'
			},
            desc: 'Sort direction upon loading the chart.'
		},
		{
			targetProperty:"sortColDefault",
			label: "Default Sort Column",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				"min": 0,
				defaultValue : 1
			},
            desc: 'he default column to sort by. 1 is the first measure, 0 refers to the category dimension. Increasing the number will choose the respective measure in the series.'
		},
		{
			targetProperty:"sortControl",
			label: "Sort Control",
			inputType: "checkbox",
			inputOptions: {	defaultValue : true	},
            desc: 'Indicates whether to show the sort control bar or not.'
		},
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: {	"defaultValue": "Flat-UI" },
            desc: 'Colour palette to use for discrete series colours.'
		}
    ];

	rmvpp.Plugins[pluginName].actions = [
		{
			'trigger' : 'barClick',
			'type' : 'click',
			'name' : 'Click - Bar',
			'output' : ['category'],
			'description' : 'Click on a bar to pass columns and values.'
		},
		{
			'trigger' : 'barHover',
			'type' : 'mouseover',
			'name' : 'Hover - Bar',
			'output' : ['category'],
			'description' : 'Hover over a bar to pass columns and values.'
		},
		{
			'trigger' : 'pointHover',
			'type' : 'mouseover',
			'output' : ['category'],
			'name' : 'Hover - Point',
			'description' : 'Hover over a point to pass columns and values.'
		},
		{
			'trigger' : 'pointClick',
			'type' : 'click',
			'output' : ['category'],
			'name' : 'Click - Point',
			'description' : 'Click on a point to pass columns and values.'
		},
		{
			'trigger' : 'sectionClick',
			'type' : 'click',
			'name' : 'Click - Section',
			'output' : ['category'],
			'description' : 'Click on a bar to pass columns and values.'
		},
		{
			'trigger' : 'sectionHover',
			'type' : 'mouseover',
			'name' : 'Hover - Section',
			'output' : ['category'],
			'description' : 'Hover over a section to pass columns and values.'
		},
		{
			'trigger' : 'clickGroup',
			'type' : 'select',
			'name' : 'Click - Group',
			'output' : ['category'],
			'description' : 'Click or Ctrl-Click one or more bars to pass columns and values.'
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
		},
		{
			id : 'highlightBars',
			name : 'Highlight Bars',
			description : 'Highlights all bars if any passed criteria match.',
			type : 'private'
		}
	];

	// Highlight bars upon interaction
	rmvpp.Plugins[pluginName].highlightBars = function(output, container) {
		if (output.length > 0 ) {
			var bars = d3.select(container).selectAll('rect.bar');
			var data = bars.data();
			var config = output[0].config;

			bars.each(function(d, i) {
				var filter = [];
				rmvpp.Plugins[pluginName].revertColour(d3.select(this)); // Revert any highlighted points
				output.forEach(function(criteria) {	filter.push($.inArray(d[criteria.targetId], criteria.values) > -1);	}); // Find matching points

				// Highlight points
				if (d3.set(filter).values().length == 1 && d3.set(filter).values()[0] == 'true') {
					d3.select(this).transition()
						.attr('fill', function(d) { return rmvpp.increaseBrightness(d.colour, 30); });
				}
			});
		}
	};

	// Highlight selected elements
	rmvpp.Plugins[pluginName].highlight = function(element, colourScale, reduceColour) {;
		element
			.transition()
			.attr('fill', function(d, i) { return  rmvpp.reduceBrightness(d.colour, reduceColour); })
			.duration(100);
	};

	// Revert colour of bars
	rmvpp.Plugins[pluginName].revertColour = function(element) {
		element
			.transition()
			.attr('fill', function(d, i) { return d.colour; })
			.duration(100);
	};

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {
		var hideXLabels = false, hideYLabels = false;

		// Compile column name list for Y
		var colNames = [], legendTitle = 'Measures';
		var barNames = columnMap.barMeasure.map(function(m) { return m.Name; });
		var lineNames = columnMap.lineMeasure.map(function(m) { return m.Name; });
		colNames = barNames.concat(lineNames);

		// Denormalise X label onto Y values for tooltip later
		data.map(function(d) {
			for (var i=0; i < d.barMeasure.length; i++) { d.barMeasure[i].category = d.category; }
			for (var i=0; i < d.lineMeasure.length; i++) { d.lineMeasure[i].category = d.category; }
		});

		var sortColMap = columnMap;

		// Set X and Y titles
		var xTitle = config.xTitle, yTitle = config.yTitle, y2Title = config.y2Title;
		if (xTitle == 'default') xTitle = columnMap.category.Name;
		if (yTitle == 'default') yTitle = columnMap.barMeasure.map(function(m) { return m.Name; }).join(', ');
		if (y2Title == 'default') y2Title = columnMap.lineMeasure.map(function(m) { return m.Name; }).join(', ');

		// Create Sort radio buttons
		var initialSort = config.sortDirDefault == 'Descending' ? 'desc' : 'asc';
		var initialSortCol = config.sortColDefault > [columnMap.category.Name].concat(colNames).length-1 ? 1 : config.sortColDefault;
		if (config.sortControl) {
			var sortControl = d3.select(container)
				.append('div')
				.classed('sortBar', true)
				.style('margin-bottom', '5px');

			var sortHeader = sortControl.append('span');
			sortHeader.append('b').text('Sort by');
			sortHeader
				.append('select')
					.classed('sortColumn', true)
					.style('margin', '0 10px')
					.selectAll('.sortOptions')
					.data([columnMap.category.Name].concat(colNames))
					.enter()
					.append('option')
						.text(function(d, i) {return d})
						.attr('value', function(d, i) {return i});

			$(sortControl[0]).append('<span><i sort-dir="asc" class="fa fa-arrow-up"></i></span>');
			$(sortControl[0]).append('<span style="margin-left: 5px;"><i sort-dir="desc" class="fa fa-arrow-down"></span>');
			if (config.sortDirDefault == 'Descending')
				$(sortControl[0]).find('.fa-arrow-down').addClass('selected')
			else
				$(sortControl[0]).find('.fa-arrow-up').addClass('selected')
			$(sortControl[0]).find('.sortColumn').val(initialSortCol); // Set first Y column by default

			// Render chart on sort change
			$('.sortBar select').change(function() {
				sortAndRender(data, config.brushNav);
			});

			$('.sortBar i').click(function() {
				$(this).parents('.sortBar').find('i').css('color', '#000').removeClass('selected');
				$(this).css('color', '#0EBF0E').addClass('selected');
				sortAndRender(data, config.brushNav);
			});
		}

		// Render container div
		var chartContainer = d3.select(container)
			.append('div')
			.classed('bar-chart', true);

		// Render bar chart and navigation bar
		renderBar(data, $(chartContainer[0])[0], {'col' : initialSortCol, 'dir' : initialSort}, true, config.brushNav); // Sort by first Y column descending by default

		// Get sort object from UI
		function sortAndRender(data, navigator, animate) {
			animate = animate || false;
			var sortBar = $(container).find('.sortBar');
			var barContainer = $(container).find('.bar-chart')[0];

			sortObj = {}; // Use object to define sort column and direction
			sortObj.dir = sortBar.find('i.selected').attr('sort-dir');
			sortObj.col = sortBar.find('.sortColumn').val();
			renderBar(data, barContainer, sortObj, animate, navigator);
		}

		// Sort the data frame by a column in a specific direction
		function sortData(data, sort) {
			var measure = $.inArray(colNames[sort.col-1], barNames) == -1 ? 'lineMeasure' : 'barMeasure';
			var sortCol;
			if (measure == 'lineMeasure' && +sort.col > 0)
				sortCol = sort.col - barNames.length;
			else
				sortCol = sort.col

			// Sort data based on input
			switch(sort.dir) {
				case ('asc'):
					if (sortCol != 0)
						data = data.sort(function(a, b) { return d3.ascending(+a[measure][sortCol-1].value, +b[measure][sortCol-1].value); });
					else
						data = data.sort(function(a, b) {
							if (columnMap.category.SortKey)
								return d3.ascending(+a[columnMap.category.Name + ' (Sort)'], +b[columnMap.category.Name + ' (Sort)']);
							else
								return d3.ascending(a.category, b.category);
						});
					break;
				case ('desc'):
					if (sortCol != 0)
						data = data.sort(function(a, b) { return d3.descending(+a[measure][sortCol-1].value, +b[measure][sortCol-1].value); });
					else
						data = data.sort(function(a, b) {
							if (columnMap.category.SortKey)
								return d3.descending(+a[columnMap.category.Name + ' (Sort)'], +b[columnMap.category.Name + ' (Sort)']);
							else
								return d3.descending(a.category, b.category);
						});
					break;
			}
			return data;
		}

		// Main rendering function
		function renderBar(chartData, chartContainer, sort, animate, navigator) {
			// Error if no bars selected
			if (chartData.length == 0)
				rmvpp.displayError(container, 'No data: Cannot render chart.');

			chartData = sortData(chartData, sort);
			data = sortData(data, sort);

			$(chartContainer).find('.main').remove(); // Clear existing chart

			// Define column names and height and width from config
			var width = config.horizontal ? +config.height : +config.width;
			var height = config.horizontal ? +config.width : +config.height;


			// Minimum and maximum measure values
			if (!config.stacked) {
				var maxY = d3.max(chartData, function(d) { return d3.max(d.barMeasure, function(d) { return +d.value; }); });
				var minY = d3.min(chartData, function(d) { return d3.min(d.barMeasure, function(d) { return +d.value; }); });
			} else {
				var maxY = d3.max(chartData, function(d) { return d3.sum(d.barMeasure, function(d) { return +d.value; }); });
				var minY = d3.min(chartData, function(d) { return d3.sum(d.barMeasure, function(d) { return +d.value; }); });
				chartData.forEach(function(datum) { // Calculate positions for the bars for a stacked chart
					var y0 = 0;
					datum.barMeasure.forEach(function(d) {
						y0 += d.value;
						d.y0 = y0;
					});
				});
			}

			var maxY2 = d3.max(chartData, function(d) { return d3.max(d.lineMeasure, function(d) { return +d.value; }); })
			var minY2 = d3.min(chartData, function(d) { return d3.min(d.lineMeasure, function(d) { return +d.value; }); });

			// Define colour palette
			var colour = rmvpp.colourScale(colNames, config.colours); // Set colour scale

			// Apply conditional formatting to generate colours
			rmvpp.applyColours(chartData, columnMap, colour, condFormats, 'category', 'barMeasure');
			rmvpp.applyColours(chartData, columnMap, colour, condFormats, 'category', 'lineMeasure');

			// Define X axis on chart data
			var x = d3.scale.ordinal()
				.domain(chartData.map(function (d) { return d.category; }))
				.rangeBands([0, width], 0.1);

			// Define X axis on all data
			var fullX = d3.scale.ordinal()
				.domain(chartData.map(function (d) { return d.category; }))
				.rangeBands([0, width], 0.1);

			// Define category grouping
			if (config.stacked) {
				var x1 = d3.scale.ordinal()
					.domain(barNames[0])
					.rangeRoundBands([0, x.rangeBand()]);
			} else {
				var x1 = d3.scale.ordinal()
					.domain(barNames)
					.rangeRoundBands([0, x.rangeBand()]);
			}

			// Define Y axis
			var y = d3.scale.linear()
					.domain([d3.min([0, minY]), d3.max([0,maxY])]) // From 0 to maximum

			// Define Second Y axis
			var y2 = d3.scale.linear()
					.domain([d3.min([0, minY2]), d3.max([0,maxY2])]) // From 0 to maximum

			// Create chart object (plot area)
			var chartObj = new rmvpp.Chart(chartContainer, width, height);
			if (config.horizontal) chartObj.Horizontal = true;

			chartObj.setX(xTitle, x, columnMap.category);
			chartObj.setY(yTitle, y, columnMap.barMeasure[0]);
			chartObj.setY2(y2Title, y2, columnMap.lineMeasure[0]);

			var margin = chartObj.setMargin();
			chart = chartObj.createSVG(".navigator"); // Create chart SVG to standard size
			chartObj.drawAxes(); // Draw axes
			chart.parent().classed('main', true); //needs.parent to be assigned to the right part when using SVG function

			var tooltip = new rmvpp.Tooltip(chartContainer); // Create tooltip object

			if (config.legend) {
				var legend = new rmvpp.Legend(chart, colNames, legendTitle, width+margin.right, margin);  // Legend
				legend.addColourKey(colNames, colour); // Legend Colour Key
				legend.addCondFormatKey(condFormats);
			}

			// Create x partitions
			var barContainer = chart.append('g').classed('bars', true);
			var xGroupsBar = barContainer.selectAll()
				.data(chartData)
			.enter().append("g")
				.attr("transform", function(d) { return "translate(" + x(d.category) + ",0)"; });

			// Generate invisible rectangles for section hovering
			xGroupsBar.append('rect')
				.classed('section', true)
				.style('opacity', 0)
				.attr("x", 0)
				.attr('y', 0)
				.attr('height', y(d3.min([0,minY])))
				.attr('width', x.rangeBand())
				.attr('pointer-events', 'none') // Disable pointer events until animation complete
				.on('mouseover', function(d, i, event) {
					highlightPointGroup(this); // Highlight markers
					tooltip.displayList(d, 'category', ['barMeasure', 'lineMeasure'], columnMap, d3.event, 'colour');
					rmvpp.Plugins[pluginName].revertColour(chart.selectAll('rect.bar:not(.selected)'));
					rmvpp.Plugins[pluginName].highlight(d3.select(this).parent().selectAll('rect.bar:not(.selected)'), colour, 15); // Highlight group of bars
					rmvpp.createTrigger(pluginName, columnMap, container, 'sectionHover', d); // Trigger sectionHover event
				})
				.on('mouseout', function(d, i) {
					revertPointColour(this);
					rmvpp.Plugins[pluginName].revertColour(d3.select(this).parent().selectAll('rect.bar:not(.selected)'));
					tooltip.hide(tooltip);
				})
				.on("click", function(d, i) {
					deselectBars();
					rmvpp.createTrigger(pluginName, columnMap, container, 'clickGroup', data);
					rmvpp.createTrigger(pluginName, columnMap, container, 'sectionClick', d); // Trigger sectionClick event
				})
				.transition().duration(500)
				.transition().attr('pointer-events', ''); // Enable point events when animation complete


			// Create bars
			var barWidth = config.stacked ? x.rangeBand() : x1.rangeBand();
			var bars = xGroupsBar.selectAll('g')
				.data(function(d) { return d.barMeasure; })
				.enter()
				.append("rect")
				.classed('bar', true)
				.attr("x", function(d, i) { return x1(d.name); })
				.attr("height", function(d, i) {return 0;})
				.attr("width", barWidth)
				.attr('fill', function(d, i) { return d.colour; })
				.attr('pointer-events', 'none') // Disable pointer events until animation complete
				.on('mouseover', function(d, i, event) {
					var datum = d3.selectAll($(this).parent().find('rect.section').toArray()).datum();
					tooltip.displayList(datum, 'category', 'barMeasure', columnMap, d3.event, 'colour', d.name);
					rmvpp.Plugins[pluginName].highlight(d3.select(this).parent().selectAll('rect.bar:not(.selected)'), colour, 15, condFormats); // Highlight group of bars
					rmvpp.createTrigger(pluginName, columnMap, container, 'barHover', d); // Trigger barHover event
				})
				.on('mouseout', function(d, i, event) {
					rmvpp.Plugins[pluginName].revertColour(d3.select(this).parent().selectAll('rect.bar:not(.selected)'));
					tooltip.hide();
				})
				.on("click", function(d, i) {
					if (!event.ctrlKey && !d3.select(this).classed('selected')) // Allow control clicking to select more bars
						deselectBars();

					if (event.ctrlKey && d3.select(this).classed('selected')) {
						d3.select(this).classed('selected', false);
						rmvpp.Plugins[pluginName].revertColour(d3.select(this));
					} else { // Highlight bar on click (reverting other bars)
						d3.select(this)
							.classed('selected', true)
							.attr('fill', function(d, i) { return rmvpp.increaseBrightness(d.colour, 30); });
					}

					var selectedData = chart.selectAll('rect.bar.selected').data();
					if (selectedData.length == 0)
						selectedData = chartData;
					else { // Display tooltip showing summary of selected values
						var summary = {}; // Data object for tooltip
						summary.count = selectedData.length;
						summary.barMeasure = [];

						columnMap.barMeasure.forEach(function(m) { // Create summary object
							var filterMeasure = selectedData.filter(function(d) { return d.name == m.Name; });
							var measureTotal = d3[rmvpp.convertMeasure(m.Measure)](filterMeasure.map(function(d) { return +d.value; })) || 0;
							if (measureTotal != 0)
								summary.barMeasure.push({'name' : m.Name, 'value' : measureTotal});
						});

						columnMap['count'] = new obiee.BIColumn('', 'Count', 'integer');
						tooltip.displayList(summary, 'count', 'barMeasure', columnMap, d3.event, 'colour');
						delete columnMap['count'];
					}

					rmvpp.createTrigger(pluginName, columnMap, container, 'clickGroup', selectedData);
					rmvpp.createTrigger(pluginName, columnMap, container, 'barClick', d);

				}); // Trigger barClick event

			// Calculate y position differently if stacked
			function yPos(d) {
				if (!config.stacked)
					return y(Math.max(0, d.value));
				else
					return y(Math.max(0, d.y0));
			}

			// Animate on load
			if (animate) {
				bars.attr("y", function(d, i) {return y(0);}) // Set bar height to 0 for animations
					.transition() // Animate bars on render
						.attr("y", function(d, i) { return yPos(d); })
						.attr("height", function(d, i) { return Math.abs(y(d.value) - y(0)); })
						.duration(500)
					.transition().duration(500).attr('pointer-events', ''); // Enable point events when animation complete
			} else {
				bars.attr("y", function(d, i) { return yPos(d); })
					.attr("height", function(d, i) { return Math.abs(y(d.value) - y(0)); })
					.attr('pointer-events', '');
			}

			var pointContainer = chart.append('g').classed('points', true);
			var xGroupsPoint = pointContainer.selectAll()
				.data(chartData)
			.enter().append("g")
				.attr("transform", function(d) { return "translate(" + x(d.category) + ",0)"; });

			// Create Points
			var points = xGroupsPoint.selectAll('g')
				.data(function(d) { return d.lineMeasure; })
				.enter()
				.append("circle")
				.attr('r', config.pointSize)
				.attr('cx', function(d, i) { return (x.rangeBand()/2); })
				.attr('fill', function(d) { return d.colour;} )
				.classed('marker', true)
				.on('click', function(d, i) {
					rmvpp.createTrigger(pluginName, columnMap, container, 'pointClick', d); // Trigger hover point action
				})
				.on('mouseover', function(d, i) {
					highlightPointGroup(this); // Highlight markers

					// Show tooltip
					var idx = $(this).parent().index();
					var datum = d3.selectAll($($(container).find('g.bars').children('g')[idx]).find('rect').toArray()).datum()
					tooltip.displayList(datum, 'category', 'lineMeasure', columnMap, d3.event, 'colour', d.name);  // Show tooltip
					rmvpp.createTrigger(pluginName, columnMap, container, 'pointHover', d); // Trigger hover point action
				})
				.on('mouseout', function(d, i) {
					revertPointColour(this); // Revert colours
					tooltip.hide(); // Hide tooltip
				})

			if (animate) {
				points
					.attr('cy', function(d, i) { return y2(0); })
					.transition()
						.attr('cy', function(d, i) { return y2(d.value); })
						.duration(500);
			} else
				points.attr('cy', function(d, i) { return y2(d.value); });

			// Draw lines between points
			var line = d3.svg.line()
				.x(function(d) { return x(d.category) + x.rangeBand()/2; })
				.y(function(d) { return y2(d.value); });

			var flatLine = d3.svg.line()
				.x(function(d) { return x(d.category) + x.rangeBand()/2; })
				.y(function(d) { return y2(0); });

			// Loop through series and plot lines between points
			for (var i=0; i < lineNames.length; i++) {
				var measure = chartData.map(function(d) { return d.lineMeasure[i];});
				var linePath = chart.insert("path", 'g.points')
					.datum(measure)
					.attr("class", "line")
					.attr('fill', 'none')
					.attr('stroke-width', config.strokeWidth)
					.attr('stroke', colour(chartData[0].lineMeasure[i].name))

				if (animate) { // Animate depending on the situation
					linePath
						.attr('d', flatLine)
						.transition()
							.attr("d", line)
							.duration(500);
				} else
					linePath.attr("d", line);
			};

			if (config.horizontal) {
				chartObj.rotate();
				if (config.legend)
					legend.rotate();
			}

			var brush = d3.svg.brush()
				.x(fullX)
				.on("brush", function () {
					var selected = getNavSelection();
					if (selected.length > 0)
						sortAndRender(selected, false);
				})
				.on('brushend', function() {
					var selected = getNavSelection();

					// Trigger for brush select
					var intMap = rmvpp.actionColumnMap(['category'], columnMap, selected);
					$(chartContainer).parents('.visualisation').trigger('brushSelect', intMap);
				});

			function getNavSelection() {
				var maxRange = d3.max(brush.extent());
				var minRange = d3.min(brush.extent());
				var selected = rmvpp.filterOrdinalScale(data, minRange, maxRange, fullX);
				return selected;
			}

			if (navigator) {
				$(chartContainer).find('.navigator').remove();
				var navHeight = 60;
				var navFrac = navHeight / height;
				var navContainer = d3.select(chartContainer).append('div').classed('navigator', true).classed('do-not-print', true);
				var navChartObj = new rmvpp.Chart(navContainer[0][0], width, navHeight) // New chart object

				navChartObj.Margin = { // Scale margin by navigator fraction
					top: margin.top * navFrac,
					bottom: margin.bottom * navFrac,
					left: margin.left,
					right: margin.right
				};
				navChartObj.setX('', fullX); // Set X axis
				var navChart = navChartObj.createSVG(); // Draw SVG
				navChartObj.drawAxes(); // Draw axes
				navChart.selectAll('.x.axis .tick').remove() // Remove X labels

				var navGroups = navChart.selectAll(".navGroups")
					.data(data)
				.enter().append("g")
					.attr("transform", function(d) { return "translate(" + x(d.category) + ",0)"; });

				// Create bars
				navGroups.selectAll('g')
					.data(function(d) { return d.barMeasure; })
					.enter()
					.append("rect")
					.classed('bar', true)
					.attr("x", function(d, i) { return x1(d.name); })
					.attr("width", barWidth)
					.attr("y", function(d, i) { return navFrac*yPos(d); })
					.attr("height", function(d, i) { return navFrac*Math.abs(y(d.value) - y(0)); });

				var viewport = navChart.append("g")
					.attr("class", "viewport")
					.call(brush)
					.selectAll("rect")
					.attr("height", navHeight - navChartObj.Margin.bottom - 2);

				if (config.horizontal)
					navChartObj.rotate();
			}

			if (config.horizontal) {
				var mainDiv = $(container).find('.main')
				$(container).find('.navigator').css('display', 'inline').insertBefore(mainDiv)
			}

			// Add Zoom Out button if drilled
			d3.select(chartContainer).selectAll('.zoomOut').remove();
			if (chartData.length != data.length) {
				d3.select(chartContainer).insert('div', ':first-child')
					.style('text-align', 'center')
					.classed('zoomOut', true)
					.append('i')
						.attr('class', 'fa fa-2x fa-search-minus')
						.on('click', function() {
							brush.clear();
							d3.select(chartContainer).selectAll('.navigator .viewport').call(brush);
							rmvpp.createTrigger(pluginName, columnMap, container, 'brushSelect', data);
							sortAndRender(data, true, true);
						});
			}

			// Deselect bars
			function deselectBars() {
				selectedBars = chart.selectAll('rect.bar.selected')
				selectedBars.classed('selected', false);
				rmvpp.Plugins[pluginName].revertColour(selectedBars);
			}

			// Highlight markers in a group
			function highlightPointGroup(element) {
				d3.selectAll($(element).parent().find('circle.marker').toArray())
					.transition()
					.attr('fill', function(d) { return rmvpp.reduceBrightness(d.colour, 15); })
					.attr('r', d3.max([3,+config.pointSize + 2]))
					.duration(200);
			}

			// Revert colour of markers
			function revertPointColour(element) {
				d3.selectAll($(element).parent().find('circle.marker').toArray())
					.transition()
					.attr('fill', function(d) { return d.colour; })
					.attr('r', +config.pointSize)
					.duration(200);
			}
		};
    }

    return rmvpp;

}(rmvpp || {}))
